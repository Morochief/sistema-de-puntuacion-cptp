import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

function crc32(buf) {
  let c = 0xffffffff;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let cn = n;
    for (let k = 0; k < 8; k++) cn = cn & 1 ? 0xedb88320 ^ (cn >>> 1) : cn >>> 1;
    table[n] = cn;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crc]);
}

function createPNG(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r25 = size * 0.25, r125 = size * 0.125, r375 = size * 0.375;
      const onRing = (Math.abs(dist - r25) < 2) || (Math.abs(dist - r125) < 1.5) || (Math.abs(dist - r375) < 2);

      if (onRing || dist <= r125) {
        px[i] = 234; px[i+1] = 179; px[i+2] = 8; px[i+3] = 255;
      } else {
        px[i] = 30; px[i+1] = 58; px[i+2] = 95; px[i+3] = 255;
      }
    }
  }

  const scanlines = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    scanlines[y * (1 + size * 4)] = 0;
    px.copy(scanlines, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const idat = deflateSync(scanlines);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

[192, 512].forEach(size => {
  const png = createPNG(size);
  writeFileSync(resolve(publicDir, `pwa-${size}x${size}.png`), png);
  console.log(`Created pwa-${size}x${size}.png (${png.length} bytes)`);
});
