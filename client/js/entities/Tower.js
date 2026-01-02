import { TOWERS } from '../../../shared/constants.js';
import { CLIENT_CONFIG } from '../config.js';

class TowerSprite extends Phaser.GameObjects.Container {
  constructor(scene, tower, tileSize) {
    const x = tower.gridX * tileSize + tileSize / 2;
    const y = tower.gridY * tileSize + tileSize / 2;

    super(scene, x, y);

    this.id = tower.id;
    this.towerType = tower.type;
    this.gridX = tower.gridX;
    this.gridY = tower.gridY;
    this.level = tower.level;
    this.tileSize = tileSize;

    const towerDef = TOWERS[tower.type];
    const visual = CLIENT_CONFIG.towerVisuals[tower.type];
    const size = tileSize * 0.7;

    // Draw tower shape - create graphics without adding to scene (container manages it)
    this.graphics = new Phaser.GameObjects.Graphics(scene);
    this.drawTower(size, visual.color);
    this.add(this.graphics);

    // Level indicator
    if (tower.level > 1) {
      this.levelText = new Phaser.GameObjects.Text(scene, 0, -size / 2 - 8, `L${tower.level}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial'
      }).setOrigin(0.5);
      this.add(this.levelText);
    }

    // Range indicator (shown on hover/select) - create without adding to scene
    this.rangeIndicator = new Phaser.GameObjects.Graphics(scene);
    this.rangeIndicator.setAlpha(0);
    this.add(this.rangeIndicator);

    this.drawRangeIndicator(towerDef.range * tileSize);

    // Make interactive
    this.setSize(size, size);
    this.setInteractive();

    // Set depth to render above maze but below enemies
    this.setDepth(40);

    scene.add.existing(this);
  }

  drawTower(size, color) {
    this.graphics.clear();
    this.graphics.fillStyle(color, 1);
    this.graphics.lineStyle(2, 0xffffff, 0.5);

    const visual = CLIENT_CONFIG.towerVisuals[this.towerType];

    switch (visual.shape) {
    case 'square':
      this.graphics.fillRect(-size / 2, -size / 2, size, size);
      this.graphics.strokeRect(-size / 2, -size / 2, size, size);
      break;
    case 'circle':
      this.graphics.fillCircle(0, 0, size / 2);
      this.graphics.strokeCircle(0, 0, size / 2);
      break;
    case 'diamond':
      this.graphics.fillPoints([
        { x: 0, y: -size / 2 },
        { x: size / 2, y: 0 },
        { x: 0, y: size / 2 },
        { x: -size / 2, y: 0 }
      ], true);
      break;
    case 'triangle':
      this.graphics.fillTriangle(
        0, -size / 2,
        size / 2, size / 2,
        -size / 2, size / 2
      );
      break;
    case 'hexagon':
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        points.push({
          x: Math.cos(angle) * size / 2,
          y: Math.sin(angle) * size / 2
        });
      }
      this.graphics.fillPoints(points, true);
      break;
    }
  }

  drawRangeIndicator(range) {
    this.rangeIndicator.clear();
    this.rangeIndicator.lineStyle(1, 0xffffff, 0.3);
    this.rangeIndicator.fillStyle(0xffffff, 0.1);
    this.rangeIndicator.fillCircle(0, 0, range);
    this.rangeIndicator.strokeCircle(0, 0, range);
  }

  showRange() {
    this.rangeIndicator.setAlpha(1);
  }

  hideRange() {
    this.rangeIndicator.setAlpha(0);
  }

  updateLevel(newLevel) {
    this.level = newLevel;

    if (this.levelText) {
      this.levelText.setText(`L${newLevel}`);
    } else {
      const size = this.tileSize * 0.7;
      this.levelText = new Phaser.GameObjects.Text(this.scene, 0, -size / 2 - 8, `L${newLevel}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial'
      }).setOrigin(0.5);
      this.add(this.levelText);
    }

    // Update range indicator
    const towerDef = TOWERS[this.towerType];
    const newRange = (towerDef.range + (newLevel - 1) * 0.1) * this.tileSize;
    this.drawRangeIndicator(newRange);

    // Flash effect
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true
    });
  }

  destroy() {
    // Remove interactive to prevent further events
    this.removeInteractive();

    // Remove all event listeners
    this.removeAllListeners();

    // Destroy graphics objects (not just clear) to ensure full cleanup
    if (this.graphics) {
      this.graphics.destroy();
    }
    if (this.rangeIndicator) {
      this.rangeIndicator.destroy();
    }
    if (this.levelText) {
      this.levelText.destroy();
    }

    // Remove from scene's display list explicitly
    if (this.scene && this.scene.children) {
      this.scene.children.remove(this);
    }

    // Call parent destroy with fromScene=true to ensure full cleanup
    super.destroy(true);
  }
}

// ES module export
export { TowerSprite };
