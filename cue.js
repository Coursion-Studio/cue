(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const frozen = new URLSearchParams(location.search).has("static");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () => frozen || still.matches;
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  $$(".brew").forEach((box) => {
    const btn = $(".brew-copy", box);
    const label = $("span", btn);
    let timer = 0;
    btn.addEventListener("click", () => {
      const text = box.dataset.copy;
      const done = () => {
        box.classList.add("copied");
        label.textContent = "Copied";
        clearTimeout(timer);
        timer = setTimeout(() => { box.classList.remove("copied"); label.textContent = "Copy"; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => select(box));
      else select(box);
    });
  });
  function select(box) {
    const range = document.createRange();
    range.selectNodeContents($("code", box));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const term = $("[data-term]");
  if (!term) return;

  const list = $(".term-cards", term);
  const input = $(".cmp-input", term);
  const menu = $(".cmp-menu", term);
  const ghostTyped = $(".cmp-ghost-typed", term);
  const ghostRest = $(".cmp-ghost-rest", term);
  const fail = $(".cmp-fail", term);
  const failText = $(".cmp-fail-t", term);
  const themeLabel = $(".term-theme", term);
  const pathChip = $(".chip.path", term);

  const THEMES = [
    { id: "forge-night", name: "Forge Night" },
    { id: "tokyo-night", name: "Tokyo Night" },
    { id: "catppuccin-mocha", name: "Catppuccin Mocha" },
    { id: "forge-dawn", name: "Forge Dawn" }
  ];
  const SLASH = [
    { id: "ask", sub: "Describe it, get a command" },
    { id: "explain", sub: "Explain the last failed command" },
    { id: "history", sub: "Search every command you ran" },
    { id: "snippets", sub: "Saved commands with placeholders" },
    { id: "cd", sub: "Fuzzy jump to a recent folder" },
    { id: "theme", sub: "Pick a theme with a live preview" },
    { id: "clear", sub: "Clear the screen and the blocks" }
  ];
  const FOLDERS = ["orbit", "lumen", "notes-api"];
  const SUGGEST = ["git status -sb", "git log --oneline -3", "make test", "ls", "pwd", "echo hello", "clear"];

  const OUT = {
    "git status -sb": () => ({ out: '<span class="g">## main</span>\n <span class="r">M</span> src/api.ts\n<span class="r">??</span> src/cache.ts', ms: 32 }),
    "git status": () => ({ out: 'On branch <span class="g">main</span>\nChanges not staged for commit:\n\t<span class="r">modified:   src/api.ts</span>\nUntracked files:\n\t<span class="r">src/cache.ts</span>', ms: 41 }),
    "ls": () => ({ out: 'CHANGES.md   Makefile   README.md   package.json   <span class="b">scripts</span>   <span class="b">src</span>   <span class="b">tests</span>', ms: 24 }),
    "git log --oneline -3": () => ({ out: '<span class="y">5873630</span> (<span class="c">HEAD -&gt;</span> <span class="g">main</span>) Add a TTL to the cache\n<span class="y">adeb42b</span> Write the store atomically\n<span class="y">e7504ca</span> Retry API calls on 503', ms: 35 }),
    "make test": () => ({
      out: '<span class="d">orbit@1.3.2 test</span>\n <span class="g">✓</span> config  parses orbit.toml <span class="d">(4 ms)</span>\n <span class="g">✓</span> api     retries on 503 <span class="d">(212 ms)</span>\n <span class="g">✓</span> store   writes atomically <span class="d">(18 ms)</span>\n <span class="r">✗</span> cache   expires stale entries <span class="d">(1003 ms)</span>\n\n   <span class="r">Expected:</span> 0 entries\n   <span class="r">Received:</span> 2 entries\n\nTests: <span class="r">1 failed</span>, <span class="g">3 passed</span>, 4 total\nmake: *** [test] Error 1',
      ms: 820, code: 2
    })
  };

  let theme = 0, path = "orbit", lastFail = null, touched = false, auto = 0;
  let matches = [], sel = 0, recall = -1;
  const ran = [];

  function card({ cmd, out, ms, code = 0, kind = "", meta = "" }) {
    const el = document.createElement("div");
    el.className = "card" + (kind ? " " + kind : code ? " fail" : "");
    const [head, ...rest] = cmd.split(" ");
    const time = ms < 1000 ? ms + "ms" : (ms / 1000).toFixed(1) + "s";
    const pill = kind === "ai" ? `<span class="pill ai">${meta}</span>`
      : code ? `<span class="pill bad">✕ exit ${code} ${time}</span>` : `<span class="pill ok">✓ ${time}</span>`;
    el.innerHTML = `<div class="card-head"><span class="card-cmd">${esc(head)} <span>${esc(rest.join(" "))}</span></span>` +
      `<span class="card-meta"><span class="path">~/Projects/${path}</span>${pill}</span></div>` +
      (out ? `<pre class="card-out${kind === "ai" ? " prose" : ""}">${out}</pre>` : "");
    if (!calm()) el.classList.add("enter");
    list.appendChild(el);
    while (list.children.length > 6) list.firstElementChild.remove();
    if (!calm()) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("enter")));
    return el;
  }
  function failed(cmd, code) {
    lastFail = cmd;
    failText.textContent = `exit ${code} · ${cmd}`;
    fail.hidden = false;
  }

  function run(raw) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text) return;
    ran.push(text);
    recall = -1;
    if (text.startsWith("/")) return slash(text);
    if (text === "clear") return clear();
    const word = text.split(" ")[0];
    if (OUT[text]) {
      const r = OUT[text]();
      card({ cmd: text, ...r });
      if (r.code) failed(text, r.code); else fail.hidden = true;
      return;
    }
    fail.hidden = true;
    if (word === "pwd") return card({ cmd: text, out: "/Users/you/Projects/" + path, ms: 3 });
    if (word === "echo") return card({ cmd: text, out: esc(text.slice(5)), ms: 2 });
    if (word === "cd") return cd(text.slice(3));
    card({ cmd: text, out: `zsh: command not found: ${esc(word)}\n<span class="d">This page only knows a few commands: git status, ls, make test, pwd, echo. Cue runs anything your shell can.</span>`, ms: 9, code: 127 });
    lastFail = text;
    failText.textContent = `exit 127 · ${text}`;
    fail.hidden = false;
  }

  function clear() {
    list.innerHTML = "";
    fail.hidden = true;
  }
  function cd(arg) {
    const name = (arg || "").trim().replace(/^~\/Projects\//, "").replace(/\/$/, "");
    const hit = FOLDERS.find((f) => f === name) || FOLDERS.find((f) => name && f.startsWith(name.toLowerCase()));
    if (!hit) {
      card({ cmd: "/cd", kind: "ai", meta: "Recent", out: FOLDERS.map((f) => `<span class="b">~/Projects/${f}</span>${f === path ? ' <span class="d">· here</span>' : ""}`).join("\n") + '\n<span class="d">Try /cd lumen</span>', ms: 0 });
      return;
    }
    path = hit;
    pathChip.textContent = "~/Projects/" + hit;
    $(".term-bar b", term).textContent = hit;
    card({ cmd: "cd ~/Projects/" + hit, ms: 1 });
  }
  function slash(text) {
    const [name, ...args] = text.slice(1).split(" ");
    const arg = args.join(" ");
    const id = (SLASH.find((s) => s.id === name) || SLASH.find((s) => name && s.id.startsWith(name)) || {}).id;
    if (id === "theme") {
      theme = (theme + 1) % THEMES.length;
      term.dataset.theme = THEMES[theme].id;
      themeLabel.textContent = THEMES[theme].name;
      return;
    }
    if (id === "clear") return clear();
    if (id === "cd") return cd(arg);
    if (id === "history") {
      const past = ["git status -sb", "make test", "npm run dev", "git log --oneline -3", "docker compose up -d", ...ran.filter((c) => !c.startsWith("/"))].reverse();
      const unique = [...new Set(past)].slice(0, 5);
      return card({ cmd: "/history", kind: "ai", meta: "⌃R", out: unique.map((c, i) => (i ? "" : "› ") + esc(c)).map((l, i) => i ? "  " + l : `<span class="b">${l}</span>`).join("\n"), ms: 0 });
    }
    if (id === "snippets") {
      return card({ cmd: "/snippets", kind: "ai", meta: "⇧⌘P", out: 'Release        <span class="d">./scripts/release.sh</span> <span class="y">{version}</span>\nTail the logs  <span class="d">kubectl logs -f</span> <span class="y">{pod}</span>\nFree a port    <span class="d">lsof -ti :</span><span class="y">{port}</span> <span class="d">| xargs kill</span>', ms: 0 });
    }
    if (id === "explain") {
      if (!lastFail) return card({ cmd: "/explain", kind: "ai", meta: "Claude", out: "Nothing has failed yet. Try make test first.", ms: 0 });
      if (lastFail !== "make test") return card({ cmd: "/explain", kind: "ai", meta: "Claude", out: `<b>${esc(lastFail.split(" ")[0])}</b> isn't a command on this page. On your Mac, Claude reads the failed card and tells you why it failed.`, ms: 0 });
      return card({ cmd: "/explain make test", kind: "ai", meta: "Sample answer", out: "The cache test expects stale entries to be gone after the TTL, but two are still there. <b>src/cache.ts</b> stores entries in a plain Map with no expiry. Save a timestamp with each entry and drop it on read when it's older than the TTL.", ms: 0 });
    }
    if (id === "ask") {
      const q = arg || "find files over 100 MB here";
      return card({ cmd: "/ask " + q, kind: "ai", meta: "Claude", out: `Describe it in plain words and Claude answers with a command you can read before you run it. This page doesn't call Claude; Cue uses your own key or <b>claude</b> CLI.`, ms: 0 });
    }
    card({ cmd: text, kind: "ai", meta: "Unknown", out: "No such action. Type / to see them all.", ms: 0 });
  }

  function filter(q) {
    const name = q.slice(1).split(" ")[0].toLowerCase();
    if (q.includes(" ")) return [];
    return SLASH.filter((s) => s.id.startsWith(name)).concat(SLASH.filter((s) => !s.id.startsWith(name) && name && s.id.includes(name)));
  }
  function render() {
    const v = input.value;
    if (v.startsWith("/")) {
      matches = filter(v);
      sel = Math.min(sel, Math.max(0, matches.length - 1));
      menu.innerHTML = "";
      matches.forEach((m, n) => {
        const li = document.createElement("li");
        li.id = "cmp-" + m.id;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", n === sel ? "true" : "false");
        li.innerHTML = `<b>/${m.id}</b><span>${m.sub}</span>`;
        li.addEventListener("mousedown", (e) => e.preventDefault());
        li.addEventListener("click", () => { sel = n; choose(); });
        menu.appendChild(li);
      });
      menu.hidden = !matches.length;
    } else {
      matches = [];
      menu.hidden = true;
    }
    input.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
    if (!menu.hidden && matches[sel]) input.setAttribute("aria-activedescendant", "cmp-" + matches[sel].id);
    else input.removeAttribute("aria-activedescendant");
    const hint = !v || v.startsWith("/") ? "" : (SUGGEST.find((s) => s.startsWith(v) && s !== v) || "");
    ghostTyped.textContent = hint ? v : "";
    ghostRest.textContent = hint ? hint.slice(v.length) : "";
  }
  function choose() {
    const m = matches[sel];
    if (!m) return;
    const wantsArg = m.id === "ask" || m.id === "cd";
    if (wantsArg && input.value.trim() === "/" + m.id + "") { input.value = "/" + m.id + " "; render(); return; }
    input.value = "";
    render();
    run("/" + m.id);
  }
  function stopAuto() { clearTimeout(auto); auto = 0; }
  function typeIn(text, focus) {
    stopAuto();
    if (calm()) { input.value = text; sel = 0; render(); if (focus) input.focus({ preventScroll: true }); return; }
    input.value = "";
    render();
    let n = 0;
    const step = () => {
      input.value = text.slice(0, ++n);
      render();
      if (n < text.length) auto = setTimeout(step, 70 + Math.random() * 50);
      else { auto = 0; if (focus) input.focus({ preventScroll: true }); }
    };
    auto = setTimeout(step, 140);
  }

  input.addEventListener("input", () => { touched = true; stopAuto(); sel = 0; render(); });
  input.addEventListener("focus", () => { touched = true; stopAuto(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!menu.hidden && matches.length) {
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
        render();
      } else if (ran.length) {
        recall = e.key === "ArrowUp" ? Math.min(ran.length - 1, recall + 1) : Math.max(-1, recall - 1);
        input.value = recall < 0 ? "" : ran[ran.length - 1 - recall];
        render();
      }
    } else if (e.key === "Tab") {
      if (!menu.hidden && matches[sel]) { e.preventDefault(); input.value = "/" + matches[sel].id + (["ask", "cd"].includes(matches[sel].id) ? " " : ""); render(); }
      else if (ghostRest.textContent) { e.preventDefault(); input.value += ghostRest.textContent; render(); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = input.value;
      if (!menu.hidden && matches[sel] && !v.includes(" ") && v !== "/" + matches[sel].id + " ") { choose(); return; }
      input.value = "";
      render();
      run(v);
    } else if (e.key === "Escape") {
      if (!menu.hidden || input.value) { e.preventDefault(); input.value = ""; render(); }
    }
  });
  $(".cmp-explain", term).addEventListener("click", () => { touched = true; run("/explain"); });
  $$(".chip-q").forEach((b) => b.addEventListener("click", () => { touched = true; sel = 0; typeIn(b.dataset.q, true); }));

  card({ cmd: "git status -sb", ...OUT["git status -sb"]() });
  const t = OUT["make test"]();
  card({ cmd: "make test", ...t });
  failed("make test", t.code);
  themeLabel.textContent = THEMES[0].name;
  ran.push("git status -sb", "make test");
  if (frozen) { input.value = "/"; render(); return; }
  render();

  if (window.Stage && window.Stage.watch) {
    window.Stage.watch(term, () => {
      if (touched || input.value) return;
      touched = true;
      if (calm()) { input.value = "/"; render(); return; }
      auto = setTimeout(() => typeIn("/", false), 600);
    }, null, 0.6);
  }
})();
