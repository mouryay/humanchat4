import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import notificationRoutes from '../../src/server/routes/notificationRoutes';
import { errorHandler } from '../../src/server/middleware/errorHandler';

const listNotificationsForUserMock = jest.fn();
const getUnreadNotificationCountMock = jest.fn();
const markNotificationAsReadMock = jest.fn();
const markAllNotificationsAsReadMock = jest.fn();

jest.mock('../../src/server/middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-123', email: 'user@example.com', role: 'user' };
    next();
  }
}));

jest.mock('../../src/server/services/notificationService', () => ({
  listNotificationsForUser: (...args: unknown[]) => listNotificationsForUserMock(...args),
  getUnreadNotificationCount: (...args: unknown[]) => getUnreadNotificationCountMock(...args),
  markNotificationAsRead: (...args: unknown[]) => markNotificationAsReadMock(...args),
  markAllNotificationsAsRead: (...args: unknown[]) => markAllNotificationsAsReadMock(...args)
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', notificationRoutes);
  app.use(errorHandler);
  return app;
};

describe('notificationRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists notifications', async () => {
    listNotificationsForUserMock.mockResolvedValueOnce([{ id: 'n1', title: 'T', body: 'B' }]);
    const app = buildApp();
    const response = await request(app).get('/api/notifications?limit=10&offset=0');
    expect(response.status).toBe(200);
    expect(listNotificationsForUserMock).toHaveBeenCalledWith('user-123', { limit: 10, offset: 0 });
    expect(response.body?.data?.notifications).toEqual([{ id: 'n1', title: 'T', body: 'B' }]);
  });

  it('returns unread count', async () => {
    getUnreadNotificationCountMock.mockResolvedValueOnce(4);
    const app = buildApp();
    const response = await request(app).get('/api/notifications/unread-count');
    expect(response.status).toBe(200);
    expect(response.body?.data?.unreadCount).toBe(4);
  });

  it('marks one notification read', async () => {
    markNotificationAsReadMock.mockResolvedValueOnce(true);
    const app = buildApp();
    const response = await request(app).post('/api/notifications/n123/read');
    expect(response.status).toBe(200);
    expect(markNotificationAsReadMock).toHaveBeenCalledWith('user-123', 'n123');
  });

  it('marks all notifications read', async () => {
    markAllNotificationsAsReadMock.mockResolvedValueOnce(6);
    const app = buildApp();
    const response = await request(app).post('/api/notifications/read-all');
    expect(response.status).toBe(200);
    expect(response.body?.data?.updatedCount).toBe(6);
  });
});
