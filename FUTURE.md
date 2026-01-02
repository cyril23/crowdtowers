# Future Improvements

Planned features and improvements for CrowdTowers.

## Performance

### Asset Bundling
Bundle and minify JavaScript/CSS for faster page loads.

**Options:**
- **esbuild** - Extremely fast, minimal config
- **Vite** - Modern dev server + production bundler
- **Rollup** - Flexible, good for libraries

**Benefits:**
- Reduced HTTP requests (fewer files)
- Smaller file sizes (minification + tree-shaking)
- Faster initial page load

**Current state:** Plain JavaScript files served directly. Works fine for small games but doesn't scale.

## Observability

### Error Tracking
Capture JavaScript errors from players in real-time.

**Options:**
- **Sentry** - Free tier, good JS support, source maps
- **LogRocket** - Session replay + error tracking
- **Bugsnag** - Similar to Sentry

**Implementation:**
```html
<script src="https://js.sentry-cdn.com/xxx.min.js" crossorigin="anonymous"></script>
```

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

### Staging Environment
Test changes before production.

**Options:**
- **Separate Hetzner VPS** - Full isolation, ~€8/month
- **Docker on same server** - Different port, less isolation
- **Subdomain** - staging.crowdtowers.wochenentwicklung.com

**GitHub Actions integration:**
- Push to `main` → deploy to production
- Push to `staging` branch → deploy to staging

### Horizontal Scaling
If the game grows beyond single-server capacity.

**Considerations:**
- Socket.IO needs Redis adapter for multi-instance
- MongoDB → MongoDB Atlas or replica set
- Load balancer (Hetzner Load Balancer or nginx upstream)
- Sticky sessions for WebSocket connections

**Current capacity:** Single CPX32 (8GB RAM) can handle hundreds of concurrent players.
