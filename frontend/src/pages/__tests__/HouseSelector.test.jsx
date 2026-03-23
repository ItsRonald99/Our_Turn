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
  },
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

function setupAuth(houses = []) {
  useAuth.mockReturnValue({
    houses,
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
      expect(screen.getByPlaceholderText(/e.g. ABC123/i)).toBeInTheDocument();
    });

    it('submits the invite code and navigates on success', async () => {
      const joinedId = 'h-joined';
      api.joinHouse.mockResolvedValue({ data: { house: { id: joinedId, name: 'Their House' } } });
      mockRefreshHouses.mockResolvedValue([{ id: joinedId }]);

      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      await user.type(screen.getByPlaceholderText(/e.g. ABC123/i), 'ABC123');
      await user.click(screen.getByRole('button', { name: /Join house/i }));

      await waitFor(() => {
        expect(api.joinHouse).toHaveBeenCalledWith({ inviteCode: 'ABC123' });
        expect(mockSetActiveHouseId).toHaveBeenCalledWith(joinedId);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('uppercases the invite code input automatically', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      const input = screen.getByPlaceholderText(/e.g. ABC123/i);
      await user.type(input, 'abc123');
      expect(input.value).toBe('ABC123');
    });

    it('disables the Join button until 6 characters are entered', async () => {
      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      const joinBtn = screen.getByRole('button', { name: /Join house/i });
      expect(joinBtn).toBeDisabled();
      await user.type(screen.getByPlaceholderText(/e.g. ABC123/i), 'ABC12');
      expect(joinBtn).toBeDisabled();
      await user.type(screen.getByPlaceholderText(/e.g. ABC123/i), '3');
      expect(joinBtn).not.toBeDisabled();
    });

    it('shows error message when join fails', async () => {
      api.joinHouse.mockRejectedValue(new Error('Invalid invite code'));

      const user = userEvent.setup();
      renderSelector();
      await user.click(screen.getByRole('button', { name: 'Join' }));
      await user.type(screen.getByPlaceholderText(/e.g. ABC123/i), 'XXXXXX');
      await user.click(screen.getByRole('button', { name: /Join house/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
      });
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
  });
});
