/* global CustomEvent */
/**
 * SettingsManager - Manages user preferences stored in localStorage
 * Handles hotkey visibility toggle and other user settings
 */

// Map Phaser key names to display characters
const KEY_DISPLAY_MAP = {
  'ONE': '1',
  'TWO': '2',
  'THREE': '3',
  'FOUR': '4',
  'FIVE': '5',
  'ESC': 'Esc'
};

class SettingsManager {
  constructor() {
    this.loadSettings();
  }

  loadSettings() {
    const settings = JSON.parse(localStorage.getItem('crowdtowers_settings') || '{}');
    // Default: ON for desktop, OFF for mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.showHotkeys = settings.showHotkeys !== undefined ? settings.showHotkeys : !isMobile;
  }

  saveSettings() {
    localStorage.setItem('crowdtowers_settings', JSON.stringify({
      showHotkeys: this.showHotkeys
    }));
  }

  toggleShowHotkeys() {
    this.showHotkeys = !this.showHotkeys;
    this.saveSettings();
    window.dispatchEvent(new CustomEvent('hotkey-visibility-changed', {
      detail: { showHotkeys: this.showHotkeys }
    }));
    return this.showHotkeys;
  }

  getShowHotkeys() {
    return this.showHotkeys;
  }
}

/**
 * Check if an input element is currently focused
 * Used to disable hotkeys while user is typing
 */
export function isInputFocused() {
  return document.activeElement?.matches('input, textarea');
}

/**
 * Extract display key from a HOTKEYS constant
 * e.g., 'keydown-U' → 'U', 'keydown-ONE' → '1'
 * @param {string} hotkeyConstant - The hotkey constant (e.g., HOTKEYS.UPGRADE)
 * @returns {string} The display character
 */
export function getHotkeyDisplay(hotkeyConstant) {
  if (!hotkeyConstant) return '';
  const key = hotkeyConstant.replace('keydown-', '');
  return KEY_DISPLAY_MAP[key] || key;
}

/**
 * Format a label with optional hotkey suffix
 * @param {string} label - The base label text
 * @param {string} hotkeyConstant - The hotkey constant (e.g., HOTKEYS.UPGRADE)
 * @returns {string} Label with [X] suffix if hotkeys are visible
 */
export function formatWithHotkey(label, hotkeyConstant) {
  if (!hotkeyConstant || !settingsManager.showHotkeys) {
    return label;
  }
  const key = getHotkeyDisplay(hotkeyConstant);
  return `${label} [${key}]`;
}

export const settingsManager = new SettingsManager();
