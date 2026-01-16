// BigBlueButton open source conferencing system - http://www.bigbluebutton.org/.
//
// Copyright (c) 2022 BigBlueButton Inc. and by respective authors (see below).
//
// This program is free software; you can redistribute it and/or modify it under the
// terms of the GNU Lesser General Public License as published by the Free Software
// Foundation; either version 3.0 of the License, or (at your option) any later
// version.
//
// Greenlight is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License along
// with Greenlight; if not, see <http://www.gnu.org/licenses/>.

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Row, Col, Button, Stack } from 'react-bootstrap';
import { toast } from 'react-toastify';
import useUpdateRoom from '../../../../hooks/mutations/rooms/useUpdateRoom';

// Recurrence rule options mapping
const RECURRENCE_OPTIONS = {
  none: '',
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

export default function MeetingTimeSettings({ friendlyId, room }) {
  const { t } = useTranslation();
  
  // Defensive check - don't even create the hook if we have invalid data
  if (!friendlyId || friendlyId === 'undefined' || !room) {
    return null;
  }
  
  const updateRoom = useUpdateRoom({ friendlyId });
  const [startDate, setStartDate] = useState(room?.scheduled_start_time?.split('T')[0] || '');
  const [startTime, setStartTime] = useState(room?.scheduled_start_time?.split('T')[1]?.substring(0, 5) || '');
  const [duration, setDuration] = useState(room?.meeting_duration_minutes || 0);
  const [recurrence, setRecurrence] = useState(() => {
    const rule = room?.recurrence_rule || '';
    // Find the matching option key
    return Object.keys(RECURRENCE_OPTIONS).find(key => RECURRENCE_OPTIONS[key] === rule) || 'none';
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    let scheduledStartTime = null;
    if (startDate && startTime) {
      scheduledStartTime = `${startDate}T${startTime}:00`;
    }

    updateRoom.mutate(
      {
        scheduled_start_time: scheduledStartTime,
        meeting_duration_minutes: duration || 0,
        recurrence_rule: RECURRENCE_OPTIONS[recurrence] || '',
      },
      {
        onSuccess: () => {
          toast.success(t('toast.success.room.meeting_time_updated'));
          setIsEditing(false);
        },
        onError: () => {
          toast.error(t('toast.error.problem_completing_action'));
        },
      },
    );
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  if (!isEditing) {
    return (
      <div className="room-settings-row text-muted py-2 d-flex">
        <div className="me-auto">
          <p className="mb-1">{t('room.settings.meeting_schedule')}</p>
          <small>
            {room?.scheduled_start_time ? (
              <>
                <span>
                  {t('room.settings.start_time')}
                  {': '}
                  {formatDateTime(room.scheduled_start_time)}
                </span>
                <br />
                <span>
                  {t('room.settings.duration')}
                  {': '}
                  {room.meeting_duration_minutes || 0}
                  {' '}
                  {t('room.settings.minutes')}
                </span>
                {room?.recurrence_rule && (
                  <>
                    <br />
                    <span>
                      {t('room.settings.recurrence')}
                      {': '}
                      {(() => {
                        const rule = room.recurrence_rule;
                        const option = Object.keys(RECURRENCE_OPTIONS).find(key => RECURRENCE_OPTIONS[key] === rule);
                        return option ? t(`room.settings.recurrence_${option}`) : rule;
                      })()}
                    </span>
                  </>
                )}
              </>
            ) : (
              t('room.settings.no_schedule')
            )}
          </small>
        </div>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => setIsEditing(true)}
          disabled={updateRoom.isLoading}
        >
          {t('edit')}
        </Button>
      </div>
    );
  }

  return (
    <div className="room-settings-row py-2">
      <h6 className="mb-3">{t('room.settings.meeting_schedule')}</h6>
      <Row className="mb-3">
        <Col md={6}>
          <label htmlFor="start-date" className="form-label">
            {t('room.settings.start_date')}
          </label>
          <input
            id="start-date"
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={updateRoom.isLoading}
          />
        </Col>
        <Col md={6}>
          <label htmlFor="start-time" className="form-label">
            {t('room.settings.start_time')}
          </label>
          <input
            id="start-time"
            type="time"
            className="form-control"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={updateRoom.isLoading || !startDate}
          />
        </Col>
      </Row>
      <Row className="mb-3">
        <Col md={6}>
          <label htmlFor="duration" className="form-label">
            {t('room.settings.duration')}
            {' '}
            ({t('room.settings.minutes')})
          </label>
          <input
            id="duration"
            type="number"
            className="form-control"
            min="0"
            max="480"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
            disabled={updateRoom.isLoading}
          />
        </Col>
        <Col md={6}>
          <label htmlFor="recurrence" className="form-label">
            {t('room.settings.recurrence')}
          </label>
          <select
            id="recurrence"
            className="form-control"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            disabled={updateRoom.isLoading || !startDate}
          >
            <option value="none">{t('room.settings.recurrence_none')}</option>
            <option value="daily">{t('room.settings.recurrence_daily')}</option>
            <option value="weekly">{t('room.settings.recurrence_weekly')}</option>
            <option value="monthly">{t('room.settings.recurrence_monthly')}</option>
            <option value="yearly">{t('room.settings.recurrence_yearly')}</option>
          </select>
        </Col>
      </Row>
      <Stack direction="horizontal" gap={2}>
        <Button
          variant="brand"
          size="sm"
          onClick={handleSave}
          disabled={updateRoom.isLoading || (!startDate && !startTime && duration === 0)}
        >
          {t('save')}
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => {
            setIsEditing(false);
            setStartDate(room?.scheduled_start_time?.split('T')[0] || '');
            setStartTime(room?.scheduled_start_time?.split('T')[1]?.substring(0, 5) || '');
            setDuration(room?.meeting_duration_minutes || 0);
            const rule = room?.recurrence_rule || '';
            setRecurrence(Object.keys(RECURRENCE_OPTIONS).find(key => RECURRENCE_OPTIONS[key] === rule) || 'none');
          }}
          disabled={updateRoom.isLoading}
        >
          {t('cancel')}
        </Button>
      </Stack>
    </div>
  );
}

MeetingTimeSettings.propTypes = {
  friendlyId: PropTypes.string.isRequired,
  room: PropTypes.shape({
    scheduled_start_time: PropTypes.string,
    meeting_duration_minutes: PropTypes.number,
    recurrence_rule: PropTypes.string,
  }).isRequired,
};
