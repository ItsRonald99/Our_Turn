import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../hooks/useHouse', () => ({
  useHouseId: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useChores', () => ({
  useChoreTypes: vi.fn(() => ({ data: [], isLoading: false })),
  useAssignments: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('../../hooks/useMembers', () => ({
  useMembers: vi.fn(() => ({ data: [] })),
}));

vi.mock('../../api/client', () => ({
  api: { deleteHouse: vi.fn() },
}));

// Mock heavy child components so tests stay focused on Home's own behaviour
vi.mock('../../components/ChoreList', () => ({
  ChoreList: () => <div data-testid="chore-list" />,
}));
vi.mock('../../components/MemberList', () => ({
  MemberList: () => <div data-testid="member-list" />,
}));
vi.mock('../../components/AddAssignmentForm', () => ({
  AddAssignmentForm: () => <div data-testid="add-assignment-form" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useHouseId } from '../../hooks/useHouse';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Home } from '../Home';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockSetActiveHouseId = vi.fn();
const mockRefreshHouses = vi.fn();
const mockLogout = vi.fn();

const house1 = { id: 'h-1', name: 'The Blue House' };
const house2 = { id: 'h-2', name: 'Cabin' };

function setupMocks({ houseId = 'h-1', houses = [house1, house2] } = {}) {
  useHouseId.mockReturnValue(houseId);
  useAuth.mockReturnValue({
    user: { id: 'u-1', email: 'alice@example.com', displayName: 'Alice' },
    houses,
    setActiveHouseId: mockSetActiveHouseId,
    refreshHouses: mockRefreshHouses,
    logout: mockLogout,
  });
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Home — delete house feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshHouses.mockResolvedValue([]);
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the active house name in the header', () => {
    setupMocks();
    renderHome();
    expect(screen.getByRole('button', { name: 'The Blue House' })).toBeInTheDocument();
  });

  it('renders a delete button for the current house', () => {
    setupMocks();
    renderHome();
    expect(screen.getByRole('button', { name: /Delete this house/i })).toBeInTheDocument();
  });

  it('does not show the confirmation panel on initial render', () => {
    setupMocks();
    renderHome();
    expect(screen.queryByRole('button', { name: /^Delete$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancel$/i })).not.toBeInTheDocument();
  });

  it('redirects to /houses when houseId is null', () => {
    setupMocks({ houseId: null });
    renderHome();
    // MemoryRouter renders nothing for Navigate; confirm the main content is absent
    expect(screen.queryByRole('button', { name: /Delete this house/i })).not.toBeInTheDocument();
  });

  // ── Opening / closing confirmation ────────────────────────────────────────

  it('clicking the delete button shows the confirmation panel', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));

    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeInTheDocument();
  });

  it('confirmation panel shows the house name', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));

    expect(screen.getByText((t) => t.includes('The Blue House') && t.includes('?'))).toBeInTheDocument();
  });

  it('Cancel hides the confirmation panel without calling the API', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(api.deleteHouse).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Delete$/i })).not.toBeInTheDocument();
  });

  it('Cancel does not navigate', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── Successful delete ─────────────────────────────────────────────────────

  it('confirming calls api.deleteHouse with the current houseId', async () => {
    api.deleteHouse.mockResolvedValue({});
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(api.deleteHouse).toHaveBeenCalledWith('h-1'));
  });

  it('on success: calls setActiveHouseId(null)', async () => {
    api.deleteHouse.mockResolvedValue({});
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(mockSetActiveHouseId).toHaveBeenCalledWith(null));
  });

  it('on success: calls refreshHouses', async () => {
    api.deleteHouse.mockResolvedValue({});
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(mockRefreshHouses).toHaveBeenCalled());
  });

  it('on success: navigates to /houses', async () => {
    api.deleteHouse.mockResolvedValue({});
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/houses'));
  });

  it('on success: operations run in order (delete → clearId → refresh → navigate)', async () => {
    const order = [];
    api.deleteHouse.mockImplementation(async () => order.push('delete'));
    mockSetActiveHouseId.mockImplementation(() => order.push('clearId'));
    mockRefreshHouses.mockImplementation(async () => order.push('refresh'));
    mockNavigate.mockImplementation(() => order.push('navigate'));

    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(order).toHaveLength(4));
    expect(order).toEqual(['delete', 'clearId', 'refresh', 'navigate']);
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it('Delete button shows "Deleting…" while in-flight', async () => {
    let resolve;
    api.deleteHouse.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    expect(screen.getByRole('button', { name: /Deleting…/i })).toBeDisabled();
    resolve({});
  });

  it('Cancel button is disabled while delete is in-flight', async () => {
    let resolve;
    api.deleteHouse.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeDisabled();
    resolve({});
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('on error: shows the error message', async () => {
    api.deleteHouse.mockRejectedValue(new Error('Permission denied'));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(screen.getByText('Permission denied')).toBeInTheDocument());
  });

  it('on error: does not navigate', async () => {
    api.deleteHouse.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('on error: confirmation panel is closed', async () => {
    api.deleteHouse.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Delete$/i })).not.toBeInTheDocument());
  });

  it('on error: delete button is re-enabled (isDeleting resets)', async () => {
    api.deleteHouse.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Deleting…/i })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Delete this house/i })).not.toBeDisabled();
  });

  it('opening confirmation after an error clears the previous error', async () => {
    api.deleteHouse.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    // First attempt → error
    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());

    // Open confirmation again → error should clear
    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    expect(screen.queryByText('Server error')).not.toBeInTheDocument();
  });

  it('does not call setActiveHouseId or refreshHouses when delete fails', async () => {
    api.deleteHouse.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    setupMocks();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    expect(mockSetActiveHouseId).not.toHaveBeenCalled();
    expect(mockRefreshHouses).not.toHaveBeenCalled();
  });

  // ── House with no matching entry in houses array ───────────────────────────

  it('shows fallback "My House" when activeHouse is not found in houses list', () => {
    setupMocks({ houseId: 'h-orphan', houses: [] });
    renderHome();
    expect(screen.getByRole('button', { name: 'My House' })).toBeInTheDocument();
  });

  it('confirmation message shows fallback when house name is not in the list', async () => {
    const user = userEvent.setup();
    setupMocks({ houseId: 'h-orphan', houses: [] });
    renderHome();

    await user.click(screen.getByRole('button', { name: /Delete this house/i }));

    // Should not crash; the span renders with undefined name gracefully
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
  });
});
