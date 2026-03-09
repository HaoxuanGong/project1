/**
 * AnimeCharacter
 * A procedurally-drawn anime-style character rendered with Phaser Graphics.
 * States:  'idle' | 'working' | 'walk'
 */
export class AnimeCharacter {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x        Initial screen X
   * @param {number} y        Initial screen Y
   * @param {string} color    Hex body/hair colour  (e.g. '#e88')
   * @param {string} name     Display name
   * @param {boolean} isLocal Whether this is the local player's character
   */
  constructor(scene, x, y, color = '#e88', name = 'You', isLocal = true) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.color = color;
    this.name = name;
    this.isLocal = isLocal;
    this.state = 'idle';

    // Animation counters
    this._tick = 0;
    this._typingFrame = 0;
    this._bobOffset = 0;
    this._armAngle = 0;
    this._blink = 0;
    this._blinkTimer = 0;

    // Containers
    this.container = scene.add.container(x, y);
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);

    // Name tag
    this.nameTag = scene.add.text(0, -56, name, {
      fontSize: '11px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
      align: 'center',
    }).setOrigin(0.5, 1);
    this.container.add(this.nameTag);

    // Speech bubble (hidden by default)
    this._speechText = '';
    this._speechTimer = 0;
    this.speechBubble = scene.add.text(0, -72, '', {
      fontSize: '10px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#222222',
      backgroundColor: '#ffffffee',
      padding: { x: 5, y: 3 },
      align: 'center',
      wordWrap: { width: 120 },
    }).setOrigin(0.5, 1).setVisible(false);
    this.container.add(this.speechBubble);

    this._draw();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this._typingFrame = 0;
    }
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
  }

  say(text, durationMs = 3000) {
    this._speechText = text;
    this._speechTimer = durationMs;
    this.speechBubble.setText(text).setVisible(true);
  }

  /**
   * Call from the scene's update loop.
   * @param {number} delta  Time delta in ms
   */
  update(delta) {
    this._tick += delta;
    this._blinkTimer += delta;

    // Bob animation
    if (this.state === 'idle') {
      this._bobOffset = Math.sin(this._tick / 800) * 2;
      this._armAngle = Math.sin(this._tick / 1200) * 0.1;
    } else if (this.state === 'working') {
      this._bobOffset = Math.sin(this._tick / 300) * 1;
      this._typingFrame = Math.floor(this._tick / 120) % 4;
      this._armAngle = (this._typingFrame < 2 ? 1 : -1) * 0.35;
    } else if (this.state === 'walk') {
      this._bobOffset = Math.abs(Math.sin(this._tick / 200)) * 3;
      this._armAngle = Math.sin(this._tick / 200) * 0.5;
    }

    // Blinking every ~3 s
    if (this._blinkTimer > 3000 + Math.random() * 1000) {
      this._blink = 1;
      this._blinkTimer = 0;
    }
    if (this._blink > 0) {
      this._blink += delta;
      if (this._blink > 150) this._blink = 0;
    }

    // Speech bubble timer
    if (this._speechTimer > 0) {
      this._speechTimer -= delta;
      if (this._speechTimer <= 0) {
        this.speechBubble.setVisible(false);
        this._speechText = '';
      }
    }

    this._draw();
  }

  destroy() {
    this.container.destroy();
  }

  // ─── Private drawing ───────────────────────────────────────────────────────

  _hexToInt(hex) {
    return parseInt(hex.replace('#', ''), 16);
  }

  _lighten(hex, amount = 0x222222) {
    const n = this._hexToInt(hex);
    const r = Math.min(255, ((n >> 16) & 0xff) + ((amount >> 16) & 0xff));
    const g = Math.min(255, ((n >> 8) & 0xff) + ((amount >> 8) & 0xff));
    const b = Math.min(255, (n & 0xff) + (amount & 0xff));
    return (r << 16) | (g << 8) | b;
  }

  _draw() {
    const g = this.graphics;
    g.clear();

    const bodyColor = this._hexToInt(this.color);
    const highlight = this._lighten(this.color);
    const skin = 0xFFD9B3;
    const skinDark = 0xEEC49A;
    const white = 0xFFFFFF;
    const black = 0x111111;

    const bobY = this._bobOffset;
    const eyeOpen = this._blink === 0 || this._blink > 120;

    // ── Shadow ──────────────────────────────────────────
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(0, 28, 28, 8);

    // ── Legs ────────────────────────────────────────────
    const legSwing = this.state === 'walk' ? Math.sin(this._tick / 200) * 4 : 0;
    // Left leg
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-10, 18 + bobY, 8, 14, 3);
    // Right leg
    g.fillRoundedRect(2, 18 + bobY + legSwing * 0.5, 8, 14, 3);
    // Shoes
    g.fillStyle(black, 1);
    g.fillEllipse(-6, 32 + bobY, 10, 5);
    g.fillEllipse(6, 32 + bobY + legSwing * 0.5, 10, 5);

    // ── Body ─────────────────────────────────────────────
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-12, 0 + bobY, 24, 20, 5);

    // Body highlight
    g.fillStyle(highlight, 0.4);
    g.fillRoundedRect(-9, 2 + bobY, 8, 10, 3);

    // ── Arms ─────────────────────────────────────────────
    const aA = this._armAngle;
    // Left arm
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-20 + (aA * 8), 2 + bobY + Math.abs(aA) * 6, 10, 5, 2);
    // Right arm  
    g.fillRoundedRect(10 - (aA * 8), 2 + bobY + Math.abs(aA) * 6, 10, 5, 2);

    // Hands
    g.fillStyle(skin, 1);
    g.fillCircle(-20 + (aA * 8), 5 + bobY + Math.abs(aA) * 6, 4);
    g.fillCircle(24 - (aA * 8), 5 + bobY + Math.abs(aA) * 6, 4);

    // ── Neck ─────────────────────────────────────────────
    g.fillStyle(skin, 1);
    g.fillRoundedRect(-4, -6 + bobY, 8, 8, 2);

    // ── Head ─────────────────────────────────────────────
    g.fillStyle(skin, 1);
    g.fillCircle(0, -18 + bobY, 16);

    // Cheeks
    g.fillStyle(0xFFAABB, 0.5);
    g.fillCircle(-9, -14 + bobY, 5);
    g.fillCircle(9, -14 + bobY, 5);

    // ── Hair ─────────────────────────────────────────────
    g.fillStyle(bodyColor, 1);
    // Main hair
    g.fillCircle(0, -24 + bobY, 14);
    g.fillRect(-14, -28 + bobY, 28, 10);
    // Side bangs
    g.fillRoundedRect(-16, -22 + bobY, 6, 14, 3);
    g.fillRoundedRect(10, -22 + bobY, 6, 14, 3);
    // Ahoge (cowlick)
    g.fillRoundedRect(-2, -38 + bobY, 5, 12, 3);

    // ── Eyes ─────────────────────────────────────────────
    if (eyeOpen) {
      // Whites
      g.fillStyle(white, 1);
      g.fillEllipse(-6, -18 + bobY, 7, 8);
      g.fillEllipse(6, -18 + bobY, 7, 8);
      // Iris
      g.fillStyle(0x4488FF, 1);
      g.fillCircle(-6, -17 + bobY, 3);
      g.fillCircle(6, -17 + bobY, 3);
      // Pupil
      g.fillStyle(black, 1);
      g.fillCircle(-6, -17 + bobY, 1.5);
      g.fillCircle(6, -17 + bobY, 1.5);
      // Highlight
      g.fillStyle(white, 1);
      g.fillCircle(-5, -18 + bobY, 1);
      g.fillCircle(7, -18 + bobY, 1);
    } else {
      // Closed eye lines
      g.lineStyle(1.5, black, 1);
      g.beginPath();
      g.moveTo(-9, -18 + bobY);
      g.lineTo(-3, -17 + bobY);
      g.strokePath();
      g.beginPath();
      g.moveTo(3, -17 + bobY);
      g.lineTo(9, -18 + bobY);
      g.strokePath();
    }

    // ── Mouth ────────────────────────────────────────────
    if (this.state === 'working') {
      // Focused expression
      g.lineStyle(1.5, skinDark, 1);
      g.beginPath();
      g.moveTo(-3, -10 + bobY);
      g.lineTo(3, -10 + bobY);
      g.strokePath();
    } else {
      // Smile
      g.lineStyle(1.5, skinDark, 1);
      g.beginPath();
      g.arc(0, -11 + bobY, 3.5, 0.2, Math.PI - 0.2);
      g.strokePath();
    }

    // ── Working accessory: small keyboard when typing ─────
    if (this.state === 'working') {
      const kbY = 24 + bobY;
      g.fillStyle(0xCCCCDD, 1);
      g.fillRoundedRect(-14, kbY, 28, 10, 2);
      g.fillStyle(0x888899, 1);
      for (let kx = -11; kx <= 10; kx += 5) {
        g.fillRoundedRect(kx, kbY + 2, 4, 3, 1);
        if (Math.random() > 0.5) {
          g.fillStyle(0x666677, 1);
          g.fillRoundedRect(kx, kbY + 2, 4, 3, 1);
          g.fillStyle(0x888899, 1);
        }
      }
    }
  }
}
