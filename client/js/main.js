// Main entry point - imports all modules and creates the Phaser game

import { CLIENT_CONFIG } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { BackgroundScene, MenuScene, CreateGameScene, BrowseScene } from './scenes/MenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

document.addEventListener('DOMContentLoaded', () => {
  // Calculate square canvas size with min/max bounds
  // Min 400px ensures UI elements fit, max 672px is the design size
  const calculateSize = () => Math.max(400, Math.min(
    window.innerWidth,
    window.innerHeight - 100,  // Account for mobile browser chrome
    672                         // Max game size
  ));

  const size = calculateSize();
  const width = size;
  const height = size;

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
      CreateGameScene,
      BrowseScene,
      LobbyScene,
      GameScene,
      GameOverScene
    ]
  };

  // Create game instance
  const game = new Phaser.Game(config);

  // Handle window resize - maintain square aspect ratio with min/max bounds
  window.addEventListener('resize', () => {
    game.scale.resize(calculateSize(), calculateSize());
  });

  // Handle device orientation changes (mobile)
  window.addEventListener('orientationchange', () => {
    // Short delay to let browser complete orientation change
    setTimeout(() => {
      game.scale.resize(calculateSize(), calculateSize());
    }, 100);
  });

  // Prevent default touch behaviors that interfere with game
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#game-container')) {
      e.preventDefault();
    }
  }, { passive: false });
});
