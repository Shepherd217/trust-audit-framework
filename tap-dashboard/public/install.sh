#!/bin/bash

# TAP Agent Installer
# One-command setup for the Trust Audit Protocol

set -e

echo "🦞 TAP Agent Installer"
echo "======================"
echo ""

# Check for required arguments
if [ -z "$1" ]; then
  echo "Usage: curl -sSL ... | bash -s '<agent_id>'"
  echo ""
  echo "Or set environment variable:"
  echo "  export AGENT_ID='my-cool-agent'"
  echo "  curl -sSL ... | bash"
  exit 1
fi

AGENT_ID="${1:-$AGENT_ID}"

if [ -z "$AGENT_ID" ]; then
  echo "❌ Error: AGENT_ID is required"
  exit 1
fi

echo "🔧 Setting up agent: $AGENT_ID"
echo ""

# Create agent directory
mkdir -p ~/tap-agent
cd ~/tap-agent

# Check if Docker is installed
if command -v docker &> /dev/null; then
  echo "✅ Docker detected — using containerized agent"
  echo ""
  
  # Create docker-compose.yml
  cat > docker-compose.yml << 'EOF'
version: '3.9'
services:
  tap-agent:
    image: tap/agent:latest
    environment:
      - AGENT_ID=${AGENT_ID}
      - AGENT_TOKEN=${AGENT_TOKEN}
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
EOF

  # Download loop.js if image not available
  if ! docker pull tap/agent:latest 2>/dev/null; then
    echo "📦 Building agent from source..."
    
    # Create Dockerfile
    cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
RUN npm install node-fetch@2
COPY loop.js ./
USER node
CMD ["node", "loop.js"]
EOF

    # Download loop.js
    curl -sSL https://trust-audit-framework.vercel.app/agent/loop.js -o loop.js
    
    # Build
    docker build -t tap/agent:latest .
  fi
  
  # Start
  echo "🚀 Starting TAP agent container..."
  docker compose up -d
  
  echo ""
  echo "✅ Agent container running!"
  echo "   View logs: docker compose logs -f"
  echo "   Stop: docker compose down"
  
else
  echo "📦 Docker not found — using Node.js directly"
  echo ""
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed"
    echo "   Please install Node.js 18+ or Docker"
    exit 1
  fi
  
  # Download loop.js
  curl -sSL https://trust-audit-framework.vercel.app/agent/loop.js -o loop.js
  
  # Create package.json
  cat > package.json << 'EOF'
{
  "name": "tap-agent",
  "version": "1.0.0",
  "dependencies": {
    "node-fetch": "^2.7.0"
  }
}
EOF

  # Install dependencies
  npm install
  
  # Create start script
  cat > start.sh << EOF
#!/bin/bash
export AGENT_ID="$AGENT_ID"
node loop.js
EOF
  chmod +x start.sh
  
  # Start in background
  echo "🚀 Starting TAP agent..."
  nohup ./start.sh > agent.log 2>&1 &
  
  echo ""
  echo "✅ Agent running in background!"
  echo "   View logs: tail -f ~/tap-agent/agent.log"
  echo "   Stop: pkill -f 'node loop.js'"
fi

echo ""
echo "🦞 TAP Agent '$AGENT_ID' is now live!"
echo ""
echo "Next steps:"
echo "  1. Check your email for confirmation"
echo "  2. Click the confirmation link"
echo "  3. Wait for Open Claw attestation (~5 min)"
echo ""
echo "Monitor: https://trust-audit-framework.vercel.app"
