# Future Improvements

Planned features and improvements for CrowdTowers.

## Observability

### Player Analytics
Track game metrics for balancing and insights.

**Metrics to track:**
- Games created/completed
- Average wave reached
- Tower placement heatmaps
- Most used tower types
- Player retention

**Options:**
- **Plausible** - Privacy-friendly, simple
- **PostHog** - Open source, self-hostable
- **Custom MongoDB aggregations** - Free, already have the DB

## Features

### Leaderboards
High scores and achievements.

**Ideas:**
- Highest wave reached (per game size)
- Most enemies killed in single game
- Longest survival time
- Weekly/monthly rankings

**Implementation:** Store game results in MongoDB, add API endpoints, add UI component.

### Player Accounts
Optional accounts for persistent stats.

**Options:**
- **Anonymous by default** - Current approach, simple
- **Optional sign-in** - OAuth (Google, GitHub, Discord)
- **Nicknames only** - No auth, just localStorage

## Gameplay Features

### Game Speed Controls
Allow host to change game speed during gameplay (2x, 5x, 10x).

**Current state:** Fixed tick rate of 20/second in `shared/constants.js`

**Implementation:**
- Server: Multiply `deltaTime` in `GameManager.tick()` by speed factor
- Client: Speed selector UI (host-only) in game menu
- Socket: `SET_GAME_SPEED` event with host permission check
- Affects: Enemy movement, tower cooldowns, wave timing
- Does NOT affect: Chat, pause/resume timing

### In-Game Player List
Show connected players during gameplay (currently only visible in lobby).

**Current state:** Player list in `LobbyScene.js:217-246`, nothing in GameScene

**Implementation:**
- Collapsible player panel overlay in GameScene
- Show: nickname, host badge, connection status indicator
- Use existing `PLAYER_JOINED`/`PLAYER_LEFT` socket events
- Mobile: Minimize to player count badge, tap to expand
- Right-click player → context menu (kick vote, etc.)

### Kick Vote GUI
Add UI for the existing kick vote system (server logic exists, no client UI).

**Current state:** Server has `INITIATE_KICK`, `KICK_VOTE_STARTED`, `CAST_KICK_VOTE`, `KICK_VOTE_UPDATE`, `PLAYER_KICKED`, `KICK_VOTE_FAILED` events in `handlers.js:635-665`

**Implementation:**
- Vote modal when `KICK_VOTE_STARTED` received
- Show: target player, initiator, progress bar, Yes/No buttons
- Auto-dismiss on `PLAYER_KICKED` or `KICK_VOTE_FAILED`
- Add vote timeout display (server needs timeout in event payload)
- Trigger via player list right-click → "Initiate kick vote"

### Tab Switch Reconnect Spam Fix
Prevent chat flooding with leave/join messages when players switch tabs.

**Current state:** `NetworkManager.js:20-44` disconnects after 5s hidden, broadcasts `PLAYER_LEFT` then `PLAYER_JOINED` on reconnect

**Options:**
- **Server grace period (recommended):** Don't broadcast leave if same socket reconnects within 10s
- **Client debounce:** Skip "joined" message if same player left within 10s
- **Reconnect flag:** Add `isReconnect` field, suppress system message

### Separate Chat Button
Move chat toggle out of menu dropdown for easier access and clearer notifications.

**Current state:** Chat accessed via `#menu-toggle-btn` dropdown in `GameMenuManager.js`

**Implementation:**
- Dedicated chat toggle button (speech bubble icon) in game UI
- Position: Bottom-right corner, always visible
- Notification badge on this button instead of menu
- Keep menu dropdown as secondary access point
- Consider: Floating chat head style vs fixed button

### Remote Player Cursor Display
Show other players' cursors in real-time with toggle to enable/disable.

**Current state:** Not implemented - no cursor tracking exists

**Implementation:**
- Client: Emit cursor position on mousemove (throttled ~10fps max)
- Server: Broadcast cursor positions to room (separate from game state)
- Client: Render semi-transparent cursors with player name labels
- Settings toggle in game menu (default: off for performance)
- Performance: Skip broadcasts if game is lagging
- Visual: Player color coding, fade out when idle

### Coop Game Modes
Let host choose from multiple cooperation styles during game creation.

**Current state:** Only shared budget mode exists

**Mode ideas:**
- **Shared Budget** (current): Everyone draws from same pool
- **Personal Budgets**: Each player has own budget, can gift money to others
- **Zone Control**: Map divided into player zones, each controls their area
- **Role-Based**: Dedicated builder/upgrader/seller roles with restricted permissions
- **Competitive Coop**: Teams compete for kill count but share lives

**Implementation:**
- Add `coopMode` field to Game model and CreateGameScene
- Mode selector with description tooltips
- Mode-specific logic in tower placement/economy handlers

## Infrastructure

### Horizontal Scaling
If the game grows beyond single-server capacity.

**Considerations:**
- Socket.IO needs Redis adapter for multi-instance
- MongoDB → MongoDB Atlas or replica set
- Load balancer (Hetzner Load Balancer or nginx upstream)
- Sticky sessions for WebSocket connections

**Current capacity:** Single CPX32 (8GB RAM) can handle hundreds of concurrent players.
