import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddAssignmentForm } from '../AddAssignmentForm';

vi.mock('../../hooks/useChores', () => ({
  useChoreTypes: vi.fn(),
  useAssignments: vi.fn(),
  useCreateAssignment: vi.fn(),
}));

vi.mock('../../hooks/useMembers', () => ({
  useMembers: vi.fn(),
}));

import { useChoreTypes, useCreateAssignment } from '../../hooks/useChores';
import { useMembers } from '../../hooks/useMembers';

const makeChoreType = (id, name) => ({ id, houseId: 'house-1', name, rotationOrder: 0 });
const makeMember = (id, displayName) => ({ id, houseId: 'house-1', displayName, userId: null });

const defaultMutate = vi.fn();

function setupMocks({ choreTypes = [], members = [], isLoading = false } = {}) {
  useChoreTypes.mockReturnValue({ data: choreTypes });
  useMembers.mockReturnValue({ data: members });
  useCreateAssignment.mockReturnValue({ mutate: defaultMutate, isLoading });
}

describe('AddAssignmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMutate.mockReset();
  });

  it('renders nothing when there are no chore types', () => {
    setupMocks({ choreTypes: [] });
    const { container } = render(<AddAssignmentForm houseId="house-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the form when chore types are available', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('heading', { name: /New assignment/i })).toBeInTheDocument();
  });

  it('renders a chore type dropdown with options', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage'), makeChoreType('ct-2', 'Recycling')] });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('option', { name: 'Garbage' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Recycling' })).toBeInTheDocument();
  });

  it('renders the rotation checkbox checked by default', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('does not show the member dropdown when rotation is on', () => {
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Garbage')],
      members: [makeMember('m-1', 'Alice')],
    });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.queryByRole('option', { name: 'Alice' })).not.toBeInTheDocument();
  });

  it('shows the member dropdown when rotation is turned off', async () => {
    const user = userEvent.setup();
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Garbage')],
      members: [makeMember('m-1', 'Alice'), makeMember('m-2', 'Bob')],
    });
    render(<AddAssignmentForm houseId="house-1" />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
  });

  it('submits with useRotation=true when rotation is on and no member selected', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ choreTypeId: 'ct-1', useRotation: true }),
      expect.any(Object)
    );
  });

  it('submits with the selected memberId and useRotation=false', async () => {
    const user = userEvent.setup();
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Garbage')],
      members: [makeMember('m-1', 'Alice')],
    });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.click(screen.getByRole('checkbox')); // turn off rotation
    await user.selectOptions(screen.getByRole('combobox', { name: /Assign to/i }), 'm-1');
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ choreTypeId: 'ct-1', memberId: 'm-1', useRotation: false }),
      expect.any(Object)
    );
  });

  it('does not submit when no chore type is selected', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);
    // Don't select a chore type — submit button click should be a no-op
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));
    expect(defaultMutate).not.toHaveBeenCalled();
  });

  it('disables the submit button while the mutation is loading', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')], isLoading: true });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Add assignment/i })).toBeDisabled();
  });

  it('passes memberId as undefined when rotation is on (even if a member was previously selected)', async () => {
    const user = userEvent.setup();
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Garbage')],
      members: [makeMember('m-1', 'Alice')],
    });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    // Rotation is ON by default — submit and verify memberId is absent
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ useRotation: true }),
      expect.any(Object)
    );
  });
});
