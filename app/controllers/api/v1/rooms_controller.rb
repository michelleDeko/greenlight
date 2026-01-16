# BigBlueButton open source conferencing system - http://www.bigbluebutton.org/.
#
# Copyright (c) 2022 BigBlueButton Inc. and by respective authors (see below).
#
# This program is free software; you can redistribute it and/or modify it under the
# terms of the GNU Lesser General Public License as published by the Free Software
# Foundation; either version 3.0 of the License, or (at your option) any later
# version.
#
# Greenlight is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
# PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License along
# with Greenlight; if not, see <http://www.gnu.org/licenses/>.

# frozen_string_literal: true

require 'icalendar'

module Api
  module V1
    class RoomsController < ApiController
      skip_before_action :ensure_authenticated, only: %i[public_show public_recordings]
      skip_before_action :ensure_valid_request, only: %i[calendar]

      before_action :find_room,
                    only: %i[show update destroy recordings recordings_processing purge_presentation
                             public_show public_recordings calendar]

      before_action only: %i[create] do
        ensure_authorized('CreateRoom')
      end
      before_action only: %i[create] do
        ensure_authorized('ManageUsers', user_id: room_params[:user_id])
      end
      before_action only: %i[show update recordings recordings_processing purge_presentation calendar] do
        ensure_authorized(%w[ManageRooms SharedRoom], friendly_id: params[:friendly_id])
      end
      before_action only: %i[destroy] do
        ensure_authorized('ManageRooms', friendly_id: params[:friendly_id])
      end

      # GET /api/v1/rooms.json
      # Returns a list of the current_user's rooms and shared rooms
      def index
        shared_rooms = SharedAccess.where(user_id: current_user.id).select(:room_id)
        rooms = Room.includes(:user)
                    .where(user_id: current_user.id)
                    .or(Room.where(id: shared_rooms))
                    .order(online: :desc)
                    .order('last_session DESC NULLS LAST')
                    .search(params[:search])

        rooms.map do |room|
          room.shared = true if room.user_id != current_user.id
        end

        RunningMeetingChecker.new(rooms: rooms.select(&:online)).call if rooms.any?(&:online)

        render_data data: rooms, status: :ok
      end

      # GET /api/v1/rooms/:friendly_id.json
      # Returns the info on a specific room
      def show
        RunningMeetingChecker.new(rooms: @room).call if @room.online

        @room.shared = current_user.shared_rooms.include?(@room)

        render_data data: @room, serializer: CurrentRoomSerializer, status: :ok
      end

      # GET /api/v1/rooms/:friendly_id/public.json
      # Returns all publicly available information required for a room to be joined
      def public_show
        settings = RoomSettingsGetter.new(
          room_id: @room.id,
          provider: current_provider,
          current_user:,
          show_codes: false,
          settings: %w[glRequireAuthentication glViewerAccessCode glModeratorAccessCode record glAnyoneJoinAsModerator]
        ).call

        render_data data: @room, serializer: PublicRoomSerializer, options: { settings: }, status: :ok
      end

      # POST /api/v1/rooms.json
      # Creates a room for the specified user if they are allowed to
      def create
        return render_error status: :bad_request, errors: Rails.configuration.custom_error_msgs[:room_limit] unless PermissionsChecker.new(
          permission_names: 'RoomLimit',
          user_id: room_params[:user_id], current_user:, current_provider:
        ).call

        # TODO: amir - ensure accessibility for authenticated requests only.
        # The created room will be the current user's unless a user_id param is provided with the request.
        room = Room.new(name: room_params[:name], user_id: room_params[:user_id])

        if room.save
          logger.info "room(friendly_id):#{room.friendly_id} created for user(id):#{room.user_id}"
          render_data data: "/rooms/#{room.friendly_id}", status: :created
        else
          render_error errors: room.errors.to_a, status: :bad_request
        end
      end

      # PATCH /api/v1/rooms/:friendly_id.json
      # Updates the values of the specified room
      def update
        if @room.update(room_params.except(:user_id))
          render_data status: :ok
        else
          render_error errors: @room.errors.to_a, status: :bad_request
        end
      end

      # DELETE /api/v1/rooms.json
      # Updates the specified room
      def destroy
        if @room.destroy
          render_data status: :ok
        else
          render_error errors: @room.errors.to_a, status: :bad_request
        end
      end

      # DELETE /api/v1/rooms/${friendlyId}/purge_presentation.json
      # Removes the presentation attached to the room
      def purge_presentation
        @room.presentation.purge

        render_data status: :ok
      end

      # GET /api/v1/rooms/:friendly_id/recordings.json
      # Returns all of a specific room's recordings
      def recordings
        sort_config = config_sorting(allowed_columns: %w[name length visibility])

        pagy, room_recordings = pagy(@room.recordings&.order(sort_config, recorded_at: :desc)&.search(params[:search]), items: 3)
        render_data data: room_recordings, meta: pagy_metadata(pagy), status: :ok
      end

      # GET /api/v1/rooms/:friendly_id/public_recordings.json
      # Returns all of a specific room's PUBLIC recordings
      def public_recordings
        sort_config = config_sorting(allowed_columns: %w[name length])

        pagy, recordings = pagy(@room.public_recordings.order(sort_config, recorded_at: :desc).public_search(params[:search]))

        render_data data: recordings, meta: pagy_metadata(pagy), serializer: PublicRecordingSerializer, status: :ok
      end

      # GET /api/v1/rooms/:friendly_id/recordings_processing.json
      # Returns the total number of processing recordings for a specific room
      def recordings_processing
        render_data data: @room.recordings_processing, status: :ok
      end

      # GET /api/v1/rooms/:friendly_id/calendar.ics
      # Returns the room calendar in ICS format
      def calendar
        ics_content = generate_ics(@room)
        send_data ics_content,
                  type: 'text/calendar; charset=utf-8',
                  filename: "#{@room.name.parameterize}-#{Time.zone.today}.ics"
      end

      private

      def find_room
        @room = Room.find_by!(friendly_id: params[:friendly_id])
      end

      def generate_ics(room)
        return '' if room.scheduled_start_time.blank?

        cal = Icalendar::Calendar.new
        cal.version = '2.0'
        cal.prodid = '-//BigBlueButton//Greenlight//EN'

        join_url = "#{request.base_url}/rooms/#{room.friendly_id}/join"
        description = "Join the meeting at: #{join_url}"

        event = Icalendar::Event.new
        event.uid = "#{room.friendly_id}@greenlight"
        event.dtstamp = Time.now.utc
        event.created = Time.now.utc
        event.last_modified = Time.now.utc
        event.summary = room.name
        event.description = description
        event.dtstart = room.scheduled_start_time.to_datetime
        event.dtend = (room.scheduled_start_time + room.meeting_duration_minutes.minutes).to_datetime if room.meeting_duration_minutes.present?
        event.location = ''

        # Add organizer if current_user is available
        if current_user&.email.present?
          event.organizer = "mailto:#{current_user.email}"
        else
          # Fallback organizer using room owner's email or a generic one
          organizer_email = room.user&.email || 'noreply@greenlight'
          event.organizer = "mailto:#{organizer_email}"
        end

        # Add recurrence rule if specified
        event.rrule = room.recurrence_rule if room.recurrence_rule.present?

        cal.add_event(event)
        cal.to_ical
      end

      def room_params
        params.require(:room).permit(:name, :user_id, :presentation, :scheduled_start_time, :meeting_duration_minutes, :recurrence_rule)
      end
    end
  end
end
