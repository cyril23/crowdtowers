# Crowd Towers - Key Information

## Game Concept
Crowd Towers is a multiplayer cooperative tower defense game: humans defend against alien invaders. Up to 32 players share a single budget and place towers anonymously.

## Tech Stack
- **Server:** Node.js + Express 5 + Socket.IO + MongoDB
- **Client:** Phaser.js 3 (canvas-based)
- **Run:** `npm start` (requires local MongoDB on default port)
- **Build:** `npm run build` (bundles client for production)
- **Lint:** Run `npm run lint` after making changes to check for errors

## Audio
- **SFX:** 8-bit sounds created with [sfxr.me](https://sfxr.me/) (WAV files in `client/assets/audio/sfx/`)
- **Music:** Generated with [Suno](https://suno.com/) (MP3 files in `client/assets/audio/music/`, tracked with Git LFS)

## Client Bundling
- **Development:** ES modules loaded directly (`client/js/main.js`)
- **Production:** esbuild bundles to `client/dist/bundle.min.js` (~63KB minified)
- Server auto-selects based on `NODE_ENV`: development serves `client/index.html`, production serves `client/dist/index.html`
- Build runs automatically in GitHub Actions before deploy

## Core Mechanics

### Tower/Enemy Effectiveness (Rock-Paper-Scissors)
| Tower | Strong vs | Weak vs |
|-------|-----------|---------|
| Machine Gun | Swarmling | Behemoth |
| Missile Launcher | Behemoth | Phasewalker |
| Tesla Coil | Drone | Broodmother |
| Cryo Cannon | Phasewalker | Swarmling |
| Plasma Turret | Broodmother | Drone |

Strong = 1.5x damage, Weak = 0.5x damage

### Economy
- Starting budget: 250 (shared among all players)
- Tower sell value: **50% of total investment** (base + all upgrades)
- Upgrade cost formula: `baseCost × 1.5^(level-1)`
- Upgrade damage formula: `baseDamage × 1.35^(level-1)` (Cryo Cannon: 1.40^)
- Upgrades only improve damage (and Cryo slow) - range and fire rate are fixed
- **Reward scaling:** +5% per wave (scales from wave 1, softer than HP)

### Enemy Specials
- **Phasewalker:** 10% chance to dodge damage (slow effects still apply)
- **Behemoth:** 50% damage reduction (armor)
- **Broodmother:** Spawns 2 Swarmlings on death

### Tower Specials
- **Missile Launcher:** Splash damage (1 tile radius, 50% damage)
- **Tesla Coil:** Chain lightning (3 targets, 70% damage per chain)
- **Cryo Cannon:** Slows enemies 50% (+5%/level, max 95%) for 4s (+0.1s/level). Slow stacks from multiple towers (duration caps at 2×)

## Multiplayer
- Games can be **private** (code required) or **open** (browsable)
- Any player can pause (shows who paused)
- Kick voting requires majority vote
- Towers remain when a player leaves

## Maze Generation
- Uses recursive backtracking algorithm
- Entry/exit placed at middle of left/right edges
- Regenerates until valid path exists (no fallback paths)
- Three sizes: small (12×12), medium (20×20), large (28×28)

## Wave Progression (infinite, cycling)
- Waves 1-5: Swarmlings only (tutorial)
- Waves 6-10: Drones introduced
- Waves 11-15: Phasewalkers introduced
- Waves 16-20: Behemoths introduced
- Waves 21-25: Broodmothers introduced
- **Wave 25:** Final boss wave (30 enemies, all types)
- **Wave 26+:** Cycles back to wave 1 composition (scaling continues smoothly)

### Scaling Formula
- **HP:** +30% per wave (linear: `baseHP × (1 + 0.3 × (wave-1))`)
- **Rewards:** +5% per wave (linear: `baseReward × (1 + 0.05 × (wave-1))`)
- **Speed:** Constant (does not scale)
- **No victory condition** - game continues until defeat

## Server Tick Rate
20 ticks/second for game state synchronization

## Client-Side Rendering Architecture

### Enemy Rendering (Stateless)
Enemies are rendered using a **single shared Graphics object** that redraws ALL enemies every frame from server data:
```javascript
this.enemyGraphics.clear();
for (const enemy of this.enemyData) {
  this.enemyGraphics.fillCircle(enemy.x, enemy.y, size);
}
```
**Do NOT** use individual sprites with Maps/lifecycle management - this causes race conditions with death animations and movement tweens that make enemies "flicker" or get "sucked back" to spawn.

### Projectile Tracking (Live)
Projectiles track enemies by ID and chase their **current position** each frame:
```javascript
const target = this.enemyData.find(e => e.id === p.targetId);
p.x += (dx / dist) * speed;  // Move toward CURRENT target position
```
**Do NOT** pre-calculate trajectory at fire time - enemies move, so projectiles will miss.

## Scene Management Patterns

### Resize Handler Pattern (CRITICAL)
When using `scene.restart()` on resize, **always remove the listener BEFORE restarting**:
```javascript
onResize() {
  this.scale.off('resize', this.onResize, this);  // Remove FIRST
  this.scene.restart({ ... });  // Then restart
}
```
**Why:** If you restart first, `create()` registers a new handler while the old one still exists. Each rotation doubles the handlers, causing exponential slowdown (104ms → 360ms → 1400ms → 10000ms+).

### isActive() Safety Check
Stopped scenes can have lingering handlers that fire. Always check before restarting:
```javascript
onResize() {
  this.scale.off('resize', this.onResize, this);
  if (!this.scene.isActive()) return;  // Prevent stopped scene from restarting
  this.scene.restart({ ... });
}
```

### shutdown() for Global Listeners
Any scene that registers on `this.scale` (global scale manager) **must** have a `shutdown()` method:
```javascript
shutdown() {
  this.scale.off('resize', this.handleResize, this);
}
```

### Scene Navigation Pattern (Back Buttons)
For overlay scenes (JoinGameScene, CreateGameScene, BrowseScene), **always use `stop()` + `launch()` to navigate to a DIFFERENT scene**:
```javascript
// CORRECT - stops self, launches different scene
this.scene.stop('JoinGameScene');
this.scene.launch('MenuScene');

// WRONG - restart() on same scene breaks input after rotation
this.scene.restart();
```
**Why:** `scene.restart()` within the same scene causes input system issues after device rotation. The stop+launch pattern creates a fresh scene instance with clean input state.

### HTML DOM Input Cleanup
HTML inputs overlaid on Phaser canvas must be explicitly cleaned up before creating new ones:
```javascript
createHtmlInput(designX, designY, width, placeholder) {
  // Remove existing inputs first to prevent duplicates on restart
  const wrapper = document.getElementById('input-wrapper');
  if (wrapper) {
    wrapper.querySelectorAll('input.my-unique-class').forEach(el => el.remove());
  }
  // Then create new input with unique class
  input.className = 'game-input my-unique-class';
}
```
**Why:** During `scene.restart()`, timing issues can cause new inputs to be created before old ones are removed, resulting in duplicate visible inputs.

### Design Space Pattern for Responsive Menus
Menu scenes use a fixed "design space" (e.g., 400×500) with camera zoom/centering. This allows responsive scaling without recalculating positions:
```javascript
static DESIGN_WIDTH = 400;
static DESIGN_HEIGHT = 500;

setupMenuCamera() {
  const scaleX = this.cameras.main.width / DESIGN_WIDTH;
  const scaleY = this.cameras.main.height / DESIGN_HEIGHT;
  const zoom = Math.min(scaleX, scaleY, 1.5);
  this.cameras.main.setZoom(zoom);
  this.cameras.main.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
}
```
All UI positions use design coordinates; the camera handles the transform.

## Deployment

**Production:** https://crowdtowers.wochenentwicklung.com
**Staging:** https://staging.crowdtowers.wochenentwicklung.com

**Infrastructure:** Hetzner Cloud VPS (CPX32, Ubuntu 24)
- Nginx reverse proxy with Let's Encrypt SSL
- PM2 process management (crowdtowers-prod, crowdtowers-staging)
- MongoDB 8.0 with authentication (crowdtowers, crowdtowers-staging databases)

**GitHub Actions Workflow:**
- Push to `main` → auto-deploy to **staging**
- Manual trigger (workflow_dispatch) → deploy to **production**

**Local Dev Scripts:** `./deploy/scripts/deploy-staging.sh` deploys to staging without committing (useful for mobile testing). See deploy/README.md for details.

**Docs:** See [deploy/README.md](deploy/README.md) for setup and troubleshooting.

## Error Reporting

Client JS errors are captured and stored in MongoDB:
- `client/js/utils/errorReporter.js` catches errors and unhandled rejections
- `BootScene.js` catches Phaser file load errors (audio decode failures, etc.)
- Max 5 errors per client session (prevents spam)
- Errors include: stack trace, active Phaser scenes, session code, screen size
- Dev-only toast overlay on localhost/staging
- Admin page: `/admin/errors` (token-protected in production via `?token=ADMIN_SECRET`)

**Testing:** Trigger errors from browser console:
```javascript
// Generic JS error
setTimeout(() => { throw new Error('test error'); }, 0)

// Phaser file load error (e.g., missing audio)
testPhaserLoadError()
```
