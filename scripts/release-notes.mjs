#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const repo = "https://github.com/Coursion-Studio/cue";

function usage(message) {
  if (message) console.error(`release-notes: ${message}`);
  console.error("usage: node scripts/release-notes.mjs <CHANGELOG.md> [--out releases.html] [--fragment <version>]");
  process.exit(1);
}

function escapeHTML(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function inline(text) {
  return text.split(/(`[^`]+`)/).map((part) => {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return `<code>${escapeHTML(part.slice(1, -1))}</code>`;
    return escapeHTML(part)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  }).join("");
}

function parse(markdown) {
  const releases = [];
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const m = heading[1].match(/^\[?v?(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\]?\s*(?:[—–-]\s*(\d{4}-\d{2}-\d{2}))?/);
      current = m && !/unreleased/i.test(heading[1]) ? { version: m[1], date: m[2] || "", lines: [] } : null;
      if (current) releases.push(current);
      continue;
    }
    if (/^#\s/.test(line)) { current = null; continue; }
    if (current) current.lines.push(line);
  }
  return releases.map((r) => ({ ...r, blocks: blocks(r.lines) }));
}

function blocks(lines) {
  const out = [];
  let para = null;
  let list = null;
  const flush = () => { if (para) out.push({ type: "p", text: para.join(" ") }); para = null; };
  const endList = () => { if (list) out.push({ type: "ul", items: list }); list = null; };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    const sub = line.match(/^###\s+(.*)$/);
    if (!line.trim()) { flush(); continue; }
    if (sub) { flush(); endList(); out.push({ type: "h3", text: sub[1] }); continue; }
    if (item) { flush(); list = list || []; list.push(item[1]); continue; }
    if (list && /^\s+/.test(raw)) { list[list.length - 1] += " " + line.trim(); continue; }
    endList();
    para = para || [];
    para.push(line.trim());
  }
  flush();
  endList();
  return out;
}

function fragment(release, indent = "") {
  return release.blocks.map((b) => {
    if (b.type === "p") return `${indent}<p>${inline(b.text)}</p>`;
    if (b.type === "h3") return `${indent}<h3>${inline(b.text)}</h3>`;
    return `${indent}<ul>\n${b.items.map((i) => `${indent}<li>${inline(i)}</li>`).join("\n")}\n${indent}</ul>`;
  }).join("\n");
}

function longDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

function stylesheets() {
  const index = readFileSync(join(root, "index.html"), "utf8");
  const links = index.match(/<link rel="stylesheet" href="[^"]+" \/>/g) || [];
  return links.map((l) => `  ${l}`).join("\n");
}

function version(file) {
  return createHash("sha1").update(readFileSync(join(root, file))).digest("hex").slice(0, 10);
}

function page(releases) {
  const latest = releases[0];
  const articles = releases.map((r, i) => {
    const tag = `v${r.version}`;
    const date = r.date ? `<time datetime="${r.date}">${longDate(r.date)}</time>` : "";
    const badge = i === 0 ? `<span class="release-latest">Latest</span>` : "";
    return `      <article class="release" id="${tag}" aria-labelledby="${tag}-title">
        <header class="release-head">
          <h2 id="${tag}-title"><a href="#${tag}">${escapeHTML(r.version)}</a></h2>
          ${badge}${date}
          <a class="release-link" href="${repo}/releases/tag/${tag}">GitHub release</a>
        </header>
${fragment(r, "        ")}
      </article>`;
  }).join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Release notes — Cue</title>
  <meta name="description" content="What changed in each version of Cue, the native macOS terminal. Latest: ${escapeHTML(latest.version)}." />
  <link rel="canonical" href="https://cue.coursion.studio/releases.html" />
  <link rel="icon" type="image/png" href="favicon.png" />
  <link rel="apple-touch-icon" href="apple-touch-icon.png" />
${stylesheets()}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Cue" />
  <meta property="og:url" content="https://cue.coursion.studio/releases.html" />
  <meta property="og:title" content="Release notes — Cue" />
  <meta property="og:description" content="What changed in each version of Cue. Latest: ${escapeHTML(latest.version)}." />
  <meta property="og:image" content="https://cue.coursion.studio/og.jpg?v=${version("og.jpg")}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#0E1224" />
</head>
<body class="legal-page">
  <div class="legal-glow" aria-hidden="true"></div>
  <div class="container">
    <nav class="top">
      <a class="brand" href="./"><img src="icon.png" alt="" width="26" height="26" /><span>Cue</span></a>
      <div class="links">
        <a href="./">Home</a>
        <a class="keep" href="./#download">Download</a>
      </div>
    </nav>

    <main class="legal notes">
      <p class="eyebrow">Release notes</p>
      <h1>What's new in Cue</h1>
      <p class="lede">Every version, newest first. Cue checks for updates once a day, or choose <b>Check for Updates…</b> in the Cue menu.</p>

${articles}
    </main>

    <footer class="foot">
      <div class="foot-row">
        <p class="foot-brand"><img src="icon.png" alt="" width="20" height="20" /><span>© ${new Date().getFullYear()} Coursion Studio</span></p>
        <nav class="foot-links" aria-label="Footer">
          <a href="./">Home</a>
          <a href="./#download">Download</a>
          <a href="privacy.html">Privacy</a>
          <a href="${repo}/issues/new/choose">Feedback and bugs</a>
          <a href="https://coursion.studio">Coursion Studio</a>
        </nav>
      </div>
    </footer>
  </div>
</body>
</html>
`;
}

const args = process.argv.slice(2);
let changelog = null;
let out = join(root, "releases.html");
let only = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = resolve(args[++i] || usage("--out needs a path"));
  else if (args[i] === "--fragment") only = args[++i] || usage("--fragment needs a version");
  else if (args[i].startsWith("-")) usage(`unknown option ${args[i]}`);
  else changelog = args[i];
}
if (!changelog) usage();

const releases = parse(readFileSync(resolve(changelog), "utf8"));
if (!releases.length) usage(`no "## x.y.z — date" sections in ${changelog}`);

if (only) {
  const release = releases.find((r) => r.version === only.replace(/^v/, ""));
  if (!release) usage(`no section for ${only}`);
  process.stdout.write(fragment(release) + "\n");
} else {
  writeFileSync(out, page(releases));
  console.log(`release-notes: wrote ${releases.length} version${releases.length === 1 ? "" : "s"} (latest ${releases[0].version}) to ${out}`);
}
