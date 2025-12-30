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
  }

  create() {
    // Calculate dimensions
    const mazeSize = Object.entries(MAZE_SIZES).find(
      ([key, val]) => val.grid === this.maze.grid.length
    );
    this.mazeConfig = mazeSize ? MAZE_SIZES[mazeSize[0]] : MAZE_SIZES.medium;
    this.gridSize = this.maze.grid.length;
    this.tileSize = this.mazeConfig.tileSize;

    // Arrays to hold game objects
    this.towers = [];
    this.towerSprites = new Map();

    // Enemy data from server (rendered directly, no individual sprites)
    this.enemyData = [];

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

    // Chat panel
    this.chatPanel = new ChatPanel();
    this.chatPanel.show();

    // Pause overlay
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.pausedByText = document.getElementById('paused-by');
    this.resumeBtn = document.getElementById('resume-btn');

    this.resumeBtn.addEventListener('click', () => {
      networkManager.resumeGame();
    });

    // Game menu dropdown
    this.menuToggleBtn = document.getElementById('menu-toggle-btn');
    this.menuDropdown = document.getElementById('game-menu-dropdown');
    this.menuCodeValue = document.getElementById('menu-code-value');
    this.menuPauseBtn = document.getElementById('menu-pause-btn');
    this.menuChatBtn = document.getElementById('menu-chat-btn');

    // Set session code in menu
    this.menuCodeValue.textContent = this.sessionCode;

    // Copy code button - use onclick to replace any existing handler
    this.menuCopyBtn = document.getElementById('menu-copy-btn');
    this.menuCopyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(this.sessionCode);
      this.menuCopyBtn.textContent = 'Copied!';
      setTimeout(() => {
        this.menuCopyBtn.textContent = 'Copy';
      }, 1500);
    };

    // Menu toggle - use onclick to replace any existing handler (prevents duplicate listeners)
    this.menuToggleBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.menuDropdown.classList.toggle('hidden');
      // Position and update dropdown when menu opens
      if (!this.menuDropdown.classList.contains('hidden')) {
        // Position dropdown below the button, aligned to its right edge
        const btnRect = this.menuToggleBtn.getBoundingClientRect();
        const dropdownWidth = this.menuDropdown.offsetWidth;
        // Align right edge of dropdown with right edge of button
        let left = btnRect.right - dropdownWidth;
        // Make sure it doesn't go off the left edge of screen
        if (left < 10) left = 10;
        this.menuDropdown.style.top = (btnRect.bottom + 5) + 'px';
        this.menuDropdown.style.left = left + 'px';
        this.updateChatButtonText();
      }
    };

    // Close menu when clicking outside - use a named handler to avoid duplicates
    if (!window._menuCloseHandlerAdded) {
      window._menuCloseHandlerAdded = true;
      document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('game-menu-dropdown');
        const toggleBtn = document.getElementById('menu-toggle-btn');
        if (dropdown && toggleBtn && !toggleBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }

    // Pause button in menu - use onclick to replace any existing handler
    this.menuPauseBtn.onclick = () => {
      networkManager.pauseGame();
      this.menuDropdown.classList.add('hidden');
    };

    // Chat toggle button in menu - use onclick to replace any existing handler
    this.menuChatBtn.onclick = () => {
      this.chatPanel.toggle();
      this.updateChatButtonText();
      this.menuDropdown.classList.add('hidden');
    };
  }

  updateChatButtonText() {
    if (this.chatPanel.isVisible) {
      this.menuChatBtn.textContent = 'Hide Chat';
    } else {
      this.menuChatBtn.textContent = 'Show Chat';
    }
  }

  setupNetworkListeners() {
    // Game state sync
    networkManager.on(SOCKET_EVENTS.GAME_STATE_SYNC, (data) => {
      this.updateGameState(data);
    });

    // Tower placed
    networkManager.on(SOCKET_EVENTS.TOWER_PLACED, (data) => {
      this.gameState.budget = data.newBudget;
      this.gameState.towers.push(data.tower);
      this.createTowerSprite(data.tower);
      this.hud.updateBudget(data.newBudget);
      this.towerMenu.updateBudget(data.newBudget);
    });

    // Tower upgraded
    networkManager.on(SOCKET_EVENTS.TOWER_UPGRADED, (data) => {
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
    });

    // Tower sold
    networkManager.on(SOCKET_EVENTS.TOWER_SOLD, (data) => {
      this.gameState.budget = data.newBudget;

      // Remove tower from local state
      const towerIndex = this.gameState.towers.findIndex(t => t.id === data.towerId);
      if (towerIndex !== -1) {
        this.gameState.towers.splice(towerIndex, 1);
      }

      // Remove tower from towers array
      const towersIndex = this.towers.findIndex(t => t.id === data.towerId);
      if (towersIndex !== -1) {
        this.towers.splice(towersIndex, 1);
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
    });

    // Tower error
    networkManager.on(SOCKET_EVENTS.TOWER_ERROR, (data) => {
      console.log('Tower error:', data.error);
    });

    // Enemy killed - show death effect and update budget
    networkManager.on(SOCKET_EVENTS.ENEMY_KILLED, (data) => {
      this.showDeathEffect(data.x, data.y);
      this.gameState.budget = data.newBudget;
      this.hud.updateBudget(data.newBudget);
      this.towerMenu.updateBudget(data.newBudget);
    });

    // Enemy reached exit
    networkManager.on(SOCKET_EVENTS.ENEMY_REACHED_EXIT, (data) => {
      this.gameState.lives = data.livesRemaining;
      this.hud.updateLives(data.livesRemaining);
    });

    // Wave events
    networkManager.on(SOCKET_EVENTS.WAVE_START, (data) => {
      this.gameState.currentWave = data.waveNumber;
      this.hud.updateWave(data.waveNumber);
      this.showWaveNotification(`Wave ${data.waveNumber} Starting!`);
    });

    networkManager.on(SOCKET_EVENTS.WAVE_COMPLETE, (data) => {
      this.showWaveNotification(`Wave ${data.waveNumber} Complete!`);
    });

    // Pause/Resume
    networkManager.on(SOCKET_EVENTS.GAME_PAUSED, (data) => {
      this.pausedByText.textContent = `Paused by ${data.pausedBy}`;
      this.pauseOverlay.classList.remove('hidden');
    });

    networkManager.on(SOCKET_EVENTS.GAME_RESUMED, () => {
      this.pauseOverlay.classList.add('hidden');
    });

    // Game over
    networkManager.on(SOCKET_EVENTS.GAME_OVER, (data) => {
      this.scene.start('GameOverScene', {
        victory: data.victory,
        finalWave: data.finalWave,
        stats: data.stats
      });
    });

    // Tower fired - show projectile
    networkManager.on(SOCKET_EVENTS.TOWER_FIRED, (data) => {
      this.createProjectile(data);
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
  }

  // Phaser update loop - called every frame
  update() {
    this.drawEnemies();
  }

  // Draw all enemies using single graphics object (testgame approach)
  drawEnemies() {
    this.enemyGraphics.clear();

    for (const enemy of this.enemyData) {
      const visual = CLIENT_CONFIG.enemyVisuals[enemy.type];
      const enemyDef = ENEMIES[enemy.type];
      const size = enemyDef.size;

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
    const sprite = new TowerSprite(this, tower, this.tileSize);
    this.towerSprites.set(tower.id, sprite);
    this.towers.push(tower);

    sprite.on('pointerdown', () => {
      this.inputManager.selectTower(tower);
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
    const existingTower = this.towers.find(
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

  showPlacementMode(towerType) {
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
    const notification = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
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

  createProjectile(data) {
    const { towerType, fromX, fromY, toX, toY, targetId, hit } = data;
    const towerDef = TOWERS[towerType];
    const color = towerDef.color;

    // Store projectile with targetId for live tracking (like testgame)
    const projectile = {
      x: fromX,
      y: fromY,
      targetId: targetId,       // Track enemy by ID for live position
      lastTargetX: toX,         // Fallback position if enemy dies
      lastTargetY: toY,
      type: towerType,
      color: color,
      speed: 300,               // Match testgame speed
      hit: hit
    };

    this.projectiles.push(projectile);

    // Start update loop if not already running
    if (!this.projectileUpdateEvent) {
      this.projectileUpdateEvent = this.time.addEvent({
        delay: 16, // ~60fps
        callback: this.updateProjectiles,
        callbackScope: this,
        loop: true
      });
    }
  }

  updateProjectiles() {
    this.projectileGraphics.clear();

    // Filter out completed projectiles and draw active ones
    this.projectiles = this.projectiles.filter(p => {
      // Find current target position (live tracking like testgame)
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

      // Move toward CURRENT target position (like testgame)
      const moveSpeed = p.speed * (16 / 1000); // 16ms frame time
      p.x += (dx / dist) * moveSpeed;
      p.y += (dy / dist) * moveSpeed;

      // Draw projectile based on type
      this.drawProjectile(p.type, p.x, p.y, targetX, targetY, p.color, 0);

      return true; // Keep projectile
    });

    // Stop update loop if no projectiles
    if (this.projectiles.length === 0 && this.projectileUpdateEvent) {
      this.projectileUpdateEvent.remove();
      this.projectileUpdateEvent = null;
    }
  }

  drawProjectile(type, x, y, targetX, targetY, color, progress) {
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

  shutdown() {
    if (this.projectileUpdateEvent) {
      this.projectileUpdateEvent.remove();
      this.projectileUpdateEvent = null;
    }
    this.hud.hide();
    this.towerMenu.hide();
    this.towerMenu.hideEnemyPanel();
    this.sessionCodeDisplay.classList.add('hidden');
    this.inputManager.destroy();
  }
}
