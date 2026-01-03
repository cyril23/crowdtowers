import { TOWERS, ENEMIES } from '../../../shared/constants.js';
import { networkManager } from '../managers/NetworkManager.js';
import { soundManager } from '../managers/SoundManager.js';

class TowerMenu {
  constructor() {
    this.elements = {
      panel: document.getElementById('tower-panel'),
      list: document.getElementById('tower-list'),
      upgradePanel: document.getElementById('upgrade-panel'),
      upgradeInfo: document.getElementById('upgrade-info'),
      upgradeBtn: document.getElementById('upgrade-btn'),
      sellBtn: document.getElementById('sell-btn'),
      upgradeClose: document.getElementById('upgrade-close'),
      enemyPanel: document.getElementById('enemy-panel'),
      enemyInfo: document.getElementById('enemy-info'),
      enemyClose: document.getElementById('enemy-close')
    };

    this.selectedType = null;
    this.selectedTower = null;
    this.selectedEnemy = null;
    this.currentBudget = 0;
    this.onTowerSelect = null;
    this.onTowerDeselect = null;
    this.onTowerSold = null;

    this.setupEventListeners();
    this.buildTowerList();
  }

  setupEventListeners() {
    this.elements.upgradeBtn.addEventListener('click', () => {
      if (this.selectedTower) {
        networkManager.upgradeTower(this.selectedTower.id);
      }
    });

    this.elements.sellBtn.addEventListener('click', () => {
      if (this.selectedTower) {
        networkManager.sellTower(this.selectedTower.id);
        this.hideUpgradePanel();
      }
    });

    this.elements.upgradeClose.addEventListener('click', () => {
      this.hideUpgradePanel();
    });

    this.elements.enemyClose.addEventListener('click', () => {
      this.hideEnemyPanel();
    });
  }

  // Calculate total cost of tower (base + all upgrades)
  getTotalTowerCost(towerType, level) {
    const tower = TOWERS[towerType];
    let total = 0;
    for (let l = 1; l <= level; l++) {
      if (l === 1) {
        total += tower.cost;
      } else {
        total += Math.floor(tower.cost * Math.pow(tower.upgradeMultiplier, l - 1));
      }
    }
    return total;
  }

  // Get sell value (50% of total investment)
  getSellValue(towerType, level) {
    return Math.floor(this.getTotalTowerCost(towerType, level) * 0.5);
  }

  buildTowerList() {
    this.elements.list.innerHTML = '';

    Object.entries(TOWERS).forEach(([type, tower]) => {
      const towerEl = document.createElement('div');
      towerEl.className = 'tower-item';
      towerEl.dataset.type = type;

      const colorHex = '#' + tower.color.toString(16).padStart(6, '0');

      towerEl.innerHTML = `
        <div class="tower-icon" style="background-color: ${colorHex}"></div>
        <div class="tower-info">
          <div class="tower-name">${tower.name}</div>
          <div class="tower-cost">$${tower.cost}</div>
        </div>
        <div class="tower-stats">
          <div>DMG: ${tower.damage}</div>
          <div>RNG: ${tower.range}</div>
        </div>
      `;

      towerEl.addEventListener('click', () => {
        this.selectTower(type);
      });

      // Touch support for mobile
      towerEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.selectTower(type);
      });

      this.elements.list.appendChild(towerEl);
    });
  }

  selectTower(type) {
    // If clicking the same tower, deselect it
    if (this.selectedType === type) {
      this.clearHighlight();
      if (this.onTowerDeselect) {
        this.onTowerDeselect();
      }
      return;
    }

    // Play selection sound
    soundManager.play('tower_select');

    // Remove previous selection
    const prev = this.elements.list.querySelector('.selected');
    if (prev) {
      prev.classList.remove('selected');
    }

    // Add new selection
    const towerEl = this.elements.list.querySelector(`[data-type="${type}"]`);
    if (towerEl) {
      towerEl.classList.add('selected');
    }

    this.selectedType = type;

    if (this.onTowerSelect) {
      this.onTowerSelect(type);
    }
  }

  highlightTower(type) {
    // Visual update only - does NOT trigger onTowerSelect callback
    // This prevents circular calls when InputManager.selectTowerType calls this
    const prev = this.elements.list.querySelector('.selected');
    if (prev) {
      prev.classList.remove('selected');
    }

    const towerEl = this.elements.list.querySelector(`[data-type="${type}"]`);
    if (towerEl) {
      towerEl.classList.add('selected');
    }

    this.selectedType = type;
  }

  clearHighlight() {
    const prev = this.elements.list.querySelector('.selected');
    if (prev) {
      prev.classList.remove('selected');
    }
    this.selectedType = null;
  }

  show() {
    this.elements.panel.classList.remove('hidden');
  }

  hide() {
    this.elements.panel.classList.add('hidden');
  }

  showUpgradePanel(tower, budget) {
    this.selectedTower = tower;
    this.currentBudget = budget;
    const towerDef = TOWERS[tower.type];

    const upgradeCost = Math.floor(towerDef.cost * Math.pow(towerDef.upgradeMultiplier, tower.level));
    const currentDamage = towerDef.damage * Math.pow(towerDef.damageMultiplier, tower.level - 1);
    const nextDamage = towerDef.damage * Math.pow(towerDef.damageMultiplier, tower.level);
    const sellValue = this.getSellValue(tower.type, tower.level);

    const canAfford = budget >= upgradeCost;

    // Build special ability info for Cryo Cannon
    let specialInfo = '';
    if (towerDef.special === 'slow' && towerDef.slowDurationBonus) {
      const currentSlow = (towerDef.slowDuration + towerDef.slowDurationBonus * (tower.level - 1)) / 1000;
      const nextSlow = (towerDef.slowDuration + towerDef.slowDurationBonus * tower.level) / 1000;
      specialInfo = `<p>Slow: ${currentSlow.toFixed(1)}s → ${nextSlow.toFixed(1)}s</p>`;
    }

    this.elements.upgradeInfo.innerHTML = `
      <h3>${towerDef.name}</h3>
      <p>Level: ${tower.level}</p>
      <p>Damage: ${currentDamage.toFixed(1)} → ${nextDamage.toFixed(1)}</p>
      ${specialInfo}
      <p>Upgrade Cost: $${upgradeCost}</p>
      <p class="sell-info">Sell Value: $${sellValue} (50%)</p>
    `;

    this.elements.upgradeBtn.disabled = !canAfford;
    this.elements.upgradeBtn.textContent = canAfford ? 'Upgrade' : 'Not enough budget';
    this.elements.sellBtn.textContent = `Sell (+$${sellValue})`;

    this.elements.upgradePanel.classList.remove('hidden');
  }

  hideUpgradePanel() {
    this.selectedTower = null;
    this.elements.upgradePanel.classList.add('hidden');
  }

  updateBudget(budget) {
    this.currentBudget = budget;

    // Update tower affordability display
    Object.entries(TOWERS).forEach(([type, tower]) => {
      const towerEl = this.elements.list.querySelector(`[data-type="${type}"]`);
      if (towerEl) {
        if (budget < tower.cost) {
          towerEl.classList.add('unaffordable');
        } else {
          towerEl.classList.remove('unaffordable');
        }
      }
    });

    // Refresh upgrade panel if open (e.g., when enemy killed gives money)
    if (this.selectedTower) {
      this.refreshUpgradePanel();
    }
  }

  refreshUpgradePanel() {
    if (!this.selectedTower) return;

    const tower = this.selectedTower;
    const towerDef = TOWERS[tower.type];
    const budget = this.currentBudget;

    const upgradeCost = Math.floor(towerDef.cost * Math.pow(towerDef.upgradeMultiplier, tower.level));
    const currentDamage = towerDef.damage * Math.pow(towerDef.damageMultiplier, tower.level - 1);
    const nextDamage = towerDef.damage * Math.pow(towerDef.damageMultiplier, tower.level);
    const sellValue = this.getSellValue(tower.type, tower.level);

    const canAfford = budget >= upgradeCost;

    // Build special ability info for Cryo Cannon
    let specialInfo = '';
    if (towerDef.special === 'slow' && towerDef.slowDurationBonus) {
      const currentSlow = (towerDef.slowDuration + towerDef.slowDurationBonus * (tower.level - 1)) / 1000;
      const nextSlow = (towerDef.slowDuration + towerDef.slowDurationBonus * tower.level) / 1000;
      specialInfo = `<p>Slow: ${currentSlow.toFixed(1)}s → ${nextSlow.toFixed(1)}s</p>`;
    }

    this.elements.upgradeInfo.innerHTML = `
      <h3>${towerDef.name}</h3>
      <p>Level: ${tower.level}</p>
      <p>Damage: ${currentDamage.toFixed(1)} → ${nextDamage.toFixed(1)}</p>
      ${specialInfo}
      <p>Upgrade Cost: $${upgradeCost}</p>
      <p class="sell-info">Sell Value: $${sellValue} (50%)</p>
    `;

    this.elements.upgradeBtn.disabled = !canAfford;
    this.elements.upgradeBtn.textContent = canAfford ? 'Upgrade' : 'Not enough budget';
    this.elements.sellBtn.textContent = `Sell (+$${sellValue})`;
  }

  showEnemyPanel(enemy) {
    this.selectedEnemy = enemy;
    this.lastEnemyData = { ...enemy }; // Store for death state display
    this.hideUpgradePanel(); // Hide tower panel if open

    const enemyDef = ENEMIES[enemy.type];
    if (!enemyDef) return;

    const healthPercent = Math.round((enemy.health / enemy.maxHealth) * 100);

    // Build special ability description
    let specialDesc = '';
    if (enemyDef.special === 'phase') {
      specialDesc = `<p class="enemy-special">Phase: ${Math.round(enemyDef.phaseChance * 100)}% dodge chance</p>`;
    } else if (enemyDef.special === 'armor') {
      specialDesc = `<p class="enemy-special">Armor: ${Math.round(enemyDef.armorReduction * 100)}% damage reduction</p>`;
    } else if (enemyDef.special === 'spawn') {
      specialDesc = `<p class="enemy-special">Spawns ${enemyDef.spawnCount} ${enemyDef.spawnType}s on death</p>`;
    }

    // Find which towers are strong/weak against this enemy
    const strongTowers = [];
    const weakTowers = [];
    Object.values(TOWERS).forEach(tower => {
      if (tower.strongVs && tower.strongVs.includes(enemy.type)) {
        strongTowers.push(tower.name);
      }
      if (tower.weakVs && tower.weakVs.includes(enemy.type)) {
        weakTowers.push(tower.name);
      }
    });

    const slowAmount = TOWERS.cryoCannon.slowAmount; // 0.5 = 50% speed
    const actualSpeed = enemy.slowed
      ? Math.round(enemyDef.speed * slowAmount)
      : enemyDef.speed;
    const speedDisplay = enemy.slowed
      ? `<span class="slowed">${actualSpeed} (SLOWED)</span>`
      : `${actualSpeed}`;

    this.elements.enemyInfo.innerHTML = `
      <h3>${enemyDef.name}</h3>
      <p>Health: ${Math.round(enemy.health)}/${enemy.maxHealth} (${healthPercent}%)</p>
      <p>Speed: ${speedDisplay}</p>
      <p>Reward: $${enemy.reward}</p>
      ${specialDesc}
      ${strongTowers.length ? `<p class="enemy-weak">Weak to: ${strongTowers.join(', ')}</p>` : ''}
      ${weakTowers.length ? `<p class="enemy-strong">Strong vs: ${weakTowers.join(', ')}</p>` : ''}
    `;

    this.elements.enemyPanel.classList.remove('hidden');
    this.elements.enemyPanel.classList.remove('killed');
    this.elements.enemyPanel.classList.remove('escaped');
  }

  hideEnemyPanel() {
    this.selectedEnemy = null;
    this.lastEnemyData = null;
    this.elements.enemyPanel.classList.add('hidden');
    this.elements.enemyPanel.classList.remove('killed');
    this.elements.enemyPanel.classList.remove('escaped');
  }

  updateEnemyPanel(enemy) {
    if (this.selectedEnemy && this.selectedEnemy.id === enemy.id) {
      this.selectedEnemy.health = enemy.health;
      this.showEnemyPanel(enemy);
    }
  }

  showEnemyGone(escaped = false) {
    if (!this.lastEnemyData) return;

    const enemy = this.lastEnemyData;
    const enemyDef = ENEMIES[enemy.type];
    if (!enemyDef) return;

    // Find which towers are strong/weak against this enemy
    const strongTowers = [];
    Object.values(TOWERS).forEach(tower => {
      if (tower.strongVs && tower.strongVs.includes(enemy.type)) {
        strongTowers.push(tower.name);
      }
    });

    const statusClass = escaped ? 'enemy-escaped' : 'enemy-killed';
    const statusText = escaped ? 'ESCAPED' : 'KILLED';
    const rewardLine = escaped
      ? `<p>Reward: $${enemy.reward} (LOST)</p>`
      : `<p>Reward: $${enemy.reward}</p>`;

    this.elements.enemyInfo.innerHTML = `
      <h3>${enemyDef.name}</h3>
      <p class="${statusClass}">${statusText}</p>
      <p>Max Health: ${enemy.maxHealth}</p>
      <p>Speed: ${enemyDef.speed}</p>
      ${rewardLine}
      ${strongTowers.length ? `<p class="enemy-weak">Was weak to: ${strongTowers.join(', ')}</p>` : ''}
    `;

    this.elements.enemyPanel.classList.add(escaped ? 'escaped' : 'killed');
  }

  // Backwards compatibility alias
  showEnemyDeath() {
    this.showEnemyGone(false);
  }
}

// ES module export
export { TowerMenu };
