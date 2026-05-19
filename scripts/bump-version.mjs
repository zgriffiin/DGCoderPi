#!/usr/bin/env node
/**
 * Bump the version across all manifest files (package.json, Cargo.toml, tauri.conf.json).
 *
 * Usage:
 *   node scripts/bump-version.mjs <version>
 *
 * Example:
 *   node scripts/bump-version.mjs 0.1.0-alpha.2
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const version = process.argv[2];
if (!version) {
	console.error('Usage: node scripts/bump-version.mjs <version>');
	process.exit(1);
}

// Validate semver-ish format (allows pre-release tags)
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
	console.error(`Invalid version format: ${version}`);
	console.error('Expected: major.minor.patch or major.minor.patch-prerelease');
	process.exit(1);
}

// --- package.json ---
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const oldPkgVersion = pkg.version;
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
console.log(`package.json: ${oldPkgVersion} → ${version}`);

// --- src-tauri/Cargo.toml ---
const cargoPath = resolve(root, 'src-tauri/Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf-8');
const cargoMatch = cargo.match(/^version\s*=\s*"([^"]+)"/m);
const oldCargoVersion = cargoMatch ? cargoMatch[1] : 'unknown';
cargo = cargo.replace(/^(version\s*=\s*")([^"]+)(")/m, `$1${version}$3`);
writeFileSync(cargoPath, cargo);
console.log(`Cargo.toml:   ${oldCargoVersion} → ${version}`);

// --- src-tauri/tauri.conf.json ---
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
const oldTauriVersion = tauriConf.version;
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, '\t') + '\n');
console.log(`tauri.conf:   ${oldTauriVersion} → ${version}`);

console.log(`\nAll manifests updated to ${version}`);
