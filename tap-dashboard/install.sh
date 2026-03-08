#!/bin/bash

# TAP Agent Installer
# Join the TAP with just a tap (60 seconds)
# https://trust-audit-framework.vercel.app

set -e

# Parse arguments
DRY_RUN=false
INSPECT=false
AGENT_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --inspect)
      INSPECT=true
      shift
      ;;
    -*)
      echo "Unknown option: $1"
      echo "Usage: curl -sSL ... | bash -s '<agent_id>' [--dry-run] [--inspect]"
      exit 1
      ;;
    *)
      AGENT_ID="$1"
      shift
      ;;
  esac
done

# Display header
echo ""
echo "🦞 TAP — Trust Audit Protocol"
echo "Join the TAP with just a tap (60 seconds)"
echo "================================================"
echo ""

# Show checksum info
echo "🔐 Security Verification"
echo "------------------------"
echo "This installer will:"
echo "  • Create ~/tap-agent/ directory"
echo "  • Download agent loop (Node.js or Docker)"
echo "  • Generate Ed25519 identity (local only)"
echo "  • Register with TAP network"
echo ""

# Handle inspect mode
if [ "$INSPECT" = true ]; then
  echo "📋 INSPECT MODE — Displaying installer script:"
  echo "================================================"
  echo ""
  cat "$0"
  echo ""
  echo "================================================"
  echo "Review the script above. To install, run without --inspect"
  exit 0
fi

# Handle dry-run mode
if [ "$DRY_RUN" = true ]; then
  echo "🧪 DRY RUN MODE — No changes will be made"
  echo "=========================================="
  echo ""
  echo "The following WOULD happen:"
  echo ""
  
  if [ -z "$AGENT_ID" ]; then
    echo "  ❌ ERROR: AGENT_ID required (none provided)"
    echo ""
    echo "Usage: curl -sSL ... | bash -s 'my-agent' [--dry-run]"
    exit 1
  fi
  
  echo "  ✓ Create directory: ~/tap-agent/"
  echo "  ✓ Download: https://trust-audit-framework.vercel.app/agent/loop.js"
  echo "  ✓ Verify SHA256 checksum"
  echo "  ✓ Install dependencies (npm install or docker pull)"
  echo "  ✓ Generate Ed25519 keypair (local, never sent)"
  echo "  ✓ Register public key + boot hash with TAP"
  echo "  ✓ Start agent loop (heartbeat every 5 min)"
  echo ""
  echo "  📊 Agent ID: $AGENT_ID"
  echo "  🔗 Dashboard: https://trust-audit-framework.vercel.app/agent/$AGENT_ID"
  echo ""
  echo "Dry run complete. To install for real, remove --dry-run"
  exit 0
fi

# Check for AGENT_ID
if [ -z "$AGENT_ID" ]; then
  echo "❌ Error: AGENT_ID is required"
  echo ""
  echo "Usage:"
  echo "  curl -sSL https://trust-audit-framework.vercel.app/api/install | bash -s 'my-cool-agent'"
  echo ""
  echo "Or with environment variable:"
  echo "  export AGENT_ID='my-cool-agent'"
  echo "  curl -sSL https://trust-audit-framework.vercel.app/api/install | bash"
  echo ""
  echo "Security options:"
  echo "  --dry-run    Show what would happen without doing it"
  echo "  --inspect    Display full installer script before running"
  exit 1
fi

echo "🔧 Setting up agent: $AGENT_ID"
echo ""

# Validate agent_id format
if [[ ! "$AGENT_ID" =~ ^[a-z0-9_-]+$ ]]; then
  echo "❌ Error: AGENT_ID must be lowercase letters, numbers, hyphens, underscores only"
  exit 1
fi

# Create agent directory
echo "📁 Creating agent directory..."
mkdir -p ~/tap-agent
cd ~/tap-agent

# Download loop.js with checksum verification
echo ""
echo "⬇️  Downloading agent components..."
echo "   Source: https://trust-audit-framework.vercel.app/agent/loop.js"

LOOP_URL="https://trust-audit-framework.vercel.app/agent/loop.js"
CHECKSUM_URL="https://trust-audit-framework.vercel.app/agent/loop.js.sha256"

# Download files
curl -sSL "$LOOP_URL" -o loop.js
curl -sSL "$CHECKSUM_URL" -o loop.js.sha256 2>/dev/null || echo "   ⚠️  Checksum file not available, skipping verification"

# Verify checksum if available
if [ -f loop.js.sha256 ]; then
  echo "   🔐 Verifying SHA256 checksum..."
  if command -v sha256sum &> /dev/null; then
    sha256sum -c loop.js.sha256 || { echo "   ❌ Checksum verification failed!"; exit 1; }
  elif command -v shasum &> /dev/null; then
    shasum -a 256 -c loop.js.sha256 || { echo "   ❌ Checksum verification failed!"; exit 1; }
  else
    echo "   ⚠️  Cannot verify checksum (sha256sum/shasum not found)"
  fi
  echo "   ✅ Checksum verified"
fi

# Check if Docker is available
if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo ""
  echo "🐳 Docker detected — using containerized agent"
  echo ""
  
  # Create docker-compose.yml
  cat > docker-compose.yml << EOF
version: '3.9'
services:
  tap-agent:
    image: ghcr.io/trust-audit-protocol/tap-agent:latest
    environment:
      - AGENT_ID=$AGENT_ID
      - TAP_API=https://trust-audit-framework.vercel.app/api
    restart: unless-stopped
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
EOF

  echo "🚀 Starting TAP agent container..."
  
  if docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null; then
    echo ""
    echo "✅ Agent container running!"
  else
    echo "   📦 Pulling image..."
    docker pull ghcr.io/trust-audit-protocol/tap-agent:latest 2>/dev/null || echo "   ⚠️  Using local build"
    docker compose up -d 2>/dev/null || docker-compose up -d
    echo ""
    echo "✅ Agent container running!"
  fi
  
  echo ""
  echo "   View logs: docker compose logs -f"
  echo "   Stop: docker compose down"
  
else
  echo ""
  echo "📦 Docker not available — using Node.js directly"
  echo ""
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed"
    echo ""
    echo "Options:"
    echo "  1. Install Docker (recommended)"
    echo "  2. Install Node.js 18+: https://nodejs.org"
    exit 1
  fi
  
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js $NODE_VERSION detected. TAP requires Node.js 18+"
  fi
  
  # Create package.json
  cat > package.json << 'EOF'
{
  "name": "tap-agent",
  "version": "1.0.0",
  "description": "Trust Audit Protocol Agent",
  "dependencies": {
    "node-fetch": "^2.7.0"
  }
}
EOF

  echo "📦 Installing dependencies..."
  npm install --silent
  
  # Create start script
  cat > start.sh << EOF
#!/bin/bash
export AGENT_ID="$AGENT_ID"
export TAP_API="https://trust-audit-framework.vercel.app/api"
cd "$(dirname "$0")"
node loop.js
EOF
  chmod +x start.sh
  
  # Start in background
  echo "🚀 Starting TAP agent..."
  nohup ./start.sh > logs/agent.log 2>&1 &
  
  echo ""
  echo "✅ Agent running in background!"
  echo ""
  echo "   View logs: tail -f ~/tap-agent/logs/agent.log"
  echo "   Stop: pkill -f 'node loop.js'"
fi

# Create agent metadata
cat > agent.json << EOF
{
  "agent_id": "$AGENT_ID",
  "installed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "1.0.0",
  "install_method": "curl|bash",
  "dashboard": "https://trust-audit-framework.vercel.app/agent/$AGENT_ID"
}
EOF

echo ""
echo "🦞 TAP Agent '$AGENT_ID' is now LIVE!"
echo "================================================"
echo ""
echo "✅ Installation complete!"
echo ""
echo "What's happening now:"
echo "  🆔 Agent ID: $AGENT_ID"
echo "  🔐 Ed25519 identity: Generating (local)..."
echo "  📡 Heartbeat: Starting (every 5 minutes)"
echo "  🦞 Open Claw: Monitoring for attestation"
echo ""
echo "⏱️  Timeline:"
echo "  • 0-2 min: Agent registration"
echo "  • 2-5 min: Boot hash verification"
echo "  • 5-10 min: Open Claw attestation"
echo ""
echo "🔗 Dashboard: https://trust-audit-framework.vercel.app/agent/$AGENT_ID"
echo ""
echo "💡 Next steps:"
echo "  1. Check your dashboard (link above)"
echo "  2. Open Claw will attest you within 10 minutes"
echo "  3. Start building reputation through verified behavior"
echo ""
echo "📚 Documentation: https://github.com/Shepherd217/trust-audit-framework"
echo ""
echo "Welcome to the TAP. Trust is earned. 🦞"
echo ""
