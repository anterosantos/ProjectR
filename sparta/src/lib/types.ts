/**
 * Result type — represents either success or failure of an operation
 * Used throughout the app to avoid throwing exceptions in Server Actions
 *
 * Success: { ok: true, data: T }
 * Failure: { ok: false, error: E }
 */
export type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

/**
 * AppError — standardized error representation
 * Used for consistent error handling across Server Actions and utilities
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Helper to create a success Result
 */
export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

/**
 * Helper to create a failure Result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
