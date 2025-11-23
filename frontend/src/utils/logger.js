/**
 * Production-safe logger utility
 * Automatically disables verbose logging in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  info: (...args) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  // For critical production logs only
  production: (...args) => {
    console.log('[PROD]', ...args);
  }
};

export default logger;
