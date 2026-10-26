#!/usr/bin/env node
/**
 * Version sync guard: package.json, src-tauri/Cargo.toml and
 * src-tauri/tauri.conf.json must declare the SAME application version.
 * Inconsistency shipped 0.6.2 artifact names while the app was 0.6.3.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
const tauriConf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));

const versions = {
  "package.json": pkg.version,
  "src-tauri/Cargo.toml": cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
  "src-tauri/tauri.conf.json": tauriConf.version,
};

const values = new Set(Object.values(versions));
if (values.size > 1 || [...values].some((v) => !v)) {
  console.error("❌ Version mismatch across manifests:");
  for (const [file, v] of Object.entries(versions)) {
    console.error(`   ${file}: ${v ?? "<missing>"}`);
  }
  process.exit(1);
}

console.log(`✅ All manifests agree on version ${[...values][0]}`);
