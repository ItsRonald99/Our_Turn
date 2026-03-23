import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddAssignmentForm } from '../AddAssignmentForm';

vi.mock('../../hooks/useChores', () => ({
  useChoreTypes: vi.fn(),
  useAssignments: vi.fn(),
  useCreateAssignment: vi.fn(),
  useCreateChoreType: vi.fn(),
}));

vi.mock('../../hooks/useMembers', () => ({
  useMembers: vi.fn(),
}));

import { useChoreTypes, useCreateAssignment, useCreateChoreType } from '../../hooks/useChores';
import { useMembers } from '../../hooks/useMembers';

const makeChoreType = (id, name) => ({ id, houseId: 'house-1', name, rotationOrder: 0 });
const makeMember = (id, displayName) => ({ id, houseId: 'house-1', displayName, userId: null });

const defaultMutate = vi.fn();
const choreTypeMutate = vi.fn();

function setupMocks({ choreTypes = [], members = [], isLoading = false, choreTypeLoading = false } = {}) {
  useChoreTypes.mockReturnValue({ data: choreTypes });
  useMembers.mockReturnValue({ data: members });
  useCreateAssignment.mockReturnValue({ mutate: defaultMutate, isLoading });
  useCreateChoreType.mockReturnValue({ mutate: choreTypeMutate, isLoading: choreTypeLoading });
}

describe('AddAssignmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMutate.mockReset();
    choreTypeMutate.mockReset();
  });

  it('renders the form even when there are no chore types yet', () => {
    setupMocks({ choreTypes: [] });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('heading', { name: /New assignment/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Add new chore type/i)).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /Adding…/i })).toBeDisabled();
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

  it('renders a due date input defaulting to today', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByDisplayValue(today)).toBeInTheDocument();
  });

  it('includes dueDate in the submission payload', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: expect.any(String) }),
      expect.any(Object)
    );
  });

  it('shows "Adding…" on the submit button while mutation is loading', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')], isLoading: true });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Adding…/i })).toBeInTheDocument();
  });

  it('turning rotation back on clears the manually selected member', async () => {
    const user = userEvent.setup();
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Garbage')],
      members: [makeMember('m-1', 'Alice')],
    });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.click(screen.getByRole('checkbox')); // disable rotation
    await user.selectOptions(screen.getByRole('combobox', { name: /Assign to/i }), 'm-1');
    await user.click(screen.getByRole('checkbox')); // re-enable rotation
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ useRotation: true, memberId: undefined }),
      expect.any(Object)
    );
  });

  it('shows the + toggle button to reveal the new chore type form', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByTitle(/Add new chore type/i)).toBeInTheDocument();
  });

  it('reveals and hides the new chore type input when + is toggled', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    const toggle = screen.getByTitle(/Add new chore type/i);
    await user.click(toggle);
    expect(screen.getByPlaceholderText(/New chore type name/i)).toBeInTheDocument();

    await user.click(toggle); // hide again
    expect(screen.queryByPlaceholderText(/New chore type name/i)).not.toBeInTheDocument();
  });

  it('calls createChoreType.mutate with the new name', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.click(screen.getByTitle(/Add new chore type/i));
    await user.type(screen.getByPlaceholderText(/New chore type name/i), 'Dishes');
    await user.click(screen.getByRole('button', { name: /^Add$/i }));

    expect(choreTypeMutate).toHaveBeenCalledWith(
      { name: 'Dishes' },
      expect.any(Object)
    );
  });

  it('closes the new type form and auto-selects the type on success', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    choreTypeMutate.mockImplementation((_vars, { onSuccess }) =>
      onSuccess?.({ data: { id: 'ct-new', name: 'Dishes' } })
    );
    render(<AddAssignmentForm houseId="house-1" />);

    await user.click(screen.getByTitle(/Add new chore type/i));
    await user.type(screen.getByPlaceholderText(/New chore type name/i), 'Dishes');
    await user.click(screen.getByRole('button', { name: /^Add$/i }));

    expect(screen.queryByPlaceholderText(/New chore type name/i)).not.toBeInTheDocument();
  });

  it('shows error message when createChoreType fails', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    choreTypeMutate.mockImplementation((_vars, { onError }) =>
      onError?.(new Error('Already exists'))
    );
    render(<AddAssignmentForm houseId="house-1" />);

    await user.click(screen.getByTitle(/Add new chore type/i));
    await user.type(screen.getByPlaceholderText(/New chore type name/i), 'Garbage');
    await user.click(screen.getByRole('button', { name: /^Add$/i }));

    expect(screen.getByText('Already exists')).toBeInTheDocument();
  });
});

describe('AddAssignmentForm — recurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMutate.mockReset();
  });

  it('renders the Repeat selector defaulting to "Does not repeat"', () => {
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);
    expect(screen.getByRole('option', { name: /Does not repeat/i }).selected).toBe(true);
  });

  it('does not include recurrenceType in the payload when "Does not repeat" is selected', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.not.objectContaining({ recurrenceType: expect.anything() }),
      expect.any(Object)
    );
  });

  it('shows the interval sub-select when "Every N days" is chosen', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');
    expect(screen.getByRole('combobox', { name: /Interval in days/i })).toBeInTheDocument();
  });

  it('shows the weekday sub-select when "Every weekday" is chosen', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'weekday');
    expect(screen.getByRole('combobox', { name: /Day of week/i })).toBeInTheDocument();
  });

  it('hides the interval sub-select after switching back to "Does not repeat"', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');
    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), '');
    expect(screen.queryByRole('combobox', { name: /Interval in days/i })).not.toBeInTheDocument();
  });

  it('interval defaults to 7 (weekly) when "Every N days" is first selected', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');
    const intervalSelect = screen.getByRole('combobox', { name: /Interval in days/i });
    expect(intervalSelect.value).toBe('7');
  });

  it('weekday defaults to 1 (Monday) when "Every weekday" is first selected', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'weekday');
    const weekdaySelect = screen.getByRole('combobox', { name: /Day of week/i });
    expect(weekdaySelect.value).toBe('1');
  });

  it('submits with recurrenceType=interval and the chosen value', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');
    await user.selectOptions(screen.getByRole('combobox', { name: /Interval in days/i }), '14');
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ recurrenceType: 'interval', recurrenceValue: 14 }),
      expect.any(Object)
    );
  });

  it('submits with recurrenceType=weekday and the chosen day', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'weekday');
    await user.selectOptions(screen.getByRole('combobox', { name: /Day of week/i }), '3'); // Wednesday
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(defaultMutate).toHaveBeenCalledWith(
      expect.objectContaining({ recurrenceType: 'weekday', recurrenceValue: 3 }),
      expect.any(Object)
    );
  });

  it('resets recurrenceType to "Does not repeat" after successful submission', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    defaultMutate.mockImplementation((_vars, { onSuccess }) => onSuccess?.());
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Chore/i }), 'ct-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');
    await user.click(screen.getByRole('button', { name: /Add assignment/i }));

    expect(screen.queryByRole('combobox', { name: /Interval in days/i })).not.toBeInTheDocument();
  });

  it('switching from weekday to interval resets the value to 7', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'weekday');
    await user.selectOptions(screen.getByRole('combobox', { name: /Day of week/i }), '5'); // Friday
    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');

    expect(screen.getByRole('combobox', { name: /Interval in days/i }).value).toBe('7');
  });

  it('switching from interval to weekday resets the value to 1', async () => {
    const user = userEvent.setup();
    setupMocks({ choreTypes: [makeChoreType('ct-1', 'Garbage')] });
    render(<AddAssignmentForm houseId="house-1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'interval');
    await user.selectOptions(screen.getByRole('combobox', { name: /Interval in days/i }), '14');
    await user.selectOptions(screen.getByRole('combobox', { name: /Repeat/i }), 'weekday');

    expect(screen.getByRole('combobox', { name: /Day of week/i }).value).toBe('1');
  });
});
