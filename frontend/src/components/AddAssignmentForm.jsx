import { useState } from 'react';
import { useChoreTypes, useAssignments, useCreateAssignment } from '../hooks/useChores';
import { useMembers } from '../hooks/useMembers';

export function AddAssignmentForm({ houseId }) {
  const { data: choreTypes = [] } = useChoreTypes(houseId);
  const { data: members = [] } = useMembers(houseId);
  const createAssignment = useCreateAssignment(houseId);
  const [choreTypeId, setChoreTypeId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [useRotation, setUseRotation] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!choreTypeId) return;
    createAssignment.mutate(
      {
        choreTypeId,
        memberId: memberId || undefined,
        useRotation: useRotation && !memberId,
      },
      {
        onSuccess: () => {
          setMemberId('');
        },
      }
    );
  };

  if (choreTypes.length === 0) return null;

  return (
    <section className="add-assignment">
      <h3>New assignment</h3>
      <form onSubmit={handleSubmit} className="add-assignment__form">
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
        <label className="add-assignment__rotation">
          <input
            type="checkbox"
            checked={useRotation}
            onChange={(e) => setUseRotation(e.target.checked)}
          />
          Rotate (pick next person automatically)
        </label>
        {!useRotation && (
          <label>
            Assign to
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" disabled={createAssignment.isLoading}>
          Add assignment
        </button>
      </form>
    </section>
  );
}
