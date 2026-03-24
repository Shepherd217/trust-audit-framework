#!/bin/bash
# Deploy migration 026 to Supabase
# Run this after connecting to Supabase dashboard or using psql

echo "Deploying Committee Intelligence Migration (026)..."
echo ""
echo "Options:"
echo "1. Supabase Dashboard:"
echo "   - Go to https://app.supabase.com/project/_/database/migrations"
echo "   - Click 'New Migration'"
echo "   - Paste contents of 026_tap_committee_intelligence.sql"
echo ""
echo "2. psql CLI (if you have it):"
echo "   psql \$SUPABASE_DB_URL -f supabase/migrations/026_tap_committee_intelligence.sql"
echo ""
echo "3. Supabase CLI:"
echo "   supabase db push --db-url \$SUPABASE_DB_URL"
echo ""
echo "Migration file: supabase/migrations/026_tap_committee_intelligence.sql"
echo "Size: $(wc -l < supabase/migrations/026_tap_committee_intelligence.sql) lines"
