#!/usr/bin/env node
// Bridges IPv4 :9222 → IPv6 [::1]:9222 for Chrome DevTools MCP
// Chrome snap binds to IPv6 only; the MCP tool connects via IPv4.
// Usage: node chrome-bridge.js [listen-port] [target-port]

const net = require("net");

const LISTEN = parseInt(process.argv[2] || "9223");
const TARGET = parseInt(process.argv[3] || "9222");

const server = net.createServer((client) => {
  const remote = net.connect({ host: "::1", port: TARGET, family: 6 }, () => {
    client.pipe(remote);
    remote.pipe(client);
  });
  remote.on("error", () => client.destroy());
  client.on("error", () => remote.destroy());
});

server.listen(LISTEN, "127.0.0.1", () => {
  console.log(`[chrome-bridge] 127.0.0.1:${LISTEN} → [::1]:${TARGET}`);
});
