#!/usr/bin/env node
// The Rigging — infrastructure dashboard for The Ceremony
// Standalone Node.js server, zero dependencies

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { startStoryWatcher } = require("./story-watcher");

const PORT = parseInt(process.env.RIGGING_PORT || "3006");

// === Known apps registry (whitelist for PM2 controls — prevents arbitrary command execution) ===

const KNOWN_APPS = [
  { name: "ceremony",  cwd: "/home/claude/projects/story-game/web", script: "npm", args: ["start"], env: { PORT: "3004", KEEPER_URL: "http://localhost:3005" } },
  { name: "keeper",    cwd: "/home/claude/projects/story-game/keeper-service", script: "npx", args: ["tsx", "server.ts"], env: { KEEPER_PORT: "3005" } },
  { name: "rigging",   cwd: "/home/claude/projects/story-game/rigging", script: "node", args: ["server.js"], env: { RIGGING_PORT: "3006" } },
  { name: "dreizehn",  cwd: "/home/claude/projects/dreizehn", script: "build/index.js", args: [], env: { PORT: "3001" } },
  { name: "musiclist", cwd: "/home/claude/projects/MusicList", script: "build/index.js", args: [], env: { PORT: "3003" } },
];

const KNOWN_NAMES = new Set(KNOWN_APPS.map(a => a.name));

// ── Story data file watcher ──
const storyDataClients = new Set();

const storyWatcher = startStoryWatcher({
  configDir: path.resolve(__dirname, "../config"),
  memoryDir: path.resolve(__dirname, "../memory"),
  debounceMs: 300,
  onChanged: (event) => {
    const data = `event: story-data-changed\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of storyDataClients) {
      try { client.write(data); } catch { storyDataClients.delete(client); }
    }
    console.log(`[rigging] Broadcast story-data-changed to ${storyDataClients.size} client(s)`);

    // Also invalidate the web app's API cache (best-effort)
    try {
      const http = require("http");
      const req = http.request({
        hostname: "localhost", port: 3004,
        path: "/the-ceremony/api/story-data",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, () => {});
      req.on("error", () => {});
      req.write(JSON.stringify({ action: "invalidate" }));
      req.end();
    } catch { /* best-effort */ }
  },
});

// === System scanning (all commands use execFileSync — no shell injection) ===

function run(cmd, args = [], timeout = 5000) {
  try {
    return execFileSync(cmd, args, { timeout, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function runSudo(cmd, args = [], timeout = 5000) {
  return run("sudo", [cmd, ...args], timeout);
}

function scanWireGuard() {
  const raw = runSudo("wg", ["show", "wg0"]);
  if (!raw) return { up: false };

  const handshake = raw.match(/latest handshake:\s*(.+)/)?.[1] || null;
  const transfer = raw.match(/transfer:\s*(.+)/)?.[1] || null;
  const endpoint = raw.match(/endpoint:\s*(.+)/)?.[1] || null;
  const pubkey = raw.match(/public key:\s*(.+)/)?.[1] || null;
  const peerKey = raw.match(/peer:\s*(.+)/)?.[1] || null;
  const keepalive = raw.match(/persistent keepalive:\s*(.+)/)?.[1] || null;

  return {
    up: true,
    pubkey,
    peerKey,
    endpoint,
    handshake,
    transfer,
    keepalive,
  };
}

function scanPorts() {
  const raw = run("ss", ["-tlnp"]);
  if (!raw) return [];

  return raw
    .split("\n")
    .slice(1)
    .map((line) => {
      const parts = line.split(/\s+/);
      const local = parts[3] || "";
      const proc = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      return {
        address: local,
        process: proc?.[1] || "unknown",
        pid: proc?.[2] || null,
      };
    })
    .filter((p) => p.address);
}

function scanPM2() {
  const raw = run("pm2", ["jlist"]);
  const processes = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.forEach((p) => {
        processes.push({
          name: p.name,
          pid: p.pid,
          status: p.pm2_env?.status || "unknown",
          restarts: p.pm2_env?.restart_time || 0,
          uptime: p.pm2_env?.pm_uptime || null,
          memory: p.monit?.memory || 0,
          cpu: p.monit?.cpu || 0,
        });
      });
    } catch {}
  }

  // Add missing known apps so the UI can show "Start" for them
  const active = new Set(processes.map(p => p.name));
  KNOWN_APPS.forEach(app => {
    if (!active.has(app.name)) {
      processes.push({
        name: app.name,
        pid: null,
        status: "missing",
        restarts: 0,
        uptime: null,
        memory: 0,
        cpu: 0,
      });
    }
  });

  return processes;
}

function scanCaddyRoutes() {
  const raw = run("cat", ["/etc/caddy/Caddyfile"]);
  if (!raw) return { raw: null, routes: [] };

  const routes = [];
  const handleRegex = /handle\s+(\/\S+)\s*\{[^}]*reverse_proxy\s+(\S+)/g;
  let match;
  while ((match = handleRegex.exec(raw)) !== null) {
    routes.push({ path: match[1], upstream: match[2] });
  }

  const siteRegex = /^(http:\/\/[^\s{]+|:[^\s{]+)\s*\{/gm;
  const sites = [];
  while ((match = siteRegex.exec(raw)) !== null) {
    sites.push(match[1]);
  }

  return { sites, routes, raw };
}

function scanFirewall() {
  const raw = runSudo("iptables", ["-L", "INPUT", "-n", "--line-numbers"]);
  if (!raw) return [];

  return raw
    .split("\n")
    .slice(2)
    .filter((l) => l.includes("3080"))
    .map((l) => l.trim());
}

async function checkHealth(url, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith("https") ? require("https") : require("http");
    const req = mod.get(url, { timeout }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        resolve({
          url,
          status: res.statusCode,
          ms: Date.now() - start,
          ok: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });
    req.on("error", () =>
      resolve({ url, status: 0, ms: Date.now() - start, ok: false })
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ url, status: 0, ms: timeout, ok: false });
    });
  });
}

async function fullScan() {
  const wireguard = scanWireGuard();
  const ports = scanPorts();
  const pm2 = scanPM2();
  const caddy = scanCaddyRoutes();
  const firewall = scanFirewall();

  const healthChecks = await Promise.all([
    checkHealth("http://localhost:3004/the-ceremony"),
    checkHealth("http://localhost:3005/health"),
    checkHealth("http://10.0.0.2:3080/the-ceremony"),
    checkHealth("https://kaltenbach.dev/the-ceremony/"),
    checkHealth("https://kaltenbach.dev/sandbox/dreizehn/"),
    checkHealth("https://kaltenbach.dev/sandbox/MusicList/"),
    checkHealth("https://kaltenbach.dev/"),
  ]);

  return {
    timestamp: new Date().toISOString(),
    hostname: run("hostname") || "unknown",
    uptime: run("uptime", ["-p"]) || "unknown",
    wireguard,
    ports,
    pm2,
    caddy,
    firewall,
    health: healthChecks,
  };
}

// === Helpers ===

function escHtmlServer(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// === Viz autodiscovery ===

const VIZ_DIR = path.resolve(__dirname, "../web/public/");
let vizCache = [];      // ordered list for iteration
let vizBySlug = new Map(); // slug → entry for O(1) lookup

function scanVizPages() {
  try {
    const entries = fs.readdirSync(VIZ_DIR).filter(f => {
      if (!f.endsWith(".html")) return false;
      if (f.startsWith("_")) return false;
      if (f === "index.html") return false;
      return true;
    });

    const results = [];
    for (const filename of entries) {
      const filepath = path.join(VIZ_DIR, filename);
      const slug = filename.replace(/\.html$/, "");

      // Read first 500 bytes to look for VIZ-META comment
      let title = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      let description = "";
      let category = "uncategorized";

      try {
        const fd = fs.openSync(filepath, "r");
        const buf = Buffer.alloc(500);
        const bytesRead = fs.readSync(fd, buf, 0, 500, 0);
        fs.closeSync(fd);

        const head = buf.toString("utf-8", 0, bytesRead);
        const metaMatch = head.match(/<!--\s*VIZ-META\s+(\{.*?\})\s*-->/);
        if (metaMatch) {
          try {
            const meta = JSON.parse(metaMatch[1]);
            if (meta.title) title = meta.title;
            if (meta.description) description = meta.description;
            if (meta.category) category = meta.category;
          } catch { /* ignore malformed JSON */ }
        }
      } catch { /* file read error, use defaults */ }

      results.push({ slug, filename, filepath, title, description, category });
    }

    vizCache = results;
    vizBySlug = new Map(results.map(v => [v.slug, v]));
  } catch (err) {
    console.error("[The Rigging] Viz scan error:", err.message);
  }
}

// Initial scan + periodic rescan
scanVizPages();
setInterval(scanVizPages, 60000);

// === Dashboard HTML ===

function renderDashboard() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Rigging</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0a0e17;
    --surface: #131a2b;
    --surface-light: #1c2640;
    --accent: #c4a35a;
    --ice: #7ba4c7;
    --keeper: #6b9e7a;
    --danger: #8b3a3a;
    --border: #1e2d44;
    --muted: #8b9bb4;
    --fg: #e8dcc8;
    --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.5;
    padding: 0;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .header h1 {
    font-size: 16px;
    color: var(--accent);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 400;
  }
  .header .meta {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .pulse {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--keeper);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(107,158,122,0.4); }
    50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(107,158,122,0); }
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--border);
    padding: 1px;
  }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .card {
    background: var(--surface);
    padding: 16px 20px;
  }
  .card-title {
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-title .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-ok { background: var(--keeper); }
  .dot-warn { background: var(--accent); }
  .dot-err { background: var(--danger); }
  .dot-off { background: var(--muted); opacity: 0.3; }

  /* Topology */
  .topo {
    display: flex;
    align-items: center;
    gap: 0;
    justify-content: center;
    flex-wrap: wrap;
    padding: 8px 0;
  }
  .topo-node {
    background: var(--surface-light);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    text-align: center;
    min-width: 100px;
  }
  .topo-node .label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .topo-node .value {
    font-size: 12px;
    color: var(--fg);
    margin-top: 2px;
  }
  .topo-arrow {
    color: var(--accent);
    font-size: 14px;
    padding: 0 6px;
    flex-shrink: 0;
  }
  .topo-arrow.wg { color: var(--keeper); }

  /* Tables */
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 4px 8px 6px;
    border-bottom: 1px solid var(--border);
    font-weight: 400;
  }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid rgba(30,45,68,0.4);
    font-size: 12px;
  }
  tr:last-child td { border-bottom: none; }
  .status-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    letter-spacing: 0.05em;
  }
  .badge-ok { background: rgba(107,158,122,0.15); color: var(--keeper); border: 1px solid rgba(107,158,122,0.3); }
  .badge-warn { background: rgba(196,163,90,0.15); color: var(--accent); border: 1px solid rgba(196,163,90,0.3); }
  .badge-err { background: rgba(139,58,58,0.15); color: #c75050; border: 1px solid rgba(139,58,58,0.3); }
  .badge-off { background: rgba(139,155,180,0.1); color: var(--muted); border: 1px solid rgba(139,155,180,0.2); }

  .mono { font-family: var(--mono); }
  .dim { color: var(--muted); opacity: 0.6; }
  .ice { color: var(--ice); }
  .accent { color: var(--accent); }
  .keeper { color: var(--keeper); }

  /* Full-width cards */
  .card.full { grid-column: 1 / -1; }

  /* Firewall rules */
  .fw-rule {
    font-size: 11px;
    padding: 3px 8px;
    background: var(--surface-light);
    border-left: 2px solid var(--keeper);
    margin-bottom: 4px;
    font-family: var(--mono);
  }
  .fw-rule.drop {
    border-left-color: var(--danger);
  }

  /* Loading */
  .loading {
    text-align: center;
    padding: 40px;
    color: var(--muted);
    font-style: italic;
  }
  #error-banner {
    display: none;
    background: rgba(139,58,58,0.2);
    border-bottom: 1px solid rgba(139,58,58,0.3);
    color: #c75050;
    padding: 8px 24px;
    font-size: 11px;
  }

  /* PM2 control buttons */
  .pm2-btn {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 3px;
    font-size: 10px;
    letter-spacing: 0.05em;
    font-family: var(--mono);
    cursor: pointer;
    border: 1px solid;
    background: transparent;
    margin-left: 3px;
    transition: opacity 0.15s;
  }
  .pm2-btn:hover { opacity: 0.8; }
  .pm2-btn:active { opacity: 0.6; }
  .pm2-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .pm2-btn-start { color: var(--keeper); border-color: rgba(107,158,122,0.4); }
  .pm2-btn-start:hover { background: rgba(107,158,122,0.1); }
  .pm2-btn-stop { color: #c75050; border-color: rgba(139,58,58,0.4); }
  .pm2-btn-stop:hover { background: rgba(139,58,58,0.1); }
  .pm2-btn-restart { color: var(--accent); border-color: rgba(196,163,90,0.4); }
  .pm2-btn-restart:hover { background: rgba(196,163,90,0.1); }
</style>
</head>
<body>

<div class="header">
  <h1>The Rigging</h1>
  <div class="meta">
    <span id="hostname"></span>
    <span id="uptime"></span>
    <span><span class="pulse"></span></span>
    <span id="timestamp"></span>
  </div>
</div>
<div id="error-banner"></div>
<div id="dashboard" class="loading">Scanning infrastructure...</div>

<script>
const POLL_INTERVAL = 5000;

function formatUptime(ms) {
  if (!ms) return '?';
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
  return Math.floor(sec / 86400) + 'd ' + Math.floor((sec % 86400) / 3600) + 'h';
}

function formatBytes(b) {
  if (!b || b === 0) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(1) + ' GB';
}

function badge(text, type) {
  return '<span class="status-badge badge-' + type + '">' + text + '</span>';
}

function dot(type) {
  return '<span class="dot dot-' + type + '"></span>';
}

function healthBadge(h) {
  if (!h) return badge('??', 'off');
  if (h.ok) return badge(h.status + ' ' + h.ms + 'ms', 'ok');
  if (h.status > 0) return badge(h.status + ' ' + h.ms + 'ms', 'err');
  return badge('down', 'err');
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function pm2Btn(action, name) {
  const label = action.charAt(0).toUpperCase() + action.slice(1);
  return '<button class="pm2-btn pm2-btn-' + action + '" onclick="pm2Control(\\'' + action + '\\',\\'' + name + '\\', this)">' + label + '</button>';
}

async function pm2Control(action, name, btn) {
  if (btn) btn.disabled = true;
  try {
    const basePath = window.location.pathname.replace(/\\/$/, '');
    const res = await fetch(basePath + '/api/pm2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, name }),
    });
    const result = await res.json();
    if (!result.ok) {
      alert('PM2 action failed: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    alert('PM2 action failed: ' + err.message);
  }
  // Re-poll after action to refresh display
  setTimeout(poll, 500);
}

function knownPortLabel(addr) {
  const labels = {
    '3004': 'ceremony (Next.js)',
    '3005': 'keeper (Claude API)',
    '3006': 'rigging (this)',
    '3080': 'caddy gateway',
    '8080': 'gamedev static',
    '3001': 'dreizehn (SvelteKit)',
    '3002': 'projects-index',
    '3003': 'MusicList (SvelteKit)',
    '22':   'SSH',
    '53':   'DNS resolver',
    '631':  'CUPS (printing)',
    '2019': 'Caddy admin API',
    '8888': 'orphan python',
    '9222': 'Chrome DevTools',
    '51820': 'WireGuard',
  };
  const port = addr.split(':').pop();
  return labels[port] || '';
}

function bindIcon(addr) {
  if (addr.startsWith('127.0.0.1') || addr.includes('lo:')) return '<span title="localhost only" class="keeper">local</span>';
  if (addr.startsWith('10.0.0.2')) return '<span title="WireGuard only" class="keeper">wg</span>';
  if (addr.startsWith('0.0.0.0') || addr.startsWith('*:') || addr.startsWith('[::]:'))
    return '<span title="all interfaces" class="accent">public</span>';
  return '';
}

function render(data) {
  document.getElementById('hostname').textContent = data.hostname;
  document.getElementById('uptime').textContent = data.uptime;
  document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleTimeString();

  const wg = data.wireguard;
  const pm2 = data.pm2 || [];
  const ports = data.ports || [];
  const caddy = data.caddy || {};
  const fw = data.firewall || [];
  const health = data.health || [];

  let html = '<div class="grid">';

  // === Topology (full width) ===
  html += '<div class="card full">';
  html += '<div class="card-title">' + dot(wg.up ? 'ok' : 'err') + ' Network Topology</div>';
  html += '<div class="topo">';
  html += '<div class="topo-node"><div class="label">User</div><div class="value">Browser</div></div>';
  html += '<div class="topo-arrow">--HTTPS--&gt;</div>';
  html += '<div class="topo-node"><div class="label">Gateway</div><div class="value ice">kaltenbach.dev</div><div class="dim" style="font-size:10px">159.69.148.166 nginx</div></div>';
  html += '<div class="topo-arrow wg">==WG==&gt;</div>';
  html += '<div class="topo-node"><div class="label">Dev Server</div><div class="value accent">10.0.0.2:3080</div><div class="dim" style="font-size:10px">46.62.231.96 Caddy</div></div>';
  html += '<div class="topo-arrow">--&gt;</div>';
  html += '<div class="topo-node"><div class="label">Apps</div><div class="value keeper">:3004 :3001 :3003</div></div>';
  html += '</div>';
  html += '</div>';

  // === WireGuard ===
  html += '<div class="card">';
  html += '<div class="card-title">' + dot(wg.up && wg.handshake ? 'ok' : wg.up ? 'warn' : 'err') + ' WireGuard Tunnel</div>';
  if (wg.up) {
    html += '<table>';
    html += '<tr><td class="dim">Interface</td><td>wg0 &nbsp;' + badge('UP', 'ok') + '</td></tr>';
    html += '<tr><td class="dim">Local</td><td>10.0.0.2</td></tr>';
    html += '<tr><td class="dim">Peer</td><td>' + escHtml(wg.endpoint) + '</td></tr>';
    html += '<tr><td class="dim">Handshake</td><td>' + (wg.handshake ? escHtml(wg.handshake) : badge('none', 'warn')) + '</td></tr>';
    html += '<tr><td class="dim">Transfer</td><td>' + escHtml(wg.transfer) + '</td></tr>';
    html += '<tr><td class="dim">Keepalive</td><td>' + escHtml(wg.keepalive) + '</td></tr>';
    html += '</table>';
  } else {
    html += '<p>' + badge('DOWN', 'err') + ' Interface not found</p>';
  }
  html += '</div>';

  // === PM2 Processes ===
  html += '<div class="card">';
  const pm2Running = pm2.filter(p => p.status !== 'missing');
  html += '<div class="card-title">' + dot(pm2Running.length > 0 && pm2Running.every(p => p.status === 'online') ? 'ok' : 'warn') + ' PM2 Processes</div>';
  html += '<table>';
  html += '<tr><th>Name</th><th>Status</th><th>PID</th><th>Mem</th><th>Uptime</th><th>Actions</th></tr>';
  pm2.forEach(p => {
    let st, actions;
    if (p.status === 'online') {
      st = badge('online', 'ok');
      actions = pm2Btn('stop', p.name) + pm2Btn('restart', p.name);
    } else if (p.status === 'stopped') {
      st = badge('stopped', 'off');
      actions = pm2Btn('start', p.name);
    } else if (p.status === 'missing') {
      st = badge('not in pm2', 'warn');
      actions = pm2Btn('start', p.name);
    } else {
      st = badge(p.status, 'err');
      actions = pm2Btn('start', p.name) + pm2Btn('stop', p.name);
    }
    html += '<tr>';
    html += '<td>' + escHtml(p.name) + '</td>';
    html += '<td>' + st + '</td>';
    html += '<td class="dim">' + (p.pid || '-') + '</td>';
    html += '<td>' + formatBytes(p.memory) + '</td>';
    html += '<td>' + formatUptime(p.uptime) + '</td>';
    html += '<td>' + actions + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  html += '</div>';

  // === Caddy Routes ===
  html += '<div class="card">';
  html += '<div class="card-title">' + dot('ok') + ' Caddy Routes</div>';
  if (caddy.sites) {
    caddy.sites.forEach(s => {
      html += '<div style="margin-bottom:8px"><span class="accent">' + escHtml(s) + '</span></div>';
    });
  }
  html += '<table>';
  html += '<tr><th>Path</th><th>Upstream</th></tr>';
  (caddy.routes || []).forEach(r => {
    html += '<tr><td>' + escHtml(r.path) + '</td><td class="keeper">' + escHtml(r.upstream) + '</td></tr>';
  });
  html += '</table>';
  html += '</div>';

  // === Port Map ===
  html += '<div class="card">';
  html += '<div class="card-title">' + dot('ok') + ' Port Map</div>';
  html += '<table>';
  html += '<tr><th>Address</th><th>Bind</th><th>Process</th><th>Role</th></tr>';
  ports.forEach(p => {
    const label = knownPortLabel(p.address);
    const isOrphan = p.address.includes('8888');
    html += '<tr>';
    html += '<td>' + escHtml(p.address) + '</td>';
    html += '<td>' + bindIcon(p.address) + '</td>';
    html += '<td class="dim">' + escHtml(p.process) + (p.pid ? ' <span class="dim">(' + p.pid + ')</span>' : '') + '</td>';
    html += '<td>' + (isOrphan ? '<span style="color:#c75050">' + escHtml(label) + '</span>' : escHtml(label)) + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  html += '</div>';

  // === Health Checks ===
  html += '<div class="card">';
  html += '<div class="card-title">' + dot(health.every(h => h.ok) ? 'ok' : 'warn') + ' Health Checks</div>';
  html += '<table>';
  html += '<tr><th>URL</th><th>Status</th></tr>';
  health.forEach(h => {
    html += '<tr>';
    html += '<td style="word-break:break-all">' + escHtml(h.url) + '</td>';
    html += '<td>' + healthBadge(h) + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  html += '</div>';

  // === Firewall ===
  html += '<div class="card">';
  html += '<div class="card-title">' + dot(fw.length > 0 ? 'ok' : 'warn') + ' Firewall (port 3080)</div>';
  if (fw.length === 0) {
    html += '<p class="dim">No iptables rules for port 3080</p>';
  } else {
    fw.forEach(r => {
      const isDrop = r.includes('DROP');
      html += '<div class="fw-rule' + (isDrop ? ' drop' : '') + '">' + escHtml(r) + '</div>';
    });
  }
  html += '</div>';

  html += '</div>'; // grid
  document.getElementById('dashboard').className = '';
  document.getElementById('dashboard').innerHTML = html;
}

async function poll() {
  try {
    // Use path relative to current page location (works behind reverse proxies)
    const basePath = window.location.pathname.replace(/\\/$/, '');
    const res = await fetch(basePath + '/api/scan');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    render(data);
    document.getElementById('error-banner').style.display = 'none';
  } catch (err) {
    document.getElementById('error-banner').style.display = 'block';
    document.getElementById('error-banner').textContent = 'Scan failed: ' + err.message;
  }
}

poll();
setInterval(poll, POLL_INTERVAL);
</script>
</body>
</html>`;
}

// === PM2 action handler ===

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function pm2Action(action, name) {
  if (!KNOWN_NAMES.has(name)) {
    return { ok: false, error: "Unknown app: " + name };
  }

  try {
    if (action === "stop") {
      run("pm2", ["stop", name]);
    } else if (action === "restart") {
      run("pm2", ["restart", name]);
    } else if (action === "start") {
      // Check if process exists in PM2 (even if stopped)
      const raw = run("pm2", ["jlist"]);
      const exists = raw && JSON.parse(raw).some(p => p.name === name);

      if (exists) {
        run("pm2", ["restart", name]);
      } else {
        // Start fresh from KNOWN_APPS definition
        const app = KNOWN_APPS.find(a => a.name === name);
        if (!app) return { ok: false, error: "No config for: " + name };

        const startArgs = ["start", app.script, "--name", name, "--cwd", app.cwd];
        if (app.args.length > 0) {
          startArgs.push("--");
          startArgs.push(...app.args);
        }
        // Pass env vars via PM2's --env flag isn't straightforward with execFileSync,
        // so we set them as individual --env_KEY=VALUE pairs using pm2's ecosystem approach.
        // Simpler: use pm2 start with env vars in the environment.
        const env = { ...process.env, ...app.env };
        execFileSync("pm2", startArgs, { timeout: 15000, encoding: "utf-8", cwd: app.cwd, env });
      }
    } else {
      return { ok: false, error: "Unknown action: " + action };
    }

    // Persist the PM2 process list
    run("pm2", ["save"]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

// === HTTP Server ===

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/scan") {
    try {
      const data = await fullScan();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.url === "/api/pm2" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const result = pm2Action(body.action, body.name);
      res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Viz manifest API — returns discovered viz pages as JSON
  if (req.url === "/api/viz-manifest") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(vizCache.map(v => ({
      slug: v.slug,
      filename: v.filename,
      title: v.title,
      description: v.description,
      category: v.category,
    }))));
    return;
  }

  // SSE endpoint for story data changes (viz clients subscribe here)
  if (req.url === "/api/story-events" || req.url.startsWith("/api/story-events?")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("event: connected\ndata: {}\n\n");
    storyDataClients.add(res);
    const keepalive = setInterval(() => {
      try { res.write(":keepalive\n\n"); }
      catch { clearInterval(keepalive); storyDataClients.delete(res); }
    }, 30000);
    req.on("close", () => { clearInterval(keepalive); storyDataClients.delete(res); });
    return;
  }

  // Serve ceremony-data.js for viz pages
  if (req.url === "/js/ceremony-data.js") {
    try {
      const js = fs.readFileSync(path.resolve(__dirname, "../web/public/js/ceremony-data.js"), "utf-8");
      res.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-cache" });
      res.end(js);
    } catch (err) {
      res.writeHead(404);
      res.end("ceremony-data.js not found");
    }
    return;
  }

  // Viz index — dynamically generated gallery
  if (req.url === "/viz" || req.url === "/viz/") {
    const livePages = new Set(["relationship-map", "fog-matrix", "story-skeleton", "network-topology"]);
    const items = vizCache.map(v => {
      const desc = v.description ? " — " + escHtmlServer(v.description) : "";
      const title = escHtmlServer(v.title);
      const liveBadge = livePages.has(v.slug) ? ' <span style="color:#6b9e7a">● live</span>' : "";
      return `<li><a href="/viz/${v.slug}">${title}</a>${desc}${liveBadge}</li>`;
    }).join("\n");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Visualizations</title>
<style>body{background:#0a0e17;color:#e8dcc8;font-family:'SF Mono',monospace;padding:40px}
a{color:#c4a35a;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:16px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:24px}
li{margin:8px 0;font-size:14px}</style></head><body>
<h1>The Ceremony — Visualizations</h1>
<p style="font-size:11px;color:#5a6a7a;margin-bottom:16px">Changes to config/ or memory/ update live pages automatically.</p><ul>
${items}
</ul></body></html>`);
    return;
  }

  // Serve viz pages by slug (autodiscovered)
  const vizPath = req.url.replace(/\.html$/, "").replace(/\/$/, "");
  const vizMatch = vizPath.match(/^\/viz\/(.+)$/);
  if (vizMatch) {
    const slug = vizMatch[1];
    const entry = vizBySlug.get(slug);
    if (entry) {
      try {
        const html = fs.readFileSync(entry.filepath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Viz file not found: " + err.message);
      }
      return;
    }
  }

  // Serve dashboard for everything else
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(renderDashboard());
});

const BIND = process.env.RIGGING_BIND || "0.0.0.0";
server.listen(PORT, BIND, () => {
  console.log(`[The Rigging] Dashboard at http://${BIND}:${PORT}`);
});
