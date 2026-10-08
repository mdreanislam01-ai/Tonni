#!/usr/bin/env node
/**
 * Generates the Android launcher icons and splash screens for the Capacitor
 * project from public/icon-512.png.
 *
 * Pure Node implementation (only node:zlib + node:fs) so it can run on any
 * machine / CI runner without ImageMagick, Pillow or other native tooling.
 *
 * Usage:  node scripts/generate-android-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_ICON = path.join(ROOT, 'public', 'icon-512.png');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// Brand colours sampled from public/icon-512.png (blue chat bubbles).
const BRAND_TOP = [0x3b, 0x82, 0xf6]; // #3B82F6
const BRAND_BOTTOM = [0x1d, 0x4e, 0xd8]; // #1D4ED8
const BRAND_HEX = '#2563EB';

/* ------------------------------------------------------------------ PNG I/O */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG file');
  let pos = 8;
  let ihdr = null;
  let palette = null;
  let trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('PNG is missing an IHDR chunk');
  if (ihdr.interlace !== 0) throw new Error('Interlaced PNGs are not supported');
  if (ihdr.depth !== 8 && ihdr.depth !== 16) {
    throw new Error(`Unsupported PNG bit depth (got ${ihdr.depth})`);
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.colorType];
  if (!channels) throw new Error(`Unsupported PNG colour type ${ihdr.colorType}`);

  const sampleBytes = ihdr.depth === 16 ? 2 : 1;
  const bpp = channels * sampleBytes; // bytes per pixel: PNG filters work on byte offsets
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * bpp;
  const pixels = new Uint8Array(stride * ihdr.height);
  let prev = new Uint8Array(stride);

  for (let y = 0; y < ihdr.height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let value = raw[rowStart + x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = value & 0xff;
    }
    pixels.set(cur, y * stride);
    prev = cur;
  }

  const rgba = new Uint8ClampedArray(ihdr.width * ihdr.height * 4);
  const sample = (index, channel) => pixels[index * channels * sampleBytes + channel * sampleBytes];
  for (let i = 0; i < ihdr.width * ihdr.height; i += 1) {
    const d = i * 4;
    if (ihdr.colorType === 6) {
      rgba[d] = sample(i, 0);
      rgba[d + 1] = sample(i, 1);
      rgba[d + 2] = sample(i, 2);
      rgba[d + 3] = sample(i, 3);
    } else if (ihdr.colorType === 2) {
      rgba[d] = sample(i, 0);
      rgba[d + 1] = sample(i, 1);
      rgba[d + 2] = sample(i, 2);
      rgba[d + 3] = 255;
    } else if (ihdr.colorType === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = sample(i, 0);
      rgba[d + 3] = 255;
    } else if (ihdr.colorType === 4) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = sample(i, 0);
      rgba[d + 3] = sample(i, 1);
    } else {
      const entry = sample(i, 0) * 3;
      rgba[d] = palette[entry];
      rgba[d + 1] = palette[entry + 1];
      rgba[d + 2] = palette[entry + 2];
      rgba[d + 3] = trns && sample(i, 0) < trns.length ? trns[sample(i, 0)] : 255;
    }
  }
  return { width: ihdr.width, height: ihdr.height, data: rgba };
}

function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 2; // Up filter keeps gradients and flat colours tiny
    for (let i = 0; i < stride; i += 1) {
      const value = data[y * stride + i];
      const up = y > 0 ? data[(y - 1) * stride + i] : 0;
      raw[y * (stride + 1) + 1 + i] = (value - up) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/* --------------------------------------------------------------- image maths */

function blank(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set(fill, i * 4);
  return { width, height, data };
}

/** Resize with an area filter (downscale) / bilinear sampling (upscale), in
 *  premultiplied alpha so soft edges do not pick up dark fringes. */
function resize(img, width, height) {
  const horizontal = new Float32Array(width * img.height * 4);
  const hScale = img.width / width;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      if (hScale >= 1) {
        const start = x * hScale;
        const end = Math.min(img.width, (x + 1) * hScale);
        let weight = 0;
        const acc = [0, 0, 0, 0];
        for (let sx = Math.floor(start); sx < Math.ceil(end); sx += 1) {
          const cover = Math.min(end, sx + 1) - Math.max(start, sx);
          if (cover <= 0) continue;
          const alpha = img.data[(y * img.width + sx) * 4 + 3] / 255;
          acc[0] += img.data[(y * img.width + sx) * 4] * cover * alpha;
          acc[1] += img.data[(y * img.width + sx) * 4 + 1] * cover * alpha;
          acc[2] += img.data[(y * img.width + sx) * 4 + 2] * cover * alpha;
          acc[3] += img.data[(y * img.width + sx) * 4 + 3] * cover;
          weight += cover;
        }
        const alpha = acc[3] / weight;
        const unpremultiply = alpha > 0 ? 255 / alpha : 0;
        horizontal[out] = (acc[0] / weight) * unpremultiply;
        horizontal[out + 1] = (acc[1] / weight) * unpremultiply;
        horizontal[out + 2] = (acc[2] / weight) * unpremultiply;
        horizontal[out + 3] = alpha;
      } else {
        const sx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * hScale - 0.5));
        const x0 = Math.floor(sx);
        const x1 = Math.min(img.width - 1, x0 + 1);
        const t = sx - x0;
        for (let c = 0; c < 4; c += 1) {
          const a = img.data[(y * img.width + x0) * 4 + c];
          const b = img.data[(y * img.width + x1) * 4 + c];
          horizontal[out + c] = a + (b - a) * t;
        }
      }
    }
  }

  const out = new Uint8ClampedArray(width * height * 4);
  const vScale = img.height / height;
  for (let y = 0; y < height; y += 1) {
    if (vScale >= 1) {
      const start = y * vScale;
      const end = Math.min(img.height, (y + 1) * vScale);
      for (let x = 0; x < width; x += 1) {
        let weight = 0;
        const acc = [0, 0, 0, 0];
        for (let sy = Math.floor(start); sy < Math.ceil(end); sy += 1) {
          const cover = Math.min(end, sy + 1) - Math.max(start, sy);
          if (cover <= 0) continue;
          const alpha = horizontal[(sy * width + x) * 4 + 3] / 255;
          acc[0] += horizontal[(sy * width + x) * 4] * cover * alpha;
          acc[1] += horizontal[(sy * width + x) * 4 + 1] * cover * alpha;
          acc[2] += horizontal[(sy * width + x) * 4 + 2] * cover * alpha;
          acc[3] += horizontal[(sy * width + x) * 4 + 3] * cover;
          weight += cover;
        }
        const alpha = acc[3] / weight;
        const unpremultiply = alpha > 0 ? 255 / alpha : 0;
        const idx = (y * width + x) * 4;
        out[idx] = (acc[0] / weight) * unpremultiply;
        out[idx + 1] = (acc[1] / weight) * unpremultiply;
        out[idx + 2] = (acc[2] / weight) * unpremultiply;
        out[idx + 3] = alpha;
      }
    } else {
      const sy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * vScale - 0.5));
      const y0 = Math.floor(sy);
      const y1 = Math.min(img.height - 1, y0 + 1);
      const t = sy - y0;
      for (let x = 0; x < width; x += 1) {
        for (let c = 0; c < 4; c += 1) {
          const a = horizontal[(y0 * width + x) * 4 + c];
          const b = horizontal[(y1 * width + x) * 4 + c];
          out[(y * width + x) * 4 + c] = a + (b - a) * t;
        }
      }
    }
  }
  return { width, height, data: out };
}

/** Draws `logo` centred on `canvas` with the given target width, keeping aspect. */
function drawCentred(canvas, logo, targetWidth) {
  const scaled = resize(logo, Math.round(targetWidth), Math.round(targetWidth * logo.height / logo.width));
  const offsetX = Math.round((canvas.width - scaled.width) / 2);
  const offsetY = Math.round((canvas.height - scaled.height) / 2);
  for (let y = 0; y < scaled.height; y += 1) {
    const dy = y + offsetY;
    if (dy < 0 || dy >= canvas.height) continue;
    for (let x = 0; x < scaled.width; x += 1) {
      const dx = x + offsetX;
      if (dx < 0 || dx >= canvas.width) continue;
      const s = (y * scaled.width + x) * 4;
      const d = (dy * canvas.width + dx) * 4;
      const src = [scaled.data[s], scaled.data[s + 1], scaled.data[s + 2], scaled.data[s + 3] / 255];
      const dstAlpha = canvas.data[d + 3] / 255;
      const outAlpha = src[3] + dstAlpha * (1 - src[3]);
      if (outAlpha === 0) continue;
      for (let c = 0; c < 3; c += 1) {
        canvas.data[d + c] = (src[c] * src[3] + canvas.data[d + c] * dstAlpha * (1 - src[3])) / outAlpha;
      }
      canvas.data[d + 3] = outAlpha * 255;
    }
  }
  return canvas;
}

function verticalGradient(width, height, top, bottom) {
  const img = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    const t = height === 1 ? 0 : y / (height - 1);
    const colour = [0, 1, 2].map((c) => Math.round(top[c] + (bottom[c] - top[c]) * t));
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      img.data[i] = colour[0];
      img.data[i + 1] = colour[1];
      img.data[i + 2] = colour[2];
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/** Circular mask with 4x4 supersampled edges (for round launcher icons). */
function circleMask(img) {
  const out = blank(img.width, img.height);
  const cx = img.width / 2;
  const cy = img.height / 2;
  const radius = Math.min(img.width, img.height) / 2;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const px = x + (sx + 0.5) / 4 - cx;
          const py = y + (sy + 0.5) / 4 - cy;
          if (Math.hypot(px, py) <= radius) hits += 1;
        }
      }
      const coverage = hits / 16;
      const i = (y * img.width + x) * 4;
      out.data[i] = img.data[i];
      out.data[i + 1] = img.data[i + 1];
      out.data[i + 2] = img.data[i + 2];
      out.data[i + 3] = img.data[i + 3] * coverage;
    }
  }
  return out;
}

/** Turns the blue tile into a transparent-background bubble mark by keying the
 *  blue background out (the mark itself is white / pale blue). */
function knockOutBackground(img) {
  const out = blank(img.width, img.height);
  for (let i = 0; i < img.width * img.height; i += 1) {
    const r = img.data[i * 4];
    const g = img.data[i * 4 + 1];
    const b = img.data[i * 4 + 2];
    const min = Math.min(r, g, b);
    const alpha = Math.min(1, Math.max(0, (min - 110) / 60));
    out.data[i * 4] = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
    out.data[i * 4 + 3] = Math.round(img.data[i * 4 + 3] * alpha);
  }
  return out;
}

/** Crops fully transparent padding so logo sizes are predictable. */
function trim(img, threshold = 8) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (img.data[(y * img.width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return img;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const out = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = ((y + minY) * img.width + (x + minX)) * 4;
      const d = (y * width + x) * 4;
      out.data[d] = img.data[s];
      out.data[d + 1] = img.data[s + 1];
      out.data[d + 2] = img.data[s + 2];
      out.data[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

/* ------------------------------------------------------------------- outputs */

function write(relative, buffer) {
  const file = path.join(RES, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  return `${relative} (${(buffer.length / 1024).toFixed(1)} KB)`;
}

function main() {
  if (!fs.existsSync(SRC_ICON)) {
    console.error(`Source icon not found: ${SRC_ICON}`);
    process.exit(1);
  }
  const source = decodePng(fs.readFileSync(SRC_ICON));
  const mark = trim(knockOutBackground(source));
  const written = [];

  // Launcher icons (legacy square + round) and adaptive-icon foregrounds.
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, scale] of Object.entries(densities)) {
    const legacy = Math.round(48 * scale);
    written.push(write(`mipmap-${density}/ic_launcher.png`, encodePng(resize(source, legacy, legacy))));
    written.push(write(`mipmap-${density}/ic_launcher_round.png`, encodePng(circleMask(resize(source, legacy, legacy)))));

    // Adaptive icons are 108dp; the safe zone is the middle ~61%, so the mark
    // is drawn at 60% of the canvas to survive every launcher mask shape.
    const adaptive = Math.round(108 * scale);
    const foreground = blank(adaptive, adaptive);
    drawCentred(foreground, mark, adaptive * 0.6);
    written.push(write(`mipmap-${density}/ic_launcher_foreground.png`, encodePng(foreground)));

    // Launch / splash logo (transparent mark) at 96dp, plus the branded,
    // density-specific splash bitmaps Capacitor's theme points at.
    const logoWidth = Math.round(96 * scale);
    written.push(write(`drawable-${density}/splash_logo.png`, encodePng(resize(mark, logoWidth, Math.round(logoWidth * mark.height / mark.width)))));

    const portrait = verticalGradient(Math.round(320 * scale), Math.round(480 * scale), BRAND_TOP, BRAND_BOTTOM);
    write(`drawable-port-${density}/splash.png`, encodePng(drawCentred(portrait, mark, portrait.width * 0.42)));

    const landscape = verticalGradient(Math.round(480 * scale), Math.round(320 * scale), BRAND_TOP, BRAND_BOTTOM);
    write(`drawable-land-${density}/splash.png`, encodePng(drawCentred(landscape, mark, landscape.height * 0.42)));
  }

  // Default splash used when no density-specific variant matches.
  const fallback = verticalGradient(480, 320, BRAND_TOP, BRAND_BOTTOM);
  write('drawable/splash.png', encodePng(drawCentred(fallback, mark, 320 * 0.42)));

  fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND_HEX}</color>
</resources>
`);

  // Adaptive-icon background: same top-to-bottom blue gradient as the tile icon.
  fs.writeFileSync(path.join(RES, 'drawable', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="270"
        android:endColor="${rgbToHex(BRAND_BOTTOM)}"
        android:startColor="${rgbToHex(BRAND_TOP)}"
        android:type="linear" />
</shape>
`);

  const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon);
  fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon);
  written.push('drawable/ic_launcher_background.xml', 'mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml');

  fs.writeFileSync(path.join(RES, 'drawable', 'launch_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- Branded launch background: solid brand colour with the app mark centred. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/brand_background" />
    <item android:gravity="center" android:drawable="@drawable/splash_logo" />
</layer-list>
`);

  console.log(`Generated ${written.length} Android image assets from public/icon-512.png:`);
  for (const line of written) console.log(`  ${line}`);
  console.log('  values/ic_launcher_background.xml');
  console.log('  drawable/launch_background.xml');
}

main();
