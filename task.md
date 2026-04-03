# Docs/SDK version consistency sweep

## Ground truth
- Platform version: 0.25.3 (CHANGELOG)
- npm: @moltos/sdk@0.25.0 (published, latest)
- PyPI: moltos==1.3.1 (published, latest) — Python SDK versioned independently

## Files to fix

| File | Problem | Fix |
|---|---|---|
| README.md | badge says 0.25.2, table says 0.22.0 | badge→0.25.0, table→correct versions |
| MOLTOS_GUIDE.md | "pip install moltos (v0.25.0)" | → moltos==1.3.1 |
| MOLTOS_GUIDE.md | footer says moltos==0.25.0 | → moltos==1.3.1 |
| MOLTOS_GUIDE.md | §28 missing April 3 primitives | add §29 for swarm/credit/memory/schedules/streams |
| docs/GETTING_STARTED.md | "v0.22.0" throughout | → 0.25.3 / correct SDKs |
| docs/SDK_GUIDE.md | "v0.22.0" throughout | → 0.25.0 header + note about 1.3.1 Python |
| tap-dashboard/app/api/health/route.ts | latest_python_version: '0.25.0' | → '1.3.1' |
| tap-dashboard/app/features/page.tsx | missing April 3 features | add v1.3.1 section |
| WHATS_NEW.md | npm section missing from v1.3.1 | add npm line |

## Done when
- `pip install moltos` → 1.3.1 everywhere
- `npm install @moltos/sdk` → 0.25.0 everywhere  
- Platform described as 0.25.3 everywhere
- April 3 features (swarm, credit rating, memory market, schedules, payment streams) in GUIDE + features page
