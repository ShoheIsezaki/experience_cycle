// PNG アイコン生成スクリプト（依存ライブラリなし・Node標準のzlibのみ使用）。
// 「経験学習サイクル」を表す、4分割された白いリング（循環）を青地に描く。
//   npm run gen:icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public');
mkdirSync(OUT, { recursive: true });

// ---- CRC32 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rest 0 (compression/filter/interlace)
  // add filter byte (0) per scanline
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- draw ----
const BG = [79, 124, 255]; // #4f7cff
const FG = [255, 255, 255];

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const R = size * 0.34;
  const T = size * 0.11;
  const inner = R - T;
  const nodeR = size * 0.058;
  // 4つのアーク間のギャップ（度）。45/135/225/315度を中心に開ける。
  const gapCenters = [45, 135, 225, 315].map((d) => (d * Math.PI) / 180);
  const halfGap = (24 * Math.PI) / 180;
  // 4つのノード（0/90/180/270度）
  const nodeAngles = [0, 90, 180, 270].map((d) => (d * Math.PI) / 180);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const dist = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx);
      if (ang < 0) ang += 2 * Math.PI;

      let on = false;
      // リング本体（ギャップを除く）
      if (dist >= inner && dist <= R) {
        let inGap = false;
        for (const g of gapCenters) {
          let d = Math.abs(ang - g);
          if (d > Math.PI) d = 2 * Math.PI - d;
          if (d < halfGap) inGap = true;
        }
        if (!inGap) on = true;
      }
      // ノードの丸
      for (const a of nodeAngles) {
        const nx = c + R * Math.cos(a);
        const ny = c + R * Math.sin(a);
        if (Math.hypot(x + 0.5 - nx, y + 0.5 - ny) <= nodeR) on = true;
      }

      const i = (y * size + x) * 4;
      const col = on ? FG : BG;
      rgba[i] = col[0];
      rgba[i + 1] = col[1];
      rgba[i + 2] = col[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="0" fill="#4f7cff"/>
  <g fill="none" stroke="#ffffff" stroke-width="56" stroke-linecap="round">
    <path d="M256 82 A174 174 0 0 1 379 133"/>
    <path d="M430 256 A174 174 0 0 1 379 379"/>
    <path d="M256 430 A174 174 0 0 1 133 379"/>
    <path d="M82 256 A174 174 0 0 1 133 133"/>
  </g>
  <g fill="#ffffff">
    <circle cx="430" cy="256" r="30"/>
    <circle cx="256" cy="430" r="30"/>
    <circle cx="82" cy="256" r="30"/>
    <circle cx="256" cy="82" r="30"/>
  </g>
</svg>
`;

writeFileSync(resolve(OUT, 'pwa-512.png'), draw(512));
writeFileSync(resolve(OUT, 'pwa-192.png'), draw(192));
writeFileSync(resolve(OUT, 'apple-touch-icon.png'), draw(180));
writeFileSync(resolve(OUT, 'icon.svg'), svg);
writeFileSync(resolve(OUT, 'favicon.svg'), svg);
console.log('icons written to', OUT);
