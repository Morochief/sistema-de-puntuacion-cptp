import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Modify dist/sw.js
const swPath = path.join(__dirname, '..', 'dist', 'sw.js');

if (!fs.existsSync(swPath)) {
  console.warn('sw.js not found in dist. Make sure this script runs after astro build.');
  process.exit(0);
}

let content = fs.readFileSync(swPath, 'utf8');

// Generate unique hash based on timestamp
const timestamp = Date.now();
const cacheVersion = `cptp-scoring-cache-v${timestamp}`;

// Replace the hardcoded cache version
content = content.replace(/cptp-scoring-cache-v\d+/, cacheVersion);

// Write back
fs.writeFileSync(swPath, content);

console.log(`[PWA] Injected dynamic cache version: ${cacheVersion} into dist/sw.js`);
