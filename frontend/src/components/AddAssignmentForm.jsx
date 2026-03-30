import { useState } from 'react';
import { useCreateAssignment } from '../hooks/useChores';
import { useChoreTypes } from '../hooks/useChoreTypes';
import { useMembers } from '../hooks/useMembers';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AddAssignmentForm({ houseId }) {
  const { data: choreTypes = [] } = useChoreTypes(houseId);
  const { data: members = [] } = useMembers(houseId);
  const createAssignment = useCreateAssignment(houseId);

  const [choreTypeId, setChoreTypeId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [useRotation, setUseRotation] = useState(true);
  const [dueDate, setDueDate] = useState(todayISO());
  const [recurrenceType, setRecurrenceType] = useState('');   // '' | 'interval' | 'weekday'
  const [recurrenceValue, setRecurrenceValue] = useState(7);  // interval days or weekday 0-6

  const handleRecurrenceTypeChange = (type) => {
    setRecurrenceType(type);
    if (type === 'interval') setRecurrenceValue(7);
    if (type === 'weekday') setRecurrenceValue(1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!choreTypeId) return;
    const payload = {
      choreTypeId,
      memberId: memberId || undefined,
      dueDate,
      useRotation: useRotation && !memberId,
    };
    if (recurrenceType) {
      payload.recurrenceType = recurrenceType;
      payload.recurrenceValue = recurrenceValue;
    }
    createAssignment.mutate(payload, {
      onSuccess: () => {
        setMemberId('');
        setDueDate(todayISO());
        setRecurrenceType('');
        setRecurrenceValue(7);
      },
    });
  };

  return (
    <section className="add-assignment">
      <h3>New assignment</h3>
      <form onSubmit={handleSubmit} className="add-assignment__form">

        {/* Chore type selector */}
        <label>
          Chore
          <select
            value={choreTypeId}
            onChange={(e) => setChoreTypeId(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {choreTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {/* Due date */}
        <label>
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="add-assignment__date"
          />
        </label>

        {/* Recurrence */}
        <label>
          Repeat
          <select
            value={recurrenceType}
            onChange={(e) => handleRecurrenceTypeChange(e.target.value)}
            className="add-assignment__recurrence-select"
          >
            <option value="">Does not repeat</option>
            <option value="interval">Every N days</option>
            <option value="weekday">Every weekday</option>
          </select>
        </label>

        {recurrenceType === 'interval' && (
          <label>
            Interval
            <select
              value={recurrenceValue}
              onChange={(e) => setRecurrenceValue(Number(e.target.value))}
              className="add-assignment__recurrence-select"
              aria-label="Interval in days"
            >
              <option value={1}>Daily (every 1 day)</option>
              <option value={2}>Every 2 days</option>
              <option value={3}>Every 3 days</option>
              <option value={4}>Every 4 days</option>
              <option value={5}>Every 5 days</option>
              <option value={6}>Every 6 days</option>
              <option value={7}>Weekly (every 7 days)</option>
              <option value={14}>Biweekly (every 14 days)</option>
              <option value={21}>Every 3 weeks</option>
              <option value={28}>Every 4 weeks</option>
            </select>
          </label>
        )}

        {recurrenceType === 'weekday' && (
          <label>
            Day of week
            <select
              value={recurrenceValue}
              onChange={(e) => setRecurrenceValue(Number(e.target.value))}
              className="add-assignment__recurrence-select"
              aria-label="Day of week"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
            </select>
          </label>
        )}

        {/* Rotation toggle */}
        <label className="add-assignment__rotation">
          <input
            type="checkbox"
            checked={useRotation}
            onChange={(e) => {
              setUseRotation(e.target.checked);
              if (e.target.checked) setMemberId('');
            }}
          />
          Rotate (pick next person automatically)
        </label>

        {/* Manual assignee — only shown when rotation is off */}
        {!useRotation && (
          <label>
            Assign to
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
        )}

        {createAssignment.isError && (
          <p className="add-assignment__error">{createAssignment.error?.message}</p>
        )}

        <button type="submit" disabled={createAssignment.isLoading}>
          {createAssignment.isLoading ? 'Adding…' : 'Add assignment'}
        </button>
      </form>
    </section>
  );
}
