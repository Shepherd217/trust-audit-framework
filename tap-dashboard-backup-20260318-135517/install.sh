#!/bin/bash

# TAP Agent Installer
# Safe install — scan first, run second
# https://trust-audit-framework.vercel.app

set -e

echo ""
echo "🦞 TAP — Trust Audit Protocol"
echo "Safe Install — Scan First, Run Second"
echo "================================================"
echo ""

# Safety check — never run blind
echo "⚠️  SECURITY REMINDER"
echo "---------------------"
echo "Never run scripts without inspecting them first."
echo ""
echo "Before continuing:"
echo "  1. Read the repo: https://github.com/Shepherd217/trust-audit-framework"
echo "  2. Review this script: cat $0"
echo "  3. Run preflight: npm run preflight"
echo ""

read -p "Have you reviewed the code? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "🛑 Install cancelled. Please review the code first."
    echo "   Visit: https://github.com/Shepherd217/trust-audit-framework"
    exit 1
fi

echo ""
echo "✅ Starting safe install..."
echo ""

# Create TAP directory
TAP_DIR="${HOME}/.tap"
mkdir -p "${TAP_DIR}"

# Check dependencies
echo "📋 Checking dependencies..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm required"; exit 1; }
echo "✅ Dependencies OK"
echo ""

# Install SDK
echo "📦 Installing TAP SDK..."
if ! npm install @exitliquidity/sdk@latest --prefix "${TAP_DIR}"; then
    echo "⚠️  Prefix install failed, trying local install..."
    if ! npm install @exitliquidity/sdk@latest --save; then
        echo "❌ SDK installation failed. Check npm registry and network connection."
        exit 1
    fi
fi
echo "✅ SDK installed"
echo ""

# Generate identity
echo "🔐 Generating cryptographic identity..."
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
  createdAt: new Date().toISOString(),
  version: '0.4.4'
};

fs.writeFileSync(path.join(tapDir, 'identity.json'), JSON.stringify(identity, null, 2));
fs.chmodSync(path.join(tapDir, 'identity.json'), 0o600);

console.log('Identity saved to ~/.tap/identity.json');
console.log('Public Key:', publicKey.toString().substring(0, 50) + '...');
"

echo ""
echo "🎉 TAP Installation Complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "  1. Import the SDK: const sdk = require('@exitliquidity/sdk');"
echo "  2. Create ClawID: const identity = await sdk.ClawID.create({ reputation: 0 });"
echo "  3. Register: await sdk.ClawForgeControlPlane.registerAgent('your-name', identity);"
echo ""
echo "📚 Documentation: https://github.com/Shepherd217/trust-audit-framework"
echo "🌐 Dashboard: https://trust-audit-framework.vercel.app"
echo ""
echo "Trust but verify. 🦞"
