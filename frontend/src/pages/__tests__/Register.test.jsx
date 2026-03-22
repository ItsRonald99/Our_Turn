import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../context/AuthContext';
import { Register } from '../Register';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ register: mockRegister });
  });

  it('renders display name, email, password fields and submit button', () => {
    renderRegister();
    expect(screen.getByPlaceholderText(/Your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('calls register and navigates on success', async () => {
    mockRegister.mockResolvedValue({});
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText(/Your name/i), 'Alice');
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'alice@example.com');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('alice@example.com', 'password123', 'Alice');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows error when password is too short', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText(/Your name/i), 'Alice');
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'alice@example.com');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows error message on registration failure', async () => {
    mockRegister.mockRejectedValue(new Error('Email already registered'));
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText(/Your name/i), 'Alice');
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'alice@example.com');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('has a link to the login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
