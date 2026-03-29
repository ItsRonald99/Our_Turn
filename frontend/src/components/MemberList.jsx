import { useState } from 'react';
import { useMembers, useDeleteMember } from '../hooks/useMembers';
import { useInviteUser } from '../hooks/useInvitations';

export function MemberList({ houseId }) {
  const { data: members = [], isLoading, error } = useMembers(houseId);
  const deleteMember = useDeleteMember(houseId);
  const inviteUser = useInviteUser(houseId);
  const [email, setEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  const handleInvite = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviteSuccess('');
    setInviteError('');
    inviteUser.mutate(
      { email: email.trim().toLowerCase() },
      {
        onSuccess: () => {
          setEmail('');
          setInviteSuccess('Invitation sent!');
          setTimeout(() => setInviteSuccess(''), 3000);
        },
        onError: (err) => {
          setInviteError(err.message || 'Failed to send invitation');
        },
      }
    );
  };

  if (error) return <p className="error">Failed to load members: {error.message}</p>;
  if (isLoading) return <p>Loading members…</p>;

  return (
    <section className="member-list">
      <h3>Housemates</h3>
      <ul className="member-list__items">
        {members.map((m) => (
          <li key={m.id} className="member-list__item">
            <span>{m.displayName}</span>
            <button
              type="button"
              className="member-list__remove"
              onClick={() => deleteMember.mutate(m.id)}
              disabled={deleteMember.isLoading}
              title="Remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleInvite} className="member-list__form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="member-list__input"
        />
        <button type="submit" disabled={inviteUser.isLoading || !email.trim()}>
          {inviteUser.isLoading ? 'Sending…' : 'Invite'}
        </button>
      </form>
      {inviteSuccess && <p className="member-list__success">{inviteSuccess}</p>}
      {inviteError && <p className="member-list__error">{inviteError}</p>}
    </section>
  );
}
