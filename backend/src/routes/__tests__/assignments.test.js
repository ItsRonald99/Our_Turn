import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the entire assignment service — the route handlers delegate everything to it
vi.mock('../../services/assignmentService.js', () => ({
  listAssignments: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  markComplete: vi.fn(),
  deleteAssignment: vi.fn(),
}));

// Bypass auth middleware in route unit tests
vi.mock('../../middleware/requireAuth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}));
vi.mock('../../middleware/requireHouseMember.js', () => ({
  requireHouseMember: (_req, _res, next) => next(),
}));

import * as assignmentService from '../../services/assignmentService.js';
import assignmentsRouter from '../assignments.js';


function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/houses/:houseId/assignments', assignmentsRouter);
  return app;
}

const HOUSE_ID = 'house-1';
const BASE = `/houses/${HOUSE_ID}/assignments`;

const makeAssignment = (overrides = {}) => ({
  id: 'a-1',
  houseId: HOUSE_ID,
  choreTypeId: 'ct-1',
  memberId: 'm-1',
  dueDate: new Date('2024-06-01'),
  completedAt: null,
  createdAt: new Date('2024-06-01'),
  ...overrides,
});

describe('GET /houses/:houseId/assignments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all assignments', async () => {
    const assignments = [makeAssignment(), makeAssignment({ id: 'a-2' })];
    assignmentService.listAssignments.mockResolvedValue(assignments);

    const res = await request(createApp()).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(assignmentService.listAssignments).toHaveBeenCalledWith(
      HOUSE_ID,
      expect.objectContaining({ includeCompleted: true })
    );
  });

  it('passes choreTypeId filter to the service', async () => {
    assignmentService.listAssignments.mockResolvedValue([]);

    await request(createApp()).get(`${BASE}?choreTypeId=ct-1`);
    expect(assignmentService.listAssignments).toHaveBeenCalledWith(
      HOUSE_ID,
      expect.objectContaining({ choreTypeId: 'ct-1' })
    );
  });

  it('passes fromDate and toDate filters to the service', async () => {
    assignmentService.listAssignments.mockResolvedValue([]);

    await request(createApp()).get(`${BASE}?fromDate=2024-01-01&toDate=2024-12-31`);
    expect(assignmentService.listAssignments).toHaveBeenCalledWith(
      HOUSE_ID,
      expect.objectContaining({ fromDate: '2024-01-01', toDate: '2024-12-31' })
    );
  });

  it('sets includeCompleted to false when query param is "false"', async () => {
    assignmentService.listAssignments.mockResolvedValue([]);

    await request(createApp()).get(`${BASE}?includeCompleted=false`);
    expect(assignmentService.listAssignments).toHaveBeenCalledWith(
      HOUSE_ID,
      expect.objectContaining({ includeCompleted: false })
    );
  });

  it('returns 500 when the service throws', async () => {
    assignmentService.listAssignments.mockRejectedValue(new Error('DB error'));

    const res = await request(createApp()).get(BASE);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

describe('POST /houses/:houseId/assignments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and returns a new assignment', async () => {
    const created = makeAssignment();
    assignmentService.createAssignment.mockResolvedValue(created);

    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('a-1');
    expect(assignmentService.createAssignment).toHaveBeenCalledWith(
      HOUSE_ID,
      expect.objectContaining({ choreTypeId: 'ct-1', memberId: 'm-1' })
    );
  });

  it('returns 400 when choreTypeId is missing', async () => {
    const res = await request(createApp()).post(BASE).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('choreTypeId is required');
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('creates assignment with rotation when useRotation is true', async () => {
    const created = makeAssignment();
    assignmentService.createAssignment.mockResolvedValue(created);

    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', useRotation: true });

    expect(res.status).toBe(201);
    expect(assignmentService.createAssignment).toHaveBeenCalledWith(
      HOUSE_ID,
      expect.objectContaining({ useRotation: true })
    );
  });

  it('returns 400 when service throws "No member" error', async () => {
    assignmentService.createAssignment.mockRejectedValue(
      new Error('No member specified and rotation could not determine one (no members?).')
    );

    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', useRotation: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No member');
  });

  it('returns 400 when service throws a generic error', async () => {
    assignmentService.createAssignment.mockRejectedValue(new Error('Unexpected failure'));

    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1' });

    expect(res.status).toBe(500);
  });

  // --- Security: route-level recurrence validation ---

  it('returns 400 for an invalid recurrenceType', async () => {
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'daily', recurrenceValue: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recurrenceType/);
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('returns 400 for weekday recurrenceValue of 7 (out-of-range — DoS vector)', async () => {
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'weekday', recurrenceValue: 7 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/0 and 6/);
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('returns 400 for negative weekday recurrenceValue', async () => {
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'weekday', recurrenceValue: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/0 and 6/);
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('returns 400 for a float weekday recurrenceValue', async () => {
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'weekday', recurrenceValue: 2.5 });

    expect(res.status).toBe(400);
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('returns 400 for interval recurrenceValue of 0', async () => {
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'interval', recurrenceValue: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1 and 365/);
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('returns 400 for interval recurrenceValue exceeding 365', async () => {
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'interval', recurrenceValue: 400 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1 and 365/);
    expect(assignmentService.createAssignment).not.toHaveBeenCalled();
  });

  it('accepts valid interval recurrence (boundary: 1 day)', async () => {
    assignmentService.createAssignment.mockResolvedValue(makeAssignment());
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'interval', recurrenceValue: 1 });

    expect(res.status).toBe(201);
    expect(assignmentService.createAssignment).toHaveBeenCalled();
  });

  it('accepts valid weekday recurrence (boundary: 0 = Sunday)', async () => {
    assignmentService.createAssignment.mockResolvedValue(makeAssignment());
    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'weekday', recurrenceValue: 0 });

    expect(res.status).toBe(201);
    expect(assignmentService.createAssignment).toHaveBeenCalled();
  });

  it('returns 400 when service throws a recurrence error (defence-in-depth)', async () => {
    assignmentService.createAssignment.mockRejectedValue(
      new Error("recurrenceType must be 'interval' or 'weekday'")
    );

    const res = await request(createApp())
      .post(BASE)
      .send({ choreTypeId: 'ct-1', memberId: 'm-1', recurrenceType: 'weekday', recurrenceValue: 3 });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /houses/:houseId/assignments/:assignmentId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates and returns the assignment', async () => {
    const updated = makeAssignment({ memberId: 'm-2' });
    assignmentService.updateAssignment.mockResolvedValue(updated);

    const res = await request(createApp())
      .patch(`${BASE}/a-1`)
      .send({ memberId: 'm-2' });

    expect(res.status).toBe(200);
    expect(res.body.data.memberId).toBe('m-2');
    expect(assignmentService.updateAssignment).toHaveBeenCalledWith(
      HOUSE_ID,
      'a-1',
      expect.objectContaining({ memberId: 'm-2' })
    );
  });

  it('passes dueDate to the service', async () => {
    const updated = makeAssignment({ dueDate: new Date('2025-01-15') });
    assignmentService.updateAssignment.mockResolvedValue(updated);

    const res = await request(createApp())
      .patch(`${BASE}/a-1`)
      .send({ dueDate: '2025-01-15' });

    expect(res.status).toBe(200);
    expect(assignmentService.updateAssignment).toHaveBeenCalledWith(
      HOUSE_ID,
      'a-1',
      expect.objectContaining({ dueDate: '2025-01-15' })
    );
  });

  it('returns 400 when the service throws Invalid dueDate', async () => {
    assignmentService.updateAssignment.mockRejectedValue(new Error('Invalid dueDate'));

    const res = await request(createApp())
      .patch(`${BASE}/a-1`)
      .send({ dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid dueDate');
  });

  it('returns 404 when assignment is not found', async () => {
    assignmentService.updateAssignment.mockResolvedValue(null);

    const res = await request(createApp())
      .patch(`${BASE}/missing`)
      .send({ memberId: 'm-1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Assignment not found');
  });

  it('returns 500 when service throws a generic error', async () => {
    assignmentService.updateAssignment.mockRejectedValue(new Error('DB error'));

    const res = await request(createApp())
      .patch(`${BASE}/a-1`)
      .send({ memberId: 'm-1' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /houses/:houseId/assignments/:assignmentId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 204 on successful deletion', async () => {
    assignmentService.deleteAssignment.mockResolvedValue(true);

    const res = await request(createApp()).delete(`${BASE}/a-1`);
    expect(res.status).toBe(204);
    expect(assignmentService.deleteAssignment).toHaveBeenCalledWith(HOUSE_ID, 'a-1');
  });

  it('returns 404 when the assignment does not exist', async () => {
    assignmentService.deleteAssignment.mockResolvedValue(null);

    const res = await request(createApp()).delete(`${BASE}/missing`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Assignment not found');
  });

  it('returns 500 when the service throws', async () => {
    assignmentService.deleteAssignment.mockRejectedValue(new Error('DB error'));

    const res = await request(createApp()).delete(`${BASE}/a-1`);
    expect(res.status).toBe(500);
  });
});

describe('POST /houses/:houseId/assignments/:assignmentId/complete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks the assignment complete and returns it', async () => {
    const completed = makeAssignment({ completedAt: new Date() });
    assignmentService.markComplete.mockResolvedValue(completed);

    const res = await request(createApp()).post(`${BASE}/a-1/complete`);
    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBeTruthy();
    expect(assignmentService.markComplete).toHaveBeenCalledWith(HOUSE_ID, 'a-1');
  });

  it('returns 404 when assignment is not found', async () => {
    assignmentService.markComplete.mockResolvedValue(null);

    const res = await request(createApp()).post(`${BASE}/missing/complete`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Assignment not found');
  });

  it('returns 500 when service throws', async () => {
    assignmentService.markComplete.mockRejectedValue(new Error('DB error'));

    const res = await request(createApp()).post(`${BASE}/a-1/complete`);
    expect(res.status).toBe(500);
  });
});
