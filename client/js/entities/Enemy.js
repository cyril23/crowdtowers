import { ENEMIES } from '../../../shared/constants.js';
import { CLIENT_CONFIG } from '../config.js';

class EnemySprite extends Phaser.GameObjects.Container {
  constructor(scene, enemy, tileSize) {
    super(scene, enemy.x, enemy.y);

    this.id = enemy.id;
    this.enemyType = enemy.type;
    this.health = enemy.health;
    this.maxHealth = enemy.maxHealth;
    this.tileSize = tileSize;

    const enemyDef = ENEMIES[enemy.type];
    const visual = CLIENT_CONFIG.enemyVisuals[enemy.type];
    const size = enemyDef.size;

    // Draw enemy shape - create without adding to scene (container manages it)
    this.graphics = new Phaser.GameObjects.Graphics(scene);
    this.drawEnemy(size, visual.color, visual.shape);
    this.add(this.graphics);

    // Health bar - create without adding to scene
    this.healthBarBg = new Phaser.GameObjects.Graphics(scene);
    this.healthBarFill = new Phaser.GameObjects.Graphics(scene);
    this.drawHealthBar(size);
    this.add(this.healthBarBg);
    this.add(this.healthBarFill);

    // Make interactive for selection
    this.setSize(size * 2.5, size * 2.5);
    this.setInteractive();

    // Set depth to render above maze and towers
    this.setDepth(50);

    scene.add.existing(this);
  }

  drawEnemy(size, color, shape) {
    this.graphics.clear();
    this.graphics.fillStyle(color, 1);
    this.graphics.lineStyle(1, 0xffffff, 0.5);

    switch (shape) {
    case 'circle':
      this.graphics.fillCircle(0, 0, size);
      this.graphics.strokeCircle(0, 0, size);
      break;
    case 'square':
      this.graphics.fillRect(-size, -size, size * 2, size * 2);
      this.graphics.strokeRect(-size, -size, size * 2, size * 2);
      break;
    case 'diamond':
      this.graphics.fillPoints([
        { x: 0, y: -size },
        { x: size, y: 0 },
        { x: 0, y: size },
        { x: -size, y: 0 }
      ], true);
      break;
    case 'triangle':
      this.graphics.fillTriangle(
        0, -size,
        size, size,
        -size, size
      );
      break;
    case 'hexagon':
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        points.push({
          x: Math.cos(angle) * size,
          y: Math.sin(angle) * size
        });
      }
      this.graphics.fillPoints(points, true);
      break;
    }
  }

  drawHealthBar(enemySize) {
    const barWidth = enemySize * 2.5;
    const barHeight = 3;
    const barY = -enemySize - 6;

    // Background
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(CLIENT_CONFIG.colors.healthBarBg, 0.8);
    this.healthBarBg.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // Fill
    this.updateHealthBar();
  }

  updateHealthBar() {
    const enemyDef = ENEMIES[this.enemyType];
    const barWidth = enemyDef.size * 2.5;
    const barHeight = 3;
    const barY = -enemyDef.size - 6;

    const healthPercent = Math.max(0, this.health / this.maxHealth);
    const fillWidth = barWidth * healthPercent;

    const fillColor = healthPercent > 0.3
      ? CLIENT_CONFIG.colors.healthBarFill
      : CLIENT_CONFIG.colors.healthBarLow;

    this.healthBarFill.clear();
    this.healthBarFill.fillStyle(fillColor, 1);
    this.healthBarFill.fillRect(-barWidth / 2, barY, fillWidth, barHeight);
  }

  update(enemyData) {
    // Kill previous movement tween to prevent stacking
    if (this.moveTween) {
      this.moveTween.stop();
    }

    // Update position with interpolation
    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: enemyData.x,
      y: enemyData.y,
      duration: 50,
      ease: 'Linear'
    });

    // Update health
    if (enemyData.health !== this.health) {
      this.health = enemyData.health;
      this.updateHealthBar();

      // Damage flash effect
      this.scene.tweens.add({
        targets: this.graphics,
        alpha: 0.5,
        duration: 50,
        yoyo: true
      });
    }
  }

  destroy() {
    // Stop movement tween
    if (this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }

    // Death effect
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        // Explicitly destroy graphics objects
        if (this.graphics) {
          this.graphics.destroy();
          this.graphics = null;
        }
        if (this.healthBarBg) {
          this.healthBarBg.destroy();
          this.healthBarBg = null;
        }
        if (this.healthBarFill) {
          this.healthBarFill.destroy();
          this.healthBarFill = null;
        }
        super.destroy();
      }
    });
  }
}

// ES module export
export { EnemySprite };
