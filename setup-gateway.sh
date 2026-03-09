#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────
# Gateway Setup: WireGuard + Caddy for The Ceremony
# Traffic flow: User → HTTPS → nginx (kaltenbach.dev) → WireGuard → Caddy (this server) → app
# ─────────────────────────────────────────────────

# === Configuration ===

WG_INTERFACE="wg0"
WG_ADDRESS="10.0.0.2/24"
WG_PEER_ADDRESS="10.0.0.1"
WG_PEER_ENDPOINT="159.69.148.166:51820"
WG_LISTEN_PORT="51820"
GATEWAY_PORT="3080"

# App → port mappings
declare -A APP_ROUTES=(
  ["/the-ceremony/*"]="localhost:3004"
  ["/sandbox/dreizehn/*"]="localhost:3001"
  ["/sandbox/MusicList/*"]="localhost:3003"
  ["/sandbox/projects/*"]="localhost:3002"
)

GAMEDEV_WWW="$HOME/gamedev/www"
GAMEDEV_PORT="8080"
CADDYFILE="/etc/caddy/Caddyfile"

# === Colors ===

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; }
step()  { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }
ask()   { echo -en "${YELLOW}[?]${NC} $* "; }

# === Helpers ===

confirm() {
  ask "$1 [y/N]"
  read -r reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

check_root_or_sudo() {
  if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    warn "Some commands need sudo. You may be prompted for your password."
  fi
}

# === Stage 1: WireGuard ===

stage_wireguard() {
  step "Stage 1: WireGuard"

  # Check if already configured and running
  if ip link show "$WG_INTERFACE" &>/dev/null; then
    info "WireGuard interface $WG_INTERFACE already exists"
    if sudo wg show "$WG_INTERFACE" 2>/dev/null | grep -q "latest handshake"; then
      info "Tunnel is active with handshake — skipping WireGuard setup"
      return 0
    else
      warn "Interface exists but no active handshake"
    fi
  fi

  # Install wireguard if needed
  if ! command -v wg &>/dev/null; then
    info "Installing WireGuard..."
    sudo apt update -qq && sudo apt install -y -qq wireguard
    info "WireGuard installed"
  else
    info "WireGuard already installed"
  fi

  # Generate keypair if needed
  local privkey="/etc/wireguard/privatekey"
  local pubkey="/etc/wireguard/publickey"

  if [[ -f "$privkey" && -f "$pubkey" ]]; then
    info "Keypair already exists"
  else
    info "Generating WireGuard keypair..."
    wg genkey | sudo tee "$privkey" > /dev/null
    sudo chmod 600 "$privkey"
    sudo cat "$privkey" | wg pubkey | sudo tee "$pubkey" > /dev/null
    info "Keypair generated"
  fi

  echo ""
  echo -e "${BOLD}Our public key (send this to kaltenbach.dev):${NC}"
  echo -e "${CYAN}$(sudo cat "$pubkey")${NC}"
  echo ""

  ask "Paste the kaltenbach.dev public key (or 'skip' to configure later):"
  read -r peer_pubkey

  if [[ "$peer_pubkey" == "skip" || -z "$peer_pubkey" ]]; then
    warn "Skipping WireGuard config — re-run with --stage wireguard when you have the key"
    return 0
  fi

  # Write wg0.conf
  local our_privkey
  our_privkey=$(sudo cat "$privkey")

  sudo tee "/etc/wireguard/$WG_INTERFACE.conf" > /dev/null <<EOF
[Interface]
PrivateKey = $our_privkey
Address = $WG_ADDRESS
ListenPort = $WG_LISTEN_PORT

[Peer]
PublicKey = $peer_pubkey
AllowedIPs = $WG_PEER_ADDRESS/32
Endpoint = $WG_PEER_ENDPOINT
PersistentKeepalive = 25
EOF
  sudo chmod 600 "/etc/wireguard/$WG_INTERFACE.conf"
  info "Wrote /etc/wireguard/$WG_INTERFACE.conf"

  # Enable and start
  sudo systemctl enable --now "wg-quick@$WG_INTERFACE" 2>/dev/null || {
    # If already enabled but down, just bring it up
    sudo wg-quick up "$WG_INTERFACE" 2>/dev/null || true
  }

  # Verify
  echo ""
  info "Testing tunnel..."
  if ping -c 2 -W 3 "$WG_PEER_ADDRESS" &>/dev/null; then
    info "Tunnel is UP — $WG_PEER_ADDRESS responds"
  else
    warn "Tunnel configured but $WG_PEER_ADDRESS not responding yet"
    warn "The other end may not have our key configured yet"
  fi
}

# === Stage 2: Caddy Gateway ===

stage_caddy() {
  step "Stage 2: Caddy Gateway"

  # Prereq: check WireGuard
  if ! ip addr show "$WG_INTERFACE" 2>/dev/null | grep -q "10.0.0.2"; then
    err "WireGuard interface $WG_INTERFACE not found with address 10.0.0.2"
    err "Run --stage wireguard first"
    return 1
  fi
  info "WireGuard interface verified (10.0.0.2)"

  # Backup existing Caddyfile
  if [[ -f "$CADDYFILE" ]]; then
    local backup="${CADDYFILE}.bak.$(date +%Y%m%d_%H%M%S)"
    sudo cp "$CADDYFILE" "$backup"
    info "Backed up Caddyfile to $backup"
  fi

  # Build route blocks
  local route_block=""
  for path in "${!APP_ROUTES[@]}"; do
    local target="${APP_ROUTES[$path]}"
    route_block+="
	handle_path $path {
		reverse_proxy $target
	}
"
  done

  # Write new Caddyfile
  sudo tee "$CADDYFILE" > /dev/null <<EOF
# Gateway: WireGuard-only (kaltenbach.dev reverse proxies here)
10.0.0.2:$GATEWAY_PORT {
$route_block
	# Fallback: 404
	handle {
		respond "Not Found" 404
	}
}

# Gamedev static files (local access)
:$GAMEDEV_PORT {
	root * $GAMEDEV_WWW
	file_server
}
EOF
  info "Wrote new Caddyfile"

  # Validate and reload
  if sudo caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    info "Caddyfile valid"
    sudo systemctl reload caddy
    info "Caddy reloaded"
  else
    err "Caddyfile validation failed — check syntax"
    return 1
  fi

  # Verify
  echo ""
  if ss -tlnp 2>/dev/null | grep -q "10.0.0.2:$GATEWAY_PORT"; then
    info "Caddy listening on 10.0.0.2:$GATEWAY_PORT (WireGuard only)"
  else
    warn "Expected 10.0.0.2:$GATEWAY_PORT not yet visible in ss — Caddy may need a moment"
  fi
}

# === Stage 3: Cleanup ===

stage_cleanup() {
  step "Stage 3: Cleanup"

  # Check for orphan python on :8888
  local python_pid
  python_pid=$(ss -tlnp 2>/dev/null | grep ":8888 " | grep -oP 'pid=\K[0-9]+' || true)
  if [[ -n "$python_pid" ]]; then
    warn "Python process on :8888 (PID $python_pid)"
    if confirm "Kill it?"; then
      sudo kill "$python_pid"
      info "Killed PID $python_pid"
    fi
  else
    info "No orphan python on :8888"
  fi

  # Check if keeper is bound to 0.0.0.0
  local keeper_bind
  keeper_bind=$(ss -tlnp 2>/dev/null | grep ":3005 " || true)
  if echo "$keeper_bind" | grep -q "0.0.0.0:3005"; then
    warn "Keeper is bound to 0.0.0.0:3005 (publicly accessible!)"
    warn "The code fix binds it to 127.0.0.1 — rebuild and restart to apply"
  elif echo "$keeper_bind" | grep -q "127.0.0.1:3005"; then
    info "Keeper correctly bound to 127.0.0.1:3005"
  else
    info "Keeper not currently running on :3005"
  fi

  # Verify gateway NOT reachable on public IP
  local public_ip
  public_ip=$(curl -s --connect-timeout 2 ifconfig.me || echo "46.62.231.96")
  if curl -s --connect-timeout 3 "http://$public_ip:$GATEWAY_PORT" &>/dev/null; then
    err "Gateway port $GATEWAY_PORT is reachable on public IP — this should not happen!"
  else
    info "Gateway port $GATEWAY_PORT not reachable on public IP (correct)"
  fi
}

# === Stage 4: Summary ===

stage_summary() {
  step "Stage 4: Summary"

  echo ""
  echo -e "${BOLD}Listening services:${NC}"
  ss -tlnp 2>/dev/null | grep -E ":(3080|3004|3005|3001|3002|3003|8080) " | while read -r line; do
    echo "  $line"
  done

  echo ""
  echo -e "${BOLD}WireGuard status:${NC}"
  sudo wg show "$WG_INTERFACE" 2>/dev/null | head -10 || warn "WireGuard not active"

  echo ""
  echo -e "${BOLD}─── Snippet for kaltenbach.dev agent ───${NC}"
  local our_pubkey
  our_pubkey=$(sudo cat /etc/wireguard/publickey 2>/dev/null || echo "<key not generated>")
  cat <<EOF

WireGuard peer config for this server:
  PublicKey = $our_pubkey
  AllowedIPs = 10.0.0.2/32
  Endpoint = 46.62.231.96:$WG_LISTEN_PORT

nginx upstream: http://10.0.0.2:$GATEWAY_PORT
Routes available:
  /the-ceremony/*     → The Ceremony (Next.js)
  /sandbox/dreizehn/* → Dreizehn (SvelteKit)
  /sandbox/MusicList/* → MusicList (SvelteKit)
  /sandbox/projects/* → Projects Index

EOF

  echo -e "${BOLD}─── Test commands ───${NC}"
  cat <<'EOF'

# Tunnel
sudo wg show
ping -c 2 10.0.0.1

# Gateway binding
ss -tlnp | grep 3080

# Keeper binding (should be 127.0.0.1)
ss -tlnp | grep 3005

# App through gateway
curl http://10.0.0.2:3080/the-ceremony
curl http://10.0.0.2:3080/sandbox/dreizehn

# Verify NOT public
curl --connect-timeout 3 http://46.62.231.96:3080

# End-to-end (after kaltenbach.dev nginx is configured)
curl https://kaltenbach.dev/the-ceremony/

EOF
}

# === Check mode (read-only) ===

mode_check() {
  step "Current State Check"

  echo ""
  echo -e "${BOLD}WireGuard:${NC}"
  if ip link show "$WG_INTERFACE" &>/dev/null; then
    info "$WG_INTERFACE interface exists"
    if sudo wg show "$WG_INTERFACE" 2>/dev/null | grep -q "latest handshake"; then
      info "Active handshake present"
    else
      warn "No active handshake"
    fi
  else
    warn "$WG_INTERFACE not configured"
  fi

  echo ""
  echo -e "${BOLD}Caddy:${NC}"
  if ss -tlnp 2>/dev/null | grep -q "10.0.0.2:$GATEWAY_PORT"; then
    info "Listening on 10.0.0.2:$GATEWAY_PORT"
  else
    warn "Not listening on 10.0.0.2:$GATEWAY_PORT"
  fi
  if systemctl is-active --quiet caddy; then
    info "Caddy service is active"
  else
    warn "Caddy service not running"
  fi

  echo ""
  echo -e "${BOLD}Services:${NC}"
  for port in 3004 3005 3001 3002 3003; do
    local binding
    binding=$(ss -tlnp 2>/dev/null | grep ":$port " | head -1 || true)
    if [[ -n "$binding" ]]; then
      local addr
      addr=$(echo "$binding" | awk '{print $4}')
      info "Port $port → $addr"
    else
      warn "Port $port — nothing listening"
    fi
  done

  echo ""
  echo -e "${BOLD}Potential issues:${NC}"
  local python_8888
  python_8888=$(ss -tlnp 2>/dev/null | grep ":8888 " || true)
  if [[ -n "$python_8888" ]]; then
    warn "Orphan process on :8888"
  else
    info "No orphan on :8888"
  fi
}

# === Main ===

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --check           Show current state without changing anything"
  echo "  --stage <name>    Run a specific stage: wireguard, caddy, cleanup, summary"
  echo "  --help            Show this help"
  echo ""
  echo "With no arguments, runs all stages interactively."
}

main() {
  echo -e "${BOLD}${CYAN}"
  echo "╔═══════════════════════════════════════╗"
  echo "║   Gateway Setup — The Ceremony        ║"
  echo "║   WireGuard + Caddy Configuration     ║"
  echo "╚═══════════════════════════════════════╝"
  echo -e "${NC}"

  check_root_or_sudo

  if [[ "${1:-}" == "--check" ]]; then
    mode_check
    return 0
  fi

  if [[ "${1:-}" == "--stage" ]]; then
    case "${2:-}" in
      wireguard) stage_wireguard ;;
      caddy)     stage_caddy ;;
      cleanup)   stage_cleanup ;;
      summary)   stage_summary ;;
      *)         err "Unknown stage: ${2:-}"; usage; return 1 ;;
    esac
    return 0
  fi

  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    return 0
  fi

  # Run all stages
  stage_wireguard
  echo ""
  if confirm "Continue to Caddy gateway setup?"; then
    stage_caddy
  fi
  echo ""
  if confirm "Run cleanup checks?"; then
    stage_cleanup
  fi
  echo ""
  stage_summary
}

main "$@"
