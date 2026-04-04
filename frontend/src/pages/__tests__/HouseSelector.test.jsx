import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  api: {
    createHouse: vi.fn(),
    joinHouse: vi.fn(),
    deleteHouse: vi.fn(),
  },
}));

vi.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('../../components/AccountSettings', () => ({
  AccountSettings: () => <div data-testid="account-settings" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { HouseSelector } from '../HouseSelector';

const mockSetActiveHouseId = vi.fn();
const mockRefreshHouses = vi.fn();
const mockLogout = vi.fn();
const mockUser = { id: 'u-1', email: 'alice@example.com', displayName: 'Alice' };

function setupAuth(houses = [], activeHouseId = null) {
  useAuth.mockReturnValue({
    user: mockUser,
    houses,
    activeHouseId,
    setActiveHouseId: mockSetActiveHouseId,
    refreshHouses: mockRefreshHouses,
    logout: mockLogout,
  });
}

function renderSelector() {
  return render(
    <MemoryRouter>
      <HouseSelector />
    </MemoryRouter>
  );
}

describe('HouseSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshHouses.mockResolvedValue([]);
  });

  describe('with no houses', () => {
    beforeEach(() => setupAuth([]));

    it('shows the "not a member" message', async () => {
      renderSelector();
      await waitFor(() => {
        expect(screen.getByText(/not a member of any house/i)).toBeInTheDocument();
      });
    });

    it('shows the create/join form immediately (no "+" button needed)', async () => {
      renderSelector();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      });
      expect(screen.queryByText(/\+ Create or join/i)).not.toBeInTheDocument();
    });

    it('does not show a Cancel button when there are no houses', async () => {
      renderSelector();
      await waitFor(() => expect(mockRefreshHouses).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('calls refreshHouses on mount', async () => {
      renderSelector();
      await waitFor(() => expect(mockRefreshHouses).toHaveBeenCalledTimes(1));
    });
  });

  describe('with existing houses', () => {
    const houses = [
      { id: 'h-1', name: 'The Blue House' },
      { id: 'h-2', name: 'Cabin' },
    ];

    beforeEach(() => setupAuth(houses));

    it('renders each house as a clickable button', async () => {
      renderSelector();
      expect(screen.getByRole('button', { name: 'The Blue House' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cabin' })).toBeInTheDocument();
    });

    it('selecting a house calls setActiveHouseId and navigates to /', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'The Blue House' }));
      expect(mockSetActiveHouseId).toHaveBeenCalledWith('h-1');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('shows "+" button instead of open form', async () => {
      renderSelector();
      expect(screen.getByText(/Create or join a house/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/house name/i)).not.toBeInTheDocument();
    });

    it('clicking "+" reveals the create/join form', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByText(/Create or join a house/i));
      expect(screen.getByPlaceholderText(/e.g. The Blue House/i)).toBeInTheDocument();
    });

    it('shows Cancel button when form is open and houses exist', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByText(/Create or join a house/i));
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('Cancel hides the form without submitting', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByText(/Create or join a house/i));
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByPlaceholderText(/e.g. The Blue House/i)).not.toBeInTheDocument();
    });
  });

  describe('create house flow', () => {
    beforeEach(() => setupAuth([]));

    it('submits the house name and navigates on success', async () => {
      const newHouseId = 'h-new';
      api.createHouse.mockResolvedValue({ data: { house: { id: newHouseId, name: 'My House' } } });
      mockRefreshHouses.mockResolvedValue([{ id: newHouseId, name: 'My House' }]);

      const user = userEvent.setup();
      renderSelector();

      await user.type(screen.getByPlaceholderText(/e.g. The Blue House/i), 'My House');
      await user.click(screen.getByRole('button', { name: /Create house/i }));

      await waitFor(() => {
        expect(api.createHouse).toHaveBeenCalledWith({ name: 'My House' });
        expect(mockSetActiveHouseId).toHaveBeenCalledWith(newHouseId);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('shows error message when create fails', async () => {
      api.createHouse.mockRejectedValue(new Error('Server error'));

      const user = userEvent.setup();
      renderSelector();

      await user.type(screen.getByPlaceholderText(/e.g. The Blue House/i), 'My House');
      await user.click(screen.getByRole('button', { name: /Create house/i }));

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('disables the Create button while submitting', async () => {
      let resolve;
      api.createHouse.mockReturnValue(new Promise((r) => { resolve = r; }));

      const user = userEvent.setup();
      renderSelector();

      await user.type(screen.getByPlaceholderText(/e.g. The Blue House/i), 'My House');
      await user.click(screen.getByRole('button', { name: /Create house/i }));

      expect(screen.getByRole('button', { name: /Creating…/i })).toBeDisabled();
      resolve({ data: { house: { id: 'h-1', name: 'My House' } } });
    });
  });

  describe('join house flow', () => {
    beforeEach(() => setupAuth([]));

    it('switches to the Join tab and shows invite code input', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      expect(screen.getByPlaceholderText(/e.g. 123456/i)).toBeInTheDocument();
    });

    it('submits the invite code and navigates on success', async () => {
      const joinedId = 'h-joined';
      api.joinHouse.mockResolvedValue({ data: { house: { id: joinedId, name: 'Their House' } } });
      mockRefreshHouses.mockResolvedValue([{ id: joinedId }]);

      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      await user.type(screen.getByPlaceholderText(/e.g. 123456/i), '123456');
      await user.click(screen.getByRole('button', { name: /Join house/i }));

      await waitFor(() => {
        expect(api.joinHouse).toHaveBeenCalledWith({ inviteCode: '123456' });
        expect(mockSetActiveHouseId).toHaveBeenCalledWith(joinedId);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('strips non-digit characters from the invite code input', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      const input = screen.getByPlaceholderText(/e.g. 123456/i);
      await user.type(input, 'abc123def');
      expect(input.value).toBe('123');
    });

    it('disables the Join button until 6 digits are entered', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      const joinBtn = screen.getByRole('button', { name: /Join house/i });
      expect(joinBtn).toBeDisabled();
      await user.type(screen.getByPlaceholderText(/e.g. 123456/i), '12345');
      expect(joinBtn).toBeDisabled();
      await user.type(screen.getByPlaceholderText(/e.g. 123456/i), '6');
      expect(joinBtn).not.toBeDisabled();
    });

    it('shows error message when join fails', async () => {
      api.joinHouse.mockRejectedValue(new Error('Invalid invite code'));

      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      await user.type(screen.getByPlaceholderText(/e.g. 123456/i), '000000');
      await user.click(screen.getByRole('button', { name: /Join house/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
      });
    });
  });

  describe('notification bell', () => {
    it('renders the notification bell in the user bar', () => {
      setupAuth([]);
      renderSelector();
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    it('notification bell is present alongside the user name and sign-out button', () => {
      setupAuth([]);
      renderSelector();
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
  });

  describe('sign out', () => {
    it('calls logout when Sign out is clicked', async () => {
      setupAuth([]);
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /sign out/i }));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('shows the user display name in the header', () => {
      setupAuth([]);
      renderSelector();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('delete house flow', () => {
    const houses = [
      { id: 'h-1', name: 'The Blue House' },
      { id: 'h-2', name: 'Cabin' },
    ];

    beforeEach(() => {
      setupAuth(houses, 'h-1');
      mockRefreshHouses.mockResolvedValue(houses);
    });

    it('shows a delete button for each house', () => {
      renderSelector();
      expect(screen.getByRole('button', { name: /Delete The Blue House/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Cabin/i })).toBeInTheDocument();
    });

    it('clicking delete shows an inline confirmation prompt', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      expect(screen.getByText((t) => t.includes('The Blue House') && t.includes('?'))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeInTheDocument();
    });

    it('Cancel dismisses the confirmation without deleting', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Cancel$/i }));
      expect(api.deleteHouse).not.toHaveBeenCalled();
      expect(screen.queryByText(/Delete "The Blue House"\?/)).not.toBeInTheDocument();
    });

    it('confirming delete calls api.deleteHouse and refreshes', async () => {
      api.deleteHouse.mockResolvedValue({});
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => expect(api.deleteHouse).toHaveBeenCalledWith('h-1'));
      expect(mockRefreshHouses).toHaveBeenCalled();
    });

    it('clears activeHouseId if the deleted house was active', async () => {
      api.deleteHouse.mockResolvedValue({});
      const user = userEvent.setup();
      renderSelector(); // activeHouseId is 'h-1'
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => expect(mockSetActiveHouseId).toHaveBeenCalledWith(null));
    });

    it('does not clear activeHouseId when deleting a non-active house', async () => {
      api.deleteHouse.mockResolvedValue({});
      const user = userEvent.setup();
      renderSelector(); // activeHouseId is 'h-1', deleting 'h-2'
      await user.click(screen.getByRole('button', { name: /Delete Cabin/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => expect(api.deleteHouse).toHaveBeenCalledWith('h-2'));
      expect(mockSetActiveHouseId).not.toHaveBeenCalled();
    });

    it('shows error message when delete fails', async () => {
      api.deleteHouse.mockRejectedValue(new Error('Server error'));
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    });

    it('only shows confirmation for the clicked house, not others', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      // Confirmation appears for The Blue House
      expect(screen.getByText((t) => t.includes('The Blue House') && t.includes('?'))).toBeInTheDocument();
      // Cabin's delete button is still visible (no confirmation for it)
      expect(screen.getByRole('button', { name: /Delete Cabin/i })).toBeInTheDocument();
    });

    it('Delete confirm button is disabled and shows "Deleting…" while in-flight', async () => {
      let resolve;
      api.deleteHouse.mockReturnValue(new Promise((r) => { resolve = r; }));
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      expect(screen.getByRole('button', { name: /Deleting…/i })).toBeDisabled();
      resolve({});
    });

    it('Cancel button inside confirmation is disabled while delete is in-flight', async () => {
      let resolve;
      api.deleteHouse.mockReturnValue(new Promise((r) => { resolve = r; }));
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeDisabled();
      resolve({});
    });

    it('confirmation is cleared after a successful delete', async () => {
      api.deleteHouse.mockResolvedValue({});
      mockRefreshHouses.mockResolvedValue([houses[1]]); // only Cabin remains
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Deleting…/i })).not.toBeInTheDocument();
        expect(screen.queryByText((t) => t.includes('The Blue House') && t.includes('?'))).not.toBeInTheDocument();
      });
    });

    it('after error the delete button for that house is still shown (user can retry)', async () => {
      api.deleteHouse.mockRejectedValue(new Error('Server error'));
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
      // The delete button for The Blue House should be back
      expect(screen.getByRole('button', { name: /Delete The Blue House/i })).toBeInTheDocument();
    });

    it('deleting the only house works and clears activeHouseId', async () => {
      const singleHouse = [{ id: 'h-1', name: 'The Blue House' }];
      setupAuth(singleHouse, 'h-1');
      mockRefreshHouses.mockResolvedValue([]);
      api.deleteHouse.mockResolvedValue({});
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: /Delete The Blue House/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => {
        expect(api.deleteHouse).toHaveBeenCalledWith('h-1');
        expect(mockSetActiveHouseId).toHaveBeenCalledWith(null);
      });
    });
  });
});
