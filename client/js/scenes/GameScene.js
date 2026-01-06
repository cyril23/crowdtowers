import { GAME_CONFIG, GAME_STATUS, MAZE_SIZES, TILE_TYPES, TOWERS, ENEMIES, SOCKET_EVENTS, HOTKEYS } from '../../../shared/constants.js';
import { CLIENT_CONFIG } from '../config.js';
import { networkManager } from '../managers/NetworkManager.js';
import { soundManager } from '../managers/SoundManager.js';
import { InputManager } from '../managers/InputManager.js';
import { log } from '../utils/logger.js';
import { HUD } from '../ui/HUD.js';
import { ChatPanel } from '../ui/ChatPanel.js';
import { TowerMenu } from '../ui/TowerMenu.js';
import { TowerSprite } from '../entities/Tower.js';
import { GameMenuManager } from '../ui/GameMenuManager.js';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.sessionCode = data.sessionCode;
    this.maze = data.maze;
    this.gameState = data.gameState || {
      budget: GAME_CONFIG.STARTING_BUDGET,
      lives: GAME_CONFIG.STARTING_LIVES,
      currentWave: 0,
      towers: []
    };

    // Store initial status for handling paused state on rejoin
    this.initialStatus = data.status || null;

    // Track pause state for hotkey handling
    this.isPaused = false;

    // Preserve selected tower type across restarts (for resize)
    this.preservedSelectedTowerType = data.selectedTowerType || null;

    // Store new dimensions from resize event (if passed)
    this._newWidth = data.newWidth || null;
    this._newHeight = data.newHeight || null;

    // DON'T reset networkHandlers here! Only initialize if it doesn't exist.
    if (!this.networkHandlers) {
      this.networkHandlers = [];
    }
  }

  create() {
    // Store active session for reconnection after standby
    localStorage.setItem('activeGameSession', JSON.stringify({
      sessionCode: this.sessionCode,
      nickname: networkManager.nickname
    }));
    // Sync sessionCode to NetworkManager for auto-rejoin on socket reconnect
    // (createGame doesn't set this, only joinGame does)
    networkManager.sessionCode = this.sessionCode;
    log('[REJOIN]', 'Stored active session:', this.sessionCode);

    // Calculate dimensions
    const mazeConfig = Object.values(MAZE_SIZES).find(
      val => val.grid === this.maze.grid.length
    );
    this.mazeConfig = mazeConfig || MAZE_SIZES.medium;
    this.gridSize = this.maze.grid.length;
    this.tileSize = this.mazeConfig.tileSize;

    // Calculate maze pixel size
    this.mazePixelSize = this.gridSize * this.tileSize;

    // Configure camera to center the game board within the full-screen canvas
    this.setupCamera();

    // Draw letterbox background (areas outside the maze)
    this.drawLetterboxBackground();

    // Tower sprites map (tower data comes from gameState.towers)
    this.towerSprites = new Map();

    // Enemy data from server (rendered directly, no individual sprites)
    this.enemyData = [];
    this.selectedEnemyGoneHandled = false; // Prevent repeated "gone" updates

    // Single graphics object for all enemies (like testgame)
    this.enemyGraphics = this.add.graphics();
    this.enemyGraphics.setDepth(50);

    // Draw the maze
    this.drawMaze();

    // Create existing towers
    this.gameState.towers.forEach(tower => {
      this.createTowerSprite(tower);
    });

    // Setup input
    this.inputManager = new InputManager(this);
    this.inputManager.setup();

    // Setup UI
    this.setupUI();

    // Placement preview graphics
    this.placementPreview = this.add.graphics();
    this.placementPreview.setDepth(100);

    // Projectile graphics layer
    this.projectileGraphics = this.add.graphics();
    this.projectileGraphics.setDepth(150);
    this.projectiles = [];

    // Setup network listeners
    this.setupNetworkListeners();

    // Update HUD with initial state
    this.hud.update({
      lives: this.gameState.lives,
      budget: this.gameState.budget,
      wave: this.gameState.currentWave
    });

    // Start gameplay music (random track, then sequential)
    soundManager.setScene(this);
    // Only reset track index for new games, not resize restarts
    if (!this.initData?.gameState) {
      soundManager.resetGameplayIndex();
    }
    soundManager.startGameplayMusic();

    // Listen for resize events
    this.scale.on('resize', this.handleResize, this);
  }

  setupCamera() {
    // Use passed dimensions from resize event if available, otherwise read from camera
    const canvasWidth = this._newWidth || this.cameras.main.width;
    const canvasHeight = this._newHeight || this.cameras.main.height;

    // Clear stored dimensions after using
    this._newWidth = null;
    this._newHeight = null;

    // Panel position detection - must match CSS media query:
    // @media (max-width: 900px), (max-height: 700px)
    // Panel is on LEFT only when BOTH width > 900 AND height > 700
    const isPanelOnLeft = canvasWidth > 900 && canvasHeight > 700;

    // Reserve space for tower panel
    const PANEL_LEFT_WIDTH = 320;   // ~300px max-width + padding
    const PANEL_BOTTOM_HEIGHT = 80; // ~70px content + padding

    // Calculate available space for maze
    const availableWidth = isPanelOnLeft ? canvasWidth - PANEL_LEFT_WIDTH : canvasWidth;
    const availableHeight = isPanelOnLeft ? canvasHeight : canvasHeight - PANEL_BOTTOM_HEIGHT;

    // Zoom to fit maze in available space (cap at 1x to not enlarge)
    const scaleX = availableWidth / this.mazePixelSize;
    const scaleY = availableHeight / this.mazePixelSize;
    const zoom = Math.min(scaleX, scaleY, 1);

    this.cameras.main.setZoom(zoom);

    // Offset camera to center maze in available space (not full canvas)
    const mazeCenter = this.mazePixelSize / 2;
    let cameraCenterX = mazeCenter;
    let cameraCenterY = mazeCenter;

    if (isPanelOnLeft) {
      // Panel on left: shift maze view right by moving camera left
      cameraCenterX = mazeCenter - (PANEL_LEFT_WIDTH / 2) / zoom;
    } else {
      // Panel on bottom: shift maze view up by moving camera down
      cameraCenterY = mazeCenter + (PANEL_BOTTOM_HEIGHT / 2) / zoom;
    }

    this.cameras.main.centerOn(cameraCenterX, cameraCenterY);
  }

  drawLetterboxBackground() {
    // Remove old letterbox if it exists
    if (this.letterboxGraphics) {
      this.letterboxGraphics.destroy();
    }

    // Create new letterbox graphics
    this.letterboxGraphics = this.add.graphics();
    this.letterboxGraphics.setDepth(-100);
    this.letterboxGraphics.setScrollFactor(0); // Fixed to screen, not world

    // Fill the entire screen with background color
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;

    this.letterboxGraphics.fillStyle(0x0a0a1a, 1);
    this.letterboxGraphics.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  handleResize(gameSize) {
    // CRITICAL: Remove listener before restart to prevent handler accumulation
    this.scale.off('resize', this.handleResize, this);

    // Safety check: only restart if this scene is actually active
    if (!this.scene.isActive()) {
      return;
    }

    // Preserve current state for restart
    const preservedData = {
      sessionCode: this.sessionCode,
      maze: this.maze,
      gameState: {
        budget: this.gameState.budget,
        lives: this.gameState.lives,
        currentWave: this.gameState.currentWave,
        towers: this.gameState.towers
      },
      // Preserve UI state
      selectedTowerType: this.towerMenu?.selectedType || null,
      // Pass new dimensions explicitly (from resize event)
      newWidth: gameSize?.width,
      newHeight: gameSize?.height
    };

    this.scene.restart(preservedData);
  }

  drawMaze() {
    const graphics = this.add.graphics();

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tileType = this.maze.grid[y][x];
        let color;

        switch (tileType) {
        case TILE_TYPES.WALL:
          color = CLIENT_CONFIG.colors.wall;
          break;
        case TILE_TYPES.PATH:
          color = CLIENT_CONFIG.colors.path;
          break;
        case TILE_TYPES.BUILDABLE:
          color = CLIENT_CONFIG.colors.buildable;
          break;
        case TILE_TYPES.ENTRY:
          color = CLIENT_CONFIG.colors.entry;
          break;
        case TILE_TYPES.EXIT:
          color = CLIENT_CONFIG.colors.exit;
          break;
        default:
          color = CLIENT_CONFIG.colors.wall;
        }

        graphics.fillStyle(color, 1);
        graphics.fillRect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize - 1,
          this.tileSize - 1
        );
      }
    }

    // Draw grid lines
    graphics.lineStyle(1, CLIENT_CONFIG.colors.gridLine, 0.3);
    for (let i = 0; i <= this.gridSize; i++) {
      graphics.moveTo(i * this.tileSize, 0);
      graphics.lineTo(i * this.tileSize, this.gridSize * this.tileSize);
      graphics.moveTo(0, i * this.tileSize);
      graphics.lineTo(this.gridSize * this.tileSize, i * this.tileSize);
    }
    graphics.strokePath();

    // Draw path direction indicators
    this.drawPathIndicators(graphics);

    // Draw entry/exit markers
    this.drawEntryExitMarkers(graphics);
  }

  drawPathIndicators(graphics) {
    const path = this.maze.path;
    if (!path || path.length < 2) return;

    graphics.lineStyle(2, 0x00ffff, 0.5);

    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];

      const x1 = current.x * this.tileSize + this.tileSize / 2;
      const y1 = current.y * this.tileSize + this.tileSize / 2;
      const x2 = next.x * this.tileSize + this.tileSize / 2;
      const y2 = next.y * this.tileSize + this.tileSize / 2;

      // Draw small dots along the path to show direction
      const dotX = x1 + (x2 - x1) * 0.5;
      const dotY = y1 + (y2 - y1) * 0.5;

      graphics.fillStyle(0x00ffff, 0.6);
      graphics.fillCircle(dotX, dotY, 2);
    }
  }

  drawEntryExitMarkers(graphics) {
    const entry = this.maze.entry;
    const exit = this.maze.exit;

    // Entry marker (green glow)
    const entryX = entry.x * this.tileSize + this.tileSize / 2;
    const entryY = entry.y * this.tileSize + this.tileSize / 2;

    graphics.lineStyle(3, 0x00ff00, 0.8);
    graphics.strokeCircle(entryX, entryY, this.tileSize / 3);
    graphics.fillStyle(0x00ff00, 0.4);
    graphics.fillCircle(entryX, entryY, this.tileSize / 4);

    // Exit marker (red glow)
    const exitX = exit.x * this.tileSize + this.tileSize / 2;
    const exitY = exit.y * this.tileSize + this.tileSize / 2;

    graphics.lineStyle(3, 0xff0000, 0.8);
    graphics.strokeCircle(exitX, exitY, this.tileSize / 3);
    graphics.fillStyle(0xff0000, 0.4);
    graphics.fillCircle(exitX, exitY, this.tileSize / 4);
  }

  setupUI() {
    // HUD
    this.hud = new HUD();
    this.hud.show();

    // Tower menu
    this.towerMenu = new TowerMenu();
    this.towerMenu.show();
    this.towerMenu.onTowerSelect = (type) => {
      this.inputManager.selectTowerType(type);
    };
    this.towerMenu.onTowerDeselect = () => {
      this.inputManager.cancelSelection();
    };

    // Chat panel - hidden by default in game, with notification support
    this.chatPanel = new ChatPanel();
    this.chatPanel.hide(); // Hidden by default - use Menu to show

    // Setup global menu with volume controls, code, chat toggle, pause, and quit
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
      buttons: [
        {
          id: 'pause',
          label: 'Pause Game',
          hotkey: HOTKEYS.PAUSE,
          onClick: () => {
            networkManager.pauseGame();
          }
        },
        {
          id: 'quit',
          label: 'Quit Game',
          hotkey: HOTKEYS.QUIT,
          danger: true,
          onClick: () => {
            this.handleQuitGame();
          }
        }
      ],
      position: 'top-right'
    });
    this.gameMenu.show();

    // Wire up unread notification callback to menu badge
    this.chatPanel.onUnreadChange = (count) => {
      this.gameMenu.setUnreadCount(count);
    };

    // Pause overlay
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.pausedByText = document.getElementById('paused-by');
    this.resumeBtn = document.getElementById('resume-btn');

    this.resumeBtn.addEventListener('click', () => {
      log('[GAME]', 'Resume button clicked, socket connected:', networkManager.connected);
      networkManager.resumeGame();
    });

    // If rejoining a paused game, show the pause overlay immediately
    if (this.initialStatus === GAME_STATUS.PAUSED) {
      log('[REJOIN]', 'Game is paused, showing pause overlay');
      this.pausedByText.textContent = 'Game paused (reconnected)';
      this.pauseOverlay.classList.remove('hidden');
      soundManager.pauseMusic();
    }

    // Confirm modal elements
    this.confirmModal = document.getElementById('confirm-modal');
    this.confirmTitle = document.getElementById('confirm-title');
    this.confirmMessage = document.getElementById('confirm-message');
    this.confirmYesBtn = document.getElementById('confirm-yes');
    this.confirmNoBtn = document.getElementById('confirm-no');
  }

  handleQuitGame() {
    this.showConfirmDialog('Quit Game', 'Are you sure you want to quit the game?', () => {
      localStorage.removeItem('activeGameSession');
      log('[REJOIN]', 'Cleared active session (player quit)');
      networkManager.leaveGame();
      this.cleanupAndReturn();
    });
  }

  showConfirmDialog(title, message, onConfirm) {
    this.confirmTitle.textContent = title;
    this.confirmMessage.textContent = message;
    this.confirmModal.classList.remove('hidden');

    // Store callback and set up one-time handlers
    const handleYes = () => {
      this.confirmModal.classList.add('hidden');
      this.confirmYesBtn.removeEventListener('click', handleYes);
      this.confirmNoBtn.removeEventListener('click', handleNo);
      onConfirm();
    };

    const handleNo = () => {
      this.confirmModal.classList.add('hidden');
      this.confirmYesBtn.removeEventListener('click', handleYes);
      this.confirmNoBtn.removeEventListener('click', handleNo);
    };

    this.confirmYesBtn.addEventListener('click', handleYes);
    this.confirmNoBtn.addEventListener('click', handleNo);
  }

  cleanupAndReturn() {
    this.shutdown();
    this.hud.hide();
    this.towerMenu.hide();
    this.chatPanel.hide();
    this.gameMenu.hide();
    this.scene.stop('GameOverScene');
    this.scene.start('MenuScene');
  }

  // Helper to register network handlers and track them for cleanup
  registerNetworkHandler(event, handler) {
    networkManager.on(event, handler);
    this.networkHandlers.push({ event, handler });
  }

  setupNetworkListeners() {
    // Clean up any existing handlers FIRST to prevent accumulation
    if (this.networkHandlers && this.networkHandlers.length > 0) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }

    // Handle rejoin success (after socket reconnect from standby)
    this.registerNetworkHandler(SOCKET_EVENTS.REJOIN_SUCCESS, (data) => {
      log('[REJOIN]', 'Rejoined game successfully after reconnect');
      // Update local state with server state
      this.gameState = data.gameState;

      // Sync TowerMenu's selectedTower reference to the new gameState
      // (prevents stale tower data in upgrade panel after rejoin)
      if (this.towerMenu.selectedTower) {
        const updatedTower = this.gameState.towers.find(
          t => t.id === this.towerMenu.selectedTower.id
        );
        if (updatedTower) {
          this.towerMenu.selectedTower = updatedTower;
        }
      }

      this.hud.update({
        lives: this.gameState.lives,
        budget: this.gameState.budget,
        wave: this.gameState.currentWave
      });
      this.towerMenu.updateBudget(this.gameState.budget);

      // If game is paused, show the pause overlay
      if (data.status === GAME_STATUS.PAUSED) {
        log('[REJOIN]', 'Game is paused, showing overlay');
        this.isPaused = true;
        this.pausedByText.textContent = 'Game paused (reconnected)';
        this.pauseOverlay.classList.remove('hidden');
        soundManager.pauseMusic();
      }
    });

    // Handle rejoin error (game was deleted/expired)
    this.registerNetworkHandler(SOCKET_EVENTS.REJOIN_ERROR, (data) => {
      log('[REJOIN]', 'Failed to rejoin game:', data.message);
      networkManager.clearSavedSession();
      // Hide pause overlay before leaving scene (it's a DOM element that persists)
      if (this.pauseOverlay) {
        this.pauseOverlay.classList.add('hidden');
      }
      // Go back to menu with error message
      this.scene.start('MenuScene', {
        toast: data.message || 'Your game session has ended',
        toastDuration: 4000
      });
    });

    // Game state sync
    this.registerNetworkHandler(SOCKET_EVENTS.GAME_STATE_SYNC, (data) => {
      this.updateGameState(data);
    });

    // Tower placed
    this.registerNetworkHandler(SOCKET_EVENTS.TOWER_PLACED, (data) => {
      this.gameState.budget = data.newBudget;
      this.gameState.towers.push(data.tower);
      this.createTowerSprite(data.tower);
      this.hud.updateBudget(data.newBudget);
      this.towerMenu.updateBudget(data.newBudget);

      // Play sound (quieter if placed by another player)
      const isOtherPlayer = data.playerId && data.playerId !== networkManager.socket.id;
      soundManager.play('tower_place', { isOtherPlayer });
    });

    // Tower upgraded
    this.registerNetworkHandler(SOCKET_EVENTS.TOWER_UPGRADED, (data) => {
      this.gameState.budget = data.newBudget;
      const tower = this.gameState.towers.find(t => t.id === data.towerId);
      if (tower) {
        tower.level = data.newLevel;
      }
      const sprite = this.towerSprites.get(data.towerId);
      if (sprite) {
        sprite.updateLevel(data.newLevel);
      }
      this.hud.updateBudget(data.newBudget);
      // updateBudget will refresh the upgrade panel with new level/cost info
      this.towerMenu.updateBudget(data.newBudget);

      // Play sound (quieter if upgraded by another player)
      const isOtherPlayer = data.playerId && data.playerId !== networkManager.socket.id;
      soundManager.play('tower_upgrade', { isOtherPlayer });
    });

    // Tower sold
    this.registerNetworkHandler(SOCKET_EVENTS.TOWER_SOLD, (data) => {
      this.gameState.budget = data.newBudget;

      // Remove tower from gameState.towers
      const towerIndex = this.gameState.towers.findIndex(t => t.id === data.towerId);
      if (towerIndex !== -1) {
        this.gameState.towers.splice(towerIndex, 1);
      }

      // Destroy tower sprite
      const sprite = this.towerSprites.get(data.towerId);
      if (sprite) {
        sprite.destroy();
        this.towerSprites.delete(data.towerId);
      }

      this.hud.updateBudget(data.newBudget);
      this.towerMenu.updateBudget(data.newBudget);
      this.towerMenu.hideUpgradePanel();

      // Clear InputManager's selected tower reference if it was the sold tower
      if (this.inputManager.selectedTower && this.inputManager.selectedTower.id === data.towerId) {
        this.inputManager.selectedTower = null;
      }

      // Clear placement preview (it may show stale "can't place" indicator)
      this.placementPreview.clear();

      // Play sound (quieter if sold by another player)
      const isOtherPlayer = data.playerId && data.playerId !== networkManager.socket.id;
      soundManager.play('tower_sell', { isOtherPlayer });
    });

    // Tower error
    this.registerNetworkHandler(SOCKET_EVENTS.TOWER_ERROR, (data) => {
      console.log('Tower error:', data.error);

      // Play error sound based on error type
      if (data.error && (data.error.includes('budget') || data.error.includes('afford'))) {
        soundManager.play('error_funds');
      } else {
        soundManager.play('error_placement');
      }
    });

    // Enemy killed - show death effect and update budget
    this.registerNetworkHandler(SOCKET_EVENTS.ENEMY_KILLED, (data) => {
      this.showDeathEffect(data.x, data.y);
      this.gameState.budget = data.newBudget;
      this.hud.updateBudget(data.newBudget);
      this.towerMenu.updateBudget(data.newBudget);

      // Play death sound based on enemy type
      const deathSound = data.enemyType ? `death_${data.enemyType}` : 'death_generic';
      soundManager.play(deathSound);
    });

    // Enemy reached exit
    this.registerNetworkHandler(SOCKET_EVENTS.ENEMY_REACHED_EXIT, (data) => {
      this.gameState.lives = data.livesRemaining;
      this.hud.updateLives(data.livesRemaining);

      // Play critical alarm sound
      soundManager.play('enemy_exit');
    });

    // Wave events
    this.registerNetworkHandler(SOCKET_EVENTS.WAVE_START, (data) => {
      this.gameState.currentWave = data.waveNumber;
      this.hud.updateWave(data.waveNumber);

      // Boss wave - use special notification and music
      if (data.composition && data.composition.boss) {
        this.showBossWaveNotification(data.waveNumber);
        soundManager.playBossMusic(data.waveNumber);
      } else {
        this.showWaveNotification(`Wave ${data.waveNumber} Starting!`);
        soundManager.play('wave_start');
      }
    });

    this.registerNetworkHandler(SOCKET_EVENTS.WAVE_COMPLETE, (data) => {
      this.showWaveNotification(`Wave ${data.waveNumber} Complete!`);
      soundManager.play('wave_complete');

      // Resume gameplay music after boss wave
      if (data.boss) {
        soundManager.resumeGameplayMusic();
      }
    });

    // Pause/Resume
    this.registerNetworkHandler(SOCKET_EVENTS.GAME_PAUSED, (data) => {
      this.isPaused = true;
      this.pausedByText.textContent = `Paused by ${data.pausedBy}`;
      this.pauseOverlay.classList.remove('hidden');
      soundManager.play('pause');
      soundManager.pauseMusic();
    });

    this.registerNetworkHandler(SOCKET_EVENTS.GAME_RESUMED, () => {
      log('[GAME]', 'Received GAME_RESUMED from server');
      this.isPaused = false;
      this.pauseOverlay.classList.add('hidden');
      soundManager.play('unpause');
      soundManager.resumeMusic();
    });

    // Game over
    this.registerNetworkHandler(SOCKET_EVENTS.GAME_OVER, (data) => {
      // Clear session storage - game is over
      localStorage.removeItem('activeGameSession');
      log('[REJOIN]', 'Cleared active session (game over)');

      // Play game over music based on final wave (good if >= TOTAL_WAVES, bad otherwise)
      soundManager.playGameOverMusic(data.finalWave);

      // Reconfigure menu for game over state: only "Back to Main Menu" button, no pause/chat
      this.gameMenu.configure({
        showSessionCode: true,
        sessionCode: this.sessionCode,
        buttons: [
          {
            id: 'leave',
            label: 'Back to Main Menu',
            hotkey: HOTKEYS.MAIN_MENU,
            danger: true,
            onClick: () => {
              // Go directly to menu without confirmation since game is over
              localStorage.removeItem('activeGameSession');
              networkManager.leaveGame();
              this.cleanupAndReturn();
            }
          }
        ],
        position: 'top-right'  // Use top-right so menu stays visible when HUD is hidden
        // No chatToggle = hides the chat toggle section
      });

      // Clean up network handlers to prevent stale events firing on defunct scene
      this.cleanupNetworkHandlers();

      this.scene.start('GameOverScene', {
        victory: data.victory,
        finalWave: data.finalWave,
        stats: data.stats
      });
    });

    // Tower fired - show projectile
    this.registerNetworkHandler(SOCKET_EVENTS.TOWER_FIRED, (data) => {
      this.createProjectile(data);

      // Play tower firing sound
      const fireSoundMap = {
        machineGun: 'machinegun_fire',
        missileLauncher: 'missile_fire',
        teslaCoil: 'tesla_fire',
        cryoCannon: 'cryo_fire',
        plasmaTurret: 'plasma_fire'
      };
      const fireSound = fireSoundMap[data.towerType];
      if (fireSound) {
        soundManager.play(fireSound);
      }
    });

  }

  updateGameState(data) {
    // Update budget and lives
    this.gameState.budget = data.budget;
    this.gameState.lives = data.lives;
    this.gameState.currentWave = data.wave;

    this.hud.update({
      budget: data.budget,
      lives: data.lives,
      wave: data.wave
    });

    this.towerMenu.updateBudget(data.budget);

    // Store enemy data directly - will be rendered in update() loop
    this.enemyData = data.enemies;

    // Update selected enemy panel if one is selected
    if (this.inputManager.selectedEnemyId) {
      const enemy = this.enemyData.find(e => e.id === this.inputManager.selectedEnemyId);
      if (enemy) {
        // Update with live health
        this.towerMenu.updateEnemyPanel(enemy);
        this.selectedEnemyGoneHandled = false; // Reset flag when enemy is alive
      } else if (!this.selectedEnemyGoneHandled) {
        // Enemy gone - only handle ONCE (first tick after disappearing)
        const escapedIds = data.escapedIds || [];
        const escaped = escapedIds.includes(this.inputManager.selectedEnemyId);
        this.towerMenu.showEnemyGone(escaped);
        this.selectedEnemyGoneHandled = true; // Don't keep overwriting
      }
    }
  }

  // Phaser update loop - called every frame
  // Using scene update() for projectiles is more reliable than time.addEvent()
  // which can break after visibility changes (laptop standby, F5 refresh)
  update(time, delta) {
    this.drawEnemies();

    // Update projectiles every frame
    if (this.projectiles.length > 0) {
      this.updateProjectiles(delta);
    }
  }

  // Draw all enemies using single graphics object (testgame approach)
  drawEnemies() {
    this.enemyGraphics.clear();

    const selectedId = this.inputManager.selectedEnemyId;

    for (const enemy of this.enemyData) {
      const visual = CLIENT_CONFIG.enemyVisuals[enemy.type];
      const enemyDef = ENEMIES[enemy.type];
      const size = enemyDef.size;

      // Draw selection ring if this specific enemy is selected (exact ID match)
      const isSelected = selectedId && enemy.id && String(selectedId) === String(enemy.id);
      if (isSelected) {
        this.enemyGraphics.lineStyle(2, 0xffff00, 0.9);
        this.enemyGraphics.strokeCircle(enemy.x, enemy.y, size + 4);
      }

      // Draw enemy body
      this.enemyGraphics.fillStyle(visual.color, 1);
      this.enemyGraphics.fillCircle(enemy.x, enemy.y, size);

      // Draw outline
      this.enemyGraphics.lineStyle(1, 0xffffff, 0.5);
      this.enemyGraphics.strokeCircle(enemy.x, enemy.y, size);

      // Draw health bar
      const healthPercent = enemy.health / enemy.maxHealth;
      const barWidth = size * 2.5;
      const barHeight = 3;
      const barY = enemy.y - size - 6;

      // Health bar background
      this.enemyGraphics.fillStyle(0x333333, 1);
      this.enemyGraphics.fillRect(enemy.x - barWidth / 2, barY, barWidth, barHeight);

      // Health bar fill
      const healthColor = healthPercent > 0.3 ? 0x00ff00 : 0xff4444;
      this.enemyGraphics.fillStyle(healthColor, 1);
      this.enemyGraphics.fillRect(enemy.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
    }
  }

  createTowerSprite(tower) {
    // Prevent duplicate sprites for same tower
    if (this.towerSprites.has(tower.id)) {
      return;
    }

    const sprite = new TowerSprite(this, tower, this.tileSize);
    this.towerSprites.set(tower.id, sprite);

    sprite.on('pointerdown', () => {
      // Look up fresh tower data from gameState (closure tower may be stale after rejoin)
      const currentTower = this.gameState.towers.find(t => t.id === tower.id);
      this.inputManager.selectTower(currentTower || tower);
    });

    sprite.on('pointerover', () => {
      sprite.showRange();
    });

    sprite.on('pointerout', () => {
      sprite.hideRange();
    });
  }

  updatePlacementPreview(gridX, gridY, towerType) {
    this.placementPreview.clear();

    if (gridX < 0 || gridX >= this.gridSize ||
        gridY < 0 || gridY >= this.gridSize) {
      return;
    }

    const tileType = this.maze.grid[gridY]?.[gridX];
    const existingTower = this.gameState.towers.find(
      t => t.gridX === gridX && t.gridY === gridY
    );

    const canPlace = tileType === TILE_TYPES.BUILDABLE && !existingTower;
    const color = canPlace ? 0x00ff00 : 0xff0000;

    this.placementPreview.fillStyle(color, 0.3);
    this.placementPreview.fillRect(
      gridX * this.tileSize,
      gridY * this.tileSize,
      this.tileSize,
      this.tileSize
    );

    // Show range preview
    if (canPlace) {
      const towerDef = TOWERS[towerType];
      const range = towerDef.range * this.tileSize;
      const centerX = gridX * this.tileSize + this.tileSize / 2;
      const centerY = gridY * this.tileSize + this.tileSize / 2;

      this.placementPreview.lineStyle(1, 0xffffff, 0.3);
      this.placementPreview.strokeCircle(centerX, centerY, range);
    }
  }

  showPlacementMode() {
    // Visual indicator that placement mode is active
  }

  hidePlacementMode() {
    this.placementPreview.clear();
  }

  showUpgradePanel(tower) {
    this.towerMenu.showUpgradePanel(tower, this.gameState.budget);
  }

  hideUpgradePanel() {
    this.towerMenu.hideUpgradePanel();
  }

  showEnemyPanel(enemy) {
    this.towerMenu.showEnemyPanel(enemy);
  }

  hideEnemyPanel() {
    this.towerMenu.hideEnemyPanel();
  }

  showWaveNotification(text) {
    const mazeCenterX = this.mazePixelSize / 2;
    const mazeCenterY = this.mazePixelSize / 2;
    const notification = this.add.text(
      mazeCenterX,
      mazeCenterY,
      text,
      {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: notification,
      y: notification.y - 50,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  showBossWaveNotification(waveNumber) {
    const mazeCenterX = this.mazePixelSize / 2;
    const mazeCenterY = this.mazePixelSize / 2;
    // Main warning text - large red with emoji accents
    const mainText = this.add.text(
      mazeCenterX,
      mazeCenterY - 20,
      '⚡ BOSS WAVE ⚡',
      {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ff3333',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 6
      }
    ).setOrigin(0.5).setDepth(200).setScale(0).setAlpha(0);

    // Secondary wave number text
    const waveText = this.add.text(
      mazeCenterX,
      mazeCenterY + 30,
      `Wave ${waveNumber}`,
      {
        fontSize: '28px',
        color: '#ffffff',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(200).setScale(0).setAlpha(0);

    // Animation Stage 1: Scale in with bounce (0-500ms)
    this.tweens.add({
      targets: [mainText, waveText],
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Animation Stage 2: Pulse effect (500ms-2000ms)
        this.tweens.add({
          targets: mainText,
          scale: 1.1,
          duration: 250,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Animation Stage 3: Fade out + rise (2000ms-3000ms)
            this.tweens.add({
              targets: [mainText, waveText],
              y: '-=50',
              alpha: 0,
              duration: 1000,
              ease: 'Power2',
              onComplete: () => {
                mainText.destroy();
                waveText.destroy();
              }
            });
          }
        });
      }
    });
  }

  createProjectile(data) {
    const { towerType, fromX, fromY, toX, toY, targetId, hit } = data;
    const towerDef = TOWERS[towerType];
    const color = towerDef.color;

    // Store projectile with targetId for live tracking
    const projectile = {
      x: fromX,
      y: fromY,
      targetId: targetId,       // Track enemy by ID for live position
      lastTargetX: toX,         // Fallback position if enemy dies
      lastTargetY: toY,
      type: towerType,
      color: color,
      speed: 300,
      hit: hit
    };

    this.projectiles.push(projectile);
    // No timer management needed - scene update() handles projectile rendering
  }

  updateProjectiles(delta) {
    this.projectileGraphics.clear();

    // Filter out completed projectiles and draw active ones
    this.projectiles = this.projectiles.filter(p => {
      // Find current target position (live tracking)
      const target = this.enemyData.find(e => e.id === p.targetId);

      let targetX, targetY;
      if (target) {
        // Enemy still alive - track its current position
        targetX = target.x;
        targetY = target.y;
        p.lastTargetX = targetX;
        p.lastTargetY = targetY;
      } else {
        // Enemy died - continue to last known position
        targetX = p.lastTargetX;
        targetY = p.lastTargetY;
      }

      // Calculate distance to target
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if projectile reached target
      if (dist < 5) {
        if (p.hit) {
          this.showImpactEffect(targetX, targetY, p.color);
        }
        return false; // Remove projectile
      }

      // Move toward current target position using actual delta time
      const moveSpeed = p.speed * (delta / 1000);
      p.x += (dx / dist) * moveSpeed;
      p.y += (dy / dist) * moveSpeed;

      // Draw projectile based on type
      this.drawProjectile(p.type, p.x, p.y, targetX, targetY, p.color);

      return true; // Keep projectile
    });
  }

  drawProjectile(type, x, y, targetX, targetY, color) {
    const special = TOWERS[type].special;

    if (special === 'chain') {
      // Tesla coil - lightning bolt effect
      this.projectileGraphics.lineStyle(1, color, 0.8);
      this.drawLightningBolt(x, y, targetX, targetY);
    } else if (special === 'slow') {
      // Cryo cannon - small crystal
      this.projectileGraphics.fillStyle(color, 0.9);
      this.projectileGraphics.fillCircle(x, y, 3);
    } else if (special === 'splash') {
      // Missile launcher - small projectile
      this.projectileGraphics.fillStyle(color, 1);
      this.projectileGraphics.fillCircle(x, y, 3);
    } else if (special === 'pierce') {
      // Plasma turret - small orb
      this.projectileGraphics.fillStyle(color, 0.9);
      this.projectileGraphics.fillCircle(x, y, 3);
    } else {
      // Machine gun - small bullet
      this.projectileGraphics.fillStyle(color, 1);
      this.projectileGraphics.fillCircle(x, y, 3);
    }
  }

  drawLightningBolt(x1, y1, x2, y2) {
    const segments = 5;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;

    this.projectileGraphics.beginPath();
    this.projectileGraphics.moveTo(x1, y1);

    for (let i = 1; i < segments; i++) {
      const jitter = (Math.random() - 0.5) * 10;
      const px = x1 + dx * i + jitter;
      const py = y1 + dy * i + jitter;
      this.projectileGraphics.lineTo(px, py);
    }

    this.projectileGraphics.lineTo(x2, y2);
    this.projectileGraphics.strokePath();
  }

  showImpactEffect(x, y, color) {
    const impact = this.add.graphics();
    impact.setPosition(x, y);  // Position Graphics at impact location
    impact.setDepth(151);
    impact.fillStyle(color, 0.8);
    impact.fillCircle(0, 0, 4);  // Draw at (0,0) relative to Graphics position

    this.tweens.add({
      targets: impact,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 80,
      onComplete: () => impact.destroy()
    });
  }

  showDeathEffect(x, y) {
    const puff = this.add.graphics();
    puff.setPosition(x, y);
    puff.setDepth(151);
    puff.fillStyle(0xffffff, 0.6);
    puff.fillCircle(0, 0, 8);

    this.tweens.add({
      targets: puff,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 150,
      onComplete: () => puff.destroy()
    });
  }

  cleanupNetworkHandlers() {
    if (this.networkHandlers) {
      this.networkHandlers.forEach(({ event, handler }) => {
        networkManager.off(event, handler);
      });
      this.networkHandlers = [];
    }
  }

  shutdown() {
    this.cleanupNetworkHandlers();

    // Remove resize listener
    this.scale.off('resize', this.handleResize, this);

    // Cleanup sounds
    soundManager.cleanup();

    this.hud.hide();
    this.towerMenu.hide();
    this.towerMenu.hideEnemyPanel();
    this.inputManager.destroy();

    // Hide pause overlay (DOM element that persists across scene changes)
    if (this.pauseOverlay) {
      this.pauseOverlay.classList.add('hidden');
    }
  }
}

// ES module export
export { GameScene };
