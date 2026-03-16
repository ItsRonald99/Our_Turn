const BASE = '/api';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || res.statusText || 'Request failed');
  }
  return body;
}

export const api = {
  getHouses: () => request('/houses'),
  getHouse: (houseId) => request(`/houses/${houseId}`),

  getChoreTypes: (houseId) => request(`/houses/${houseId}/chore-types`),
  createChoreType: (houseId, body) =>
    request(`/houses/${houseId}/chore-types`, { method: 'POST', body: JSON.stringify(body) }),

  getMembers: (houseId) => request(`/houses/${houseId}/members`),
  createMember: (houseId, body) =>
    request(`/houses/${houseId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (houseId, memberId, body) =>
    request(`/houses/${houseId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMember: (houseId, memberId) =>
    request(`/houses/${houseId}/members/${memberId}`, { method: 'DELETE' }),

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
};
