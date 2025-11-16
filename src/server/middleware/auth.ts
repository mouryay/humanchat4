import { NextFunction, Request, Response } from 'express';
import { fail } from '../utils/apiResponse.js';
import { extractAccessToken, verifyAccessToken } from '../services/tokenService.js';
import { UserRole } from '../types/index.js';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
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
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (error) {
    fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }
    if (!allowed.includes(req.user.role)) {
      fail(res, 'FORBIDDEN', 'You do not have permission to perform this action', 403);
      return;
    }
    next();
  };
};
