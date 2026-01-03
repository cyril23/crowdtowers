import mongoose from 'mongoose';

const clientErrorSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['error', 'unhandledrejection']
  },
  message: {
    type: String,
    required: true
  },
  filename: String,
  lineno: Number,
  colno: Number,
  stack: String,
  url: String,
  userAgent: String,
  screenWidth: Number,
  screenHeight: Number,
  clientTimestamp: Date,
  activeScenes: String,
  sessionCode: String,
  socketId: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Auto-expire after 365 days
clientErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model('ClientError', clientErrorSchema);
