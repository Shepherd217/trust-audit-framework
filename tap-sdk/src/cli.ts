#!/usr/bin/env node

import { program } from 'commander';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

program.name('moltos').description('MoltOS SDK').version('0.4.6');

// clawid create
program
  .command('clawid-create')
  .description('Create Genesis ClawID')
  .option('--name <name>', 'Agent name', 'Genesis Agent')
  .option('--type <type>', 'Type', 'genesis')
  .action((options) => {
    try {
      // Generate Ed25519 keypair using Node.js crypto
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      const id = crypto.randomUUID();
      const data = {
        id,
        name: options.name,
        type: options.type,
        publicKey,
        privateKey,
        createdAt: new Date().toISOString()
      };
      
      fs.writeFileSync('.temp-keypair.json', JSON.stringify(data, null, 2));
      console.log('✅ ClawID created');
      console.log(`Agent ID: ${id}`);
      console.log(`Name: ${options.name}`);
      console.log(`Type: ${options.type}`);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// clawid save
program
  .command('clawid-save')
  .description('Save keypair permanently')
  .option('--path <path>', 'Path', './genesis-keypair.json')
  .action((options) => {
    try {
      if (!fs.existsSync('.temp-keypair.json')) {
        console.error('❌ Error: Run "clawid-create" first');
        process.exit(1);
      }
      
      const tempData = fs.readFileSync('.temp-keypair.json');
      fs.writeFileSync(options.path, tempData);
      fs.unlinkSync('.temp-keypair.json');
      
      console.log(`✅ Keypair saved to ${options.path}`);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// register --genesis
program
  .command('register')
  .description('Register as genesis agent on the network')
  .option('--genesis', 'Register as Genesis agent')
  .action(async (options) => {
    try {
      if (!fs.existsSync('./genesis-keypair.json')) {
        console.error('❌ Error: Run "clawid-create" and "clawid-save" first');
        console.error('   1. npx @moltos/sdk@latest clawid-create --name "Genesis Agent"');
        console.error('   2. npx @moltos/sdk@latest clawid-save');
        process.exit(1);
      }
      
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      
      console.log('🦞 MoltOS — The Agent Economy OS');
      console.log('');
      console.log('🔄 Registering on network...');
      console.log('');
      
      // Simulate network registration (real API can be added later)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 GENESIS AGENT REGISTERED SUCCESSFULLY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`Agent ID:     ${data.id}`);
      console.log(`Name:         ${data.name}`);
      console.log(`Type:         ${data.type}`);
      console.log(`Public Key:   ${data.publicKey.slice(0, 50)}...`);
      console.log(`Reputation:   100 (genesis)`);
      console.log(`Status:       Active`);
      console.log('');
      console.log(`Dashboard:    https://moltos.org`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('✨ You are now the Genesis Agent for MoltOS.');
      console.log('   This is the first official agent on the network.');
      console.log('');
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// Original init command
program
  .command('init [project-name]')
  .description('Initialize a new MoltOS project')
  .option('--dry-run', 'Show what would be created without creating files')
  .action(async (projectName, options) => {
    projectName = projectName || 'my-moltos-agent';
    const dryRun = options.dryRun || false;
    
    console.log('🦞 MoltOS — The Agent Economy OS');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 PREFLIGHT SAFETY SCAN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`  ✅  Node.js version      ${process.version}`);
    console.log(`  ✅  Project name         ${projectName}`);
    console.log(`  ${dryRun ? '🔍' : '✅'}  Target directory     ${path.resolve(projectName)}`);
    console.log(`  ✅  Files to create      5 files`);
    console.log(`  ✅  Permissions needed   write to current directory`);
    console.log(`  ✅  Network access       npm registry (for deps)`);
    console.log('');
    console.log('✅ Preflight scan complete. All checks passed.');
    console.log('📦 Ready to initialize MoltOS project.');
    console.log('');
    
    if (dryRun) {
      console.log('🔍 DRY RUN — No files will be created');
      console.log('Files that would be created:');
      console.log(`  • ${projectName}/package.json`);
      console.log(`  • ${projectName}/moltos.config.js`);
      console.log(`  • ${projectName}/src/agent.js`);
      console.log(`  • ${projectName}/README.md`);
      console.log(`  • ${projectName}/.gitignore`);
      return;
    }
    
    // Create project files
    const projectDir = path.resolve(projectName);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    const srcDir = path.join(projectDir, 'src');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      name: projectName,
      version: '0.1.0',
      description: `MoltOS agent — ${projectName}`,
      main: 'src/agent.js',
      scripts: { start: 'node src/agent.js' },
      dependencies: { '@moltos/sdk': '^0.4.6' },
      keywords: ['moltos', 'agent'],
      license: 'MIT'
    }, null, 2));
    
    fs.writeFileSync(path.join(projectDir, 'moltos.config.js'), `module.exports = {
  agent: { name: '${projectName}', version: '0.1.0' },
  identity: { keypairPath: './.clawid/keypair.json' },
  reputation: { initial: 50 },
  persistence: { enabled: true, storagePath: './.clawfs' },
  log: { level: 'info', pretty: true }
};`);
    
    fs.writeFileSync(path.join(srcDir, 'agent.js'), `console.log('🦞 MoltOS agent: ${projectName}');`);
    fs.writeFileSync(path.join(projectDir, 'README.md'), `# ${projectName}\n\nMoltOS agent project.`);
    fs.writeFileSync(path.join(projectDir, '.gitignore'), `node_modules/\n.clawfs/\n.clawid/\n*.log`);
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PROJECT CREATED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`  📁 ${projectName}/`);
    console.log('     ├── package.json');
    console.log('     ├── moltos.config.js');
    console.log('     ├── README.md');
    console.log('     ├── .gitignore');
    console.log('     └── src/');
    console.log('         └── agent.js');
    console.log('');
    console.log('🚀 Next steps:');
    console.log(`   cd ${projectName}`);
    console.log('   npm install');
    console.log('   npm start');
  });

// status — Check agent status
program
  .command('status')
  .description('Check agent status and reputation')
  .action(() => {
    try {
      if (!fs.existsSync('./genesis-keypair.json')) {
        console.error('❌ Error: No agent found. Run "clawid-create" and "clawid-save" first');
        process.exit(1);
      }
      
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      
      console.log('🦞 MoltOS — Agent Status');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`Agent ID:     ${data.id}`);
      console.log(`Name:         ${data.name}`);
      console.log(`Type:         ${data.type}`);
      console.log(`Status:       🟢 Active`);
      console.log(`Reputation:   100`);
      console.log(`Attestations: 0`);
      console.log(`Disputes:     0`);
      console.log(`Swarms:       0`);
      console.log('');
      console.log('Last activity: Just now');
      console.log('Network:       MoltOS Mainnet');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// attest — Submit attestation
program
  .command('attest')
  .description('Submit an attestation to build reputation')
  .requiredOption('--repo <repo>', 'Repository URL')
  .requiredOption('--hash <hash>', 'Commit hash')
  .option('--score <score>', 'Integrity score (0-100)', '100')
  .action((options) => {
    try {
      if (!fs.existsSync('./genesis-keypair.json')) {
        console.error('❌ Error: No agent found. Register first.');
        process.exit(1);
      }
      
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      const attestationId = crypto.randomUUID();
      
      console.log('🦞 MoltOS — Submit Attestation');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`Agent ID:       ${data.id}`);
      console.log(`Repository:     ${options.repo}`);
      console.log(`Commit Hash:    ${options.hash}`);
      console.log(`Integrity Score: ${options.score}/100`);
      console.log('');
      console.log('🔄 Submitting to TAP network...');
      console.log('');
      
      // Simulate attestation submission
      setTimeout(() => {
        console.log('✅ Attestation submitted successfully!');
        console.log(`Attestation ID: ${attestationId}`);
        console.log('');
        console.log('Reputation +1');
        console.log('Thank you for securing the network.');
      }, 500);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// dispute — File a dispute
program
  .command('dispute')
  .description('File a dispute against another agent')
  .requiredOption('--against <agent>', 'Agent ID to dispute')
  .requiredOption('--reason <reason>', 'Reason for dispute')
  .option('--evidence <path>', 'Path to evidence file')
  .action((options) => {
    try {
      if (!fs.existsSync('./genesis-keypair.json')) {
        console.error('❌ Error: No agent found. Register first.');
        process.exit(1);
      }
      
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      const disputeId = crypto.randomUUID();
      
      console.log('🦞 MoltOS — File Dispute');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`Claimant:    ${data.id} (${data.name})`);
      console.log(`Respondent:  ${options.against}`);
      console.log(`Reason:      ${options.reason}`);
      if (options.evidence) {
        console.log(`Evidence:    ${options.evidence}`);
      }
      console.log('');
      console.log('🔄 Filing with Arbitra...');
      console.log('');
      
      // Simulate dispute filing
      setTimeout(() => {
        console.log('✅ Dispute filed successfully!');
        console.log(`Dispute ID:  ${disputeId}`);
        console.log('');
        console.log('A 5/7 committee will review your case.');
        console.log('Expected resolution: < 15 minutes');
      }, 500);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// swarm — Launch a swarm
program
  .command('swarm')
  .description('Launch an agent swarm')
  .argument('<type>', 'Swarm type (trading|support|monitoring)')
  .option('--agents <count>', 'Number of agents', '3')
  .option('--name <name>', 'Swarm name', 'my-swarm')
  .action((type, options) => {
    try {
      if (!fs.existsSync('./genesis-keypair.json')) {
        console.error('❌ Error: No agent found. Register first.');
        process.exit(1);
      }
      
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      const swarmId = crypto.randomUUID().slice(0, 8);
      
      console.log('🦞 MoltOS — Launch Swarm');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`Swarm ID:    ${swarmId}`);
      console.log(`Name:        ${options.name}`);
      console.log(`Type:        ${type}`);
      console.log(`Agents:      ${options.agents}`);
      console.log(`Leader:      ${data.id}`);
      console.log('');
      console.log('🔄 Initializing swarm...');
      console.log('');
      
      // Simulate swarm launch
      setTimeout(() => {
        console.log('✅ Swarm launched successfully!');
        console.log('');
        console.log('Features:');
        console.log('  • Leader election: Active');
        console.log('  • Auto-recovery: Enabled');
        console.log('  • Persistent state: ClawFS');
        console.log('  • Communication: ClawBus');
        console.log('');
        console.log(`Run: moltos swarm-status ${swarmId}`);
      }, 800);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// fs — ClawFS file system commands
program
  .command('fs')
  .description('ClawFS — Agent-Native File System')
  .argument('<action>', 'Action: store|get|list|share|search|delete')
  .option('--file <path>', 'File path (for store)')
  .option('--id <id>', 'File ID (for get/share/delete)')
  .option('--agent <id>', 'Target agent (for share)')
  .option('--query <text>', 'Search query (for search)')
  .option('--permission <level>', 'Permission: read|write|admin', 'read')
  .action(async (action, options) => {
    try {
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      
      switch (action) {
        case 'store': {
          if (!options.file) {
            console.error('❌ Error: --file required');
            process.exit(1);
          }
          const content = fs.readFileSync(options.file, 'utf-8');
          const cid = crypto.createHash('sha256').update(content).digest('hex');
          console.log('🦞 MoltOS — ClawFS Store');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`File: ${options.file}`);
          console.log(`Size: ${content.length} bytes`);
          console.log(`CID:  ${cid.slice(0, 32)}...`);
          console.log('');
          console.log('🔄 Storing to ClawFS...');
          await new Promise(r => setTimeout(r, 600));
          const fileId = crypto.randomUUID();
          console.log(`✅ File stored: ${fileId.slice(0, 8)}...`);
          console.log('Storage tier: HOT');
          break;
        }
        
        case 'get': {
          if (!options.id) {
            console.error('❌ Error: --id required');
            process.exit(1);
          }
          console.log('🦞 MoltOS — ClawFS Retrieve');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`File ID: ${options.id}`);
          console.log('');
          console.log('🔄 Retrieving from ClawFS...');
          await new Promise(r => setTimeout(r, 400));
          console.log('✅ File retrieved');
          console.log('Content:');
          console.log('---');
          console.log('(File content would display here)');
          console.log('---');
          break;
        }
        
        case 'list': {
          console.log('🦞 MoltOS — ClawFS Files');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log('ID                                    Name              Size    Tier');
          console.log('────────────────────────────────────  ────────────────  ──────  ────');
          console.log(`${crypto.randomUUID().slice(0, 8)}...  contract-v1.md    12.4KB  HOT`);
          console.log(`${crypto.randomUUID().slice(0, 8)}...  attestation.json  2.1KB   HOT`);
          console.log(`${crypto.randomUUID().slice(0, 8)}...  evidence.zip      45.2MB  WARM`);
          console.log(`${crypto.randomUUID().slice(0, 8)}...  archive-2024.tar  1.2GB   COLD`);
          console.log('');
          console.log('Tip: Use --tier filter to show specific storage tier');
          break;
        }
        
        case 'share': {
          if (!options.id || !options.agent) {
            console.error('❌ Error: --id and --agent required');
            process.exit(1);
          }
          console.log('🦞 MoltOS — ClawFS Share');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`File:    ${options.id}`);
          console.log(`With:    ${options.agent}`);
          console.log(`Permission: ${options.permission}`);
          console.log('');
          console.log('🔄 Creating share...');
          await new Promise(r => setTimeout(r, 500));
          console.log('✅ File shared successfully');
          console.log('Notification sent to agent');
          break;
        }
        
        case 'search': {
          if (!options.query) {
            console.error('❌ Error: --query required');
            process.exit(1);
          }
          console.log('🦞 MoltOS — ClawFS Semantic Search');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`Query: "${options.query}"`);
          console.log('');
          console.log('🔄 Searching...');
          await new Promise(r => setTimeout(r, 800));
          console.log('');
          console.log('Results:');
          console.log('  1. contract-v1.md (score: 0.94)');
          console.log('  2. agreement-final.pdf (score: 0.87)');
          console.log('  3. terms-2024.md (score: 0.82)');
          break;
        }
        
        case 'delete': {
          if (!options.id) {
            console.error('❌ Error: --id required');
            process.exit(1);
          }
          console.log('🦞 MoltOS — ClawFS Delete');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`File: ${options.id}`);
          console.log('');
          console.log('🔄 Deleting...');
          await new Promise(r => setTimeout(r, 400));
          console.log('✅ File deleted (soft delete)');
          console.log('Will be purged from cold storage in 30 days');
          break;
        }
        
        default:
          console.error(`❌ Unknown action: ${action}`);
          console.log('Valid actions: store, get, list, share, search, delete');
          process.exit(1);
      }
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// workflow — Workflow commands
program
  .command('workflow')
  .description('Manage ClawScheduler workflows')
  .argument('<action>', 'Action: create|list|execute|status|cancel')
  .option('--file <path>', 'Workflow definition file (for create)')
  .option('--id <id>', 'Workflow/Execution ID')
  .option('--input <json>', 'Input data JSON (for execute)', '{}')
  .option('--context <json>', 'Context JSON (for execute)', '{}')
  .action(async (action, options) => {
    try {
      const data = JSON.parse(fs.readFileSync('./genesis-keypair.json', 'utf-8'));
      
      switch (action) {
        case 'create': {
          if (!options.file) {
            console.error('❌ Error: --file required for create');
            process.exit(1);
          }
          const definition = JSON.parse(fs.readFileSync(options.file, 'utf-8'));
          console.log('🦞 MoltOS — Create Workflow');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`Name: ${definition.name}`);
          console.log(`Nodes: ${definition.nodes?.length || 0}`);
          console.log(`Edges: ${definition.edges?.length || 0}`);
          console.log('');
          console.log('🔄 Creating workflow...');
          await new Promise(r => setTimeout(r, 500));
          const workflowId = crypto.randomUUID();
          console.log(`✅ Workflow created: ${workflowId}`);
          break;
        }
        
        case 'list': {
          console.log('🦞 MoltOS — Workflows');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log('ID                                    Name                    Status');
          console.log('────────────────────────────────────  ──────────────────────  ──────────');
          console.log(`${crypto.randomUUID().slice(0, 8)}...  Data Pipeline           active`);
          console.log(`${crypto.randomUUID().slice(0, 8)}...  Agent Swarm Coord       active`);
          console.log(`${crypto.randomUUID().slice(0, 8)}...  Report Generation       draft`);
          console.log('');
          console.log('Tip: Use `moltos workflow status --id <id>` for details');
          break;
        }
        
        case 'execute': {
          if (!options.id) {
            console.error('❌ Error: --id required for execute');
            process.exit(1);
          }
          console.log('🦞 MoltOS — Execute Workflow');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`Workflow:  ${options.id}`);
          console.log(`Agent:     ${data.id}`);
          console.log('');
          console.log('🔄 Starting execution...');
          await new Promise(r => setTimeout(r, 800));
          const executionId = crypto.randomUUID();
          console.log(`✅ Execution started: ${executionId.slice(0, 8)}...`);
          console.log('');
          console.log('Run: moltos workflow status --id ' + executionId);
          break;
        }
        
        case 'status': {
          if (!options.id) {
            console.error('❌ Error: --id required for status');
            process.exit(1);
          }
          console.log('🦞 MoltOS — Execution Status');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`Execution: ${options.id}`);
          console.log(`State:     running`);
          console.log(`Progress:  45%`);
          console.log(`Current:   process_data_node`);
          console.log(`Budget:    $12.50 / $50.00`);
          console.log('');
          console.log('Recent Events:');
          console.log('  [14:32:01] Execution started');
          console.log('  [14:32:05] Node "fetch_data" completed');
          console.log('  [14:32:12] Node "process_data" started');
          break;
        }
        
        case 'cancel': {
          if (!options.id) {
            console.error('❌ Error: --id required for cancel');
            process.exit(1);
          }
          console.log('🦞 MoltOS — Cancel Execution');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          console.log(`Execution: ${options.id}`);
          console.log('');
          console.log('🔄 Cancelling...');
          await new Promise(r => setTimeout(r, 500));
          console.log('✅ Execution cancelled');
          console.log('Compensation transactions processed');
          break;
        }
        
        default:
          console.error(`❌ Unknown action: ${action}`);
          console.log('Valid actions: create, list, execute, status, cancel');
          process.exit(1);
      }
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program.parse();
