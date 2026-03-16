import { ChoreCard } from './ChoreCard';

export function ChoreList({ houseId, assignments = [], choreTypes = [], members = [] }) {
  const typeMap = Object.fromEntries(choreTypes.map((t) => [t.id, t.name]));
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.displayName]));

  const byChore = assignments.reduce((acc, a) => {
    const name = typeMap[a.choreTypeId] ?? 'Chore';
    if (!acc[name]) acc[name] = [];
    acc[name].push(a);
    return acc;
  }, {});

  return (
    <section className="chore-list">
      <h3>Assignments</h3>
      {Object.keys(byChore).length === 0 ? (
        <p className="chore-list__empty">No assignments yet. Add housemates and create one below.</p>
      ) : (
        <div className="chore-list__grid">
          {Object.entries(byChore).map(([typeName, list]) =>
            list.map((a) => (
              <ChoreCard
                key={a.id}
                houseId={houseId}
                assignment={a}
                choreTypeName={typeName}
                memberName={memberMap[a.memberId]}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
