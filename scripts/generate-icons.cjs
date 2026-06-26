/**
 * Generates assets/icon.ico and assets/icon.icns from scratch using pure Node.js.
 * No external dependencies required — only Node's built-in zlib.
 * Run: node scripts/generate-icons.cjs
 */
const { deflateSync } = require('zlib');
const fs = require('fs');
const path = require('path');

// ── Tiny PNG encoder ──────────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length, 0);
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
  return Buffer.concat([len, t, d, crcBuf]);
}

function buildPNG(width, height, getPixel) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.allocUnsafe(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = getPixel(x, y);
      const off = y * (1 + width * 4) + 1 + x * 4;
      raw[off] = px[0]; raw[off + 1] = px[1]; raw[off + 2] = px[2]; raw[off + 3] = px[3];
    }
  }
  return Buffer.concat([SIG, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

// ── Icon drawing ───────────────────────────────────────────────────────────────

function isInRoundedRect(x, y, cx, cy, w, h, r) {
  const l = cx - w / 2, ri = cx + w / 2, t = cy - h / 2, b = cy + h / 2;
  if (x < l || x > ri || y < t || y > b) return false;
  const d = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
  if (x < l + r && y < t + r && d(x - (l + r), y - (t + r)) > r) return false;
  if (x > ri - r && y < t + r && d(x - (ri - r), y - (t + r)) > r) return false;
  if (x < l + r && y > b - r && d(x - (l + r), y - (b - r)) > r) return false;
  if (x > ri - r && y > b - r && d(x - (ri - r), y - (b - r)) > r) return false;
  return true;
}

// Bold "E" glyph — 7 rows × 5 cols
const E = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
];

function drawPixel(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const BLUE = [37, 99, 235, 255];
  const WHITE = [255, 255, 255, 255];
  const CLEAR = [0, 0, 0, 0];

  const pad = size * 0.05, corner = size * 0.22;
  if (!isInRoundedRect(x, y, cx, cy, size - pad * 2, size - pad * 2, corner)) return CLEAR;

  const cell = Math.round(size * 0.135);
  const eW = 5 * cell, eH = 7 * cell;
  const eL = Math.floor(cx - eW / 2), eT = Math.floor(cy - eH / 2);
  const col = Math.floor((x - eL) / cell);
  const row = Math.floor((y - eT) / cell);

  if (row >= 0 && row < 7 && col >= 0 && col < 5 && E[row][col] === 1) return WHITE;
  return BLUE;
}

// ── ICO with embedded PNG ─────────────────────────────────────────────────────

function buildICO(pngBuf) {
  const header = Buffer.allocUnsafe(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const dir = Buffer.allocUnsafe(16);
  dir[0] = 0; dir[1] = 0; dir[2] = 0; dir[3] = 0;
  dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(pngBuf.length, 8); dir.writeUInt32LE(22, 12);
  return Buffer.concat([header, dir, pngBuf]);
}

// ── ICNS with ic08 entry (256 × 256) ─────────────────────────────────────────

function buildICNS(pngBuf) {
  const entrySize = 8 + pngBuf.length;
  const totalSize = 8 + entrySize;
  const totalBuf = Buffer.allocUnsafe(4); totalBuf.writeUInt32BE(totalSize, 0);
  const entryBuf = Buffer.allocUnsafe(4); entryBuf.writeUInt32BE(entrySize, 0);
  return Buffer.concat([Buffer.from('icns'), totalBuf, Buffer.from('ic08'), entryBuf, pngBuf]);
}

// ── Write files ───────────────────────────────────────────────────────────────

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const size = 256;
const png = buildPNG(size, size, (x, y) => drawPixel(x, y, size));

fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), buildICO(png));
fs.writeFileSync(path.join(assetsDir, 'icon.icns'), buildICNS(png));

console.log('Generated: assets/icon.png, icon.ico, icon.icns');
