/**
 * Regenerates the PWA icon set from the 256x256 source logo.
 * Run with: npm run icons:generate
 *
 * The source has no alpha channel and a pure-white background (verified with a
 * corner-pixel read), so padding with #ffffff matches it exactly. Icons scale to
 * 66% of the canvas before padding — that keeps the artwork's corner inside the
 * maskable safe zone (an 80%-diameter centered circle); don't push this past ~75%.
 *
 * Re-run after swapping in a sharper source. Changing the output also requires
 * bumping the service worker's cache version (src/../public/sw.js) or installed
 * clients keep the old icons cached.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "logo-icon.png");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

async function square(size: number, scale: number, outPath: string) {
  const artSize = Math.round(size * scale);
  const art = await sharp(SOURCE).resize(artSize, artSize, { fit: "contain" }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${path.relative(ROOT, outPath)} (${size}x${size}, ${Math.round(scale * 100)}% art)`);
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });

  // "any" icons: full-bleed, no safe-zone constraint.
  await square(192, 1, path.join(ICONS_DIR, "icon-192.png"));
  await square(512, 1, path.join(ICONS_DIR, "icon-512.png"));

  // Maskable: 66% keeps the logo inside the safe zone under any launcher mask.
  await square(512, 0.66, path.join(ICONS_DIR, "icon-512-maskable.png"));

  // Apple touch icon — file convention, served at /apple-icon.png.
  await square(180, 1, path.join(ROOT, "src", "app", "apple-icon.png"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
