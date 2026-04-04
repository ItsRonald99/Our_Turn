import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useInvitations', () => ({
  useInvitations: vi.fn(),
  useRespondInvitation: vi.fn(),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Capture navigate calls
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useInvitations, useRespondInvitation } from '../../hooks/useInvitations';
import { useNotifications, useMarkNotificationRead } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../NotificationBell';

const markReadMutate = vi.fn();
const respondMutate = vi.fn();
const setActiveHouseId = vi.fn();
const refreshHouses = vi.fn();

const HOUSES = [
  { id: 'h-1', name: 'Our House' },
  { id: 'h-2', name: 'Beach House' },
];

function makeNotification(overrides = {}) {
  return {
    id: 'n-1',
    userId: 'user-1',
    houseId: 'h-1',
    type: 'assignment_reminder',
    title: 'Chore Due',
    message: 'Dishes is overdue in Our House',
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function setupMocks({ notifications = [], invitations = [] } = {}) {
  useInvitations.mockReturnValue({ data: invitations });
  useNotifications.mockReturnValue({ data: notifications });
  useRespondInvitation.mockReturnValue({ mutate: respondMutate, isLoading: false });
  useMarkNotificationRead.mockReturnValue({ mutate: markReadMutate, isLoading: false });
  useAuth.mockReturnValue({
    refreshHouses,
    houses: HOUSES,
    setActiveHouseId,
  });
}

function renderBell(props = {}) {
  return render(
    <MemoryRouter>
      <NotificationBell {...props} />
    </MemoryRouter>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    setActiveHouseId.mockReset();
  });

  // ---------------------------------------------------------------------------
  // Badge
  // ---------------------------------------------------------------------------
  it('shows no badge when there are no notifications or invitations', () => {
    setupMocks();
    renderBell();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('shows a badge with the total unread count', () => {
    setupMocks({ notifications: [makeNotification(), makeNotification({ id: 'n-2' })] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    // badge is aria-hidden but still in the DOM
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Dropdown open / close
  // ---------------------------------------------------------------------------
  it('opens the dropdown when the bell is clicked', () => {
    setupMocks();
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('region', { name: /notifications/i })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Reminder messages — house name as a link
  // ---------------------------------------------------------------------------
  it('renders the house name as a clickable button when houseId is present', () => {
    setupMocks({ notifications: [makeNotification()] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const houseBtn = screen.getByRole('button', { name: 'Our House' });
    expect(houseBtn).toBeInTheDocument();
  });

  it('clicking the house name sets the active house and navigates to /', () => {
    setupMocks({ notifications: [makeNotification()] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Our House' }));

    expect(setActiveHouseId).toHaveBeenCalledWith('h-1');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('closes the dropdown after clicking the house name', () => {
    setupMocks({ notifications: [makeNotification()] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Our House' }));

    expect(screen.queryByRole('region', { name: /notifications/i })).not.toBeInTheDocument();
  });

  it('renders the house name for a different house', () => {
    const n = makeNotification({ houseId: 'h-2', message: 'Trash is due in Beach House' });
    setupMocks({ notifications: [n] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const houseBtn = screen.getByRole('button', { name: 'Beach House' });
    expect(houseBtn).toBeInTheDocument();

    fireEvent.click(houseBtn);
    expect(setActiveHouseId).toHaveBeenCalledWith('h-2');
  });

  // ---------------------------------------------------------------------------
  // Fallback — no houseId (legacy notifications)
  // ---------------------------------------------------------------------------
  it('renders the message as plain text when houseId is null', () => {
    const n = makeNotification({ houseId: null, message: 'Dishes is overdue in Our House' });
    setupMocks({ notifications: [n] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    // Message is there as text
    expect(screen.getByText(/Dishes is overdue in Our House/)).toBeInTheDocument();
    // No house-link button
    expect(screen.queryByRole('button', { name: 'Our House' })).not.toBeInTheDocument();
  });

  it('renders the message as plain text when the house is not in the user house list', () => {
    // houseId present but house not in houses array (user left that house)
    const n = makeNotification({ houseId: 'h-unknown', message: 'Dishes is due in Old House' });
    setupMocks({ notifications: [n] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText(/Dishes is due in Old House/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Old House' })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Mark as read
  // ---------------------------------------------------------------------------
  it('calls markRead when the mark-as-read button is clicked', () => {
    setupMocks({ notifications: [makeNotification()] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));
    expect(markReadMutate).toHaveBeenCalledWith('n-1');
  });

  // ---------------------------------------------------------------------------
  // Empty states
  // ---------------------------------------------------------------------------
  it('shows "No reminders" when there are no unread notifications', () => {
    setupMocks({ notifications: [makeNotification({ isRead: true })] });
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('No reminders')).toBeInTheDocument();
  });

  it('shows "No pending invitations" when there are no invitations', () => {
    setupMocks();
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('No pending invitations')).toBeInTheDocument();
  });
});
