/**
 * Structured JSON logger for Vercel deployment
 *
 * Emits JSON-formatted logs to stdout for centralized monitoring.
 * No PII (personally identifiable information) — only UUIDs, counts, error names.
 *
 * Usage:
 *   logger.info('survey_submitted', { playerId, sessionId, durationMs, offline })
 *   logger.warn('sync_failed', { reason: error.message, retries: 3 })
 *   logger.error('audit_log_insert_failed', { actor_id, action, error_message })
 */

export interface LogContext {
  [key: string]: unknown;
}

function formatLogEntry(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: LogContext
) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  });
}

export const logger = {
  /**
   * Info level — successful operations, event tracking
   */
  info: (message: string, context: LogContext = {}) => {
    console.log(formatLogEntry('info', message, context));
  },

  /**
   * Warn level — non-fatal issues, degraded behavior
   */
  warn: (message: string, context: LogContext = {}) => {
    console.log(formatLogEntry('warn', message, context));
  },

  /**
   * Error level — exceptions, failed operations
   */
  error: (message: string, context: LogContext = {}) => {
    console.log(formatLogEntry('error', message, context));
  },
};
