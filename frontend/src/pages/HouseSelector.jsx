import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { NotificationBell } from '../components/NotificationBell';
import { AccountSettings } from '../components/AccountSettings';

export function HouseSelector() {
  const { user, houses, activeHouseId, setActiveHouseId, refreshHouses, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('create');
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (houseId) => {
    setIsDeleting(true);
    setError('');
    try {
      await api.deleteHouse(houseId);
      if (activeHouseId === houseId) setActiveHouseId(null);
      await refreshHouses();
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete house');
      setConfirmDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Re-fetch on mount in case applyAuth ran before the token was ready
  useEffect(() => {
    refreshHouses();
  }, [refreshHouses]);

  const selectHouse = (houseId) => {
    setActiveHouseId(houseId);
    navigate('/');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await api.createHouse({ name: houseName.trim() });
      const newHouseId = res.data.house.id;
      await refreshHouses();
      setActiveHouseId(newHouseId);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to create house');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await api.joinHouse({ inviteCode: inviteCode.trim() });
      const joinedHouseId = res.data.house.id;
      await refreshHouses();
      setActiveHouseId(joinedHouseId);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to join house');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__user-bar">
          <span className="auth-card__username">{user?.displayName || user?.email}</span>
          <AccountSettings />
          <NotificationBell />
          <button type="button" className="auth-card__signout" onClick={logout}>
            Sign out
          </button>
        </div>

        <h1 className="auth-card__title">Your Houses</h1>

        {error && <p className="auth-form__error">{error}</p>}

        {houses.length > 0 ? (
          <ul className="house-selector__list">
            {houses.map((h) => (
              <li key={h.id} className="house-selector__list-item">
                {confirmDeleteId === h.id ? (
                  <div className="house-selector__confirm-delete">
                    <span>Delete &ldquo;{h.name}&rdquo;? This removes all chores and members.</span>
                    <button
                      type="button"
                      className="house-selector__confirm-btn"
                      onClick={() => handleDelete(h.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      className="house-selector__cancel-btn"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="house-selector__item"
                      onClick={() => selectHouse(h.id)}
                    >
                      {h.name}
                    </button>
                    <button
                      type="button"
                      className="house-selector__delete"
                      onClick={() => setConfirmDeleteId(h.id)}
                      title={`Delete ${h.name}`}
                      aria-label={`Delete ${h.name}`}
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="house-selector__empty">You're not a member of any house yet.</p>
        )}

        {houses.length > 0 && !showForm ? (
          <button
            type="button"
            className="house-selector__add"
            onClick={() => setShowForm(true)}
          >
            + Create or join a house
          </button>
        ) : (houses.length === 0 || showForm) && (
          <div className="house-selector__form-panel">
            <div className="house-setup__tabs">
              <button
                type="button"
                className={tab === 'create' ? 'active' : ''}
                onClick={() => { setTab('create'); setError(''); }}
              >
                Create
              </button>
              <button
                type="button"
                className={tab === 'join' ? 'active' : ''}
                onClick={() => { setTab('join'); setError(''); }}
              >
                Join
              </button>
            </div>

            {tab === 'create' && (
              <form onSubmit={handleCreate} className="auth-form">
                <label className="auth-form__field">
                  House name
                  <input
                    type="text"
                    value={houseName}
                    onChange={(e) => setHouseName(e.target.value)}
                    placeholder="e.g. The Blue House"
                    required
                    autoFocus
                  />
                </label>
                <button type="submit" disabled={isSubmitting || !houseName.trim()} className="auth-form__submit">
                  {isSubmitting ? 'Creating…' : 'Create house'}
                </button>
              </form>
            )}

            {tab === 'join' && (
              <form onSubmit={handleJoin} className="auth-form">
                <label className="auth-form__field">
                  Invite code
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 123456"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </label>
                <button type="submit" disabled={isSubmitting || inviteCode.trim().length < 6} className="auth-form__submit">
                  {isSubmitting ? 'Joining…' : 'Join house'}
                </button>
              </form>
            )}

            {houses.length > 0 && (
              <button
                type="button"
                className="house-selector__cancel"
                onClick={() => { setShowForm(false); setError(''); }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
