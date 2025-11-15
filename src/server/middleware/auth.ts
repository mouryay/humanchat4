import { NextFunction, Request, Response } from 'express';
import { fail } from '../utils/apiResponse.js';
import { extractAccessToken, verifyAccessToken } from '../services/tokenService.js';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: 'user' | 'admin' | 'manager';
      };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractAccessToken(req);
  if (!token) {
    fail(res, 'UNAUTHORIZED', 'Missing access token', 401);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id as string, email: payload.email as string };
    next();
  } catch (error) {
    fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
};
