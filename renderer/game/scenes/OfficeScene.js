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
import { getCompanionLayout } from '../utils/companionLayout.mjs';

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
    this._displayMode = data.displayMode || 'office';
    this._companionMode = this._displayMode === 'companion';
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
    this._companionLayout = getCompanionLayout(width, height);

    // ── Draw room ────────────────────────────────────────────────────────────
    this._roomGraphics = this.add.graphics();
    if (this._companionMode) {
      this._companionBackGraphics = this.add.graphics().setDepth(130);
      this._companionFrontGraphics = this.add.graphics().setDepth(260);
      this._drawCompanionView(0);
    } else {
      this._drawRoom();
    }

    // ── Furniture ────────────────────────────────────────────────────────────
    if (!this._companionMode) {
      const furnitureDefs = this.cache.json.get('furniture') || [];
      this._furniture = new FurnitureManager(this, this._iso, furnitureDefs);
    }

    // ── Local player character ────────────────────────────────────────────────
    const playerStart = this._companionMode
      ? this._companionLayout.character
      : this._iso.toScreen(3, 3, 0);
    this._localChar = new AnimeCharacter(
      this, playerStart.x, playerStart.y,
      this._avatarColor, this._playerName, true,
      this._companionMode ? {
        scale: playerStart.scale,
        hideName: true,
        deskPose: true,
      } : {}
    );
    this._localChar.container.setDepth(this._companionMode ? 220 : 200);

    // ── Activity tracking ────────────────────────────────────────────────────
    this._lastActivityTime = this.time.now;
    this._activityDetected = this._companionMode;
    this._setupActivityListeners();

    // ── Remote players ───────────────────────────────────────────────────────
    this._remotePlayers = new Map();  // socketId -> AnimeCharacter

    // ── Multiplayer ──────────────────────────────────────────────────────────
    this._socket = null;
    this._myRoomCode = '';
    this._myPlayerId = '';
    this._syncTimer = 0;
    if (!this._companionMode) {
      this._connectToServer();
    } else if (window.electronAPI?.setWindowMode) {
      window.electronAPI.setWindowMode('companion').catch(() => {});
    }

    // ── UI Overlay ───────────────────────────────────────────────────────────
    this._buildUI();

    // ── Camera / resize ──────────────────────────────────────────────────────
    this.scale.on('resize', this._onResize, this);
  }

  update(time, delta) {
    // Update local character state
    const elapsed = time - this._lastActivityTime;
    const isWorking = this._companionMode
      ? elapsed < ACTIVITY_TIMEOUT_MS || Math.sin(time / 900) > -0.35
      : (this._activityDetected && elapsed < ACTIVITY_TIMEOUT_MS);
    this._localChar.setState(isWorking ? 'working' : 'idle');
    this._localChar.update(delta);

    if (this._companionMode) {
      this._drawCompanionView(time);
    }

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

  _drawCompanionView(time = 0) {
    if (!this._companionBackGraphics || !this._companionFrontGraphics) return;

    const back = this._companionBackGraphics;
    const front = this._companionFrontGraphics;
    const layout = this._companionLayout;
    const pulse = 0.55 + (Math.sin(time / 500) * 0.5 + 0.5) * 0.45;
    const steamDrift = Math.sin(time / 1100) * 5;

    back.clear();
    front.clear();

    back.fillStyle(0x12203A, 0.55);
    back.fillRoundedRect(8, 8, this.scale.width - 16, this.scale.height - 16, 24);
    back.fillStyle(0x6FA6FF, 0.08);
    back.fillEllipse(layout.monitor.x - 18, layout.monitor.y + 40, 190, 130);
    back.fillStyle(0xFFD889, 0.08 + pulse * 0.04);
    back.fillEllipse(layout.lamp.x + 18, layout.desk.y + 18, 140, 90);
    back.fillStyle(0x000000, 0.18);
    back.fillEllipse(layout.desk.x + layout.desk.width * 0.48, layout.desk.y + layout.desk.height + 14, layout.desk.width * 1.05, 34);

    // Monitor
    back.fillStyle(0x0D1322, 0.95);
    back.fillRoundedRect(layout.monitor.x, layout.monitor.y, layout.monitor.width, layout.monitor.height, 8);
    back.fillStyle(0x89C2FF, 0.16 + pulse * 0.12);
    back.fillRoundedRect(layout.monitor.x + 5, layout.monitor.y + 5, layout.monitor.width - 10, layout.monitor.height - 10, 6);
    back.fillStyle(0xBFE3FF, 0.12 + pulse * 0.08);
    back.fillRect(layout.monitor.x + 12, layout.monitor.y + 12, layout.monitor.width - 24, 6);
    back.fillRect(layout.monitor.x + 12, layout.monitor.y + 24, layout.monitor.width - 32, 4);
    back.fillRect(layout.monitor.x + 12, layout.monitor.y + 34, layout.monitor.width - 20, 4);
    back.fillStyle(0x2E3E58, 0.95);
    back.fillRoundedRect(layout.monitor.x + layout.monitor.width / 2 - 5, layout.monitor.y + layout.monitor.height - 2, 10, 18, 4);
    back.fillRoundedRect(layout.monitor.x + layout.monitor.width / 2 - 26, layout.monitor.y + layout.monitor.height + 14, 52, 6, 3);

    // Lamp
    back.lineStyle(4, 0xA4B7D5, 0.9);
    back.beginPath();
    back.moveTo(layout.lamp.x, layout.desk.y + layout.desk.height * 0.35);
    back.lineTo(layout.lamp.x + 14, layout.desk.y - 4);
    back.lineTo(layout.lamp.x + 34, layout.desk.y + 6);
    back.strokePath();
    back.fillStyle(0xF1D59C, 0.95);
    back.fillRoundedRect(layout.lamp.x + 18, layout.desk.y - 2, 28, 16, 6);

    // Desk top
    back.fillStyle(0x6E4C34, 0.95);
    back.fillRoundedRect(layout.desk.x, layout.desk.y, layout.desk.width, layout.desk.height * 0.54, 12);
    back.fillStyle(0xA87750, 0.25);
    back.fillRoundedRect(layout.desk.x + 8, layout.desk.y + 6, layout.desk.width - 16, 10, 8);

    // Mug + steam
    back.fillStyle(0xF6F8FF, 0.92);
    back.fillRoundedRect(layout.mug.x, layout.mug.y, 18, 14, 4);
    back.lineStyle(2, 0xF6F8FF, 0.8);
    back.beginPath();
    back.arc(layout.mug.x + 18, layout.mug.y + 7, 4, -1.2, 1.2, false);
    back.strokePath();
    back.fillStyle(0xFFFFFF, 0.12);
    back.fillEllipse(layout.mug.x + 5 + steamDrift * 0.18, layout.mug.y - 10, 8, 12);
    back.fillEllipse(layout.mug.x + 4 - steamDrift * 0.12, layout.mug.y - 22, 7, 10);
    back.fillEllipse(layout.mug.x + 12 - steamDrift * 0.16, layout.mug.y - 8, 8, 12);
    back.fillEllipse(layout.mug.x + 13 + steamDrift * 0.1, layout.mug.y - 20, 7, 10);

    // Desk front / foreground occlusion
    front.fillStyle(0x4F341F, 0.97);
    front.fillRoundedRect(layout.desk.x - 2, layout.desk.y + layout.desk.height * 0.28, layout.desk.width + 4, layout.desk.frontHeight, 10);
    front.fillStyle(0x000000, 0.08);
    front.fillRoundedRect(layout.desk.x + 12, layout.desk.y + layout.desk.height * 0.35, layout.desk.width - 24, 10, 6);
    front.fillStyle(0xC7D3EA, 0.12 + pulse * 0.06);
    front.fillRoundedRect(layout.desk.x + 10, layout.desk.y + layout.desk.height * 0.3, layout.desk.width * 0.42, 3, 2);
  }

  // ─── Room drawing ─────────────────────────────────────────────────────────

  _drawRoom() {
    const g = this._roomGraphics;
    g.clear();

    const { tileW, tileH } = this._iso;
    const cols = this._gridCols;
    const rows = this._gridRows;

    // ── Floor tiles (polished stone aesthetic) ───────────────────────────────
    for (let ix = 0; ix < cols; ix++) {
      for (let iy = 0; iy < rows; iy++) {
        const { x, y } = this._iso.toScreen(ix, iy, 0);
        const checker = (ix + iy) % 2 === 0;
        const tileTop = checker ? 0xE0E4F0 : 0xCDD2E4;
        const tileLeft = checker ? 0xB0B8D0 : 0xA4ACC4;
        const tileRight = checker ? 0xA0A8C0 : 0x949CB8;

        // Top face
        g.fillStyle(tileTop, 1);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + tileW / 2, y + tileH / 2);
        g.lineTo(x, y + tileH);
        g.lineTo(x - tileW / 2, y + tileH / 2);
        g.closePath();
        g.fillPath();

        // Subtle highlight on top-left edge
        g.lineStyle(0.5, 0xFFFFFF, checker ? 0.12 : 0.06);
        g.beginPath();
        g.moveTo(x - tileW / 2, y + tileH / 2);
        g.lineTo(x, y);
        g.lineTo(x + tileW / 2, y + tileH / 2);
        g.strokePath();

        // Tile border (soft)
        g.lineStyle(0.5, 0x8090AA, 0.15);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + tileW / 2, y + tileH / 2);
        g.lineTo(x, y + tileH);
        g.lineTo(x - tileW / 2, y + tileH / 2);
        g.closePath();
        g.strokePath();

        // ── Left wall (iy === 0) with gradient lighting ──────────────────
        if (iy === 0) {
          const wallH = 96;
          // Darker base
          g.fillStyle(tileLeft, 1);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y);
          g.lineTo(x, y - wallH);
          g.lineTo(x - tileW / 2, y + tileH / 2 - wallH);
          g.closePath();
          g.fillPath();
          // Light gradient overlay (simulates overhead light)
          const lightAlpha = 0.04 + (ix / cols) * 0.06;
          g.fillStyle(0xFFFFFF, lightAlpha);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y);
          g.lineTo(x, y - wallH);
          g.lineTo(x - tileW / 2, y + tileH / 2 - wallH);
          g.closePath();
          g.fillPath();
          g.lineStyle(0.5, 0x8090AA, 0.12);
          g.strokePath();
          // Baseboard
          g.fillStyle(0x8890A8, 0.3);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y);
          g.lineTo(x, y - 4);
          g.lineTo(x - tileW / 2, y + tileH / 2 - 4);
          g.closePath();
          g.fillPath();
        }

        // ── Right wall (ix === 0) with gradient lighting ─────────────────
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
          // Lighting overlay
          const lightAlpha = 0.03 + (iy / rows) * 0.05;
          g.fillStyle(0xFFFFFF, lightAlpha);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y + tileH);
          g.lineTo(x, y + tileH - wallH);
          g.lineTo(x - tileW / 2, y + tileH / 2 - wallH);
          g.closePath();
          g.fillPath();
          g.lineStyle(0.5, 0x8090AA, 0.12);
          g.strokePath();
          // Baseboard
          g.fillStyle(0x8890A8, 0.3);
          g.beginPath();
          g.moveTo(x - tileW / 2, y + tileH / 2);
          g.lineTo(x, y + tileH);
          g.lineTo(x, y + tileH - 4);
          g.lineTo(x - tileW / 2, y + tileH / 2 - 4);
          g.closePath();
          g.fillPath();
        }
      }
    }

    // ── Ceiling trim ─────────────────────────────────────────────────────────
    this._drawCeilingTrim(g, cols, rows);
    // ── Window ───────────────────────────────────────────────────────────────
    this._drawWindow(g);
    // ── Ambient light pool on floor ──────────────────────────────────────────
    this._drawAmbientLight(g);
  }

  _drawCeilingTrim(g, cols, rows) {
    const { tileW, tileH } = this._iso;
    const wallH = 96;

    // Crown moulding highlight (left wall top)
    g.lineStyle(2.5, 0xC8D0E0, 0.6);
    for (let ix = 0; ix < cols; ix++) {
      const { x, y } = this._iso.toScreen(ix, 0, 0);
      g.beginPath();
      g.moveTo(x, y - wallH);
      g.lineTo(x + tileW / 2, y + tileH / 2 - wallH);
      g.strokePath();
    }
    // Right wall crown moulding
    for (let iy = 0; iy < rows; iy++) {
      const { x, y } = this._iso.toScreen(0, iy, 0);
      g.beginPath();
      g.moveTo(x, y - wallH);
      g.lineTo(x, y + tileH - wallH);
      g.strokePath();
    }
    // Secondary trim line (shadow below moulding)
    g.lineStyle(1, 0x8090AA, 0.25);
    for (let ix = 0; ix < cols; ix++) {
      const { x, y } = this._iso.toScreen(ix, 0, 0);
      g.beginPath();
      g.moveTo(x, y - wallH + 4);
      g.lineTo(x + tileW / 2, y + tileH / 2 - wallH + 4);
      g.strokePath();
    }
    for (let iy = 0; iy < rows; iy++) {
      const { x, y } = this._iso.toScreen(0, iy, 0);
      g.beginPath();
      g.moveTo(x, y - wallH + 4);
      g.lineTo(x, y + tileH - wallH + 4);
      g.strokePath();
    }
  }

  _drawWindow(g) {
    // A window on the back-left wall around tile (5,0)
    const { x, y } = this._iso.toScreen(5, 0, 0);
    const wallH = 96;
    const winX = x + 2;
    const winY = y - wallH + 12;
    const winW = 40;
    const winH = 56;

    // Window recess shadow
    g.fillStyle(0x000000, 0.08);
    g.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);

    // Sky gradient fill
    g.fillGradientStyle(0x6ABAEE, 0x6ABAEE, 0xABDDFF, 0xABDDFF, 1);
    g.fillRect(winX, winY, winW, winH);

    // Sun with glow
    g.fillStyle(0xFFDD66, 0.2);
    g.fillCircle(winX + winW - 8, winY + 12, 14);
    g.fillStyle(0xFFEE88, 0.6);
    g.fillCircle(winX + winW - 8, winY + 12, 8);
    g.fillStyle(0xFFF8CC, 0.95);
    g.fillCircle(winX + winW - 8, winY + 12, 5);

    // Clouds (more detail)
    g.fillStyle(0xFFFFFF, 0.75);
    g.fillEllipse(winX + 8, winY + 10, 18, 8);
    g.fillEllipse(winX + 15, winY + 8, 16, 8);
    g.fillEllipse(winX + 11, winY + 12, 14, 6);
    // Second cloud
    g.fillStyle(0xFFFFFF, 0.5);
    g.fillEllipse(winX + 24, winY + 32, 14, 6);
    g.fillEllipse(winX + 28, winY + 30, 12, 6);

    // Window frame (wood grain brown)
    g.lineStyle(3, 0x7A5A28, 0.95);
    g.strokeRect(winX, winY, winW, winH);
    // Cross bar
    g.lineStyle(2, 0x7A5A28, 0.85);
    g.beginPath();
    g.moveTo(winX + winW / 2, winY);
    g.lineTo(winX + winW / 2, winY + winH);
    g.strokePath();
    g.beginPath();
    g.moveTo(winX, winY + winH / 2);
    g.lineTo(winX + winW, winY + winH / 2);
    g.strokePath();
    // Inner frame highlight
    g.lineStyle(0.5, 0xDDCC99, 0.4);
    g.strokeRect(winX + 1, winY + 1, winW - 2, winH - 2);

    // Window sill
    g.fillStyle(0x8A6A30, 0.9);
    g.fillRect(winX - 3, winY + winH, winW + 6, 4);
    g.fillStyle(0xBBA050, 0.4);
    g.fillRect(winX - 3, winY + winH, winW + 6, 1);
  }

  /** Soft ambient light pool on the floor near the window */
  _drawAmbientLight(g) {
    const { x, y } = this._iso.toScreen(5, 2, 0);
    // Warm light from window
    g.fillStyle(0xFFEECC, 0.04);
    g.fillEllipse(x, y, 120, 50);
    g.fillStyle(0xFFEECC, 0.03);
    g.fillEllipse(x + 10, y + 10, 80, 35);
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
    if (this._companionMode) return;
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
    if (this._companionMode) return;
    const { width, height } = this.scale;

    // ── Room info bar (frosted glass) ─────────────────────────────────────
    const topBar = this.add.graphics();
    topBar.fillStyle(0x101828, 0.65);
    topBar.fillRoundedRect(8, 8, 370, 42, 10);
    topBar.lineStyle(1, 0x3a5080, 0.3);
    topBar.strokeRoundedRect(8, 8, 370, 42, 10);
    // Top highlight
    topBar.fillStyle(0xFFFFFF, 0.04);
    topBar.fillRoundedRect(9, 9, 368, 20, { tl: 10, tr: 10, bl: 0, br: 0 });
    topBar.setDepth(500);

    this._roomLabel = this.add.text(22, 22, 'Connecting…', {
      fontSize: '13px', fontFamily: 'Segoe UI, sans-serif', color: '#A0C0FF',
      shadow: { offsetX: 0, offsetY: 1, color: '#00001144', blur: 3, fill: true },
    }).setDepth(501);

    // Copy button
    const copyBtn = this.add.text(340, 22, '📋', {
      fontSize: '16px',
    }).setDepth(502).setInteractive({ useHandCursor: true });
    copyBtn.on('pointerdown', () => {
      if (this._myRoomCode && navigator.clipboard) {
        navigator.clipboard.writeText(this._myRoomCode);
        this._localChar.say('Room code copied! 📋');
      }
    });

    // ── Activity indicator (pill shape) ───────────────────────────────────
    const actBar = this.add.graphics();
    actBar.fillStyle(0x101828, 0.6);
    actBar.fillRoundedRect(8, 58, 170, 30, 8);
    actBar.lineStyle(1, 0x3a5080, 0.2);
    actBar.strokeRoundedRect(8, 58, 170, 30, 8);
    actBar.setDepth(500);

    this._actLabel = this.add.text(22, 66, '😴 Idle', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#9AABCC',
    }).setDepth(501);

    // Status dot
    this._actDot = this.add.graphics().setDepth(501);

    // ── Chat panel (frosted glass) ────────────────────────────────────────
    const chatW = 300;
    const chatH = 170;
    const chatX = width - chatW - 10;
    const chatY = height - chatH - 56;

    const chatBg = this.add.graphics();
    chatBg.fillStyle(0x101828, 0.6);
    chatBg.fillRoundedRect(chatX, chatY, chatW, chatH, 10);
    chatBg.lineStyle(1, 0x3a5080, 0.25);
    chatBg.strokeRoundedRect(chatX, chatY, chatW, chatH, 10);
    // Header bar
    chatBg.fillStyle(0xFFFFFF, 0.03);
    chatBg.fillRoundedRect(chatX + 1, chatY + 1, chatW - 2, 22, { tl: 10, tr: 10, bl: 0, br: 0 });
    chatBg.setDepth(500);

    // Chat header text
    this.add.text(chatX + 10, chatY + 4, '💬  Chat', {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#7888AA',
    }).setDepth(501);

    this._chatLines = [];
    this._chatContainer = this.add.container(chatX + 8, chatY + 26).setDepth(501);

    // Chat input
    const chatInputBg = this.add.graphics();
    chatInputBg.fillStyle(0x0a1020, 0.7);
    chatInputBg.fillRoundedRect(chatX, height - 50, chatW, 40, 10);
    chatInputBg.lineStyle(1, 0x3a5080, 0.2);
    chatInputBg.strokeRoundedRect(chatX, height - 50, chatW, 40, 10);
    chatInputBg.setDepth(500);

    this._chatInput = this.add.dom(chatX + chatW / 2, height - 30).createFromHTML(
      `<input type="text" id="chat-input" maxlength="200"
              placeholder="Press Enter to chat…"
              style="width:${chatW - 16}px;padding:7px 12px;border-radius:8px;
                     border:1px solid rgba(60,80,128,0.4);background:rgba(8,14,30,0.6);
                     color:#ddeeff;font-size:12px;outline:none;
                     font-family:'Segoe UI',sans-serif;
                     transition:border-color 0.2s;"
              onfocus="this.style.borderColor='rgba(100,140,255,0.5)'"
              onblur="this.style.borderColor='rgba(60,80,128,0.4)'" />`
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
    const instrBg = this.add.graphics();
    instrBg.fillStyle(0x101828, 0.4);
    instrBg.fillRoundedRect(width / 2 - 220, height - 30, 440, 22, 6);
    instrBg.setDepth(500);

    this.add.text(width / 2, height - 19, 'Type or move mouse → character works  •  Chat in the box →', {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#4a5a7a',
    }).setOrigin(0.5).setDepth(501);

    // ── State label update ────────────────────────────────────────────────
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const elapsed = this.time.now - this._lastActivityTime;
        const isWorking = this._activityDetected && elapsed < ACTIVITY_TIMEOUT_MS;
        this._actLabel.setText(isWorking ? '💻 Working' : '😴 Idle');
        this._actLabel.setColor(isWorking ? '#66EE99' : '#9AABCC');
        // Animated status dot
        this._actDot.clear();
        this._actDot.fillStyle(isWorking ? 0x66EE99 : 0x9AABCC, 0.8);
        this._actDot.fillCircle(162, 73, 4);
        if (isWorking) {
          this._actDot.fillStyle(0x66EE99, 0.2);
          this._actDot.fillCircle(162, 73, 7);
        }
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
      color: '#C0D0EE',
      wordWrap: { width: 280 },
      shadow: { offsetX: 0, offsetY: 1, color: '#00001122', blur: 2, fill: true },
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
    this._companionLayout = getCompanionLayout(gameSize.width, gameSize.height);
    if (this._companionMode) {
      this._drawCompanionView(this.time.now);
      if (this._localChar) {
        this._localChar.setPosition(this._companionLayout.character.x, this._companionLayout.character.y);
      }
      return;
    }
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
