class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data) {
    this.sessionCode = data.sessionCode;
    this.inviteLink = data.inviteLink;
    this.maze = data.maze;
    this.players = data.players || [];
    this.isHost = data.isHost;
  }

  create() {
    const centerX = this.cameras.main.centerX;

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

    const codeText = this.add.text(centerX, 110, this.sessionCode, {
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

    // Players list
    this.add.text(centerX, 210, 'Players:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.playerListContainer = this.add.container(centerX, 240);
    this.updatePlayerList();

    // Start button (host only)
    if (this.isHost) {
      this.startButton = this.add.text(centerX, 450, 'START GAME', {
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

    // Leave button
    this.add.text(centerX, 520, 'Leave Lobby', {
      fontSize: '16px',
      color: '#aa4444',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.reload();
      });

    // Notification area
    this.notification = this.add.text(centerX, 560, '', {
      fontSize: '14px',
      color: '#44ff44',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Show chat panel
    if (!this.chatPanel) {
      this.chatPanel = new ChatPanel();
    }
    this.chatPanel.show();

    // Setup network listeners
    this.setupNetworkListeners();
  }

  updatePlayerList() {
    this.playerListContainer.removeAll(true);

    this.players.forEach((player, index) => {
      const y = index * 30;
      const hostBadge = player.isHost ? ' (Host)' : '';
      const isMe = player.nickname === networkManager.nickname;

      const text = this.add.text(0, y, `${player.nickname}${hostBadge}`, {
        fontSize: '16px',
        color: isMe ? '#44ff44' : '#ffffff',
        fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.playerListContainer.add(text);
    });
  }

  setupNetworkListeners() {
    networkManager.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      this.players.push({ nickname: data.nickname, isHost: false });
      this.updatePlayerList();
    });

    networkManager.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
      this.players = this.players.filter(p => p.nickname !== data.nickname);
      this.updatePlayerList();
    });

    networkManager.on(SOCKET_EVENTS.GAME_STARTED, (data) => {
      this.chatPanel.hide();
      this.scene.start('GameScene', {
        sessionCode: this.sessionCode,
        maze: data.maze,
        gameState: data.gameState
      });
    });
  }

  showNotification(message) {
    this.notification.setText(message);
    this.time.delayedCall(2000, () => {
      this.notification.setText('');
    });
  }

  shutdown() {
    // Cleanup if needed
  }
}
