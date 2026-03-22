import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoreList } from '../ChoreList';

// ChoreList renders ChoreCard which uses useCompleteAssignment internally
vi.mock('../../hooks/useChores', () => ({
  useCompleteAssignment: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

const makeChoreType = (id, name) => ({ id, houseId: 'house-1', name, rotationOrder: 0 });
const makeMember = (id, displayName) => ({ id, houseId: 'house-1', displayName, userId: null });
const makeAssignment = (overrides = {}) => ({
  id: 'a-1',
  houseId: 'house-1',
  choreTypeId: 'ct-1',
  memberId: 'm-1',
  dueDate: '2024-06-15T00:00:00.000Z',
  completedAt: null,
  ...overrides,
});

describe('ChoreList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty state message when there are no assignments', () => {
    render(<ChoreList houseId="house-1" assignments={[]} choreTypes={[]} members={[]} />);
    expect(screen.getByText(/No assignments yet/i)).toBeInTheDocument();
  });

  it('renders an assignment card with the correct chore type name', () => {
    const choreTypes = [makeChoreType('ct-1', 'Garbage')];
    const members = [makeMember('m-1', 'Alice')];
    const assignments = [makeAssignment()];

    render(
      <ChoreList
        houseId="house-1"
        assignments={assignments}
        choreTypes={choreTypes}
        members={members}
      />
    );
    expect(screen.getByText('Garbage')).toBeInTheDocument();
  });

  it('renders the assigned member name on a card', () => {
    const choreTypes = [makeChoreType('ct-1', 'Garbage')];
    const members = [makeMember('m-1', 'Alice')];
    const assignments = [makeAssignment()];

    render(
      <ChoreList
        houseId="house-1"
        assignments={assignments}
        choreTypes={choreTypes}
        members={members}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('groups multiple assignments under the same chore type', () => {
    const choreTypes = [makeChoreType('ct-1', 'Garbage')];
    const members = [makeMember('m-1', 'Alice'), makeMember('m-2', 'Bob')];
    const assignments = [
      makeAssignment({ id: 'a-1', memberId: 'm-1' }),
      makeAssignment({ id: 'a-2', memberId: 'm-2' }),
    ];

    render(
      <ChoreList
        houseId="house-1"
        assignments={assignments}
        choreTypes={choreTypes}
        members={members}
      />
    );
    // Both member names should appear (one per card)
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // The chore type name appears once (one heading per group)
    expect(screen.getAllByText('Garbage')).toHaveLength(2); // once per card
  });

  it('renders cards for multiple distinct chore types', () => {
    const choreTypes = [
      makeChoreType('ct-1', 'Garbage'),
      makeChoreType('ct-2', 'Recycling'),
    ];
    const members = [makeMember('m-1', 'Alice')];
    const assignments = [
      makeAssignment({ id: 'a-1', choreTypeId: 'ct-1' }),
      makeAssignment({ id: 'a-2', choreTypeId: 'ct-2' }),
    ];

    render(
      <ChoreList
        houseId="house-1"
        assignments={assignments}
        choreTypes={choreTypes}
        members={members}
      />
    );
    expect(screen.getByText('Garbage')).toBeInTheDocument();
    expect(screen.getByText('Recycling')).toBeInTheDocument();
  });

  it('falls back to "Chore" for unknown chore type IDs', () => {
    const assignments = [makeAssignment({ choreTypeId: 'unknown-id' })];

    render(
      <ChoreList
        houseId="house-1"
        assignments={assignments}
        choreTypes={[]}
        members={[]}
      />
    );
    expect(screen.getByText('Chore')).toBeInTheDocument();
  });

  it('renders the "Assignments" heading', () => {
    render(<ChoreList houseId="house-1" assignments={[]} choreTypes={[]} members={[]} />);
    expect(screen.getByRole('heading', { name: /Assignments/i })).toBeInTheDocument();
  });

  it('shows "Unassigned" on the card when member ID is not in the members list', () => {
    const choreTypes = [makeChoreType('ct-1', 'Garbage')];
    const assignments = [makeAssignment({ memberId: 'unknown-member' })];

    render(
      <ChoreList
        houseId="house-1"
        assignments={assignments}
        choreTypes={choreTypes}
        members={[]} // empty
      />
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
