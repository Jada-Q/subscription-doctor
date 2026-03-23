#!/usr/bin/env node

/**
 * Download OCR model files and WASM runtime to public/models/.
 * Run during build or after `npm install`:
 *   node scripts/download-models.mjs
 */

import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MODELS_DIR = join(ROOT, "public", "models");

// PaddleOCR v5 mobile models + dictionary
const PADDLE_BASE =
  "https://raw.githubusercontent.com/X3ZvaWQ/paddleocr.js/main/assets";
const REMOTE_FILES = [
  `${PADDLE_BASE}/PP-OCRv5_mobile_det_infer.onnx`,
  `${PADDLE_BASE}/PP-OCRv5_mobile_rec_infer.onnx`,
  `${PADDLE_BASE}/ppocrv5_dict.txt`,
];

// WASM files from onnxruntime-web (copy from node_modules)
const ORT_DIST = join(ROOT, "node_modules", "onnxruntime-web", "dist");
const LOCAL_COPY_FILES = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

async function downloadFile(url, dest, retries = 3) {
  if (existsSync(dest)) {
    console.log(`  [skip] ${dest.split("/").pop()} (already exists)`);
    return;
  }
  const filename = url.split("/").pop();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  [download] ${filename}... (attempt ${attempt}/${retries})`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const { writeFileSync } = await import("fs");
      writeFileSync(dest, buf);
      console.log(`  [done] ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
      return;
    } catch (err) {
      console.warn(`  [retry] ${filename} attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw new Error(`Failed to download ${filename} after ${retries} attempts`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function copyLocal(filename) {
  const src = join(ORT_DIST, filename);
  const dest = join(MODELS_DIR, filename);
  if (existsSync(dest)) {
    console.log(`  [skip] ${filename} (already exists)`);
    return;
  }
  if (!existsSync(src)) {
    console.warn(`  [warn] ${filename} not found in node_modules`);
    return;
  }
  copyFileSync(src, dest);
  console.log(`  [copy] ${filename}`);
}

async function main() {
  console.log("=== Downloading OCR models ===");
  mkdirSync(MODELS_DIR, { recursive: true });

  // Download PaddleOCR models
  for (const url of REMOTE_FILES) {
    const filename = url.split("/").pop();
    await downloadFile(url, join(MODELS_DIR, filename));
  }

  // Copy WASM files from node_modules
  console.log("\n=== Copying ONNX Runtime WASM ===");
  for (const file of LOCAL_COPY_FILES) {
    copyLocal(file);
  }

  console.log("\nAll model files ready in public/models/");
}

main().catch((err) => {
  console.error("Model download failed:", err.message);
  process.exit(1);
});
