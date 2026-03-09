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
   * Draw a simple isometric box for a furniture piece.
   * The box top is the "top face", left and right faces are the sides.
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
    const sideL = this._darken(mainColor, 0x222222);
    const sideR = this._darken(mainColor, 0x444444);

    // Bottom-left corner of the top face in screen space
    // (accounting for tile size and item footprint)
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

    // Thin outline
    g.lineStyle(0.5, 0x000000, 0.3);
    g.strokeRect(topFront.x - 1, topFront.y - 1, 2, 2);

    // Draw on-top items (computer, lamp, etc.)
    if (Array.isArray(def.items)) {
      this._drawTopItems(g, def.items, topBack, topFront, tileW, tileH, h);
    }
  }

  /** Render items sitting on top of furniture (computer, lamp…). */
  _drawTopItems(g, items, topBack, topFront, tileW, tileH, boxH) {
    const cx = (topBack.x + topFront.x) / 2;
    const cy = (topBack.y + topFront.y) / 2 - boxH;

    for (const item of items) {
      if (item === 'computer') {
        // Monitor
        g.fillStyle(0x222233, 1);
        g.fillRoundedRect(cx - 10, cy - 26, 20, 16, 2);
        g.fillStyle(0x334466, 1);
        g.fillRoundedRect(cx - 8, cy - 24, 16, 12, 1);
        // Stand
        g.fillStyle(0x444455, 1);
        g.fillRect(cx - 2, cy - 10, 4, 6);
        g.fillRoundedRect(cx - 6, cy - 4, 12, 3, 1);
        // Keyboard
        g.fillStyle(0xAAAAAA, 1);
        g.fillRoundedRect(cx - 10, cy + 2, 20, 6, 1);
      } else if (item === 'lamp') {
        // Lamp base & pole
        g.fillStyle(0x888866, 1);
        g.fillRect(cx + 6, cy - 20, 3, 20);
        // Shade
        g.fillStyle(0xFFDD99, 0.8);
        g.fillTriangle(cx + 3, cy - 28, cx + 14, cy - 28, cx + 8, cy - 20);
        // Light glow
        g.fillStyle(0xFFFF88, 0.15);
        g.fillCircle(cx + 8, cy - 22, 12);
      }
    }
  }

  /** Wall-mounted items (whiteboard, paintings). */
  _drawWallItem(g, origin, def, tileW, tileH) {
    const { x, y } = origin;
    const w = (def.width || 2) * (tileW / 2);
    const h = (def.height || 1.5) * tileH;
    const mainColor = this._hex(def.color || '#ddddee');

    // Frame
    g.fillStyle(0x553311, 1);
    g.fillRoundedRect(x - w / 2 - 3, y - h - 3, w + 6, h + 6, 3);
    // Surface
    g.fillStyle(mainColor, 1);
    g.fillRect(x - w / 2, y - h, w, h);
    // Lines on whiteboard
    if (def.type === 'whiteboard') {
      g.lineStyle(1, 0xAAAAAA, 0.5);
      for (let ly = y - h + 8; ly < y - 4; ly += 10) {
        g.beginPath();
        g.moveTo(x - w / 2 + 4, ly);
        g.lineTo(x + w / 2 - 4, ly);
        g.strokePath();
      }
      // Some colored marks
      g.lineStyle(2, 0xFF4444, 0.8);
      g.beginPath();
      g.moveTo(x - w / 2 + 8, y - h + 12);
      g.lineTo(x - w / 2 + 24, y - h + 22);
      g.strokePath();
      g.lineStyle(2, 0x4444FF, 0.8);
      g.beginPath();
      g.moveTo(x - w / 2 + 8, y - h + 22);
      g.lineTo(x, y - h + 14);
      g.strokePath();
    }
  }

  _registerBuiltins() {
    // Plant – draw as a pot with leaf/bush on top
    this.addRenderer('plant', (g, def, iso) => {
      const { x, y } = iso.toScreen(def.isoX, def.isoY, 0);
      const potColor = 0xAA6633;
      const leafColor = this._hex(def.color || '#2D5A27');
      // Pot
      g.fillStyle(potColor, 1);
      g.fillTrapezoid
        ? g.fillTrapezoid(x - 6, y - 8, 12, 10, 8)
        : g.fillRoundedRect(x - 7, y - 10, 14, 12, 2);
      // Soil
      g.fillStyle(0x442200, 1);
      g.fillEllipse(x, y - 10, 14, 5);
      // Bush / leaves (several overlapping circles)
      g.fillStyle(leafColor, 1);
      g.fillCircle(x, y - 22, 10);
      g.fillCircle(x - 7, y - 18, 8);
      g.fillCircle(x + 7, y - 18, 8);
      g.fillCircle(x, y - 30, 8);
    });

    // Sofa – a wider, cushioned couch shape
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

      // Back
      g.fillStyle(armC, 1);
      g.fillRoundedRect(x - w, y - backH - seatH, w * 2, backH, 6);
      // Seat
      g.fillStyle(mainC, 1);
      g.fillRoundedRect(x - w, y - seatH, w * 2, seatH, 4);
      // Cushions
      g.fillStyle(topC, 1);
      g.fillRoundedRect(x - w + 4, y - seatH + 3, w - 8, seatH - 6, 3);
      g.fillRoundedRect(x + 4, y - seatH + 3, w - 8, seatH - 6, 3);
      // Arms
      g.fillStyle(armC, 1);
      g.fillRoundedRect(x - w - 5, y - backH - seatH, 10, backH + seatH, 4);
      g.fillRoundedRect(x + w - 5, y - backH - seatH, 10, backH + seatH, 4);
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
}
