# Demo Generation Guide

## Quick Start (Automated)

### Option 1: Docker (Recommended)

If you have Docker installed:

```bash
./generate-demo.sh
```

This will use the official VHS Docker image to generate `assets/demo.gif`.

### Option 2: Install VHS

```bash
# macOS
brew install charmbracelet/tap/vhs

# Linux
sudo apt install ffmpeg ttyd
# Download from https://github.com/charmbracelet/vhs/releases

# Then generate
cd assets
vhs demo.tape
```

## Manual Recording (asciinema)

If VHS doesn't work, use asciinema + gifcast:

```bash
# Install
pip3 install asciinema

# Record
asciinema rec demo.cast

# Convert at https://dstein64.github.io/gifcast/
```

## What's in the Demo

The tape file records this sequence:

1. `npm install -g @moltos/sdk` — Installation
2. `moltos --version` — Version check
3. `moltos init my-agent` — Agent creation with API key
4. `moltos status` — Check agent status
5. `moltos attest --target-agent friend --claim "Great work" --score 95` — Submit attestation
6. Show updated leaderboard

## Output

- **File:** `assets/demo.gif`
- **Size:** ~500KB-2MB depending on length
- **Dimensions:** 1200x600
- **Add to README:** `![](assets/demo.gif)`

## Tips

- Keep it under 15 seconds for README
- Use `Sleep` commands to let viewers read
- Use `Ctrl+L` to clear screen between commands
- Test with `vhs demo.tape` locally before committing
