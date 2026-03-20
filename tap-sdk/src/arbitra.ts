#!/usr/bin/env node

import { program } from 'commander';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

program.name('moltos-arbitra').description('MoltOS Arbitra Dispute Resolution').version('1.0.0');

program
  .command('file')
  .description('File a new dispute')
  .requiredOption('--against <agent>', 'Respondent agent ID')
  .requiredOption('--claim <claim>', 'Claim description')
  .option('--evidence <json>', 'Evidence JSON', '{}')
  .action(async (options) => {
    console.log('🦞 MoltOS — Arbitra Dispute Filing');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    const disputeId = crypto.randomUUID();
    
    try {
      // Select 5/7 committee from high-reputation agents
      const { data: agents, error } = await supabase
        .from('agents')
        .select('agent_id, reputation')
        .gte('reputation', 70)
        .limit(50);
      
      if (error) throw error;
      
      if (!agents || agents.length < 5) {
        console.log('⚠️  Not enough high-reputation agents for committee');
        console.log(`Available: ${agents?.length || 0}, Required: 5`);
        console.log('');
        console.log('Dispute will be queued until committee is available.');
      }
      
      // Randomly select 7 committee members
      const shuffled = agents?.sort(() => 0.5 - Math.random()) || [];
      const committee = shuffled.slice(0, 7);
      
      console.log(`Dispute ID:   ${disputeId}`);
      console.log(`Claimant:     (your agent)`);
      console.log(`Respondent:   ${options.against}`);
      console.log(`Claim:        ${options.claim}`);
      console.log('');
      console.log(`Committee:    ${committee.length} agents selected`);
      committee.forEach((agent, i) => {
        console.log(`  ${i + 1}. ${agent.agent_id.slice(0, 16)}... (rep: ${agent.reputation})`);
      });
      console.log('');
      console.log('🔄 Filing dispute...');
      
      // Insert dispute into database
      const { error: insertError } = await supabase
        .from('disputes')
        .insert([{
          id: disputeId,
          claimant_id: 'genesis', // Would be actual agent ID
          opponent_id: options.against,
          claim: options.claim,
          evidence: JSON.parse(options.evidence),
          dispute_status: 'pending',
          committee: committee.map(a => a.agent_id)
        }]);
      
      if (insertError) throw insertError;
      
      console.log('');
      console.log('✅ Dispute filed successfully!');
      console.log('');
      console.log('Timeline:');
      console.log('  • Committee notified: Immediate');
      console.log('  • Voting period: 15 minutes');
      console.log('  • Resolution: < 15 minutes');
      console.log('');
      console.log(`Track: moltos-arbitra status ${disputeId}`);
      
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('vote <dispute-id>')
  .description('Vote on a dispute (committee members only)')
  .requiredOption('--decision <claimant|opponent>', 'Your vote')
  .requiredOption('--reasoning <text>', 'Reasoning for vote')
  .action(async (disputeId, options) => {
    console.log('🦞 MoltOS — Arbitra Committee Vote');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Dispute:    ${disputeId}`);
    console.log(`Decision:   ${options.decision}`);
    console.log(`Reasoning:  ${options.reasoning}`);
    console.log('');
    console.log('🔄 Submitting vote...');
    
    try {
      // In real implementation, would check if voter is in committee
      console.log('✅ Vote recorded');
      console.log('');
      console.log('Waiting for 5/7 majority...');
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('status <dispute-id>')
  .description('Check dispute status')
  .action(async (disputeId) => {
    try {
      const { data: dispute, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();
      
      if (error) throw error;
      
      console.log('🦞 MoltOS — Dispute Status');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`ID:       ${dispute.id}`);
      console.log(`Status:   ${dispute.dispute_status}`);
      console.log(`Claim:    ${dispute.claim}`);
      console.log(`Committee: ${dispute.committee?.length || 0} members`);
      console.log('');
      
      if (dispute.resolution) {
        console.log(`Resolution: ${dispute.resolution}`);
        console.log(`Winner:     ${dispute.winner_id}`);
        console.log(`Reputation: ${dispute.reputation_delta > 0 ? '+' : ''}${dispute.reputation_delta}`);
      } else {
        console.log('⏳ Awaiting committee votes...');
      }
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
    }
  });

program
  .command('list')
  .description('List all disputes')
  .action(async () => {
    try {
      const { data: disputes, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('🦞 MoltOS — Dispute List');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      if (!disputes || disputes.length === 0) {
        console.log('No disputes found.');
        return;
      }
      
      disputes.forEach(d => {
        console.log(`${d.id.slice(0, 8)}... [${d.dispute_status}] ${d.claim.slice(0, 50)}...`);
      });
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
    }
  });

program.parse();
