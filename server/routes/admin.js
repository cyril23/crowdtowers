import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import ClientError from '../models/ClientError.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// Auth middleware - in production requires ?token=ADMIN_SECRET
const authMiddleware = (req, res, next) => {
  if (!isProduction) {
    return next(); // No auth in dev
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return res.status(503).send('Admin access not configured (ADMIN_SECRET missing)');
  }

  const token = req.query.token;
  if (token !== adminSecret) {
    return res.status(401).send('Unauthorized - invalid or missing token');
  }

  next();
};

// Apply auth to all admin routes
router.use(authMiddleware);

// Serve admin UI page
router.get('/errors', async (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-errors.html'));
});

// API: List all errors (newest first)
router.get('/api/errors', async (req, res) => {
  try {
    const errors = await ClientError.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .select('_id type message activeScenes sessionCode createdAt');
    res.json(errors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get single error details
router.get('/api/errors/:id', async (req, res) => {
  try {
    const error = await ClientError.findById(req.params.id);
    if (!error) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(error);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete single error
router.delete('/api/errors/:id', async (req, res) => {
  try {
    const result = await ClientError.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Download error as .txt file
router.get('/api/errors/:id/download', async (req, res) => {
  try {
    const error = await ClientError.findById(req.params.id);
    if (!error) {
      return res.status(404).send('Not found');
    }

    const content = `=== Client Error Report ===
ID: ${error._id}
Type: ${error.type}
Created: ${error.createdAt}
Client Timestamp: ${error.clientTimestamp || 'N/A'}
URL: ${error.url || 'N/A'}
Active Scenes: ${error.activeScenes || 'N/A'}
Session: ${error.sessionCode || 'N/A'}
Socket ID: ${error.socketId || 'N/A'}

=== Message ===
${error.message}

=== Stack Trace ===
${error.stack || 'No stack trace'}

=== Environment ===
User Agent: ${error.userAgent || 'N/A'}
Screen: ${error.screenWidth || '?'}x${error.screenHeight || '?'}
File: ${error.filename || 'N/A'}:${error.lineno || '?'}:${error.colno || '?'}
`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="error-${error._id}.txt"`);
    res.send(content);
  } catch {
    res.status(500).send('Error generating file');
  }
});

export default router;
