// Shared constants between server and client

const GAME_CONFIG = {
  MAX_PLAYERS: 32,
  STARTING_BUDGET: 500,
  STARTING_LIVES: 10,
  TOTAL_WAVES: 25,
  TICK_RATE: 20, // Server updates per second
  SESSION_CODE_LENGTH: 6
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
  SAVED: 'saved'
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
    damagePerLevel: 0.15
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
    damagePerLevel: 0.15
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
    damagePerLevel: 0.15
  },
  cryoCannon: {
    id: 'cryoCannon',
    name: 'Cryo Cannon',
    cost: 180,
    damage: 5,
    range: 3,
    fireRate: 800,
    special: 'slow',
    slowAmount: 0.5,
    slowDuration: 2000,
    strongVs: ['phasewalker'],
    weakVs: ['swarmling'],
    color: 0x99ffff,
    upgradeMultiplier: 1.5,
    damagePerLevel: 0.15
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
    damagePerLevel: 0.15
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
    healthScaling: 0.20,
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
    healthScaling: 0.20,
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
    healthScaling: 0.20,
    speedScaling: 0.02,
    special: 'phase',
    phaseChance: 0.3 // 30% chance to dodge damage
  },
  behemoth: {
    id: 'behemoth',
    name: 'Behemoth',
    health: 200,
    speed: 25,
    reward: 40,
    size: 12,
    color: 0xff6600,
    healthScaling: 0.20,
    speedScaling: 0.02,
    special: 'armor',
    armorReduction: 0.25 // Takes 25% less damage
  },
  broodmother: {
    id: 'broodmother',
    name: 'Broodmother',
    health: 350,
    speed: 30,
    reward: 80,
    size: 14,
    color: 0x990000,
    healthScaling: 0.20,
    speedScaling: 0.02,
    special: 'spawn',
    spawnCount: 2,
    spawnType: 'swarmling'
  }
};

// Wave composition
const WAVE_COMPOSITION = [
  // Waves 1-5: Swarmlings only
  { enemies: ['swarmling'], count: 8, difficulty: 0.5 },
  { enemies: ['swarmling'], count: 10, difficulty: 0.6 },
  { enemies: ['swarmling'], count: 12, difficulty: 0.7 },
  { enemies: ['swarmling'], count: 15, difficulty: 0.8 },
  { enemies: ['swarmling'], count: 18, difficulty: 0.9 },
  // Waves 6-10: Swarmlings + Drones
  { enemies: ['swarmling', 'drone'], count: 15, difficulty: 1.0 },
  { enemies: ['swarmling', 'drone'], count: 18, difficulty: 1.1 },
  { enemies: ['swarmling', 'drone'], count: 20, difficulty: 1.2 },
  { enemies: ['drone', 'swarmling'], count: 22, difficulty: 1.3 },
  { enemies: ['drone', 'swarmling'], count: 25, difficulty: 1.4 },
  // Waves 11-15: Add Phasewalkers
  { enemies: ['swarmling', 'drone', 'phasewalker'], count: 20, difficulty: 1.5 },
  { enemies: ['drone', 'phasewalker'], count: 18, difficulty: 1.6 },
  { enemies: ['phasewalker', 'swarmling'], count: 22, difficulty: 1.7 },
  { enemies: ['swarmling', 'drone', 'phasewalker'], count: 25, difficulty: 1.8 },
  { enemies: ['phasewalker', 'drone'], count: 20, difficulty: 1.9 },
  // Waves 16-20: Add Behemoths
  { enemies: ['swarmling', 'behemoth'], count: 18, difficulty: 2.0 },
  { enemies: ['drone', 'phasewalker', 'behemoth'], count: 20, difficulty: 2.1 },
  { enemies: ['behemoth', 'swarmling'], count: 15, difficulty: 2.2 },
  { enemies: ['phasewalker', 'behemoth', 'drone'], count: 22, difficulty: 2.4 },
  { enemies: ['behemoth', 'phasewalker'], count: 18, difficulty: 2.5 },
  // Waves 21-24: All types
  { enemies: ['swarmling', 'drone', 'phasewalker', 'behemoth'], count: 25, difficulty: 2.6 },
  { enemies: ['drone', 'phasewalker', 'behemoth', 'swarmling'], count: 28, difficulty: 2.7 },
  { enemies: ['phasewalker', 'behemoth', 'swarmling', 'drone'], count: 30, difficulty: 2.8 },
  { enemies: ['behemoth', 'phasewalker', 'drone', 'swarmling'], count: 32, difficulty: 2.9 },
  // Wave 25: Boss wave
  { enemies: ['broodmother', 'behemoth', 'phasewalker', 'drone', 'swarmling'], count: 35, difficulty: 3.0, boss: true }
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
  START_GAME: 'start-game',
  GAME_STARTED: 'game-started',

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

  // Chat
  CHAT_MESSAGE: 'chat-message',
  CHAT_BROADCAST: 'chat-broadcast',

  // Voting
  INITIATE_KICK: 'initiate-kick',
  KICK_VOTE_STARTED: 'kick-vote-started',
  CAST_KICK_VOTE: 'cast-kick-vote',
  KICK_VOTE_UPDATE: 'kick-vote-update',
  PLAYER_KICKED: 'player-kicked',
  KICK_VOTE_FAILED: 'kick-vote-failed'
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GAME_CONFIG,
    MAZE_SIZES,
    GAME_STATUS,
    TILE_TYPES,
    TOWERS,
    ENEMIES,
    WAVE_COMPOSITION,
    SOCKET_EVENTS
  };
}
