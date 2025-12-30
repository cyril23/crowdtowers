const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');
const { setupSocketHandlers } = require('./socket/handlers');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.prod') });

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

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve shared constants
app.get('/shared/constants.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all route for SPA (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
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

startServer();
