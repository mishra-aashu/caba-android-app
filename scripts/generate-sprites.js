import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EMOJI_DIR = 'public/assets/emojis';
const OUTPUT_DIR = 'public/assets/emojis/spritesheets';
const MAP_FILE = 'src/constants/emoji-map.json';
const VENDORS = ['apple', 'google', 'twitter', 'facebook'];
const GRID_SIZE = 16; // 16x16 = 256 emojis per sheet
const TILE_SIZE = 32; // 32x32px emojis

/**
 * Node.js script to generate emoji sprite sheets using ImageMagick 'montage'.
 */
function generateSprites() {
  const emojiMap = {};

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const vendor of VENDORS) {
    const vendorDir = path.join(EMOJI_DIR, vendor);
    if (!fs.existsSync(vendorDir)) {
      console.warn(`Vendor dir ${vendorDir} not found, skipping.`);
      continue;
    }

    const files = fs.readdirSync(vendorDir)
      .filter(f => f.endsWith('.webp'))
      .sort();

    console.log(`Processing ${files.length} emojis for ${vendor}...`);

    const batchSize = GRID_SIZE * GRID_SIZE;
    const numBatches = Math.ceil(files.length / batchSize);
    const vendorMap = {};

    for (let i = 0; i < numBatches; i++) {
      const start = i * batchSize;
      const end = Math.min((i + 1) * batchSize, files.length);
      const batchFiles = files.slice(start, end);

      const spriteName = `${vendor}-${i}.webp`;
      const spritePath = path.join(OUTPUT_DIR, spriteName);

      // Create full paths for montage
      const fullPaths = batchFiles.map(f => path.join(vendorDir, f));

      // Run montage: montage -background transparent -tile 16x16 -geometry 32x32+0+0 batch/*.webp output.webp
      const cmd = [
        'montage',
        '-background transparent',
        `-tile ${GRID_SIZE}x${GRID_SIZE}`,
        `-geometry ${TILE_SIZE}x${TILE_SIZE}+0+0`,
        ...fullPaths,
        spritePath
      ].join(' ');

      console.log(`  Generating sprite sheet ${i + 1}/${numBatches}: ${spriteName}`);
      try {
        execSync(cmd, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Error generating sprite sheet ${spriteName}:`, err.message);
        process.exit(1);
      }

      // Update map
      batchFiles.forEach((filename, idx) => {
        const hexCode = filename.replace('.webp', '');
        const row = Math.floor(idx / GRID_SIZE);
        const col = idx % GRID_SIZE;

        vendorMap[hexCode] = {
          sheet: spriteName,
          x: col * TILE_SIZE,
          y: row * TILE_SIZE
        };
      });
    }

    emojiMap[vendor] = vendorMap;
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(emojiMap, null, 2));
  console.log(`Successfully generated map in ${MAP_FILE}`);
}

generateSprites();
