/**
 * FurnitureManager
 * Loads furniture definitions from data/furniture.json and renders each piece
 * as an isometric 3-D box (or wall-mounted item) using Phaser Graphics.
 *
 * Extensibility: add new entries to data/furniture.json – no code changes needed
 * for basic furniture.  Custom renderers can be registered with addRenderer().
 */
import { IsoHelper } from './IsoHelper.js';

export class FurnitureManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {IsoHelper}    iso
   * @param {object[]}     definitions   Array loaded from furniture.json
   */
  constructor(scene, iso, definitions = []) {
    this.scene = scene;
    this.iso = iso;
    this.definitions = [...definitions];

    /** Custom per-type renderers registered via addRenderer() */
    this._renderers = new Map();

    /** Phaser containers, one per furniture item, keyed by id */
    this._objects = new Map();

    // Built-in special renderers
    this._registerBuiltins();
    this._buildAll();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a custom draw function for a furniture type.
   * @param {string}   type      Furniture type string (e.g. 'plant')
   * @param {Function} renderer  (graphics, def, iso) => void
   */
  addRenderer(type, renderer) {
    this._renderers.set(type, renderer);
  }

  /**
   * Replace the full furniture list (e.g. after receiving a server update).
   * @param {object[]} newDefs
   */
  applyDefinitions(newDefs) {
    // Remove old objects
    for (const [, obj] of this._objects) obj.destroy();
    this._objects.clear();
    this.definitions = [...newDefs];
    this._buildAll();
  }

  /**
   * Add a single new furniture item at runtime.
   * @param {object} def  Furniture definition object
   */
  addItem(def) {
    this.definitions.push(def);
    this._buildOne(def);
  }

  /** Return depth-sorted array of all Phaser containers. */
  getContainers() {
    return Array.from(this._objects.values());
  }

  destroy() {
    for (const [, obj] of this._objects) obj.destroy();
    this._objects.clear();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _buildAll() {
    // Sort definitions by iso depth so back items render first
    const sorted = [...this.definitions].sort(
      (a, b) => this.iso.depthOf(a.isoX, a.isoY) - this.iso.depthOf(b.isoX, b.isoY)
    );
    for (const def of sorted) this._buildOne(def);
  }

  _buildOne(def) {
    const g = this.scene.add.graphics();
    const origin = this.iso.toScreen(def.isoX, def.isoY, 0);

    const tileW = this.iso.tileW;
    const tileH = this.iso.tileH;

    if (this._renderers.has(def.type)) {
      this._renderers.get(def.type)(g, def, this.iso);
    } else {
      this._drawIsoBox(g, origin, def, tileW, tileH);
    }

    // Depth value for layering
    g.setDepth(this.iso.depthOf(def.isoX, def.isoY) * 10 + 5);
    this._objects.set(def.id, g);
  }

  /**
   * Draw a polished isometric box for a furniture piece with edge highlights
   * and shadow detail for a production-quality look.
   */
  _drawIsoBox(g, origin, def, tileW, tileH) {
    const { x, y } = origin;
    const w = def.width || 1;
    const d = def.depth || 1;
    const h = (def.height || 1) * tileH;

    // Skip wall-mounted items for now (they're drawn separately)
    if (def.wallMounted) {
      this._drawWallItem(g, origin, def, tileW, tileH);
      return;
    }

    const mainColor = this._hex(def.color || '#888888');
    const topColor = this._hex(def.topColor || def.color || '#aaaaaa');
    const sideL = this._darken(mainColor, 0x1a1a1a);
    const sideR = this._darken(mainColor, 0x333333);
    const edgeHighlight = this._lighten(mainColor, 0x222222);
    const edgeShadow = this._darken(mainColor, 0x444444);

    // Bottom-left corner of the top face in screen space
    const hw = (tileW / 2) * w;
    const hd = (tileH / 2) * d;
    const hwD = (tileW / 2) * d;
    const hdW = (tileH / 2) * w;

    // Top-face corners (diamond)
    const topFront = { x: x, y: y };
    const topRight = { x: x + hw, y: y - hd + hdW };
    const topBack = { x: x + hw - hwD, y: y - hd };
    const topLeft = { x: x - hwD, y: y + hdW - hd };

    // Front-bottom face
    const botFront = { x: topFront.x, y: topFront.y + h };
    const botRight = { x: topRight.x, y: topRight.y + h };
    const botLeft = { x: topLeft.x, y: topLeft.y + h };

    // Ground shadow
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse(topFront.x, botFront.y + 3, hw * 1.6, 6);

    // Right visible face (south-east)
    g.fillStyle(sideR, 1);
    g.beginPath();
    g.moveTo(topFront.x, topFront.y);
    g.lineTo(topRight.x, topRight.y);
    g.lineTo(botRight.x, botRight.y);
    g.lineTo(botFront.x, botFront.y);
    g.closePath();
    g.fillPath();

    // Left visible face (south-west)
    g.fillStyle(sideL, 1);
    g.beginPath();
    g.moveTo(topFront.x, topFront.y);
    g.lineTo(topLeft.x, topLeft.y);
    g.lineTo(botLeft.x, botLeft.y);
    g.lineTo(botFront.x, botFront.y);
    g.closePath();
    g.fillPath();

    // Top face
    g.fillStyle(topColor, 1);
    g.beginPath();
    g.moveTo(topFront.x, topFront.y);
    g.lineTo(topLeft.x, topLeft.y);
    g.lineTo(topBack.x, topBack.y);
    g.lineTo(topRight.x, topRight.y);
    g.closePath();
    g.fillPath();

    // Top face highlight (subtle light reflection)
    g.fillStyle(0xFFFFFF, 0.08);
    g.beginPath();
    g.moveTo(topFront.x, topFront.y);
    g.lineTo(topLeft.x, topLeft.y);
    g.lineTo(topBack.x, topBack.y);
    g.lineTo(topRight.x, topRight.y);
    g.closePath();
    g.fillPath();

    // Edge highlights (front-left edge = bright, front-right = darker)
    g.lineStyle(1, edgeHighlight, 0.4);
    g.beginPath();
    g.moveTo(topLeft.x, topLeft.y);
    g.lineTo(topFront.x, topFront.y);
    g.strokePath();
    // Front vertical edge
    g.lineStyle(0.5, edgeShadow, 0.3);
    g.beginPath();
    g.moveTo(topFront.x, topFront.y);
    g.lineTo(botFront.x, botFront.y);
    g.strokePath();
    // Top face outline (very subtle)
    g.lineStyle(0.5, 0x000000, 0.12);
    g.beginPath();
    g.moveTo(topFront.x, topFront.y);
    g.lineTo(topLeft.x, topLeft.y);
    g.lineTo(topBack.x, topBack.y);
    g.lineTo(topRight.x, topRight.y);
    g.closePath();
    g.strokePath();

    // Draw on-top items (computer, lamp, etc.)
    if (Array.isArray(def.items)) {
      this._drawTopItems(g, def.items, topBack, topFront, tileW, tileH, h);
    }
  }

  /** Render polished items sitting on top of furniture (computer, lamp…). */
  _drawTopItems(g, items, topBack, topFront, tileW, tileH, boxH) {
    const cx = (topBack.x + topFront.x) / 2;
    const cy = (topBack.y + topFront.y) / 2 - boxH;

    for (const item of items) {
      if (item === 'computer') {
        // Monitor (polished)
        g.fillStyle(0x1a1a2a, 1);
        g.fillRoundedRect(cx - 11, cy - 28, 22, 18, 2);
        // Screen (gradient-like via layering)
        g.fillStyle(0x1a2844, 1);
        g.fillRoundedRect(cx - 9, cy - 26, 18, 14, 1);
        // Screen glow
        g.fillStyle(0x3355AA, 0.3);
        g.fillRoundedRect(cx - 9, cy - 26, 18, 14, 1);
        // Screen highlight line
        g.fillStyle(0x5588CC, 0.4);
        g.fillRect(cx - 7, cy - 24, 14, 1);
        g.fillStyle(0x5588CC, 0.2);
        g.fillRect(cx - 7, cy - 20, 10, 1);
        g.fillRect(cx - 7, cy - 17, 6, 1);
        // Screen reflection (top-left)
        g.fillStyle(0xFFFFFF, 0.06);
        g.fillRoundedRect(cx - 9, cy - 26, 9, 7, 1);
        // Stand
        g.fillStyle(0x3a3a4a, 1);
        g.fillRect(cx - 2, cy - 10, 4, 6);
        g.fillRoundedRect(cx - 7, cy - 4, 14, 3, 1);
        // Stand highlight
        g.fillStyle(0x555566, 0.5);
        g.fillRect(cx - 6, cy - 4, 12, 1);
        // Keyboard
        g.fillStyle(0x999AAA, 1);
        g.fillRoundedRect(cx - 11, cy + 2, 22, 7, 1);
        // Keyboard keys
        g.fillStyle(0x777788, 1);
        for (let kx = -9; kx <= 8; kx += 4) {
          g.fillRoundedRect(cx + kx, cy + 3, 3, 2, 0.5);
        }
        g.fillStyle(0x888899, 1);
        g.fillRoundedRect(cx - 5, cy + 6, 10, 2, 0.5);
      } else if (item === 'lamp') {
        // Lamp base & pole
        g.fillStyle(0x777766, 1);
        g.fillRect(cx + 6, cy - 22, 3, 22);
        // Pole highlight
        g.fillStyle(0x999988, 0.5);
        g.fillRect(cx + 6, cy - 22, 1, 22);
        // Base
        g.fillStyle(0x666655, 1);
        g.fillRoundedRect(cx + 3, cy, 9, 3, 1);
        // Shade (warmer tone)
        g.fillStyle(0xFFDD88, 0.9);
        g.fillTriangle(cx + 2, cy - 30, cx + 15, cy - 30, cx + 8, cy - 22);
        // Shade highlight
        g.fillStyle(0xFFEEBB, 0.4);
        g.fillTriangle(cx + 4, cy - 29, cx + 10, cy - 29, cx + 7, cy - 23);
        // Light glow (warm, layered)
        g.fillStyle(0xFFEE88, 0.08);
        g.fillCircle(cx + 8, cy - 18, 18);
        g.fillStyle(0xFFEE88, 0.12);
        g.fillCircle(cx + 8, cy - 22, 10);
        // Light cone on desk surface
        g.fillStyle(0xFFEE88, 0.05);
        g.fillEllipse(cx + 8, cy + 2, 20, 8);
      }
    }
  }

  /** Wall-mounted items (whiteboard, paintings) with polished frame. */
  _drawWallItem(g, origin, def, tileW, tileH) {
    const { x, y } = origin;
    const w = (def.width || 2) * (tileW / 2);
    const h = (def.height || 1.5) * tileH;
    const mainColor = this._hex(def.color || '#ddddee');

    // Shadow behind frame
    g.fillStyle(0x000000, 0.08);
    g.fillRoundedRect(x - w / 2 - 1, y - h - 1, w + 6, h + 6, 4);
    // Frame (wood grain)
    g.fillStyle(0x5A3818, 1);
    g.fillRoundedRect(x - w / 2 - 3, y - h - 3, w + 6, h + 6, 3);
    // Frame inner bevel
    g.fillStyle(0x7A5828, 0.6);
    g.fillRoundedRect(x - w / 2 - 1, y - h - 1, w + 2, h + 2, 2);
    // Surface
    g.fillStyle(mainColor, 1);
    g.fillRect(x - w / 2, y - h, w, h);

    // Lines on whiteboard
    if (def.type === 'whiteboard') {
      // Grid lines (subtle)
      g.lineStyle(0.5, 0x9999AA, 0.35);
      for (let ly = y - h + 8; ly < y - 4; ly += 10) {
        g.beginPath();
        g.moveTo(x - w / 2 + 4, ly);
        g.lineTo(x + w / 2 - 4, ly);
        g.strokePath();
      }
      // Colored marks (presentation-style)
      g.lineStyle(2.5, 0xDD3333, 0.75);
      g.beginPath();
      g.moveTo(x - w / 2 + 8, y - h + 14);
      g.lineTo(x - w / 2 + 28, y - h + 24);
      g.strokePath();
      g.lineStyle(2.5, 0x3355CC, 0.75);
      g.beginPath();
      g.moveTo(x - w / 2 + 8, y - h + 24);
      g.lineTo(x, y - h + 16);
      g.strokePath();
      g.lineStyle(2, 0x33AA55, 0.6);
      g.beginPath();
      g.moveTo(x + 4, y - h + 20);
      g.lineTo(x + w / 2 - 10, y - h + 14);
      g.strokePath();
      // Marker tray
      g.fillStyle(0x888888, 0.6);
      g.fillRect(x - w / 2 + 4, y - 2, w - 8, 3);
      // Markers in tray
      g.fillStyle(0xDD3333, 0.8);
      g.fillRect(x - w / 2 + 8, y - 4, 3, 4);
      g.fillStyle(0x3355CC, 0.8);
      g.fillRect(x - w / 2 + 14, y - 4, 3, 4);
      g.fillStyle(0x33AA55, 0.8);
      g.fillRect(x - w / 2 + 20, y - 4, 3, 4);
    }
    // Surface highlight (glass/gloss reflection)
    g.fillStyle(0xFFFFFF, 0.06);
    g.fillRect(x - w / 2, y - h, w * 0.4, h * 0.5);
  }

  _registerBuiltins() {
    // Plant – detailed pot with varied leaves and stem
    this.addRenderer('plant', (g, def, iso) => {
      const { x, y } = iso.toScreen(def.isoX, def.isoY, 0);
      const potColor = 0xAA6633;
      const potHighlight = 0xCC8844;
      const leafColor = this._hex(def.color || '#2D5A27');
      const leafLight = this._lighten(leafColor, 0x224422);
      const leafDark = this._darken(leafColor, 0x111111);

      // Shadow
      g.fillStyle(0x000000, 0.06);
      g.fillEllipse(x, y + 2, 18, 6);
      // Pot
      g.fillStyle(potColor, 1);
      g.fillTrapezoid
        ? g.fillTrapezoid(x - 6, y - 8, 12, 10, 8)
        : g.fillRoundedRect(x - 7, y - 10, 14, 12, 2);
      // Pot highlight
      g.fillStyle(potHighlight, 0.4);
      g.fillRoundedRect(x - 5, y - 9, 4, 10, 1);
      // Pot rim
      g.fillStyle(0xBB7744, 0.8);
      g.fillRoundedRect(x - 8, y - 11, 16, 3, 1);
      // Soil
      g.fillStyle(0x3A2200, 1);
      g.fillEllipse(x, y - 10, 14, 5);
      // Soil texture
      g.fillStyle(0x553311, 0.5);
      g.fillEllipse(x - 2, y - 10, 8, 3);
      // Stem
      g.fillStyle(0x336622, 0.8);
      g.fillRect(x - 1, y - 22, 2, 12);
      // Bush / leaves (varied sizes and shades)
      g.fillStyle(leafDark, 1);
      g.fillCircle(x + 1, y - 22, 11);
      g.fillStyle(leafColor, 1);
      g.fillCircle(x, y - 23, 10);
      g.fillCircle(x - 7, y - 18, 8);
      g.fillCircle(x + 7, y - 18, 8);
      g.fillCircle(x, y - 30, 8);
      g.fillCircle(x - 4, y - 27, 7);
      g.fillCircle(x + 5, y - 27, 7);
      // Leaf highlights
      g.fillStyle(leafLight, 0.4);
      g.fillCircle(x - 3, y - 26, 5);
      g.fillCircle(x + 4, y - 22, 4);
      g.fillCircle(x - 6, y - 20, 3);
    });

    // Sofa – polished cushioned couch with pillow detail
    this.addRenderer('sofa', (g, def, iso) => {
      const { x, y } = iso.toScreen(def.isoX, def.isoY, 0);
      const tileW = iso.tileW;
      const tileH = iso.tileH;
      const w = (def.width || 2) * (tileW / 2);
      const seatH = tileH * 0.8;
      const backH = tileH * 1.4;
      const mainC = this._hex(def.color || '#445577');
      const topC = this._hex(def.topColor || '#5566AA');
      const armC = this._darken(mainC, 0x111111);
      const highlight = this._lighten(mainC, 0x181818);

      // Shadow
      g.fillStyle(0x000000, 0.06);
      g.fillEllipse(x, y + 4, w * 2.2, 8);
      // Back
      g.fillStyle(armC, 1);
      g.fillRoundedRect(x - w, y - backH - seatH, w * 2, backH, 6);
      // Back cushion detail
      g.fillStyle(mainC, 0.8);
      g.fillRoundedRect(x - w + 3, y - backH - seatH + 3, w * 2 - 6, backH - 6, 4);
      // Seat
      g.fillStyle(mainC, 1);
      g.fillRoundedRect(x - w, y - seatH, w * 2, seatH, 4);
      // Cushions (with highlight)
      g.fillStyle(topC, 1);
      g.fillRoundedRect(x - w + 4, y - seatH + 3, w - 8, seatH - 6, 4);
      g.fillRoundedRect(x + 4, y - seatH + 3, w - 8, seatH - 6, 4);
      // Cushion highlights
      g.fillStyle(highlight, 0.3);
      g.fillRoundedRect(x - w + 6, y - seatH + 4, w - 14, seatH / 3, 3);
      g.fillRoundedRect(x + 6, y - seatH + 4, w - 14, seatH / 3, 3);
      // Cushion seam
      g.lineStyle(0.5, armC, 0.3);
      g.beginPath();
      g.moveTo(x, y - seatH + 4);
      g.lineTo(x, y - 4);
      g.strokePath();
      // Arms
      g.fillStyle(armC, 1);
      g.fillRoundedRect(x - w - 5, y - backH - seatH, 10, backH + seatH, 5);
      g.fillRoundedRect(x + w - 5, y - backH - seatH, 10, backH + seatH, 5);
      // Arm highlights
      g.fillStyle(highlight, 0.2);
      g.fillRoundedRect(x - w - 3, y - backH - seatH + 2, 4, backH + seatH - 4, 3);
      g.fillRoundedRect(x + w - 3, y - backH - seatH + 2, 4, backH + seatH - 4, 3);
      // Throw pillow
      g.fillStyle(this._lighten(topC, 0x222222), 0.8);
      g.fillRoundedRect(x - w + 6, y - seatH - 6, 14, 10, 3);
      g.fillStyle(0xFFFFFF, 0.1);
      g.fillRoundedRect(x - w + 7, y - seatH - 5, 6, 4, 2);
    });
  }

  _hex(colorStr) {
    return parseInt((colorStr || '#888888').replace('#', ''), 16);
  }

  _darken(color, amount = 0x222222) {
    const r = Math.max(0, ((color >> 16) & 0xff) - ((amount >> 16) & 0xff));
    const g = Math.max(0, ((color >> 8) & 0xff) - ((amount >> 8) & 0xff));
    const b = Math.max(0, (color & 0xff) - (amount & 0xff));
    return (r << 16) | (g << 8) | b;
  }

  _lighten(color, amount = 0x222222) {
    const r = Math.min(255, ((color >> 16) & 0xff) + ((amount >> 16) & 0xff));
    const g = Math.min(255, ((color >> 8) & 0xff) + ((amount >> 8) & 0xff));
    const b = Math.min(255, (color & 0xff) + (amount & 0xff));
    return (r << 16) | (g << 8) | b;
  }
}
