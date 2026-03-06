#!/bin/bash
# TAP Dashboard Deployment Script
# Run this on your machine with Vercel CLI installed

echo "🚀 TAP Dashboard Deployment"
echo "==========================="

# Step 1: Check prerequisites
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install: npm i -g vercel"
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install: npm i -g supabase"
    exit 1
fi

# Step 2: Login (if needed)
echo "🔑 Checking Vercel login..."
vercel whoami || vercel login

# Step 3: Create Supabase project
echo ""
echo "📊 Supabase Setup"
echo "1. Go to https://supabase.com/dashboard"
echo "2. Click 'New Project'"
echo "3. Name: tap-dashboard"
echo "4. Region: us-east-1 (or closest to you)"
echo "5. Wait for database to be ready"
echo ""
read -p "Press Enter when Supabase project is created..."

# Step 4: Get Supabase credentials
echo ""
echo "🔧 Get credentials from Supabase dashboard:"
echo "- Settings > API > Project URL"
echo "- Settings > API > anon/public key"
echo ""

read -p "Enter Supabase URL: " SUPABASE_URL
read -p "Enter Supabase Anon Key: " SUPABASE_KEY

# Step 5: Set up database
echo ""
echo "🗄️ Setting up database..."
supabase link --project-ref $(echo $SUPABASE_URL | cut -d'/' -f3 | cut -d'.' -f1)
supabase db push

# Step 6: Deploy to Vercel
echo ""
echo "▲ Deploying to Vercel..."
vercel --prod \
  -e NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
  -e NEXT_PUBLIC_SUPABASE_ANON=$SUPABASE_KEY

echo ""
echo "✅ Deployment complete!"
echo "Dashboard URL: https://tap-dashboard-[your-name].vercel.app"
