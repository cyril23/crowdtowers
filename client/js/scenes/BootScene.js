import { networkManager } from '../managers/NetworkManager.js';
import { soundManager } from '../managers/SoundManager.js';

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Initialize sound manager and preload audio
    soundManager.init(this);
    soundManager.preloadSounds(this);

    // Show loading progress
    const loadingText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Loading...',
      {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial'
      }
    ).setOrigin(0.5);

    // Update loading text as assets load
    this.load.on('progress', (value) => {
      loadingText.setText(`Loading... ${Math.floor(value * 100)}%`);
    });

    // After all assets loaded, connect to server
    this.load.on('complete', () => {
      // Create sound instances
      soundManager.createSounds(this);

      loadingText.setText('Connecting...');
      this.connectToServer(loadingText);
    });

    // Start loading (will trigger 'complete' when done)
    this.load.start();
  }

  connectToServer(loadingText) {
    networkManager.connect()
      .then(() => {
        loadingText.setText('Connected!');

        // Check for join code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');

        setTimeout(() => {
          if (joinCode) {
            // Store join code and go to menu
            this.registry.set('pendingJoinCode', joinCode);
          }
          this.scene.start('MenuScene');
        }, 500);
      })
      .catch((error) => {
        loadingText.setText('Connection failed!\nPlease refresh the page.');
        console.error('Connection error:', error);
      });
  }

  create() {
    // Hide loading div
    document.getElementById('loading').style.display = 'none';
  }
}

// ES module export
export { BootScene };
