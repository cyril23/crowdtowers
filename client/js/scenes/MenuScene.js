import { SOCKET_EVENTS, GAME_STATUS, MAZE_SIZES, HOTKEYS } from '../../../shared/constants.js';
import { networkManager } from '../managers/NetworkManager.js';
import { soundManager } from '../managers/SoundManager.js';
import { settingsManager, isInputFocused, formatWithHotkey, getHotkeyDisplay } from '../managers/SettingsManager.js';
import { DeviceUtils } from '../config.js';
import { GameMenuManager } from '../ui/GameMenuManager.js';

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

    // Listen for resize to update animation centers
    this.scale.on('resize', this.handleResize, this);
  }

  handleResize() {
    // Safety check - scene might be stopped or cameras destroyed
    if (!this.scene.isActive() || !this.cameras.main) {
      return;
    }

    // Update star and UFO centers for new canvas size
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Update all stars to use new center
    this.stars.forEach(star => {
      star.centerX = centerX;
      star.centerY = centerY;
    });

    // Update all UFOs to use new center
    this.ufos.forEach(ufo => {
      ufo.centerX = centerX;
      ufo.centerY = centerY;
    });

    // Reposition mothership
    if (this.mothership) {
      // Mothership was drawn at fixed positions, need to redraw
      this.mothership.destroy();
      if (this.mothershipGlow) this.mothershipGlow.destroy();
      this.createMothership(centerX);
    }
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

  resetStar(star) {
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
  update(_time, _delta) {
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
        this.resetStar(star);
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

  shutdown() {
    // Clean up resize listener to prevent handler accumulation
    this.scale.off('resize', this.handleResize, this);
  }
}

// ============================================
// MENU SCENE - Main menu UI (overlay on BackgroundScene)
// ============================================
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  init(data) {
    // DON'T reset networkHandlers here! Only initialize if it doesn't exist.
    if (!this.networkHandlers) {
      this.networkHandlers = [];
    }
    // Preserve nickname across scene restarts (from resize)
    this.preservedNickname = data?.preservedNickname || null;
  }

  // Helper to register network handlers and track them for cleanup
  registerNetworkHandler(event, handler) {
    networkManager.on(event, handler);
    this.networkHandlers.push({ event, handler });
  }

  // Design size for menu UI - all positions are relative to this
  // Using a compact design that fits well on mobile
  static DESIGN_WIDTH = 400;
  static DESIGN_HEIGHT = 500;

  create() {
    // Launch background scene first (needed for all views)
    if (!this.scene.isActive('BackgroundScene')) {
      this.scene.launch('BackgroundScene');
      this.scene.sendToBack('BackgroundScene');
    }

    // Make this scene's background transparent
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Start menu music (sequential: 1 -> 2 -> 3 -> 4 -> repeat)
    soundManager.setScene(this);
    soundManager.startMenuMusic();

    // Setup network listeners
    this.setupNetworkListeners();

    // Check for pending join code (from invite link) - launch JoinGameScene
    const pendingCode = this.registry.get('pendingJoinCode');
    if (pendingCode) {
      this.registry.remove('pendingJoinCode');
      const savedNickname = localStorage.getItem('playerNickname') || '';
      if (savedNickname) {
        // Have nickname, go directly to JoinGameScene
        this.scene.stop('MenuScene');
        this.scene.launch('JoinGameScene', { nickname: savedNickname, prefillCode: pendingCode });
        return;
      }
      // No nickname - show main menu but store code for later
      this.pendingJoinCode = pendingCode;
    }

    // ===== MAIN MENU UI =====

    // Set design dimensions for main menu
    this.currentDesignWidth = MenuScene.DESIGN_WIDTH;
    this.currentDesignHeight = MenuScene.DESIGN_HEIGHT;

    // Setup camera to zoom/center the design space within the canvas
    this.setupMenuCamera();

    // All positions below are in DESIGN coordinates (400x500)
    const centerX = MenuScene.DESIGN_WIDTH / 2;  // 200

    // Title
    this.createTitle(centerX);

    // Name input - label positioned with clear gap above input
    this.add.text(centerX, 165, 'Your Name:', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Create HTML input - manually positioned to work around Phaser DOM element bugs
    this.nicknameInput = this.createHtmlInput(centerX, 200, 180, 'Enter name...');

    // Listen to Phaser's scale manager for reliable resize handling
    this.scale.on('resize', this.onGameResize, this);

    // Load nickname - prefer preserved value from resize, then localStorage
    const savedName = this.preservedNickname || localStorage.getItem('playerNickname');
    if (savedName) {
      this.nicknameInput.value = savedName;
    }

    // Create Game button
    const createBtn = this.createButton(centerX, 255, 'Create New Game', () => {
      this.showCreateGameMenu();
    }, HOTKEYS.CREATE);

    // Join by Code button
    const joinBtn = this.createButton(centerX, 310, 'Join by Code', () => {
      this.showJoinMenu();
    }, HOTKEYS.JOIN);

    // Browse Games button
    const browseBtn = this.createButton(centerX, 365, 'Browse Open Games', () => {
      this.showBrowseMenu();
    }, HOTKEYS.BROWSE);

    // Track buttons with hotkeys for dynamic updates
    this.hotkeyButtons = [createBtn, joinBtn, browseBtn];

    // Error message area
    this.errorText = this.add.text(centerX, 430, '', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Check for toast message (e.g., from lobby close)
    const toastMsg = this.scene.settings.data?.toast;
    if (toastMsg) {
      const duration = this.scene.settings.data?.toastDuration;
      this.showToast(toastMsg, duration);
    }

    // Setup global menu with just volume controls
    this.gameMenu = new GameMenuManager();
    this.gameMenu.configure({
      showSessionCode: false,
      buttons: [],  // No buttons for main menu - just volume controls
      position: 'top-right'
    });
    this.gameMenu.show();

    // Setup keyboard shortcuts (desktop only)
    this.setupMainMenuKeyboardShortcuts();

    // Listen for hotkey visibility changes
    this.hotkeyVisibilityHandler = () => {
      if (!this.scene.isActive()) return;  // Prevent updating destroyed text objects
      this.updateButtonHotkeyLabels();
    };
    window.addEventListener('hotkey-visibility-changed', this.hotkeyVisibilityHandler);
  }

  setupMainMenuKeyboardShortcuts() {
    if (DeviceUtils.isMobile()) return;

    this.input.keyboard.on(HOTKEYS.CREATE, () => {
      if (isInputFocused()) return;
      this.showCreateGameMenu();
    });

    this.input.keyboard.on(HOTKEYS.JOIN, () => {
      if (isInputFocused()) return;
      this.showJoinMenu();
    });

    this.input.keyboard.on(HOTKEYS.BROWSE, () => {
      if (isInputFocused()) return;
      this.showBrowseMenu();
    });

    this.input.keyboard.on(HOTKEYS.TOGGLE_HOTKEYS, () => {
      if (isInputFocused()) return;
      settingsManager.toggleShowHotkeys();
    });

    this.input.keyboard.on(HOTKEYS.MENU, () => {
      if (isInputFocused()) return;
      this.gameMenu.toggle();
    });

    // Blur nickname input when clicking on canvas (re-enables hotkeys)
    this.input.on('pointerdown', () => {
      if (this.nicknameInput && document.activeElement === this.nicknameInput) {
        this.nicknameInput.blur();
      }
    });
  }

  showToast(message, duration = 2000) {
    const centerX = MenuScene.DESIGN_WIDTH / 2;
    const toast = this.add.text(centerX, 460, message, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#aa4444',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 440,
      delay: duration,
      duration: 500,
      onComplete: () => toast.destroy()
    });
  }

  // Check if we should use landscape layout
  isLandscape() {
    return this.cameras.main.width > this.cameras.main.height;
  }

  // ============================================
  // CAMERA SETUP - Zoom and center design space within canvas
  // ============================================
  setupMenuCamera() {
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;

    // Calculate zoom to fit design space in canvas
    const scaleX = canvasWidth / MenuScene.DESIGN_WIDTH;
    const scaleY = canvasHeight / MenuScene.DESIGN_HEIGHT;
    const zoom = Math.min(scaleX, scaleY, 1.5);  // Cap at 1.5x to avoid huge UI on large screens

    // Center camera on design space center
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(MenuScene.DESIGN_WIDTH / 2, MenuScene.DESIGN_HEIGHT / 2);
  }

  // ============================================
  // TITLE
  // ============================================
  createTitle(centerX) {
    // Main title - fixed size in design coordinates
    this.add.text(centerX, 60, 'CROWD TOWERS', {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1);

    // Subtitle with subtle pulse
    const subtitle = this.add.text(centerX, 100, 'Cooperative Tower Defense', {
      fontSize: '18px',
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
  // HTML INPUT - Using wrapper container to fix iOS keyboard issues
  // iOS Safari repositions position:fixed elements when keyboard appears
  // Using position:absolute within a fixed wrapper works more reliably
  // ============================================
  ensureInputWrapper() {
    // Create wrapper once if it doesn't exist
    if (!document.getElementById('input-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'input-wrapper';
      wrapper.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
      `;
      document.body.appendChild(wrapper);
    }
    return document.getElementById('input-wrapper');
  }

  createHtmlInput(designX, designY, width, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = 20;
    input.className = 'game-input';

    // Use position:absolute within the fixed wrapper (fixes iOS keyboard jumping)
    input.style.cssText = `
      position: absolute;
      padding: 8px;
      font-size: 16px;
      border: 2px solid #4a4a8a;
      border-radius: 4px;
      background: #1a1a2e;
      color: white;
      text-align: center;
      outline: none;
      transform-origin: center center;
      box-sizing: border-box;
      pointer-events: auto;
    `;

    // Add focus style
    input.addEventListener('focus', () => {
      input.style.borderColor = '#6a6aaa';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#4a4a8a';
    });

    // Add to input wrapper (not game-container)
    const wrapper = this.ensureInputWrapper();
    wrapper.appendChild(input);

    // Store design coordinates for positioning
    input._designX = designX;
    input._designY = designY;
    input._designWidth = width;

    // Position it correctly (immediate + delayed to handle initial layout)
    this.positionHtmlInput(input);
    setTimeout(() => this.positionHtmlInput(input), 100);

    return input;
  }

  // Position HTML input based on camera zoom and design coordinates
  positionHtmlInput(input) {
    if (!input) return;

    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();

    // Get camera zoom and scroll position
    const camera = this.cameras.main;
    const zoom = camera.zoom;

    // Calculate where the design coordinate maps to on screen
    // Use dynamic design dimensions if set (for Join view), otherwise use class constants
    const designCenterX = (this.currentDesignWidth || MenuScene.DESIGN_WIDTH) / 2;
    const designCenterY = (this.currentDesignHeight || MenuScene.DESIGN_HEIGHT) / 2;

    // Screen center
    const screenCenterX = canvasRect.left + canvasRect.width / 2;
    const screenCenterY = canvasRect.top + canvasRect.height / 2;

    // Offset from design center, scaled by zoom
    const offsetX = (input._designX - designCenterX) * zoom;
    const offsetY = (input._designY - designCenterY) * zoom;

    const screenX = screenCenterX + offsetX;
    const screenY = screenCenterY + offsetY;

    // Scale width by zoom, but cap max width
    const scaledWidth = Math.min(input._designWidth * zoom, 250);

    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.style.width = `${scaledWidth}px`;
    input.style.transform = 'translate(-50%, -50%)';
    input.style.fontSize = `${Math.max(12, Math.min(16 * zoom, 20))}px`;
  }

  // Reposition all tracked inputs (call on resize)
  repositionAllInputs() {
    if (this.nicknameInput) {
      this.positionHtmlInput(this.nicknameInput);
    }
    if (this.codeInput) {
      this.positionHtmlInput(this.codeInput);
    }
  }

  // Handle Phaser scale manager resize event
  onGameResize() {
    // CRITICAL: Remove listener before restart to prevent handler accumulation
    this.scale.off('resize', this.onGameResize, this);

    // Safety check: only restart if this scene is actually active
    if (!this.scene.isActive()) {
      return;
    }

    // Save current input values before restart
    const savedNickname = this.nicknameInput?.value || localStorage.getItem('playerNickname') || '';
    const savedCode = this.codeInput?.value || '';

    // Clean up and restart scene to rebuild with new dimensions
    this.clearMenuUI();
    this.scene.restart({
      preservedNickname: savedNickname,
      currentView: this.currentView,
      preservedJoinCode: savedCode
    });
  }

  createButton(x, y, text, callback, hotkey = null) {
    const displayText = formatWithHotkey(text, hotkey);
    const button = this.add.text(x, y, displayText, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#4a4a8a',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Store base text and hotkey for dynamic updates
    button.baseText = text;
    button.hotkey = hotkey;

    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: '#6a6aaa' });
    });

    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: '#4a4a8a' });
    });

    button.on('pointerdown', () => {
      soundManager.play('button_click');
      callback();
    });

    return button;
  }

  updateButtonHotkeyLabels() {
    // Update all buttons with hotkeys in current scene
    if (this.hotkeyButtons) {
      this.hotkeyButtons.forEach(button => {
        if (button.baseText && button.hotkey) {
          button.setText(formatWithHotkey(button.baseText, button.hotkey));
        }
      });
    }
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

  showJoinMenu() {
    const nickname = this.nicknameInput?.value?.trim() || localStorage.getItem('playerNickname') || '';
    if (!nickname) {
      this.showError('Please enter a name');
      return;
    }

    // Save nickname to localStorage
    localStorage.setItem('playerNickname', nickname);

    // Use pending code if available (from invite link)
    const prefillCode = this.pendingJoinCode || '';
    this.pendingJoinCode = null;

    // Clean up and switch to JoinGameScene (overlay)
    this.clearMenuUI();
    this.scene.stop('MenuScene');
    this.scene.launch('JoinGameScene', { nickname, prefillCode });
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
    // Remove HTML input element
    if (this.nicknameInput && this.nicknameInput.parentNode) {
      this.nicknameInput.parentNode.removeChild(this.nicknameInput);
      this.nicknameInput = null;
    }

    // Remove scale listener
    this.scale.off('resize', this.onGameResize, this);
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
    // Safety check: ensure scene is active and errorText hasn't been destroyed
    if (!this.scene.isActive() || !this.errorText?.scene) {
      console.log('[MenuScene] showError called but scene is not active');
      return;
    }
    if (this.errorText) {
      this.errorText.setText(message);
      this.time.delayedCall(3000, () => {
        if (this.errorText?.scene) {
          this.errorText.setText('');
        }
      });
    }
  }

  shutdown() {
    this.clearMenuUI();

    // Clean up hotkey visibility listener
    if (this.hotkeyVisibilityHandler) {
      window.removeEventListener('hotkey-visibility-changed', this.hotkeyVisibilityHandler);
      this.hotkeyVisibilityHandler = null;
    }

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
// JOIN GAME SCENE (overlay on BackgroundScene)
// Separate scene for entering game code (matches CreateGameScene/BrowseScene pattern)
// ============================================
class JoinGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JoinGameScene' });
  }

  init(data) {
    this.nickname = data.nickname;
    this.prefillCode = data.prefillCode || '';
    if (!this.networkHandlers) {
      this.networkHandlers = [];
    }
  }

  registerNetworkHandler(event, handler) {
    networkManager.on(event, handler);
    this.networkHandlers.push({ event, handler });
  }

  isLandscape() {
    return this.cameras.main.width > this.cameras.main.height;
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Detect orientation and set design space
    const isLandscape = this.isLandscape();
    if (isLandscape) {
      this.designWidth = 500;
      this.designHeight = 300;
    } else {
      this.designWidth = 400;
      this.designHeight = 500;
    }

    // Setup camera
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;
    const scaleX = canvasWidth / this.designWidth;
    const scaleY = canvasHeight / this.designHeight;
    const zoom = Math.min(scaleX, scaleY, 1.5);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(this.designWidth / 2, this.designHeight / 2);

    const centerX = this.designWidth / 2;

    if (isLandscape) {
      this.buildLandscapeLayout(centerX);
    } else {
      this.buildPortraitLayout(centerX);
    }

    // Configure code input
    this.codeInput.value = this.prefillCode;
    this.codeInput.maxLength = 6;
    this.codeInput.style.textTransform = 'uppercase';

    // Setup network handlers
    if (this.networkHandlers && this.networkHandlers.length > 0) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }

    this.registerNetworkHandler(SOCKET_EVENTS.JOIN_SUCCESS, (data) => {
      this.cleanupInput();
      this.scene.stop('JoinGameScene');
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

    this.registerNetworkHandler(SOCKET_EVENTS.JOIN_ERROR, (data) => {
      this.showError(data.message);
    });

    // Listen for resize
    this.scale.on('resize', this.onResize, this);

    // Setup global menu with volume controls + back button
    this.gameMenu = new GameMenuManager();
    this.gameMenu.configure({
      showSessionCode: false,
      buttons: [
        {
          id: 'back',
          label: 'Back to Main Menu',
          hotkey: HOTKEYS.MAIN_MENU,
          neutral: true,
          onClick: () => {
            this.cleanupInput();
            this.scene.stop('JoinGameScene');
            this.scene.launch('MenuScene');
          }
        }
      ],
      position: 'top-right'
    });
    this.gameMenu.show();

    // Setup keyboard shortcuts (desktop only)
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts() {
    if (DeviceUtils.isMobile()) return;

    this.input.keyboard.on(HOTKEYS.MAIN_MENU, () => {
      if (isInputFocused()) return;
      this.cleanupInput();
      this.scene.stop('JoinGameScene');
      this.scene.launch('MenuScene');
    });

    this.input.keyboard.on(HOTKEYS.TOGGLE_HOTKEYS, () => {
      if (isInputFocused()) return;
      settingsManager.toggleShowHotkeys();
      this.scene.restart({ nickname: this.nickname, prefillCode: this.codeInput?.value || '' });
    });

    this.input.keyboard.on(HOTKEYS.JOIN, () => {
      if (isInputFocused()) return;
      this.attemptJoin();
    });

    this.input.keyboard.on(HOTKEYS.MENU, () => {
      if (isInputFocused()) return;
      this.gameMenu.toggle();
    });

    // Blur code input when clicking on canvas (re-enables hotkeys)
    this.input.on('pointerdown', () => {
      if (this.codeInput && document.activeElement === this.codeInput) {
        this.codeInput.blur();
      }
    });
  }

  buildLandscapeLayout(centerX) {
    this.add.text(centerX, 70, 'Enter Session Code:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.codeInput = this.createHtmlInput(centerX, 115, 140, 'ABC123');

    this.errorText = this.add.text(centerX, 250, '', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Join Game button
    const joinBtn = this.add.text(centerX, 170, formatWithHotkey('Join Game', HOTKEYS.JOIN), {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#4a4a8a',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    joinBtn.on('pointerover', () => joinBtn.setStyle({ backgroundColor: '#6a6aaa' }));
    joinBtn.on('pointerout', () => joinBtn.setStyle({ backgroundColor: '#4a4a8a' }));
    joinBtn.on('pointerdown', () => this.attemptJoin());

    // Back button
    const backBtn = this.add.text(centerX, 225, formatWithHotkey('Back to Main Menu', HOTKEYS.MAIN_MENU), {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      backgroundColor: '#333333',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }))
      .on('pointerdown', () => {
        this.cleanupInput();
        this.scene.stop('JoinGameScene');
        this.scene.launch('MenuScene');
      });
  }

  buildPortraitLayout(centerX) {
    this.add.text(centerX, 180, 'Enter Session Code:', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.codeInput = this.createHtmlInput(centerX, 220, 140, 'ABC123');

    this.errorText = this.add.text(centerX, 380, '', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Join Game button
    const joinBtn = this.add.text(centerX, 280, formatWithHotkey('Join Game', HOTKEYS.JOIN), {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#4a4a8a',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    joinBtn.on('pointerover', () => joinBtn.setStyle({ backgroundColor: '#6a6aaa' }));
    joinBtn.on('pointerout', () => joinBtn.setStyle({ backgroundColor: '#4a4a8a' }));
    joinBtn.on('pointerdown', () => this.attemptJoin());

    // Back button
    const backBtn = this.add.text(centerX, 340, formatWithHotkey('Back to Main Menu', HOTKEYS.MAIN_MENU), {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      backgroundColor: '#333333',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }))
      .on('pointerdown', () => {
        this.cleanupInput();
        this.scene.stop('JoinGameScene');
        this.scene.launch('MenuScene');
      });
  }

  attemptJoin() {
    const code = this.codeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
      this.showError('Session code must be 6 characters');
      return;
    }
    networkManager.joinGame(code, this.nickname);
  }

  showError(message) {
    // Safety check: ensure scene is active and errorText hasn't been destroyed
    if (!this.scene.isActive() || !this.errorText?.scene) {
      console.log('[JoinGameScene] showError called but scene is not active');
      return;
    }
    if (this.errorText) {
      this.errorText.setText(message);
      this.time.delayedCall(3000, () => {
        if (this.errorText?.scene) {
          this.errorText.setText('');
        }
      });
    }
  }

  // HTML input methods (same as MenuScene)
  ensureInputWrapper() {
    if (!document.getElementById('input-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'input-wrapper';
      wrapper.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
      `;
      document.body.appendChild(wrapper);
    }
    return document.getElementById('input-wrapper');
  }

  createHtmlInput(designX, designY, width, placeholder) {
    // Clean up any existing code inputs first to prevent duplicates on restart
    const existingWrapper = document.getElementById('input-wrapper');
    if (existingWrapper) {
      const existingInputs = existingWrapper.querySelectorAll('input.join-code-input');
      existingInputs.forEach(el => el.remove());
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = 20;
    input.className = 'game-input join-code-input';

    input.style.cssText = `
      position: absolute;
      padding: 8px;
      font-size: 16px;
      border: 2px solid #4a4a8a;
      border-radius: 4px;
      background: #1a1a2e;
      color: white;
      text-align: center;
      outline: none;
      transform-origin: center center;
      box-sizing: border-box;
      pointer-events: auto;
    `;

    input.addEventListener('focus', () => {
      input.style.borderColor = '#6a6aaa';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#4a4a8a';
    });

    const wrapper = this.ensureInputWrapper();
    wrapper.appendChild(input);

    input._designX = designX;
    input._designY = designY;
    input._designWidth = width;

    this.positionHtmlInput(input);
    setTimeout(() => this.positionHtmlInput(input), 100);

    return input;
  }

  positionHtmlInput(input) {
    if (!input) return;

    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const camera = this.cameras.main;
    const zoom = camera.zoom;

    const designCenterX = this.designWidth / 2;
    const designCenterY = this.designHeight / 2;

    const screenCenterX = canvasRect.left + canvasRect.width / 2;
    const screenCenterY = canvasRect.top + canvasRect.height / 2;

    const offsetX = (input._designX - designCenterX) * zoom;
    const offsetY = (input._designY - designCenterY) * zoom;

    const screenX = screenCenterX + offsetX;
    const screenY = screenCenterY + offsetY;

    const scaledWidth = Math.min(input._designWidth * zoom, 250);

    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.style.width = `${scaledWidth}px`;
    input.style.transform = 'translate(-50%, -50%)';
    input.style.fontSize = `${Math.max(12, Math.min(16 * zoom, 20))}px`;
  }

  cleanupInput() {
    if (this.codeInput && this.codeInput.parentNode) {
      this.codeInput.parentNode.removeChild(this.codeInput);
      this.codeInput = null;
    }
  }

  onResize() {
    this.scale.off('resize', this.onResize, this);

    if (!this.scene.isActive()) {
      return;
    }

    // Save current code before restart
    const currentCode = this.codeInput?.value || '';
    this.cleanupInput();

    this.scene.restart({ nickname: this.nickname, prefillCode: currentCode });
  }

  shutdown() {
    this.scale.off('resize', this.onResize, this);
    this.cleanupInput();

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
// Responsive layout: two columns in landscape, single column in portrait
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

  // Check if we should use landscape (two-column) layout
  isLandscape() {
    return this.cameras.main.width > this.cameras.main.height;
  }

  create() {
    // Make background transparent to show BackgroundScene
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.selectedSize = 'medium';
    this.isPrivate = false;
    this.sizeButtons = {};
    this.privacyButtons = {};

    // Build layout based on orientation
    this.buildLayout();

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

    // Listen for resize to rebuild layout
    this.scale.on('resize', this.onResize, this);

    // Setup global menu with volume controls + back button
    this.gameMenu = new GameMenuManager();
    this.gameMenu.configure({
      showSessionCode: false,
      buttons: [
        {
          id: 'back',
          label: 'Back to Main Menu',
          hotkey: HOTKEYS.MAIN_MENU,
          neutral: true,
          onClick: () => {
            this.scene.stop('CreateGameScene');
            this.scene.launch('MenuScene');
          }
        }
      ],
      position: 'top-right'
    });
    this.gameMenu.show();

    // Setup keyboard shortcuts (desktop only)
    if (!DeviceUtils.isMobile()) {
      this.setupKeyboardShortcuts();
    }
  }

  setupKeyboardShortcuts() {
    // Back to main menu (M)
    this.input.keyboard.on(HOTKEYS.MAIN_MENU, () => {
      this.scene.stop('CreateGameScene');
      this.scene.launch('MenuScene');
    });

    // Toggle hotkey visibility (H)
    this.input.keyboard.on(HOTKEYS.TOGGLE_HOTKEYS, () => {
      settingsManager.toggleShowHotkeys();
      // Rebuild layout to update button labels
      this.scene.restart({ nickname: this.nickname });
    });

    // Maze size hotkeys (1, 2, 3)
    this.input.keyboard.on(HOTKEYS.MAZE_SMALL, () => {
      this.selectSize('small');
    });
    this.input.keyboard.on(HOTKEYS.MAZE_MEDIUM, () => {
      this.selectSize('medium');
    });
    this.input.keyboard.on(HOTKEYS.MAZE_LARGE, () => {
      this.selectSize('large');
    });

    // Privacy hotkeys (P, O)
    this.input.keyboard.on(HOTKEYS.PRIVATE, () => {
      this.selectPrivacy(true);
    });
    this.input.keyboard.on(HOTKEYS.OPEN, () => {
      this.selectPrivacy(false);
    });

    // Create game hotkey (C)
    this.input.keyboard.on(HOTKEYS.CREATE, () => {
      networkManager.createGame(this.nickname, this.isPrivate, this.selectedSize);
    });

    // Toggle menu (M)
    this.input.keyboard.on(HOTKEYS.MENU, () => {
      this.gameMenu.toggle();
    });
  }

  onResize() {
    // CRITICAL: Remove listener before restart to prevent handler accumulation
    this.scale.off('resize', this.onResize, this);

    // Safety check: only restart if this scene is actually active
    // Prevents stopped scenes from accidentally restarting via lingering handlers
    if (!this.scene.isActive()) {
      return;
    }

    // Rebuild layout on resize
    this.scene.restart({ nickname: this.nickname });
  }

  buildLayout() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = width / 2;
    const isLandscape = this.isLandscape();

    if (isLandscape) {
      this.buildLandscapeLayout(width, height, centerX);
    } else {
      this.buildPortraitLayout(width, height, centerX);
    }

    // Graphics for selection borders/glow
    this.selectionGraphics = this.add.graphics();
    this.updateSelectionVisuals();
  }

  buildPortraitLayout(width, height, _centerX) {
    // Portrait: single column, vertically stacked
    // Use camera zoom to fit content
    const DESIGN_WIDTH = 400;
    const DESIGN_HEIGHT = 480;

    const scaleX = width / DESIGN_WIDTH;
    const scaleY = height / DESIGN_HEIGHT;
    const zoom = Math.min(scaleX, scaleY, 1.5);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);

    const cx = DESIGN_WIDTH / 2;

    // Title
    this.add.text(cx, 40, 'Create New Game', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Maze Size section
    this.add.text(cx, 90, 'Select Maze Size:', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    ['small', 'medium', 'large'].forEach((size, index) => {
      const config = MAZE_SIZES[size];
      const y = 125 + index * 40;
      this.createSizeButton(cx, y, size, config);
    });

    // Privacy section
    this.add.text(cx, 260, 'Game Privacy:', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.createPrivacyButton(cx, 295, 'private', 'Private (Code Only)');
    this.createPrivacyButton(cx, 335, 'public', 'Open (Browsable)');

    // Action buttons
    this.createActionButton(cx, 400, formatWithHotkey('CREATE GAME', HOTKEYS.CREATE), '#228822', () => {
      networkManager.createGame(this.nickname, this.isPrivate, this.selectedSize);
    });

    const backBtn = this.add.text(cx, 450, formatWithHotkey('Back to Main Menu', HOTKEYS.MAIN_MENU), {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      backgroundColor: '#333333',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }))
      .on('pointerdown', () => {
        this.scene.stop('CreateGameScene');
        this.scene.launch('MenuScene');
      });
  }

  buildLandscapeLayout(width, height, _centerX) {
    // Landscape: two columns side by side
    const DESIGN_WIDTH = 550;
    const DESIGN_HEIGHT = 320;

    const scaleX = width / DESIGN_WIDTH;
    const scaleY = height / DESIGN_HEIGHT;
    const zoom = Math.min(scaleX, scaleY, 1.5);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);

    const cx = DESIGN_WIDTH / 2;
    const leftCol = DESIGN_WIDTH * 0.28;  // ~154
    const rightCol = DESIGN_WIDTH * 0.72; // ~396

    // Title (centered)
    this.add.text(cx, 35, 'Create New Game', {
      fontSize: '26px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // LEFT COLUMN: Maze Size
    this.add.text(leftCol, 70, 'Maze Size:', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    ['small', 'medium', 'large'].forEach((size, index) => {
      const config = MAZE_SIZES[size];
      const y = 100 + index * 35;
      this.createSizeButton(leftCol, y, size, config, true);
    });

    // RIGHT COLUMN: Privacy
    this.add.text(rightCol, 70, 'Privacy:', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.createPrivacyButton(rightCol, 105, 'private', 'Private', true);
    this.createPrivacyButton(rightCol, 145, 'public', 'Open', true);

    // BOTTOM: Action buttons (centered)
    this.createActionButton(cx - 70, 260, formatWithHotkey('CREATE', HOTKEYS.CREATE), '#228822', () => {
      networkManager.createGame(this.nickname, this.isPrivate, this.selectedSize);
    }, true);

    const backBtn = this.add.text(cx + 70, 260, formatWithHotkey('Main Menu', HOTKEYS.MAIN_MENU), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      backgroundColor: '#333333',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }))
      .on('pointerdown', () => {
        this.scene.stop('CreateGameScene');
        this.scene.launch('MenuScene');
      });
  }

  createSizeButton(x, y, size, config, compact = false) {
    // Get hotkey for this size
    const hotkeyMap = {
      small: HOTKEYS.MAZE_SMALL,
      medium: HOTKEYS.MAZE_MEDIUM,
      large: HOTKEYS.MAZE_LARGE
    };
    const hotkey = hotkeyMap[size];
    const hotkeyHint = settingsManager.showHotkeys ? ` [${getHotkeyDisplay(hotkey)}]` : '';

    const baseLabel = compact
      ? `${size.charAt(0).toUpperCase()}${size.slice(1)} (${config.grid}x${config.grid})`
      : `${size.charAt(0).toUpperCase()}${size.slice(1)} (${config.grid}x${config.grid})`;
    const label = baseLabel + hotkeyHint;

    const btn = this.add.text(x, y, label, {
      fontSize: compact ? '14px' : '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: size === 'medium' ? '#6a6aaa' : '#4a4a8a',
      padding: compact ? { x: 10, y: 6 } : { x: 12, y: 7 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.selectSize(size));
    this.sizeButtons[size] = btn;
  }

  createPrivacyButton(x, y, key, label, compact = false) {
    // Get hotkey for this privacy option
    const hotkey = key === 'private' ? HOTKEYS.PRIVATE : HOTKEYS.OPEN;
    const hotkeyHint = settingsManager.showHotkeys ? ` [${getHotkeyDisplay(hotkey)}]` : '';
    const labelWithHotkey = label + hotkeyHint;

    const btn = this.add.text(x, y, labelWithHotkey, {
      fontSize: compact ? '14px' : '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: key === 'public' ? '#6a6aaa' : '#4a4a8a',
      padding: compact ? { x: 10, y: 6 } : { x: 12, y: 7 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.selectPrivacy(key === 'private'));
    this.privacyButtons[key] = btn;
  }

  // Hover color computed dynamically because Phaser renders to canvas (CSS doesn't apply),
  // and this keeps the helper generic for any bgColor passed in.
  createActionButton(x, y, text, bgColor, callback, compact = false) {
    const btn = this.add.text(x, y, text, {
      fontSize: compact ? '18px' : '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: bgColor,
      padding: compact ? { x: 20, y: 10 } : { x: 25, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Compute hover color (lighter version)
    const num = parseInt(bgColor.slice(1), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + 0x22);
    const g = Math.min(255, ((num >> 8) & 0xff) + 0x22);
    const b = Math.min(255, (num & 0xff) + 0x22);
    const hoverColor = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverColor }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: bgColor }));
    btn.on('pointerdown', callback);
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
// Responsive layout with camera zoom/centering
// ============================================
class BrowseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BrowseScene' });
  }

  // Design space for BrowseScene
  static DESIGN_WIDTH = 400;
  static DESIGN_HEIGHT = 550;

  init(data) {
    this.nickname = data.nickname || this.registry.get('nickname');

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

  // Setup camera to zoom/center the design space within the canvas
  setupMenuCamera() {
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;

    const scaleX = canvasWidth / BrowseScene.DESIGN_WIDTH;
    const scaleY = canvasHeight / BrowseScene.DESIGN_HEIGHT;
    const zoom = Math.min(scaleX, scaleY, 1.5);

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(BrowseScene.DESIGN_WIDTH / 2, BrowseScene.DESIGN_HEIGHT / 2);
  }

  create() {
    // Make background transparent to show BackgroundScene
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Setup camera for responsive layout
    this.setupMenuCamera();

    // All positions are in DESIGN coordinates (400x550)
    const centerX = BrowseScene.DESIGN_WIDTH / 2;

    this.add.text(centerX, 40, 'Open Games', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.loadingText = this.add.text(centerX, 200, 'Loading...', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.gamesList = [];

    // Back button
    const backBtn = this.add.text(centerX, 510, formatWithHotkey('Back to Main Menu', HOTKEYS.MAIN_MENU), {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      backgroundColor: '#333333',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }))
      .on('pointerdown', () => {
        networkManager.emit(SOCKET_EVENTS.STOP_BROWSING, {});
        this.scene.stop('BrowseScene');
        this.scene.launch('MenuScene');
      });

    // Refresh button (positioned above Back button)
    const refreshBtn = this.add.text(centerX, 470, formatWithHotkey('Refresh', HOTKEYS.REFRESH), {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      backgroundColor: '#333333',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => refreshBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => refreshBtn.setStyle({ backgroundColor: '#333333' }))
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

    // Listen for resize
    this.scale.on('resize', this.onResize, this);

    // Setup global menu with volume controls + back button
    this.gameMenu = new GameMenuManager();
    this.gameMenu.configure({
      showSessionCode: false,
      buttons: [
        {
          id: 'back',
          label: 'Back to Main Menu',
          hotkey: HOTKEYS.MAIN_MENU,
          neutral: true,
          onClick: () => {
            networkManager.emit(SOCKET_EVENTS.STOP_BROWSING, {});
            this.scene.stop('BrowseScene');
            this.scene.launch('MenuScene');
          }
        }
      ],
      position: 'top-right'
    });
    this.gameMenu.show();

    // Setup keyboard shortcuts (desktop only)
    this.setupKeyboardShortcuts();

    // Request games list
    this.refreshList();
  }

  setupKeyboardShortcuts() {
    if (DeviceUtils.isMobile()) return;

    this.input.keyboard.on(HOTKEYS.MAIN_MENU, () => {
      networkManager.emit(SOCKET_EVENTS.STOP_BROWSING, {});
      this.scene.stop('BrowseScene');
      this.scene.launch('MenuScene');
    });

    this.input.keyboard.on(HOTKEYS.TOGGLE_HOTKEYS, () => {
      settingsManager.toggleShowHotkeys();
      this.scene.restart({ nickname: this.nickname });
    });

    this.input.keyboard.on(HOTKEYS.REFRESH, () => {
      this.refreshList();
    });

    this.input.keyboard.on(HOTKEYS.MENU, () => {
      this.gameMenu.toggle();
    });
  }

  onResize() {
    // CRITICAL: Remove listener before restart to prevent handler accumulation
    this.scale.off('resize', this.onResize, this);

    // Safety check: only restart if this scene is actually active
    if (!this.scene.isActive()) {
      return;
    }

    this.scene.restart({ nickname: this.nickname });
  }

  refreshList() {
    this.loadingText.setVisible(true);
    this.gamesList.forEach(item => item.destroy());
    this.gamesList = [];
    networkManager.browseGames();
  }

  displayGames(games) {
    this.loadingText.setVisible(false);

    // All positions in DESIGN coordinates
    const centerX = BrowseScene.DESIGN_WIDTH / 2;

    if (games.length === 0) {
      this.loadingText.setText('No open games available');
      this.loadingText.setVisible(true);
      return;
    }

    games.forEach((game, index) => {
      const y = 100 + index * 60;

      const container = this.add.container(centerX, y);

      const bg = this.add.rectangle(0, 0, 360, 50, 0x2a2a4e)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(-160, -15, `${game.hostNickname}'s Game`, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Arial'
      });

      const info = this.add.text(-160, 5, `${game.mazeSize} | ${game.playerCount}/${game.maxPlayers} players | ${game.status}`, {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'Arial'
      });

      const joinBtn = this.add.text(140, 0, 'JOIN', {
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
    // Clean up resize listener
    this.scale.off('resize', this.onResize, this);

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

// ES module exports
export { BackgroundScene, MenuScene, JoinGameScene, CreateGameScene, BrowseScene };
