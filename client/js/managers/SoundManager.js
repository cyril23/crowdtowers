// Sound categories with priority levels (lower number = higher priority)
const SOUND_CATEGORIES = {
  CRITICAL: {
    priority: 0,
    maxConcurrent: 2,
    sounds: ['enemy_exit']
  },
  WAVE: {
    priority: 1,
    maxConcurrent: 1,
    sounds: ['wave_start', 'wave_complete']
  },
  GAME_STATE: {
    priority: 1,
    maxConcurrent: 1,
    sounds: ['pause', 'unpause']
  },
  TOWER_ACTION: {
    priority: 1,
    maxConcurrent: 3,
    sounds: ['tower_place', 'tower_sell', 'tower_upgrade', 'error_funds', 'error_placement']
  },
  MULTIPLAYER: {
    priority: 2,
    maxConcurrent: 2,
    sounds: ['player_join', 'player_leave']
  },
  CHAT: {
    priority: 3,
    maxConcurrent: 1,
    sounds: ['chat_message']
  },
  ENEMY_DEATH: {
    priority: 4,
    maxConcurrent: 5,
    sounds: ['death_generic', 'death_swarmling', 'death_drone', 'death_phasewalker', 'death_behemoth', 'death_broodmother']
  },
  TOWER_FIRE: {
    priority: 5,
    maxConcurrent: 8,
    sounds: ['machinegun_fire', 'missile_fire', 'tesla_fire', 'cryo_fire', 'plasma_fire']
  },
  UI: {
    priority: 6,
    maxConcurrent: 2,
    sounds: ['button_click', 'tower_select']
  }
};

// All SFX files to load
const SFX_FILES = [
  // Tower firing
  'machinegun_fire',
  'missile_fire',
  'tesla_fire',
  'cryo_fire',
  'plasma_fire',
  // Tower actions
  'tower_place',
  'tower_sell',
  'tower_upgrade',
  'error_funds',
  'error_placement',
  // Enemy deaths
  'death_generic',
  'death_swarmling',
  'death_drone',
  'death_phasewalker',
  'death_behemoth',
  'death_broodmother',
  // Critical events
  'enemy_exit',
  // Waves
  'wave_start',
  'wave_complete',
  // Game state
  'pause',
  'unpause',
  // Multiplayer
  'player_join',
  'player_leave',
  'chat_message',
  // UI
  'button_click',
  'tower_select'
];

// Music tracks organized by category
const MUSIC_TRACKS = {
  menu: ['menu_theme1', 'menu_theme2', 'menu_theme3', 'menu_theme4'],
  gameplay: ['gameplay_01', 'gameplay_02', 'gameplay_03', 'gameplay_04', 'gameplay_05', 'gameplay_06'],
  boss: ['boss_theme1', 'boss_theme2', 'boss_theme3'],
  gameOver: ['game_over_good', 'game_over_bad']
};

// Flatten for loading
const MUSIC_FILES = [
  ...MUSIC_TRACKS.menu,
  ...MUSIC_TRACKS.gameplay,
  ...MUSIC_TRACKS.boss,
  ...MUSIC_TRACKS.gameOver
];

// Global limits
const GLOBAL_MAX_CONCURRENT = 15;

class SoundManager {
  constructor() {
    this.scene = null;
    this.sounds = new Map();
    this.activeSounds = [];
    this.musicTracks = new Map();
    this.currentMusic = null;
    this.currentMusicKey = null;

    // Settings (defaults: SFX 20%, Music 25%)
    this.muted = false;
    this.sfxVolume = 0.2;
    this.musicVolume = 0.25;
    this.otherPlayerVolume = 0.3;

    // Audio context state
    this.audioUnlocked = false;
    this.initialized = false;

    // Music playlist state
    this.menuTrackIndex = 0;
    this.gameplayTrackIndex = -1; // -1 means start random
    this.currentPlaylistType = null; // 'menu', 'gameplay', 'boss', 'gameOver'

    // Load settings from localStorage
    this.loadSettings();
  }

  // Initialize with Phaser scene
  init(scene) {
    this.scene = scene;
    this.setupAudioUnlock();
  }

  // Preload all sounds (call in scene.preload)
  preloadSounds(scene) {
    // Load all SFX
    SFX_FILES.forEach(key => {
      scene.load.audio(key, `assets/audio/sfx/${key}.wav`);
    });

    // Load music tracks (mp3 only)
    MUSIC_FILES.forEach(key => {
      scene.load.audio(key, `assets/audio/music/${key}.mp3`);
    });
  }

  // Create sound instances after preload completes
  createSounds(scene) {
    this.scene = scene;
    this.initialized = true;

    // Create SFX instances
    SFX_FILES.forEach(key => {
      if (scene.cache.audio.exists(key)) {
        this.sounds.set(key, scene.sound.add(key));
      }
    });

    // Create music instances (NOT looping by default - we handle sequencing)
    MUSIC_FILES.forEach(key => {
      if (scene.cache.audio.exists(key)) {
        this.musicTracks.set(key, scene.sound.add(key, {
          loop: false,
          volume: this.musicVolume
        }));
      }
    });

    // Apply mute state
    if (this.muted) {
      scene.sound.setMute(true);
    }
  }

  // Play a sound with priority management
  play(soundKey, options = {}) {
    if (!this.initialized) return null;
    if (this.muted) return null;
    if (!this.audioUnlocked) return null;

    const {
      isOtherPlayer = false,
      volume = 1.0,
      pitch = 1.0
    } = options;

    // Find category for this sound
    const category = this.getCategoryForSound(soundKey);
    if (!category) {
      console.warn(`Unknown sound: ${soundKey}`);
      return null;
    }

    // Check if sound exists
    if (!this.sounds.has(soundKey)) {
      return null;
    }

    // Clean up finished sounds first
    this.cleanupFinishedSounds();

    // Check category limits
    const categoryActive = this.getActiveSoundsInCategory(category);
    if (categoryActive.length >= SOUND_CATEGORIES[category].maxConcurrent) {
      return null;
    }

    // Check global limit
    if (this.activeSounds.length >= GLOBAL_MAX_CONCURRENT) {
      // Try to evict a lower priority sound
      if (!this.evictLowestPriority(SOUND_CATEGORIES[category].priority)) {
        return null;
      }
    }

    // Calculate final volume
    let finalVolume = this.sfxVolume * volume;
    if (isOtherPlayer) {
      finalVolume *= this.otherPlayerVolume;
    }

    // Create and play a new instance
    const instance = this.scene.sound.add(soundKey, {
      volume: finalVolume,
      rate: pitch
    });

    instance.play();

    // Track active sound
    const trackingData = {
      instance,
      category,
      priority: SOUND_CATEGORIES[category].priority,
      startTime: Date.now()
    };
    this.activeSounds.push(trackingData);

    // Auto-cleanup when done
    instance.once('complete', () => {
      this.removeSoundFromActive(instance);
    });

    return instance;
  }

  // Get category name for a sound key
  getCategoryForSound(soundKey) {
    for (const [catName, catDef] of Object.entries(SOUND_CATEGORIES)) {
      if (catDef.sounds.includes(soundKey)) {
        return catName;
      }
    }
    return null;
  }

  // Get active sounds in a category
  getActiveSoundsInCategory(category) {
    return this.activeSounds.filter(s => s.category === category && s.instance.isPlaying);
  }

  // Remove finished sounds from tracking
  cleanupFinishedSounds() {
    this.activeSounds = this.activeSounds.filter(s =>
      s.instance && s.instance.isPlaying
    );
  }

  // Evict lowest priority sound to make room
  evictLowestPriority(newSoundPriority) {
    // Sort by priority (highest number = lowest priority)
    const sorted = [...this.activeSounds]
      .filter(s => s.instance.isPlaying)
      .sort((a, b) => b.priority - a.priority);

    // Find a sound with lower priority than the new sound
    const toEvict = sorted.find(s => s.priority > newSoundPriority);

    if (toEvict) {
      toEvict.instance.stop();
      this.removeSoundFromActive(toEvict.instance);
      return true;
    }

    return false;
  }

  // Remove sound from active tracking
  removeSoundFromActive(instance) {
    this.activeSounds = this.activeSounds.filter(s => s.instance !== instance);
  }

  // Mobile audio unlock
  setupAudioUnlock() {
    if (this.audioUnlocked) return;

    const unlock = () => {
      if (this.audioUnlocked) return;

      // Resume audio context
      if (this.scene && this.scene.sound && this.scene.sound.context) {
        this.scene.sound.context.resume().then(() => {
          this.audioUnlocked = true;
        });
      } else {
        this.audioUnlocked = true;
      }

      // Remove listeners after unlock
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  // ============================================
  // MUSIC PLAYBACK METHODS
  // ============================================

  // Play a specific music track (internal)
  playMusicTrack(trackKey, loop = false) {
    if (!this.initialized) return;

    // Stop current music first
    this.stopMusic();

    // Start new track
    const track = this.musicTracks.get(trackKey);
    if (track) {
      track.setLoop(loop);
      track.setVolume(this.musicVolume);
      track.play();
      this.currentMusic = track;
      this.currentMusicKey = trackKey;
    }
  }

  // Start menu music (sequential: 1 -> 2 -> 3 -> 4 -> 1...)
  startMenuMusic() {
    if (!this.initialized) return;

    // Don't restart if menu music is already playing (e.g., on scene resize)
    if (this.currentPlaylistType === 'menu' && this.currentMusic?.isPlaying) {
      return;
    }

    this.currentPlaylistType = 'menu';
    const tracks = MUSIC_TRACKS.menu;
    const trackKey = tracks[this.menuTrackIndex];

    this.playMusicTrack(trackKey, false);

    // Setup listener for next track
    if (this.currentMusic) {
      this.currentMusic.once('complete', () => {
        if (this.currentPlaylistType === 'menu') {
          this.menuTrackIndex = (this.menuTrackIndex + 1) % tracks.length;
          this.startMenuMusic();
        }
      });
    }
  }

  // Start gameplay music (random start, then sequential)
  startGameplayMusic() {
    if (!this.initialized) return;

    // Don't restart if gameplay music is already playing (e.g., on scene resize)
    if (this.currentPlaylistType === 'gameplay' && this.currentMusic?.isPlaying) {
      return;
    }

    this.currentPlaylistType = 'gameplay';
    const tracks = MUSIC_TRACKS.gameplay;

    // First call: start with random track
    if (this.gameplayTrackIndex === -1) {
      this.gameplayTrackIndex = Math.floor(Math.random() * tracks.length);
    }

    const trackKey = tracks[this.gameplayTrackIndex];
    this.playMusicTrack(trackKey, false);

    // Setup listener for next track
    if (this.currentMusic) {
      this.currentMusic.once('complete', () => {
        if (this.currentPlaylistType === 'gameplay') {
          this.gameplayTrackIndex = (this.gameplayTrackIndex + 1) % tracks.length;
          this.startGameplayMusic();
        }
      });
    }
  }

  // Play boss music based on wave number
  // Wave 50 -> boss_theme1, Wave 100 -> boss_theme2, Wave 150 -> boss_theme3, then repeat
  playBossMusic(waveNumber) {
    if (!this.initialized) return;

    this.currentPlaylistType = 'boss';
    const tracks = MUSIC_TRACKS.boss;

    // Calculate which boss track (50 = 0, 100 = 1, 150 = 2, 200 = 0, etc.)
    const bossIndex = Math.floor((waveNumber - 50) / 50) % tracks.length;
    const trackKey = tracks[bossIndex];

    this.playMusicTrack(trackKey, true); // Boss music loops
  }

  // Play game over music based on final wave
  // Wave >= 50: game_over_good (loops)
  // Wave < 50: game_over_bad (loops)
  playGameOverMusic(finalWave) {
    if (!this.initialized) return;

    this.currentPlaylistType = 'gameOver';

    if (finalWave >= 50) {
      this.playMusicTrack('game_over_good', true);
    } else {
      this.playMusicTrack('game_over_bad', true);
    }
  }

  // Resume gameplay music after boss wave
  resumeGameplayMusic() {
    // Continue from where we left off
    this.startGameplayMusic();
  }

  // Stop background music
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.off('complete'); // Remove any pending listeners
      this.currentMusic.stop();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  // Pause background music (for game pause)
  pauseMusic() {
    if (this.currentMusic && this.currentMusic.isPlaying) {
      this.currentMusic.pause();
    }
  }

  // Resume background music (after game unpause)
  resumeMusic() {
    if (this.currentMusic && this.currentMusic.isPaused) {
      this.currentMusic.resume();
    }
  }

  // Reset gameplay track index (call when starting a new game)
  resetGameplayIndex() {
    this.gameplayTrackIndex = -1; // Will pick random on next startGameplayMusic()
  }

  // Legacy method for backward compatibility
  playMusic(trackKey) {
    this.playMusicTrack(trackKey, true);
  }

  // ============================================
  // SETTINGS & UTILITY
  // ============================================

  // Toggle mute
  toggleMute() {
    this.muted = !this.muted;

    if (this.scene && this.scene.sound) {
      this.scene.sound.setMute(this.muted);
    }

    this.saveSettings();
    return this.muted;
  }

  // Check if muted
  isMuted() {
    return this.muted;
  }

  // Load settings from localStorage
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('crowdtowers_sound') || '{}');
      this.muted = settings.muted || false;
      this.menuTrackIndex = settings.menuTrackIndex || 0;
      // Load volume settings (use defaults if not set)
      // Default volumes correspond to slider positions 15% and 30% with power curve 2.5
      this.sfxVolume = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.0087;
      this.musicVolume = settings.musicVolume !== undefined ? settings.musicVolume : 0.0493;
    } catch {
      // Ignore localStorage errors
    }
  }

  // Save settings to localStorage
  saveSettings() {
    try {
      localStorage.setItem('crowdtowers_sound', JSON.stringify({
        muted: this.muted,
        menuTrackIndex: this.menuTrackIndex,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume
      }));
    } catch {
      // Ignore localStorage errors
    }
  }

  // Set SFX volume (0.0 to 1.0)
  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  // Get SFX volume
  getSfxVolume() {
    return this.sfxVolume;
  }

  // Set music volume (0.0 to 1.0)
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));

    // Update currently playing music
    if (this.currentMusic) {
      this.currentMusic.setVolume(this.musicVolume);
    }

    this.saveSettings();
  }

  // Get music volume
  getMusicVolume() {
    return this.musicVolume;
  }

  // Volume scaling exponent for perceptually linear volume control
  // 2.5 gives more control in the lower range than standard quadratic (2.0)
  static VOLUME_EXPONENT = 2.5;

  // Convert linear slider value (0-1) to perceptual volume (0-1)
  // Uses power curve to give more control in lower volume ranges
  static sliderToVolume(sliderValue) {
    return Math.pow(sliderValue, SoundManager.VOLUME_EXPONENT);
  }

  // Convert volume (0-1) back to slider value (0-1)
  // Used to initialize sliders from saved volume settings
  static volumeToSlider(volume) {
    return Math.pow(volume, 1 / SoundManager.VOLUME_EXPONENT);
  }

  // Scene cleanup (call in scene.shutdown)
  cleanup() {
    // Stop all active sounds
    this.activeSounds.forEach(s => {
      if (s.instance && s.instance.isPlaying) {
        s.instance.stop();
      }
    });
    this.activeSounds = [];
  }

  // Update scene reference (for scene transitions)
  setScene(scene) {
    this.scene = scene;
  }
}

// Singleton instance
const soundManager = new SoundManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.soundManager = soundManager;
}

export { soundManager, SoundManager, SOUND_CATEGORIES, SFX_FILES, MUSIC_FILES, MUSIC_TRACKS };
