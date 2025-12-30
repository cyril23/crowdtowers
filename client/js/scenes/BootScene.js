class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Show loading progress
    const loadingText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Connecting...',
      {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial'
      }
    ).setOrigin(0.5);

    // Connect to server
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
