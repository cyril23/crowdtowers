export class ErrorToast {
  constructor() {
    this.container = null;
    this.createContainer();
    this.injectStyles();
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'error-toast-container';
    document.body.appendChild(this.container);
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #error-toast-container {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        max-width: 400px;
        font-family: monospace;
        font-size: 12px;
        pointer-events: auto;
      }
      .error-toast {
        background: rgba(220, 38, 38, 0.95);
        color: white;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        animation: errorSlideIn 0.3s ease;
      }
      .error-toast.fade-out {
        animation: errorFadeOut 0.3s ease forwards;
      }
      .error-toast-header {
        font-weight: bold;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .error-toast-close {
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        opacity: 0.7;
        padding: 0;
      }
      .error-toast-close:hover {
        opacity: 1;
      }
      .error-toast-message {
        margin-bottom: 6px;
        word-break: break-word;
      }
      .error-toast-toggle {
        font-size: 10px;
        opacity: 0.7;
      }
      .error-toast-stack {
        font-size: 10px;
        max-height: 150px;
        overflow: auto;
        opacity: 0.8;
        white-space: pre-wrap;
        display: none;
        margin-top: 8px;
        padding: 8px;
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
      }
      .error-toast-stack.visible {
        display: block;
      }
      @keyframes errorSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes errorFadeOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  show(message, stack) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';

    const header = document.createElement('div');
    header.className = 'error-toast-header';

    const title = document.createElement('span');
    title.textContent = 'JS Error (dev)';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'error-toast-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.dismiss(toast);
    };

    header.appendChild(title);
    header.appendChild(closeBtn);

    const msg = document.createElement('div');
    msg.className = 'error-toast-message';
    msg.textContent = message || 'Unknown error';

    const toggle = document.createElement('div');
    toggle.className = 'error-toast-toggle';
    toggle.textContent = 'Click to toggle stack trace';

    const stackDiv = document.createElement('div');
    stackDiv.className = 'error-toast-stack';
    stackDiv.textContent = stack || 'No stack trace';

    toast.appendChild(header);
    toast.appendChild(msg);
    toast.appendChild(toggle);
    toast.appendChild(stackDiv);

    toast.addEventListener('click', () => {
      stackDiv.classList.toggle('visible');
    });

    // Auto-dismiss after 15 seconds
    const autoDismissTimeout = setTimeout(() => {
      this.dismiss(toast);
    }, 15000);

    toast._autoDismissTimeout = autoDismissTimeout;

    this.container.appendChild(toast);

    // Limit to 5 visible toasts
    while (this.container.children.length > 5) {
      const oldest = this.container.firstChild;
      if (oldest._autoDismissTimeout) {
        clearTimeout(oldest._autoDismissTimeout);
      }
      oldest.remove();
    }
  }

  dismiss(toast) {
    if (toast._autoDismissTimeout) {
      clearTimeout(toast._autoDismissTimeout);
    }
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }
}
