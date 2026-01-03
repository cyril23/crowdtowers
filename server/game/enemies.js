import { ENEMIES, WAVE_COMPOSITION } from '../../shared/constants.js';

function getEnemyStats(enemyType, waveNumber) {
  const enemy = ENEMIES[enemyType];
  if (!enemy) return null;

  // Calculate cycle-based scaling (50 waves per cycle)
  const WAVES_PER_CYCLE = 50;
  const cycleNumber = Math.floor((waveNumber - 1) / WAVES_PER_CYCLE);
  const waveInCycle = ((waveNumber - 1) % WAVES_PER_CYCLE) + 1;

  // Base linear scaling continues forever (+20% per wave)
  const baseMultiplier = 1 + (enemy.healthScaling * (waveNumber - 1));

  // Cycle bonus: 2× HP per complete cycle
  const cycleBonus = Math.pow(2.0, cycleNumber);

  // Accelerated scaling after first cycle: +7% more per wave per cycle
  // Cycle 0: no acceleration, Cycle 1: +7% per wave, Cycle 2: +14% per wave
  const acceleratedScaling = cycleNumber > 0
    ? 1 + (0.07 * cycleNumber * waveInCycle)
    : 1;

  const finalHealth = Math.floor(enemy.health * baseMultiplier * cycleBonus * acceleratedScaling);

  return {
    ...enemy,
    health: finalHealth,
    maxHealth: finalHealth,
    speed: enemy.speed,
    reward: getScaledReward(enemyType, waveNumber)
  };
}

function getScaledReward(enemyType, waveNumber) {
  const enemy = ENEMIES[enemyType];
  if (!enemy) return 0;

  // Waves 1-50: static rewards (unchanged)
  if (waveNumber <= 50) {
    return enemy.reward;
  }

  // Waves 51+: scale rewards (softer than HP scaling to maintain challenge)
  const WAVES_PER_CYCLE = 50;
  const cycleNumber = Math.floor((waveNumber - 1) / WAVES_PER_CYCLE);

  // Base reward scaling: +10% per wave after wave 50
  const waveBonus = 1 + (0.10 * (waveNumber - 50));

  // Cycle bonus: 1.5x per cycle (less than HP's 2x to maintain challenge)
  const cycleBonus = Math.pow(1.5, cycleNumber);

  return Math.floor(enemy.reward * waveBonus * cycleBonus);
}

function getWaveComposition(waveNumber) {
  // Waves cycle after 50 (wave 51 = wave 1, etc.)
  const waveIndex = (waveNumber - 1) % WAVE_COMPOSITION.length;
  const wave = WAVE_COMPOSITION[waveIndex];

  return {
    enemies: wave.enemies,
    count: wave.count,
    difficulty: wave.difficulty,
    boss: wave.boss || false
  };
}

function generateWaveEnemies(waveNumber) {
  const composition = getWaveComposition(waveNumber);
  const enemies = [];

  for (let i = 0; i < composition.count; i++) {
    // Select enemy type based on wave composition
    const enemyType = composition.enemies[i % composition.enemies.length];
    const stats = getEnemyStats(enemyType, waveNumber);

    enemies.push({
      ...stats,
      id: `enemy_${waveNumber}_${i}`, // Must come AFTER ...stats to override the type-based id
      type: enemyType,
      pathIndex: 0,
      x: 0,
      y: 0,
      slowedUntil: 0,
      spawnDelay: i * 600 // Stagger spawns by 600ms for better visual separation
    });
  }

  return enemies;
}

function applyDamageToEnemy(enemy, damage, _towerType) {
  // Check for phase ability (Phasewalker)
  if (enemy.special === 'phase' && Math.random() < enemy.phaseChance) {
    return { dodged: true, damage: 0, killed: false };
  }

  // Check for armor ability (Behemoth)
  if (enemy.special === 'armor') {
    damage *= (1 - enemy.armorReduction);
  }

  enemy.health -= damage;

  const killed = enemy.health <= 0;

  return {
    dodged: false,
    damage,
    killed,
    spawns: killed && enemy.special === 'spawn' ? {
      type: enemy.spawnType,
      count: enemy.spawnCount
    } : null
  };
}

export {
  getEnemyStats,
  getScaledReward,
  getWaveComposition,
  generateWaveEnemies,
  applyDamageToEnemy,
  ENEMIES
};
