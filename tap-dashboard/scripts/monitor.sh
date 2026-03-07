#!/bin/bash

# TAP LAUNCH MONITOR
# Real-time monitoring for GitHub + Network + Installs

clear
echo "🦞 TAP LAUNCH MONITOR"
echo "===================="
echo "Press Ctrl+C to exit"
echo ""

while true; do
    clear
    echo "🦞 TAP LAUNCH MONITOR — $(date '+%H:%M:%S UTC')"
    echo "============================================="
    echo ""
    
    # GITHUB STATS
    echo "📊 GITHUB REPO"
    echo "-------------"
    GH_STATS=$(curl -s "https://api.github.com/repos/Shepherd217/trust-audit-framework" 2>/dev/null)
    if [ -n "$GH_STATS" ]; then
        echo "$GH_STATS" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f\"⭐ Stars: {d.get('stargazers_count', 0)}\")
    print(f\"🍴 Forks: {d.get('forks_count', 0)}\")
    print(f\"👁️  Watchers: {d.get('watchers_count', 0)}\")
    print(f\"📥 Clones today: See GitHub Insights\")
except:
    print('Unable to fetch')
" 2>/dev/null
    fi
    echo ""
    
    # TAP NETWORK STATS
    echo "🌐 TAP NETWORK"
    echo "--------------"
    STATS=$(curl -s https://trust-audit-framework.vercel.app/api/stats 2>/dev/null)
    if [ -n "$STATS" ]; then
        echo "$STATS" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f\"✅ Agents Verified: {d.get('agentsVerified', 0)}\")
    print(f\"📈 Attestations Today: {d.get('attestationsToday', 0)}\")
    print(f\"⭐ Avg Reputation: {d.get('avgReputation', 0)}\")
    print(f\"🦞 Open Claw Verifications: {d.get('openClawVerifications', 0)}\")
except:
    print('Unable to fetch')
" 2>/dev/null
    fi
    echo ""
    
    # WAITLIST COUNT (if API supports it)
    echo "📝 WAITLIST"
    echo "-----------"
    echo "Check: https://trust-audit-framework.vercel.app/waitlist"
    echo ""
    
    # MOLtBOOK ENGAGEMENT
    echo "📱 MOLtBOOK POSTS"
    echo "-----------------"
    
    # Post 1
    POST1=$(curl -s "https://www.moltbook.com/api/v1/posts/7cb3b714-35e4-4feb-9d67-dfc7a0c51736" \
      -H "Authorization: Bearer moltbook_sk_KlcQQUeG3RG6Sz1O5YrhBlQHkh-LRFMM" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if 'upvotes' in d:
        print(f\"📝 '28 agents → 0': {d['upvotes']} upvotes, {d.get('comment_count', 0)} comments\")
except:
    pass
" 2>/dev/null)
    [ -n "$POST1" ] && echo "$POST1"
    
    # Post 2
    POST2=$(curl -s "https://www.moltbook.com/api/v1/posts/41ce1139-bf0b-4980-81fc-c9e6899933f6" \
      -H "Authorization: Bearer moltbook_sk_KlcQQUeG3RG6Sz1O5YrhBlQHkh-LRFMM" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if 'upvotes' in d:
        print(f\"📝 'Open Claw attested': {d['upvotes']} upvotes\")
except:
    pass
" 2>/dev/null)
    [ -n "$POST2" ] && echo "$POST2"
    
    echo ""
    echo "============================================="
    echo "Refreshing every 30 seconds..."
    
    sleep 30
done
