export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'SESSION_ACTIVE'
  | 'TARGET_OFFLINE'
  | 'TARGET_BUSY'
  | 'REQUEST_REQUIRED'
  | 'REQUESTER_BUSY'
  | 'INVITE_EXPIRED'
  | 'INVITE_CONSUMED'
  | 'CALL_IN_PROGRESS'
  | 'CALL_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_FAILED';

export class ApiError extends Error {
  public status: number;
  public statusCode: number; // Alias for status
  public code: ErrorCode;
  public details?: unknown;

  constructor(status: number, codeOrMessage: ErrorCode | string, message?: string, details?: unknown) {
    // Support both signatures:
    // new ApiError(status, code, message, details)
    // new ApiError(status, message)
    let actualCode: ErrorCode;
    let actualMessage: string;

    if (message === undefined) {
      // Two-parameter form: new ApiError(status, message)
      actualCode = 'SERVER_ERROR';
      actualMessage = codeOrMessage as string;
    } else {
      // Three/four-parameter form: new ApiError(status, code, message, details)
      actualCode = codeOrMessage as ErrorCode;
      actualMessage = message;
    }

    super(actualMessage);
    this.status = status;
    this.statusCode = status; // Set alias
    this.code = actualCode;
    this.details = details;
  }
}
