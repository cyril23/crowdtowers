// Game event logger with session ID prefix

function createGameLogger(gameId) {
  const prefix = `[${gameId}]`;

  return {
    info: (message, data = null) => {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`${timestamp} ${prefix} ${message}`, data);
      } else {
        console.log(`${timestamp} ${prefix} ${message}`);
      }
    },

    event: (eventType, details = {}) => {
      const timestamp = new Date().toISOString();
      const detailStr = Object.entries(details)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      console.log(`${timestamp} ${prefix} [${eventType}] ${detailStr}`);
    },

    error: (message, error = null) => {
      const timestamp = new Date().toISOString();
      console.error(`${timestamp} ${prefix} ERROR: ${message}`, error || '');
    }
  };
}

// Simple logger for non-game-specific logs
const serverLogger = {
  info: (message) => {
    console.log(`${new Date().toISOString()} [SERVER] ${message}`);
  },
  error: (message, error = null) => {
    console.error(`${new Date().toISOString()} [SERVER] ERROR: ${message}`, error || '');
  }
};

export { createGameLogger, serverLogger };
