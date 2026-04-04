import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';
import { getChoreCompletionStats } from '../services/dashboardService.js';

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

export default router;
