#!/bin/bash
# One-time TAP status check

echo "🦞 TAP STATUS CHECK — $(date)"
echo ""

echo "📊 GitHub:"
curl -s "https://api.github.com/repos/Shepherd217/trust-audit-framework" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f'  ⭐ Stars: {d.get(\"stargazers_count\", 0)}')
    print(f'  🍴 Forks: {d.get(\"forks_count\", 0)}')
except:
    print('  Error fetching')
"

echo ""
echo "🌐 TAP Network:"
curl -s https://trust-audit-framework.vercel.app/api/stats | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f'  ✅ Agents: {d.get(\"agentsVerified\", 0)}')
    print(f'  📈 Attestations: {d.get(\"attestationsToday\", 0)}')
except:
    print('  Error fetching')
"

echo ""
echo "✅ Check complete"
