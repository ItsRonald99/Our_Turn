import { useState } from 'react';
import { useChoreTypes, useAssignments, useCreateAssignment, useCreateChoreType } from '../hooks/useChores';
import { useMembers } from '../hooks/useMembers';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AddAssignmentForm({ houseId }) {
  const { data: choreTypes = [] } = useChoreTypes(houseId);
  const { data: members = [] } = useMembers(houseId);
  const createAssignment = useCreateAssignment(houseId);
  const createChoreType = useCreateChoreType(houseId);

  const [choreTypeId, setChoreTypeId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [useRotation, setUseRotation] = useState(true);
  const [dueDate, setDueDate] = useState(todayISO());

  // Inline chore type creation
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeError, setNewTypeError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!choreTypeId) return;
    createAssignment.mutate(
      {
        choreTypeId,
        memberId: memberId || undefined,
        dueDate,
        useRotation: useRotation && !memberId,
      },
      {
        onSuccess: () => {
          setMemberId('');
          setDueDate(todayISO());
        },
      }
    );
  };

  const handleAddChoreType = (e) => {
    e.preventDefault();
    const name = newTypeName.trim();
    if (!name) return;
    setNewTypeError('');
    createChoreType.mutate(
      { name },
      {
        onSuccess: (res) => {
          setChoreTypeId(res.data.id);
          setNewTypeName('');
          setShowNewType(false);
        },
        onError: (err) => {
          setNewTypeError(err.message || 'Failed to create chore type');
        },
      }
    );
  };

  return (
    <section className="add-assignment">
      <h3>New assignment</h3>
      <form onSubmit={handleSubmit} className="add-assignment__form">

        {/* Chore type selector + inline creation */}
        <label>
          Chore
          <div className="add-assignment__chore-row">
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
            <button
              type="button"
              className="add-assignment__new-type-toggle"
              onClick={() => { setShowNewType((v) => !v); setNewTypeError(''); }}
              title="Add new chore type"
            >
              {showNewType ? '✕' : '+'}
            </button>
          </div>
        </label>

        {showNewType && (
          <div className="add-assignment__new-type">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="New chore type name"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddChoreType}
              disabled={createChoreType.isLoading || !newTypeName.trim()}
            >
              {createChoreType.isLoading ? 'Adding…' : 'Add'}
            </button>
            {newTypeError && <p className="add-assignment__error">{newTypeError}</p>}
          </div>
        )}

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
