import type { ApiErrorBody } from '@wayfare/shared';

type ErrorCode = ApiErrorBody['error']['code'];

export interface Issue {
  path: string;
  message: string;
}

/** Errors that are safe to show to clients. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly issues?: Issue[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(issues: Issue[], message = issues[0]?.message ?? 'The request is invalid.') {
    super(400, 'VALIDATION_ERROR', message, issues);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'The service is temporarily unavailable. Please try again shortly.') {
    super(503, 'SERVICE_UNAVAILABLE', message);
  }
}
