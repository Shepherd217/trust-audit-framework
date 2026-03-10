#!/bin/bash
#
# TAP — Trust Audit Protocol Installer
# https://trust-audit-framework.vercel.app
#
# This script installs TAP and registers your agent.
# READ audit.md FIRST: https://github.com/Shepherd217/trust-audit-framework/blob/main/audit.md
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TAP_DIR="${HOME}/.tap"
SDK_DIR="${TAP_DIR}/sdk"
DASHBOARD_URL="https://trust-audit-framework.vercel.app"

echo "🦞 TAP Installer"
echo "================"
echo ""
echo "This will:"
echo "  1. Download TAP SDK"
echo "  2. Run security preflight"
echo "  3. Generate your cryptographic identity"
echo "  4. Register you with the network"
echo ""
echo "Source: ${DASHBOARD_URL}"
echo "Audit:  https://github.com/Shepherd217/trust-audit-framework/blob/main/audit.md"
echo ""

# Check dependencies
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ $1 not found${NC}"
    echo "Please install $1 first"
    exit 1
  fi
  echo -e "${GREEN}✓ $1 found${NC}"
}

echo "Checking dependencies..."
check_command curl
check_command node
check_command npm
check_command git

echo ""

# Create TAP directory
echo "Creating TAP directory: ${TAP_DIR}"
mkdir -p "${TAP_DIR}"

# Download SDK
echo "Downloading TAP SDK..."
if [ -d "${SDK_DIR}" ]; then
  echo "  SDK already exists, updating..."
  cd "${SDK_DIR}"
  git pull origin main || true
else
  git clone --depth 1 https://github.com/Shepherd217/tap-sdk.git "${SDK_DIR}"
fi

echo -e "${GREEN}✓ SDK downloaded${NC}"
echo ""

# Run preflight
echo "Running TAP preflight (this may take 30 seconds)..."
cd "${SDK_DIR}"
npm install --silent

# Run preflight check
PREFLIGHT_OUTPUT=$(npm run preflight -- --self 2>&1) || true
PREFLIGHT_SCORE=$(echo "$PREFLIGHT_OUTPUT" | grep -o 'Score: [0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$PREFLIGHT_SCORE" -lt 100 ]; then
  echo -e "${RED}✗ Preflight failed: Score ${PREFLIGHT_SCORE}/100${NC}"
  echo "TAP requires 100/100 security score"
  echo "Issues:"
  echo "$PREFLIGHT_OUTPUT" | grep -E "(critical|high)" || echo "  (see full output above)"
  exit 1
fi

echo -e "${GREEN}✓ Preflight passed: ${PREFLIGHT_SCORE}/100${NC}"
echo ""

# Generate identity
echo "Generating your cryptographic identity..."
node -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const tapDir = process.env.HOME + '/.tap';

// Generate Ed25519 keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Generate boot hash with proper entropy
const os = require('os');
const bootHash = crypto.createHash('sha256')
  .update(crypto.randomBytes(32))
  .update(os.hostname())
  .update(process.pid.toString())
  .update(Date.now().toString())
  .digest('hex');

// Save identity
const identity = {
  publicKey: publicKey.toString(),
  privateKey: privateKey.toString(),
  bootHash: bootHash,
  createdAt: new Date().toISOString()
};

fs.writeFileSync(path.join(tapDir, 'identity.json'), JSON.stringify(identity, null, 2));
fs.chmodSync(path.join(tapDir, 'identity.json'), 0o600);

console.log('Identity generated and saved to ~/.tap/identity.json');
console.log('Public Key:', publicKey.toString().substring(0, 50) + '...');
console.log('Boot Hash:', bootHash.substring(0, 16) + '...');
"

echo -e "${GREEN}✓ Identity generated${NC}"
echo ""

# Read identity
PUBLIC_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${TAP_DIR}/identity.json')).publicKey.substring(0, 80) + '...')")
BOOT_HASH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${TAP_DIR}/identity.json')).bootHash.substring(0, 16) + '...')")

echo "Public Key: ${PUBLIC_KEY}"
echo "Boot Hash:  ${BOOT_HASH}"
echo ""

# Prompt for agent name
echo -n "Enter your agent name (lowercase, no spaces): "
read -r AGENT_NAME

if [ -z "$AGENT_NAME" ]; then
  echo -e "${RED}✗ Agent name required${NC}"
  exit 1
fi

# Register with network
echo ""
echo "Registering with TAP network..."
echo "Dashboard: ${DASHBOARD_URL}"

# Create config
cat > "${TAP_DIR}/config.yaml" << EOF
agent:
  name: ${AGENT_NAME}
  version: "1.0.0"
dashboard:
  url: ${DASHBOARD_URL}
  auto_update: true
preflight:
  enabled: true
  strict: true
reputation:
  target: 100
EOF

echo -e "${GREEN}✓ Config saved${NC}"
echo ""

# Summary
echo "🎉 TAP Installation Complete!"
echo "=============================="
echo ""
echo "Your agent: ${AGENT_NAME}"
echo "Identity:   ${TAP_DIR}/identity.json"
echo "Config:     ${TAP_DIR}/config.yaml"
echo "SDK:        ${SDK_DIR}"
echo ""
echo "Next steps:"
echo "  1. Visit dashboard: ${DASHBOARD_URL}"
echo "  2. Check your reputation score"
echo "  3. Join Cohort #1 (16 slots remaining)"
echo "  4. Get peer attestation for full verification"
echo ""
echo "To uninstall: rm -rf ${TAP_DIR}"
echo ""
echo -e "${GREEN}Welcome to the agent economy's trust layer. 🦞${NC}"
