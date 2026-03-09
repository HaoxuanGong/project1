/**
 * OfficeScene
 * The main 2.5D isometric office room.
 *
 * Features:
 *  - Isometric tiled floor + walls rendered with Phaser Graphics
 *  - Extensible furniture via FurnitureManager + data/furniture.json
 *  - Local anime character that reacts to keyboard / mouse activity
 *  - Remote players (via Socket.IO)
 *  - Chat overlay
 *  - Room code display + copy button
 */

import { IsoHelper } from '../objects/IsoHelper.js';
import { AnimeCharacter } from '../objects/AnimeCharacter.js';
import { FurnitureManager } from '../objects/FurnitureManager.js';

// Inactivity threshold before character returns to 'idle'
const ACTIVITY_TIMEOUT_MS = 2000;
// How often we send position/state updates (ms)
const SYNC_INTERVAL_MS = 100;

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OfficeScene' });
  }

  init(data) {
    this._serverUrl = data.serverUrl || 'http://localhost:3000';
    this._playerName = data.playerName || 'Player';
    this._avatarColor = data.avatarColor || '#E88888';
    this._roomCode = data.roomCode || '';
  }

  preload() {
    // All graphics are procedural – load the furniture JSON
    this.load.json('furniture', '../../data/furniture.json');
  }

  create() {
    const { width, height } = this.scale;

    // ── Isometric helper ─────────────────────────────────────────────────────
    // Grid: 10 columns × 8 rows, tiles 64×32 px
    this._gridCols = 10;
    this._gridRows = 8;
    const tileW = 64;
    const tileH = 32;
    const originX = width / 2;
    const originY = 120;
    this._iso = new IsoHelper(tileW, tileH, originX, originY);

    // ── Draw room ────────────────────────────────────────────────────────────
    this._roomGraphics = this.add.graphics();
    this._drawRoom();

    // ── Furniture ────────────────────────────────────────────────────────────
    const furnitureDefs = this.cache.json.get('furniture') || [];
    this._furniture = new FurnitureManager(this, this._iso, furnitureDefs);

    // ── Local player character ────────────────────────────────────────────────
    const playerStart = this._iso.toScreen(3, 3, 0);
    this._localChar = new AnimeCharacter(
      this, playerStart.x, playerStart.y,
      this._avatarColor, this._playerName, true
    );
    this._localChar.container.setDepth(200);

    // ── Activity tracking ────────────────────────────────────────────────────
    this._lastActivityTime = 0;
    this._activityDetected = false;
    this._setupActivityListeners();

    // ── Remote players ───────────────────────────────────────────────────────
    this._remotePlayers = new Map();  // socketId -> AnimeCharacter

    // ── Multiplayer ──────────────────────────────────────────────────────────
    this._socket = null;
    this._myRoomCode = '';
    this._myPlayerId = '';
    this._syncTimer = 0;
    this._connectToServer();

    // ── UI Overlay ───────────────────────────────────────────────────────────
    this._buildUI();

    // ── Camera / resize ──────────────────────────────────────────────────────
    this.scale.on('resize', this._onResize, this);
  }

  update(time, delta) {
    // Update local character state
    const elapsed = time - this._lastActivityTime;
    if (this._activityDetected && elapsed < ACTIVITY_TIMEOUT_MS) {
      this._localChar.setState('working');
    } else {
      this._localChar.setState('idle');
    }
    this._localChar.update(delta);

    // Update remote characters
    for (const [, rp] of this._remotePlayers) {
      rp.update(delta);
    }

    // Sync to server
    if (this._socket && this._socket.connected) {
      this._syncTimer += delta;
      if (this._syncTimer >= SYNC_INTERVAL_MS) {
        this._syncTimer = 0;
        const pos = this._localChar;
        this._socket.emit('player-update', {
          x: pos.x,
          y: pos.y,
          state: this._localChar.state,
        });
      }
    }
  }

  // ─── Room drawing ─────────────────────────────────────────────────────────

  _drawRoom() {
    const g = this._roomGraphics;
    g.clear();

    const { tileW, tileH } = this._iso;
    const cols = this._gridCols;
    const rows = this._gridRows;

    // ── Floor tiles ──────────────────────────────────────────────────────────
    for (let ix = 0; ix < cols; ix++) {
      for (let iy = 0; iy < rows; iy++) {
        const { x, y } = this._iso.toScreen(ix, iy, 0);
        const checker = (ix + iy) % 2 === 0;
        const tileTop = checker ? 0xE8E8F8 : 0xD8D8EE;
        const tileLeft = checker ? 0xC0C0D8 : 0xB8B8CC;
        const tileRight = checker ? 0xB0B0C8 : 0xA8A8BC;

        // Top face
        g.fillStyle(tileTop, 1);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + tileW / 2, y + tileH / 2);
        g.lineTo(x, y + tileH);
        g.lineTo(x - tileW / 2, y + tileH / 2);
        g.closePath();
        g.fillPath();

        // Tile border
        g.lineStyle(0.5, 0x9999AA, 0.3);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + tileW / 2, y + tileH / 2);
        g.lineTo(x, y + tileH);
        g.lineTo(x - tileW / 2, y + tileH / 2);
        g.closePath();
        g.strokePath();

        // ── Left wall (iy === 0) ─────────────────────────────────────────
        if (iy === 0) {
          const wallH = 96;
          g.fillStyle(tileLeft, 1);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y);
          g.lineTo(x, y - wallH);
          g.lineTo(x - tileW / 2, y + tileH / 2 - wallH);
          g.closePath();
          g.fillPath();
          g.lineStyle(0.5, 0x9999AA, 0.2);
          g.strokePath();
        }

        // ── Right wall (ix === 0) ────────────────────────────────────────
        if (ix === 0) {
          const wallH = 96;
          g.fillStyle(tileRight, 1);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y + tileH);
          g.lineTo(x, y + tileH - wallH);
          g.lineTo(x - tileW / 2, y + tileH / 2 - wallH);
          g.closePath();
          g.fillPath();
          g.lineStyle(0.5, 0x9999AA, 0.2);
          g.strokePath();
        }
      }
    }

    // ── Ceiling trim ─────────────────────────────────────────────────────────
    this._drawCeilingTrim(g, cols, rows);
    // ── Window ───────────────────────────────────────────────────────────────
    this._drawWindow(g);
  }

  _drawCeilingTrim(g, cols, rows) {
    const { tileW, tileH } = this._iso;
    const wallH = 96;

    // Top wall edge highlight (left wall top)
    g.lineStyle(2, 0xAABBCC, 0.7);
    for (let ix = 0; ix < cols; ix++) {
      const { x, y } = this._iso.toScreen(ix, 0, 0);
      g.beginPath();
      g.moveTo(x, y - wallH);
      g.lineTo(x + tileW / 2, y + tileH / 2 - wallH);
      g.strokePath();
    }
    // Right wall top
    for (let iy = 0; iy < rows; iy++) {
      const { x, y } = this._iso.toScreen(0, iy, 0);
      g.beginPath();
      g.moveTo(x, y - wallH);
      g.lineTo(x, y + tileH - wallH);
      g.strokePath();
    }
  }

  _drawWindow(g) {
    // A window on the back-left wall around tile (5,0)
    const { x, y } = this._iso.toScreen(5, 0, 0);
    const wallH = 96;
    const winX = x + 4;
    const winY = y - wallH + 16;
    const winW = 36;
    const winH = 50;

    // Sky fill
    g.fillStyle(0x88CCFF, 0.6);
    g.fillRect(winX, winY, winW, winH);

    // Sun
    g.fillStyle(0xFFEE88, 0.9);
    g.fillCircle(winX + winW - 8, winY + 10, 7);

    // Clouds
    g.fillStyle(0xFFFFFF, 0.7);
    g.fillEllipse(winX + 6, winY + 8, 16, 8);
    g.fillEllipse(winX + 12, winY + 6, 16, 8);

    // Frame
    g.lineStyle(2, 0x8B6914, 0.9);
    g.strokeRect(winX, winY, winW, winH);
    // Cross bar
    g.lineStyle(1.5, 0x8B6914, 0.7);
    g.beginPath();
    g.moveTo(winX + winW / 2, winY);
    g.lineTo(winX + winW / 2, winY + winH);
    g.strokePath();
    g.beginPath();
    g.moveTo(winX, winY + winH / 2);
    g.lineTo(winX + winW, winY + winH / 2);
    g.strokePath();
  }

  // ─── Activity listeners ───────────────────────────────────────────────────

  _setupActivityListeners() {
    this._markActivity = () => {
      this._lastActivityTime = this.time.now;
      this._activityDetected = true;
    };
    this.input.keyboard.on('keydown', this._markActivity);
    this.input.on('pointermove', this._markActivity);
    this.input.on('pointerdown', this._markActivity);
    // Also listen on the whole document so typing in DOM inputs counts
    document.addEventListener('keydown', this._markActivity, { passive: true });
    document.addEventListener('mousemove', this._markActivity, { passive: true });
  }

  // ─── Multiplayer ─────────────────────────────────────────────────────────

  _connectToServer() {
    try {
      this._socket = io(this._serverUrl, { transports: ['websocket'] });

      this._socket.on('connect', () => {
        console.log('[socket] connected', this._socket.id);
        if (this._roomCode) {
          this._joinRoom(this._roomCode);
        } else {
          this._createRoom();
        }
      });

      this._socket.on('connect_error', (err) => {
        console.warn('[socket] connect_error', err.message);
        this._updateRoomLabel('Offline – solo mode');
      });

      this._socket.on('player-joined', (player) => {
        console.log('[room] player joined', player.id);
        this._spawnRemotePlayer(player);
        this._localChar.say(`${player.name} joined! 👋`);
      });

      this._socket.on('player-updated', ({ id, x, y, state }) => {
        const rp = this._remotePlayers.get(id);
        if (rp) {
          rp.setPosition(x, y);
          rp.setState(state);
        }
      });

      this._socket.on('player-left', (id) => {
        const rp = this._remotePlayers.get(id);
        if (rp) {
          rp.destroy();
          this._remotePlayers.delete(id);
        }
      });

      this._socket.on('chat-message', ({ name, msg }) => {
        this._addChatMessage(`${name}: ${msg}`);
      });

      this._socket.on('furniture-updated', (items) => {
        this._furniture.applyDefinitions(items);
      });

      this._socket.on('host-changed', (newHostId) => {
        if (newHostId === this._socket.id) {
          this._addChatMessage('You are now the host.');
        }
      });
    } catch (err) {
      console.warn('[socket] could not initialise', err);
    }
  }

  _createRoom() {
    this._socket.emit('create-room',
      { playerName: this._playerName, avatarColor: this._avatarColor },
      (res) => {
        if (res.success) {
          this._myRoomCode = res.code;
          this._myPlayerId = this._socket.id;
          this._updateRoomLabel(`Room: ${res.code}  (share to invite)`);
          this._addChatMessage(`Room created! Code: ${res.code}`);
          this._addChatMessage('Share this code with friends to collaborate.');
          // Spawn any existing players in the snapshot
          for (const p of res.snapshot.players) {
            if (p.id !== this._socket.id) this._spawnRemotePlayer(p);
          }
        }
      }
    );
  }

  _joinRoom(code) {
    this._socket.emit('join-room',
      { code, playerName: this._playerName, avatarColor: this._avatarColor },
      (res) => {
        if (res.success) {
          this._myRoomCode = res.code;
          this._myPlayerId = this._socket.id;
          this._updateRoomLabel(`Room: ${res.code}`);
          this._addChatMessage(`Joined room ${res.code}!`);
          for (const p of res.snapshot.players) {
            if (p.id !== this._socket.id) this._spawnRemotePlayer(p);
          }
        } else {
          this._addChatMessage(`Error: ${res.error}`);
          this._createRoom();
        }
      }
    );
  }

  _spawnRemotePlayer(player) {
    if (this._remotePlayers.has(player.id)) return;
    const pos = this._iso.toScreen(player.x || 4, player.y || 3, 0);
    const rChar = new AnimeCharacter(
      this, pos.x, pos.y,
      player.avatarColor || '#88E8', player.name || 'Guest', false
    );
    rChar.container.setDepth(200);
    this._remotePlayers.set(player.id, rChar);
  }

  // ─── UI ──────────────────────────────────────────────────────────────────

  _buildUI() {
    const { width, height } = this.scale;

    // ── Room info bar ─────────────────────────────────────────────────────
    const topBar = this.add.graphics();
    topBar.fillStyle(0x000000, 0.45);
    topBar.fillRoundedRect(8, 8, 360, 40, 8);
    topBar.setDepth(500);

    this._roomLabel = this.add.text(20, 20, 'Connecting…', {
      fontSize: '13px', fontFamily: 'Segoe UI, sans-serif', color: '#AACCFF',
    }).setDepth(501);

    // Copy button
    const copyBtn = this.add.text(332, 20, '📋', {
      fontSize: '16px',
    }).setDepth(502).setInteractive({ useHandCursor: true });
    copyBtn.on('pointerdown', () => {
      if (this._myRoomCode && navigator.clipboard) {
        navigator.clipboard.writeText(this._myRoomCode);
        this._localChar.say('Room code copied! 📋');
      }
    });

    // ── Activity indicator ────────────────────────────────────────────────
    const actBar = this.add.graphics();
    actBar.fillStyle(0x000000, 0.4);
    actBar.fillRoundedRect(8, 56, 160, 28, 6);
    actBar.setDepth(500);

    this._actLabel = this.add.text(20, 63, '😴 Idle', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#CCCCCC',
    }).setDepth(501);

    // ── Chat panel ────────────────────────────────────────────────────────
    const chatW = 280;
    const chatH = 160;
    const chatX = width - chatW - 8;
    const chatY = height - chatH - 52;

    const chatBg = this.add.graphics();
    chatBg.fillStyle(0x000000, 0.5);
    chatBg.fillRoundedRect(chatX, chatY, chatW, chatH, 8);
    chatBg.setDepth(500);

    this._chatLines = [];
    this._chatContainer = this.add.container(chatX + 6, chatY + 4).setDepth(501);

    // Chat input
    const chatInputBg = this.add.graphics();
    chatInputBg.fillStyle(0x000000, 0.6);
    chatInputBg.fillRoundedRect(chatX, height - 48, chatW, 38, 8);
    chatInputBg.setDepth(500);

    this._chatInput = this.add.dom(chatX + chatW / 2, height - 30).createFromHTML(
      `<input type="text" id="chat-input" maxlength="200"
              placeholder="Press Enter to chat…"
              style="width:${chatW - 12}px;padding:6px 10px;border-radius:6px;
                     border:1px solid #334466;background:#0a0f1e;
                     color:#ddeeff;font-size:12px;outline:none;" />`
    ).setDepth(502);

    // Send on Enter
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const el = document.getElementById('chat-input');
      if (!el || document.activeElement !== el) return;
      const msg = el.value.trim();
      if (!msg) return;
      el.value = '';
      if (this._socket && this._socket.connected) {
        this._socket.emit('chat-message', msg);
      } else {
        this._addChatMessage(`You: ${msg}`);
      }
    });

    // ── Instructions ─────────────────────────────────────────────────────
    this.add.text(width / 2, height - 18, 'Type or move mouse → character works  •  Chat in the box →', {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#556677',
    }).setOrigin(0.5).setDepth(501);

    // ── State label update ────────────────────────────────────────────────
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const elapsed = this.time.now - this._lastActivityTime;
        const isWorking = this._activityDetected && elapsed < ACTIVITY_TIMEOUT_MS;
        this._actLabel.setText(isWorking ? '💻 Working' : '😴 Idle');
        this._actLabel.setColor(isWorking ? '#88FFAA' : '#CCCCCC');
      },
    });
  }

  _updateRoomLabel(text) {
    if (this._roomLabel) this._roomLabel.setText(text);
  }

  _addChatMessage(text) {
    const MAX_LINES = 8;
    const style = {
      fontSize: '11px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#DDEEFF',
      wordWrap: { width: 268 },
    };
    const line = this.add.text(0, 0, text, style);
    this._chatLines.push(line);
    this._chatContainer.add(line);

    // Reposition all lines
    let offsetY = 0;
    const keepLines = this._chatLines.slice(-MAX_LINES);
    // Remove old lines from container
    if (this._chatLines.length > MAX_LINES) {
      const old = this._chatLines.splice(0, this._chatLines.length - MAX_LINES);
      for (const ol of old) ol.destroy();
    }
    this._chatLines = keepLines;
    for (const l of this._chatLines) {
      l.setPosition(0, offsetY);
      offsetY += 18;
    }
  }

  _onResize(gameSize) {
    // Redraw room on window resize
    this._drawRoom();
  }

  // ── Clean up on scene shutdown ────────────────────────────────────────────
  shutdown() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }
    if (this._localChar) this._localChar.destroy();
    for (const [, rp] of this._remotePlayers) rp.destroy();
    this._remotePlayers.clear();
    if (this._furniture) this._furniture.destroy();
    document.removeEventListener('keydown', this._markActivity);
    document.removeEventListener('mousemove', this._markActivity);
    this.scale.off('resize', this._onResize, this);
  }
}
