import request from 'supertest';
import express from 'express';
import userRoutes from '../../src/server/routes/userRoutes';

const searchUsersMock = jest.fn(async (_query: string, _online?: boolean) => [{ id: 'member-1' }]);
const getUserByIdMock = jest.fn(async (id: string) => ({ id }));
const updateUserProfileMock = jest.fn(async (id: string, payload: Record<string, unknown>) => ({ id, ...payload }));
const getUserAvailabilityMock = jest.fn(async (id: string) => ({ id, slots: [] }));
const getUserStatusMock = jest.fn(async (id: string) => ({ id, isOnline: true }));
const logRequestedPersonMock = jest.fn(async (_payload: Record<string, unknown>) => undefined);

jest.mock('../../src/server/middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-1', email: 'user@example.com', role: 'user' } as never;
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
}));

jest.mock('../../src/server/middleware/rateLimit', () => ({
  authenticatedLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  unauthenticatedLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
}));

jest.mock('../../src/server/services/userService', () => ({
  searchUsers: (...args: unknown[]) => searchUsersMock(...(args as [string, boolean?])),
  getUserById: (...args: unknown[]) => getUserByIdMock(...(args as [string])),
  updateUserProfile: (...args: unknown[]) => updateUserProfileMock(...(args as [string, Record<string, unknown>])),
  getUserAvailability: (...args: unknown[]) => getUserAvailabilityMock(...(args as [string])),
  getUserStatus: (...args: unknown[]) => getUserStatusMock(...(args as [string]))
}));

jest.mock('../../src/server/services/requestedPeopleService', () => ({
  logRequestedPersonInterest: (...args: unknown[]) => logRequestedPersonMock(...(args as [Record<string, unknown>]))
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  return app;
};

describe('userRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches for users and logs interest when empty', async () => {
    searchUsersMock.mockResolvedValueOnce([]);
    const app = buildApp();
    const response = await request(app).get('/api/users/search?q=River&online=true');

    expect(response.status).toBe(200);
    expect(searchUsersMock).toHaveBeenCalledWith('River', true);
    expect(logRequestedPersonMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestedName: 'River', userId: 'user-1' })
    );
  });

  it('returns user detail', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/users/member-1');
    expect(response.status).toBe(200);
    expect(getUserByIdMock).toHaveBeenCalledWith('member-1');
  });

  it('updates user profile fields', async () => {
    const app = buildApp();
    const payload = { headline: 'Updated' };
    const response = await request(app).patch('/api/users/member-1').send(payload);
    expect(response.status).toBe(200);
    expect(updateUserProfileMock).toHaveBeenCalledWith('member-1', payload);
  });

  it('exposes availability and status', async () => {
    const app = buildApp();
    await request(app).get('/api/users/member-1/availability');
    expect(getUserAvailabilityMock).toHaveBeenCalledWith('member-1');

    await request(app).get('/api/users/member-1/status');
    expect(getUserStatusMock).toHaveBeenCalledWith('member-1');
  });
});
