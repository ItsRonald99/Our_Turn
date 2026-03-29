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
    const { choreTypeId, memberId, dueDate, useRotation, recurrenceType, recurrenceValue } = req.body ?? {};
    if (!choreTypeId) {
      return res.status(400).json({ error: 'choreTypeId is required' });
    }

    if (recurrenceType != null) {
      if (!['interval', 'weekday'].includes(recurrenceType)) {
        return res.status(400).json({ error: "recurrenceType must be 'interval' or 'weekday'" });
      }
      const v = recurrenceValue !== undefined ? Number(recurrenceValue) : undefined;
      if (recurrenceType === 'interval') {
        if (v === undefined || !Number.isInteger(v) || v < 1 || v > 365) {
          return res.status(400).json({ error: 'recurrenceValue must be a whole number between 1 and 365 for interval type' });
        }
      }
      if (recurrenceType === 'weekday') {
        if (v === undefined || !Number.isInteger(v) || v < 0 || v > 6) {
          return res.status(400).json({ error: 'recurrenceValue must be a whole number between 0 and 6 (Sun–Sat) for weekday type' });
        }
      }
    }

    const recurrenceValueNum = recurrenceValue !== undefined ? Number(recurrenceValue) : undefined;
    const data = await assignmentService.createAssignment(houseId, {
      choreTypeId,
      memberId: memberId || undefined,
      dueDate: dueDate || undefined,
      useRotation: Boolean(useRotation),
      recurrenceType: recurrenceType || undefined,
      recurrenceValue: recurrenceValueNum,
    });
    res.status(201).json({ data });
  } catch (err) {
    if (err.message?.includes('No member') || err.message?.startsWith('recurrence')) {
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
