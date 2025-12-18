// Production-safe logger utility
// Only error/warn/critical logs in production, all logs in development

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const logger = {
  // Always available in dev, silent in production
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  // Warnings - available in dev only (security: don't leak warnings to users)
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  // Errors - available in both dev and production (critical for debugging)
  error: (...args: any[]) => {
    // In production, only log actual errors without sensitive data
    if (isProduction) {
      // Sanitize error messages for production
      console.error('[Error]', typeof args[0] === 'string' ? args[0] : 'An error occurred');
    } else {
      console.error(...args);
    }
  },
  
  // Info - dev only (to prevent information leakage)
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  // Debug - dev only (never in production)
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  // For critical errors that should always be logged (even in production)
  // But sanitized for production environment
  critical: (...args: any[]) => {
    if (isProduction) {
      console.error('[CRITICAL]', typeof args[0] === 'string' ? args[0] : 'Critical error occurred');
    } else {
      console.error('[CRITICAL]', ...args);
    }
  },
};

export default logger;
