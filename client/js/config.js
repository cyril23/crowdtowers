// Client-side game configuration

const CLIENT_CONFIG = {
  // Colors
  colors: {
    background: 0x1a1a2e,
    wall: 0x16213e,
    path: 0x0f3460,
    buildable: 0x533483,
    entry: 0x00ff00,
    exit: 0xff0000,
    gridLine: 0x333355,
    healthBarBg: 0x333333,
    healthBarFill: 0x00ff00,
    healthBarLow: 0xff0000
  },

  // UI
  ui: {
    buttonColor: 0x4a4a8a,
    buttonHover: 0x6a6aaa,
    buttonText: '#ffffff',
    panelBg: 'rgba(26, 26, 46, 0.95)',
    fontSize: {
      title: '32px',
      heading: '24px',
      normal: '16px',
      small: '14px'
    }
  },

  // Tower visual configs
  towerVisuals: {
    machineGun: {
      color: 0x808080,
      shape: 'square'
    },
    missileLauncher: {
      color: 0xcc0000,
      shape: 'diamond'
    },
    teslaCoil: {
      color: 0x00ccff,
      shape: 'circle'
    },
    cryoCannon: {
      color: 0x99ffff,
      shape: 'triangle'
    },
    plasmaTurret: {
      color: 0xff00ff,
      shape: 'hexagon'
    }
  },

  // Enemy visual configs
  enemyVisuals: {
    swarmling: {
      color: 0x00ff00,
      shape: 'circle'
    },
    drone: {
      color: 0xffff00,
      shape: 'diamond'
    },
    phasewalker: {
      color: 0x9900ff,
      shape: 'triangle'
    },
    behemoth: {
      color: 0xff6600,
      shape: 'square'
    },
    broodmother: {
      color: 0x990000,
      shape: 'hexagon'
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.CLIENT_CONFIG = CLIENT_CONFIG;
}
