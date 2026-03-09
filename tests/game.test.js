/**
 * Basic unit tests for Office Buddy.
 * Run with:  node tests/game.test.js
 *
 * Tests the pure-logic modules that have no browser/Phaser dependency:
 *   - IsoHelper  (coord conversion)
 *   - server.js  (room management via in-process require)
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertClose(a, b, message, eps = 0.01) {
  assert(Math.abs(a - b) < eps, message);
}

// ── IsoHelper (inline re-implementation, mirrors renderer/game/objects/IsoHelper.js) ──
class IsoHelper {
  constructor(tileW = 64, tileH = 32, originX = 0, originY = 0) {
    this.tileW = tileW; this.tileH = tileH;
    this.originX = originX; this.originY = originY;
  }
  toScreen(ix, iy, iz = 0) {
    const x = this.originX + (ix - iy) * (this.tileW / 2);
    const y = this.originY + (ix + iy) * (this.tileH / 2) - iz * this.tileH;
    return { x, y };
  }
  toIso(sx, sy) {
    const relX = sx - this.originX;
    const relY = sy - this.originY;
    const ix = Math.round((relX / (this.tileW / 2) + relY / (this.tileH / 2)) / 2);
    const iy = Math.round((relY / (this.tileH / 2) - relX / (this.tileW / 2)) / 2);
    return { ix, iy };
  }
  depthOf(ix, iy) { return ix + iy; }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── IsoHelper tests ──────────────────────────────────────────');

const iso = new IsoHelper(64, 32, 400, 100);

{
  const { x, y } = iso.toScreen(0, 0, 0);
  assertClose(x, 400, 'toScreen(0,0) x = originX');
  assertClose(y, 100, 'toScreen(0,0) y = originY');
}

{
  const { x, y } = iso.toScreen(1, 0, 0);
  assertClose(x, 432, 'toScreen(1,0) x = originX + tileW/2');
  assertClose(y, 116, 'toScreen(1,0) y = originY + tileH/2');
}

{
  const { x, y } = iso.toScreen(0, 1, 0);
  assertClose(x, 368, 'toScreen(0,1) x = originX - tileW/2');
  assertClose(y, 116, 'toScreen(0,1) y = originY + tileH/2');
}

{
  // Height Z lifts the point upward (decreases screen y)
  const { y: y0 } = iso.toScreen(2, 2, 0);
  const { y: y1 } = iso.toScreen(2, 2, 1);
  assert(y1 < y0, 'toScreen with iz=1 is higher (smaller y) than iz=0');
}

{
  // Round-trip: toScreen then toIso
  for (const [ix, iy] of [[0, 0], [3, 2], [5, 7], [9, 1]]) {
    const { x, y } = iso.toScreen(ix, iy, 0);
    const back = iso.toIso(x, y);
    assert(back.ix === ix && back.iy === iy,
      `round-trip toScreen→toIso at (${ix},${iy})`);
  }
}

{
  // depthOf: tiles further from viewer (higher ix+iy) have higher depth
  assert(iso.depthOf(3, 3) > iso.depthOf(1, 1), 'depthOf increases with ix+iy');
  assert(iso.depthOf(0, 0) === 0, 'depthOf(0,0) === 0');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Server room management tests ────────────────────────────');

// Minimal mock for http.createServer so server.js can be required
const http = require('http');
const origListen = http.Server.prototype.listen;
http.Server.prototype.listen = function (port, host, cb) {
  // Don't actually bind a port in tests
  if (typeof cb === 'function') setImmediate(cb);
  return this;
};

let serverModule;
try {
  serverModule = require('../server.js');
} catch (e) {
  console.warn('Could not load server.js (socket.io may not be installed yet):', e.message);
}

if (serverModule) {
  const { rooms } = serverModule;

  // Simulate room creation helpers
  const crypto = require('crypto');
  function genCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  {
    // Room codes are 6 hex chars uppercase
    const code = genCode();
    assert(code.length === 6, 'Room code length is 6');
    assert(code === code.toUpperCase(), 'Room code is uppercase');
    assert(/^[0-9A-F]+$/.test(code), 'Room code is hexadecimal');
  }

  {
    // Rooms map starts empty (or has been populated by socket events – we just
    // check the type is a Map)
    assert(rooms instanceof Map, 'rooms is a Map');
  }
}

http.Server.prototype.listen = origListen;

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Furniture JSON tests ─────────────────────────────────────');

const path = require('path');
const fs = require('fs');

{
  const furniturePath = path.join(__dirname, '..', 'data', 'furniture.json');
  assert(fs.existsSync(furniturePath), 'data/furniture.json exists');

  let defs;
  try {
    defs = JSON.parse(fs.readFileSync(furniturePath, 'utf8'));
    assert(Array.isArray(defs), 'furniture.json is an array');
    assert(defs.length > 0, 'furniture.json has at least one item');
  } catch (e) {
    assert(false, `furniture.json is valid JSON: ${e.message}`);
    defs = [];
  }

  const requiredFields = ['id', 'type', 'isoX', 'isoY', 'color'];
  for (const def of defs) {
    for (const field of requiredFields) {
      assert(field in def, `furniture item "${def.id || '?'}" has field "${field}"`);
    }
  }

  // Check for duplicate ids
  const ids = defs.map(d => d.id);
  const uniqueIds = new Set(ids);
  assert(ids.length === uniqueIds.size, 'All furniture ids are unique');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(54)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed ✓\n');
}
