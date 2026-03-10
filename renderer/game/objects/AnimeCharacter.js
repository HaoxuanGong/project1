/**
 * AnimeCharacter
 * A procedurally-drawn anime-style character rendered with Phaser Graphics.
 * Production-quality rendering with expressive eyes, hair highlights,
 * body outlines, and polished animations.
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
   * @param {object} options Rendering options
   */
  constructor(scene, x, y, color = '#e88', name = 'You', isLocal = true, options = {}) {
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
    this._hairSway = 0;
    this._gazeX = 0;
    this._gazeY = 0;
    this._deskPose = Boolean(options.deskPose);

    // Containers
    this.container = scene.add.container(x, y);
    this.container.setScale(options.scale || 1);
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);

    // Name tag (polished)
    this.nameTag = scene.add.text(0, -60, name, {
      fontSize: '11px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#E8EEFF',
      backgroundColor: '#1a2240cc',
      padding: { x: 6, y: 3 },
      align: 'center',
      shadow: { offsetX: 0, offsetY: 1, color: '#00001144', blur: 3, fill: true },
    }).setOrigin(0.5, 1);
    this.nameTag.setVisible(options.hideName !== true);
    this.container.add(this.nameTag);

    // Speech bubble (hidden by default)
    this._speechText = '';
    this._speechTimer = 0;
    this.speechBubble = scene.add.text(0, -78, '', {
      fontSize: '10px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#1a2040',
      backgroundColor: '#f0f4ffee',
      padding: { x: 7, y: 4 },
      align: 'center',
      wordWrap: { width: 130 },
      shadow: { offsetX: 0, offsetY: 2, color: '#00002222', blur: 4, fill: true },
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

    // Smooth bob animation
    if (this.state === 'idle') {
      this._bobOffset = Math.sin(this._tick / 900) * 1.8;
      this._armAngle = Math.sin(this._tick / 1400) * 0.08;
      this._hairSway = Math.sin(this._tick / 1100) * 0.9;
      this._gazeX = Math.sin(this._tick / 1700) * 0.7;
      this._gazeY = Math.cos(this._tick / 2100) * 0.35;
    } else if (this.state === 'working') {
      this._bobOffset = Math.sin(this._tick / 350) * 0.8;
      this._typingFrame = Math.floor(this._tick / 120) % 4;
      this._armAngle = (this._typingFrame < 2 ? 1 : -1) * 0.3;
      this._hairSway = Math.sin(this._tick / 420) * 0.7;
      this._gazeX = this._typingFrame < 2 ? 0.5 : -0.35;
      this._gazeY = 0.75;
    } else if (this.state === 'walk') {
      this._bobOffset = Math.abs(Math.sin(this._tick / 200)) * 2.5;
      this._armAngle = Math.sin(this._tick / 200) * 0.45;
      this._hairSway = Math.sin(this._tick / 260) * 1.2;
      this._gazeX = Math.sin(this._tick / 220) * 0.65;
      this._gazeY = 0.2;
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

  _lighten(hex, amount = 0x333333) {
    const n = this._hexToInt(hex);
    const r = Math.min(255, ((n >> 16) & 0xff) + ((amount >> 16) & 0xff));
    const g = Math.min(255, ((n >> 8) & 0xff) + ((amount >> 8) & 0xff));
    const b = Math.min(255, (n & 0xff) + (amount & 0xff));
    return (r << 16) | (g << 8) | b;
  }

  _darken(hex, amount = 0x222222) {
    const n = this._hexToInt(hex);
    const r = Math.max(0, ((n >> 16) & 0xff) - ((amount >> 16) & 0xff));
    const g = Math.max(0, ((n >> 8) & 0xff) - ((amount >> 8) & 0xff));
    const b = Math.max(0, (n & 0xff) - (amount & 0xff));
    return (r << 16) | (g << 8) | b;
  }

  _draw() {
    const g = this.graphics;
    g.clear();

    const bodyColor = this._hexToInt(this.color);
    const highlight = this._lighten(this.color);
    const shadow = this._darken(this.color);
    const skin = 0xFFDDBB;
    const skinDark = 0xEEBB99;
    const skinHighlight = 0xFFEED8;
    const white = 0xFFFFFF;
    const black = 0x111111;
    const outline = 0x222233;

    const bobY = this._bobOffset;
    const eyeOpen = this._blink === 0 || this._blink > 120;

    // ── Shadow (soft elliptical) ────────────────────────
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(0, this._deskPose ? 27 : 30, this._deskPose ? 26 : 32, this._deskPose ? 7 : 9);
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse(0, this._deskPose ? 27 : 30, this._deskPose ? 34 : 40, this._deskPose ? 10 : 12);

    // ── Legs ────────────────────────────────────────────
    const legSwing = this.state === 'walk' ? Math.sin(this._tick / 200) * 4 : 0;
    const legHeight = this._deskPose ? 10 : 14;
    const legY = this._deskPose ? 20 : 18;
    // Left leg
    g.fillStyle(shadow, 1);
    g.fillRoundedRect(-10, legY + bobY, 8, legHeight, 3);
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-10, legY + bobY, 7, legHeight - 1, 3);
    // Right leg
    g.fillStyle(shadow, 1);
    g.fillRoundedRect(2, legY + bobY + legSwing * 0.5, 8, legHeight, 3);
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(2, legY + bobY + legSwing * 0.5, 7, legHeight - 1, 3);
    // Shoes (polished)
    g.fillStyle(0x222233, 1);
    g.fillEllipse(-6, legY + legHeight + 4 + bobY, 11, 5);
    g.fillEllipse(6, legY + legHeight + 4 + bobY + legSwing * 0.5, 11, 5);
    // Shoe highlight
    g.fillStyle(0x444466, 0.5);
    g.fillEllipse(-6, legY + legHeight + 3 + bobY, 7, 3);
    g.fillEllipse(6, legY + legHeight + 3 + bobY + legSwing * 0.5, 7, 3);

    // ── Body ─────────────────────────────────────────────
    // Body outline
    g.fillStyle(outline, 0.3);
    g.fillRoundedRect(-13, -1 + bobY, 26, 22, 6);
    // Main body
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-12, 0 + bobY, 24, 20, 5);
    // Body highlight (top-left)
    g.fillStyle(highlight, 0.35);
    g.fillRoundedRect(-9, 2 + bobY, 9, 10, 3);
    // Body shadow (bottom-right)
    g.fillStyle(shadow, 0.2);
    g.fillRoundedRect(2, 10 + bobY, 9, 8, 3);
    // Collar detail
    g.fillStyle(highlight, 0.25);
    g.fillRoundedRect(-5, -1 + bobY, 10, 4, 2);

    // ── Arms ─────────────────────────────────────────────
    const aA = this._armAngle;
    // Left arm (shadow + main)
    g.fillStyle(shadow, 0.6);
    g.fillRoundedRect(-21 + (aA * 8), (this._deskPose ? 5 : 2) + bobY + Math.abs(aA) * 6, 11, 6, 3);
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-20 + (aA * 8), (this._deskPose ? 5 : 2) + bobY + Math.abs(aA) * 6, 10, 5, 2);
    // Right arm
    g.fillStyle(shadow, 0.6);
    g.fillRoundedRect(10 - (aA * 8), (this._deskPose ? 5 : 2) + bobY + Math.abs(aA) * 6, 11, 6, 3);
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(10 - (aA * 8), (this._deskPose ? 5 : 2) + bobY + Math.abs(aA) * 6, 10, 5, 2);

    // Hands
    g.fillStyle(skin, 1);
    g.fillCircle(-20 + (aA * 8), (this._deskPose ? 8 : 5) + bobY + Math.abs(aA) * 6, 4);
    g.fillCircle(24 - (aA * 8), (this._deskPose ? 8 : 5) + bobY + Math.abs(aA) * 6, 4);
    // Hand highlight
    g.fillStyle(skinHighlight, 0.5);
    g.fillCircle(-21 + (aA * 8), (this._deskPose ? 7 : 4) + bobY + Math.abs(aA) * 6, 2);
    g.fillCircle(23 - (aA * 8), (this._deskPose ? 7 : 4) + bobY + Math.abs(aA) * 6, 2);

    // ── Neck ─────────────────────────────────────────────
    g.fillStyle(skinDark, 1);
    g.fillRoundedRect(-4, -6 + bobY, 8, 8, 2);
    g.fillStyle(skin, 1);
    g.fillRoundedRect(-3, -6 + bobY, 6, 7, 2);

    // ── Head ─────────────────────────────────────────────
    // Head shadow
    g.fillStyle(skinDark, 0.6);
    g.fillCircle(1, -17 + bobY, 16);
    // Main head
    g.fillStyle(skin, 1);
    g.fillCircle(0, -18 + bobY, 16);
    // Face highlight
    g.fillStyle(skinHighlight, 0.3);
    g.fillCircle(-4, -22 + bobY, 8);

    // Cheeks (rosy)
    g.fillStyle(0xFFAABB, 0.4);
    g.fillEllipse(-10, -13 + bobY, 6, 4);
    g.fillEllipse(10, -13 + bobY, 6, 4);

    // ── Hair ─────────────────────────────────────────────
    // Hair shadow layer
    g.fillStyle(shadow, 0.7);
    g.fillCircle(1, -23 + bobY, 15);
    g.fillRect(-14, -27 + bobY, 30, 11);
    // Main hair
    g.fillStyle(bodyColor, 1);
    g.fillCircle(0, -24 + bobY, 14);
    g.fillRect(-14, -28 + bobY, 28, 10);
    // Side bangs
    g.fillRoundedRect(-16, -22 + bobY, 6, 14, 3);
    g.fillRoundedRect(10, -22 + bobY, 6, 14, 3);
    // Ahoge (cowlick) with highlight
    g.fillRoundedRect(-2 + this._hairSway * 0.4, -38 + bobY, 5, 12, 3);
    g.fillStyle(highlight, 0.45);
    g.fillRoundedRect(-1 + this._hairSway * 0.4, -37 + bobY, 3, 8, 2);
    // Hair highlight streaks
    g.fillStyle(highlight, 0.3);
    g.fillRoundedRect(-8 + this._hairSway * 0.25, -30 + bobY, 4, 6, 2);
    g.fillRoundedRect(5 + this._hairSway * 0.2, -29 + bobY, 3, 5, 2);
    // Hair front fringe detail
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-12, -26 + bobY, 8, 5, 2);
    g.fillRoundedRect(4, -26 + bobY, 8, 5, 2);

    // ── Eyes (large, expressive anime eyes) ──────────────
    if (eyeOpen) {
      // Eye whites (larger)
      g.fillStyle(white, 1);
      g.fillEllipse(-6, -17 + bobY, 9, 10);
      g.fillEllipse(6, -17 + bobY, 9, 10);

      // Iris (gradient effect via layering)
      g.fillStyle(0x3366CC, 1);
      g.fillCircle(-6, -16 + bobY, 4);
      g.fillCircle(6, -16 + bobY, 4);
      // Inner iris (lighter center)
      g.fillStyle(0x5588EE, 1);
      g.fillCircle(-6, -17 + bobY, 2.5);
      g.fillCircle(6, -17 + bobY, 2.5);
      // Pupil
      g.fillStyle(black, 1);
      g.fillCircle(-6 + this._gazeX, -16 + bobY + this._gazeY, 2);
      g.fillCircle(6 + this._gazeX, -16 + bobY + this._gazeY, 2);

      // Large highlight (top-right)
      g.fillStyle(white, 0.95);
      g.fillCircle(-4, -19 + bobY, 1.8);
      g.fillCircle(8, -19 + bobY, 1.8);
      // Small highlight (bottom-left)
      g.fillStyle(white, 0.6);
      g.fillCircle(-7, -15 + bobY, 0.8);
      g.fillCircle(5, -15 + bobY, 0.8);

      // Upper eyelid line
      g.lineStyle(1.2, outline, 0.5);
      g.beginPath();
      g.arc(-6, -18 + bobY, 5, -2.8, -0.3, false);
      g.strokePath();
      g.beginPath();
      g.arc(6, -18 + bobY, 5, -2.8, -0.3, false);
      g.strokePath();

      // Eyelashes (small marks on outer corner)
      g.lineStyle(1, outline, 0.35);
      g.beginPath(); g.moveTo(-11, -20 + bobY); g.lineTo(-12, -22 + bobY); g.strokePath();
      g.beginPath(); g.moveTo(11, -20 + bobY); g.lineTo(12, -22 + bobY); g.strokePath();
    } else {
      // Closed eye (cute curved lines)
      g.lineStyle(2, outline, 0.6);
      g.beginPath();
      g.arc(-6, -17 + bobY, 4, 0.2, Math.PI - 0.2, false);
      g.strokePath();
      g.beginPath();
      g.arc(6, -17 + bobY, 4, 0.2, Math.PI - 0.2, false);
      g.strokePath();
    }

    // ── Eyebrows ────────────────────────────────────────
    g.lineStyle(1.5, shadow, 0.5);
    g.beginPath();
    g.moveTo(-9, -23 + bobY);
    g.lineTo(-3, -24 + bobY);
    g.strokePath();
    g.beginPath();
    g.moveTo(3, -24 + bobY);
    g.lineTo(9, -23 + bobY);
    g.strokePath();

    // ── Nose (tiny) ─────────────────────────────────────
    g.fillStyle(skinDark, 0.3);
    g.fillCircle(0, -12 + bobY, 1);

    // ── Mouth ────────────────────────────────────────────
    if (this.state === 'working') {
      // Focused expression (small straight line)
      g.lineStyle(1.5, skinDark, 0.8);
      g.beginPath();
      g.moveTo(-2, -9 + bobY);
      g.lineTo(2, -9 + bobY);
      g.strokePath();
    } else {
      // Happy smile (wider arc)
      g.lineStyle(1.5, skinDark, 0.8);
      g.beginPath();
      g.arc(0, -10 + bobY, 4, 0.3, Math.PI - 0.3);
      g.strokePath();
      // Inner mouth highlight
      g.fillStyle(0xFF8899, 0.3);
      g.fillEllipse(0, -8.5 + bobY, 4, 2);
    }

    // ── Working accessory: detailed keyboard ─────────────
    if (this.state === 'working') {
      const kbY = 24 + bobY;
      // Keyboard base
      g.fillStyle(0xBBBBCC, 1);
      g.fillRoundedRect(-15, kbY, 30, 11, 2);
      // Keyboard top highlight
      g.fillStyle(0xDDDDEE, 0.6);
      g.fillRoundedRect(-14, kbY + 1, 28, 4, 1);
      // Key rows
      g.fillStyle(0x888899, 1);
      for (let kx = -12; kx <= 11; kx += 5) {
        g.fillRoundedRect(kx, kbY + 2, 4, 3, 1);
      }
      g.fillStyle(0x777788, 1);
      for (let kx = -10; kx <= 9; kx += 5) {
        g.fillRoundedRect(kx, kbY + 6, 4, 3, 1);
      }
      // Spacebar
      g.fillStyle(0x999AAA, 1);
      g.fillRoundedRect(-6, kbY + 6, 12, 3, 1);
    }
  }
}
