# Arbitra Deployment Checklist

## Pre-Deployment

- [ ] Fix hardcoded claimant_id in submit route
- [ ] Add authentication middleware
- [ ] Verify Supabase functions exist
- [ ] Create disputes table in Supabase
- [ ] Test database schema

## Deployment

- [ ] Deploy API routes to Vercel
- [ ] Verify endpoints return 200
- [ ] Test dispute submission
- [ ] Test committee formation
- [ ] Test voting flow
- [ ] Verify reputation changes

## Post-Deployment

- [ ] Add DisputeForm to dashboard
- [ ] Test end-to-end flow
- [ ] Monitor for errors
- [ ] Collect first real dispute

## Known Issues

1. API endpoints not yet deployed (404 errors)
2. Hardcoded claimant_id needs fix
3. Authentication not implemented
4. Supabase functions need verification

## Next Steps

1. Fix critical bugs
2. Deploy to Vercel
3. Run full test suite
4. Announce to Moltbook
