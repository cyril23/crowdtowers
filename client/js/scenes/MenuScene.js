class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Title
    this.add.text(centerX, 60, 'ALIEN INVASION', {
      fontSize: '42px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(centerX, 100, 'Tower Defense', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Nickname input
    this.add.text(centerX, 160, 'Your Nickname:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Create HTML input for nickname
    this.nicknameInput = this.createInput(centerX - 100, 180, 200, 'Enter nickname...');

    // Create Game button
    this.createButton(centerX, 260, 'Create New Game', () => {
      this.showCreateGameMenu();
    });

    // Join by Code button
    this.createButton(centerX, 320, 'Join by Code', () => {
      this.showJoinMenu();
    });

    // Browse Games button
    this.createButton(centerX, 380, 'Browse Open Games', () => {
      this.showBrowseMenu();
    });

    // Error message area
    this.errorText = this.add.text(centerX, 450, '', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Setup network listeners
    this.setupNetworkListeners();

    // Check for pending join code
    const pendingCode = this.registry.get('pendingJoinCode');
    if (pendingCode) {
      this.registry.remove('pendingJoinCode');
      this.showJoinMenu(pendingCode);
    }
  }

  createInput(x, y, width, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = 20;
    input.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      padding: 8px;
      font-size: 16px;
      border: 2px solid #4a4a8a;
      border-radius: 4px;
      background: #1a1a2e;
      color: white;
      text-align: center;
    `;
    document.getElementById('game-container').appendChild(input);
    return input;
  }

  createButton(x, y, text, callback) {
    const button = this.add.text(x, y, text, {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#4a4a8a',
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: '#6a6aaa' });
    });

    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: '#4a4a8a' });
    });

    button.on('pointerdown', callback);

    return button;
  }

  showCreateGameMenu() {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname) {
      this.showError('Please enter a nickname');
      return;
    }

    // Clear scene and show create game options
    this.scene.start('CreateGameScene', { nickname });
  }

  showJoinMenu(prefillCode = '') {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname) {
      this.showError('Please enter a nickname');
      return;
    }

    // Clear and show join menu
    this.clearMenu();

    this.add.text(this.cameras.main.centerX, 160, 'Enter Session Code:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.codeInput = this.createInput(
      this.cameras.main.centerX - 75,
      180,
      150,
      'ABC123'
    );
    this.codeInput.value = prefillCode;
    this.codeInput.maxLength = 6;
    this.codeInput.style.textTransform = 'uppercase';

    this.createButton(this.cameras.main.centerX, 260, 'Join Game', () => {
      const code = this.codeInput.value.trim().toUpperCase();
      if (code.length !== 6) {
        this.showError('Session code must be 6 characters');
        return;
      }
      networkManager.joinGame(code, nickname);
    });

    this.createButton(this.cameras.main.centerX, 320, 'Back', () => {
      this.scene.restart();
    });
  }

  showBrowseMenu() {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname) {
      this.showError('Please enter a nickname');
      return;
    }

    this.registry.set('nickname', nickname);
    this.scene.start('BrowseScene', { nickname });
  }

  clearMenu() {
    // Remove HTML elements
    if (this.nicknameInput) {
      this.nicknameInput.remove();
    }
    if (this.codeInput) {
      this.codeInput.remove();
    }

    // Clear Phaser objects
    this.children.removeAll();
  }

  setupNetworkListeners() {
    networkManager.on(SOCKET_EVENTS.GAME_CREATED, (data) => {
      this.clearMenu();
      this.scene.start('LobbyScene', {
        sessionCode: data.sessionCode,
        inviteLink: data.inviteLink,
        maze: data.maze,
        players: data.players,
        isHost: true
      });
    });

    networkManager.on(SOCKET_EVENTS.JOIN_SUCCESS, (data) => {
      this.clearMenu();
      if (data.status === GAME_STATUS.LOBBY) {
        this.scene.start('LobbyScene', {
          sessionCode: data.sessionCode,
          maze: data.maze,
          players: data.players,
          isHost: false
        });
      } else {
        // Join game in progress
        this.scene.start('GameScene', {
          sessionCode: data.sessionCode,
          maze: data.maze,
          gameState: data.gameState,
          status: data.status
        });
      }
    });

    networkManager.on(SOCKET_EVENTS.JOIN_ERROR, (data) => {
      this.showError(data.message);
    });
  }

  showError(message) {
    this.errorText.setText(message);
    this.time.delayedCall(3000, () => {
      this.errorText.setText('');
    });
  }

  shutdown() {
    this.clearMenu();
  }
}

// Create Game Scene
class CreateGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CreateGameScene' });
  }

  init(data) {
    this.nickname = data.nickname;
  }

  create() {
    const centerX = this.cameras.main.centerX;

    this.add.text(centerX, 60, 'Create New Game', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Maze Size selection
    this.add.text(centerX, 130, 'Select Maze Size:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.selectedSize = 'medium';
    this.sizeButtons = {};

    ['small', 'medium', 'large'].forEach((size, index) => {
      const config = MAZE_SIZES[size];
      const y = 170 + index * 50;

      const btn = this.add.text(centerX, y, `${size.toUpperCase()} (${config.grid}x${config.grid})`, {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: size === 'medium' ? '#6a6aaa' : '#4a4a8a',
        padding: { x: 15, y: 8 }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectSize(size);
      });

      this.sizeButtons[size] = btn;
    });

    // Privacy selection
    this.add.text(centerX, 340, 'Game Privacy:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.isPrivate = true;
    this.privacyButtons = {};

    [
      { key: 'private', label: 'Private (Code Only)' },
      { key: 'public', label: 'Open (Browsable)' }
    ].forEach((option, index) => {
      const y = 380 + index * 50;

      const btn = this.add.text(centerX, y, option.label, {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: option.key === 'private' ? '#6a6aaa' : '#4a4a8a',
        padding: { x: 15, y: 8 }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectPrivacy(option.key === 'private');
      });

      this.privacyButtons[option.key] = btn;
    });

    // Create button
    this.add.text(centerX, 500, 'CREATE GAME', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#228822',
      padding: { x: 30, y: 15 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        networkManager.createGame(this.nickname, this.isPrivate, this.selectedSize);
      });

    // Back button
    this.add.text(centerX, 560, 'Back', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });

    // Setup network listeners
    networkManager.on(SOCKET_EVENTS.GAME_CREATED, (data) => {
      this.scene.start('LobbyScene', {
        sessionCode: data.sessionCode,
        inviteLink: data.inviteLink,
        maze: data.maze,
        players: data.players,
        isHost: true
      });
    });
  }

  selectSize(size) {
    this.selectedSize = size;
    Object.entries(this.sizeButtons).forEach(([key, btn]) => {
      btn.setStyle({ backgroundColor: key === size ? '#6a6aaa' : '#4a4a8a' });
    });
  }

  selectPrivacy(isPrivate) {
    this.isPrivate = isPrivate;
    this.privacyButtons.private.setStyle({
      backgroundColor: isPrivate ? '#6a6aaa' : '#4a4a8a'
    });
    this.privacyButtons.public.setStyle({
      backgroundColor: !isPrivate ? '#6a6aaa' : '#4a4a8a'
    });
  }
}

// Browse Games Scene
class BrowseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BrowseScene' });
  }

  init(data) {
    this.nickname = data.nickname;
  }

  create() {
    const centerX = this.cameras.main.centerX;

    this.add.text(centerX, 40, 'Open Games', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.loadingText = this.add.text(centerX, 200, 'Loading...', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.gamesList = [];
    this.listY = 100;

    // Back button
    this.add.text(centerX, 550, 'Back', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });

    // Refresh button
    this.add.text(centerX + 100, 40, 'Refresh', {
      fontSize: '16px',
      color: '#4a4a8a',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.refreshList();
      });

    // Setup listeners
    networkManager.on(SOCKET_EVENTS.OPEN_GAMES_LIST, (games) => {
      this.displayGames(games);
    });

    networkManager.on(SOCKET_EVENTS.JOIN_SUCCESS, (data) => {
      if (data.status === GAME_STATUS.LOBBY) {
        this.scene.start('LobbyScene', {
          sessionCode: data.sessionCode,
          maze: data.maze,
          players: data.players,
          isHost: false
        });
      } else {
        this.scene.start('GameScene', {
          sessionCode: data.sessionCode,
          maze: data.maze,
          gameState: data.gameState,
          status: data.status
        });
      }
    });

    // Request games list
    this.refreshList();
  }

  refreshList() {
    this.loadingText.setVisible(true);
    this.gamesList.forEach(item => item.destroy());
    this.gamesList = [];
    networkManager.browseGames();
  }

  displayGames(games) {
    this.loadingText.setVisible(false);

    if (games.length === 0) {
      this.loadingText.setText('No open games available');
      this.loadingText.setVisible(true);
      return;
    }

    games.forEach((game, index) => {
      const y = 100 + index * 60;

      const container = this.add.container(this.cameras.main.centerX, y);

      const bg = this.add.rectangle(0, 0, 400, 50, 0x2a2a4e)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(-180, -15, `${game.hostNickname}'s Game`, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Arial'
      });

      const info = this.add.text(-180, 5, `${game.mazeSize} | ${game.playerCount}/${game.maxPlayers} players | ${game.status}`, {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'Arial'
      });

      const joinBtn = this.add.text(150, 0, 'JOIN', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: '#228822',
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5);

      container.add([bg, text, info, joinBtn]);

      bg.on('pointerdown', () => {
        networkManager.joinGame(game.sessionCode, this.nickname);
      });

      this.gamesList.push(container);
    });
  }
}
