import { v4 as uuidv4 } from 'uuid';
import Game from '../models/Game.js';
import ClientError from '../models/ClientError.js';
import MazeGenerator from '../game/MazeGenerator.js';
import GameManager from '../game/GameManager.js';
import { GAME_CONFIG, ERROR_REPORTING, SOCKET_EVENTS, GAME_STATUS } from '../../shared/constants.js';
import { createGameLogger, serverLogger } from '../utils/logger.js';

// Store active game managers
const activeGames = new Map();

function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < GAME_CONFIG.SESSION_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to broadcast updated open games list to all browsers
async function broadcastOpenGamesList(io) {
  try {
    const openGames = await Game.find({
      isPrivate: false,
      status: { $in: [GAME_STATUS.LOBBY, GAME_STATUS.PLAYING, GAME_STATUS.PAUSED] }
    }).select('sessionCode hostNickname mazeSize players status').limit(50);

    io.to('browsers').emit(SOCKET_EVENTS.OPEN_GAMES_LIST, openGames.map(g => ({
      sessionCode: g.sessionCode,
      hostNickname: g.hostNickname,
      playerCount: g.players.length,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      mazeSize: g.mazeSize,
      status: g.status
    })));
  } catch (error) {
    serverLogger.error('Broadcast open games list error:', error);
  }
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    serverLogger.info(`Client connected: ${socket.id}`);

    let currentSession = null;
    let currentNickname = null;
    let playerId = uuidv4();

    // Create a new game
    socket.on(SOCKET_EVENTS.CREATE_GAME, async (data) => {
      try {
        const { nickname, isPrivate, mazeSize } = data;

        // Generate unique session code
        let sessionCode;
        let attempts = 0;
        do {
          sessionCode = generateSessionCode();
          attempts++;
        } while (await Game.findOne({ sessionCode }) && attempts < 10);

        if (attempts >= 10) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Could not generate session code' });
          return;
        }

        // Generate maze
        const mazeGenerator = new MazeGenerator(mazeSize);
        const maze = mazeGenerator.generate();

        // Create game document
        const game = new Game({
          sessionCode,
          hostNickname: nickname,
          isPrivate,
          mazeSize,
          maze,
          players: [{
            socketId: socket.id,
            playerId: playerId,
            nickname,
            isHost: true
          }]
        });

        await game.save();

        // Join socket room
        socket.join(sessionCode);
        currentSession = sessionCode;
        currentNickname = nickname;

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const inviteLink = `${baseUrl}/?join=${sessionCode}`;

        socket.emit(SOCKET_EVENTS.GAME_CREATED, {
          sessionCode,
          inviteLink,
          maze,
          players: game.players.map(p => ({ nickname: p.nickname, isHost: p.isHost }))
        });

        const log = createGameLogger(game._id.toString());
        log.event('GAME_CREATED', {
          sessionCode,
          host: nickname,
          isPrivate,
          mazeSize
        });

        // Broadcast to browsers if this is a public game
        if (!isPrivate) {
          broadcastOpenGamesList(io);
        }
      } catch (error) {
        console.error('Create game error:', error);
        socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Failed to create game' });
      }
    });

    // Join existing game
    socket.on(SOCKET_EVENTS.JOIN_GAME, async (data) => {
      try {
        const { sessionCode, nickname } = data;

        const game = await Game.findOne({ sessionCode });

        if (!game) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Game not found' });
          return;
        }

        if (game.players.length >= GAME_CONFIG.MAX_PLAYERS) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Game is full' });
          return;
        }

        // Clean up players with dead sockets (orphaned)
        const alivePlayers = [];
        for (const p of game.players) {
          const sock = io.sockets.sockets.get(p.socketId);
          if (sock && sock.connected) {
            alivePlayers.push(p);
          }
        }
        if (alivePlayers.length !== game.players.length) {
          game.players = alivePlayers;
          await game.save();
        }

        // Check for duplicate nickname
        if (game.players.some(p => p.nickname === nickname)) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Nickname already taken' });
          return;
        }

        // Add player
        game.players.push({
          socketId: socket.id,
          playerId: playerId,
          nickname,
          isHost: false
        });
        await game.save();

        // Join socket room
        socket.join(sessionCode);
        currentSession = sessionCode;
        currentNickname = nickname;

        // Get current game state if game is in progress
        let gameState = null;
        const manager = activeGames.get(sessionCode);
        if (manager) {
          const state = manager.getState();
          gameState = state.gameState;
        }

        socket.emit(SOCKET_EVENTS.JOIN_SUCCESS, {
          sessionCode,
          maze: game.maze,
          players: game.players.map(p => ({ nickname: p.nickname, isHost: p.isHost })),
          gameState: gameState || game.gameState,
          status: game.status,
          gameSpeed: manager ? manager.speedMultiplier : 1
        });

        // Notify other players
        socket.to(sessionCode).emit(SOCKET_EVENTS.PLAYER_JOINED, { nickname });

        const log = createGameLogger(game._id.toString());
        log.event('PLAYER_JOINED', {
          nickname,
          playerCount: game.players.length
        });
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Failed to join game' });
      }
    });

    // Rejoin a suspended game (auto-reconnect after standby)
    socket.on(SOCKET_EVENTS.REJOIN_GAME, async (data) => {
      try {
        const { sessionCode, nickname } = data;
        serverLogger.info(`[REJOIN] Attempt: sessionCode=${sessionCode} nickname=${nickname}`);

        const game = await Game.findOne({ sessionCode });

        if (!game) {
          serverLogger.info(`[REJOIN] Failed: Game not found sessionCode=${sessionCode}`);
          socket.emit(SOCKET_EVENTS.REJOIN_ERROR, { message: 'Game session not found or has expired' });
          return;
        }

        // Handle suspended game - resume it
        if (game.status === GAME_STATUS.SUSPENDED) {
          // Resume the game in paused state
          game.status = GAME_STATUS.PAUSED;
          game.suspendedAt = null;
          game.pausedBy = 'System (resumed after reconnect)';

          // Add player back
          game.players = [{
            socketId: socket.id,
            playerId: playerId,
            nickname,
            isHost: true
          }];

          // Save with retry on version conflict
          // This handles race condition with disconnect handler
          let savedGame = game;
          try {
            await game.save();
          } catch (saveError) {
            if (saveError.name === 'VersionError') {
              // Document was modified by disconnect handler, refetch and retry
              serverLogger.info('[REJOIN] Version conflict, refetching and retrying');
              savedGame = await Game.findOne({ sessionCode });
              if (!savedGame) {
                socket.emit(SOCKET_EVENTS.REJOIN_ERROR, { message: 'Game not found after retry' });
                return;
              }
              // Apply the same changes to the fresh document
              savedGame.status = GAME_STATUS.PAUSED;
              savedGame.suspendedAt = null;
              savedGame.pausedBy = 'System (resumed after reconnect)';
              savedGame.players = [{
                socketId: socket.id,
                playerId: playerId,
                nickname,
                isHost: true
              }];
              await savedGame.save();
            } else {
              throw saveError;
            }
          }

          // Join socket room
          socket.join(sessionCode);
          currentSession = sessionCode;
          currentNickname = nickname;

          // Recreate GameManager from saved state
          const manager = new GameManager(io, sessionCode, savedGame.toObject());
          activeGames.set(sessionCode, manager);
          // Don't start the game loop - game is paused, player needs to resume

          const log = createGameLogger(savedGame._id.toString());
          log.event('PLAYER_REJOINED', {
            nickname,
            wasSuspendedFor: savedGame.suspendedAt ?
              Math.round((Date.now() - savedGame.suspendedAt) / (60 * 1000)) + 'min' : 'unknown'
          });

          serverLogger.info(`[REJOIN] Success: Resumed suspended game sessionCode=${sessionCode}`);

          socket.emit(SOCKET_EVENTS.REJOIN_SUCCESS, {
            sessionCode,
            maze: savedGame.maze,
            players: savedGame.players.map(p => ({ nickname: p.nickname, isHost: p.isHost })),
            gameState: savedGame.gameState,
            status: savedGame.status,
            gameSpeed: 1  // Suspended games restart at normal speed
          });
          return;
        }

        // Game is not suspended - it's still active
        // Check if player can join (same logic as JOIN_GAME)
        if (game.status === GAME_STATUS.LOBBY) {
          // Don't auto-rejoin lobbies, let them use normal join
          socket.emit(SOCKET_EVENTS.REJOIN_ERROR, { message: 'Game is in lobby, please join normally' });
          return;
        }

        if (game.players.length >= GAME_CONFIG.MAX_PLAYERS) {
          socket.emit(SOCKET_EVENTS.REJOIN_ERROR, { message: 'Game is full' });
          return;
        }

        // Clean up dead sockets
        const alivePlayers = [];
        for (const p of game.players) {
          const sock = io.sockets.sockets.get(p.socketId);
          if (sock && sock.connected) {
            alivePlayers.push(p);
          }
        }
        if (alivePlayers.length !== game.players.length) {
          game.players = alivePlayers;
        }

        // Check if same nickname already in game
        if (game.players.some(p => p.nickname === nickname)) {
          socket.emit(SOCKET_EVENTS.REJOIN_ERROR, { message: 'You are already in this game' });
          return;
        }

        // Add player to active game
        game.players.push({
          socketId: socket.id,
          playerId: playerId,
          nickname,
          isHost: game.players.length === 0
        });
        await game.save();

        socket.join(sessionCode);
        currentSession = sessionCode;
        currentNickname = nickname;

        // Get live game state
        let gameState = game.gameState;
        let currentStatus = game.status;
        const manager = activeGames.get(sessionCode);
        if (manager) {
          const state = manager.getState();
          gameState = state.gameState;
          currentStatus = manager.gameData.status;

          // Auto-pause if reconnecting with page hidden (laptop sleep)
          // This prevents the game from running while user is away
          if (data.pageHidden && manager.gameData.status === GAME_STATUS.PLAYING) {
            manager.pause('System (auto-pause on sleep)');
            currentStatus = GAME_STATUS.PAUSED;
            const log = createGameLogger(game._id.toString());
            log.event('GAME_PAUSED_AUTO', { reason: 'reconnect_page_hidden', nickname });
          }
        }

        const log = createGameLogger(game._id.toString());
        log.event('PLAYER_REJOINED', { nickname, playerCount: game.players.length });

        serverLogger.info(`[REJOIN] Success: Joined active game sessionCode=${sessionCode}`);

        socket.emit(SOCKET_EVENTS.REJOIN_SUCCESS, {
          sessionCode,
          maze: game.maze,
          players: game.players.map(p => ({ nickname: p.nickname, isHost: p.isHost })),
          gameState: gameState,
          status: currentStatus,
          gameSpeed: manager ? manager.speedMultiplier : 1
        });

        // Notify others
        socket.to(sessionCode).emit(SOCKET_EVENTS.PLAYER_JOINED, { nickname });
      } catch (error) {
        console.error('Rejoin game error:', error);
        socket.emit(SOCKET_EVENTS.REJOIN_ERROR, { message: 'Failed to rejoin game' });
      }
    });

    // Browse open games
    socket.on(SOCKET_EVENTS.BROWSE_GAMES, async () => {
      try {
        // Join browsers room to receive real-time updates
        socket.join('browsers');

        const openGames = await Game.find({
          isPrivate: false,
          status: { $in: [GAME_STATUS.LOBBY, GAME_STATUS.PLAYING, GAME_STATUS.PAUSED] }
        }).select('sessionCode hostNickname mazeSize players status').limit(50);

        socket.emit(SOCKET_EVENTS.OPEN_GAMES_LIST, openGames.map(g => ({
          sessionCode: g.sessionCode,
          hostNickname: g.hostNickname,
          playerCount: g.players.length,
          maxPlayers: GAME_CONFIG.MAX_PLAYERS,
          mazeSize: g.mazeSize,
          status: g.status
        })));
      } catch (error) {
        console.error('Browse games error:', error);
        socket.emit(SOCKET_EVENTS.OPEN_GAMES_LIST, []);
      }
    });

    // Stop browsing - leave the browsers room
    socket.on(SOCKET_EVENTS.STOP_BROWSING, () => {
      socket.leave('browsers');
    });

    // Start game (host only)
    socket.on(SOCKET_EVENTS.START_GAME, async () => {
      try {
        if (!currentSession) return;

        const game = await Game.findOne({ sessionCode: currentSession });
        if (!game) return;

        // Verify host
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Only the host can start the game' });
          return;
        }

        if (game.status !== GAME_STATUS.LOBBY) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Game already started' });
          return;
        }

        // Create game manager
        const manager = new GameManager(io, currentSession, game);
        activeGames.set(currentSession, manager);
        manager.start();

        await game.save();

        io.to(currentSession).emit(SOCKET_EVENTS.GAME_STARTED, {
          maze: game.maze,
          gameState: game.gameState
        });

        // Broadcast status change to browsers
        broadcastOpenGamesList(io);
      } catch (error) {
        console.error('Start game error:', error);
      }
    });

    // Place tower
    socket.on(SOCKET_EVENTS.PLACE_TOWER, async (data) => {
      try {
        if (!currentSession) return;

        const manager = activeGames.get(currentSession);
        if (!manager) return;

        const result = manager.placeTower(data.type, data.gridX, data.gridY);

        if (result.success) {
          io.to(currentSession).emit(SOCKET_EVENTS.TOWER_PLACED, {
            tower: result.tower,
            newBudget: result.newBudget,
            playerId: socket.id
          });

          // Save to database
          const game = await Game.findOne({ sessionCode: currentSession });
          if (game) {
            game.gameState = manager.gameData.gameState;
            await game.save();
          }
        } else {
          socket.emit(SOCKET_EVENTS.TOWER_ERROR, { error: result.error });
        }
      } catch (error) {
        console.error('Place tower error:', error);
      }
    });

    // Upgrade tower
    socket.on(SOCKET_EVENTS.UPGRADE_TOWER, async (data) => {
      try {
        if (!currentSession) return;

        const manager = activeGames.get(currentSession);
        if (!manager) return;

        const result = manager.upgradeTower(data.towerId);

        if (result.success) {
          io.to(currentSession).emit(SOCKET_EVENTS.TOWER_UPGRADED, {
            towerId: result.towerId,
            newLevel: result.newLevel,
            newBudget: result.newBudget,
            playerId: socket.id
          });

          // Save to database
          const game = await Game.findOne({ sessionCode: currentSession });
          if (game) {
            game.gameState = manager.gameData.gameState;
            await game.save();
          }
        } else {
          socket.emit(SOCKET_EVENTS.TOWER_ERROR, { error: result.error });
        }
      } catch (error) {
        console.error('Upgrade tower error:', error);
      }
    });

    // Sell tower
    socket.on(SOCKET_EVENTS.SELL_TOWER, async (data) => {
      try {
        if (!currentSession) return;

        const manager = activeGames.get(currentSession);
        if (!manager) return;

        const result = manager.sellTower(data.towerId);

        if (result.success) {
          io.to(currentSession).emit(SOCKET_EVENTS.TOWER_SOLD, {
            towerId: result.towerId,
            sellValue: result.sellValue,
            newBudget: result.newBudget,
            playerId: socket.id
          });

          // Save to database
          const game = await Game.findOne({ sessionCode: currentSession });
          if (game) {
            game.gameState = manager.gameData.gameState;
            await game.save();
          }
        } else {
          socket.emit(SOCKET_EVENTS.TOWER_ERROR, { error: result.error });
        }
      } catch (error) {
        console.error('Sell tower error:', error);
      }
    });

    // Pause game
    socket.on(SOCKET_EVENTS.PAUSE_GAME, async () => {
      try {
        if (!currentSession || !currentNickname) return;

        const manager = activeGames.get(currentSession);
        if (!manager) return;

        manager.pause(currentNickname);

        // Save to database
        const game = await Game.findOne({ sessionCode: currentSession });
        if (game) {
          game.status = GAME_STATUS.PAUSED;
          game.pausedBy = currentNickname;
          await game.save();
        }

        io.to(currentSession).emit(SOCKET_EVENTS.GAME_PAUSED, {
          pausedBy: currentNickname
        });
      } catch (error) {
        console.error('Pause game error:', error);
      }
    });

    // Resume game
    socket.on(SOCKET_EVENTS.RESUME_GAME, async () => {
      try {
        if (!currentSession) return;

        const manager = activeGames.get(currentSession);
        if (!manager) return;

        manager.resume();

        // Save to database
        const game = await Game.findOne({ sessionCode: currentSession });
        if (game) {
          game.status = GAME_STATUS.PLAYING;
          game.pausedBy = null;
          await game.save();
        }

        io.to(currentSession).emit(SOCKET_EVENTS.GAME_RESUMED, {});
      } catch (error) {
        console.error('Resume game error:', error);
      }
    });

    // Change game speed
    socket.on(SOCKET_EVENTS.CHANGE_SPEED, async (data) => {
      try {
        if (!currentSession || !currentNickname) return;

        const manager = activeGames.get(currentSession);
        if (!manager) return;

        const speed = parseFloat(data.speed);
        if (manager.setGameSpeed(speed)) {
          io.to(currentSession).emit(SOCKET_EVENTS.SPEED_CHANGED, {
            speed: speed,
            changedBy: currentNickname
          });
        }
      } catch (error) {
        console.error('Change speed error:', error);
      }
    });

    // Save game (host only)
    socket.on(SOCKET_EVENTS.SAVE_GAME, async () => {
      try {
        if (!currentSession) return;

        const game = await Game.findOne({ sessionCode: currentSession });
        if (!game) return;

        // Verify host
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Only the host can save the game' });
          return;
        }

        const manager = activeGames.get(currentSession);
        if (manager) {
          game.gameState = manager.gameData.gameState;
        }

        game.status = GAME_STATUS.SAVED;
        game.savedAt = new Date();
        await game.save();

        io.to(currentSession).emit(SOCKET_EVENTS.GAME_SAVED, {
          savedAt: game.savedAt
        });

        const log = createGameLogger(game._id.toString());
        log.event('GAME_SAVED', { savedAt: game.savedAt });
      } catch (error) {
        console.error('Save game error:', error);
      }
    });

    // Chat message
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data) => {
      if (!currentSession || !currentNickname) return;

      io.to(currentSession).emit(SOCKET_EVENTS.CHAT_BROADCAST, {
        nickname: currentNickname,
        message: data.message,
        timestamp: Date.now()
      });
    });

    // Initiate kick vote
    socket.on(SOCKET_EVENTS.INITIATE_KICK, async (data) => {
      try {
        if (!currentSession || !currentNickname) return;

        const game = await Game.findOne({ sessionCode: currentSession });
        if (!game) return;

        const targetPlayer = game.players.find(p => p.nickname === data.targetNickname);
        if (!targetPlayer) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Player not found' });
          return;
        }

        // Can't kick yourself
        if (data.targetNickname === currentNickname) {
          socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Cannot kick yourself' });
          return;
        }

        // Store vote in socket data (in production, use Redis or DB)
        if (!io.sockets.adapter.rooms.get(currentSession)?.kickVote) {
          io.to(currentSession).emit(SOCKET_EVENTS.KICK_VOTE_STARTED, {
            targetNickname: data.targetNickname,
            initiatedBy: currentNickname,
            votesNeeded: Math.ceil(game.players.length / 2)
          });
        }
      } catch (error) {
        console.error('Initiate kick error:', error);
      }
    });

    // Leave lobby (graceful exit from lobby screen)
    socket.on(SOCKET_EVENTS.LEAVE_LOBBY, async () => {
      if (!currentSession) return;

      try {
        const game = await Game.findOne({ sessionCode: currentSession });
        if (!game) return;

        const player = game.players.find(p => p.socketId === socket.id);
        const log = createGameLogger(game._id.toString());

        if (player?.isHost && game.status === GAME_STATUS.LOBBY) {
          // Host leaving lobby = delete game and notify others
          socket.to(currentSession).emit(SOCKET_EVENTS.LOBBY_CLOSED, {
            reason: 'Host left the lobby'
          });
          await Game.deleteOne({ sessionCode: currentSession });
          log.event('LOBBY_CLOSED_BY_HOST', { host: currentNickname });
          broadcastOpenGamesList(io);
        } else {
          // Non-host: remove player, keep game
          game.players = game.players.filter(p => p.socketId !== socket.id);
          if (game.players.length > 0) {
            if (!game.players.some(p => p.isHost)) {
              game.players[0].isHost = true;
              log.event('HOST_TRANSFERRED', { newHost: game.players[0].nickname });
            }
            await game.save();
            socket.to(currentSession).emit(SOCKET_EVENTS.PLAYER_LEFT, { nickname: currentNickname });
          } else {
            await Game.deleteOne({ sessionCode: currentSession });
            log.event('GAME_DELETED', {});
            broadcastOpenGamesList(io);
          }
        }

        socket.leave(currentSession);
        currentSession = null;
        currentNickname = null;
      } catch (error) {
        console.error('Leave lobby error:', error);
      }
    });

    // Leave game (graceful exit during gameplay)
    socket.on(SOCKET_EVENTS.LEAVE_GAME, async () => {
      if (!currentSession) return;

      try {
        const game = await Game.findOne({ sessionCode: currentSession });
        if (!game) return;

        const log = createGameLogger(game._id.toString());
        game.players = game.players.filter(p => p.socketId !== socket.id);

        if (game.players.length > 0) {
          // Transfer host to random remaining player if needed
          if (!game.players.some(p => p.isHost)) {
            const randomIndex = Math.floor(Math.random() * game.players.length);
            game.players[randomIndex].isHost = true;
            socket.to(currentSession).emit(SOCKET_EVENTS.HOST_TRANSFERRED, {
              newHost: game.players[randomIndex].nickname
            });
            log.event('HOST_TRANSFERRED', { newHost: game.players[randomIndex].nickname });
          }
          await game.save();
          socket.to(currentSession).emit(SOCKET_EVENTS.PLAYER_LEFT, { nickname: currentNickname });
          log.event('PLAYER_LEFT', { nickname: currentNickname, playersRemaining: game.players.length });
        } else {
          // Last player - delete game
          const manager = activeGames.get(currentSession);
          if (manager) {
            manager.stop();
            activeGames.delete(currentSession);
          }
          await Game.deleteOne({ sessionCode: currentSession });
          log.event('GAME_DELETED', {});
          broadcastOpenGamesList(io);
        }

        socket.leave(currentSession);
        currentSession = null;
        currentNickname = null;
      } catch (error) {
        console.error('Leave game error:', error);
      }
    });

    // Client error reporting
    socket.on(SOCKET_EVENTS.CLIENT_ERROR, async (data) => {
      try {
        // Basic validation
        if (!data || !data.message) {
          return;
        }

        // Hard cap per socket
        const maxErrors = ERROR_REPORTING.MAX_ERRORS_PER_CLIENT;
        if (!socket._errorCount) socket._errorCount = 0;
        if (socket._errorCount >= maxErrors) {
          return;
        }
        socket._errorCount++;

        // Save to database
        await ClientError.create({
          type: data.type || 'error',
          message: data.message.substring(0, 2000),
          filename: data.filename,
          lineno: data.lineno,
          colno: data.colno,
          stack: data.stack?.substring(0, 10000),
          url: data.url,
          userAgent: data.userAgent?.substring(0, 500),
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
          activeScenes: data.activeScenes?.substring(0, 200),
          clientTimestamp: data.timestamp ? new Date(data.timestamp) : null,
          sessionCode: currentSession || null,
          socketId: socket.id
        });

        serverLogger.info(`Client error ${socket._errorCount}/${maxErrors}: ${data.message.substring(0, 100)}`);
      } catch (err) {
        serverLogger.error('Failed to save client error', err);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      serverLogger.info(`Client disconnected: ${socket.id}`);

      if (currentSession && currentNickname) {
        try {
          const game = await Game.findOne({ sessionCode: currentSession });
          if (game) {
            const log = createGameLogger(game._id.toString());

            // Remove player from game
            game.players = game.players.filter(p => p.socketId !== socket.id);

            log.event('PLAYER_LEFT', {
              nickname: currentNickname,
              playersRemaining: game.players.length
            });

            // If host left and game is in lobby, assign new host
            if (game.players.length > 0) {
              const hasHost = game.players.some(p => p.isHost);
              if (!hasHost) {
                game.players[0].isHost = true;
                log.event('HOST_TRANSFERRED', {
                  newHost: game.players[0].nickname
                });
              }
              await game.save();
            } else {
              // No players left (according to MongoDB document)
              const manager = activeGames.get(currentSession);
              if (manager) {
                // Race condition check: did someone rejoin while we were processing?
                // The manager's player list is the source of truth for active games
                if (manager.gameData.players.length > 0) {
                  // A player rejoined - don't suspend!
                  log.event('SUSPEND_ABORTED', { reason: 'player_rejoined' });
                  return;
                }

                // Sync runtime state to MongoDB document before stopping
                // The manager has the live game state, MongoDB document may be stale
                game.gameState.currentWave = manager.gameData.gameState.currentWave;
                game.gameState.towers = manager.gameData.gameState.towers;
                game.gameState.budget = manager.gameData.gameState.budget;
                game.gameState.lives = manager.gameData.gameState.lives;

                manager.stop();
                activeGames.delete(currentSession);
              }
              log.event('GAME_EMPTY', {});

              // Suspend active games (playing/paused) instead of deleting
              if (game.status === GAME_STATUS.PLAYING || game.status === GAME_STATUS.PAUSED) {
                const previousStatus = game.status; // Capture before changing
                game.status = GAME_STATUS.SUSPENDED;
                game.suspendedAt = new Date();
                game.gameState.waveInProgress = false; // Wave will restart on resume
                await game.save();
                log.event('GAME_SUSPENDED', {
                  previousStatus: previousStatus,
                  towers: game.gameState.towers.length,
                  wave: game.gameState.currentWave
                });
              } else {
                // Delete lobby games (no point saving them)
                await Game.deleteOne({ sessionCode: currentSession });
                log.event('GAME_DELETED', {});
              }

              // Broadcast to browsers that a game changed
              broadcastOpenGamesList(io);
            }

            socket.to(currentSession).emit(SOCKET_EVENTS.PLAYER_LEFT, {
              nickname: currentNickname
            });
          }
        } catch (error) {
          serverLogger.error('Disconnect cleanup error:', error);
        }
      }
    });
  });
}

// Cleanup suspended games older than 24 hours
const SUSPENDED_GAME_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function cleanupSuspendedGames() {
  try {
    const cutoffTime = new Date(Date.now() - SUSPENDED_GAME_TTL_MS);
    const expiredGames = await Game.find({
      status: GAME_STATUS.SUSPENDED,
      suspendedAt: { $lt: cutoffTime }
    });

    for (const game of expiredGames) {
      const suspendedFor = Math.round((Date.now() - game.suspendedAt.getTime()) / (60 * 60 * 1000));
      serverLogger.info(`[GAME_CLEANUP] Deleting suspended game sessionCode=${game.sessionCode} suspendedFor=${suspendedFor}h`);
      await Game.deleteOne({ _id: game._id });
    }

    if (expiredGames.length > 0) {
      serverLogger.info(`[GAME_CLEANUP] Deleted ${expiredGames.length} expired suspended game(s)`);
    }
  } catch (error) {
    serverLogger.error('Cleanup suspended games error:', error);
  }
}

// Start periodic cleanup (every hour)
function startCleanupJob() {
  // Run immediately on startup
  cleanupSuspendedGames();
  // Then run every hour
  setInterval(cleanupSuspendedGames, 60 * 60 * 1000);
  serverLogger.info('[GAME_CLEANUP] Suspended game cleanup job started (24h TTL, hourly check)');
}

export { setupSocketHandlers, activeGames, startCleanupJob };
