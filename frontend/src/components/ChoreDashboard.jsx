import { useDashboardStats } from '../hooks/useDashboard';

export function ChoreDashboard() {
  const { data, isLoading } = useDashboardStats();

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
                {data.choreTypes.map((ct) => (
                  <td key={ct.id} className="dashboard__cell dashboard__cell--count">
                    {m.chores[ct.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
