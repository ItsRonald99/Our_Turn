import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export function HouseSetup() {
  const { refreshHouses, logout } = useAuth();
  const [tab, setTab] = useState('create');
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await api.createHouse({ name: houseName.trim() });
      await refreshHouses();
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
      await api.joinHouse({ inviteCode: inviteCode.trim().toUpperCase() });
      await refreshHouses();
    } catch (err) {
      setError(err.message || 'Failed to join house');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Set up your home</h1>
        <p className="auth-card__subtitle">Create a new house or join an existing one with an invite code.</p>
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
            {error && <p className="auth-form__error">{error}</p>}
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
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                required
                autoFocus
              />
            </label>
            {error && <p className="auth-form__error">{error}</p>}
            <button type="submit" disabled={isSubmitting || inviteCode.trim().length < 6} className="auth-form__submit">
              {isSubmitting ? 'Joining…' : 'Join house'}
            </button>
          </form>
        )}

        <p className="auth-card__footer">
          <button type="button" className="auth-card__signout" onClick={logout}>
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
