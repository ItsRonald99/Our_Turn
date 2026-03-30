import { useState } from 'react';
import { useChoreTypes, useCreateChoreType, useDeleteChoreType } from '../hooks/useChoreTypes';

export function ChoreManager({ houseId }) {
  const { data: choreTypes = [] } = useChoreTypes(houseId);
  const createChoreType = useCreateChoreType(houseId);
  const deleteChoreType = useDeleteChoreType(houseId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setError('');
    createChoreType.mutate(
      { title: trimmedTitle, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
        },
        onError: (err) => {
          setError(err.message || 'Failed to create chore type');
        },
      }
    );
  };

  const handleDelete = (choreTypeId) => {
    deleteChoreType.mutate(choreTypeId);
  };

  return (
    <section className="chore-manager">
      <h3>Chore types</h3>

      {choreTypes.length === 0 ? (
        <p className="chore-manager__empty">No chore types yet. Add one below.</p>
      ) : (
        <ul className="chore-manager__list">
          {choreTypes.map((ct) => (
            <li key={ct.id} className="chore-manager__item">
              <div className="chore-manager__item-info">
                <span className="chore-manager__item-name">{ct.name}</span>
                {ct.description && (
                  <span className="chore-manager__item-desc">{ct.description}</span>
                )}
              </div>
              <button
                type="button"
                className="chore-manager__delete"
                onClick={() => handleDelete(ct.id)}
                disabled={deleteChoreType.isLoading}
                aria-label={`Delete ${ct.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="chore-manager__form" onSubmit={handleCreate}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Chore name"
          className="chore-manager__input"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="chore-manager__input"
        />
        {error && <p className="chore-manager__error">{error}</p>}
        <button
          type="submit"
          disabled={createChoreType.isLoading || !title.trim()}
          className="chore-manager__submit"
        >
          {createChoreType.isLoading ? 'Adding…' : 'Add chore type'}
        </button>
      </form>
    </section>
  );
}
