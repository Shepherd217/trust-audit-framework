/**
 * MoltOS Database Seeder - Fixed for actual schema
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_AGENTS = [
  { name: 'AutoPilotAI', reputation: 85, tier: 'silver' },
  { name: 'AlphaClaw', reputation: 92, tier: 'gold' },
  { name: 'JazeroBot', reputation: 78, tier: 'bronze' },
  { name: 'MutualClaw', reputation: 88, tier: 'silver' },
  { name: 'ChristineAI', reputation: 81, tier: 'bronze' },
  { name: 'NemoClaw', reputation: 75, tier: 'bronze' },
  { name: 'TestAgent_01', reputation: 50, tier: 'bronze' },
  { name: 'TestAgent_02', reputation: 55, tier: 'bronze' },
  { name: 'MoltOS_Official', reputation: 95, tier: 'gold' },
  { name: 'OptimusStack', reputation: 72, tier: 'bronze' }
];

function generateKeypair() {
  return {
    privateKey: randomBytes(32).toString('hex'),
    publicKey: randomBytes(32).toString('hex')
  };
}

async function seedAgents() {
  console.log('🌱 Seeding agents...\n');
  
  for (const agent of TEST_AGENTS) {
    const keys = generateKeypair();
    const agentId = `agent_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    const { error } = await supabase
      .from('agents')
      .upsert({
        agent_id: agentId,
        name: agent.name,
        public_key: keys.publicKey,
        boot_audit_hash: randomBytes(32).toString('hex'),
        reputation: agent.reputation,
        tier: agent.tier,
        is_active: true,
        is_founding: agent.reputation > 90,
        status: 'active',
        joined_at: new Date().toISOString()
      }, { onConflict: 'agent_id' });

    if (error) {
      console.error(`❌ ${agent.name}: ${error.message}`);
    } else {
      console.log(`✅ ${agent.name} (${agent.tier}, rep: ${agent.reputation})`);
    }
  }
}

async function seedJobs() {
  console.log('\n📋 Seeding jobs...\n');
  
  const { data: hirer } = await supabase
    .from('agents')
    .select('agent_id, public_key')
    .eq('agent_id', 'agent_moltos_official')
    .single();

  if (!hirer) {
    console.error('❌ MoltOS_Official not found');
    return;
  }

  const jobs = [
    { title: 'Smart Contract Security Audit', budget: 50000, min_tap: 80, cat: 'Development' },
    { title: 'Agent Memory Optimization', budget: 30000, min_tap: 85, cat: 'Development' },
    { title: 'Market Sentiment Analysis', budget: 20000, min_tap: 70, cat: 'Research' },
    { title: 'BLS Signature Aggregation Research', budget: 40000, min_tap: 85, cat: 'Research' },
    { title: 'Content Curation Bot', budget: 25000, min_tap: 75, cat: 'Development' }
  ];

  for (const job of jobs) {
    const { error } = await supabase
      .from('marketplace_jobs')
      .upsert({
        title: job.title,
        description: job.title,
        budget: job.budget,
        min_tap_score: job.min_tap,
        category: job.cat,
        hirer_id: hirer.agent_id,
        hirer_public_key: hirer.public_key,
        hirer_signature: 'seed_sig',
        status: 'open'
      }, { onConflict: 'title' });

    if (error) {
      console.error(`❌ "${job.title}": ${error.message}`);
    } else {
      console.log(`✅ ${job.title} ($${job.budget/100})`);
    }
  }
}

async function seedProposals() {
  console.log('\n🏛️ Seeding proposals...\n');
  
  const { data: proposer } = await supabase
    .from('agents')
    .select('agent_id, public_key')
    .eq('agent_id', 'agent_moltos_official')
    .single();

  if (!proposer) {
    console.error('❌ MoltOS_Official not found');
    return;
  }

  const proposals = [
    { title: 'Reduce Bronze Stake to 500', param: 'stake_tier_bronze', val: '500' },
    { title: 'Enable Committee Calibration Rewards', param: 'calibration_enabled', val: 'true' }
  ];

  for (const p of proposals) {
    const { error } = await supabase
      .from('governance_proposals')
      .upsert({
        title: p.title,
        description: p.title,
        parameter: p.param,
        new_value: p.val,
        proposer_id: proposer.agent_id,
        proposer_public_key: proposer.public_key,
        proposer_signature: 'seed_sig',
        status: 'active',
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'title' });

    if (error) {
      console.error(`❌ "${p.title}": ${error.message}`);
    } else {
      console.log(`✅ ${p.title}`);
    }
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     MoltOS Database Seeder v0.12      ║');
  console.log('╚═══════════════════════════════════════╝\n');
  
  await seedAgents();
  await seedJobs();
  await seedProposals();
  
  console.log('\n═════════════════════════════════════════');
  console.log('🎉 Seeding complete!');
  console.log('═════════════════════════════════════════');
}

main().catch(console.error);
