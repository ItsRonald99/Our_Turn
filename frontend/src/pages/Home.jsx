import { useHouseId } from '../hooks/useHouse';
import { useAuth } from '../context/AuthContext';
import { useChoreTypes, useAssignments } from '../hooks/useChores';
import { useMembers } from '../hooks/useMembers';
import { ChoreList } from '../components/ChoreList';
import { MemberList } from '../components/MemberList';
import { AddAssignmentForm } from '../components/AddAssignmentForm';
import { HouseSetup } from './HouseSetup';

export function Home() {
  const houseId = useHouseId();
  const { user, logout } = useAuth();
  const { data: choreTypes = [], isLoading: typesLoading } = useChoreTypes(houseId);
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(houseId);
  const { data: members = [] } = useMembers(houseId);

  if (!houseId) {
    return <HouseSetup />;
  }

  return (
    <main className="page-home">
      <header className="page-home__header">
        <div>
          <h1>Our Turn</h1>
          <p>Chore tracker for the house</p>
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
              />
              <AddAssignmentForm houseId={houseId} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
