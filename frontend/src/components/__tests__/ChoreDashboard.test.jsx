import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../hooks/useDashboard', () => ({
  useDashboardStats: vi.fn(),
}));

import { useDashboardStats } from '../../hooks/useDashboard';
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

function setup(hookReturn) {
  useDashboardStats.mockReturnValue(hookReturn);
  return render(<ChoreDashboard />);
}

describe('ChoreDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('shows correct counts for Alice', () => {
    setup({ isLoading: false, data: makeData() });
    const rows = screen.getAllByRole('row');
    // row 0 = header, row 1 = Alice, row 2 = Bob
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

  it('updates when data changes', () => {
    const { rerender } = render(<ChoreDashboard />);

    useDashboardStats.mockReturnValue({ isLoading: false, data: makeData() });
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
    expect(cells[1].textContent).toBe('6');
  });

  it('renders section title', () => {
    setup({ isLoading: false, data: makeData() });
    expect(screen.getByText('Completion Stats')).toBeInTheDocument();
  });
});
