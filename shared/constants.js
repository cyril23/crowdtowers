// Shared constants between server and client

const GAME_CONFIG = {
  MAX_PLAYERS: 32,
  STARTING_BUDGET: 500,
  STARTING_LIVES: 10,
  TOTAL_WAVES: 50,
  TICK_RATE: 20, // Server updates per second
  SESSION_CODE_LENGTH: 6
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
    phaseChance: 0.1 // 10% chance to dodge damage (reduced from 20% for better late-game balance)
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
    healthScaling: 0.20,
    speedScaling: 0.02,
    special: 'spawn',
    spawnCount: 2,
    spawnType: 'swarmling'
  }
};

// Wave composition (50 waves, cycles after wave 50)
const WAVE_COMPOSITION = [
  // Phase 1: Tutorial (Waves 1-10)
  { enemies: ['swarmling'], count: 8, difficulty: 0.5 },                           // Wave 1
  { enemies: ['swarmling'], count: 10, difficulty: 0.6 },                          // Wave 2
  { enemies: ['swarmling'], count: 12, difficulty: 0.7 },                          // Wave 3
  { enemies: ['swarmling'], count: 15, difficulty: 0.8 },                          // Wave 4
  { enemies: ['swarmling'], count: 18, difficulty: 0.9 },                          // Wave 5
  { enemies: ['swarmling', 'drone'], count: 12, difficulty: 1.0 },                 // Wave 6: Drones introduced
  { enemies: ['swarmling', 'drone'], count: 15, difficulty: 1.1 },                 // Wave 7
  { enemies: ['drone', 'swarmling'], count: 18, difficulty: 1.2 },                 // Wave 8
  { enemies: ['drone', 'swarmling'], count: 20, difficulty: 1.3 },                 // Wave 9
  { enemies: ['drone'], count: 15, difficulty: 1.4, boss: true },                  // Wave 10: Milestone

  // Phase 2: Early Challenge (Waves 11-20)
  { enemies: ['swarmling', 'drone', 'phasewalker'], count: 15, difficulty: 1.5 },  // Wave 11: Phasewalkers introduced
  { enemies: ['drone', 'phasewalker'], count: 14, difficulty: 1.6 },               // Wave 12
  { enemies: ['phasewalker', 'swarmling'], count: 18, difficulty: 1.7 },           // Wave 13
  { enemies: ['swarmling', 'phasewalker', 'drone'], count: 20, difficulty: 1.8 },  // Wave 14
  { enemies: ['phasewalker', 'drone'], count: 16, difficulty: 1.9 },               // Wave 15
  { enemies: ['phasewalker'], count: 12, difficulty: 2.0 },                        // Wave 16: Pure Phasewalker
  { enemies: ['swarmling', 'drone', 'phasewalker'], count: 22, difficulty: 2.1 },  // Wave 17
  { enemies: ['drone', 'phasewalker', 'swarmling'], count: 25, difficulty: 2.2 },  // Wave 18
  { enemies: ['phasewalker', 'swarmling', 'drone'], count: 24, difficulty: 2.3 },  // Wave 19
  { enemies: ['phasewalker', 'drone'], count: 20, difficulty: 2.4, boss: true },   // Wave 20: Milestone

  // Phase 3: Mid-Game (Waves 21-30)
  { enemies: ['swarmling', 'behemoth'], count: 15, difficulty: 2.5 },              // Wave 21: Behemoths introduced
  { enemies: ['drone', 'phasewalker', 'behemoth'], count: 16, difficulty: 2.6 },   // Wave 22
  { enemies: ['behemoth', 'swarmling'], count: 14, difficulty: 2.7 },              // Wave 23
  { enemies: ['phasewalker', 'behemoth'], count: 12, difficulty: 2.8 },            // Wave 24
  { enemies: ['behemoth', 'drone', 'swarmling'], count: 18, difficulty: 2.9, boss: true }, // Wave 25: Quarter milestone
  { enemies: ['behemoth'], count: 8, difficulty: 3.0 },                            // Wave 26: Pure Behemoth
  { enemies: ['swarmling', 'drone', 'phasewalker', 'behemoth'], count: 20, difficulty: 3.1 }, // Wave 27
  { enemies: ['behemoth', 'phasewalker', 'drone'], count: 18, difficulty: 3.2 },   // Wave 28
  { enemies: ['drone', 'behemoth', 'swarmling', 'phasewalker'], count: 22, difficulty: 3.3 }, // Wave 29
  { enemies: ['phasewalker', 'behemoth'], count: 15, difficulty: 3.4, boss: true }, // Wave 30: Milestone

  // Phase 4: Late-Game (Waves 31-40)
  { enemies: ['swarmling', 'broodmother'], count: 12, difficulty: 3.5 },           // Wave 31: Broodmothers introduced
  { enemies: ['broodmother', 'drone'], count: 10, difficulty: 3.6 },               // Wave 32
  { enemies: ['phasewalker', 'broodmother', 'swarmling'], count: 14, difficulty: 3.7 }, // Wave 33
  { enemies: ['broodmother', 'behemoth'], count: 8, difficulty: 3.8 },             // Wave 34: Heavy hitters
  { enemies: ['broodmother', 'drone', 'phasewalker'], count: 12, difficulty: 3.9, boss: true }, // Wave 35
  { enemies: ['swarmling', 'drone', 'phasewalker', 'behemoth'], count: 25, difficulty: 4.0 }, // Wave 36: Swarm
  { enemies: ['behemoth', 'broodmother', 'phasewalker'], count: 12, difficulty: 4.1 }, // Wave 37
  { enemies: ['broodmother', 'swarmling', 'drone'], count: 16, difficulty: 4.2 },  // Wave 38
  { enemies: ['phasewalker', 'behemoth', 'broodmother'], count: 14, difficulty: 4.3 }, // Wave 39
  { enemies: ['broodmother', 'behemoth'], count: 10, difficulty: 4.4, boss: true }, // Wave 40: Milestone

  // Phase 5: Endgame (Waves 41-50)
  { enemies: ['swarmling', 'drone', 'phasewalker', 'behemoth', 'broodmother'], count: 20, difficulty: 4.5 }, // Wave 41
  { enemies: ['phasewalker', 'broodmother', 'behemoth'], count: 15, difficulty: 4.6 }, // Wave 42
  { enemies: ['swarmling'], count: 60, difficulty: 4.7 },                          // Wave 43: Mega swarm
  { enemies: ['behemoth', 'broodmother'], count: 12, difficulty: 4.8 },            // Wave 44: Tank rush
  { enemies: ['broodmother', 'phasewalker'], count: 14, difficulty: 4.9, boss: true }, // Wave 45: Pre-boss
  { enemies: ['drone', 'phasewalker', 'behemoth', 'broodmother'], count: 18, difficulty: 5.0 }, // Wave 46
  { enemies: ['behemoth', 'broodmother', 'swarmling'], count: 20, difficulty: 5.1 }, // Wave 47
  { enemies: ['phasewalker', 'behemoth', 'broodmother', 'drone'], count: 22, difficulty: 5.2 }, // Wave 48
  { enemies: ['broodmother', 'behemoth', 'phasewalker'], count: 16, difficulty: 5.3 }, // Wave 49
  { enemies: ['broodmother', 'behemoth', 'phasewalker', 'drone', 'swarmling'], count: 40, difficulty: 5.5, boss: true } // Wave 50: FINAL BOSS
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
  KICK_VOTE_FAILED: 'kick-vote-failed',

  // Error Reporting
  CLIENT_ERROR: 'client-error'
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
  SOCKET_EVENTS
};
