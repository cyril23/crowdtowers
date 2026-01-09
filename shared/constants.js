// Shared constants between server and client

const GAME_CONFIG = {
  MAX_PLAYERS: 32,
  STARTING_BUDGET: 250,
  STARTING_LIVES: 10,
  TOTAL_WAVES: 25,
  TICK_RATE: 20, // Server updates per second
  SESSION_CODE_LENGTH: 6,
  GAME_SPEEDS: [0.5, 1, 1.5, 2, 3, 5, 10] // Available speed multipliers
};

const ERROR_REPORTING = {
  MAX_ERRORS_PER_CLIENT: 5,
  STAGING_HOSTNAME: 'staging.crowdtowers.wochenentwicklung.com'
};

const MAZE_SIZES = {
  small: { grid: 12, tileSize: 40, canvas: 480 },
  medium: { grid: 20, tileSize: 32, canvas: 640 },
  large: { grid: 28, tileSize: 24, canvas: 672 }
};

const GAME_STATUS = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  SAVED: 'saved',
  SUSPENDED: 'suspended'
};

const TILE_TYPES = {
  PATH: 0,
  WALL: 1,
  BUILDABLE: 2,
  ENTRY: 3,
  EXIT: 4
};

// Tower definitions
const TOWERS = {
  machineGun: {
    id: 'machineGun',
    name: 'Machine Gun',
    cost: 100,
    damage: 8,
    range: 3,
    fireRate: 200, // ms between shots
    special: 'rapid',
    strongVs: ['swarmling'],
    weakVs: ['behemoth'],
    color: 0x808080,
    upgradeMultiplier: 1.5,
    damageMultiplier: 1.35
  },
  missileLauncher: {
    id: 'missileLauncher',
    name: 'Missile Launcher',
    cost: 150,
    damage: 25,
    range: 4,
    fireRate: 1200,
    special: 'splash',
    splashRadius: 1,
    strongVs: ['behemoth'],
    weakVs: ['phasewalker'],
    color: 0xcc0000,
    upgradeMultiplier: 1.5,
    damageMultiplier: 1.35
  },
  teslaCoil: {
    id: 'teslaCoil',
    name: 'Tesla Coil',
    cost: 120,
    damage: 12,
    range: 3.5,
    fireRate: 600,
    special: 'chain',
    chainTargets: 3,
    strongVs: ['drone'],
    weakVs: ['broodmother'],
    color: 0x00ccff,
    upgradeMultiplier: 1.5,
    damageMultiplier: 1.35
  },
  cryoCannon: {
    id: 'cryoCannon',
    name: 'Cryo Cannon',
    cost: 180,
    damage: 8,
    range: 3,
    fireRate: 800,
    special: 'slow',
    slowAmount: 0.5,
    slowAmountBonus: 0.05, // +5% slow strength per level
    slowAmountMax: 0.95, // Cap at 95% (enemies always move at least 5% speed)
    slowDuration: 4000, // Increased from 3000 for better effectiveness
    slowDurationBonus: 100, // +100ms slow duration per upgrade level
    strongVs: ['phasewalker'],
    weakVs: ['swarmling'],
    color: 0x99ffff,
    upgradeMultiplier: 1.5,
    damageMultiplier: 1.40 // Buffed from 1.35 for better late-game scaling
  },
  plasmaTurret: {
    id: 'plasmaTurret',
    name: 'Plasma Turret',
    cost: 250,
    damage: 35,
    range: 2.5,
    fireRate: 1000,
    special: 'pierce',
    strongVs: ['broodmother'],
    weakVs: ['drone'],
    color: 0xff00ff,
    upgradeMultiplier: 1.5,
    damageMultiplier: 1.35
  }
};

// Enemy definitions
const ENEMIES = {
  swarmling: {
    id: 'swarmling',
    name: 'Swarmling',
    health: 30,
    speed: 70,
    reward: 10,
    size: 6,
    color: 0x00ff00,
    healthScaling: 0.30,
    speedScaling: 0.02
  },
  drone: {
    id: 'drone',
    name: 'Drone',
    health: 50,
    speed: 55,
    reward: 15,
    size: 8,
    color: 0xffff00,
    healthScaling: 0.30,
    speedScaling: 0.02
  },
  phasewalker: {
    id: 'phasewalker',
    name: 'Phasewalker',
    health: 80,
    speed: 85,
    reward: 25,
    size: 8,
    color: 0x9900ff,
    healthScaling: 0.30,
    speedScaling: 0.02,
    special: 'phase',
    phaseChance: 0.1 // 10% chance to dodge damage (reduced from 20% for better late-game balance)
  },
  behemoth: {
    id: 'behemoth',
    name: 'Behemoth',
    health: 300,
    speed: 20,
    reward: 40,
    size: 12,
    color: 0xff6600,
    healthScaling: 0.30,
    speedScaling: 0.02,
    special: 'armor',
    armorReduction: 0.50 // Takes 50% less damage (Machine Guns deal only 25% effective damage)
  },
  broodmother: {
    id: 'broodmother',
    name: 'Broodmother',
    health: 350,
    speed: 30,
    reward: 80,
    size: 14,
    color: 0x990000,
    healthScaling: 0.30,
    speedScaling: 0.02,
    special: 'spawn',
    spawnCount: 2,
    spawnType: 'swarmling'
  }
};

// Wave composition (25 waves, cycles after wave 25)
const WAVE_COMPOSITION = [
  // Phase 1: Tutorial (Waves 1-5) - Swarmlings only
  { enemies: ['swarmling'], count: 10 },                                           // Wave 1: Easy intro
  { enemies: ['swarmling'], count: 12 },                                           // Wave 2
  { enemies: ['swarmling'], count: 15 },                                           // Wave 3
  { enemies: ['swarmling'], count: 18 },                                           // Wave 4
  { enemies: ['swarmling'], count: 20 },                                           // Wave 5

  // Phase 2: Drones (Waves 6-10)
  { enemies: ['swarmling', 'drone'], count: 12 },                                  // Wave 6: Drones introduced
  { enemies: ['drone', 'swarmling'], count: 14 },                                  // Wave 7
  { enemies: ['drone'], count: 10 },                                               // Wave 8: Pure Drones
  { enemies: ['swarmling', 'drone'], count: 18 },                                  // Wave 9
  { enemies: ['drone', 'swarmling'], count: 15 },                                  // Wave 10

  // Phase 3: Phasewalkers (Waves 11-15)
  { enemies: ['swarmling', 'phasewalker'], count: 12 },                            // Wave 11: Phasewalkers introduced
  { enemies: ['drone', 'phasewalker'], count: 10 },                                // Wave 12
  { enemies: ['phasewalker'], count: 8 },                                          // Wave 13: Pure Phasewalkers
  { enemies: ['swarmling', 'drone', 'phasewalker'], count: 15 },                   // Wave 14
  { enemies: ['phasewalker', 'drone'], count: 12 },                                // Wave 15

  // Phase 4: Behemoths (Waves 16-20)
  { enemies: ['swarmling', 'behemoth'], count: 10 },                               // Wave 16: Behemoths introduced
  { enemies: ['drone', 'phasewalker', 'behemoth'], count: 12 },                    // Wave 17
  { enemies: ['behemoth'], count: 5 },                                             // Wave 18: Pure Behemoths (tanky!)
  { enemies: ['swarmling', 'drone', 'phasewalker', 'behemoth'], count: 15 },       // Wave 19
  { enemies: ['behemoth', 'phasewalker'], count: 10 },                             // Wave 20

  // Phase 5: Broodmothers + Final (Waves 21-25)
  { enemies: ['swarmling', 'broodmother'], count: 8 },                             // Wave 21: Broodmothers introduced
  { enemies: ['broodmother', 'drone'], count: 8 },                                 // Wave 22
  { enemies: ['broodmother', 'behemoth'], count: 6 },                              // Wave 23: Heavy wave
  { enemies: ['swarmling', 'drone', 'phasewalker', 'behemoth', 'broodmother'], count: 15 }, // Wave 24: All types
  { enemies: ['broodmother', 'behemoth', 'phasewalker', 'drone', 'swarmling'], count: 30, boss: true } // Wave 25: FINAL BOSS
];

// Socket event names
const SOCKET_EVENTS = {
  // Connection & Lobby
  CREATE_GAME: 'create-game',
  GAME_CREATED: 'game-created',
  JOIN_GAME: 'join-game',
  JOIN_SUCCESS: 'join-success',
  JOIN_ERROR: 'join-error',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  BROWSE_GAMES: 'browse-games',
  OPEN_GAMES_LIST: 'open-games-list',
  STOP_BROWSING: 'stop-browsing',
  START_GAME: 'start-game',
  GAME_STARTED: 'game-started',
  LEAVE_LOBBY: 'leave-lobby',
  LEAVE_GAME: 'leave-game',
  LOBBY_CLOSED: 'lobby-closed',
  HOST_TRANSFERRED: 'host-transferred',

  // Session Recovery
  REJOIN_GAME: 'rejoin-game',
  REJOIN_SUCCESS: 'rejoin-success',
  REJOIN_ERROR: 'rejoin-error',

  // Gameplay
  PLACE_TOWER: 'place-tower',
  TOWER_PLACED: 'tower-placed',
  TOWER_ERROR: 'tower-error',
  UPGRADE_TOWER: 'upgrade-tower',
  TOWER_UPGRADED: 'tower-upgraded',
  SELL_TOWER: 'sell-tower',
  TOWER_SOLD: 'tower-sold',
  GAME_STATE_SYNC: 'game-state-sync',
  ENEMY_KILLED: 'enemy-killed',
  ENEMY_REACHED_EXIT: 'enemy-reached-exit',
  WAVE_COMPLETE: 'wave-complete',
  WAVE_START: 'wave-start',
  TOWER_FIRED: 'tower-fired',
  GAME_OVER: 'game-over',

  // Pause & Control
  PAUSE_GAME: 'pause-game',
  GAME_PAUSED: 'game-paused',
  RESUME_GAME: 'resume-game',
  GAME_RESUMED: 'game-resumed',
  SAVE_GAME: 'save-game',
  GAME_SAVED: 'game-saved',
  LOAD_GAME: 'load-game',

  // Speed Control
  CHANGE_SPEED: 'change-speed',
  SPEED_CHANGED: 'speed-changed',

  // Chat
  CHAT_MESSAGE: 'chat-message',
  CHAT_BROADCAST: 'chat-broadcast',

  // Voting
  INITIATE_KICK: 'initiate-kick',
  KICK_VOTE_STARTED: 'kick-vote-started',
  CAST_KICK_VOTE: 'cast-kick-vote',
  KICK_VOTE_UPDATE: 'kick-vote-update',
  PLAYER_KICKED: 'player-kicked',
  KICK_VOTE_FAILED: 'kick-vote-failed',

  // Player List
  PLAYER_LIST: 'player-list',

  // Error Reporting
  CLIENT_ERROR: 'client-error'
};

// Keyboard hotkeys (Phaser key event names)
const HOTKEYS = {
  // Tower selection
  TOWER_1: 'keydown-ONE',
  TOWER_2: 'keydown-TWO',
  TOWER_3: 'keydown-THREE',
  TOWER_4: 'keydown-FOUR',
  TOWER_5: 'keydown-FIVE',

  // Tower actions
  UPGRADE: 'keydown-U',
  SELL: 'keydown-S',

  // Game controls
  PAUSE: 'keydown-P',
  CHAT: 'keydown-C',
  PLAYERS: 'keydown-L',  // L for List
  QUIT: 'keydown-Q',
  CANCEL: 'keydown-ESC',

  // Settings
  TOGGLE_HOTKEYS: 'keydown-H',

  // Speed control
  SPEED_UP: 'keydown-PLUS',
  SPEED_DOWN: 'keydown-MINUS',

  // Menu navigation
  MAIN_MENU: 'keydown-ESC',
  MENU: 'keydown-M',
  JOIN: 'keydown-J',
  BROWSE: 'keydown-B',
  CREATE: 'keydown-C',
  REFRESH: 'keydown-R',

  // Lobby controls
  START: 'keydown-S',

  // Create game - maze size (reuses TOWER_1-3 keys, different context)
  MAZE_SMALL: 'keydown-ONE',
  MAZE_MEDIUM: 'keydown-TWO',
  MAZE_LARGE: 'keydown-THREE',

  // Create game - privacy
  PRIVATE: 'keydown-P',
  OPEN: 'keydown-O',

  // Confirm dialog
  CONFIRM_YES: 'keydown-Y',
  CONFIRM_NO: 'keydown-N'
};

// Export for ES modules
export {
  GAME_CONFIG,
  ERROR_REPORTING,
  MAZE_SIZES,
  GAME_STATUS,
  TILE_TYPES,
  TOWERS,
  ENEMIES,
  WAVE_COMPOSITION,
  SOCKET_EVENTS,
  HOTKEYS
};
