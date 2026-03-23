#!/usr/bin/env node

/**
 * Generate simple PWA icons (blue circle with ¥ symbol).
 * Requires no external dependencies — uses built-in canvas-like SVG → PNG.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

function generateSvgIcon(size) {
  const r = size / 2;
  const fontSize = size * 0.45;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#2563eb"/>
  <text x="${r}" y="${r + fontSize * 0.35}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">¥</text>
</svg>`;
}

// Write SVG icons (browsers and PWA support SVG)
writeFileSync(join(PUBLIC, "icon.svg"), generateSvgIcon(512));

// Also write as favicon
writeFileSync(join(PUBLIC, "favicon.svg"), generateSvgIcon(32));

console.log("Icons generated: icon.svg, favicon.svg");
console.log("Note: For PNG icons (icon-192.png, icon-512.png), convert icon.svg using an image tool.");
