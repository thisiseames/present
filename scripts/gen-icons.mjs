// Generates the app icons — dependency-free PNG encoder.
//   npm run icons
// A single warm point on near-black: you are here.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [0x0e, 0x0e, 0x0f];
const DOT = [0xed, 0xe8, 0xdf];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.15;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cover = Math.max(0, Math.min(1, r + 0.5 - d));
      for (let ch = 0; ch < 3; ch++) raw[o++] = Math.round(BG[ch] + (DOT[ch] - BG[ch]) * cover);
      raw[o++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, OUT), png(size));
}
writeFileSync(new URL("apple-touch-icon.png", OUT), png(180));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e0e0f"/>
  <circle cx="256" cy="256" r="77" fill="#ede8df"/>
</svg>
`;
writeFileSync(new URL("icon.svg", OUT), svg);

console.log("icons written to /icons");
