import { soundManager, SoundManager } from '../managers/SoundManager.js';

// Singleton instance
let gameMenuInstance = null;

class GameMenuManager {
  constructor() {
    // Return existing instance if already created (singleton pattern)
    if (gameMenuInstance) {
      return gameMenuInstance;
    }

    this.elements = {
      menu: document.getElementById('game-menu'),
      toggleBtn: document.getElementById('menu-toggle-btn'),
      dropdown: document.getElementById('game-menu-dropdown'),
      badge: document.getElementById('menu-badge'),
      sessionCode: document.getElementById('menu-session-code'),
      codeValue: document.getElementById('menu-code-value'),
      copyBtn: document.getElementById('menu-copy-btn'),
      dynamicButtons: document.getElementById('menu-dynamic-buttons'),
      sfxSlider: document.getElementById('sfx-volume'),
      sfxValue: document.getElementById('sfx-volume-value'),
      sfxMuteBtn: document.getElementById('sfx-mute-btn'),
      musicSlider: document.getElementById('music-volume'),
      musicValue: document.getElementById('music-volume-value'),
      musicMuteBtn: document.getElementById('music-mute-btn')
    };

    this.currentConfig = null;
    this.callbacks = {};
    this.unreadCount = 0;

    this.setupVolumeControls();
    this.setupToggleButton();
    this.setupCopyButton();
    this.setupDocumentClickHandler();

    gameMenuInstance = this;
  }

  /**
   * Configure the menu for a specific scene
   * @param {Object} options Configuration options
   * @param {boolean} options.showSessionCode Whether to show session code section
   * @param {string} options.sessionCode The session code to display
   * @param {Array} options.buttons Array of button configs: { id, label, onClick, danger, updateLabel }
   * @param {string} options.position 'top-right' for fixed position, 'in-hud' for HUD integration
   */
  configure(options) {
    this.currentConfig = options;
    this.callbacks = {};

    // Show/hide session code
    if (options.showSessionCode && options.sessionCode) {
      this.elements.sessionCode.classList.remove('hidden');
      this.elements.codeValue.textContent = options.sessionCode;
    } else {
      this.elements.sessionCode.classList.add('hidden');
    }

    // Build dynamic buttons
    this.elements.dynamicButtons.innerHTML = '';
    if (options.buttons && options.buttons.length > 0) {
      options.buttons.forEach(btnConfig => {
        const btn = document.createElement('button');
        btn.id = `menu-${btnConfig.id}-btn`;
        btn.className = btnConfig.danger ? 'menu-btn menu-btn-danger' : 'menu-btn';
        btn.textContent = btnConfig.label;
        btn.onclick = () => {
          if (btnConfig.onClick) btnConfig.onClick();
          this.closeDropdown();
        };
        this.elements.dynamicButtons.appendChild(btn);

        // Store callback for label updates
        if (btnConfig.updateLabel) {
          this.callbacks[btnConfig.id] = btnConfig.updateLabel;
        }
      });
    }

    // Position menu
    this.positionMenu(options.position || 'top-right');

    // Initialize volume display
    this.updateVolumeDisplay();
    this.updateMuteButtons();
    this.updateSliderDisabledState();
  }

  positionMenu(position) {
    if (position === 'in-hud') {
      // Remove fixed positioning class
      this.elements.menu.classList.remove('fixed-position');
      // Move to HUD-right if not already there
      const hudRight = document.getElementById('hud-right');
      if (hudRight && this.elements.menu.parentNode !== hudRight) {
        hudRight.appendChild(this.elements.menu);
      }
    } else {
      // Fixed top-right positioning
      this.elements.menu.classList.add('fixed-position');
      // Move to body if not there
      if (this.elements.menu.parentNode !== document.body) {
        document.body.appendChild(this.elements.menu);
      }
    }
  }

  show() {
    this.elements.menu.classList.remove('hidden');
    this.updateVolumeDisplay();
    this.updateMuteButtons();
    this.updateSliderDisabledState();
  }

  hide() {
    this.elements.menu.classList.add('hidden');
    this.closeDropdown();
  }

  closeDropdown() {
    this.elements.dropdown.classList.add('hidden');
  }

  setupVolumeControls() {
    // SFX slider
    this.elements.sfxSlider.oninput = () => {
      const val = parseInt(this.elements.sfxSlider.value);
      this.elements.sfxValue.textContent = val + '%';
      soundManager.setSfxVolume(SoundManager.sliderToVolume(val / 100));
    };

    // Music slider
    this.elements.musicSlider.oninput = () => {
      const val = parseInt(this.elements.musicSlider.value);
      this.elements.musicValue.textContent = val + '%';
      soundManager.setMusicVolume(SoundManager.sliderToVolume(val / 100));
    };

    // SFX mute button
    this.elements.sfxMuteBtn.onclick = (e) => {
      e.stopPropagation();
      soundManager.toggleSfxMute();
      this.updateMuteButtons();
      this.updateSliderDisabledState();
    };

    // Music mute button
    this.elements.musicMuteBtn.onclick = (e) => {
      e.stopPropagation();
      soundManager.toggleMusicMute();
      this.updateMuteButtons();
      this.updateSliderDisabledState();
    };
  }

  updateVolumeDisplay() {
    const sfxSliderVal = Math.round(SoundManager.volumeToSlider(soundManager.getSfxVolume()) * 100);
    const musicSliderVal = Math.round(SoundManager.volumeToSlider(soundManager.getMusicVolume()) * 100);

    this.elements.sfxSlider.value = sfxSliderVal;
    this.elements.sfxValue.textContent = sfxSliderVal + '%';
    this.elements.musicSlider.value = musicSliderVal;
    this.elements.musicValue.textContent = musicSliderVal + '%';
  }

  updateMuteButtons() {
    this.elements.sfxMuteBtn.textContent = soundManager.isSfxMuted() ? '🔇' : '🔊';
    this.elements.musicMuteBtn.textContent = soundManager.isMusicMuted() ? '🔇' : '🔊';
  }

  updateSliderDisabledState() {
    const sfxMuted = soundManager.isSfxMuted();
    const musicMuted = soundManager.isMusicMuted();

    this.elements.sfxSlider.disabled = sfxMuted;
    this.elements.sfxSlider.classList.toggle('muted', sfxMuted);

    this.elements.musicSlider.disabled = musicMuted;
    this.elements.musicSlider.classList.toggle('muted', musicMuted);
  }

  setupToggleButton() {
    this.elements.toggleBtn.onclick = (e) => {
      e.stopPropagation();
      const isHidden = this.elements.dropdown.classList.contains('hidden');

      if (isHidden) {
        this.elements.dropdown.classList.remove('hidden');
        this.positionDropdown();
        this.updateDynamicLabels();
        this.updateMuteButtons();
        this.updateSliderDisabledState();
      } else {
        this.elements.dropdown.classList.add('hidden');
      }
    };
  }

  positionDropdown() {
    const btnRect = this.elements.toggleBtn.getBoundingClientRect();
    const dropdownWidth = this.elements.dropdown.offsetWidth || 160;
    let left = btnRect.right - dropdownWidth;
    if (left < 10) left = 10;

    this.elements.dropdown.style.top = (btnRect.bottom + 5) + 'px';
    this.elements.dropdown.style.left = left + 'px';
  }

  setupCopyButton() {
    this.elements.copyBtn.onclick = (e) => {
      e.stopPropagation();
      const code = this.elements.codeValue.textContent;
      navigator.clipboard.writeText(code);
      const originalText = this.elements.copyBtn.textContent;
      this.elements.copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        this.elements.copyBtn.textContent = originalText;
      }, 1500);
    };
  }

  setupDocumentClickHandler() {
    // Only add once (guard with flag on window)
    if (!window._gameMenuClickHandler) {
      window._gameMenuClickHandler = true;
      document.addEventListener('click', (e) => {
        const menu = document.getElementById('game-menu');
        const dropdown = document.getElementById('game-menu-dropdown');
        if (menu && dropdown && !menu.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }
  }

  updateDynamicLabels() {
    Object.entries(this.callbacks).forEach(([id, updateFn]) => {
      const btn = document.getElementById(`menu-${id}-btn`);
      if (btn && updateFn) {
        btn.textContent = updateFn();
      }
    });
  }

  updateButtonLabel(id, label) {
    const btn = document.getElementById(`menu-${id}-btn`);
    if (btn) {
      btn.textContent = label;
    }
  }

  // Notification badge methods
  setUnreadCount(count) {
    this.unreadCount = count;
    if (count > 0) {
      this.elements.badge.textContent = count > 99 ? '99+' : count;
      this.elements.badge.classList.remove('hidden');
      this.elements.toggleBtn.classList.add('has-unread');
    } else {
      this.elements.badge.classList.add('hidden');
      this.elements.toggleBtn.classList.remove('has-unread');
    }
  }

  incrementUnread() {
    this.setUnreadCount(this.unreadCount + 1);
  }

  clearUnread() {
    this.setUnreadCount(0);
  }

  getUnreadCount() {
    return this.unreadCount;
  }

  // Update session code (useful when it becomes available after scene start)
  updateSessionCode(code) {
    if (code) {
      this.elements.codeValue.textContent = code;
      this.elements.sessionCode.classList.remove('hidden');
    } else {
      this.elements.sessionCode.classList.add('hidden');
    }
  }
}

// ES module export
export { GameMenuManager };
