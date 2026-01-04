// GameOverScene - displays victory or defeat screen
import { formatCurrency } from '../utils/formatNumber.js';

class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.victory = data.victory;
    this.finalWave = data.finalWave;
    this.stats = data.stats;
  }

  create() {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Background overlay
    this.add.rectangle(centerX, centerY, 800, 600, 0x000000, 0.8);

    // Title
    const title = this.victory ? 'VICTORY!' : 'GAME OVER';
    const titleColor = this.victory ? '#44ff44' : '#ff4444';

    this.add.text(centerX, centerY - 150, title, {
      fontSize: '48px',
      color: titleColor,
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    const subtitle = this.victory
      ? 'Humanity is saved!'
      : 'The aliens have won...';

    this.add.text(centerX, centerY - 90, subtitle, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Stats header
    this.add.text(centerX, centerY - 40, 'Final Statistics', {
      fontSize: '20px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // Left column (game progress)
    const leftStats = [
      `Waves Survived: ${this.finalWave}`,
      `Towers Built: ${this.stats.towersBuilt}`,
      `Total Upgrades: ${this.stats.totalUpgrades}`,
      `Highest Tower Level: ${this.stats.highestTowerLevel}`
    ].join('\n');

    this.add.text(centerX - 20, centerY + 20, leftStats, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'right',
      lineSpacing: 8
    }).setOrigin(1, 0);

    // Right column (resources)
    const rightStats = [
      `Lives Remaining: ${this.stats.livesRemaining}`,
      `Budget Remaining: ${formatCurrency(this.stats.budgetRemaining)}`,
      `Total Spent: ${formatCurrency(this.stats.totalBudgetSpent)}`
    ].join('\n');

    this.add.text(centerX + 20, centerY + 20, rightStats, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'left',
      lineSpacing: 8
    }).setOrigin(0, 0);

    // Buttons
    this.add.text(centerX, centerY + 170, 'Play Again', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#228822',
      padding: { x: 30, y: 15 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.reload();
      });

    this.add.text(centerX, centerY + 230, 'Main Menu', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.href = '/';
      });

    // Hide game UI elements
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('tower-panel').classList.add('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
  }
}

// ES module export
export { GameOverScene };
