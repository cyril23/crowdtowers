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

## Infrastructure

### Horizontal Scaling
If the game grows beyond single-server capacity.

**Considerations:**
- Socket.IO needs Redis adapter for multi-instance
- MongoDB → MongoDB Atlas or replica set
- Load balancer (Hetzner Load Balancer or nginx upstream)
- Sticky sessions for WebSocket connections

**Current capacity:** Single CPX32 (8GB RAM) can handle hundreds of concurrent players.
