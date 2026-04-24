import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/useDashboard', () => ({
  useDashboardStats: vi.fn(),
  useAdjustTally: vi.fn(),
}));

vi.mock('../../hooks/useHouse', () => ({
  useHouseId: vi.fn().mockReturnValue('house-1'),
}));

import { useDashboardStats, useAdjustTally } from '../../hooks/useDashboard';
import { ChoreDashboard } from '../ChoreDashboard';

const makeData = (overrides = {}) => ({
  members: [
    { memberId: 'm-1', displayName: 'Alice', chores: { 'ct-1': 5, 'ct-2': 2 } },
    { memberId: 'm-2', displayName: 'Bob', chores: { 'ct-1': 3 } },
  ],
  choreTypes: [
    { id: 'ct-1', name: 'Garbage' },
    { id: 'ct-2', name: 'Recycling' },
  ],
  ...overrides,
});

const mockMutate = vi.fn();

function setup(hookReturn, { isOwner = false } = {}) {
  useDashboardStats.mockReturnValue(hookReturn);
  useAdjustTally.mockReturnValue({ mutate: mockMutate, isLoading: false });
  return render(<ChoreDashboard isOwner={isOwner} />);
}

describe('ChoreDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockReset();
  });

  it('shows loading state', () => {
    setup({ isLoading: true, data: undefined });
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no members', () => {
    setup({ isLoading: false, data: { members: [], choreTypes: [] } });
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no chore types', () => {
    setup({ isLoading: false, data: { members: [{ memberId: 'm-1', displayName: 'Alice', chores: {} }], choreTypes: [] } });
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('renders chore type columns dynamically', () => {
    setup({ isLoading: false, data: makeData() });
    expect(screen.getByRole('columnheader', { name: 'Garbage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Recycling' })).toBeInTheDocument();
  });

  it('renders a row per member', () => {
    setup({ isLoading: false, data: makeData() });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows correct counts for Alice (non-owner view)', () => {
    setup({ isLoading: false, data: makeData() });
    const rows = screen.getAllByRole('row');
    const aliceRow = rows[1];
    const cells = aliceRow.querySelectorAll('td');
    expect(cells[1].textContent).toBe('5'); // Garbage
    expect(cells[2].textContent).toBe('2'); // Recycling
  });

  it('shows 0 for chore types with no completions', () => {
    setup({ isLoading: false, data: makeData() });
    const rows = screen.getAllByRole('row');
    const bobRow = rows[2];
    const cells = bobRow.querySelectorAll('td');
    expect(cells[1].textContent).toBe('3'); // Garbage
    expect(cells[2].textContent).toBe('0'); // Recycling — no entry → 0
  });

  it('renders section title', () => {
    setup({ isLoading: false, data: makeData() });
    expect(screen.getByText('Completion Stats')).toBeInTheDocument();
  });

  it('updates when data changes', () => {
    const { rerender } = render(<ChoreDashboard />);

    useDashboardStats.mockReturnValue({ isLoading: false, data: makeData() });
    useAdjustTally.mockReturnValue({ mutate: mockMutate, isLoading: false });
    rerender(<ChoreDashboard />);
    expect(screen.getByText('Alice')).toBeInTheDocument();

    useDashboardStats.mockReturnValue({
      isLoading: false,
      data: makeData({
        members: [{ memberId: 'm-1', displayName: 'Alice', chores: { 'ct-1': 6, 'ct-2': 2 } }],
      }),
    });
    rerender(<ChoreDashboard />);

    const rows = screen.getAllByRole('row');
    const aliceRow = rows[1];
    const cells = aliceRow.querySelectorAll('td');
    expect(cells[1].querySelector('span, td')?.textContent ?? cells[1].textContent).toContain('6');
  });
});

describe('ChoreDashboard — owner tally controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockReset();
  });

  it('does not show +/− buttons when isOwner is false', () => {
    setup({ isLoading: false, data: makeData() }, { isOwner: false });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows +/− buttons for every cell when isOwner is true', () => {
    setup({ isLoading: false, data: makeData() }, { isOwner: true });
    // 2 members × 2 chore types × 2 buttons (+ and −) = 8 buttons
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });

  it('clicking + calls mutate with action=add, correct memberId and choreTypeId', () => {
    setup({ isLoading: false, data: makeData() }, { isOwner: true });
    const addBtn = screen.getByLabelText('Add Garbage tally for Alice');
    fireEvent.click(addBtn);
    expect(mockMutate).toHaveBeenCalledWith({ action: 'add', memberId: 'm-1', choreTypeId: 'ct-1' });
  });

  it('clicking − calls mutate with action=remove, correct memberId and choreTypeId', () => {
    setup({ isLoading: false, data: makeData() }, { isOwner: true });
    const removeBtn = screen.getByLabelText('Remove Garbage tally for Alice');
    fireEvent.click(removeBtn);
    expect(mockMutate).toHaveBeenCalledWith({ action: 'remove', memberId: 'm-1', choreTypeId: 'ct-1' });
  });

  it('disables − button when count is 0', () => {
    const data = makeData({
      members: [{ memberId: 'm-1', displayName: 'Alice', chores: {} }], // no completions → 0
    });
    setup({ isLoading: false, data }, { isOwner: true });
    const removeBtn = screen.getByLabelText('Remove Garbage tally for Alice');
    expect(removeBtn).toBeDisabled();
  });

  it('does not disable − button when count is > 0', () => {
    setup({ isLoading: false, data: makeData() }, { isOwner: true });
    const removeBtn = screen.getByLabelText('Remove Garbage tally for Alice'); // Alice has 5
    expect(removeBtn).not.toBeDisabled();
  });

  it('disables all buttons while a mutation is in flight', () => {
    useDashboardStats.mockReturnValue({ isLoading: false, data: makeData() });
    useAdjustTally.mockReturnValue({ mutate: mockMutate, isLoading: true });
    render(<ChoreDashboard isOwner={true} />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });
});
