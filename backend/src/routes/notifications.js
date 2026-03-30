import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as notificationService from '../services/notificationService.js';

const router = Router();

router.use(requireAuth);

/** GET /notifications — all notifications for the current user */
router.get('/', async (req, res) => {
  try {
    const data = await notificationService.listNotifications(req.user.userId);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /notifications/:id/read — mark a notification as read */
router.post('/:id/read', async (req, res) => {
  try {
    const data = await notificationService.markNotificationRead(req.user.userId, req.params.id);
    if (!data) return res.status(404).json({ error: 'Notification not found' });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
