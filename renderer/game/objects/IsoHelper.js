/**
 * IsoHelper – converts between isometric grid coords and screen coords.
 *
 * Isometric convention used here:
 *   - isoX grows "right-and-down" on screen
 *   - isoY grows "left-and-down" on screen
 *   - height (Z) lifts the point upward on screen
 *
 * The tile dimensions are set in the constructor.
 */
export class IsoHelper {
  /**
   * @param {number} tileW   Width  of a flat tile in pixels (full diamond width)
   * @param {number} tileH   Height of a flat tile in pixels (full diamond height)
   * @param {number} originX Screen X origin (top-left of grid, column 0, row 0)
   * @param {number} originY Screen Y origin
   */
  constructor(tileW = 64, tileH = 32, originX = 0, originY = 0) {
    this.tileW = tileW;
    this.tileH = tileH;
    this.originX = originX;
    this.originY = originY;
  }

  /**
   * Convert iso grid position (including optional Z height) to screen pixels.
   * @param {number} ix  Isometric X (column)
   * @param {number} iy  Isometric Y (row)
   * @param {number} iz  Isometric Z (height, 0 = floor)
   * @returns {{ x: number, y: number }}
   */
  toScreen(ix, iy, iz = 0) {
    const x = this.originX + (ix - iy) * (this.tileW / 2);
    const y = this.originY + (ix + iy) * (this.tileH / 2) - iz * this.tileH;
    return { x, y };
  }

  /**
   * Convert screen pixel position back to the nearest iso grid tile.
   * @param {number} sx  Screen X
   * @param {number} sy  Screen Y
   * @returns {{ ix: number, iy: number }}
   */
  toIso(sx, sy) {
    const relX = sx - this.originX;
    const relY = sy - this.originY;
    const ix = Math.round((relX / (this.tileW / 2) + relY / (this.tileH / 2)) / 2);
    const iy = Math.round((relY / (this.tileH / 2) - relX / (this.tileW / 2)) / 2);
    return { ix, iy };
  }

  /** Depth sort: tiles with lower (ix + iy) draw first (behind). */
  depthOf(ix, iy) {
    return ix + iy;
  }
}
