// Main entry point - imports all modules and creates the Phaser game

import { CLIENT_CONFIG } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { BackgroundScene, MenuScene, JoinGameScene, CreateGameScene, BrowseScene } from './scenes/MenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { errorReporter } from './utils/errorReporter.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize error reporting first
  errorReporter.init();
  // Full viewport canvas - game board will be centered within using camera
  const calculateSize = () => ({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const { width, height } = calculateSize();

  // Phaser game configuration
  const config = {
    type: Phaser.AUTO,
    width: width,
    height: height,
    parent: 'game-container',
    backgroundColor: CLIENT_CONFIG.colors.background,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
      createContainer: true  // Enable DOM elements that scale with canvas
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
      JoinGameScene,
      CreateGameScene,
      BrowseScene,
      LobbyScene,
      GameScene,
      GameOverScene
    ]
  };

  // Create game instance
  const game = new Phaser.Game(config);

  // Give error reporter access to game for scene context
  errorReporter.setGame(game);

  // Handle window resize - update to full viewport
  window.addEventListener('resize', () => {
    const { width, height } = calculateSize();
    game.scale.resize(width, height);
  });

  // Handle device orientation changes (mobile)
  window.addEventListener('orientationchange', () => {
    // Short delay to let browser complete orientation change
    setTimeout(() => {
      const { width, height } = calculateSize();
      game.scale.resize(width, height);
    }, 100);
  });

  // Prevent default touch behaviors that interfere with game
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#game-container')) {
      e.preventDefault();
    }
  }, { passive: false });
});
