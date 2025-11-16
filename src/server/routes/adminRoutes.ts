import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { success } from '../utils/apiResponse.js';
import {
  AdminOverviewMetrics,
  AdminUserFilters,
  getAdminOverviewMetrics,
  listAdminAnnouncements,
  listPendingManagedRequests,
  listRecentSessions,
  listRequestedPeopleForAdmin,
  listUsersForAdmin,
  publishAdminAnnouncement,
  updateUserAdminFields
} from '../services/adminService.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.use(authenticate, requireRole(['admin', 'manager']));

router.get('/overview', async (_req, res, next) => {
  try {
    const metrics: AdminOverviewMetrics = await getAdminOverviewMetrics();
    success(res, { metrics });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const filters: AdminUserFilters = {};
    if (typeof req.query.q === 'string') {
      filters.search = req.query.q.trim();
    }
    if (typeof req.query.role === 'string' && ['user', 'admin', 'manager'].includes(req.query.role)) {
      filters.role = req.query.role as UserRole;
    }
    if (typeof req.query.managed === 'string') {
      filters.managed = req.query.managed === 'true';
    }
    const users = await listUsersForAdmin(filters);
    success(res, { users });
  } catch (error) {
    next(error);
  }
});

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin', 'manager']).optional(),
  managed: z.boolean().optional(),
  managerId: z.string().uuid().nullable().optional(),
  displayMode: z.enum(['normal', 'by_request', 'confidential']).nullable().optional(),
  isOnline: z.boolean().optional(),
  hasActiveSession: z.boolean().optional(),
  instantRatePerMinute: z.number().min(0).nullable().optional(),
  headline: z.string().max(160).nullable().optional(),
  bio: z.string().max(2000).nullable().optional()
});

router.patch('/users/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const payload = updateUserSchema.parse(req.body);
    const user = await updateUserAdminFields(req.params.id, payload);
    success(res, { user });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', async (req, res, next) => {
  try {
    const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = Number.isFinite(limitParam) && limitParam! > 0 ? Math.min(limitParam!, 200) : 60;
    const sessions = await listRecentSessions(limit);
    success(res, { sessions });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', async (_req, res, next) => {
  try {
    const requests = await listPendingManagedRequests();
    success(res, { requests });
  } catch (error) {
    next(error);
  }
});

router.get('/requested-people', async (_req, res, next) => {
  try {
    const people = await listRequestedPeopleForAdmin();
    success(res, { people });
  } catch (error) {
    next(error);
  }
});

const announcementSchema = z.object({ message: z.string().min(4).max(2000) });

router.post('/announcements', requireRole('admin'), async (req, res, next) => {
  try {
    const payload = announcementSchema.parse(req.body);
    await publishAdminAnnouncement(req.user!.id, payload.message);
    success(res, { published: true }, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/announcements', async (_req, res, next) => {
  try {
    const announcements = await listAdminAnnouncements();
    success(res, { announcements });
  } catch (error) {
    next(error);
  }
});

export default router;
