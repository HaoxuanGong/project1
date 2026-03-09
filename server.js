/**
 * Multiplayer Server
 * Express + Socket.IO – manages rooms, player sync and chat.
 */
'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// In-memory room storage:  roomCode -> { hostId, players: Map<id, PlayerState> }
const rooms = new Map();

/** Generate a short human-readable room code. */
function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/** Build a serialisable snapshot of a room. */
function roomSnapshot(room) {
  return {
    players: Array.from(room.players.values()),
  };
}

// ──────────────────────────────────────────────
// Socket events
// ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  let currentRoom = null;

  // ── Create room ──────────────────────────────
  socket.on('create-room', ({ playerName, avatarColor }, ack) => {
    const code = generateRoomCode();
    const player = {
      id: socket.id,
      name: playerName || 'Player',
      avatarColor: avatarColor || '#e88',
      x: 400,
      y: 300,
      state: 'idle',
      isHost: true,
    };
    rooms.set(code, { hostId: socket.id, players: new Map([[socket.id, player]]) });
    socket.join(code);
    currentRoom = code;
    console.log(`[room] created ${code} by ${socket.id}`);
    ack({ success: true, code, player, snapshot: roomSnapshot(rooms.get(code)) });
  });

  // ── Join room ────────────────────────────────
  socket.on('join-room', ({ code, playerName, avatarColor }, ack) => {
    const upperCode = (code || '').toUpperCase();
    const room = rooms.get(upperCode);
    if (!room) {
      ack({ success: false, error: 'Room not found' });
      return;
    }
    const player = {
      id: socket.id,
      name: playerName || 'Player',
      avatarColor: avatarColor || '#88e',
      x: 450,
      y: 300,
      state: 'idle',
      isHost: false,
    };
    room.players.set(socket.id, player);
    socket.join(upperCode);
    currentRoom = upperCode;
    // Notify existing players
    socket.to(upperCode).emit('player-joined', player);
    console.log(`[room] ${socket.id} joined ${upperCode}`);
    ack({ success: true, code: upperCode, player, snapshot: roomSnapshot(room) });
  });

  // ── Position / state update ──────────────────
  socket.on('player-update', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    // Merge whitelisted fields only
    if (typeof data.x === 'number') player.x = data.x;
    if (typeof data.y === 'number') player.y = data.y;
    if (typeof data.state === 'string') player.state = data.state;
    socket.to(currentRoom).emit('player-updated', { id: socket.id, x: player.x, y: player.y, state: player.state });
  });

  // ── Chat message ─────────────────────────────
  socket.on('chat-message', (msg) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    const safeMsg = String(msg).slice(0, 200);
    io.to(currentRoom).emit('chat-message', { id: socket.id, name: player.name, msg: safeMsg });
  });

  // ── Furniture changes (host only) ────────────
  socket.on('furniture-update', (items) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;
    if (!Array.isArray(items)) return;
    room.furniture = items;
    socket.to(currentRoom).emit('furniture-updated', items);
  });

  // ── Disconnect ───────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.players.delete(socket.id);
    io.to(currentRoom).emit('player-left', socket.id);
    if (room.players.size === 0) {
      rooms.delete(currentRoom);
      console.log(`[room] deleted ${currentRoom} (empty)`);
    } else if (room.hostId === socket.id) {
      // Pass host to next player
      const nextPlayer = room.players.values().next().value;
      room.hostId = nextPlayer.id;
      nextPlayer.isHost = true;
      io.to(currentRoom).emit('host-changed', nextPlayer.id);
    }
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
});

module.exports = { app, httpServer, rooms };
