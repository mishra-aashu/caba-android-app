/**
 * native-integrity.js
 *
 * v2 — Per-file fingerprinting + iOS tracking + DIFF support
 *
 * Generates a combined SHA-256 hash of all critical native files.
 * Also stores per-file hashes so the Admin Dashboard can show an exact DIFF
 * (which files changed, not just "something changed").
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ─── Critical files that define the "Native State" ──────────────────────────
// Grouped by platform for clarity in the Admin DIFF view
export const CRITICAL_FILES = {
  // ── Shared / Capacitor ──────────────────────────────────────────────────
  'capacitor.config.ts':                          'Capacitor — App config, server scheme, plugins',
  'package.json':                                  'Capacitor — Plugin versions (filtered)',

  // ── Android ────────────────────────────────────────────────────────────
  'android/app/src/main/AndroidManifest.xml':     'Android — Permissions, intent filters, activities',
  'android/app/build.gradle':                     'Android — Build config, dependencies, signing',
  'android/variables.gradle':                     'Android — SDK versions (compileSdk, targetSdk)',
  'android/gradle.properties':                    'Android — JVM args, AndroidX flags, network config',
  'android/app/proguard-rules.pro':               'Android — Code shrinking / obfuscation rules',
  'android/app/src/main/res/values/strings.xml':  'Android — App name, display strings',

  // ── iOS (tracked for future, won't block if missing) ───────────────────
  'ios/App/App/Info.plist':                       'iOS — Permissions, bundle ID, display name',
  'ios/App/App.xcodeproj/project.pbxproj':        'iOS — Xcode project file, signing, capabilities',
  'ios/App/Podfile':                              'iOS — CocoaPods dependencies',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize line endings for cross-OS consistent hashing */
function normalize(content) {
  return content.replace(/\r\n/g, '\n').trim();
}

/** Extract only Capacitor-related deps from package.json */
function extractCapacitorDeps(content) {
  try {
    const pkg = JSON.parse(content);
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const capDeps = {};
    Object.keys(allDeps)
      .filter(k => k.startsWith('@capacitor/') || k.includes('capacitor-plugin') || k.includes('capacitor-google'))
      .sort()
      .forEach(k => { capDeps[k] = allDeps[k]; });
    return JSON.stringify(capDeps);
  } catch {
    return content;
  }
}

/** Hash a single file's content */
function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Generates:
 *   hash        — combined SHA-256 of all present files (for quick mismatch check)
 *   fileHashes  — { filePath: sha256 } per-file hashes (for DIFF view in Admin)
 *   details     — { filePath: 'present' | 'missing' | 'ios-missing' } status
 *   meta        — file description map for UI labels
 */
export function generateNativeHash() {
  const combined = crypto.createHash('sha256');
  const fileHashes = {};
  const details = {};

  Object.entries(CRITICAL_FILES).forEach(([filePath, description]) => {
    const absolutePath = path.join(rootDir, filePath);
    const isIOS = filePath.startsWith('ios/');

    if (fs.existsSync(absolutePath)) {
      let content = fs.readFileSync(absolutePath, 'utf8');
      if (filePath === 'package.json') content = extractCapacitorDeps(content);
      content = normalize(content);

      const fileHash = hashContent(content);
      combined.update(`${filePath}:${fileHash}`);
      fileHashes[filePath] = fileHash;
      details[filePath] = 'present';
    } else {
      // iOS files are optional — don't break the hash, just note as ios-missing
      const status = isIOS ? 'ios-missing' : 'missing';
      combined.update(`${filePath}:${status}`);
      fileHashes[filePath] = null;
      details[filePath] = status;
    }
  });

  return {
    hash: combined.digest('hex'),
    fileHashes,    // per-file SHA-256 — used for DIFF in admin panel
    details,       // presence status
    meta: CRITICAL_FILES,   // descriptions for UI
    generatedAt: Date.now(),
  };
}

// Allow running directly: node scripts/native-integrity.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = generateNativeHash();
  console.log('\n🔐 Combined hash:', result.hash);
  console.log('\n📂 Per-file hashes:');
  Object.entries(result.fileHashes).forEach(([f, h]) => {
    const status = h ? h.slice(0, 16) + '...' : `[${result.details[f]}]`;
    console.log(`  ${result.details[f] === 'present' ? '✅' : '⚠️ '} ${f.padEnd(55)} ${status}`);
  });
}
