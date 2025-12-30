const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

async function connectDB() {
  // Try to load from .env.prod first
  const envProdPath = path.join(__dirname, '../../.env.prod');

  let mongoUri = process.env.MONGODB_URI;

  if (fs.existsSync(envProdPath)) {
    const envConfig = require('dotenv').config({ path: envProdPath });
    if (envConfig.parsed && envConfig.parsed.MONGODB_URI) {
      mongoUri = envConfig.parsed.MONGODB_URI;
    }
  }

  if (!mongoUri) {
    console.error('MONGODB_URI not found. Please set it in .env.prod or as an environment variable.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });
}

module.exports = connectDB;
