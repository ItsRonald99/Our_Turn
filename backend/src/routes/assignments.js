import { Router } from 'express';
import * as assignmentService from '../services/assignmentService.js';

import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireHouseMember);

/** GET /houses/:houseId/assignments */
router.get('/', async (req, res) => {
  try {
    const houseId = req.params.houseId;
    const { choreTypeId, fromDate, toDate, includeCompleted } = req.query;
    const data = await assignmentService.listAssignments(houseId, {
      choreTypeId: choreTypeId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      includeCompleted: includeCompleted !== 'false',
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses/:houseId/assignments */
router.post('/', async (req, res) => {
  try {
    const houseId = req.params.houseId;
    const { choreTypeId, memberId, dueDate, useRotation } = req.body ?? {};
    if (!choreTypeId) {
      return res.status(400).json({ error: 'choreTypeId is required' });
    }
    const data = await assignmentService.createAssignment(houseId, {
      choreTypeId,
      memberId: memberId || undefined,
      dueDate: dueDate || undefined,
      useRotation: Boolean(useRotation),
    });
    res.status(201).json({ data });
  } catch (err) {
    if (err.message?.includes('No member')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /houses/:houseId/assignments/:assignmentId */
router.patch('/:assignmentId', async (req, res) => {
  try {
    const { houseId, assignmentId } = req.params;
    const { memberId, completedAt, dueDate } = req.body ?? {};
    const data = await assignmentService.updateAssignment(houseId, assignmentId, {
      memberId: memberId || undefined,
      completedAt: completedAt !== undefined ? (completedAt ? new Date(completedAt) : null) : undefined,
      dueDate: dueDate || undefined,
    });
    if (!data) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ data });
  } catch (err) {
    if (err.message === 'Invalid dueDate') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /houses/:houseId/assignments/:assignmentId */
router.delete('/:assignmentId', async (req, res) => {
  try {
    const { houseId, assignmentId } = req.params;
    const result = await assignmentService.deleteAssignment(houseId, assignmentId);
    if (!result) return res.status(404).json({ error: 'Assignment not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses/:houseId/assignments/:assignmentId/complete */
router.post('/:assignmentId/complete', async (req, res) => {
  try {
    const { houseId, assignmentId } = req.params;
    const data = await assignmentService.markComplete(houseId, assignmentId);
    if (!data) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
