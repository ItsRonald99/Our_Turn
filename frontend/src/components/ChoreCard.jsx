import { useState } from 'react';
import { useCompleteAssignment, useUpdateAssignment, useDeleteAssignment } from '../hooks/useChores';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function recurrenceLabel(type, value) {
  if (!type) return null;
  if (type === 'interval') {
    if (value === 1) return 'Daily';
    if (value === 7) return 'Weekly';
    if (value === 14) return 'Biweekly';
    return `Every ${value} days`;
  }
  if (type === 'weekday') {
    return `Every ${WEEKDAY_NAMES[value] ?? '?'}`;
  }
  return null;
}

function toDateInputValue(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function ChoreCard({ houseId, assignment, choreTypeName, memberName, members = [] }) {
  const complete = useCompleteAssignment(houseId);
  const update = useUpdateAssignment(houseId);
  const remove = useDeleteAssignment(houseId);

  const [isEditing, setIsEditing] = useState(false);
  const [editMemberId, setEditMemberId] = useState(assignment.memberId ?? '');
  const [editDueDate, setEditDueDate] = useState(toDateInputValue(assignment.dueDate));
  const [editError, setEditError] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const due = assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 10) : '—';
  const isCompleted = !!assignment.completedAt;
  const isBusy = complete.isLoading || update.isLoading || remove.isLoading;

  const handleEdit = () => {
    setEditMemberId(assignment.memberId ?? '');
    setEditDueDate(toDateInputValue(assignment.dueDate));
    setEditError('');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editMemberId) {
      setEditError('Please select a member.');
      return;
    }
    if (!editDueDate) {
      setEditError('Please pick a due date.');
      return;
    }
    setEditError('');
    update.mutate(
      { assignmentId: assignment.id, memberId: editMemberId, dueDate: editDueDate },
      {
        onSuccess: () => setIsEditing(false),
        onError: (err) => setEditError(err.message || 'Failed to save changes'),
      }
    );
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete this "${choreTypeName}" assignment? This cannot be undone.`)) return;
    remove.mutate(assignment.id);
  };

  return (
    <div className="chore-card" data-completed={isCompleted} data-editing={isEditing} data-confirming={showCompleteConfirm}>
      <div className="chore-card__header">
        <span className="chore-card__type">{choreTypeName}</span>
        {!isEditing && (
          <span className="chore-card__due">Due: {due}</span>
        )}
      </div>

      {recurrenceLabel(assignment.recurrenceType, assignment.recurrenceValue) && (
        <span className="chore-card__recurrence">
          ↻ {recurrenceLabel(assignment.recurrenceType, assignment.recurrenceValue)}
        </span>
      )}

      {isEditing ? (
        <div className="chore-card__edit">
          <label className="chore-card__edit-label">
            Assignee
            <select
              value={editMemberId}
              onChange={(e) => setEditMemberId(e.target.value)}
              className="chore-card__edit-select"
            >
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </label>
          <label className="chore-card__edit-label">
            Due date
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="chore-card__edit-date"
            />
          </label>
          {editError && <p className="chore-card__edit-error">{editError}</p>}
          <div className="chore-card__edit-actions">
            <button
              type="button"
              className="chore-card__save"
              onClick={handleSave}
              disabled={isBusy}
            >
              {update.isLoading ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="chore-card__cancel"
              onClick={() => { setIsEditing(false); setEditError(''); }}
              disabled={isBusy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="chore-card__assignee">{memberName ?? 'Unassigned'}</div>
      )}

      {!isEditing && showCompleteConfirm && (
        <div className="chore-card__complete-confirm">
          <span>Mark &ldquo;{choreTypeName}&rdquo; as done?</span>
          <button
            type="button"
            className="chore-card__complete-confirm-btn"
            onClick={() => { setShowCompleteConfirm(false); complete.mutate(assignment.id); }}
            disabled={isBusy}
          >
            Confirm
          </button>
          <button
            type="button"
            className="chore-card__complete-cancel-btn"
            onClick={() => setShowCompleteConfirm(false)}
            disabled={isBusy}
          >
            Cancel
          </button>
        </div>
      )}

      {!isEditing && (
        <div className="chore-card__actions">
          {!isCompleted && (
            <button
              type="button"
              className="chore-card__complete"
              onClick={() => setShowCompleteConfirm(true)}
              disabled={isBusy}
            >
              {complete.isLoading ? '…' : 'Mark done'}
            </button>
          )}
          {isCompleted && (
            <span className="chore-card__done">Done</span>
          )}
          <button
            type="button"
            className="chore-card__edit-btn"
            onClick={handleEdit}
            disabled={isBusy}
            title="Edit"
          >
            Edit
          </button>
          <button
            type="button"
            className="chore-card__delete"
            onClick={handleDelete}
            disabled={isBusy}
            title="Delete"
          >
            {remove.isLoading ? '…' : '×'}
          </button>
        </div>
      )}
    </div>
  );
}
