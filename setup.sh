#!/bin/bash
# The Ceremony — Setup Script
# Configures the API key and spending limits for the Keeper

ENV_FILE="web/.env.local"

echo ""
echo "  The Ceremony — Keeper Setup"
echo "  ─────────────────────────────"
echo ""

# Check if key already exists
if grep -q "^ANTHROPIC_API_KEY=sk-" "$ENV_FILE" 2>/dev/null; then
  echo "  API key already configured."
  echo -n "  Replace it? [y/N] "
  read -r reply
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "  Keeping existing key."
    echo ""
    exit 0
  fi
fi

# Prompt for key (hidden input)
echo -n "  Enter your Anthropic API key: "
read -rs api_key
echo ""

# Validate format
if [[ ! "$api_key" =~ ^sk-ant- ]]; then
  echo "  Error: Key should start with sk-ant-"
  echo "  Get one at https://console.anthropic.com/settings/keys"
  exit 1
fi

# Write env file (preserve limits if they exist, otherwise use defaults)
cat > "$ENV_FILE" << EOF
ANTHROPIC_API_KEY=${api_key}

# Keeper spending limits
KEEPER_MODEL=claude-sonnet-4-20250514
KEEPER_MAX_TOKENS_PER_RESPONSE=1024
KEEPER_MAX_REQUESTS_PER_SESSION=100
KEEPER_MAX_REQUESTS_PER_MINUTE=10
EOF

echo ""
echo "  Key saved to $ENV_FILE (git-ignored)."
echo ""
echo "  Spending limits:"
echo "    Model:              Sonnet 4 (~\$0.50/session)"
echo "    Max tokens/response: 1024"
echo "    Max requests/session: 100"
echo "    Max requests/minute:  10"
echo ""
echo "  To use Haiku instead (cheaper, faster, less nuanced):"
echo "    sed -i 's/KEEPER_MODEL=.*/KEEPER_MODEL=claude-haiku-4-5-20251001/' $ENV_FILE"
echo ""
echo "  Set a monthly hard cap at:"
echo "  https://console.anthropic.com/settings/limits"
echo ""
echo "  Restart the app:  pm2 restart ceremony"
echo ""
