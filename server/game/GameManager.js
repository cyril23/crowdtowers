import { v4 as uuidv4 } from 'uuid';
import { GAME_CONFIG, GAME_STATUS, TILE_TYPES, MAZE_SIZES, SOCKET_EVENTS } from '../../shared/constants.js';
import { getTowerCost, getTowerRange, getTowerFireRate, calculateDamage, getSellValue, TOWERS } from './towers.js';
import { generateWaveEnemies, applyDamageToEnemy, getWaveComposition, getEnemyStats } from './enemies.js';
import { createGameLogger } from '../utils/logger.js';

class GameManager {
  constructor(io, sessionCode, gameData) {
    this.io = io;
    this.sessionCode = sessionCode;
    this.gameData = gameData;
    this.gameId = gameData._id?.toString() || sessionCode;
    this.log = createGameLogger(this.gameId);

    // Runtime state (not persisted)
    this.enemies = [];
    this.projectiles = [];
    this.towerCooldowns = new Map();
    this.gameLoop = null;
    this.waveTimeout = null;
    this.lastTick = Date.now();

    // Stats tracking
    this.totalUpgrades = 0;
    this.highestTowerLevel = 1;
    this.totalBudgetSpent = 0;
  }

  start() {
    this.gameData.status = GAME_STATUS.PLAYING;
    this.gameData.gameState.currentWave = 0;

    this.log.event('GAME_START', {
      players: this.gameData.players.length,
      mazeSize: this.gameData.mazeSize
    });

    // Start game loop
    this.gameLoop = setInterval(() => this.tick(), 1000 / GAME_CONFIG.TICK_RATE);

    // Start first wave after delay
    this.scheduleNextWave(3000);
  }

  stop() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    if (this.waveTimeout) {
      clearTimeout(this.waveTimeout);
      this.waveTimeout = null;
    }
  }

  pause(nickname) {
    if (this.gameData.status === GAME_STATUS.PLAYING) {
      this.gameData.status = GAME_STATUS.PAUSED;
      this.gameData.pausedBy = nickname;
      this.log.event('GAME_PAUSE', { pausedBy: nickname });
      this.stop();
    }
  }

  resume() {
    if (this.gameData.status === GAME_STATUS.PAUSED) {
      this.gameData.status = GAME_STATUS.PLAYING;
      this.log.event('GAME_RESUME', {});
      this.gameData.pausedBy = null;
      this.lastTick = Date.now();
      this.gameLoop = setInterval(() => this.tick(), 1000 / GAME_CONFIG.TICK_RATE);
    }
  }

  tick() {
    const now = Date.now();
    const deltaTime = (now - this.lastTick) / 1000;
    this.lastTick = now;

    if (this.gameData.status !== GAME_STATUS.PLAYING) {
      return;
    }

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update towers (targeting and shooting)
    this.updateTowers(now);

    // Broadcast state to all players
    this.broadcastState();
  }

  updateEnemies(deltaTime) {
    const mazeConfig = MAZE_SIZES[this.gameData.mazeSize];
    const tileSize = mazeConfig.tileSize;
    const path = this.gameData.maze.path;
    const now = Date.now();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // Check spawn delay
      if (enemy.spawnDelay > 0) {
        enemy.spawnDelay -= deltaTime * 1000;
        continue;
      }

      // Check if slowed
      let speedMultiplier = 1;
      if (enemy.slowedUntil && enemy.slowedUntil > now) {
        speedMultiplier = 0.5;
      }

      // Move along path
      if (enemy.pathIndex < path.length) {
        const target = path[enemy.pathIndex];
        const targetX = target.x * tileSize + tileSize / 2;
        const targetY = target.y * tileSize + tileSize / 2;

        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const moveSpeed = enemy.speed * speedMultiplier * deltaTime;

        if (distance <= moveSpeed) {
          enemy.x = targetX;
          enemy.y = targetY;
          enemy.pathIndex++;
        } else {
          enemy.x += (dx / distance) * moveSpeed;
          enemy.y += (dy / distance) * moveSpeed;
        }

        // Check if enemy reached exit
        if (enemy.pathIndex >= path.length) {
          this.enemyReachedExit(enemy, i);
        }
      }
    }
  }

  enemyReachedExit(enemy, index) {
    this.enemies.splice(index, 1);
    this.gameData.gameState.lives--;

    this.log.event('ENEMY_ESCAPED', {
      type: enemy.type,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      livesRemaining: this.gameData.gameState.lives
    });

    this.io.to(this.sessionCode).emit('enemy-reached-exit', {
      livesRemaining: this.gameData.gameState.lives
    });

    if (this.gameData.gameState.lives <= 0) {
      this.gameOver(false);
    }

    // Check if wave is complete (even if last enemy escaped)
    if (this.enemies.length === 0 && this.gameData.gameState.waveInProgress) {
      this.waveComplete();
    }
  }

  updateTowers(now) {
    const mazeConfig = MAZE_SIZES[this.gameData.mazeSize];
    const tileSize = mazeConfig.tileSize;

    for (const tower of this.gameData.gameState.towers) {
      const towerId = tower.id;
      const lastFired = this.towerCooldowns.get(towerId) || 0;
      const fireRate = getTowerFireRate(tower.type, tower.level);

      if (now - lastFired < fireRate) {
        continue;
      }

      // Find target
      const towerX = tower.gridX * tileSize + tileSize / 2;
      const towerY = tower.gridY * tileSize + tileSize / 2;
      const range = getTowerRange(tower.type, tower.level) * tileSize;

      let target = null;
      let minDistance = Infinity;

      for (const enemy of this.enemies) {
        if (enemy.spawnDelay > 0) continue;

        const dx = enemy.x - towerX;
        const dy = enemy.y - towerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= range && distance < minDistance) {
          minDistance = distance;
          target = enemy;
        }
      }

      if (target) {
        this.fireTower(tower, target, now);
      }
    }
  }

  fireTower(tower, target, now) {
    this.towerCooldowns.set(tower.id, now);

    const mazeConfig = MAZE_SIZES[this.gameData.mazeSize];
    const tileSize = mazeConfig.tileSize;
    const towerX = tower.gridX * tileSize + tileSize / 2;
    const towerY = tower.gridY * tileSize + tileSize / 2;

    const damage = calculateDamage(tower.type, tower.level, target.type);
    const result = applyDamageToEnemy(target, damage, tower.type);

    const towerDef = TOWERS[tower.type];

    // Emit tower-fired event for client-side projectile visuals
    this.io.to(this.sessionCode).emit(SOCKET_EVENTS.TOWER_FIRED, {
      towerType: tower.type,
      fromX: towerX,
      fromY: towerY,
      toX: target.x,
      toY: target.y,
      targetId: target.id,
      hit: !result.dodged
    });

    // Apply special effects
    if (towerDef.special === 'slow' && !result.dodged) {
      target.slowedUntil = now + towerDef.slowDuration;
    }

    if (result.killed) {
      this.enemyKilled(target, result.spawns);
    }

    // Handle chain lightning
    if (towerDef.special === 'chain' && !result.dodged) {
      this.chainLightning(tower, target, towerDef.chainTargets - 1);
    }

    // Handle splash damage
    if (towerDef.special === 'splash') {
      this.splashDamage(tower, target, towerDef.splashRadius);
    }
  }

  chainLightning(tower, initialTarget, remainingTargets) {
    if (remainingTargets <= 0) return;

    const mazeConfig = MAZE_SIZES[this.gameData.mazeSize];
    const tileSize = mazeConfig.tileSize;
    const chainRange = 2 * tileSize;

    let lastTarget = initialTarget;

    for (let i = 0; i < remainingTargets; i++) {
      let nextTarget = null;
      let minDistance = Infinity;

      for (const enemy of this.enemies) {
        if (enemy === lastTarget || enemy.spawnDelay > 0) continue;

        const dx = enemy.x - lastTarget.x;
        const dy = enemy.y - lastTarget.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= chainRange && distance < minDistance) {
          minDistance = distance;
          nextTarget = enemy;
        }
      }

      if (nextTarget) {
        const damage = calculateDamage(tower.type, tower.level, nextTarget.type) * 0.7;
        const result = applyDamageToEnemy(nextTarget, damage, tower.type);

        if (result.killed) {
          this.enemyKilled(nextTarget, result.spawns);
        }

        lastTarget = nextTarget;
      } else {
        break;
      }
    }
  }

  splashDamage(tower, target, radius) {
    const mazeConfig = MAZE_SIZES[this.gameData.mazeSize];
    const tileSize = mazeConfig.tileSize;
    const splashRange = radius * tileSize;

    for (const enemy of this.enemies) {
      if (enemy === target || enemy.spawnDelay > 0) continue;

      const dx = enemy.x - target.x;
      const dy = enemy.y - target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= splashRange) {
        const damage = calculateDamage(tower.type, tower.level, enemy.type) * 0.5;
        const result = applyDamageToEnemy(enemy, damage, tower.type);

        if (result.killed) {
          this.enemyKilled(enemy, result.spawns);
        }
      }
    }
  }

  enemyKilled(enemy, spawns) {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) {
      this.enemies.splice(index, 1);
    }

    this.gameData.gameState.budget += enemy.reward;

    this.log.event('ENEMY_KILLED', {
      type: enemy.type,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      reward: enemy.reward,
      budget: this.gameData.gameState.budget
    });

    this.io.to(this.sessionCode).emit('enemy-killed', {
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      reward: enemy.reward,
      newBudget: this.gameData.gameState.budget
    });

    // Handle spawning (Broodmother)
    if (spawns) {
      for (let i = 0; i < spawns.count; i++) {
        const spawn = {
          ...getEnemyStats(spawns.type, this.gameData.gameState.currentWave),
          id: `spawn_${Date.now()}_${i}`, // Must come AFTER spread to override type-based id
          type: spawns.type,
          pathIndex: enemy.pathIndex,
          x: enemy.x + (Math.random() - 0.5) * 24,
          y: enemy.y + (Math.random() - 0.5) * 24,
          slowedUntil: 0,
          spawnDelay: i * 200 // Small stagger for spawned enemies
        };
        this.enemies.push(spawn);
      }
    }

    // Check if wave is complete
    if (this.enemies.length === 0 && this.gameData.gameState.waveInProgress) {
      this.waveComplete();
    }
  }

  waveComplete() {
    this.gameData.gameState.waveInProgress = false;

    this.log.event('WAVE_COMPLETE', {
      wave: this.gameData.gameState.currentWave,
      livesRemaining: this.gameData.gameState.lives,
      budget: this.gameData.gameState.budget
    });

    this.io.to(this.sessionCode).emit('wave-complete', {
      waveNumber: this.gameData.gameState.currentWave
    });

    // No victory condition - waves continue infinitely until defeat

    // Schedule next wave
    this.scheduleNextWave(5000);
  }

  scheduleNextWave(delay) {
    this.waveTimeout = setTimeout(() => {
      this.startWave();
    }, delay);
  }

  startWave() {
    this.gameData.gameState.currentWave++;
    this.gameData.gameState.waveInProgress = true;

    const mazeConfig = MAZE_SIZES[this.gameData.mazeSize];
    const tileSize = mazeConfig.tileSize;
    const entry = this.gameData.maze.entry;

    // Generate enemies for this wave
    this.enemies = generateWaveEnemies(this.gameData.gameState.currentWave);

    // Set initial position at entry with small random spread
    const entryX = entry.x * tileSize + tileSize / 2;
    const entryY = entry.y * tileSize + tileSize / 2;

    for (const enemy of this.enemies) {
      // Small random offset to prevent perfect overlap (±8 pixels)
      enemy.x = entryX + (Math.random() - 0.5) * 16;
      enemy.y = entryY + (Math.random() - 0.5) * 16;
    }

    const composition = getWaveComposition(this.gameData.gameState.currentWave);
    this.log.event('WAVE_START', {
      wave: this.gameData.gameState.currentWave,
      enemyCount: this.enemies.length,
      types: composition.enemies.join(',')
    });

    this.io.to(this.sessionCode).emit('wave-start', {
      waveNumber: this.gameData.gameState.currentWave,
      enemyCount: this.enemies.length,
      composition
    });
  }

  gameOver(victory) {
    this.stop();
    this.gameData.status = GAME_STATUS.COMPLETED;

    this.log.event('GAME_OVER', {
      victory,
      finalWave: this.gameData.gameState.currentWave,
      towers: this.gameData.gameState.towers.length,
      livesRemaining: this.gameData.gameState.lives,
      budgetRemaining: this.gameData.gameState.budget
    });

    this.io.to(this.sessionCode).emit('game-over', {
      victory,
      finalWave: this.gameData.gameState.currentWave,
      stats: {
        towersBuilt: this.gameData.gameState.towers.length,
        livesRemaining: this.gameData.gameState.lives,
        budgetRemaining: this.gameData.gameState.budget,
        totalUpgrades: this.totalUpgrades,
        highestTowerLevel: this.highestTowerLevel,
        totalBudgetSpent: this.totalBudgetSpent
      }
    });
  }

  placeTower(towerType, gridX, gridY) {
    const grid = this.gameData.maze.grid;
    const towerDef = TOWERS[towerType];

    if (!towerDef) {
      return { success: false, error: 'Invalid tower type' };
    }

    // Check if tile is buildable
    if (grid[gridY][gridX] !== TILE_TYPES.BUILDABLE) {
      return { success: false, error: 'Cannot build here' };
    }

    // Check if tile already has a tower
    const existingTower = this.gameData.gameState.towers.find(
      t => t.gridX === gridX && t.gridY === gridY
    );
    if (existingTower) {
      return { success: false, error: 'Tower already exists here' };
    }

    // Check budget
    const cost = getTowerCost(towerType, 1);
    if (this.gameData.gameState.budget < cost) {
      return { success: false, error: 'Insufficient budget' };
    }

    // Place tower
    const tower = {
      id: uuidv4(),
      type: towerType,
      gridX,
      gridY,
      level: 1
    };

    this.gameData.gameState.towers.push(tower);
    this.gameData.gameState.budget -= cost;
    this.totalBudgetSpent += cost;

    this.log.event('TOWER_PLACED', {
      type: towerType,
      x: gridX,
      y: gridY,
      cost,
      budget: this.gameData.gameState.budget
    });

    return { success: true, tower, newBudget: this.gameData.gameState.budget };
  }

  upgradeTower(towerId) {
    const tower = this.gameData.gameState.towers.find(t => t.id === towerId);

    if (!tower) {
      return { success: false, error: 'Tower not found' };
    }

    const nextLevel = tower.level + 1;
    const cost = getTowerCost(tower.type, nextLevel);

    if (this.gameData.gameState.budget < cost) {
      return { success: false, error: 'Insufficient budget' };
    }

    tower.level = nextLevel;
    this.gameData.gameState.budget -= cost;
    this.totalBudgetSpent += cost;

    // Track stats
    this.totalUpgrades++;
    if (nextLevel > this.highestTowerLevel) {
      this.highestTowerLevel = nextLevel;
    }

    this.log.event('TOWER_UPGRADED', {
      type: tower.type,
      x: tower.gridX,
      y: tower.gridY,
      level: nextLevel,
      cost,
      budget: this.gameData.gameState.budget
    });

    return {
      success: true,
      towerId,
      newLevel: nextLevel,
      newBudget: this.gameData.gameState.budget
    };
  }

  sellTower(towerId) {
    const towerIndex = this.gameData.gameState.towers.findIndex(t => t.id === towerId);

    if (towerIndex === -1) {
      return { success: false, error: 'Tower not found' };
    }

    const tower = this.gameData.gameState.towers[towerIndex];
    const sellValue = getSellValue(tower.type, tower.level);

    this.log.event('TOWER_SOLD', {
      type: tower.type,
      x: tower.gridX,
      y: tower.gridY,
      level: tower.level,
      sellValue,
      budget: this.gameData.gameState.budget + sellValue
    });

    // Remove tower from game state
    this.gameData.gameState.towers.splice(towerIndex, 1);

    // Remove tower cooldown
    this.towerCooldowns.delete(towerId);

    // Add sell value to budget
    this.gameData.gameState.budget += sellValue;

    return {
      success: true,
      towerId,
      sellValue,
      newBudget: this.gameData.gameState.budget
    };
  }

  broadcastState() {
    this.io.to(this.sessionCode).emit('game-state-sync', {
      enemies: this.enemies.filter(e => e.spawnDelay <= 0).map(e => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        health: e.health,
        maxHealth: e.maxHealth
      })),
      budget: this.gameData.gameState.budget,
      lives: this.gameData.gameState.lives,
      wave: this.gameData.gameState.currentWave
    });
  }

  getState() {
    return {
      maze: this.gameData.maze,
      gameState: this.gameData.gameState,
      status: this.gameData.status,
      pausedBy: this.gameData.pausedBy,
      enemies: this.enemies.filter(e => e.spawnDelay <= 0)
    };
  }
}

export default GameManager;
