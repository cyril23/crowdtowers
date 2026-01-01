// ============================================
// BACKGROUND SCENE - Persistent animated background for menu screens
// ============================================
class BackgroundScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BackgroundScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = this.cameras.main.centerX;

    this.stars = [];
    this.ufos = [];

    this.createStarfield(width, height);
    this.createUfos(width, height);
    this.createMothership(centerX);
  }

  // ============================================
  // STARFIELD - Warp speed effect (stars fly toward viewer)
  // ============================================
  createStarfield(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const starCount = 100;

    for (let i = 0; i < starCount; i++) {
      const star = this.add.circle(0, 0, 1, 0xffffff, 0.8);
      star.setDepth(-10);

      // Store star properties for warp effect
      star.angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      star.dist = Phaser.Math.FloatBetween(0, Math.max(width, height) * 0.6);
      star.speed = Phaser.Math.FloatBetween(0.15, 0.5);
      star.centerX = centerX;
      star.centerY = centerY;

      // Position star based on angle and distance
      star.x = centerX + Math.cos(star.angle) * star.dist;
      star.y = centerY + Math.sin(star.angle) * star.dist;

      this.stars.push(star);
    }
  }

  resetStar(star, width, height) {
    // Reset to center
    star.angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    star.dist = 0;
    star.speed = Phaser.Math.FloatBetween(0.15, 0.5);
    star.x = star.centerX;
    star.y = star.centerY;

    // Immediately set scale/alpha to prevent flash at center
    star.setScale(0.2);
    star.setAlpha(0.3);
  }

  // ============================================
  // UFOS - Flying toward viewer (incoming invasion)
  // ============================================
  createUfos(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;

    // Create 3 UFOs with staggered spawn times
    for (let i = 0; i < 3; i++) {
      const ufo = this.createUfoGraphic();
      ufo.setDepth(-5);
      ufo.centerX = centerX;
      ufo.centerY = centerY;

      // Initialize UFO position (will be set by resetUfo)
      this.resetUfo(ufo, width, height, i * 2000); // Stagger initial distances

      this.ufos.push(ufo);
    }
  }

  resetUfo(ufo, width, height, initialDist = null) {
    const maxDist = Math.max(width, height) * 0.7;

    // Random angle, start from center
    ufo.angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    ufo.dist = initialDist !== null ? initialDist : 0;
    ufo.speed = Phaser.Math.FloatBetween(0.3, 0.6);
    ufo.maxDist = maxDist;

    // Update position
    ufo.x = ufo.centerX + Math.cos(ufo.angle) * ufo.dist;
    ufo.y = ufo.centerY + Math.sin(ufo.angle) * ufo.dist;

    // Immediately set scale/alpha to prevent flash at center
    const progress = ufo.dist / ufo.maxDist;
    ufo.setScale(0.1 + progress * 1.2);
    ufo.setAlpha(Math.min(0.7, 0.1 + progress * 1.2));
  }

  createUfoGraphic() {
    const graphics = this.add.graphics();

    // Draw at base size (will be scaled dynamically)
    // UFO body (ellipse)
    graphics.fillStyle(0x2a2a5e, 1);
    graphics.fillEllipse(0, 0, 50, 18);

    // UFO dome
    graphics.fillStyle(0x3a3a7e, 1);
    graphics.fillEllipse(0, -7, 25, 10);

    // Lights
    graphics.fillStyle(0x66ff66, 0.8);
    for (let i = 0; i < 5; i++) {
      const lx = (i - 2) * 10;
      graphics.fillCircle(lx, 4, 2.5);
    }

    // Engine glow
    graphics.fillStyle(0x44ffaa, 0.4);
    graphics.fillEllipse(0, 10, 30, 6);

    return graphics;
  }

  // ============================================
  // MOTHERSHIP - Large hovering ship behind title
  // ============================================
  createMothership(centerX) {
    this.mothership = this.add.graphics();
    const shipWidth = 200;
    const shipHeight = 40;
    const shipY = 60;

    // Glow effect (outer)
    this.mothership.fillStyle(0x4444aa, 0.15);
    this.mothership.fillEllipse(centerX, shipY, shipWidth + 60, shipHeight + 40);

    // Main body
    this.mothership.fillStyle(0x1a1a3e, 0.8);
    this.mothership.fillEllipse(centerX, shipY, shipWidth, shipHeight);

    // Upper dome
    this.mothership.fillStyle(0x2a2a5e, 0.9);
    this.mothership.fillEllipse(centerX, shipY - 15, shipWidth * 0.4, shipHeight * 0.5);

    // Lights strip
    this.mothership.fillStyle(0x44ff88, 0.5);
    for (let i = 0; i < 7; i++) {
      const lx = centerX + (i - 3) * 25;
      this.mothership.fillCircle(lx, shipY + 5, 4);
    }

    this.mothership.setDepth(-8);

    // Hover animation
    this.tweens.add({
      targets: this.mothership,
      y: 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Pulsing glow (redraw with varying alpha)
    this.mothershipGlow = this.add.ellipse(centerX, shipY, shipWidth + 80, shipHeight + 50, 0x4444ff, 0.1);
    this.mothershipGlow.setDepth(-9);

    this.tweens.add({
      targets: this.mothershipGlow,
      alpha: 0.25,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ============================================
  // UPDATE LOOP - Animate moving elements
  // ============================================
  update(time, delta) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Update stars (warp speed - fly outward from center)
    const maxDist = Math.max(width, height) * 0.8;

    this.stars.forEach(star => {
      // Gentler acceleration to match UFO pacing
      const acceleration = 1 + (star.dist / maxDist) * 1.5;
      star.dist += star.speed * acceleration;

      // Update position based on angle and new distance
      star.x = star.centerX + Math.cos(star.angle) * star.dist;
      star.y = star.centerY + Math.sin(star.angle) * star.dist;

      // Scale size based on distance (stars get bigger as they approach)
      const progress = star.dist / maxDist;
      const scale = 0.2 + progress * 2.5;
      star.setScale(scale);

      // Brightness increases with distance
      const alpha = Math.min(1, 0.3 + progress * 0.7);
      star.setAlpha(alpha);

      // Reset star when it exits screen bounds
      if (star.x < -20 || star.x > width + 20 || star.y < -20 || star.y > height + 20) {
        this.resetStar(star, width, height);
      }
    });

    // Update UFOs (fly toward viewer - incoming invasion)
    this.ufos.forEach(ufo => {
      // Accelerate as UFO gets closer (like stars)
      const acceleration = 1 + (ufo.dist / ufo.maxDist) * 2;
      ufo.dist += ufo.speed * acceleration;

      // Update position
      ufo.x = ufo.centerX + Math.cos(ufo.angle) * ufo.dist;
      ufo.y = ufo.centerY + Math.sin(ufo.angle) * ufo.dist;

      // Scale and fade based on distance
      const progress = ufo.dist / ufo.maxDist;
      const scale = 0.1 + progress * 1.2;
      ufo.setScale(scale);
      ufo.setAlpha(Math.min(0.7, 0.1 + progress * 1.2));

      // Reset when off screen
      if (ufo.x < -60 || ufo.x > width + 60 || ufo.y < -60 || ufo.y > height + 60) {
        this.resetUfo(ufo, width, height);
      }
    });
  }
}

// ============================================
// MENU SCENE - Main menu UI (overlay on BackgroundScene)
// ============================================
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  init() {
    // DON'T reset networkHandlers here! Only initialize if it doesn't exist.
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
    const centerX = this.cameras.main.centerX;

    // Launch background scene if not already running
    if (!this.scene.isActive('BackgroundScene')) {
      this.scene.launch('BackgroundScene');
      this.scene.sendToBack('BackgroundScene');
    }

    // Make this scene's background transparent
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Initialize HTML input tracking
    this.htmlInputs = [];

    // Title
    this.createTitle(centerX);

    // Name input (centered layout)
    const inputY = 180;
    this.add.text(centerX - 110, inputY + 8, 'Your Name:', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(1, 0.5);

    this.nicknameInput = this.createInput(centerX - 100, inputY, 200, 'Enter name...');

    // Load saved nickname from localStorage
    const savedName = localStorage.getItem('playerNickname');
    if (savedName) {
      this.nicknameInput.value = savedName;
    }

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

    // Handle window resize for HTML inputs
    this.scale.on('resize', this.repositionAllInputs, this);

    // Check for pending join code
    const pendingCode = this.registry.get('pendingJoinCode');
    if (pendingCode) {
      this.registry.remove('pendingJoinCode');
      this.showJoinMenu(pendingCode);
    }

    // Check for toast message (e.g., from lobby close)
    const toastMsg = this.scene.settings.data?.toast;
    if (toastMsg) {
      const duration = this.scene.settings.data?.toastDuration;
      this.showToast(toastMsg, duration);
    }
  }

  showToast(message, duration = 2000) {
    const toast = this.add.text(this.cameras.main.centerX, 500, message, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#aa4444',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 480,
      delay: duration,
      duration: 500,
      onComplete: () => toast.destroy()
    });
  }

  // ============================================
  // TITLE
  // ============================================
  createTitle(centerX) {
    // Main title
    this.add.text(centerX, 60, 'ALIEN INVASION', {
      fontSize: '42px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1);

    // Subtitle with subtle pulse
    const subtitle = this.add.text(centerX, 105, 'Tower Defense', {
      fontSize: '24px',
      color: '#8888aa',
      fontFamily: 'Arial'
    }).setOrigin(0.5).setDepth(1);

    this.tweens.add({
      targets: subtitle,
      alpha: 0.6,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ============================================
  // RESPONSIVE INPUT POSITIONING
  // ============================================
  createInput(x, y, width, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = 20;

    // Store original game coordinates for repositioning
    input.dataset.gameX = x;
    input.dataset.gameY = y;
    input.dataset.gameWidth = width;

    // Apply base styles
    input.style.cssText = `
      padding: 8px;
      font-size: 16px;
      border: 2px solid #4a4a8a;
      border-radius: 4px;
      background: #1a1a2e;
      color: white;
      text-align: center;
    `;

    // Position based on canvas scale
    this.positionInput(input);

    document.getElementById('game-container').appendChild(input);

    // Track for resize handling
    this.htmlInputs.push(input);

    return input;
  }

  positionInput(input) {
    const canvas = this.game.canvas;
    const container = document.getElementById('game-container');

    // Get canvas position within container
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate scale factor
    const scaleX = canvas.clientWidth / this.game.config.width;
    const scaleY = canvas.clientHeight / this.game.config.height;

    // Calculate offset from container to canvas
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // Get stored game coordinates
    const gameX = parseFloat(input.dataset.gameX);
    const gameY = parseFloat(input.dataset.gameY);
    const gameWidth = parseFloat(input.dataset.gameWidth);

    // Apply scaled position
    input.style.position = 'absolute';
    input.style.left = `${offsetX + (gameX * scaleX)}px`;
    input.style.top = `${offsetY + (gameY * scaleY)}px`;
    input.style.width = `${gameWidth * scaleX}px`;
    input.style.fontSize = `${16 * Math.min(scaleX, scaleY)}px`;
  }

  repositionAllInputs() {
    if (this.htmlInputs) {
      this.htmlInputs.forEach(input => {
        if (input.parentNode) {
          this.positionInput(input);
        }
      });
    }
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
      this.showError('Please enter a name');
      return;
    }

    // Save nickname to localStorage
    localStorage.setItem('playerNickname', nickname);

    // Clean up and switch to CreateGameScene (overlay)
    this.clearMenuUI();
    this.scene.stop('MenuScene');
    this.scene.launch('CreateGameScene', { nickname });
  }

  showJoinMenu(prefillCode = '') {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname) {
      this.showError('Please enter a name');
      return;
    }

    // Save nickname to localStorage
    localStorage.setItem('playerNickname', nickname);

    // Store nickname and clear UI
    const savedNickname = nickname;
    this.clearMenuUI();

    // Clear only Phaser UI objects (not the background scene)
    this.children.removeAll();

    // Reset inputs array
    this.htmlInputs = [];

    // Rebuild join menu UI
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

    // Error text
    this.errorText = this.add.text(this.cameras.main.centerX, 450, '', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.createButton(this.cameras.main.centerX, 260, 'Join Game', () => {
      const code = this.codeInput.value.trim().toUpperCase();
      if (code.length !== 6) {
        this.showError('Session code must be 6 characters');
        return;
      }
      networkManager.joinGame(code, savedNickname);
    });

    this.createButton(this.cameras.main.centerX, 320, 'Back', () => {
      this.clearMenuUI();
      this.scene.restart();
    });
  }

  showBrowseMenu() {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname) {
      this.showError('Please enter a name');
      return;
    }

    // Save nickname to localStorage
    localStorage.setItem('playerNickname', nickname);

    this.registry.set('nickname', nickname);
    this.clearMenuUI();
    this.scene.stop('MenuScene');
    this.scene.launch('BrowseScene', { nickname });
  }

  clearMenuUI() {
    // Remove HTML elements only
    if (this.nicknameInput) {
      this.nicknameInput.remove();
      this.nicknameInput = null;
    }
    if (this.codeInput) {
      this.codeInput.remove();
      this.codeInput = null;
    }
    // Clear the tracking array
    if (this.htmlInputs) {
      this.htmlInputs.forEach(input => {
        if (input.parentNode) {
          input.remove();
        }
      });
      this.htmlInputs = [];
    }
  }

  setupNetworkListeners() {
    // Clean up any existing handlers FIRST to prevent accumulation
    if (this.networkHandlers && this.networkHandlers.length > 0) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }

    this.registerNetworkHandler(SOCKET_EVENTS.GAME_CREATED, (data) => {
      this.clearMenuUI();
      this.scene.stop('MenuScene');
      this.scene.stop('BackgroundScene');
      this.scene.start('LobbyScene', {
        sessionCode: data.sessionCode,
        inviteLink: data.inviteLink,
        maze: data.maze,
        players: data.players,
        isHost: true
      });
    });

    this.registerNetworkHandler(SOCKET_EVENTS.JOIN_SUCCESS, (data) => {
      this.clearMenuUI();
      this.scene.stop('MenuScene');
      this.scene.stop('BackgroundScene');
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

    this.registerNetworkHandler(SOCKET_EVENTS.JOIN_ERROR, (data) => {
      this.showError(data.message);
    });
  }

  showError(message) {
    if (this.errorText) {
      this.errorText.setText(message);
      this.time.delayedCall(3000, () => {
        if (this.errorText) {
          this.errorText.setText('');
        }
      });
    }
  }

  shutdown() {
    this.scale.off('resize', this.repositionAllInputs, this);
    this.clearMenuUI();

    // Clean up network handlers to prevent accumulation
    if (this.networkHandlers) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }
  }
}

// ============================================
// CREATE GAME SCENE (overlay on BackgroundScene)
// ============================================
class CreateGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CreateGameScene' });
  }

  init(data) {
    this.nickname = data.nickname;
    // DON'T reset networkHandlers here! Only initialize if it doesn't exist.
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
    // Make background transparent to show BackgroundScene
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

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

    this.isPrivate = false;
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
        backgroundColor: option.key === 'public' ? '#6a6aaa' : '#4a4a8a',
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
        this.scene.stop('CreateGameScene');
        this.scene.launch('MenuScene');
      });

    // Setup network listeners - clean up first to prevent accumulation
    if (this.networkHandlers && this.networkHandlers.length > 0) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }

    this.registerNetworkHandler(SOCKET_EVENTS.GAME_CREATED, (data) => {
      this.scene.stop('CreateGameScene');
      this.scene.stop('BackgroundScene');
      this.scene.start('LobbyScene', {
        sessionCode: data.sessionCode,
        inviteLink: data.inviteLink,
        maze: data.maze,
        players: data.players,
        isHost: true
      });
    });

    // Graphics for selection borders/glow
    this.selectionGraphics = this.add.graphics();
    this.updateSelectionVisuals();
  }

  shutdown() {
    // Clean up network handlers to prevent accumulation
    if (this.networkHandlers) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }
  }

  selectSize(size) {
    this.selectedSize = size;
    Object.entries(this.sizeButtons).forEach(([key, btn]) => {
      btn.setStyle({ backgroundColor: key === size ? '#6a6aaa' : '#4a4a8a' });
    });
    this.updateSelectionVisuals();
  }

  selectPrivacy(isPrivate) {
    this.isPrivate = isPrivate;
    this.privacyButtons.private.setStyle({
      backgroundColor: isPrivate ? '#6a6aaa' : '#4a4a8a'
    });
    this.privacyButtons.public.setStyle({
      backgroundColor: !isPrivate ? '#6a6aaa' : '#4a4a8a'
    });
    this.updateSelectionVisuals();
  }

  updateSelectionVisuals() {
    const g = this.selectionGraphics;
    g.clear();

    // Get the selected buttons
    const sizeBtn = this.sizeButtons[this.selectedSize];
    const privacyKey = this.isPrivate ? 'private' : 'public';
    const privacyBtn = this.privacyButtons[privacyKey];

    // Draw border + glow around selected buttons
    [sizeBtn, privacyBtn].forEach(btn => {
      const bounds = btn.getBounds();
      const padding = 4;
      const x = bounds.x - padding;
      const y = bounds.y - padding;
      const w = bounds.width + padding * 2;
      const h = bounds.height + padding * 2;

      // Outer glow (subtle)
      g.lineStyle(6, 0x00ffff, 0.15);
      g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 6);

      // Middle glow
      g.lineStyle(4, 0x00ffff, 0.3);
      g.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 5);

      // Main border (bright cyan)
      g.lineStyle(2, 0x00ffff, 1);
      g.strokeRoundedRect(x, y, w, h, 4);
    });
  }
}

// ============================================
// BROWSE GAMES SCENE (overlay on BackgroundScene)
// ============================================
class BrowseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BrowseScene' });
  }

  init(data) {
    this.nickname = data.nickname;

    // DON'T reset networkHandlers here! Only initialize if it doesn't exist.
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
    // Make background transparent to show BackgroundScene
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

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
        networkManager.emit(SOCKET_EVENTS.STOP_BROWSING, {});
        this.scene.stop('BrowseScene');
        this.scene.launch('MenuScene');
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

    // Setup listeners - clean up first to prevent accumulation
    if (this.networkHandlers && this.networkHandlers.length > 0) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }

    this.registerNetworkHandler(SOCKET_EVENTS.OPEN_GAMES_LIST, (games) => {
      this.displayGames(games);
    });

    this.registerNetworkHandler(SOCKET_EVENTS.JOIN_SUCCESS, (data) => {
      this.scene.stop('BrowseScene');
      this.scene.stop('BackgroundScene');
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

  shutdown() {
    // Leave the browsers room
    networkManager.emit(SOCKET_EVENTS.STOP_BROWSING, {});

    // Clean up network handlers to prevent accumulation
    if (this.networkHandlers) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }
  }
}
