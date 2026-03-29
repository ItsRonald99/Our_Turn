import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberList } from '../MemberList';

vi.mock('../../hooks/useMembers', () => ({
  useMembers: vi.fn(),
  useDeleteMember: vi.fn(),
}));

vi.mock('../../hooks/useInvitations', () => ({
  useInviteUser: vi.fn(),
}));

import { useMembers, useDeleteMember } from '../../hooks/useMembers';
import { useInviteUser } from '../../hooks/useInvitations';

const makeMember = (id, displayName) => ({ id, houseId: 'house-1', displayName, userId: null });

const defaultInviteMutate = vi.fn();
const defaultDeleteMutate = vi.fn();

function setupMocks({ members = [], isLoading = false, error = null, inviteLoading = false } = {}) {
  useMembers.mockReturnValue({ data: members, isLoading, error });
  useDeleteMember.mockReturnValue({ mutate: defaultDeleteMutate, isLoading: false });
  useInviteUser.mockReturnValue({ mutate: defaultInviteMutate, isLoading: inviteLoading });
}

describe('MemberList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultInviteMutate.mockReset();
    defaultDeleteMutate.mockReset();
    setupMocks();
  });

  it('renders the "Housemates" heading', () => {
    render(<MemberList houseId="house-1" />);
    expect(screen.getByRole('heading', { name: /Housemates/i })).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    setupMocks({ isLoading: true });
    render(<MemberList houseId="house-1" />);
    expect(screen.getByText(/Loading members/i)).toBeInTheDocument();
  });

  it('shows an error message when fetching fails', () => {
    setupMocks({ error: { message: 'Network error' } });
    render(<MemberList houseId="house-1" />);
    expect(screen.getByText(/Failed to load members/i)).toBeInTheDocument();
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
  });

  it('renders the list of members', () => {
    const members = [makeMember('m-1', 'Alice'), makeMember('m-2', 'Bob')];
    setupMocks({ members });
    render(<MemberList houseId="house-1" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders an empty list when there are no members', () => {
    render(<MemberList houseId="house-1" />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('renders a delete button for each member', () => {
    const members = [makeMember('m-1', 'Alice'), makeMember('m-2', 'Bob')];
    setupMocks({ members });
    render(<MemberList houseId="house-1" />);
    expect(screen.getAllByTitle('Remove')).toHaveLength(2);
  });

  it('calls deleteMember.mutate with the member ID when remove is clicked', async () => {
    const user = userEvent.setup();
    const members = [makeMember('m-1', 'Alice')];
    setupMocks({ members });
    render(<MemberList houseId="house-1" />);
    await user.click(screen.getByTitle('Remove'));
    expect(defaultDeleteMutate).toHaveBeenCalledWith('m-1');
  });

  describe('invite form', () => {
    it('renders an email input and Invite button', () => {
      render(<MemberList houseId="house-1" />);
      expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Invite/i })).toBeInTheDocument();
    });

    it('keeps the Invite button disabled when the input is empty', () => {
      render(<MemberList houseId="house-1" />);
      expect(screen.getByRole('button', { name: /Invite/i })).toBeDisabled();
    });

    it('enables the Invite button when the user types an email', async () => {
      const user = userEvent.setup();
      render(<MemberList houseId="house-1" />);
      await user.type(screen.getByPlaceholderText('Email address'), 'alice@test.com');
      expect(screen.getByRole('button', { name: /Invite/i })).not.toBeDisabled();
    });

    it('calls inviteUser.mutate with lowercased email on submit', async () => {
      const user = userEvent.setup();
      render(<MemberList houseId="house-1" />);
      await user.type(screen.getByPlaceholderText('Email address'), 'Alice@Test.com');
      await user.click(screen.getByRole('button', { name: /Invite/i }));
      expect(defaultInviteMutate).toHaveBeenCalledWith(
        { email: 'alice@test.com' },
        expect.any(Object)
      );
    });

    it('does not submit when the input is whitespace only', async () => {
      const user = userEvent.setup();
      render(<MemberList houseId="house-1" />);
      await user.type(screen.getByPlaceholderText('Email address'), '  ');
      // button stays disabled for whitespace-only email
      expect(screen.getByRole('button', { name: /Invite/i })).toBeDisabled();
      expect(defaultInviteMutate).not.toHaveBeenCalled();
    });

    it('shows "Invitation sent!" and clears the input on success', async () => {
      const user = userEvent.setup();
      defaultInviteMutate.mockImplementation((_body, { onSuccess }) => onSuccess());
      render(<MemberList houseId="house-1" />);
      await user.type(screen.getByPlaceholderText('Email address'), 'alice@test.com');
      await user.click(screen.getByRole('button', { name: /Invite/i }));
      await waitFor(() => {
        expect(screen.getByText('Invitation sent!')).toBeInTheDocument();
      });
      expect(screen.getByPlaceholderText('Email address').value).toBe('');
    });

    it('shows an error message when the invite fails', async () => {
      const user = userEvent.setup();
      defaultInviteMutate.mockImplementation((_body, { onError }) =>
        onError(new Error('No user found with that email'))
      );
      render(<MemberList houseId="house-1" />);
      await user.type(screen.getByPlaceholderText('Email address'), 'ghost@test.com');
      await user.click(screen.getByRole('button', { name: /Invite/i }));
      await waitFor(() => {
        expect(screen.getByText('No user found with that email')).toBeInTheDocument();
      });
    });

    it('disables the Invite button while the invite mutation is in-flight', () => {
      setupMocks({ inviteLoading: true });
      render(<MemberList houseId="house-1" />);
      expect(screen.getByRole('button', { name: /Sending/i })).toBeDisabled();
    });
  });
});
