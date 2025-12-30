class ChatPanel {
  constructor() {
    this.elements = {
      panel: document.getElementById('chat-panel'),
      messages: document.getElementById('chat-messages'),
      input: document.getElementById('chat-input'),
      sendBtn: document.getElementById('chat-send'),
      closeBtn: document.getElementById('chat-close')
    };

    this.isVisible = false;
    this.setupEventListeners();
    this.setupNetworkListeners();
  }

  setupEventListeners() {
    // Send message on button click
    this.elements.sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Send message on Enter key
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Close chat panel
    this.elements.closeBtn.addEventListener('click', () => {
      this.hide();
    });
  }

  setupNetworkListeners() {
    networkManager.on(SOCKET_EVENTS.CHAT_BROADCAST, (data) => {
      this.addMessage(data.nickname, data.message, data.timestamp);
    });

    networkManager.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      this.addSystemMessage(`${data.nickname} joined the game`);
    });

    networkManager.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
      this.addSystemMessage(`${data.nickname} left the game`);
    });

    networkManager.on(SOCKET_EVENTS.PLAYER_KICKED, (data) => {
      this.addSystemMessage(`${data.nickname} was kicked from the game`);
    });
  }

  show() {
    this.elements.panel.classList.remove('hidden');
    this.isVisible = true;
  }

  hide() {
    this.elements.panel.classList.add('hidden');
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  sendMessage() {
    const message = this.elements.input.value.trim();

    if (message) {
      networkManager.sendChatMessage(message);
      this.elements.input.value = '';
    }
  }

  addMessage(nickname, message, timestamp) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';

    const time = new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const isOwnMessage = nickname === networkManager.nickname;

    messageEl.innerHTML = `
      <span class="chat-time">${time}</span>
      <span class="chat-nickname ${isOwnMessage ? 'own' : ''}">${nickname}:</span>
      <span class="chat-text">${this.escapeHtml(message)}</span>
    `;

    this.elements.messages.appendChild(messageEl);
    this.scrollToBottom();
  }

  addSystemMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message system';
    messageEl.innerHTML = `<span class="chat-text">${this.escapeHtml(message)}</span>`;

    this.elements.messages.appendChild(messageEl);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clear() {
    this.elements.messages.innerHTML = '';
  }
}
