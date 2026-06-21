export type ErrorCode =
  | "CONFIG_INVALID"
  | "DATABASE_UNAVAILABLE"
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "PROVIDER_CREDITS_EXHAUSTED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_STREAM_FAILED"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(options: {
    code: ErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status ?? 500;
    if (options.details) {
      this.details = options.details;
    }
  }
}

export function toErrorEnvelope(error: unknown, requestId: string): ErrorEnvelope {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  };
}
