const BASE = '/api';

let _accessToken = null;
let _refreshCallback = null;
let _refreshPromise = null;

export function setToken(token) {
  _accessToken = token;
}

export function setRefreshCallback(fn) {
  _refreshCallback = fn;
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  // Attempt token refresh once on 401, unless this is already a retry or an auth endpoint
  if (res.status === 401 && !options._isRetry && !path.startsWith('/auth/')) {
    try {
      if (!_refreshPromise) {
        _refreshPromise = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
          .then((r) => r.ok ? r.json() : Promise.reject(new Error('Refresh failed')))
          .then((body) => {
            _accessToken = body.data.accessToken;
            if (_refreshCallback) _refreshCallback(_accessToken);
          })
          .finally(() => { _refreshPromise = null; });
      }
      await _refreshPromise;
      return request(path, { ...options, _isRetry: true });
    } catch {
      if (_refreshCallback) _refreshCallback(null);
      throw new Error('Session expired. Please log in again.');
    }
  }

  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || res.statusText || 'Request failed');
  }
  return body;
}

export const api = {
  // Auth
  register: (body) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () =>
    request('/auth/logout', { method: 'POST' }),
  refreshToken: () =>
    request('/auth/refresh', { method: 'POST' }),
  me: () =>
    request('/auth/me'),

  // Houses
  getHouses: () => request('/houses'),
  getHouse: (houseId) => request(`/houses/${houseId}`),
  createHouse: (body) =>
    request('/houses', { method: 'POST', body: JSON.stringify(body) }),
  joinHouse: (body) =>
    request('/houses/join', { method: 'POST', body: JSON.stringify(body) }),
  deleteHouse: (houseId) =>
    request(`/houses/${houseId}`, { method: 'DELETE' }),

  // Chore types
  getChoreTypes: (houseId) => request(`/houses/${houseId}/chore-types`),
  createChoreType: (houseId, body) =>
    request(`/houses/${houseId}/chore-types`, { method: 'POST', body: JSON.stringify(body) }),
  deleteChoreType: (houseId, choreTypeId) =>
    request(`/houses/${houseId}/chore-types/${choreTypeId}`, { method: 'DELETE' }),

  // Members
  getMembers: (houseId) => request(`/houses/${houseId}/members`),
  createMember: (houseId, body) =>
    request(`/houses/${houseId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (houseId, memberId, body) =>
    request(`/houses/${houseId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMember: (houseId, memberId) =>
    request(`/houses/${houseId}/members/${memberId}`, { method: 'DELETE' }),

  // Invitations
  getInvitations: () => request('/invitations'),
  sendInvitation: (houseId, body) =>
    request(`/houses/${houseId}/invitations`, { method: 'POST', body: JSON.stringify(body) }),
  respondInvitation: (invitationId, body) =>
    request(`/invitations/${invitationId}/respond`, { method: 'POST', body: JSON.stringify(body) }),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (notificationId) =>
    request(`/notifications/${notificationId}/read`, { method: 'POST' }),

  // Account settings
  changePassword: (body) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  changeUsername: (body) =>
    request('/auth/change-username', { method: 'POST', body: JSON.stringify(body) }),

  // Dev only
  triggerReminders: (force = false) =>
    request(`/dev/send-reminders${force ? '?force=true' : ''}`, { method: 'POST' }),

  // Assignments
  getAssignments: (houseId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/houses/${houseId}/assignments${q ? `?${q}` : ''}`);
  },
  createAssignment: (houseId, body) =>
    request(`/houses/${houseId}/assignments`, { method: 'POST', body: JSON.stringify(body) }),
  updateAssignment: (houseId, assignmentId, body) =>
    request(`/houses/${houseId}/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  completeAssignment: (houseId, assignmentId) =>
    request(`/houses/${houseId}/assignments/${assignmentId}/complete`, { method: 'POST' }),
  deleteAssignment: (houseId, assignmentId) =>
    request(`/houses/${houseId}/assignments/${assignmentId}`, { method: 'DELETE' }),
};
