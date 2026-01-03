import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { setupSocketHandlers } from './socket/handlers.js';
import Game from './models/Game.js';
import adminRouter from './routes/admin.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.prod if it exists
const envPath = path.join(__dirname, '../.env.prod');
const envFileExists = fs.existsSync(envPath);

if (envFileExists) {
  // Deployed environment - .env.prod must load successfully
  const envResult = dotenv.config({ path: envPath });

  if (envResult.error) {
    console.error(`FATAL: .env.prod exists but failed to load: ${envResult.error.message}`);
    process.exit(1);
  }

  // Validate all required vars are present
  const required = ['NODE_ENV', 'MONGODB_URI', 'ADMIN_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`FATAL: Missing required env vars in .env.prod: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`Loaded environment from ${envPath} (${process.env.NODE_ENV})`);
} else {
  // Local development - no .env.prod file
  console.log('No .env.prod found - running in development mode');
}

const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with CORS for development
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST']
  }
});

const isProduction = process.env.NODE_ENV === 'production';
const clientDir = path.join(__dirname, '../client');

// Serve static files from client directory
// Disable automatic index.html serving so the catch-all route handles it
app.use(express.static(clientDir, { index: false }));

// Serve shared constants
app.get('/shared/constants.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes (token-protected in production)
// MUST be registered BEFORE catch-all route
app.use('/admin', adminRouter);
console.log(`Admin routes mounted at /admin/errors${isProduction ? ' (token required)' : ''}`);

// Catch-all route for SPA (Express 5 syntax)
// In production, serve the bundled index.html
app.get('/{*splat}', (req, res) => {
  const indexPath = isProduction
    ? path.join(clientDir, 'dist/index.html')
    : path.join(clientDir, 'index.html');
  res.sendFile(indexPath);
});

// Setup socket handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// CLI cleanup command handler
async function runCleanup(filter) {
  try {
    await connectDB();

    let query = {};
    let description = 'all games';

    switch (filter) {
    case 'orphaned':
    case 'empty':
      // Games with no players
      query = { players: { $size: 0 } };
      description = 'orphaned games (no players)';
      break;
    case 'lobby':
      // Games stuck in lobby
      query = { status: 'lobby' };
      description = 'games in lobby status';
      break;
    case 'old': {
      // Games older than 24 hours
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query = { updatedAt: { $lt: dayAgo } };
      description = 'games older than 24 hours';
      break;
    }
    case 'stale': {
      // Non-completed games older than 1 hour
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      query = {
        status: { $nin: ['completed', 'saved'] },
        updatedAt: { $lt: hourAgo }
      };
      description = 'stale games (inactive >1 hour, not completed)';
      break;
    }
    case 'all':
      query = {};
      description = 'ALL games';
      break;
    default:
      console.log('Game Cleanup Tool');
      console.log('=================');
      console.log('Usage: node server/index.js --cleanup <filter>\n');
      console.log('Available filters:');
      console.log('  orphaned  - Delete games with no players');
      console.log('  empty     - Same as orphaned');
      console.log('  lobby     - Delete games stuck in lobby');
      console.log('  old       - Delete games older than 24 hours');
      console.log('  stale     - Delete inactive games (>1 hour, not completed)');
      console.log('  all       - Delete ALL games (use with caution!)');
      process.exit(1);
    }

    // Show what will be deleted
    const count = await Game.countDocuments(query);
    console.log(`Found ${count} ${description}`);

    if (count > 0) {
      const result = await Game.deleteMany(query);
      console.log(`Deleted ${result.deletedCount} games`);
    } else {
      console.log('Nothing to delete');
    }

    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

// Check for CLI arguments
const args = process.argv.slice(2);
const cleanupIndex = args.indexOf('--cleanup');

if (cleanupIndex !== -1) {
  const filter = args[cleanupIndex + 1] || 'help';
  runCleanup(filter);
} else {
  startServer();
}
