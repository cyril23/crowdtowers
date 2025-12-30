class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.isMobile = this.detectMobile();
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.selectedEnemy = null;
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
  }

  setup() {
    // Pointer events work for both mouse and touch
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);

    // Keyboard shortcuts (desktop only)
    if (!this.isMobile) {
      this.setupKeyboardShortcuts();
    }
  }

  setupKeyboardShortcuts() {
    this.scene.input.keyboard.on('keydown-ESC', () => {
      this.cancelSelection();
    });

    this.scene.input.keyboard.on('keydown-P', () => {
      if (this.scene.gameState?.status === 'playing') {
        networkManager.pauseGame();
      } else if (this.scene.gameState?.status === 'paused') {
        networkManager.resumeGame();
      }
    });

    // Tower hotkeys
    this.scene.input.keyboard.on('keydown-ONE', () => this.selectTowerType('machineGun'));
    this.scene.input.keyboard.on('keydown-TWO', () => this.selectTowerType('missileLauncher'));
    this.scene.input.keyboard.on('keydown-THREE', () => this.selectTowerType('teslaCoil'));
    this.scene.input.keyboard.on('keydown-FOUR', () => this.selectTowerType('cryoCannon'));
    this.scene.input.keyboard.on('keydown-FIVE', () => this.selectTowerType('plasmaTurret'));
  }

  handlePointerDown(pointer) {
    if (!this.scene.maze || !this.scene.tileSize) return;

    const gridX = Math.floor(pointer.x / this.scene.tileSize);
    const gridY = Math.floor(pointer.y / this.scene.tileSize);

    // Check bounds
    if (gridX < 0 || gridX >= this.scene.gridSize ||
        gridY < 0 || gridY >= this.scene.gridSize) {
      return;
    }

    const tileType = this.scene.maze.grid[gridY]?.[gridX];

    // If we have a tower selected for placement
    if (this.selectedTowerType && tileType === TILE_TYPES.BUILDABLE) {
      // Check if tile already has a tower
      const existingTower = this.scene.towers.find(
        t => t.gridX === gridX && t.gridY === gridY
      );

      if (!existingTower) {
        networkManager.placeTower(this.selectedTowerType, gridX, gridY);
      }
      return;
    }

    // Check if clicking on existing tower
    const tower = this.scene.towers.find(
      t => t.gridX === gridX && t.gridY === gridY
    );

    if (tower) {
      this.selectTower(tower);
    } else {
      this.deselectTower();
    }
  }

  handlePointerMove(pointer) {
    if (!this.scene.maze || !this.selectedTowerType) return;

    const gridX = Math.floor(pointer.x / this.scene.tileSize);
    const gridY = Math.floor(pointer.y / this.scene.tileSize);

    // Update placement preview
    if (this.scene.updatePlacementPreview) {
      this.scene.updatePlacementPreview(gridX, gridY, this.selectedTowerType);
    }
  }

  handlePointerUp(pointer) {
    // Could be used for drag-and-drop placement
  }

  selectTowerType(type) {
    this.selectedTowerType = type;
    this.deselectTower();

    // Update UI
    if (this.scene.towerMenu) {
      this.scene.towerMenu.highlightTower(type);
    }

    // Show placement preview cursor
    if (this.scene.showPlacementMode) {
      this.scene.showPlacementMode(type);
    }
  }

  cancelSelection() {
    this.selectedTowerType = null;
    this.deselectTower();
    this.deselectEnemy();

    if (this.scene.towerMenu) {
      this.scene.towerMenu.clearHighlight();
    }

    if (this.scene.hidePlacementMode) {
      this.scene.hidePlacementMode();
    }
  }

  selectTower(tower) {
    this.selectedTower = tower;
    this.selectedTowerType = null;

    if (this.scene.showUpgradePanel) {
      this.scene.showUpgradePanel(tower);
    }
  }

  deselectTower() {
    this.selectedTower = null;

    if (this.scene.hideUpgradePanel) {
      this.scene.hideUpgradePanel();
    }
  }

  selectEnemy(enemy) {
    this.selectedEnemy = enemy;
    this.selectedTower = null;
    this.selectedTowerType = null;

    if (this.scene.showEnemyPanel) {
      this.scene.showEnemyPanel(enemy);
    }
  }

  deselectEnemy() {
    this.selectedEnemy = null;

    if (this.scene.hideEnemyPanel) {
      this.scene.hideEnemyPanel();
    }
  }

  destroy() {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
  }
}
