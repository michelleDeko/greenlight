# frozen_string_literal: true

class AddMeetingTimeFieldsToRooms < ActiveRecord::Migration[7.2]
  def change
    change_table :rooms, bulk: true do |t|
      t.column :scheduled_start_time, :datetime
      t.column :meeting_duration_minutes, :integer, default: 0
    end
  end
end
