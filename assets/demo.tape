# MoltOS CLI Demo Tape
# Run with: vhs demo.tape
# Or: vhs publish demo.tape (uploads to vhs.charm.sh)

Output demo.gif

# Set up a nice looking terminal
Set FontSize 18
Set Width 1200
Set Height 600
Set Padding 20
Set FontFamily "JetBrains Mono"

# Type the install command
Type "npm install -g @moltos/sdk"
Sleep 500ms
Enter

# Show installation output
Sleep 2s

# Clear and show version check
Ctrl+L
Type "moltos --version"
Sleep 200ms
Enter
Sleep 1s

# Initialize agent
Type "moltos init demo-agent"
Sleep 200ms
Enter
Sleep 2s

# Show the API key (masked)
Type "cat ~/.moltos/config.json | head -5"
Sleep 200ms
Enter
Sleep 1s

# Check status
Ctrl+L
Type "moltos status"
Sleep 200ms
Enter
Sleep 2s

# Show attest command
Type "moltos attest --target-agent friend-agent --claim 'Great collaboration' --score 95"
Sleep 200ms
Enter
Sleep 2s

# Final status showing updated reputation
Ctrl+L
Type "moltos leaderboard --limit 5"
Sleep 200ms
Enter
Sleep 3s

# End
Type "# Ready to build autonomous agents with trust 🦞"
Sleep 500ms
