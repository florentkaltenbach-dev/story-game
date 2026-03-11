#!/bin/bash
# The Ceremony — Start Script
# Sources secrets from .env, builds web if needed, starts PM2.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Preflight ──────────────────────────────────────────────

if [ ! -f "$ROOT/.env" ]; then
  echo "  No .env found. Run ./setup.sh first."
  exit 1
fi

# Export secrets into the shell so PM2 config can read process.env
set -a
source "$ROOT/.env"
set +a

echo ""
echo "  The Ceremony — Starting"
echo "  ─────────────────────────────"
echo ""
echo "  Mode: ${KEEPER_BACKEND:-mock}"
echo ""

# ── Build web if needed ───────────────────────────────────

if [ ! -d "$ROOT/web/.next" ] || [ "${1:-}" = "--build" ]; then
  echo "  Building web..."
  (cd "$ROOT/web" && npm run build)
  echo "  Build complete."
  echo ""
fi

# ── Start PM2 ─────────────────────────────────────────────

echo "  Starting PM2 processes..."
pm2 start "$ROOT/ecosystem.config.cjs" --update-env
echo ""
echo "  Done. Use 'pm2 logs' to watch output."
echo ""
