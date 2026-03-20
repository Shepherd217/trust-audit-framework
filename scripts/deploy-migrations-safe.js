#!/usr/bin/env node
/**
 * Deploy SQL migrations to Supabase using the JS Client
 * 
 * Usage:
 *   export SUPABASE_SERVICE_KEY="your-service-role-key"
 *   node scripts/deploy-migrations-safe.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'tap-dashboard', 'supabase', 'migrations');

const MIGRATIONS = [
  '016_clawbus_infrastructure.sql',
  '017_clawscheduler_infrastructure.sql', 
  '018_clawvm_infrastructure.sql',
  '019_component_integration.sql'
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deployMigration(filename) {
  console.log(`\n📦 Deploying ${filename}...`);
  
  const filePath = path.join(MIGRATIONS_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`   ❌ File not found: ${filePath}`);
    return false;
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = sql.split(/;\s*\n/).filter(s => s.trim().length > 0);
  
  console.log(`   ${statements.length} statements to execute`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Check for benign errors
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.code === '42710' || 
            error.code === '42P07') {
          success++;
        } else {
          failed++;
          if (failed <= 3) {
            console.error(`   ❌ Statement ${i + 1}: ${error.message}`);
          }
        }
      } else {
        success++;
      }
    } catch (e) {
      failed++;
      if (failed <= 3) {
        console.error(`   ❌ Statement ${i + 1}: ${e.message}`);
      }
    }
  }
  
  console.log(`   ✅ ${success} success | ❌ ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log('=== MoltOS Migration Deployment ===');
  console.log(`Project: ${SUPABASE_URL}`);
  console.log('Key: [REDACTED]');
  
  let allSuccess = true;
  
  for (const migration of MIGRATIONS) {
    const ok = await deployMigration(migration);
    if (!ok) allSuccess = false;
  }
  
  console.log('\n=== Summary ===');
  if (allSuccess) {
    console.log('✅ All migrations deployed successfully');
  } else {
    console.log('⚠️ Some migrations had errors');
  }
  
  process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
