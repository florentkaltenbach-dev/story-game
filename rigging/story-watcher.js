/**
 * story-watcher.js — File system watcher for story data changes.
 *
 * Watches config/ and memory/ directories for changes.
 * When a file changes, emits a 'story-data-changed' event via SSE
 * so all connected visualization clients can refresh.
 *
 * Integration with rigging/server.js:
 *
 *   const { startStoryWatcher } = require('./story-watcher');
 *   startStoryWatcher({
 *     configDir: path.resolve(__dirname, '../config'),
 *     memoryDir: path.resolve(__dirname, '../memory'),
 *     onChanged: (event) => {
 *       // Broadcast via SSE to all connected clients
 *       broadcastSSE('story-data-changed', event);
 *       // Also invalidate the API cache
 *       fetch('http://localhost:3004/the-ceremony/api/story-data?invalidate=1', { method: 'POST' }).catch(() => {});
 *     }
 *   });
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Debounced file watcher (no chokidar dependency) ────

class StoryWatcher {
  constructor(opts) {
    this.configDir = opts.configDir;
    this.memoryDir = opts.memoryDir;
    this.onChanged = opts.onChanged || (() => {});
    this.debounceMs = opts.debounceMs || 300;

    this._watchers = [];
    this._pendingTimer = null;
    this._pendingChanges = new Map(); // path → { type, level }
    this._fileHashes = new Map(); // path → md5 hash (dedup rapid writes)
  }

  start() {
    console.log("[story-watcher] Watching for data changes...");

    // Watch config/
    this._watchDir(this.configDir, "config");

    // Watch each memory level directory
    const memoryLevels = [
      "1-plot-state",
      "2-character-state",
      "3-narrative-threads",
      "4-thematic-layer",
      "5-world-state",
    ];
    for (const level of memoryLevels) {
      const dir = path.join(this.memoryDir, level);
      this._watchDir(dir, `memory/${level}`);
    }
  }

  stop() {
    for (const w of this._watchers) {
      w.close();
    }
    this._watchers = [];
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }

  _watchDir(dir, label) {
    try {
      fs.accessSync(dir);
    } catch {
      console.log(`[story-watcher] Skipping ${label} (not found: ${dir})`);
      return;
    }

    try {
      const watcher = fs.watch(dir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;
        if (filename.startsWith(".")) return;
        if (filename.endsWith(".tmp")) return; // ignore atomic write temps

        const filepath = path.join(dir, filename);
        this._queueChange(filepath, label, eventType);
      });

      watcher.on("error", (err) => {
        console.error(`[story-watcher] Error watching ${label}:`, err.message);
      });

      this._watchers.push(watcher);
      console.log(`[story-watcher] Watching: ${label}`);
    } catch (err) {
      console.error(`[story-watcher] Failed to watch ${label}:`, err.message);
    }
  }

  _queueChange(filepath, label, eventType) {
    // Check if file content actually changed (dedup rapid writes)
    try {
      const content = fs.readFileSync(filepath, "utf-8");
      const hash = crypto.createHash("md5").update(content).digest("hex");
      const prevHash = this._fileHashes.get(filepath);
      if (prevHash === hash) return; // content unchanged
      this._fileHashes.set(filepath, hash);
    } catch {
      // File may have been deleted — that's a valid change
      this._fileHashes.delete(filepath);
    }

    this._pendingChanges.set(filepath, {
      type: eventType,
      label,
      file: path.basename(filepath),
    });

    // Debounce: wait for rapid writes to settle
    if (this._pendingTimer) clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(() => {
      this._flush();
    }, this.debounceMs);
  }

  _flush() {
    if (this._pendingChanges.size === 0) return;

    const changes = [];
    for (const [filepath, info] of this._pendingChanges) {
      changes.push({
        path: filepath,
        file: info.file,
        source: info.label,
        event: info.type,
      });
    }
    this._pendingChanges.clear();

    // Categorize what changed for targeted viz updates
    const affected = new Set();
    for (const ch of changes) {
      if (ch.source === "config") {
        // Config changes affect everything
        affected.add("relationships");
        affected.add("narrative");
        affected.add("fog");
      } else if (ch.source.includes("2-character-state")) {
        affected.add("relationships");
        affected.add("fog");
      } else if (ch.source.includes("3-narrative-threads")) {
        affected.add("relationships"); // threads are nodes in the graph
        affected.add("narrative");
      } else if (ch.source.includes("1-plot-state")) {
        affected.add("narrative");
      } else if (ch.source.includes("5-world-state")) {
        affected.add("relationships");
        affected.add("narrative");
      } else if (ch.source.includes("4-thematic-layer")) {
        affected.add("narrative");
      }
    }

    const event = {
      hash: crypto.randomBytes(6).toString("hex"),
      timestamp: Date.now(),
      changes: changes.map((c) => ({ file: c.file, source: c.source })),
      affectedSlices: Array.from(affected),
    };

    console.log(
      `[story-watcher] ${changes.length} file(s) changed → ${Array.from(affected).join(", ")}`
    );

    this.onChanged(event);
  }
}

// ── Integration helper ────────────────────────────────

function startStoryWatcher(opts) {
  const watcher = new StoryWatcher(opts);
  watcher.start();
  return watcher;
}

module.exports = { StoryWatcher, startStoryWatcher };
