import { SOCKET_EVENTS, ERROR_REPORTING } from '../../../shared/constants.js';
import { networkManager } from '../managers/NetworkManager.js';
import { ErrorToast } from '../ui/ErrorToast.js';

class ErrorReporter {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = ERROR_REPORTING.MAX_ERRORS_PER_CLIENT;
    this.errorHashes = new Set();
    this.isDevMode = false;
    this.toast = null;
    this.game = null;
  }

  setGame(game) {
    this.game = game;
  }

  getActiveScenes() {
    if (!this.game) return 'N/A (no game)';
    try {
      const activeScenes = this.game.scene.getScenes(true);
      if (activeScenes.length === 0) return 'N/A (no active scenes)';
      return activeScenes.map(s => s.scene.key).join(', ');
    } catch {
      return 'N/A (error getting scenes)';
    }
  }

  init() {
    // Detect dev mode (localhost or staging)
    const hostname = window.location.hostname;
    this.isDevMode = hostname === 'localhost' ||
                     hostname === '127.0.0.1' ||
                     hostname === ERROR_REPORTING.STAGING_HOSTNAME;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || null
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.handleError({
        type: 'unhandledrejection',
        message: reason?.message || String(reason),
        stack: reason?.stack || null
      });
    });

    // Initialize toast for dev mode
    if (this.isDevMode) {
      this.toast = new ErrorToast();
    }

    console.log(`ErrorReporter initialized (dev mode: ${this.isDevMode})`);
  }

  handleError(errorInfo) {
    // Hard cap check
    if (this.errorCount >= this.maxErrors) {
      return;
    }

    // Deduplication via hash
    const hash = this.createHash((errorInfo.message || '') + (errorInfo.stack || ''));
    if (this.errorHashes.has(hash)) {
      return;
    }
    this.errorHashes.add(hash);

    // Clean old hashes if too many
    if (this.errorHashes.size > 100) {
      this.errorHashes.clear();
    }

    this.errorCount++;

    const errorData = {
      ...errorInfo,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      activeScenes: this.getActiveScenes()
    };

    // Send to server if connected
    if (networkManager.connected) {
      networkManager.emit(SOCKET_EVENTS.CLIENT_ERROR, errorData);
    }

    // Show toast in dev mode
    if (this.isDevMode && this.toast) {
      this.toast.show(errorInfo.message, errorInfo.stack);
    }
  }

  createHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Global instance
const errorReporter = new ErrorReporter();

// Make available globally (for debugging)
if (typeof window !== 'undefined') {
  window.errorReporter = errorReporter;
}

export { errorReporter };
