import { useState } from 'react';
import { useHouseId } from '../hooks/useHouse';
import { useAuth } from '../context/AuthContext';
import { useChoreTypes, useAssignments } from '../hooks/useChores';
import { useMembers } from '../hooks/useMembers';
import { ChoreList } from '../components/ChoreList';
import { MemberList } from '../components/MemberList';
import { AddAssignmentForm } from '../components/AddAssignmentForm';
import { Navigate, useNavigate } from 'react-router-dom';

export function Home() {
  const houseId = useHouseId();
  const { user, houses, logout } = useAuth();
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const { data: choreTypes = [], isLoading: typesLoading } = useChoreTypes(houseId);
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(
    houseId,
    { includeCompleted: showCompleted }
  );
  const { data: members = [] } = useMembers(houseId);

  if (!houseId) {
    return <Navigate to="/houses" replace />;
  }

  const activeHouse = houses.find((h) => h.id === houseId);

  return (
    <main className="page-home">
      <header className="page-home__header">
        <div>
          <h1>Our Turn</h1>
          <button
            type="button"
            className="page-home__house-switch"
            onClick={() => navigate('/houses')}
            title="Switch house"
          >
            {activeHouse?.name ?? 'My House'}
          </button>
        </div>
        <div className="page-home__user">
          <span>{user?.displayName || user?.email}</span>
          <button type="button" className="page-home__logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <div className="page-home__content">
        <MemberList houseId={houseId} />
        <div className="page-home__chores">
          {(typesLoading || assignmentsLoading) ? (
            <p>Loading…</p>
          ) : (
            <>
              <ChoreList
                houseId={houseId}
                assignments={assignments}
                choreTypes={choreTypes}
                members={members}
                showCompleted={showCompleted}
                onToggleCompleted={() => setShowCompleted((v) => !v)}
              />
              <AddAssignmentForm houseId={houseId} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
