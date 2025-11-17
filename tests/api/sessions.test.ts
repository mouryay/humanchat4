import request from 'supertest';
import express from 'express';
import sessionRoutes from '../../src/server/routes/sessionRoutes';

const createSessionRecordMock = jest.fn(async (payload: Record<string, unknown>) => ({
  id: 'session-123',
  status: 'pending',
  ...payload
}));
const getSessionByIdMock = jest.fn(async (id: string) => ({ id, status: 'pending' }));
const updateSessionStatusMock = jest.fn(async (id: string, status: string) => ({ id, status }));
const markSessionStartMock = jest.fn(async (id: string) => ({ id, status: 'in_progress' }));
const markSessionEndMock = jest.fn(async (id: string) => ({ id, status: 'complete' }));

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

jest.mock('../../src/server/services/sessionService', () => ({
  createSessionRecord: (...args: unknown[]) => createSessionRecordMock(...(args as [Record<string, unknown>])),
  getSessionById: (...args: unknown[]) => getSessionByIdMock(...(args as [string])),
  updateSessionStatus: (...args: unknown[]) => updateSessionStatusMock(...(args as [string, string])),
  markSessionStart: (...args: unknown[]) => markSessionStartMock(...(args as [string])),
  markSessionEnd: (...args: unknown[]) => markSessionEndMock(...(args as [string]))
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/sessions', sessionRoutes);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error.message });
  });
  return app;
};

describe('sessionRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a session record', async () => {
    const app = buildApp();
    const payload = {
      host_user_id: '123e4567-e89b-12d3-a456-426614174000',
      guest_user_id: '123e4567-e89b-12d3-a456-426614174001',
      conversation_id: '123e4567-e89b-12d3-a456-426614174002',
      type: 'scheduled',
      start_time: new Date().toISOString(),
      duration_minutes: 30,
      agreed_price: 250,
      payment_mode: 'paid'
    } as const;

    const response = await request(app).post('/api/sessions').send(payload);
    expect(response.status).toBe(201);
    expect(createSessionRecordMock).toHaveBeenCalledWith(payload);
    expect(response.body.data.session.id).toBe('session-123');
  });

  it('retrieves a session by id', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/sessions/session-9');
    expect(response.status).toBe(200);
    expect(getSessionByIdMock).toHaveBeenCalledWith('session-9');
  });

  it('updates session status', async () => {
    const app = buildApp();
    const response = await request(app)
      .patch('/api/sessions/session-9/status')
      .send({ status: 'in_progress' });
    expect(response.status).toBe(200);
    expect(updateSessionStatusMock).toHaveBeenCalledWith('session-9', 'in_progress');
  });

  it('marks session start and end', async () => {
    const app = buildApp();
    const startResponse = await request(app).post('/api/sessions/session-9/start');
    expect(startResponse.status).toBe(200);
    expect(markSessionStartMock).toHaveBeenCalledWith('session-9');

    const endResponse = await request(app).post('/api/sessions/session-9/end');
    expect(endResponse.status).toBe(200);
    expect(markSessionEndMock).toHaveBeenCalledWith('session-9');
  });
});
