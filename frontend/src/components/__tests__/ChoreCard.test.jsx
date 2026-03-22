import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoreCard } from '../ChoreCard';

// Mock the hook module — ChoreCard uses this internally
vi.mock('../../hooks/useChores', () => ({
  useCompleteAssignment: vi.fn(),
}));

import { useCompleteAssignment } from '../../hooks/useChores';

const makeAssignment = (overrides = {}) => ({
  id: 'a-1',
  choreTypeId: 'ct-1',
  memberId: 'm-1',
  dueDate: '2024-06-15T00:00:00.000Z',
  completedAt: null,
  ...overrides,
});

const defaultMutate = vi.fn();

function mockComplete(overrides = {}) {
  useCompleteAssignment.mockReturnValue({
    mutate: defaultMutate,
    isLoading: false,
    ...overrides,
  });
}

describe('ChoreCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComplete();
  });

  it('renders the chore type name', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment()}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.getByText('Garbage')).toBeInTheDocument();
  });

  it('renders the due date', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment()}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    // The date format depends on locale; just verify "Due:" label is present
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('renders the assigned member name', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment()}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders "Unassigned" when memberName is not provided', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment()}
        choreTypeName="Garbage"
        memberName={undefined}
      />
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows a "Mark done" button when the assignment is not completed', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ completedAt: null })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.getByRole('button', { name: /Mark done/i })).toBeInTheDocument();
  });

  it('does not show "Mark done" button when assignment is already completed', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ completedAt: '2024-06-15T12:00:00.000Z' })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.queryByRole('button', { name: /Mark done/i })).not.toBeInTheDocument();
  });

  it('shows a "Done" badge when the assignment is completed', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ completedAt: '2024-06-15T12:00:00.000Z' })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('calls complete.mutate with the assignment ID when "Mark done" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ id: 'a-42' })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    await user.click(screen.getByRole('button', { name: /Mark done/i }));
    expect(defaultMutate).toHaveBeenCalledWith('a-42');
  });

  it('disables the "Mark done" button while the mutation is loading', () => {
    mockComplete({ isLoading: true });
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment()}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.getByRole('button', { name: /Mark done/i })).toBeDisabled();
  });

  it('sets data-completed attribute to false on an incomplete assignment', () => {
    const { container } = render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ completedAt: null })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(container.querySelector('.chore-card')).toHaveAttribute('data-completed', 'false');
  });

  it('sets data-completed attribute to true on a completed assignment', () => {
    const { container } = render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ completedAt: '2024-06-15T12:00:00.000Z' })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(container.querySelector('.chore-card')).toHaveAttribute('data-completed', 'true');
  });

  it('renders "—" for due date when dueDate is falsy', () => {
    render(
      <ChoreCard
        houseId="house-1"
        assignment={makeAssignment({ dueDate: null })}
        choreTypeName="Garbage"
        memberName="Alice"
      />
    );
    expect(screen.getByText('Due: —')).toBeInTheDocument();
  });
});
