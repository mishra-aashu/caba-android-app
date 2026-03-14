/**
 * native-integrity.js
 * 
 * Utility script to generate a SHA-256 hash of critical native files.
 * This ensures the Admin Dashboard can detect if the native Android project
 * has been modified and requires a new APK build.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// List of critical files that define the "Native State" of the app
const CRITICAL_FILES = [
  'capacitor.config.ts',
  'package.json', // We extract only capacitor dependencies
  'android/app/src/main/AndroidManifest.xml',
  'android/app/build.gradle',
  'android/variables.gradle',
  'android/gradle.properties',             // JVM args, AndroidX flags
  'android/app/proguard-rules.pro',        // Code shrinking rules
  'android/app/src/main/res/values/strings.xml'  // App name & display strings
];

/**
 * Normalizes file content for consistent hashing across OS (CRLF vs LF)
 */
function normalizeContent(content) {
  return content.replace(/\r\n/g, '\n').trim();
}

/**
 * Extracts and stringifies only the Capacitor dependencies from package.json
 * We don't want a UI change (new react package) to trigger a native rebuild.
 */
function getCapacitorDeps(packageJsonContent) {
  try {
    const pkg = JSON.parse(packageJsonContent);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const capDeps = {};
    
    // Sort keys for consistent JSON stringification
    Object.keys(deps)
      .filter(key => key.startsWith('@capacitor/') || key.includes('capacitor-plugin'))
      .sort()
      .forEach(key => {
        capDeps[key] = deps[key];
      });
      
    return JSON.stringify(capDeps);
  } catch (e) {
    console.warn('[Integrity] Failed to parse package.json for deps stripping');
    return packageJsonContent;
  }
}

export function generateNativeHash() {
  const hash = crypto.createHash('sha256');
  const details = {};

  CRITICAL_FILES.forEach(filePath => {
    const absolutePath = path.join(rootDir, filePath);
    
    if (fs.existsSync(absolutePath)) {
      let content = fs.readFileSync(absolutePath, 'utf8');
      
      // Special handling for package.json
      if (filePath === 'package.json') {
        content = getCapacitorDeps(content);
      }
      
      content = normalizeContent(content);
      hash.update(`${filePath}:${content}`);
      details[filePath] = 'present';
    } else {
      hash.update(`${filePath}:MISSING`);
      details[filePath] = 'missing';
    }
  });

  const finalHash = hash.digest('hex');
  return { hash: finalHash, details };
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(generateNativeHash(), null, 2));
}
