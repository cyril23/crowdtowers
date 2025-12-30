const { ENEMIES, WAVE_COMPOSITION } = require('../../shared/constants');

function getEnemyStats(enemyType, waveNumber) {
  const enemy = ENEMIES[enemyType];
  if (!enemy) return null;

  // Scale HP based on wave number (speed does not scale)
  const healthMultiplier = 1 + (enemy.healthScaling * (waveNumber - 1));

  return {
    ...enemy,
    health: Math.floor(enemy.health * healthMultiplier),
    maxHealth: Math.floor(enemy.health * healthMultiplier),
    speed: enemy.speed
  };
}

function getWaveComposition(waveNumber) {
  // Waves cycle after 25 (wave 26 = wave 1, etc.)
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
      id: `enemy_${waveNumber}_${i}`,
      type: enemyType,
      ...stats,
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

module.exports = {
  getEnemyStats,
  getWaveComposition,
  generateWaveEnemies,
  applyDamageToEnemy,
  ENEMIES
};
