export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfter && { retry_after: this.retryAfter }),
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(429, "RATE_LIMITED", `Rate limit exceeded. Try again in ${retryAfter} seconds.`, retryAfter);
  }
}
