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

    // Stats
    this.add.text(centerX, centerY - 30, 'Final Statistics', {
      fontSize: '20px',
      color: '#aaaaaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    const statsText = [
      `Waves Survived: ${this.finalWave}/${GAME_CONFIG.TOTAL_WAVES}`,
      `Towers Built: ${this.stats.towersBuilt}`,
      `Lives Remaining: ${this.stats.livesRemaining}`,
      `Budget Remaining: ${this.stats.budgetRemaining}B`
    ].join('\n');

    this.add.text(centerX, centerY + 40, statsText, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      lineSpacing: 10
    }).setOrigin(0.5);

    // Buttons
    this.add.text(centerX, centerY + 140, 'Play Again', {
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

    this.add.text(centerX, centerY + 200, 'Main Menu', {
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
