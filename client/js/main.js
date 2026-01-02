// Main game initialization

document.addEventListener('DOMContentLoaded', () => {
  // Determine canvas size based on screen
  let width, height;

  if (DeviceUtils.isMobile()) {
    width = Math.min(window.innerWidth, 672);
    height = Math.min(window.innerHeight - 100, 672);
  } else {
    width = 672;
    height = 672;
  }

  // Phaser game configuration
  const config = {
    type: Phaser.AUTO,
    width: width,
    height: height,
    parent: 'game-container',
    backgroundColor: CLIENT_CONFIG.colors.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
      touch: {
        capture: true
      },
      activePointers: 3
    },
    scene: [
      BootScene,
      BackgroundScene,
      MenuScene,
      CreateGameScene,
      BrowseScene,
      LobbyScene,
      GameScene,
      GameOverScene
    ]
  };

  // Create game instance
  const game = new Phaser.Game(config);

  // Handle window resize
  window.addEventListener('resize', () => {
    game.scale.resize(
      Math.min(window.innerWidth, 672),
      Math.min(window.innerHeight - 100, 672)
    );
  });

  // Prevent default touch behaviors that interfere with game
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#game-container')) {
      e.preventDefault();
    }
  }, { passive: false });
});
