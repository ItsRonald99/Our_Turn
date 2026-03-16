import { useState } from 'react';
import { useMembers, useCreateMember, useDeleteMember } from '../hooks/useMembers';

export function MemberList({ houseId }) {
  const { data: members = [], isLoading, error } = useMembers(houseId);
  const createMember = useCreateMember(houseId);
  const deleteMember = useDeleteMember(houseId);
  const [name, setName] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMember.mutate({ displayName: name.trim() }, { onSuccess: () => setName('') });
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
      <form onSubmit={handleAdd} className="member-list__form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          className="member-list__input"
        />
        <button type="submit" disabled={createMember.isLoading || !name.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
