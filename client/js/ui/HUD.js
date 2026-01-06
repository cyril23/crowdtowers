// HUD class - displays lives, budget, wave info
import { formatCurrency } from '../utils/formatNumber.js';

class HUD {
  constructor() {
    this.elements = {
      hud: document.getElementById('hud'),
      lives: document.getElementById('lives-value'),
      budget: document.getElementById('budget-value'),
      wave: document.getElementById('wave-value'),
      speedDisplay: document.getElementById('speed-display'),
      speedValue: document.getElementById('speed-value')
    };
  }

  show() {
    this.elements.hud.classList.remove('hidden');
  }

  hide() {
    this.elements.hud.classList.add('hidden');
  }

  updateLives(value) {
    this.elements.lives.textContent = value;

    // Add warning style when low
    if (value <= 3) {
      this.elements.lives.classList.add('warning');
    } else {
      this.elements.lives.classList.remove('warning');
    }
  }

  updateBudget(value) {
    this.elements.budget.textContent = formatCurrency(value);
  }

  updateWave(value) {
    this.elements.wave.textContent = value;
  }

  updateSpeed(value) {
    // Only show speed indicator when not at 100% (normal speed)
    if (value === 1) {
      this.elements.speedDisplay.classList.add('hidden');
    } else {
      this.elements.speedDisplay.classList.remove('hidden');
      this.elements.speedValue.textContent = `${Math.round(value * 100)}%`;
    }
  }

  update(gameState) {
    if (gameState.lives !== undefined) {
      this.updateLives(gameState.lives);
    }
    if (gameState.budget !== undefined) {
      this.updateBudget(gameState.budget);
    }
    if (gameState.wave !== undefined) {
      this.updateWave(gameState.wave);
    }
  }
}

// ES module export
export { HUD };
