import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api } from '../client.js';

// Helper: mock a successful fetch response
function mockFetch(data, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

// Helper: mock a 204 No Content response
function mockFetch204() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('no body')),
  });
}

// Helper: mock a failed fetch response
function mockFetchError(errorMessage, status = 400) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Bad Request',
    json: () => Promise.resolve({ error: errorMessage }),
  });
}

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Houses
  // ---------------------------------------------------------------------------
  describe('getHouses', () => {
    it('fetches all houses', async () => {
      global.fetch = mockFetch({ data: [{ id: 'house-1', name: 'Our House' }] });
      const result = await api.getHouses();
      expect(result.data).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith('/api/houses', expect.any(Object));
    });
  });

  describe('getHouse', () => {
    it('fetches a single house by ID', async () => {
      global.fetch = mockFetch({ data: { id: 'house-1', name: 'Our House' } });
      const result = await api.getHouse('house-1');
      expect(result.data.id).toBe('house-1');
      expect(fetch).toHaveBeenCalledWith('/api/houses/house-1', expect.any(Object));
    });

    it('throws an error when the house is not found', async () => {
      global.fetch = mockFetchError('House not found', 404);
      await expect(api.getHouse('missing')).rejects.toThrow('House not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Chore types
  // ---------------------------------------------------------------------------
  describe('getChoreTypes', () => {
    it('fetches chore types for a house', async () => {
      global.fetch = mockFetch({ data: [{ id: 'ct-1', name: 'Garbage' }] });
      const result = await api.getChoreTypes('house-1');
      expect(result.data[0].name).toBe('Garbage');
      expect(fetch).toHaveBeenCalledWith('/api/houses/house-1/chore-types', expect.any(Object));
    });
  });

  describe('createChoreType', () => {
    it('POSTs a new chore type', async () => {
      global.fetch = mockFetch({ data: { id: 'ct-new', name: 'Snow Shoveling' } }, 201);
      const result = await api.createChoreType('house-1', { name: 'Snow Shoveling' });
      expect(result.data.name).toBe('Snow Shoveling');
      expect(fetch).toHaveBeenCalledWith(
        '/api/houses/house-1/chore-types',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws when name is missing', async () => {
      global.fetch = mockFetchError('name is required');
      await expect(api.createChoreType('house-1', {})).rejects.toThrow('name is required');
    });
  });

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------
  describe('getMembers', () => {
    it('fetches members for a house', async () => {
      global.fetch = mockFetch({ data: [{ id: 'm-1', displayName: 'Alice' }] });
      const result = await api.getMembers('house-1');
      expect(result.data[0].displayName).toBe('Alice');
      expect(fetch).toHaveBeenCalledWith('/api/houses/house-1/members', expect.any(Object));
    });
  });

  describe('createMember', () => {
    it('POSTs a new member', async () => {
      global.fetch = mockFetch({ data: { id: 'm-new', displayName: 'Bob' } }, 201);
      const result = await api.createMember('house-1', { displayName: 'Bob' });
      expect(result.data.displayName).toBe('Bob');
    });

    it('throws when displayName is missing', async () => {
      global.fetch = mockFetchError('displayName is required');
      await expect(api.createMember('house-1', {})).rejects.toThrow('displayName is required');
    });
  });

  describe('updateMember', () => {
    it('PATCHes an existing member', async () => {
      global.fetch = mockFetch({ data: { id: 'm-1', displayName: 'Alice Updated' } });
      const result = await api.updateMember('house-1', 'm-1', { displayName: 'Alice Updated' });
      expect(result.data.displayName).toBe('Alice Updated');
      expect(fetch).toHaveBeenCalledWith(
        '/api/houses/house-1/members/m-1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('throws when member is not found', async () => {
      global.fetch = mockFetchError('Member not found', 404);
      await expect(api.updateMember('house-1', 'missing', { displayName: 'X' })).rejects.toThrow('Member not found');
    });
  });

  describe('deleteMember', () => {
    it('DELETEs a member and handles 204 response', async () => {
      global.fetch = mockFetch204();
      const result = await api.deleteMember('house-1', 'm-1');
      expect(result).toEqual({});
      expect(fetch).toHaveBeenCalledWith(
        '/api/houses/house-1/members/m-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Assignments
  // ---------------------------------------------------------------------------
  describe('getAssignments', () => {
    it('fetches assignments for a house', async () => {
      global.fetch = mockFetch({ data: [{ id: 'a-1' }] });
      const result = await api.getAssignments('house-1');
      expect(result.data).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith('/api/houses/house-1/assignments', expect.any(Object));
    });

    it('appends query params when provided', async () => {
      global.fetch = mockFetch({ data: [] });
      await api.getAssignments('house-1', { choreTypeId: 'ct-1', includeCompleted: 'false' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('choreTypeId=ct-1'),
        expect.any(Object)
      );
    });
  });

  describe('createAssignment', () => {
    it('POSTs a new assignment', async () => {
      global.fetch = mockFetch({ data: { id: 'a-new', choreTypeId: 'ct-1', memberId: 'm-1' } }, 201);
      const result = await api.createAssignment('house-1', { choreTypeId: 'ct-1', memberId: 'm-1' });
      expect(result.data.id).toBe('a-new');
    });

    it('throws when choreTypeId is missing', async () => {
      global.fetch = mockFetchError('choreTypeId is required');
      await expect(api.createAssignment('house-1', {})).rejects.toThrow('choreTypeId is required');
    });
  });

  describe('updateAssignment', () => {
    it('PATCHes an assignment', async () => {
      global.fetch = mockFetch({ data: { id: 'a-1', memberId: 'm-2' } });
      const result = await api.updateAssignment('house-1', 'a-1', { memberId: 'm-2' });
      expect(result.data.memberId).toBe('m-2');
      expect(fetch).toHaveBeenCalledWith(
        '/api/houses/house-1/assignments/a-1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('completeAssignment', () => {
    it('POSTs to the complete endpoint', async () => {
      global.fetch = mockFetch({ data: { id: 'a-1', completedAt: new Date().toISOString() } });
      const result = await api.completeAssignment('house-1', 'a-1');
      expect(result.data.completedAt).toBeTruthy();
      expect(fetch).toHaveBeenCalledWith(
        '/api/houses/house-1/assignments/a-1/complete',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws when assignment is not found', async () => {
      global.fetch = mockFetchError('Assignment not found', 404);
      await expect(api.completeAssignment('house-1', 'missing')).rejects.toThrow('Assignment not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws with the error message from the response body', async () => {
      global.fetch = mockFetchError('Custom server error', 500);
      await expect(api.getHouses()).rejects.toThrow('Custom server error');
    });

    it('falls back to statusText when body has no error field', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.resolve({}),
      });
      await expect(api.getHouses()).rejects.toThrow('Service Unavailable');
    });

    it('sends Content-Type: application/json header on all requests', async () => {
      global.fetch = mockFetch({ data: [] });
      await api.getHouses();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });
  });
});
