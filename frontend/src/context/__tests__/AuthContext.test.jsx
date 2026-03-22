import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../api/client', () => ({
  api: {
    refreshToken: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getHouses: vi.fn(),
  },
  setToken: vi.fn(),
  setRefreshCallback: vi.fn(),
}));

import { api, setToken, setRefreshCallback } from '../../api/client';
import { AuthProvider, useAuth } from '../AuthContext';

function TestConsumer() {
  const { user, accessToken, activeHouseId, isLoading, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="token">{accessToken || 'null'}</span>
      <span data-testid="houseId">{activeHouseId || 'null'}</span>
      <button onClick={() => login('a@b.com', 'pass')}>login</button>
      <button onClick={() => register('a@b.com', 'pass', 'Alice')}>register</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state and resolves to logged-out when refresh fails', async () => {
    api.refreshToken.mockRejectedValue(new Error('No session'));

    renderWithAuth();
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('restores session when refresh succeeds', async () => {
    const mockUser = { id: 'u-1', email: 'a@b.com', displayName: 'Alice' };
    api.refreshToken.mockResolvedValue({ data: { user: mockUser, accessToken: 'tok-1' } });
    api.getHouses.mockResolvedValue({ data: [{ id: 'h-1', name: 'Home' }] });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('a@b.com');
    expect(screen.getByTestId('token').textContent).toBe('tok-1');
    expect(screen.getByTestId('houseId').textContent).toBe('h-1');
    expect(setToken).toHaveBeenCalledWith('tok-1');
  });

  it('login sets user and token, fetches houses', async () => {
    api.refreshToken.mockRejectedValue(new Error('No session'));

    const mockUser = { id: 'u-1', email: 'a@b.com', displayName: 'Alice' };
    api.login.mockResolvedValue({ data: { user: mockUser, accessToken: 'new-tok' } });
    api.getHouses.mockResolvedValue({ data: [{ id: 'h-1', name: 'Home' }] });

    const user = userEvent.setup();
    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('a@b.com');
    });
    expect(screen.getByTestId('houseId').textContent).toBe('h-1');
    expect(setToken).toHaveBeenCalledWith('new-tok');
  });

  it('register sets user and token', async () => {
    api.refreshToken.mockRejectedValue(new Error('No session'));

    const mockUser = { id: 'u-2', email: 'a@b.com', displayName: 'Alice' };
    api.register.mockResolvedValue({ data: { user: mockUser, accessToken: 'reg-tok' } });
    api.getHouses.mockResolvedValue({ data: [] });

    const user = userEvent.setup();
    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: 'register' }));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('a@b.com');
    });
    expect(screen.getByTestId('houseId').textContent).toBe('null');
  });

  it('logout clears user, token, and houseId', async () => {
    const mockUser = { id: 'u-1', email: 'a@b.com', displayName: 'Alice' };
    api.refreshToken.mockResolvedValue({ data: { user: mockUser, accessToken: 'tok-1' } });
    api.getHouses.mockResolvedValue({ data: [{ id: 'h-1', name: 'Home' }] });
    api.logout.mockResolvedValue({});

    const user = userEvent.setup();
    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.com'));
    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('houseId').textContent).toBe('null');
    expect(setToken).toHaveBeenCalledWith(null);
  });
});
