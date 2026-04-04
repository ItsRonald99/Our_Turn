import { useState } from 'react';
import { useHouseId } from '../hooks/useHouse';
import { useAuth } from '../context/AuthContext';
import { useAssignments } from '../hooks/useChores';
import { useChoreTypes } from '../hooks/useChoreTypes';
import { useMembers } from '../hooks/useMembers';
import { ChoreList } from '../components/ChoreList';
import { ChoreManager } from '../components/ChoreManager';
import { MemberList } from '../components/MemberList';
import { AddAssignmentForm } from '../components/AddAssignmentForm';
import { ChoreDashboard } from '../components/ChoreDashboard';
import { NotificationBell } from '../components/NotificationBell';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function Home() {
  const houseId = useHouseId();
  const { user, houses, setActiveHouseId, refreshHouses, logout } = useAuth();
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = () => {
    const code = activeHouse?.inviteCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleDeleteHouse = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.deleteHouse(houseId);
      setActiveHouseId(null);
      await refreshHouses();
      navigate('/houses');
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete house');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
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
          <h1>
            <button
              type="button"
              className="page-home__title-nav"
              onClick={() => navigate('/houses')}
            >
              Our Turn
            </button>
          </h1>
          <div className="page-home__house-row">
            <span className="page-home__house-name">
              {activeHouse?.name ?? 'My House'}
            </span>
            <button
              type="button"
              className="page-home__house-delete"
              onClick={() => { setShowDeleteConfirm(true); setDeleteError(''); }}
            >
              Delete This House
            </button>
          </div>
          {activeHouse?.inviteCode && (
            <button
              type="button"
              className="page-home__invite-code"
              onClick={handleCopyCode}
              title="Click to copy invite code"
            >
              Invite code: <span className="page-home__invite-code-value">{activeHouse.inviteCode}</span>
              <span className="page-home__invite-code-hint">{codeCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          )}
          {showDeleteConfirm && (
            <div className="page-home__delete-confirm">
              <span>Delete &ldquo;{activeHouse?.name}&rdquo;? This will remove all chores and members.</span>
              <button
                type="button"
                className="page-home__delete-confirm-btn"
                onClick={handleDeleteHouse}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                className="page-home__delete-cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          )}
          {deleteError && <p className="page-home__delete-error">{deleteError}</p>}
        </div>
        <div className="page-home__user">
          <NotificationBell />
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
              <ChoreManager houseId={houseId} />
              <AddAssignmentForm houseId={houseId} />
              <ChoreDashboard />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
