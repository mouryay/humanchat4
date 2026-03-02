import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { success } from '../utils/apiResponse.js';
import {
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from '../services/notificationService.js';
import { ApiError } from '../errors/ApiError.js';

const router = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const parsed = listQuerySchema.parse(req.query ?? {});
    const notifications = await listNotificationsForUser(req.user!.id, {
      limit: parsed.limit ?? 30,
      offset: parsed.offset ?? 0
    });
    success(res, { notifications });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/unread-count', authenticate, async (req, res, next) => {
  try {
    const unreadCount = await getUnreadNotificationCount(req.user!.id);
    success(res, { unreadCount });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    const wasUpdated = await markNotificationAsRead(req.user!.id, req.params.id);
    if (!wasUpdated) {
      throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
    }
    success(res, { id: req.params.id, status: 'read' });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    const updatedCount = await markAllNotificationsAsRead(req.user!.id);
    success(res, { updatedCount });
  } catch (error) {
    next(error);
  }
});

export default router;
