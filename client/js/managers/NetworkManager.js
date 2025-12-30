class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.sessionCode = null;
    this.nickname = null;
    this.isHost = false;
    this.eventHandlers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io({
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.connected = true;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
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
    this.emit(SOCKET_EVENTS.RESUME_GAME, {});
  }

  saveGame() {
    this.emit(SOCKET_EVENTS.SAVE_GAME, {});
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
}

// Global instance
const networkManager = new NetworkManager();
