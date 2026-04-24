import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';
import { requireHouseOwner } from '../middleware/requireHouseOwner.js';
import { getDbSync } from '../db/client.js';
import { getChoreCompletionStats } from '../services/dashboardService.js';
import { addManualTally, removeManualTally } from '../services/tallyService.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireHouseMember);

/** GET /houses/:houseId/dashboard */
router.get('/', async (req, res) => {
  try {
    const data = await getChoreCompletionStats(req.params.houseId);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses/:houseId/dashboard/tally/add — owner only */
router.post('/tally/add', requireHouseOwner, async (req, res) => {
  try {
    const db = getDbSync();
    const { houseId } = req.params;
    const { memberId, choreTypeId } = req.body ?? {};
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json({ error: 'memberId is required' });
    }
    if (!choreTypeId || typeof choreTypeId !== 'string') {
      return res.status(400).json({ error: 'choreTypeId is required' });
    }
    const row = await addManualTally(db, houseId, memberId, choreTypeId);
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** POST /houses/:houseId/dashboard/tally/remove — owner only */
router.post('/tally/remove', requireHouseOwner, async (req, res) => {
  try {
    const db = getDbSync();
    const { houseId } = req.params;
    const { memberId, choreTypeId } = req.body ?? {};
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json({ error: 'memberId is required' });
    }
    if (!choreTypeId || typeof choreTypeId !== 'string') {
      return res.status(400).json({ error: 'choreTypeId is required' });
    }
    const row = await removeManualTally(db, houseId, memberId, choreTypeId);
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
