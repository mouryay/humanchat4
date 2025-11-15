import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const success = <T>(res: Response, data: T, status = 200): Response<SuccessResponse<T>> => {
  return res.status(status).json({ success: true, data });
};

export const fail = (res: Response, code: string, message: string, status = 400, details?: unknown): Response<ErrorPayload> => {
  return res.status(status).json({ success: false, error: { code, message, details } });
};
