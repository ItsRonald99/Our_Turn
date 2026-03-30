import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoreManager } from '../ChoreManager';

vi.mock('../../hooks/useChoreTypes', () => ({
  useChoreTypes: vi.fn(),
  useCreateChoreType: vi.fn(),
  useDeleteChoreType: vi.fn(),
}));

import { useChoreTypes, useCreateChoreType, useDeleteChoreType } from '../../hooks/useChoreTypes';

const makeChoreType = (id, name, description = null) => ({
  id,
  houseId: 'house-1',
  name,
  description,
  rotationOrder: 0,
});

const createMutate = vi.fn();
const deleteMutate = vi.fn();

function setupMocks({ choreTypes = [], createLoading = false, deleteLoading = false } = {}) {
  useChoreTypes.mockReturnValue({ data: choreTypes });
  useCreateChoreType.mockReturnValue({ mutate: createMutate, isLoading: createLoading });
  useDeleteChoreType.mockReturnValue({ mutate: deleteMutate, isLoading: deleteLoading });
}

describe('ChoreManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutate.mockReset();
    deleteMutate.mockReset();
  });

  it('renders the section heading', () => {
    setupMocks();
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByRole('heading', { name: /Chore types/i })).toBeInTheDocument();
  });

  it('shows empty state when there are no chore types', () => {
    setupMocks({ choreTypes: [] });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByText(/No chore types yet/i)).toBeInTheDocument();
  });

  it('renders a list of chore types', () => {
    setupMocks({
      choreTypes: [
        makeChoreType('ct-1', 'Dishes'),
        makeChoreType('ct-2', 'Vacuuming'),
      ],
    });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(screen.getByText('Vacuuming')).toBeInTheDocument();
  });

  it('renders descriptions when present', () => {
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Dishes', 'Include pots and pans')],
    });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByText('Include pots and pans')).toBeInTheDocument();
  });

  it('does not render description element when description is null', () => {
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Dishes', null)],
    });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('renders a delete button for each chore type', () => {
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Dishes'), makeChoreType('ct-2', 'Vacuuming')],
    });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Delete Dishes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Vacuuming/i })).toBeInTheDocument();
  });

  it('calls deleteChoreType.mutate with the correct id when delete is clicked', async () => {
    const user = userEvent.setup();
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Dishes')],
    });
    render(<ChoreManager houseId="house-1" />);

    await user.click(screen.getByRole('button', { name: /Delete Dishes/i }));
    expect(deleteMutate).toHaveBeenCalledWith('ct-1');
  });

  it('disables delete buttons while a delete is in progress', () => {
    setupMocks({
      choreTypes: [makeChoreType('ct-1', 'Dishes')],
      deleteLoading: true,
    });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Delete Dishes/i })).toBeDisabled();
  });

  it('calls createChoreType.mutate with title and description', async () => {
    const user = userEvent.setup();
    setupMocks();
    render(<ChoreManager houseId="house-1" />);

    await user.type(screen.getByPlaceholderText(/Chore name/i), 'Laundry');
    await user.type(screen.getByPlaceholderText(/Description/i), 'Wash and fold');
    await user.click(screen.getByRole('button', { name: /Add chore type/i }));

    expect(createMutate).toHaveBeenCalledWith(
      { title: 'Laundry', description: 'Wash and fold' },
      expect.any(Object)
    );
  });

  it('calls createChoreType.mutate without description when left empty', async () => {
    const user = userEvent.setup();
    setupMocks();
    render(<ChoreManager houseId="house-1" />);

    await user.type(screen.getByPlaceholderText(/Chore name/i), 'Laundry');
    await user.click(screen.getByRole('button', { name: /Add chore type/i }));

    expect(createMutate).toHaveBeenCalledWith(
      { title: 'Laundry', description: undefined },
      expect.any(Object)
    );
  });

  it('does not submit when the title is empty', async () => {
    const user = userEvent.setup();
    setupMocks();
    render(<ChoreManager houseId="house-1" />);

    await user.click(screen.getByRole('button', { name: /Add chore type/i }));
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('disables the submit button when title is empty', () => {
    setupMocks();
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Add chore type/i })).toBeDisabled();
  });

  it('disables the submit button while create is loading', () => {
    setupMocks({ createLoading: true });
    render(<ChoreManager houseId="house-1" />);
    expect(screen.getByRole('button', { name: /Adding…/i })).toBeDisabled();
  });

  it('clears the form inputs after successful creation', async () => {
    const user = userEvent.setup();
    setupMocks();
    createMutate.mockImplementation((_vars, { onSuccess }) => onSuccess?.());
    render(<ChoreManager houseId="house-1" />);

    await user.type(screen.getByPlaceholderText(/Chore name/i), 'Laundry');
    await user.type(screen.getByPlaceholderText(/Description/i), 'Wash and fold');
    await user.click(screen.getByRole('button', { name: /Add chore type/i }));

    expect(screen.getByPlaceholderText(/Chore name/i)).toHaveValue('');
    expect(screen.getByPlaceholderText(/Description/i)).toHaveValue('');
  });

  it('shows an error message when creation fails', async () => {
    const user = userEvent.setup();
    setupMocks();
    createMutate.mockImplementation((_vars, { onError }) =>
      onError?.(new Error('Name already exists'))
    );
    render(<ChoreManager houseId="house-1" />);

    await user.type(screen.getByPlaceholderText(/Chore name/i), 'Dishes');
    await user.click(screen.getByRole('button', { name: /Add chore type/i }));

    expect(screen.getByText('Name already exists')).toBeInTheDocument();
  });
});
