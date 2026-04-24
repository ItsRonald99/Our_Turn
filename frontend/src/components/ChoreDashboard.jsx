import { useDashboardStats, useAdjustTally } from '../hooks/useDashboard';
import { useHouseId } from '../hooks/useHouse';

export function ChoreDashboard({ isOwner = false }) {
  const houseId = useHouseId();
  const { data, isLoading } = useDashboardStats();
  const adjustTally = useAdjustTally(houseId);

  if (isLoading) {
    return <p className="dashboard__loading">Loading dashboard…</p>;
  }

  if (!data || data.members.length === 0 || data.choreTypes.length === 0) {
    return (
      <section className="dashboard">
        <h2 className="dashboard__title">Completion Stats</h2>
        <p className="dashboard__empty">No data yet. Complete some chores to see stats here.</p>
      </section>
    );
  }

  return (
    <section className="dashboard">
      <h2 className="dashboard__title">Completion Stats</h2>
      <div className="dashboard__scroll">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th className="dashboard__cell dashboard__cell--header dashboard__cell--name">Member</th>
              {data.choreTypes.map((ct) => (
                <th key={ct.id} className="dashboard__cell dashboard__cell--header">
                  {ct.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.memberId}>
                <td className="dashboard__cell dashboard__cell--name">{m.displayName}</td>
                {data.choreTypes.map((ct) => {
                  const count = m.chores[ct.id] ?? 0;
                  return (
                    <td key={ct.id} className="dashboard__cell dashboard__cell--count">
                      {isOwner ? (
                        <div className="dashboard__tally-cell">
                          <button
                            type="button"
                            className="dashboard__tally-btn"
                            onClick={() =>
                              adjustTally.mutate({ action: 'remove', memberId: m.memberId, choreTypeId: ct.id })
                            }
                            disabled={adjustTally.isLoading || count <= 0}
                            aria-label={`Remove ${ct.name} tally for ${m.displayName}`}
                          >
                            −
                          </button>
                          <span>{count}</span>
                          <button
                            type="button"
                            className="dashboard__tally-btn"
                            onClick={() =>
                              adjustTally.mutate({ action: 'add', memberId: m.memberId, choreTypeId: ct.id })
                            }
                            disabled={adjustTally.isLoading}
                            aria-label={`Add ${ct.name} tally for ${m.displayName}`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        count
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
