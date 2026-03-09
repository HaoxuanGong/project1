/**
 * MenuScene
 * Main menu – choose avatar name/colour, then Create or Join a room.
 * Production-quality UI with animated background, polished inputs, and
 * frosted-glass panel aesthetic.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    // Nothing to load – everything is drawn procedurally
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;

    if (window.electronAPI?.setWindowMode) {
      window.electronAPI.setWindowMode('office').catch(() => {});
    }

    // ── Background gradient (deep rich tones) ────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x141428, 0x0c1225, 1);
    bg.fillRect(0, 0, width, height);

    // Subtle grid overlay (finer pitch, softer)
    bg.lineStyle(1, 0x2a3a5a, 0.08);
    for (let gx = 0; gx < width; gx += 48) {
      bg.beginPath(); bg.moveTo(gx, 0); bg.lineTo(gx, height); bg.strokePath();
    }
    for (let gy = 0; gy < height; gy += 48) {
      bg.beginPath(); bg.moveTo(0, gy); bg.lineTo(width, gy); bg.strokePath();
    }

    // Ambient glow behind panel
    const glow = this.add.graphics();
    glow.fillStyle(0x3355AA, 0.06);
    glow.fillCircle(cx, height * 0.45, 280);
    glow.fillStyle(0x6644CC, 0.04);
    glow.fillCircle(cx - 100, height * 0.3, 180);

    // ── Floating particles ───────────────────────────────────────────────────
    this._particles = [];
    for (let i = 0; i < 24; i++) {
      const p = this.add.graphics();
      const size = 1 + Math.random() * 2.5;
      const alpha = 0.1 + Math.random() * 0.25;
      p.fillStyle(0x6688DD, alpha);
      p.fillCircle(0, 0, size);
      p.setPosition(Math.random() * width, Math.random() * height);
      p.setDepth(1);
      this._particles.push({
        g: p,
        speed: 0.15 + Math.random() * 0.3,
        drift: (Math.random() - 0.5) * 0.4,
      });
    }

    // ── Title ────────────────────────────────────────────────────────────────
    // Glow behind title
    const titleGlow = this.add.graphics();
    titleGlow.fillStyle(0x4466BB, 0.12);
    titleGlow.fillEllipse(cx, 80, 340, 60);

    this._title = this.add.text(cx, 72, '🏢  Office Buddy', {
      fontSize: '38px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#E8EEFF',
      stroke: '#1a2a55',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 2, color: '#000022', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(5);

    this.add.text(cx, 116, 'Your animated office companion', {
      fontSize: '14px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#7788BB',
      shadow: { offsetX: 0, offsetY: 1, color: '#00001188', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(5);

    // Decorative line under subtitle
    const accent = this.add.graphics();
    accent.fillGradientStyle(0x0a0a1a, 0x5577DD, 0x5577DD, 0x0a0a1a, 0, 1, 1, 0);
    accent.fillRect(cx - 120, 136, 240, 1);
    accent.setDepth(5);

    // ── Panel (frosted glass effect) ─────────────────────────────────────────
    const panelW = 380;
    const panelX = cx - panelW / 2;
    const panelY = 156;
    const panelH = 458;

    const panel = this.add.graphics();
    // Outer glow
    panel.fillStyle(0x3355AA, 0.04);
    panel.fillRoundedRect(panelX - 6, panelY - 6, panelW + 12, panelH + 12, 18);
    // Main panel background
    panel.fillStyle(0x1a2240, 0.55);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
    // Top highlight (glass reflection)
    panel.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.06, 0.06, 0, 0);
    panel.fillRoundedRect(panelX + 2, panelY + 2, panelW - 4, panelH / 3, { tl: 14, tr: 14, bl: 0, br: 0 });
    // Border
    panel.lineStyle(1, 0x4466AA, 0.35);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);
    panel.setDepth(4);

    // Name label + DOM input
    this.add.text(panelX + 24, 186, 'YOUR NAME', {
      fontSize: '10px', fontFamily: 'Segoe UI, sans-serif', color: '#8899CC',
      letterSpacing: 2,
    }).setDepth(5);

    this._nameInput = this.add.dom(cx, 222).createFromHTML(
      `<input type="text" id="player-name" maxlength="20"
              placeholder="Enter your name"
              style="width:300px;padding:10px 14px;border-radius:8px;
                     border:1px solid rgba(80,110,180,0.4);
                     background:rgba(10,16,35,0.7);
                     color:#ddeeff;font-size:14px;outline:none;
                     font-family:'Segoe UI',sans-serif;
                     transition:border-color 0.2s, box-shadow 0.2s;"
              onfocus="this.style.borderColor='rgba(100,140,255,0.6)';this.style.boxShadow='0 0 12px rgba(80,120,255,0.15)'"
              onblur="this.style.borderColor='rgba(80,110,180,0.4)';this.style.boxShadow='none'" />`
    ).setDepth(6);

    // Avatar colour picker
    this.add.text(panelX + 24, 260, 'AVATAR COLOUR', {
      fontSize: '10px', fontFamily: 'Segoe UI, sans-serif', color: '#8899CC',
      letterSpacing: 2,
    }).setDepth(5);

    this._colors = ['#E06060', '#50C878', '#5B8DEF', '#E8C840', '#C86BDB', '#48D1CC', '#E8875A'];
    this._selectedColor = this._colors[0];

    this._selRing = this.add.graphics().setDepth(6);

    this._colorSwatches = this._colors.map((col, i) => {
      const sw = this.add.graphics();
      const sx = panelX + 26 + i * 46;
      const sy = 284;
      // Outer shadow
      sw.fillStyle(parseInt(col.replace('#', ''), 16), 0.25);
      sw.fillCircle(sx + 14, sy + 14, 17);
      // Main swatch
      sw.fillStyle(parseInt(col.replace('#', ''), 16), 1);
      sw.fillCircle(sx + 14, sy + 14, 13);
      // Highlight dot
      sw.fillStyle(0xFFFFFF, 0.3);
      sw.fillCircle(sx + 10, sy + 10, 4);
      sw.setInteractive(new Phaser.Geom.Circle(sx + 14, sy + 14, 16), Phaser.Geom.Circle.Contains);
      sw.on('pointerdown', () => {
        this._selectedColor = col;
        this._highlightSwatch(i);
      });
      sw.on('pointerover', () => sw.setAlpha(0.85));
      sw.on('pointerout', () => sw.setAlpha(1));
      sw.setDepth(5);
      return sw;
    });
    this._highlightSwatch(0);

    // Room code label + DOM input
    this.add.text(panelX + 24, 330, 'ROOM CODE', {
      fontSize: '10px', fontFamily: 'Segoe UI, sans-serif', color: '#8899CC',
      letterSpacing: 2,
    }).setDepth(5);
    this.add.text(panelX + 110, 330, '(leave blank to create new)', {
      fontSize: '10px', fontFamily: 'Segoe UI, sans-serif', color: '#556688',
    }).setDepth(5);

    this._roomInput = this.add.dom(cx, 366).createFromHTML(
      `<input type="text" id="room-code" maxlength="6"
              placeholder="e.g. A1B2C3"
              style="width:300px;padding:10px 14px;border-radius:8px;
                     border:1px solid rgba(80,110,180,0.4);
                     background:rgba(10,16,35,0.7);
                     color:#ddeeff;font-size:14px;outline:none;
                     font-family:'Segoe UI',sans-serif;
                     text-transform:uppercase;
                     transition:border-color 0.2s, box-shadow 0.2s;"
              onfocus="this.style.borderColor='rgba(100,140,255,0.6)';this.style.boxShadow='0 0 12px rgba(80,120,255,0.15)'"
              onblur="this.style.borderColor='rgba(80,110,180,0.4)';this.style.boxShadow='none'" />`
    ).setDepth(6);

    // ── Status text ──────────────────────────────────────────────────────────
    this._statusText = this.add.text(cx, 404, '', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#FF7777',
    }).setOrigin(0.5).setDepth(6);

    // ── Play button ──────────────────────────────────────────────────────────
    const btn = this._makeButton(cx, 452, '▶  Enter Office', '#2a4080', '#3a5ab0');
    btn.on('pointerdown', () => this._onEnter('office'));

    const companionBtn = this._makeButton(cx, 514, '☕  Desktop Buddy Mode', '#355f7d', '#4a7ea8');
    companionBtn.on('pointerdown', () => this._onEnter('companion'));

    this.add.text(cx, 548, 'Launch a focused bottom-right desk companion with the rest of the office hidden.', {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#6f84ae', align: 'center',
      wordWrap: { width: 300 },
    }).setOrigin(0.5).setDepth(6);

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerLine = this.add.graphics();
    footerLine.fillGradientStyle(0x0a0a1a, 0x3a4a6a, 0x3a4a6a, 0x0a0a1a, 0, 0.5, 0.5, 0);
    footerLine.fillRect(cx - 160, height - 36, 320, 1);
    footerLine.setDepth(5);

    this.add.text(cx, height - 18, 'Cross-platform  •  Multiplayer  •  Extensible', {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#3d4d6d',
    }).setOrigin(0.5).setDepth(5);
  }

  update(time) {
    // Animate floating particles
    const { width, height } = this.scale;
    for (const p of this._particles) {
      const g = p.g;
      g.y -= p.speed;
      g.x += p.drift;
      if (g.y < -10) { g.y = height + 10; g.x = Math.random() * width; }
      if (g.x < -10) g.x = width + 10;
      if (g.x > width + 10) g.x = -10;
    }
    // Subtle title bob
    if (this._title) {
      this._title.y = 72 + Math.sin(time / 1200) * 2;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _highlightSwatch(idx) {
    this._colorSwatches.forEach((sw, i) => sw.setAlpha(i === idx ? 1 : 0.55));
    // Draw selection ring
    const panelX = this.scale.width / 2 - 380 / 2;
    const sx = panelX + 26 + idx * 46;
    const sy = 284;
    this._selRing.clear();
    this._selRing.lineStyle(2.5, 0xFFFFFF, 0.9);
    this._selRing.strokeCircle(sx + 14, sy + 14, 17);
  }

  _makeButton(x, y, label, normalBg, hoverBg) {
    const btnBg = this.add.graphics();
    const btnW = 220, btnH = 48;
    const draw = (col, glow) => {
      btnBg.clear();
      if (glow) {
        btnBg.fillStyle(parseInt(col.replace('#', ''), 16), 0.2);
        btnBg.fillRoundedRect(x - btnW / 2 - 4, y - btnH / 2 - 4, btnW + 8, btnH + 8, 14);
      }
      btnBg.fillStyle(parseInt(col.replace('#', ''), 16), 1);
      btnBg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 10);
      // Top highlight
      btnBg.fillStyle(0xFFFFFF, 0.08);
      btnBg.fillRoundedRect(x - btnW / 2 + 2, y - btnH / 2 + 2, btnW - 4, btnH / 2 - 2, { tl: 10, tr: 10, bl: 0, br: 0 });
    };
    draw(normalBg, false);
    btnBg.setInteractive(new Phaser.Geom.Rectangle(x - btnW / 2, y - btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains);
    btnBg.on('pointerover', () => draw(hoverBg, true));
    btnBg.on('pointerout', () => draw(normalBg, false));
    btnBg.setDepth(5);

    this.add.text(x, y, label, {
      fontSize: '16px', fontFamily: 'Segoe UI, sans-serif', color: '#E0EAFF',
      shadow: { offsetX: 0, offsetY: 1, color: '#000033', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(6);

    return btnBg;
  }

  async _onEnter(displayMode = 'office') {
    const nameEl = document.getElementById('player-name');
    const codeEl = document.getElementById('room-code');
    const name = (nameEl ? nameEl.value.trim() : '') || 'Player';
    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';

    this._statusText.setText('Connecting…');

    try {
      const serverUrl = window.electronAPI
        ? await window.electronAPI.getServerUrl()
        : 'http://localhost:3000';

      this.scene.start('OfficeScene', {
        serverUrl,
        playerName: name,
        avatarColor: this._selectedColor,
        roomCode: code,
        displayMode,
      });
    } catch (err) {
      this._statusText.setText('Could not connect to server. Is it running?');
      console.error(err);
    }
  }
}
