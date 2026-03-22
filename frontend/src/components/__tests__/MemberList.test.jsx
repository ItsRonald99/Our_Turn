import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberList } from '../MemberList';

vi.mock('../../hooks/useMembers', () => ({
  useMembers: vi.fn(),
  useCreateMember: vi.fn(),
  useDeleteMember: vi.fn(),
}));

import { useMembers, useCreateMember, useDeleteMember } from '../../hooks/useMembers';

const makeMember = (id, displayName) => ({ id, houseId: 'house-1', displayName, userId: null });

const defaultCreateMutate = vi.fn();
const defaultDeleteMutate = vi.fn();

function setupMocks({ members = [], isLoading = false, error = null } = {}) {
  useMembers.mockReturnValue({ data: members, isLoading, error });
  useCreateMember.mockReturnValue({ mutate: defaultCreateMutate, isLoading: false });
  useDeleteMember.mockReturnValue({ mutate: defaultDeleteMutate, isLoading: false });
}

describe('MemberList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultCreateMutate.mockReset();
    defaultDeleteMutate.mockReset();
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
    setupMocks({ members: [] });
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

  it('renders the add member form', () => {
    setupMocks();
    render(<MemberList houseId="house-1" />);
    expect(screen.getByPlaceholderText('Display name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
  });

  it('keeps the Add button disabled when the input is empty', () => {
    setupMocks();
    render(<MemberList houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Add/i })).toBeDisabled();
  });

  it('enables the Add button when the user types a name', async () => {
    const user = userEvent.setup();
    setupMocks();
    render(<MemberList houseId="house-1" />);
    await user.type(screen.getByPlaceholderText('Display name'), 'Charlie');
    expect(screen.getByRole('button', { name: /Add/i })).not.toBeDisabled();
  });

  it('calls createMember.mutate when the form is submitted', async () => {
    const user = userEvent.setup();
    setupMocks();
    render(<MemberList houseId="house-1" />);
    await user.type(screen.getByPlaceholderText('Display name'), 'Charlie');
    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect(defaultCreateMutate).toHaveBeenCalledWith(
      { displayName: 'Charlie' },
      expect.any(Object)
    );
  });

  it('does not submit the form when the input is only whitespace', async () => {
    const user = userEvent.setup();
    setupMocks();
    render(<MemberList houseId="house-1" />);
    await user.type(screen.getByPlaceholderText('Display name'), '   ');
    // Button stays disabled for whitespace-only input
    expect(screen.getByRole('button', { name: /Add/i })).toBeDisabled();
  });

  it('disables the Add button while the create mutation is loading', () => {
    setupMocks();
    useCreateMember.mockReturnValue({ mutate: defaultCreateMutate, isLoading: true });
    render(<MemberList houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Add/i })).toBeDisabled();
  });

  it('renders the "Housemates" heading', () => {
    setupMocks();
    render(<MemberList houseId="house-1" />);
    expect(screen.getByRole('heading', { name: /Housemates/i })).toBeInTheDocument();
  });
});
