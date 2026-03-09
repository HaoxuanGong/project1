/**
 * MenuScene
 * Main menu – choose avatar name/colour, then Create or Join a room.
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

    // ── Background gradient ──────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    bg.fillRect(0, 0, width, height);

    // Subtle grid lines
    bg.lineStyle(1, 0x334466, 0.15);
    for (let gx = 0; gx < width; gx += 40) {
      bg.beginPath(); bg.moveTo(gx, 0); bg.lineTo(gx, height); bg.strokePath();
    }
    for (let gy = 0; gy < height; gy += 40) {
      bg.beginPath(); bg.moveTo(0, gy); bg.lineTo(width, gy); bg.strokePath();
    }

    // ── Title ────────────────────────────────────────────────────────────────
    this.add.text(cx, 80, '🏢 Office Buddy', {
      fontSize: '36px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#E0E0FF',
      stroke: '#334488',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 120, 'Your animated office companion', {
      fontSize: '14px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#8899CC',
    }).setOrigin(0.5);

    // ── Input fields ─────────────────────────────────────────────────────────
    const panelW = 360;
    const panelX = cx - panelW / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0xFFFFFF, 0.05);
    panel.fillRoundedRect(panelX, 160, panelW, 400, 12);
    panel.lineStyle(1, 0x445588, 0.6);
    panel.strokeRoundedRect(panelX, 160, panelW, 400, 12);

    // Name label + DOM input
    this.add.text(panelX + 20, 188, 'Your Name', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#99AACC',
    });

    this._nameInput = this.add.dom(cx, 220).createFromHTML(
      `<input type="text" id="player-name" maxlength="20"
              placeholder="Enter your name"
              style="width:280px;padding:8px 12px;border-radius:6px;
                     border:1px solid #445588;background:#0d1b3e;
                     color:#ddeeff;font-size:14px;outline:none;" />`
    );

    // Avatar colour picker
    this.add.text(panelX + 20, 258, 'Avatar Colour', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#99AACC',
    });

    this._colors = ['#E88888', '#88E888', '#8888E8', '#E8E888', '#E888E8', '#88E8E8', '#E8AA66'];
    this._selectedColor = this._colors[0];

    this._colorSwatches = this._colors.map((col, i) => {
      const sw = this.add.graphics();
      const sx = panelX + 20 + i * 44;
      const sy = 278;
      sw.fillStyle(parseInt(col.replace('#', ''), 16), 1);
      sw.fillCircle(sx + 14, sy + 14, 14);
      sw.setInteractive(new Phaser.Geom.Circle(sx + 14, sy + 14, 14), Phaser.Geom.Circle.Contains);
      sw.on('pointerdown', () => {
        this._selectedColor = col;
        this._highlightSwatch(i);
      });
      sw.on('pointerover', () => sw.setAlpha(0.8));
      sw.on('pointerout', () => sw.setAlpha(1));
      return sw;
    });
    this._highlightSwatch(0);

    // Room code label + DOM input
    this.add.text(panelX + 20, 330, 'Room Code  (leave blank to create new)', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#99AACC',
    });

    this._roomInput = this.add.dom(cx, 362).createFromHTML(
      `<input type="text" id="room-code" maxlength="6"
              placeholder="e.g. A1B2C3"
              style="width:280px;padding:8px 12px;border-radius:6px;
                     border:1px solid #445588;background:#0d1b3e;
                     color:#ddeeff;font-size:14px;outline:none;
                     text-transform:uppercase;" />`
    );

    // ── Status text ──────────────────────────────────────────────────────────
    this._statusText = this.add.text(cx, 400, '', {
      fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#FF8888',
    }).setOrigin(0.5);

    // ── Play button ──────────────────────────────────────────────────────────
    const btn = this._makeButton(cx, 450, 'Enter Office', '#334488', '#5566BB');
    btn.on('pointerdown', () => this._onEnter());

    // ── Footer ───────────────────────────────────────────────────────────────
    this.add.text(cx, height - 20, 'Cross-platform • Multiplayer • Extensible', {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#445566',
    }).setOrigin(0.5);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _highlightSwatch(idx) {
    this._colorSwatches.forEach((sw, i) => sw.setAlpha(i === idx ? 1 : 0.5));
  }

  _makeButton(x, y, label, normalBg, hoverBg) {
    const btnBg = this.add.graphics();
    const btnW = 200, btnH = 44;
    const draw = (col) => {
      btnBg.clear();
      btnBg.fillStyle(parseInt(col.replace('#', ''), 16), 1);
      btnBg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 8);
    };
    draw(normalBg);
    btnBg.setInteractive(new Phaser.Geom.Rectangle(x - btnW / 2, y - btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains);
    btnBg.on('pointerover', () => draw(hoverBg));
    btnBg.on('pointerout', () => draw(normalBg));

    this.add.text(x, y, label, {
      fontSize: '16px', fontFamily: 'Segoe UI, sans-serif', color: '#DDEEFF',
    }).setOrigin(0.5);

    return btnBg;
  }

  async _onEnter() {
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
      });
    } catch (err) {
      this._statusText.setText('Could not connect to server. Is it running?');
      console.error(err);
    }
  }
}
