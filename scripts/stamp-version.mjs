#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2] || process.env.VERSION;

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: node scripts/stamp-version.mjs <x.y.z>   (or set VERSION)");
  process.exit(1);
}

const file = join(root, "index.html");
const before = readFileSync(file, "utf8");
const rules = [
  [/("softwareVersion":\s*")\d+\.\d+\.\d+(")/g, `$1${version}$2`],
  [/(releases\/tag\/v)\d+\.\d+\.\d+(">Version )\d+\.\d+\.\d+(<)/g, `$1${version}$2${version}$3`],
];

let after = before;
for (const [pattern, replacement] of rules) {
  if (!pattern.test(after)) {
    console.error(`stamp-version: no match for ${pattern} in index.html`);
    process.exit(1);
  }
  pattern.lastIndex = 0;
  after = after.replace(pattern, replacement);
}

if (after === before) {
  console.log(`stamp-version: index.html already says ${version}`);
} else {
  writeFileSync(file, after);
  console.log(`stamp-version: index.html now says ${version}`);
}
