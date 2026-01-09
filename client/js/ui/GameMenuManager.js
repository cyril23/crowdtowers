import { soundManager, SoundManager } from '../managers/SoundManager.js';
import { settingsManager, formatWithHotkey } from '../managers/SettingsManager.js';
import { HOTKEYS } from '../../../shared/constants.js';

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
      toggleText: document.getElementById('menu-toggle-text'),
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
      musicMuteBtn: document.getElementById('music-mute-btn'),
      hotkeyToggle: document.getElementById('hotkey-toggle'),
      chatToggleSection: document.getElementById('chat-toggle-section'),
      chatToggle: document.getElementById('chat-toggle'),
      chatToggleLabel: document.getElementById('chat-toggle-label'),
      playerToggleSection: document.getElementById('player-toggle-section'),
      playerToggle: document.getElementById('player-toggle'),
      playerToggleLabel: document.getElementById('player-toggle-label'),
      speedSection: document.getElementById('speed-section'),
      speedSelect: document.getElementById('game-speed')
    };

    this.currentConfig = null;
    this.callbacks = {};
    this.buttonConfigs = []; // Store button configs for hotkey hint updates
    this.unreadCount = 0;
    this.chatToggleCallback = null;
    this.playerToggleCallback = null;
    this.speedChangeCallback = null;

    this.setupVolumeControls();
    this.setupToggleButton();
    this.setupCopyButton();
    this.setupHotkeyToggle();
    this.setupChatToggle();
    this.setupPlayerToggle();
    this.setupSpeedControl();
    this.setupDocumentClickHandler();

    gameMenuInstance = this;
  }

  /**
   * Configure the menu for a specific scene
   * @param {Object} options Configuration options
   * @param {boolean} options.showSessionCode Whether to show session code section
   * @param {string} options.sessionCode The session code to display
   * @param {Array} options.buttons Array of button configs: { id, label, onClick, danger, updateLabel, hotkey }
   * @param {string} options.position 'top-right' for fixed position, 'in-hud' for HUD integration
   * @param {Object} options.chatToggle Chat toggle config: { visible, onChange }
   */
  configure(options) {
    this.currentConfig = options;
    this.callbacks = {};
    this.buttonConfigs = options.buttons || [];

    // Show/hide session code
    if (options.showSessionCode && options.sessionCode) {
      this.elements.sessionCode.classList.remove('hidden');
      this.elements.codeValue.textContent = options.sessionCode;
    } else {
      this.elements.sessionCode.classList.add('hidden');
    }

    // Configure chat toggle
    if (options.chatToggle) {
      this.configureChatToggle(options.chatToggle);
    } else {
      // Hide chat toggle for scenes without chat
      this.elements.chatToggleSection.classList.add('hidden');
      this.chatToggleCallback = null;
    }

    // Configure player toggle
    if (options.playerToggle) {
      this.configurePlayerToggle(options.playerToggle);
    } else {
      // Hide player toggle for scenes without player panel
      this.elements.playerToggleSection.classList.add('hidden');
      this.playerToggleCallback = null;
    }

    // Configure speed control
    if (options.speedControl) {
      this.configureSpeedControl(options.speedControl);
    } else {
      // Hide speed control for scenes without it
      this.elements.speedSection.classList.add('hidden');
      this.speedChangeCallback = null;
    }

    // Build dynamic buttons
    this.elements.dynamicButtons.innerHTML = '';
    if (this.buttonConfigs.length > 0) {
      this.buttonConfigs.forEach(btnConfig => {
        const btn = document.createElement('button');
        btn.id = `menu-${btnConfig.id}-btn`;
        let className = 'menu-btn';
        if (btnConfig.danger) className += ' menu-btn-danger';
        else if (btnConfig.neutral) className += ' menu-btn-neutral';
        btn.className = className;
        btn.textContent = this.getButtonLabel(btnConfig);
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
    this.updateHotkeyToggle();
  }

  /**
   * Configure the chat toggle checkbox
   * @param {Object} config Chat toggle config
   * @param {boolean} config.visible Initial visibility of chat
   * @param {function} config.onChange Callback when toggle changes (receives new visibility state)
   */
  configureChatToggle(config) {
    this.elements.chatToggleSection.classList.remove('hidden');
    this.elements.chatToggle.checked = config.visible;
    this.chatToggleCallback = config.onChange;
    this.updateChatToggleLabel();
  }

  updateChatToggleLabel() {
    // Label stays constant - checkbox state indicates visibility
    const hotkeyHint = settingsManager.showHotkeys ? ' [C]' : '';
    this.elements.chatToggleLabel.textContent = 'Show Chat' + hotkeyHint;
  }

  setChatToggleState(isVisible) {
    this.elements.chatToggle.checked = isVisible;
  }

  /**
   * Configure the player toggle checkbox
   * @param {Object} config Player toggle config
   * @param {boolean} config.visible Initial visibility of player panel
   * @param {function} config.onChange Callback when toggle changes (receives new visibility state)
   */
  configurePlayerToggle(config) {
    this.elements.playerToggleSection.classList.remove('hidden');
    this.elements.playerToggle.checked = config.visible;
    this.playerToggleCallback = config.onChange;
    this.updatePlayerToggleLabel();
  }

  updatePlayerToggleLabel() {
    const hotkeyHint = settingsManager.showHotkeys ? ' [L]' : '';
    this.elements.playerToggleLabel.textContent = 'Show Players' + hotkeyHint;
  }

  setPlayerToggleState(isVisible) {
    this.elements.playerToggle.checked = isVisible;
  }

  /**
   * Get button label with optional hotkey hint
   */
  getButtonLabel(btnConfig) {
    const label = btnConfig.updateLabel ? btnConfig.updateLabel() : btnConfig.label;
    return formatWithHotkey(label, btnConfig.hotkey);
  }

  /**
   * Rebuild all button labels (called when hotkey visibility changes)
   */
  rebuildButtonLabels() {
    this.buttonConfigs.forEach(btnConfig => {
      const btn = document.getElementById(`menu-${btnConfig.id}-btn`);
      if (btn) {
        btn.textContent = this.getButtonLabel(btnConfig);
      }
    });
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
    this.updateToggleButtonLabel();
    this.updateVolumeDisplay();
    this.updateMuteButtons();
    this.updateSliderDisabledState();
  }

  hide() {
    this.elements.menu.classList.add('hidden');
    this.closeDropdown();
  }

  toggle() {
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

  setupHotkeyToggle() {
    // Initialize checkbox state
    this.updateHotkeyToggle();

    // Handle checkbox change
    this.elements.hotkeyToggle.onchange = (e) => {
      e.stopPropagation();
      settingsManager.toggleShowHotkeys();
      // rebuildButtonLabels will be called via event listener
    };

    // Listen for external changes (e.g., H key press)
    window.addEventListener('hotkey-visibility-changed', () => {
      this.updateHotkeyToggle();
      this.updateToggleButtonLabel();
      this.rebuildButtonLabels();
      // Also update chat toggle label if visible
      if (!this.elements.chatToggleSection.classList.contains('hidden')) {
        this.updateChatToggleLabel();
      }
      // Also update player toggle label if visible
      if (!this.elements.playerToggleSection.classList.contains('hidden')) {
        this.updatePlayerToggleLabel();
      }
    });
  }

  updateHotkeyToggle() {
    this.elements.hotkeyToggle.checked = settingsManager.showHotkeys;
  }

  updateToggleButtonLabel() {
    this.elements.toggleText.textContent = formatWithHotkey('Menu', HOTKEYS.MENU);
  }

  setupChatToggle() {
    this.elements.chatToggle.onchange = (e) => {
      e.stopPropagation();
      const isVisible = e.target.checked;
      if (this.chatToggleCallback) {
        this.chatToggleCallback(isVisible);
      }
      // Clear unread when showing chat
      if (isVisible) {
        this.clearUnread();
      }
    };
  }

  setupPlayerToggle() {
    this.elements.playerToggle.onchange = (e) => {
      e.stopPropagation();
      const isVisible = e.target.checked;
      if (this.playerToggleCallback) {
        this.playerToggleCallback(isVisible);
      }
    };
  }

  setupSpeedControl() {
    this.elements.speedSelect.onchange = (e) => {
      e.stopPropagation();
      const speed = parseFloat(e.target.value);
      if (this.speedChangeCallback) {
        this.speedChangeCallback(speed);
      }
    };
  }

  /**
   * Configure the speed control
   * @param {Object} config Speed control config
   * @param {number} config.currentSpeed Current game speed (default 1)
   * @param {function} config.onChange Callback when speed changes (receives new speed)
   */
  configureSpeedControl(config) {
    this.elements.speedSection.classList.remove('hidden');
    this.elements.speedSelect.value = config.currentSpeed || 1;
    this.speedChangeCallback = config.onChange;
  }

  /**
   * Update the speed selector to reflect server state
   * @param {number} speed The current game speed
   */
  setSpeedValue(speed) {
    this.elements.speedSelect.value = speed;
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
    // Update buttons with dynamic labels (includes hotkey hints)
    this.buttonConfigs.forEach(btnConfig => {
      if (btnConfig.updateLabel) {
        const btn = document.getElementById(`menu-${btnConfig.id}-btn`);
        if (btn) {
          btn.textContent = this.getButtonLabel(btnConfig);
        }
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
