import { TOWERS } from '../../shared/constants.js';

function getTowerCost(towerType, level = 1) {
  const tower = TOWERS[towerType];
  if (!tower) return null;

  if (level === 1) {
    return tower.cost;
  }

  // Upgrade cost formula: base * multiplier^(level-1)
  return Math.floor(tower.cost * Math.pow(tower.upgradeMultiplier, level - 1));
}

function getTowerDamage(towerType, level = 1) {
  const tower = TOWERS[towerType];
  if (!tower) return 0;

  // Damage formula: base * damageMultiplier^(level-1) (geometric scaling)
  return tower.damage * Math.pow(tower.damageMultiplier, level - 1);
}

function calculateDamage(towerType, towerLevel, enemyType) {
  const tower = TOWERS[towerType];
  if (!tower) return 0;

  let damage = getTowerDamage(towerType, towerLevel);

  // Apply type effectiveness
  if (tower.strongVs && tower.strongVs.includes(enemyType)) {
    damage *= 1.5; // 50% more damage
  } else if (tower.weakVs && tower.weakVs.includes(enemyType)) {
    damage *= 0.5; // 50% less damage
  }

  return damage;
}

function getTowerRange(towerType, _level = 1) {
  const tower = TOWERS[towerType];
  if (!tower) return 0;

  // Range is fixed (no level scaling)
  return tower.range;
}

function getTowerFireRate(towerType, _level = 1) {
  const tower = TOWERS[towerType];
  if (!tower) return 1000;

  // Fire rate is fixed (no level scaling)
  return tower.fireRate;
}

function getTotalTowerCost(towerType, currentLevel) {
  // Calculate total investment: base cost + all upgrade costs
  let total = 0;
  for (let level = 1; level <= currentLevel; level++) {
    total += getTowerCost(towerType, level);
  }
  return total;
}

function getSellValue(towerType, currentLevel) {
  // Return 50% of total investment
  return Math.floor(getTotalTowerCost(towerType, currentLevel) * 0.5);
}

export {
  getTowerCost,
  getTowerDamage,
  calculateDamage,
  getTowerRange,
  getTowerFireRate,
  getTotalTowerCost,
  getSellValue,
  TOWERS
};
