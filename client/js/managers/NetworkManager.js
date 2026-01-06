import { SOCKET_EVENTS } from '../../../shared/constants.js';
import { log } from '../utils/logger.js';

class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.sessionCode = null;
    this.nickname = null;
    this.isHost = false;
    this.eventHandlers = new Map();

    // Track when page was last visible (for detecting sleep/wake)
    this.lastVisibleTime = Date.now();

    // Listen for visibility changes (laptop wake from sleep)
    this.setupVisibilityHandler();
  }

  setupVisibilityHandler() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const hiddenDuration = Date.now() - this.lastVisibleTime;
        log('[NETWORK]', `Page visible after ${hiddenDuration}ms`);

        // If hidden for more than 5 seconds, force reconnect to clear zombie sockets
        // This handles the case where laptop goes to sleep after a pre-sleep wake
        if (hiddenDuration > 5000 && this.socket && this.sessionCode) {
          log('[NETWORK]', 'Forcing socket reconnect after extended sleep');
          this.socket.disconnect();
          // Wait 500ms for server's disconnect handler to complete before reconnecting
          // This avoids race condition between disconnect (suspends game) and rejoin
          setTimeout(() => {
            log('[NETWORK]', 'Reconnecting after delay');
            this.socket.connect();
          }, 500);
        }
      } else {
        this.lastVisibleTime = Date.now();
        log('[NETWORK]', 'Page hidden');
      }
    });
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io({
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        log('[NETWORK]', 'Connected to server');
        const wasConnected = this.connected;
        this.connected = true;

        // If this is a reconnection (not initial connect) and we have an active session,
        // automatically try to rejoin the game
        if (wasConnected === false && this.sessionCode) {
          log('[REJOIN]', 'Socket reconnected while in game, attempting auto-rejoin');
          this.rejoinGame(this.sessionCode, this.nickname);
        }

        resolve();
      });

      this.socket.on('connect_error', (error) => {
        log('[NETWORK]', 'Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        log('[NETWORK]', 'Disconnected from server');
        this.connected = false;
      });

      // Setup event forwarding
      this.setupEventForwarding();
    });
  }

  setupEventForwarding() {
    const events = Object.values(SOCKET_EVENTS);

    events.forEach(event => {
      this.socket.on(event, (data) => {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      });
    });
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }

  // Game actions
  createGame(nickname, isPrivate, mazeSize) {
    this.nickname = nickname;
    this.isHost = true;
    this.emit(SOCKET_EVENTS.CREATE_GAME, { nickname, isPrivate, mazeSize });
  }

  joinGame(sessionCode, nickname) {
    this.nickname = nickname;
    this.sessionCode = sessionCode;
    this.emit(SOCKET_EVENTS.JOIN_GAME, { sessionCode, nickname });
  }

  browseGames() {
    this.emit(SOCKET_EVENTS.BROWSE_GAMES, {});
  }

  startGame() {
    this.emit(SOCKET_EVENTS.START_GAME, {});
  }

  placeTower(type, gridX, gridY) {
    this.emit(SOCKET_EVENTS.PLACE_TOWER, { type, gridX, gridY });
  }

  upgradeTower(towerId) {
    this.emit(SOCKET_EVENTS.UPGRADE_TOWER, { towerId });
  }

  sellTower(towerId) {
    this.emit(SOCKET_EVENTS.SELL_TOWER, { towerId });
  }

  pauseGame() {
    this.emit(SOCKET_EVENTS.PAUSE_GAME, {});
  }

  resumeGame() {
    log('[NETWORK]', 'Sending RESUME_GAME, connected:', this.connected);
    this.emit(SOCKET_EVENTS.RESUME_GAME, {});
  }

  changeGameSpeed(speed) {
    this.emit(SOCKET_EVENTS.CHANGE_SPEED, { speed });
  }

  saveGame() {
    this.emit(SOCKET_EVENTS.SAVE_GAME, {});
  }

  leaveLobby() {
    this.emit(SOCKET_EVENTS.LEAVE_LOBBY, {});
    this.sessionCode = null;
    this.isHost = false;
  }

  leaveGame() {
    this.emit(SOCKET_EVENTS.LEAVE_GAME, {});
    this.sessionCode = null;
    this.isHost = false;
  }

  sendChatMessage(message) {
    this.emit(SOCKET_EVENTS.CHAT_MESSAGE, { message });
  }

  initiateKick(targetNickname) {
    this.emit(SOCKET_EVENTS.INITIATE_KICK, { targetNickname });
  }

  castKickVote(targetNickname, vote) {
    this.emit(SOCKET_EVENTS.CAST_KICK_VOTE, { targetNickname, vote });
  }

  // Session recovery after standby
  rejoinGame(sessionCode, nickname) {
    log('[REJOIN]', 'Attempting to rejoin session:', sessionCode);
    this.nickname = nickname;
    this.sessionCode = sessionCode;
    // Include page visibility so server can auto-pause if reconnecting during sleep
    const pageHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    this.emit(SOCKET_EVENTS.REJOIN_GAME, { sessionCode, nickname, pageHidden });
  }

  // Check localStorage and attempt rejoin if session exists
  checkAndRejoinSession() {
    const savedSession = localStorage.getItem('activeGameSession');
    if (!savedSession) {
      return null;
    }

    try {
      const session = JSON.parse(savedSession);
      if (session.sessionCode && session.nickname) {
        return session;
      }
    } catch {
      log('[REJOIN]', 'Invalid session data, clearing');
      localStorage.removeItem('activeGameSession');
    }
    return null;
  }

  clearSavedSession() {
    localStorage.removeItem('activeGameSession');
    log('[REJOIN]', 'Cleared saved session');
  }
}

// Global instance
const networkManager = new NetworkManager();

// Make available globally (for dev script tag usage)
if (typeof window !== 'undefined') {
  window.networkManager = networkManager;
}

// ES module export
export { networkManager };
