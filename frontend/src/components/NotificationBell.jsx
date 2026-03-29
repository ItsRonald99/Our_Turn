import { useState, useRef, useEffect } from 'react';
import { useInvitations, useRespondInvitation } from '../hooks/useInvitations';
import { useAuth } from '../context/AuthContext';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const { data: invitations = [] } = useInvitations();
  const respond = useRespondInvitation();
  const { refreshHouses } = useAuth();

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const handleRespond = (invitationId, action) => {
    respond.mutate({ invitationId, action }, {
      onSuccess: async () => {
        if (action === 'accept') await refreshHouses();
      },
    });
  };

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        type="button"
        className="notification-bell__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          invitations.length > 0
            ? `Notifications (${invitations.length} pending)`
            : 'Notifications'
        }
      >
        🔔
        {invitations.length > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {invitations.length}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-bell__dropdown" role="region" aria-label="Pending invitations">
          <p className="notification-bell__heading">Invitations</p>
          {invitations.length === 0 ? (
            <p className="notification-bell__empty">No pending invitations</p>
          ) : (
            <ul className="notification-bell__list">
              {invitations.map((inv) => (
                <li key={inv.id} className="notification-bell__item">
                  <p className="notification-bell__message">
                    <strong>{inv.inviterName}</strong> invited you to join{' '}
                    <strong>{inv.houseName}</strong>
                  </p>
                  <div className="notification-bell__actions">
                    <button
                      type="button"
                      className="notification-bell__accept"
                      onClick={() => handleRespond(inv.id, 'accept')}
                      disabled={respond.isLoading}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="notification-bell__decline"
                      onClick={() => handleRespond(inv.id, 'decline')}
                      disabled={respond.isLoading}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
