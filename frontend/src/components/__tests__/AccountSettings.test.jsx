import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../hooks/useAccount', () => ({
  useChangePassword: vi.fn(),
  useChangeUsername: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useChangePassword, useChangeUsername } from '../../hooks/useAccount';
import { useAuth } from '../../context/AuthContext';
import { AccountSettings } from '../AccountSettings';

const changePasswordMutate = vi.fn();
const changeUsernameMutate = vi.fn();
const updateUser = vi.fn();

function setupMocks({ passwordLoading = false, usernameLoading = false } = {}) {
  useChangePassword.mockReturnValue({ mutate: changePasswordMutate, isLoading: passwordLoading });
  useChangeUsername.mockReturnValue({ mutate: changeUsernameMutate, isLoading: usernameLoading });
  useAuth.mockReturnValue({ updateUser });
}

function renderSettings() {
  return render(<AccountSettings />);
}

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changePasswordMutate.mockReset();
    changeUsernameMutate.mockReset();
    updateUser.mockReset();
    setupMocks();
  });

  // ---------------------------------------------------------------------------
  // Gear button
  // ---------------------------------------------------------------------------
  it('renders the gear button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /account settings/i })).toBeInTheDocument();
  });

  it('dropdown is not visible initially', () => {
    renderSettings();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Dropdown
  // ---------------------------------------------------------------------------
  it('opens the dropdown when the gear button is clicked', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('dropdown contains "Change Username" and "Change Password" options', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    expect(screen.getByRole('menuitem', { name: 'Change Username' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Modal — opening
  // ---------------------------------------------------------------------------
  it('clicking "Change Username" opens the username modal', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    expect(screen.getByRole('dialog', { name: 'Change Username' })).toBeInTheDocument();
  });

  it('clicking "Change Password" opens the password modal', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    expect(screen.getByRole('dialog', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('opening a modal closes the dropdown', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Modal — fields
  // ---------------------------------------------------------------------------
  it('username modal shows a text input for new username', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    expect(screen.getByPlaceholderText(/new display name/i)).toBeInTheDocument();
  });

  it('password modal shows a password input for new password', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    expect(screen.getByPlaceholderText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('password modal shows a confirm new password input', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    expect(screen.getByPlaceholderText(/confirm new password/i)).toBeInTheDocument();
  });

  it('username modal does not show a confirm password input', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    expect(screen.queryByPlaceholderText(/confirm new password/i)).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Modal — submit button disabled states
  // ---------------------------------------------------------------------------
  it('submit is disabled when inputs are empty', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    expect(screen.getByRole('button', { name: /save username/i })).toBeDisabled();
  });

  it('submit is disabled for password mode when passwords do not match', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    await user.type(screen.getByPlaceholderText('••••••••'), 'current1');
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), 'newpassword1');
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'newpassword2');

    expect(screen.getByRole('button', { name: /save password/i })).toBeDisabled();
  });

  it('submit is enabled for password mode when passwords match and are valid', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    await user.type(screen.getByPlaceholderText('••••••••'), 'current1');
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), 'newpassword');
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'newpassword');

    expect(screen.getByRole('button', { name: /save password/i })).not.toBeDisabled();
  });

  it('submit is disabled for password mode when new password is shorter than 8 chars', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    await user.type(screen.getByPlaceholderText('••••••••'), 'current1');
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), 'short');

    expect(screen.getByRole('button', { name: /save password/i })).toBeDisabled();
  });

  it('submit is enabled when all fields are valid', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    await user.type(screen.getByPlaceholderText('••••••••'), 'mypassword');
    await user.type(screen.getByPlaceholderText(/new display name/i), 'Bob');

    expect(screen.getByRole('button', { name: /save username/i })).not.toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Modal — API calls
  // ---------------------------------------------------------------------------
  it('calls changeUsername.mutate with correct payload', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    await user.type(screen.getByPlaceholderText('••••••••'), 'mypassword');
    await user.type(screen.getByPlaceholderText(/new display name/i), 'Bob');
    await user.click(screen.getByRole('button', { name: /save username/i }));

    expect(changeUsernameMutate).toHaveBeenCalledWith(
      { currentPassword: 'mypassword', newUsername: 'Bob' },
      expect.any(Object)
    );
  });

  it('calls changePassword.mutate with correct payload', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));

    await user.type(screen.getByPlaceholderText('••••••••'), 'oldpassword');
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), 'newpassword');
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'newpassword');
    await user.click(screen.getByRole('button', { name: /save password/i }));

    expect(changePasswordMutate).toHaveBeenCalledWith(
      { currentPassword: 'oldpassword', newPassword: 'newpassword' },
      expect.any(Object)
    );
  });

  // ---------------------------------------------------------------------------
  // Modal — success / error callbacks
  // ---------------------------------------------------------------------------
  it('closes the modal on successful password change', async () => {
    const user = userEvent.setup();
    changePasswordMutate.mockImplementation((_vars, { onSuccess }) => onSuccess?.());
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Password' }));
    await user.type(screen.getByPlaceholderText('••••••••'), 'oldpassword');
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), 'newpassword');
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'newpassword');
    await user.click(screen.getByRole('button', { name: /save password/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls updateUser and closes the modal on successful username change', async () => {
    const user = userEvent.setup();
    changeUsernameMutate.mockImplementation((_vars, { onSuccess }) =>
      onSuccess?.({ data: { user: { displayName: 'Bob' } } })
    );
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));
    await user.type(screen.getByPlaceholderText('••••••••'), 'mypassword');
    await user.type(screen.getByPlaceholderText(/new display name/i), 'Bob');
    await user.click(screen.getByRole('button', { name: /save username/i }));

    expect(updateUser).toHaveBeenCalledWith({ displayName: 'Bob' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an error message when the mutation fails', async () => {
    const user = userEvent.setup();
    changeUsernameMutate.mockImplementation((_vars, { onError }) =>
      onError?.(new Error('Current password is incorrect'))
    );
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.type(screen.getByPlaceholderText(/new display name/i), 'Bob');
    await user.click(screen.getByRole('button', { name: /save username/i }));

    expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // modal stays open
  });

  // ---------------------------------------------------------------------------
  // Modal — cancel / close
  // ---------------------------------------------------------------------------
  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /account settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Change Username' }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the modal when clicking the overlay background', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /account settings/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    // Click the overlay (the dialog element itself has role=dialog, the overlay is its parent)
    fireEvent.click(screen.getByRole('dialog'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  it('shows "Saving…" and disables submit while loading', () => {
    setupMocks({ usernameLoading: true });
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /account settings/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change Username' }));

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
