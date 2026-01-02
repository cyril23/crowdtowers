import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'client/dist/**']
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
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
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always']
    }
  },
  {
    // Shared constants - ES modules
    files: ['shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always']
    }
  },
  {
    // Client files - ES modules
    files: ['client/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
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
        // External libraries (loaded via CDN, accessed as globals)
        io: 'readonly',
        Phaser: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-case-declarations': 'off',
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always']
    }
  }
];
