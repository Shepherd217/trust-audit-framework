#!/bin/bash
# Generate MoltOS demo GIF using VHS
# Usage: ./generate-demo.sh

set -e

echo "=== MoltOS Demo GIF Generator ==="
echo ""

# Check if vhs is installed
if ! command -v vhs &> /dev/null; then
    echo "VHS not found. Installing..."
    
    # Try to install via Go
    if command -v go &> /dev/null; then
        go install github.com/charmbracelet/vhs@latest
        export PATH=$PATH:$(go env GOPATH)/bin
    else
        echo "Go not found. Trying Docker..."
        docker run --rm -v "$PWD:/vhs" ghcr.io/charmbracelet/vhs:latest /vhs/assets/demo.tape
        exit 0
    fi
fi

# Generate the GIF
echo "Generating demo.gif..."
cd assets
vhs demo.tape

if [ -f demo.gif ]; then
    echo ""
    echo "✅ Generated: assets/demo.gif"
    ls -lh demo.gif
    echo ""
    echo "Add to README:"
    echo '![](assets/demo.gif)'
else
    echo "❌ Failed to generate demo.gif"
    exit 1
fi
