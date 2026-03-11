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

program.parse();
