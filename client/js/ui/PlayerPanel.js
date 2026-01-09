import { HOTKEYS } from '../../../shared/constants.js';
import { networkManager } from '../managers/NetworkManager.js';
import { settingsManager, getHotkeyDisplay } from '../managers/SettingsManager.js';

// Singleton instance
let playerPanelInstance = null;

class PlayerPanel {
  constructor() {
    // Return existing instance if already created (singleton pattern)
    if (playerPanelInstance) {
      return playerPanelInstance;
    }

    this.elements = {
      panel: document.getElementById('player-panel'),
      header: document.getElementById('player-panel-header'),
      title: document.getElementById('player-panel-title'),
      badge: document.getElementById('player-count-badge'),
      toggle: document.getElementById('player-panel-toggle'),
      list: document.getElementById('player-list'),
      contextMenu: document.getElementById('player-context-menu'),
      kickBtn: document.getElementById('player-kick-btn')
    };

    this.isVisible = true;  // Visible by default
    this.isMinimized = false;
    this.players = [];
    this.localNickname = null;
    this.contextMenuTarget = null;  // Nickname of player for context menu

    this.setupEventListeners();
    this.updateTitle();

    // Listen for hotkey visibility changes
    window.addEventListener('hotkey-visibility-changed', () => {
      this.updateTitle();
    });

    playerPanelInstance = this;
  }

  updateTitle() {
    const hotkeyHint = settingsManager.showHotkeys ? ` [${getHotkeyDisplay(HOTKEYS.PLAYERS)}]` : '';
    this.elements.title.textContent = 'Players' + hotkeyHint;
  }

  setupEventListeners() {
    // Toggle minimize/expand
    this.elements.toggle.addEventListener('click', () => {
      this.toggleMinimize();
    });

    // Badge click to expand when minimized
    this.elements.badge.addEventListener('click', () => {
      if (this.isMinimized) {
        this.expand();
      }
    });

    // Context menu kick button
    this.elements.kickBtn.addEventListener('click', () => {
      if (this.contextMenuTarget && this.contextMenuTarget !== this.localNickname) {
        networkManager.initiateKick(this.contextMenuTarget);
      }
      this.hideContextMenu();
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', (e) => {
      if (!this.elements.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
  }

  show() {
    this.elements.panel.classList.remove('hidden');
    this.isVisible = true;
  }

  hide() {
    this.elements.panel.classList.add('hidden');
    this.isVisible = false;
    this.hideContextMenu();
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  minimize() {
    this.elements.panel.classList.add('minimized');
    this.elements.toggle.textContent = '+';
    this.isMinimized = true;
    this.hideContextMenu();
  }

  expand() {
    this.elements.panel.classList.remove('minimized');
    this.elements.toggle.textContent = '-';
    this.isMinimized = false;
  }

  toggleMinimize() {
    if (this.isMinimized) {
      this.expand();
    } else {
      this.minimize();
    }
  }

  setLocalNickname(nickname) {
    this.localNickname = nickname;
    this.renderPlayerList();
  }

  setPlayers(players) {
    this.players = players || [];
    this.renderPlayerList();
  }

  addPlayer(data) {
    // Avoid duplicates
    if (!this.players.find(p => p.nickname === data.nickname)) {
      this.players.push({
        nickname: data.nickname,
        isHost: data.isHost || false
      });
      this.renderPlayerList();
    }
  }

  removePlayer(nickname) {
    this.players = this.players.filter(p => p.nickname !== nickname);
    this.renderPlayerList();
    // Hide context menu if it was targeting this player
    if (this.contextMenuTarget === nickname) {
      this.hideContextMenu();
    }
  }

  renderPlayerList() {
    this.elements.list.innerHTML = '';

    this.players.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      if (player.nickname === this.localNickname) {
        item.classList.add('is-self');
      }

      // Status indicator (online dot)
      const status = document.createElement('div');
      status.className = 'player-status';
      item.appendChild(status);

      // Player name
      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = player.nickname;
      item.appendChild(name);

      // Host badge
      if (player.isHost) {
        const badge = document.createElement('span');
        badge.className = 'player-host-badge';
        badge.textContent = 'HOST';
        item.appendChild(badge);
      }

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(player.nickname, e.clientX, e.clientY);
      });

      this.elements.list.appendChild(item);
    });

    // Update badge count
    this.elements.badge.textContent = this.players.length;
  }

  showContextMenu(nickname, x, y) {
    this.contextMenuTarget = nickname;

    // Disable kick button for self
    const isSelf = nickname === this.localNickname;
    this.elements.kickBtn.disabled = isSelf;
    this.elements.kickBtn.textContent = isSelf ? '(Cannot kick yourself)' : 'Initiate Kick Vote';

    // Position menu
    const menu = this.elements.contextMenu;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Ensure menu stays on screen
    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }

  hideContextMenu() {
    this.elements.contextMenu.classList.add('hidden');
    this.contextMenuTarget = null;
  }

  /**
   * Check if we should auto-minimize based on screen size
   * Called after resize events
   * @returns {boolean} True if in compact mode
   */
  checkResponsiveMode() {
    return window.innerWidth <= 900 || window.innerHeight <= 700;
    // Could auto-minimize on compact screens if desired
    // For now, let user control it
  }
}

// ES module export
export { PlayerPanel };
