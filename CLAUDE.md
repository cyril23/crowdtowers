# Crowd Towers - Key Information

## Game Concept
Crowd Towers is a multiplayer cooperative tower defense game: humans defend against alien invaders. Up to 32 players share a single budget and place towers anonymously.

## Tech Stack
- **Server:** Node.js + Express 5 + Socket.IO + MongoDB
- **Client:** Phaser.js 3 (canvas-based)
- **Run:** `npm start` (requires local MongoDB on default port)
- **Build:** `npm run build` (bundles client for production)
- **Lint:** Run `npm run lint` after making changes to check for errors

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
- Starting budget: 500 (shared among all players)
- Tower sell value: **50% of total investment** (base + all upgrades)
- Upgrade cost formula: `baseCost × 1.5^(level-1)`
- Upgrade damage formula: `baseDamage × 1.35^(level-1)` (geometric scaling)

### Enemy Specials
- **Phasewalker:** 30% chance to dodge any attack
- **Behemoth:** 25% damage reduction (armor)
- **Broodmother:** Spawns 2 Swarmlings on death

### Tower Specials
- **Missile Launcher:** Splash damage (1 tile radius, 50% damage)
- **Tesla Coil:** Chain lightning (3 targets, 70% damage per chain)
- **Cryo Cannon:** Slows enemies 50% for 2 seconds

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
- Waves 1-10: Swarmlings, then Drones introduced
- Waves 11-20: Phasewalkers introduced
- Waves 21-30: Behemoths introduced
- Waves 31-40: Broodmothers introduced
- Waves 41-50: All enemy types, increasing intensity
- **Wave 50:** Final boss wave (40 enemies, all types)
- **Wave 51+:** Cycles back to wave 1 composition with massive scaling

### HP Scaling Formula
- **Base:** +20% per wave (linear, continues forever)
- **Cycle bonus:** 2× HP per complete 50-wave cycle
- **Accelerated scaling:** After cycle 1, adds +10% per wave per cycle
- **Example:** Wave 51 enemies have ~2.4× the HP of wave 1 enemies
- **Speed:** Constant (does not scale with wave)
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

**Docs:** See [deploy/README.md](deploy/README.md) for setup and troubleshooting.
