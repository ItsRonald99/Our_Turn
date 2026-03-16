import { useCompleteAssignment } from '../hooks/useChores';

export function ChoreCard({ houseId, assignment, choreTypeName, memberName }) {
  const complete = useCompleteAssignment(houseId);
  const due = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—';
  const isCompleted = !!assignment.completedAt;

  return (
    <div className="chore-card" data-completed={isCompleted}>
      <div className="chore-card__header">
        <span className="chore-card__type">{choreTypeName}</span>
        <span className="chore-card__due">Due: {due}</span>
      </div>
      <div className="chore-card__assignee">{memberName ?? 'Unassigned'}</div>
      {!isCompleted && (
        <button
          type="button"
          className="chore-card__complete"
          onClick={() => complete.mutate(assignment.id)}
          disabled={complete.isLoading}
        >
          Mark done
        </button>
      )}
      {isCompleted && (
        <span className="chore-card__done">Done</span>
      )}
    </div>
  );
}
