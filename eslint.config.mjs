import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**']
  },
  {
    files: ['server/**/*.js', 'shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Promise: 'readonly',
        Buffer: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        JSON: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        Boolean: 'readonly',
        Error: 'readonly',
        Infinity: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always']
    }
  },
  {
    files: ['client/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Promise: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        JSON: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        Boolean: 'readonly',
        Error: 'readonly',
        URLSearchParams: 'readonly',
        // External libraries
        io: 'readonly',
        Phaser: 'readonly',
        // Shared constants (from constants.js)
        GAME_CONFIG: 'readonly',
        MAZE_SIZES: 'readonly',
        GAME_STATUS: 'readonly',
        TILE_TYPES: 'readonly',
        TOWERS: 'readonly',
        ENEMIES: 'readonly',
        WAVE_COMPOSITION: 'readonly',
        SOCKET_EVENTS: 'readonly',
        // Client-side classes and globals
        CLIENT_CONFIG: 'writable',
        DeviceUtils: 'writable',
        networkManager: 'writable',
        NetworkManager: 'writable',
        InputManager: 'writable',
        HUD: 'writable',
        ChatPanel: 'writable',
        TowerMenu: 'writable',
        TowerSprite: 'writable',
        EnemySprite: 'writable',
        BackgroundScene: 'writable',
        BootScene: 'writable',
        MenuScene: 'writable',
        CreateGameScene: 'writable',
        BrowseScene: 'writable',
        LobbyScene: 'writable',
        GameScene: 'writable',
        GameOverScene: 'writable'
      }
    },
    rules: {
      'no-unused-vars': 'off', // Many classes defined for use in other files
      'no-redeclare': 'off', // Classes share names intentionally
      'no-case-declarations': 'off', // Allow const in switch cases
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always']
    }
  }
];
