const { ENEMIES, WAVE_COMPOSITION } = require('../../shared/constants');

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

  // Accelerated scaling after first cycle: +10% more per wave per cycle
  // Cycle 0: no acceleration, Cycle 1: +10% per wave, Cycle 2: +20% per wave
  const acceleratedScaling = cycleNumber > 0
    ? 1 + (0.10 * cycleNumber * waveInCycle)
    : 1;

  const finalHealth = Math.floor(enemy.health * baseMultiplier * cycleBonus * acceleratedScaling);

  return {
    ...enemy,
    health: finalHealth,
    maxHealth: finalHealth,
    speed: enemy.speed
  };
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
