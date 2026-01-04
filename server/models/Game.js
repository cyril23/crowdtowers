import mongoose from 'mongoose';
import { GAME_STATUS } from '../../shared/constants.js';

const towerSchema = new mongoose.Schema({
  id: String,
  type: String,
  gridX: Number,
  gridY: Number,
  level: { type: Number, default: 1 }
}, { _id: false });

const playerSchema = new mongoose.Schema({
  socketId: String,      // Socket ID (current session)
  playerId: String,      // Persistent ID for reconnection
  nickname: String,
  joinedAt: { type: Date, default: Date.now },
  isHost: { type: Boolean, default: false }
}, { _id: false });

const gameStateSchema = new mongoose.Schema({
  budget: { type: Number, default: 500 },
  lives: { type: Number, default: 10 },
  currentWave: { type: Number, default: 0 },
  towers: [towerSchema],
  waveInProgress: { type: Boolean, default: false }
}, { _id: false });

const mazeSchema = new mongoose.Schema({
  grid: [[Number]],
  entry: { x: Number, y: Number },
  exit: { x: Number, y: Number },
  path: [{ x: Number, y: Number }]
}, { _id: false });

const gameSchema = new mongoose.Schema({
  sessionCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hostNickname: String,
  isPrivate: { type: Boolean, default: true },
  mazeSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: Object.values(GAME_STATUS),
    default: GAME_STATUS.LOBBY
  },
  maze: mazeSchema,
  players: [playerSchema],
  gameState: {
    type: gameStateSchema,
    default: () => ({})
  },
  pausedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  savedAt: { type: Date, default: null },
  suspendedAt: { type: Date, default: null }
});

// Update timestamp on save
gameSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Index for browsing open games
gameSchema.index({ isPrivate: 1, status: 1 });

export default mongoose.model('Game', gameSchema);
