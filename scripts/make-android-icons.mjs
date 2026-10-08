import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = 'public/icon-512.png';
const RES = 'android/app/src/main/res';
const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];

// Circular mask for round icons
const circleMask = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);

for (const [dpi, launcher, layer] of densities) {
  const dir = `${RES}/mipmap-${dpi}`;
  mkdirSync(dir, { recursive: true });
  const square = sharp(SRC).resize(launcher, launcher);
  await square.clone().png().toFile(`${dir}/ic_launcher.png`);
  await square.composite([{ input: circleMask(launcher), blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`);
  // Adaptive layers (108dp): full-bleed artwork as background, empty foreground
  await sharp(SRC).resize(layer, layer).png().toFile(`${dir}/ic_launcher_background.png`);
  await sharp({ create: { width: layer, height: layer, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(`${dir}/ic_launcher_foreground.png`);
}

// Play Store icon (512)
mkdirSync('android-play-store-icon', { recursive: true });
await sharp(SRC).resize(512, 512).png().toFile('android-play-store-icon/play-store-icon-512.png');
console.log('icons done');
