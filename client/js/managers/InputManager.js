import { TILE_TYPES, ENEMIES, HOTKEYS } from '../../../shared/constants.js';
import { DeviceUtils } from '../config.js';
import { networkManager } from './NetworkManager.js';
import { settingsManager, isInputFocused } from './SettingsManager.js';

class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.isMobile = DeviceUtils.isMobile();
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.selectedEnemy = null;
    this.selectedEnemyId = null;
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
    // Cancel selection (ESC)
    this.scene.input.keyboard.on(HOTKEYS.CANCEL, () => {
      this.cancelSelection();
    });

    // Pause/Resume (P)
    this.scene.input.keyboard.on(HOTKEYS.PAUSE, () => {
      if (isInputFocused()) return;
      if (this.scene.isPaused) {
        networkManager.resumeGame();
      } else {
        networkManager.pauseGame();
      }
    });

    // Tower selection hotkeys (1-5)
    this.scene.input.keyboard.on(HOTKEYS.TOWER_1, () => {
      if (isInputFocused()) return;
      this.selectTowerType('machineGun');
    });
    this.scene.input.keyboard.on(HOTKEYS.TOWER_2, () => {
      if (isInputFocused()) return;
      this.selectTowerType('missileLauncher');
    });
    this.scene.input.keyboard.on(HOTKEYS.TOWER_3, () => {
      if (isInputFocused()) return;
      this.selectTowerType('teslaCoil');
    });
    this.scene.input.keyboard.on(HOTKEYS.TOWER_4, () => {
      if (isInputFocused()) return;
      this.selectTowerType('cryoCannon');
    });
    this.scene.input.keyboard.on(HOTKEYS.TOWER_5, () => {
      if (isInputFocused()) return;
      this.selectTowerType('plasmaTurret');
    });

    // Upgrade tower (U)
    this.scene.input.keyboard.on(HOTKEYS.UPGRADE, () => {
      if (isInputFocused()) return;
      if (this.scene.towerMenu?.hasSelectedTower()) {
        this.scene.towerMenu.triggerUpgrade();
      }
    });

    // Sell tower (S)
    this.scene.input.keyboard.on(HOTKEYS.SELL, () => {
      if (isInputFocused()) return;
      if (this.scene.towerMenu?.hasSelectedTower()) {
        this.scene.towerMenu.triggerSell();
      }
    });

    // Toggle chat (C)
    this.scene.input.keyboard.on(HOTKEYS.CHAT, () => {
      if (isInputFocused()) return;
      this.scene.chatPanel?.toggle();
      // Sync checkbox state with chat panel visibility
      if (this.scene.gameMenu && this.scene.chatPanel) {
        this.scene.gameMenu.setChatToggleState(this.scene.chatPanel.isVisible);
        if (this.scene.chatPanel.isVisible) {
          this.scene.gameMenu.clearUnread();
        }
      }
    });

    // Quit game (Q)
    this.scene.input.keyboard.on(HOTKEYS.QUIT, () => {
      if (isInputFocused()) return;
      this.scene.handleQuitGame?.();
    });

    // Toggle hotkey visibility (H)
    this.scene.input.keyboard.on(HOTKEYS.TOGGLE_HOTKEYS, () => {
      if (isInputFocused()) return;
      settingsManager.toggleShowHotkeys();
    });
  }

  handlePointerDown(pointer) {
    if (!this.scene.maze || !this.scene.tileSize) return;

    // Use worldX/worldY to account for camera zoom/scroll
    const gridX = Math.floor(pointer.worldX / this.scene.tileSize);
    const gridY = Math.floor(pointer.worldY / this.scene.tileSize);

    // Check bounds
    if (gridX < 0 || gridX >= this.scene.gridSize ||
        gridY < 0 || gridY >= this.scene.gridSize) {
      return;
    }

    const tileType = this.scene.maze.grid[gridY]?.[gridX];

    // If we have a tower selected for placement
    if (this.selectedTowerType && tileType === TILE_TYPES.BUILDABLE) {
      // Check if tile already has a tower
      const existingTower = this.scene.gameState.towers.find(
        t => t.gridX === gridX && t.gridY === gridY
      );

      if (!existingTower) {
        networkManager.placeTower(this.selectedTowerType, gridX, gridY);
      }
      return;
    }

    // Check if clicking on existing tower (use gameState.towers for fresh data after rejoin)
    const tower = this.scene.gameState.towers.find(
      t => t.gridX === gridX && t.gridY === gridY
    );

    if (tower) {
      this.selectTower(tower);
    } else {
      // Check if clicking on an enemy (only when not in building mode)
      const clickedEnemy = this.findEnemyAtPosition(pointer.worldX, pointer.worldY);
      if (clickedEnemy) {
        this.selectEnemy(clickedEnemy);
      } else {
        this.deselectTower();
        this.deselectEnemy();
      }
    }
  }

  findEnemyAtPosition(x, y) {
    if (!this.scene.enemyData) return null;

    for (const enemy of this.scene.enemyData) {
      const enemyDef = ENEMIES[enemy.type];
      if (!enemyDef) continue;

      const size = enemyDef.size;
      const clickBuffer = 4; // Extra pixels for easier clicking
      const dist = Math.sqrt(Math.pow(x - enemy.x, 2) + Math.pow(y - enemy.y, 2));

      if (dist <= size + clickBuffer) {
        return enemy;
      }
    }

    return null;
  }

  handlePointerMove(pointer) {
    if (!this.scene.maze || !this.selectedTowerType) return;

    // Use worldX/worldY to account for camera zoom/scroll
    const gridX = Math.floor(pointer.worldX / this.scene.tileSize);
    const gridY = Math.floor(pointer.worldY / this.scene.tileSize);

    // Update placement preview
    if (this.scene.updatePlacementPreview) {
      this.scene.updatePlacementPreview(gridX, gridY, this.selectedTowerType);
    }
  }

  handlePointerUp(_pointer) {
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
      this.scene.showPlacementMode();
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
    this.selectedEnemyId = enemy.id;
    this.selectedTower = null;
    this.selectedTowerType = null;

    if (this.scene.towerMenu) {
      this.scene.towerMenu.clearHighlight();
    }

    if (this.scene.showEnemyPanel) {
      this.scene.showEnemyPanel(enemy);
    }
  }

  deselectEnemy() {
    this.selectedEnemy = null;
    this.selectedEnemyId = null;

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

// ES module export
export { InputManager };
