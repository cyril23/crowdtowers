import { SOCKET_EVENTS, HOTKEYS } from '../../../shared/constants.js';
import { DeviceUtils } from '../config.js';
import { networkManager } from '../managers/NetworkManager.js';
import { settingsManager, isInputFocused, formatWithHotkey } from '../managers/SettingsManager.js';
import { ChatPanel } from '../ui/ChatPanel.js';
import { PlayerPanel } from '../ui/PlayerPanel.js';
import { GameMenuManager } from '../ui/GameMenuManager.js';

class LobbyScene extends Phaser.Scene {
  // Design size for lobby UI
  static DESIGN_WIDTH = 400;
  static DESIGN_HEIGHT = 600;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data) {
    this.sessionCode = data.sessionCode;
    this.inviteLink = data.inviteLink;
    this.maze = data.maze;
    this.players = data.players || [];
    this.isHost = data.isHost;

    // DON'T reset networkHandlers here! If we reset it, we lose the ability
    // to clean up handlers from previous runs if shutdown() wasn't called.
    // Only initialize if it doesn't exist yet.
    if (!this.networkHandlers) {
      this.networkHandlers = [];
    }
  }

  // Helper to register network handlers and track them for cleanup
  registerNetworkHandler(event, handler) {
    networkManager.on(event, handler);
    this.networkHandlers.push({ event, handler });
  }

  create() {
    // Setup camera for responsive layout
    this.setupMenuCamera();

    // All positions use DESIGN coordinates (400x600)
    const centerX = LobbyScene.DESIGN_WIDTH / 2;

    // Title
    this.add.text(centerX, 30, 'Game Lobby', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Session code display
    this.add.text(centerX, 80, 'Session Code:', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(centerX, 110, this.sessionCode, {
      fontSize: '36px',
      color: '#ffff00',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Copy code button
    this.add.text(centerX + 80, 110, 'Copy', {
      fontSize: '14px',
      color: '#4a4a8a',
      fontFamily: 'Arial'
    })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        navigator.clipboard.writeText(this.sessionCode);
        this.showNotification('Code copied!');
      });

    // Invite link
    if (this.inviteLink) {
      this.add.text(centerX, 150, 'Share invite link:', {
        fontSize: '14px',
        color: '#aaaaaa',
        fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(centerX, 170, 'Copy Link', {
        fontSize: '14px',
        color: '#4a4a8a',
        fontFamily: 'Arial',
        textDecoration: 'underline'
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          navigator.clipboard.writeText(this.inviteLink);
          this.showNotification('Link copied!');
        });
    }

    // Player panel (top-right) - visible by default
    this.playerPanel = new PlayerPanel();
    this.playerPanel.setLocalNickname(networkManager.nickname);
    this.playerPanel.setPlayers(this.players);
    this.playerPanel.show();

    // Start button (host only)
    if (this.isHost) {
      this.startButton = this.add.text(centerX, 450, formatWithHotkey('START GAME', HOTKEYS.START), {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: '#228822',
        padding: { x: 30, y: 15 }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.startButton.setStyle({ backgroundColor: '#33aa33' });
        })
        .on('pointerout', () => {
          this.startButton.setStyle({ backgroundColor: '#228822' });
        })
        .on('pointerdown', () => {
          networkManager.startGame();
        });
    } else {
      this.add.text(centerX, 450, 'Waiting for host to start...', {
        fontSize: '18px',
        color: '#aaaaaa',
        fontFamily: 'Arial'
      }).setOrigin(0.5);
    }

    // Quit button
    this.leaveBtn = this.add.text(centerX, 520, formatWithHotkey('Quit Lobby', HOTKEYS.QUIT), {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#aa4444',
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.leaveBtn.setStyle({ backgroundColor: '#cc5555' });
      })
      .on('pointerout', () => {
        this.leaveBtn.setStyle({ backgroundColor: '#aa4444' });
      })
      .on('pointerdown', () => {
        networkManager.leaveLobby();
        this.chatPanel.setLobbyMode(false);
        this.chatPanel.hide();
        this.scene.start('MenuScene');
      });

    // Notification area
    this.notification = this.add.text(centerX, 560, '', {
      fontSize: '14px',
      color: '#44ff44',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Show chat panel - clear old messages when entering a new lobby
    if (!this.chatPanel) {
      this.chatPanel = new ChatPanel();
    }
    this.chatPanel.clear();
    this.chatPanel.setLobbyMode(true);

    // On mobile, hide chat by default
    if (DeviceUtils.isMobile()) {
      this.chatPanel.hide();
    } else {
      this.chatPanel.show();
    }

    // Setup global menu with volume controls, code, chat toggle, player toggle, and quit
    this.gameMenu = new GameMenuManager();
    this.gameMenu.configure({
      showSessionCode: true,
      sessionCode: this.sessionCode,
      chatToggle: {
        visible: this.chatPanel.isVisible,
        onChange: (isVisible) => {
          if (isVisible) {
            this.chatPanel.show();
          } else {
            this.chatPanel.hide();
          }
        }
      },
      playerToggle: {
        visible: this.playerPanel.isVisible,
        onChange: (isVisible) => {
          if (isVisible) {
            this.playerPanel.show();
          } else {
            this.playerPanel.hide();
          }
        }
      },
      buttons: [
        {
          id: 'quit',
          label: 'Quit Lobby',
          hotkey: HOTKEYS.QUIT,
          danger: true,
          onClick: () => {
            this.handleQuitLobby();
          }
        }
      ],
      position: 'top-right'
    });
    this.gameMenu.show();

    // Setup keyboard shortcuts (desktop only)
    this.setupKeyboardShortcuts();

    // Track unread messages - update menu badge
    this.chatPanel.onUnreadChange = (count) => {
      this.gameMenu.setUnreadCount(count);
    };

    // Listen for resize to rebuild layout
    this.scale.on('resize', this.onResize, this);

    // Setup network listeners
    this.setupNetworkListeners();
  }

  // Setup camera to zoom/center the design space within the canvas
  setupMenuCamera() {
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;

    const scaleX = canvasWidth / LobbyScene.DESIGN_WIDTH;
    const scaleY = canvasHeight / LobbyScene.DESIGN_HEIGHT;
    const zoom = Math.min(scaleX, scaleY, 1.5);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(LobbyScene.DESIGN_WIDTH / 2, LobbyScene.DESIGN_HEIGHT / 2);
  }

  onResize() {
    // CRITICAL: Remove listener before restart to prevent handler accumulation
    this.scale.off('resize', this.onResize, this);

    if (!this.scene.isActive()) {
      return;
    }

    // Preserve state for restart
    this.scene.restart({
      sessionCode: this.sessionCode,
      inviteLink: this.inviteLink,
      maze: this.maze,
      players: this.players,
      isHost: this.isHost
    });
  }

  setupNetworkListeners() {
    // Clean up any existing handlers FIRST to prevent accumulation
    // This is defensive against create() being called multiple times
    if (this.networkHandlers && this.networkHandlers.length > 0) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }

    this.registerNetworkHandler(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      this.players.push({ nickname: data.nickname, isHost: false });
      this.playerPanel.addPlayer({ nickname: data.nickname, isHost: false });
    });

    this.registerNetworkHandler(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
      this.players = this.players.filter(p => p.nickname !== data.nickname);
      this.playerPanel.removePlayer(data.nickname);
    });

    this.registerNetworkHandler(SOCKET_EVENTS.GAME_STARTED, (data) => {
      this.chatPanel.setLobbyMode(false);
      this.chatPanel.hide();
      this.scene.start('GameScene', {
        sessionCode: this.sessionCode,
        maze: data.maze,
        gameState: data.gameState,
        players: this.players  // Pass player list to GameScene
      });
    });

    this.registerNetworkHandler(SOCKET_EVENTS.LOBBY_CLOSED, (data) => {
      this.chatPanel.setLobbyMode(false);
      this.chatPanel.hide();
      this.scene.start('MenuScene', { toast: data.reason || 'Lobby was closed', toastDuration: 4000 });
    });
  }

  showNotification(message) {
    this.notification.setText(message);
    this.time.delayedCall(2000, () => {
      this.notification.setText('');
    });
  }

  setupKeyboardShortcuts() {
    const isMobile = DeviceUtils.isMobile();
    if (isMobile) return;

    // Start game (S) - host only
    this.input.keyboard.on(HOTKEYS.START, () => {
      if (isInputFocused()) return;
      if (this.isHost) {
        networkManager.startGame();
      }
    });

    this.input.keyboard.on(HOTKEYS.CHAT, () => {
      if (isInputFocused()) return;
      this.chatPanel.toggle();
      // Sync checkbox state with chat panel visibility
      this.gameMenu.setChatToggleState(this.chatPanel.isVisible);
      if (this.chatPanel.isVisible) {
        this.gameMenu.clearUnread();
      }
    });

    this.input.keyboard.on(HOTKEYS.PLAYERS, () => {
      if (isInputFocused()) return;
      this.playerPanel.toggle();
      // Sync checkbox state with player panel visibility
      this.gameMenu.setPlayerToggleState(this.playerPanel.isVisible);
    });

    this.input.keyboard.on(HOTKEYS.QUIT, () => {
      if (isInputFocused()) return;
      this.handleQuitLobby();
    });

    this.input.keyboard.on(HOTKEYS.TOGGLE_HOTKEYS, () => {
      if (isInputFocused()) return;
      settingsManager.toggleShowHotkeys();
    });

    this.input.keyboard.on(HOTKEYS.MENU, () => {
      if (isInputFocused()) return;
      this.gameMenu.toggle();
    });
  }

  handleQuitLobby() {
    networkManager.leaveLobby();
    this.chatPanel.setLobbyMode(false);
    this.chatPanel.hide();
    this.scene.start('MenuScene');
  }

  shutdown() {
    // Clean up resize listener
    this.scale.off('resize', this.onResize, this);

    // Clean up network handlers to prevent accumulation
    if (this.networkHandlers) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }
  }
}

// ES module export
export { LobbyScene };
