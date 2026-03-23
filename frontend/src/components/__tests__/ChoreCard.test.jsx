import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoreCard } from '../ChoreCard';

vi.mock('../../hooks/useChores', () => ({
  useCompleteAssignment: vi.fn(),
  useUpdateAssignment: vi.fn(),
  useDeleteAssignment: vi.fn(),
}));

import { useCompleteAssignment, useUpdateAssignment, useDeleteAssignment } from '../../hooks/useChores';

const makeAssignment = (overrides = {}) => ({
  id: 'a-1',
  choreTypeId: 'ct-1',
  memberId: 'm-1',
  dueDate: '2024-06-15T00:00:00.000Z',
  completedAt: null,
  ...overrides,
});

const makeMembers = () => [
  { id: 'm-1', displayName: 'Alice' },
  { id: 'm-2', displayName: 'Bob' },
];

const completeMutate = vi.fn();
const updateMutate = vi.fn();
const removeMutate = vi.fn();

function setupMocks({ completeLoading = false, updateLoading = false, removeLoading = false } = {}) {
  useCompleteAssignment.mockReturnValue({ mutate: completeMutate, isLoading: completeLoading });
  useUpdateAssignment.mockReturnValue({ mutate: updateMutate, isLoading: updateLoading });
  useDeleteAssignment.mockReturnValue({ mutate: removeMutate, isLoading: removeLoading });
}

function renderCard(assignmentOverrides = {}, members = makeMembers()) {
  return render(
    <ChoreCard
      houseId="house-1"
      assignment={makeAssignment(assignmentOverrides)}
      choreTypeName="Garbage"
      memberName="Alice"
      members={members}
    />
  );
}

describe('ChoreCard — display', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('renders the chore type name', () => {
    renderCard();
    expect(screen.getByText('Garbage')).toBeInTheDocument();
  });

  it('renders the due date label', () => {
    renderCard();
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('renders the assigned member name', () => {
    renderCard();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders "Unassigned" when memberName is not provided', () => {
    render(
      <ChoreCard houseId="house-1" assignment={makeAssignment()} choreTypeName="Garbage" members={makeMembers()} />
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('renders "—" for due date when dueDate is falsy', () => {
    renderCard({ dueDate: null });
    expect(screen.getByText('Due: —')).toBeInTheDocument();
  });

  it('sets data-completed=false on an incomplete assignment', () => {
    const { container } = renderCard();
    expect(container.querySelector('.chore-card')).toHaveAttribute('data-completed', 'false');
  });

  it('sets data-completed=true on a completed assignment', () => {
    const { container } = renderCard({ completedAt: '2024-06-15T12:00:00.000Z' });
    expect(container.querySelector('.chore-card')).toHaveAttribute('data-completed', 'true');
  });

  it('shows "Mark done" button for incomplete assignments', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /Mark done/i })).toBeInTheDocument();
  });

  it('hides "Mark done" button for completed assignments', () => {
    renderCard({ completedAt: '2024-06-15T12:00:00.000Z' });
    expect(screen.queryByRole('button', { name: /Mark done/i })).not.toBeInTheDocument();
  });

  it('shows "Done" badge when completed', () => {
    renderCard({ completedAt: '2024-06-15T12:00:00.000Z' });
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows Edit and delete (×) buttons in view mode', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
  });

  it('does not crash when members prop is omitted', () => {
    useCompleteAssignment.mockReturnValue({ mutate: vi.fn(), isLoading: false });
    useUpdateAssignment.mockReturnValue({ mutate: vi.fn(), isLoading: false });
    useDeleteAssignment.mockReturnValue({ mutate: vi.fn(), isLoading: false });
    expect(() =>
      render(
        <ChoreCard houseId="house-1" assignment={makeAssignment()} choreTypeName="Garbage" memberName="Alice" />
      )
    ).not.toThrow();
  });
});

describe('ChoreCard — mark complete', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('calls complete.mutate with the assignment ID', async () => {
    const user = userEvent.setup();
    renderCard({ id: 'a-42' });
    await user.click(screen.getByRole('button', { name: /Mark done/i }));
    expect(completeMutate).toHaveBeenCalledWith('a-42');
  });
});

describe('ChoreCard — delete', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('calls window.confirm with the chore type name before deleting', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard();
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Garbage'));
  });

  it('calls remove.mutate when confirm returns true', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard({ id: 'a-1' });
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(removeMutate).toHaveBeenCalledWith('a-1');
  });

  it('does not call remove.mutate when confirm is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCard();
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(removeMutate).not.toHaveBeenCalled();
  });
});

describe('ChoreCard — edit mode', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('enters edit mode when Edit is clicked, hiding due date and showing inputs', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // member select
    expect(screen.getByDisplayValue('2024-06-15')).toBeInTheDocument(); // date input
  });

  it('pre-populates the member select with the current member', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    expect(screen.getByRole('combobox')).toHaveValue('m-1');
  });

  it('shows Save and Cancel buttons in edit mode, hides action buttons', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark done/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '×' })).not.toBeInTheDocument();
  });

  it('exits edit mode without saving when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('shows validation error if member is not selected on Save', async () => {
    const user = userEvent.setup();
    renderCard({ memberId: '' });
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(screen.getByText(/select a member/i)).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('shows validation error if due date is cleared on Save', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    await user.clear(screen.getByDisplayValue('2024-06-15'));
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(screen.getByText(/pick a due date/i)).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('calls update.mutate with assignmentId, new memberId, and new dueDate on Save', async () => {
    const user = userEvent.setup();
    updateMutate.mockImplementation((_vars, { onSuccess }) => onSuccess?.());
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    await user.selectOptions(screen.getByRole('combobox'), 'm-2');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: 'a-1', memberId: 'm-2', dueDate: '2024-06-15' }),
      expect.any(Object)
    );
  });

  it('exits edit mode after a successful save', async () => {
    const user = userEvent.setup();
    updateMutate.mockImplementation((_vars, { onSuccess }) => onSuccess?.());
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('shows error message when update mutation fails', async () => {
    const user = userEvent.setup();
    updateMutate.mockImplementation((_vars, { onError }) => onError?.(new Error('Save failed')));
    renderCard();
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });
});

describe('ChoreCard — busy state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables all action buttons while complete is loading', () => {
    setupMocks({ completeLoading: true });
    renderCard();
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });

  it('disables all action buttons while update is loading', () => {
    setupMocks({ updateLoading: true });
    renderCard();
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });

  it('disables all action buttons while delete is loading', () => {
    setupMocks({ removeLoading: true });
    renderCard();
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });
});
