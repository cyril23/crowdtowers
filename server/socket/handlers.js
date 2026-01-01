const { v4: uuidv4 } = require('uuid');
const Game = require('../models/Game');
const MazeGenerator = require('../game/MazeGenerator');
const GameManager = require('../game/GameManager');
const { GAME_CONFIG, SOCKET_EVENTS, GAME_STATUS } = require('../../shared/constants');
const { createGameLogger, serverLogger } = require('../utils/logger');

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
          status: game.status
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

    // Browse open games
    socket.on(SOCKET_EVENTS.BROWSE_GAMES, async () => {
      try {
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
            newBudget: result.newBudget
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
            newBudget: result.newBudget
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
            newBudget: result.newBudget
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
              // No players left, clean up
              const manager = activeGames.get(currentSession);
              if (manager) {
                manager.stop();
                activeGames.delete(currentSession);
              }
              log.event('GAME_EMPTY', {});

              // Delete game from database
              await Game.deleteOne({ sessionCode: currentSession });
              log.event('GAME_DELETED', {});
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

module.exports = { setupSocketHandlers, activeGames };
