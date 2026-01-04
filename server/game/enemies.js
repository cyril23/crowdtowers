import { ENEMIES, WAVE_COMPOSITION } from '../../shared/constants.js';

function getEnemyStats(enemyType, waveNumber) {
  const enemy = ENEMIES[enemyType];
  if (!enemy) return null;

  // Simple linear scaling: +20% HP per wave, no cycle bonuses
  // This provides smooth difficulty progression without sudden jumps
  const baseMultiplier = 1 + (enemy.healthScaling * (waveNumber - 1));

  const finalHealth = Math.floor(enemy.health * baseMultiplier);

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

  // Linear reward scaling: +10% per wave (softer than HP's +20% to maintain challenge)
  const rewardMultiplier = 1 + (0.10 * (waveNumber - 1));

  return Math.floor(enemy.reward * rewardMultiplier);
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
