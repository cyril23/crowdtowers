import { networkManager } from '../managers/NetworkManager.js';
import { soundManager } from '../managers/SoundManager.js';
import { errorReporter } from '../utils/errorReporter.js';

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Initialize sound manager and preload audio
    soundManager.init(this);
    soundManager.preloadSounds(this);

    // Catch Phaser file loading errors (e.g., audio decode failures)
    // These are handled internally by Phaser and don't reach window.onerror
    this.load.on('loaderror', (file) => {
      errorReporter.handleError({
        type: 'phaser_loaderror',
        message: `Failed to load ${file.type}: ${file.key}`,
        filename: file.url,
        stack: `File type: ${file.type}, Key: ${file.key}, URL: ${file.url}`
      });
    });

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

// Test function for triggering Phaser load errors (staging/dev only)
// Usage in browser console: testPhaserLoadError()
if (typeof window !== 'undefined') {
  window.testPhaserLoadError = () => {
    // Get game from errorReporter (it's set via errorReporter.setGame() in main.js)
    const game = window.errorReporter?.game;
    if (!game) {
      console.error('Game not initialized yet. Make sure errorReporter.setGame() was called.');
      return;
    }

    // Get an active scene to use its loader
    const activeScene = game.scene.getScenes(true)[0];
    if (!activeScene) {
      console.error('No active scene found');
      return;
    }

    console.log('Triggering test Phaser load error...');

    // Set up error handler on this scene's loader (since BootScene's listener is gone)
    activeScene.load.once('loaderror', (file) => {
      console.log('Test load error triggered successfully!');
      // Manually call errorReporter since this scene doesn't have the listener
      if (window.errorReporter) {
        window.errorReporter.handleError({
          type: 'phaser_loaderror',
          message: `Failed to load ${file.type}: ${file.key}`,
          filename: file.url,
          stack: `File type: ${file.type}, Key: ${file.key}, URL: ${file.url}`
        });
      }
    });

    // Try to load a non-existent audio file
    activeScene.load.audio('test_nonexistent', 'assets/audio/sfx/nonexistent_test_file.wav');
    activeScene.load.start();
  };
}

// ES module export
export { BootScene };
