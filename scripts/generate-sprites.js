import fs from 'node:fs';
import path from 'node:path';

const EMOJI_DIR = 'public/assets/emojis';
const OUTPUT_DIR = 'public/assets/emojis/spritesheets';
const VENDORS = ['apple', 'google', 'twitter', 'facebook'];

/**
 * Node.js script to extract pre-compiled emoji sprite sheets and data
 * from the iamcal/emoji-data Github packages installed in node_modules.
 */
function copyEmojiAssets() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Copy the core JSON data mapping (we can just use the apple one as the base structure is the same)
  const jsonSrc = 'node_modules/emoji-datasource-apple/emoji.json';
  const jsonDest = path.join(EMOJI_DIR, 'emoji-data.json');
  
  if (fs.existsSync(jsonSrc)) {
    console.log(`Copying emoji data mapping to ${jsonDest}`);
    fs.copyFileSync(jsonSrc, jsonDest);
  } else {
    console.error('❌ Could not find emoji.json in node_modules/emoji-datasource-apple. Have you run npm install?');
  }

  // 2. Copy the spritesheets for each vendor
  for (const vendor of VENDORS) {
    const sheetSrc = `node_modules/emoji-datasource-${vendor}/img/${vendor}/sheets/64.png`;
    const sheetDest = path.join(OUTPUT_DIR, `sheet_${vendor}_64.png`);
    
    if (fs.existsSync(sheetSrc)) {
      console.log(`Copying 64px spritesheet for ${vendor}...`);
      fs.copyFileSync(sheetSrc, sheetDest);
    } else {
      console.warn(`⚠️ Could not find spritesheet for ${vendor} at ${sheetSrc}`);
    }
  }

  console.log('✅ Successfully extracted all emoji assets from node_modules!');
}

copyEmojiAssets();
