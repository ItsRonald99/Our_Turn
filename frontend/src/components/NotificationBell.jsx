import { useState, useRef, useEffect } from 'react';
import { useInvitations, useRespondInvitation } from '../hooks/useInvitations';
import { useNotifications, useMarkNotificationRead } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const { data: invitations = [] } = useInvitations();
  const { data: appNotifications = [] } = useNotifications();
  const respond = useRespondInvitation();
  const markRead = useMarkNotificationRead();
  const { refreshHouses } = useAuth();

  const unreadNotifications = appNotifications.filter((n) => !n.isRead);
  const totalBadge = invitations.length + unreadNotifications.length;

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

  const handleMarkRead = (notificationId) => {
    markRead.mutate(notificationId);
  };

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        type="button"
        className="notification-bell__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          totalBadge > 0
            ? `Notifications (${totalBadge} unread)`
            : 'Notifications'
        }
      >
        🔔
        {totalBadge > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-bell__dropdown" role="region" aria-label="Notifications">

          {/* Invitations section */}
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

          {/* Reminders section */}
          <p className="notification-bell__heading">Reminders</p>
          {unreadNotifications.length === 0 ? (
            <p className="notification-bell__empty">No reminders</p>
          ) : (
            <ul className="notification-bell__list">
              {unreadNotifications.map((n) => (
                <li key={n.id} className="notification-bell__item">
                  <p className="notification-bell__message">
                    <strong>{n.title}</strong> — {n.message}
                  </p>
                  <div className="notification-bell__actions">
                    <button
                      type="button"
                      className="notification-bell__accept"
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markRead.isLoading}
                    >
                      Mark as read
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
