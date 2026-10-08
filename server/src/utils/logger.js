/**
 * Simple structured console logger for the backend application.
 */
export const logger = {
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO]  [${timestamp}] ${message}`, Object.keys(meta).length ? meta : '');
  },
  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN]  [${timestamp}] ${message}`, Object.keys(meta).length ? meta : '');
  },
  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] [${timestamp}] ${message}`, Object.keys(meta).length ? meta : '');
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      console.debug(`[DEBUG] [${timestamp}] ${message}`, Object.keys(meta).length ? meta : '');
    }
  }
};
