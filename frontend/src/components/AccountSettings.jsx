import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChangePassword, useChangeUsername } from '../hooks/useAccount';

export function AccountSettings() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'username' | 'password' | null
  const [currentPassword, setCurrentPassword] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState('');
  const wrapperRef = useRef(null);

  const { updateUser } = useAuth();
  const changePassword = useChangePassword();
  const changeUsername = useChangeUsername();

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  const openModal = (mode) => {
    setDropdownOpen(false);
    setModalMode(mode);
    setCurrentPassword('');
    setNewValue('');
    setError('');
  };

  const closeModal = () => {
    setModalMode(null);
    setCurrentPassword('');
    setNewValue('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (modalMode === 'password') {
      changePassword.mutate(
        { currentPassword, newPassword: newValue },
        {
          onSuccess: () => closeModal(),
          onError: (err) => setError(err.message || 'Failed to change password'),
        }
      );
    } else {
      changeUsername.mutate(
        { currentPassword, newUsername: newValue },
        {
          onSuccess: (data) => {
            updateUser({ displayName: data.data.user.displayName });
            closeModal();
          },
          onError: (err) => setError(err.message || 'Failed to change username'),
        }
      );
    }
  };

  const isLoading = modalMode === 'password' ? changePassword.isLoading : changeUsername.isLoading;
  const newValueValid = modalMode === 'password'
    ? newValue.length >= 8
    : newValue.trim().length > 0;
  const canSubmit = currentPassword.length > 0 && newValueValid && !isLoading;

  return (
    <div className="account-settings" ref={wrapperRef}>
      <button
        type="button"
        className="account-settings__btn"
        onClick={() => setDropdownOpen((v) => !v)}
        aria-label="Account settings"
        aria-expanded={dropdownOpen}
      >
        ⚙
      </button>

      {dropdownOpen && (
        <div className="account-settings__dropdown" role="menu">
          <button
            type="button"
            className="account-settings__option"
            role="menuitem"
            onClick={() => openModal('username')}
          >
            Change Username
          </button>
          <button
            type="button"
            className="account-settings__option"
            role="menuitem"
            onClick={() => openModal('password')}
          >
            Change Password
          </button>
        </div>
      )}

      {modalMode && (
        <div
          className="account-modal__overlay"
          role="dialog"
          aria-modal="true"
          aria-label={modalMode === 'username' ? 'Change Username' : 'Change Password'}
          onClick={closeModal}
        >
          <div className="account-modal__dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="account-modal__title">
              {modalMode === 'username' ? 'Change Username' : 'Change Password'}
            </h2>
            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-form__field">
                Current password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                />
              </label>
              {modalMode === 'username' ? (
                <label className="auth-form__field">
                  New username
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="New display name"
                  />
                </label>
              ) : (
                <label className="auth-form__field">
                  New password
                  <input
                    type="password"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </label>
              )}
              {error && <p className="auth-form__error">{error}</p>}
              <div className="account-modal__actions">
                <button
                  type="submit"
                  className="auth-form__submit"
                  disabled={!canSubmit}
                >
                  {isLoading
                    ? 'Saving…'
                    : modalMode === 'username'
                    ? 'Save username'
                    : 'Save password'}
                </button>
                <button
                  type="button"
                  className="account-modal__cancel"
                  onClick={closeModal}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
