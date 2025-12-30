class HUD {
  constructor() {
    this.elements = {
      hud: document.getElementById('hud'),
      lives: document.getElementById('lives-value'),
      budget: document.getElementById('budget-value'),
      wave: document.getElementById('wave-value')
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
    this.elements.budget.textContent = value;
  }

  updateWave(value) {
    this.elements.wave.textContent = value;
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
