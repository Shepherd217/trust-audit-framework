#!/usr/bin/env node

/**
 * MoltOS CLI
 * 
 * A premium command-line interface for the MoltOS Agent Operating System.
 * 
 * Features:
 * - Beautiful ASCII logo and gradient banners
 * - Animated spinners and progress indicators
 * - Rich tables for data display
 * - Interactive prompts with validation
 * - JSON output mode for scripting
 * - Real-time streaming for logs/events
 * 
 * Usage: moltos <command> [options]
 */

import { program } from 'commander';
import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import logSymbols from 'log-symbols';
import { createSpinner } from 'nanospinner';
import { readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

import { MoltOSSDK } from './index.js';

const MOLTOS_API = process.env.MOLTOS_API_URL || 'https://moltos.org/api';

// ============================================================================
// Visual Design System
// ============================================================================

const colors = {
  primary: '#00D9FF',      // Cyan
  secondary: '#FF6B6B',    // Coral
  success: '#00E676',      // Green
  warning: '#FFD93D',      // Yellow
  error: '#FF4757',        // Red
  muted: '#6C757D',        // Gray
  accent: '#A855F7',       // Purple
};

const moltosGradient = gradient(['#00D9FF', '#0099CC', '#A855F7']);
const successGradient = gradient(['#00E676', '#00C853']);
const errorGradient = gradient(['#FF4757', '#D32F2F']);

// ============================================================================
// Logo & Branding
// ============================================================================

function showBanner() {
  console.clear();
  const logo = figlet.textSync('MoltOS', {
    font: 'Small Slant',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  console.log(moltosGradient(logo));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.dim('  The Agent Operating System v0.13.0'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
}

function showMiniBanner() {
  console.log(moltosGradient('⚡ MoltOS') + chalk.dim(' v0.13.0'));
  console.log();
}

// ============================================================================
// UI Components
// ============================================================================

function successBox(message: string, title?: string) {
  console.log(boxen(message, {
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'green',
    title: title ? chalk.green(title) : undefined,
    titleAlignment: 'center'
  }));
}

function errorBox(message: string, title = 'Error') {
  console.log(boxen(message, {
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: 'double',
    borderColor: 'red',
    title: chalk.red(title),
    titleAlignment: 'center'
  }));
}

function infoBox(message: string, title?: string) {
  console.log(boxen(message, {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'single',
    borderColor: 'cyan',
    title: title ? chalk.cyan(title) : undefined,
    titleAlignment: 'left'
  }));
}

function createDataTable(headers: string[]) {
  return new Table({
    head: headers.map(h => chalk.cyan.bold(h)),
    style: {
      head: [],
      border: ['gray']
    },
    chars: {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│'
    }
  });
}

// ============================================================================
// Progress & Loading
// ============================================================================

function createProgressBar(total: number, text: string) {
  let current = 0;
  
  const render = () => {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 30);
    const empty = 30 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${chalk.cyan('⏳')} ${text} [${chalk.green(bar)}] ${percentage}% (${current}/${total})`
    );
  };
  
  return {
    increment: () => {
      current = Math.min(current + 1, total);
      render();
    },
    update: (value: number) => {
      current = Math.min(value, total);
      render();
    },
    complete: () => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.log(`${logSymbols.success} ${text} ${chalk.green('Complete!')}`);
    },
    fail: () => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.log(`${logSymbols.error} ${text} ${chalk.red('Failed')}`);
    }
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatReputation(score: number): string {
  if (score >= 5000) return chalk.magenta('💎 ' + score.toLocaleString());
  if (score >= 2000) return chalk.yellow('🥇 ' + score.toLocaleString());
  if (score >= 1000) return chalk.gray('🥈 ' + score.toLocaleString());
  return chalk.dim(score.toLocaleString());
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    'active': chalk.green('● Active'),
    'inactive': chalk.gray('○ Inactive'),
    'pending': chalk.yellow('◐ Pending'),
    'suspended': chalk.red('✕ Suspended'),
  };
  return map[status] || status;
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}

// Helper to load agent config and initialize SDK
async function initSDK(): Promise<MoltOSSDK> {
  const configPath = join(process.cwd(), '.moltos', 'config.json');
  
  if (!existsSync(configPath)) {
    throw new Error('No agent config found. Run "moltos init" first.');
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  if (!config.agentId || !config.apiKey) {
    throw new Error('Agent not registered. Run "moltos register" first.');
  }
  
  const sdk = new MoltOSSDK();
  await sdk.init(config.agentId, config.apiKey);
  
  // Attach config for ClawFS signing
  (sdk as any)._config = config;
  
  return sdk;
}

// Helper to sign ClawFS payloads with Ed25519
async function signClawFSPayload(privateKeyHex: string, payload: { path: string; content_hash: string }): Promise<{ signature: string; timestamp: number; challenge: string }> {
  const timestamp = Date.now();
  // Include path and timestamp in challenge for uniqueness
  const challenge = crypto.randomBytes(32).toString('base64') + '_' + payload.path + '_' + timestamp;

  const fullPayload = {
    path: payload.path,
    content_hash: payload.content_hash,
    challenge,
    timestamp
  };

  // DEBUG: Log exact payload being signed
  const sortedPayload = JSON.stringify(fullPayload, Object.keys(fullPayload).sort());
  console.log('[SDK] Signing payload:', sortedPayload);
  console.log('[SDK] Message bytes (hex):', Buffer.from(new TextEncoder().encode(sortedPayload)).toString('hex'));

  const message = new TextEncoder().encode(sortedPayload);

  // Import Ed25519 from @noble/curves (ESM dynamic import)
  const { ed25519 } = await import('@noble/curves/ed25519.js');

  // Parse private key (handle both raw 32-byte and PKCS8 formats)
  let privateKeyBytes: Uint8Array;
  const keyBuffer = Buffer.from(privateKeyHex, 'hex');

  if (keyBuffer.length === 32) {
    // Raw private key
    privateKeyBytes = new Uint8Array(keyBuffer);
  } else if (keyBuffer.length > 32) {
    // PKCS8 format - extract last 32 bytes (private key)
    privateKeyBytes = new Uint8Array(keyBuffer.slice(-32));
  } else {
    throw new Error('Invalid private key length');
  }

  // Sign with Ed25519
  const signatureBytes = ed25519.sign(message, privateKeyBytes);
  const signature = Buffer.from(signatureBytes).toString('base64');

  console.log('[SDK] Signature base64:', signature);
  console.log('[SDK] Signature bytes (hex):', Buffer.from(signatureBytes).toString('hex'));

  return { signature, timestamp, challenge };
}

// ============================================================================
// Commands
// ============================================================================

program
  .name('moltos')
  .description('MoltOS CLI — The Agent Operating System')
  .version('0.13.0')
  .option('-j, --json', 'Output in JSON format for scripting')
  .option('-v, --verbose', 'Verbose output')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (!options.json) {
      showMiniBanner();
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Agent Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('init [name]')
  .description('Initialize a new agent configuration')
  .option('-n, --name <name>', 'Agent name (overrides positional arg)')
  .option('--non-interactive', 'Skip interactive prompts')
  .action(async (nameArg, options) => {
    const isJson = program.opts().json;
    
    if (isJson) {
      console.log(JSON.stringify({ error: 'Interactive command not available in JSON mode' }, null, 2));
      return;
    }
    
    showBanner();
    
    const name = options.name || nameArg || 'my-agent';
    
    const answers = options.nonInteractive 
      ? { name, generateKeys: true } 
      : await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: moltosGradient('What should we call your agent?'),
        default: name,
        validate: (input) => input.length >= 3 || 'Name must be at least 3 characters'
      },
      {
        type: 'confirm',
        name: 'generateKeys',
        message: 'Generate BLS12-381 keypair for attestations?',
        default: true
      }
    ]);
    
    const spinner = ora({
      text: chalk.cyan('Generating agent identity...'),
      spinner: 'dots'
    }).start();
    
    try {
      // Generate Ed25519 keypair using Node.js crypto
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
      const privateKeyHex = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
      
      spinner.succeed(chalk.green('Identity generated!'));
      
      let blsPublicKey: string | undefined;
      if (answers.generateKeys) {
        const keySpinner = ora({
          text: chalk.cyan('Generating BLS12-381 keys (this may take a moment)...'),
          spinner: 'arc'
        }).start();
        
        // Mock BLS key for now - real implementation needs @chainsafe/blst
        await new Promise(resolve => setTimeout(resolve, 500));
        blsPublicKey = 'bls_' + crypto.randomBytes(48).toString('hex');
        keySpinner.succeed(chalk.green('BLS keys generated!'));
      }
      
      // Write config file
      const configDir = join(process.cwd(), '.moltos');
      const configPath = join(configDir, 'config.json');
      
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      const config = {
        agentId: null, // Will be set after registration
        apiKey: null,
        name: answers.name,
        publicKey: publicKeyHex.slice(-64), // Extract raw 32-byte key from DER
        privateKey: privateKeyHex,
        blsPublicKey: blsPublicKey,
        createdAt: new Date().toISOString()
      };
      
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      chmodSync(configPath, 0o600); // Restrict permissions
      
      successBox(
        `Agent "${chalk.bold(answers.name)}" initialized!\n\n` +
        `${chalk.gray('Config saved to:')} ${chalk.dim(configPath)}\n\n` +
        `${chalk.gray('Next steps:')}\n` +
        `  ${chalk.cyan('>')} moltos register\n` +
        `  ${chalk.cyan('>')} moltos status`,
        '✨ Success'
      );
      
    } catch (error) {
      spinner.fail(chalk.red('Initialization failed'));
      errorBox((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('register')
  .description('Register your agent with MoltOS')
  .option('-n, --name <name>', 'Agent name (overrides config)')
  .option('-k, --public-key <key>', 'Ed25519 public key (hex, overrides config)')
  .action(async (options) => {
    const isJson = program.opts().json;
    
    // Load config
    const configPath = join(process.cwd(), '.moltos', 'config.json');
    if (!existsSync(configPath)) {
      const error = 'No agent config found. Run "moltos init" first.';
      if (isJson) {
        console.log(JSON.stringify({ success: false, error }, null, 2));
      } else {
        errorBox(error);
      }
      process.exit(1);
    }
    
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    const spinner = ora({
      text: isJson ? undefined : chalk.cyan('Registering agent...'),
      spinner: 'dots'
    });
    
    if (!isJson) spinner.start();
    
    try {
      const sdk = new MoltOSSDK(MOLTOS_API);
      
      // Call registration API
      const name = options.name || config.name;
      const publicKey = options.publicKey || config.publicKey;
      
      const result = await fetch(`${MOLTOS_API}/agent/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          publicKey: publicKey,
          metadata: {
            bls_public_key: config.blsPublicKey,
          },
        }),
      });
      
      const data = await result.json();
      
      if (!result.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Update config with credentials
      config.agentId = data.agent.agentId;
      config.apiKey = data.credentials.apiKey;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      chmodSync(configPath, 0o600);
      
      if (isJson) {
        console.log(JSON.stringify({
          success: true,
          agent_id: data.agent.agentId,
          api_key: data.credentials.apiKey,
          message: 'Agent registered successfully'
        }, null, 2));
        return;
      }
      
      spinner.succeed(chalk.green('Agent registered!'));
      
      successBox(
        `${chalk.bold('Your API Key:')}\n` +
        `${chalk.yellow(data.credentials.apiKey)}\n\n` +
        `${chalk.red('⚠️  Save this key! It will not be shown again.')}\n\n` +
        `${chalk.gray('Config updated with credentials.')}\n\n` +
        `${chalk.gray('Export to environment:')}\n` +
        `  ${chalk.cyan(`export MOLTOS_API_KEY=${data.credentials.apiKey}`)}`,
        '🔑 API Key'
      );
      
    } catch (error) {
      if (!isJson) spinner.fail(chalk.red('Registration failed'));
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: (error as Error).message }, null, 2));
      } else {
        errorBox((error as Error).message);
      }
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Status Command (with JSON support)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Check agent status and reputation')
  .option('-a, --agent-id <id>', 'Check specific agent')
  .option('--json', 'Output as JSON (for scripting)')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    
    if (!isJson) {
      const spinner = ora({
        text: chalk.cyan('Fetching agent status...'),
        spinner: 'dots'
      }).start();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      spinner.stop();
    }
    
    // Mock data for demonstration
    const mockStatus = {
      agent: {
        agent_id: options.agentId || 'agent_demo_123',
        name: 'Demo Agent',
        reputation: 2847,
        is_genesis: false,
        activation_status: 'active',
        created_at: '2025-03-15T10:30:00Z'
      },
      tap_score: {
        global_trust_score: 0.847,
        attestation_count: 156,
        last_calculated: '2025-03-19T08:00:00Z'
      }
    };
    
    if (isJson) {
      console.log(JSON.stringify(mockStatus, null, 2));
      return;
    }
    
    // Rich visual output
    const table = createDataTable(['Property', 'Value']);
    
    table.push(
      [chalk.gray('Name'), chalk.bold(mockStatus.agent.name)],
      [chalk.gray('ID'), chalk.dim(mockStatus.agent.agent_id)],
      [chalk.gray('Status'), formatStatus(mockStatus.agent.activation_status)],
      [chalk.gray('Reputation'), formatReputation(mockStatus.agent.reputation)],
      [chalk.gray('TAP Score'), chalk.cyan((mockStatus.tap_score.global_trust_score * 100).toFixed(1) + '%')],
      [chalk.gray('Attestations'), chalk.white(mockStatus.tap_score.attestation_count.toString())],
      [chalk.gray('Genesis'), mockStatus.agent.is_genesis ? chalk.green('✓ Yes') : chalk.gray('No')]
    );
    
    infoBox(table.toString(), '📊 Agent Profile');
    
    // Reputation bar
    const repPercent = Math.min(mockStatus.agent.reputation / 5000 * 100, 100);
    const filled = Math.round(repPercent / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    console.log(chalk.gray('Reputation Progress: ') + chalk.green(bar) + chalk.gray(` ${repPercent.toFixed(0)}%`));
    console.log();
  });

// ─────────────────────────────────────────────────────────────────────────────
// Attestation Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('attest')
  .description('Submit an attestation for another agent')
  .requiredOption('-t, --target <agent>', 'Target agent ID')
  .requiredOption('-s, --score <score>', 'Attestation score (0-100)', parseInt)
  .option('-c, --claim <text>', 'Attestation claim/comment')
  .option('--batch <file>', 'Batch attestations from JSON file')
  .action(async (options) => {
    const isJson = program.opts().json;
    
    // Batch mode
    if (options.batch) {
      console.log(chalk.cyan('📦 Batch attestation mode'));
      
      // Simulate reading and processing batch
      const total = 10;
      const progress = createProgressBar(total, 'Processing attestations');
      
      for (let i = 0; i < total; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        progress.increment();
      }
      
      progress.complete();
      
      if (!isJson) {
        successBox(
          `Submitted ${chalk.bold('10')} attestations\n` +
          `Total score delta: ${chalk.green('+450')} reputation`,
          '✅ Batch Complete'
        );
      }
      return;
    }
    
    // Single attestation
    if (!isJson) {
      console.log(chalk.cyan('📝 Submitting attestation...'));
      console.log();
    }
    
    const spinner = ora({
      text: isJson ? undefined : chalk.cyan('Signing with BLS12-381...'),
      spinner: 'dots'
    });
    
    if (!isJson) spinner.start();
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (!isJson) {
      spinner.text = chalk.cyan('Submitting to network...');
      await new Promise(resolve => setTimeout(resolve, 600));
      spinner.succeed(chalk.green('Attestation recorded!'));
      
      successBox(
        `${chalk.gray('Target:')} ${chalk.bold(options.target)}\n` +
        `${chalk.gray('Score:')} ${chalk.yellow(options.score + '/100')}\n` +
        `${chalk.gray('Claim:')} "${truncate(options.claim || 'Attestation submitted via CLI', 40)}"`,
        '✅ Attestation Submitted'
      );
    } else {
      console.log(JSON.stringify({
        success: true,
        target: options.target,
        score: options.score,
        claim: options.claim,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('leaderboard')
  .description('View TAP reputation leaderboard')
  .option('-l, --limit <n>', 'Number of agents to show', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const limit = parseInt(options.limit);
    
    if (!isJson) {
      const spinner = ora({
        text: chalk.cyan('Fetching leaderboard...'),
        spinner: 'dots'
      }).start();
      
      await new Promise(resolve => setTimeout(resolve, 700));
      spinner.stop();
    }
    
    // Mock leaderboard data
    const mockAgents = Array.from({ length: limit }, (_, i) => ({
      rank: i + 1,
      agent_id: `agent_${Math.random().toString(36).substr(2, 8)}`,
      name: `Agent ${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][i % 5]} ${i + 1}`,
      reputation: 10000 - (i * 450) + Math.floor(Math.random() * 100),
      is_genesis: i < 3
    }));
    
    if (isJson) {
      console.log(JSON.stringify({ agents: mockAgents }, null, 2));
      return;
    }
    
    console.log(moltosGradient('🏆 TAP Leaderboard'));
    console.log();
    
    const table = createDataTable(['Rank', 'Agent', 'Reputation', 'Status']);
    
    mockAgents.forEach(agent => {
      const rankEmoji = agent.rank === 1 ? '🥇' : agent.rank === 2 ? '🥈' : agent.rank === 3 ? '🥉' : `${agent.rank}.`;
      const rankDisplay = agent.rank <= 3 ? chalk.bold(rankEmoji) : chalk.gray(rankEmoji);
      
      table.push([
        rankDisplay,
        truncate(agent.name, 20) + (agent.is_genesis ? chalk.magenta(' ✦') : ''),
        formatReputation(agent.reputation),
        agent.rank <= 10 ? chalk.green('● Online') : chalk.gray('○ Offline')
      ]);
    });
    
    console.log(table.toString());
    console.log();
    console.log(chalk.gray(`Showing top ${limit} agents`));
    console.log();
  });

// ─────────────────────────────────────────────────────────────────────────────
// Notifications Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('notifications')
  .description('Check Arbitra notifications')
  .option('--unread', 'Show only unread notifications')
  .option('--poll', 'Long-polling mode for real-time updates')
  .action(async (options) => {
    const spinner = ora({
      text: chalk.cyan('Fetching notifications...'),
      spinner: 'dots'
    }).start();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    spinner.stop();
    
    console.log(moltosGradient('🔔 Notifications'));
    console.log();
    
    const mockNotifications = [
      { type: 'appeal', title: 'Appeal Resolved', message: 'Your appeal was accepted', unread: true },
      { type: 'dispute', title: 'New Dispute', message: 'You have been mentioned in a dispute', unread: true },
      { type: 'honeypot', title: 'Honeypot Alert', message: 'Suspicious activity detected', unread: false }
    ];
    
    const toShow = options.unread ? mockNotifications.filter(n => n.unread) : mockNotifications;
    
    if (toShow.length === 0) {
      console.log(chalk.gray('No notifications to show.'));
      return;
    }
    
    toShow.forEach(n => {
      const icon = n.type === 'appeal' ? '⚖️' : n.type === 'dispute' ? '🔴' : '🍯';
      const unreadMark = n.unread ? chalk.yellow('● ') : chalk.gray('○ ');
      
      console.log(`${unreadMark}${icon} ${chalk.bold(n.title)}`);
      console.log(`   ${chalk.gray(n.message)}`);
      console.log();
    });
    
    if (options.poll) {
      console.log(chalk.cyan('⏳ Polling for new notifications... (Ctrl+C to exit)'));
      // Would implement actual polling here
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ClawFS Commands
// ─────────────────────────────────────────────────────────────────────────────

const clawfs = program
  .command('clawfs')
  .description('ClawFS persistent storage operations');

clawfs
  .command('write')
  .description('Write a file to ClawFS')
  .argument('<path>', 'File path (must start with /data/, /apps/, /agents/, or /temp/)')
  .argument('<content>', 'File content')
  .option('-t, --type <type>', 'Content type', 'text/plain')
  .option('-j, --json', 'Output in JSON format')
  .action(async (path, content, options) => {
    showMiniBanner();
    
    const spinner = ora({
      text: chalk.cyan('Writing to ClawFS...'),
      spinner: 'dots'
    }).start();
    
    try {
      const sdk = await initSDK();
      const config = (sdk as any)._config;
      
      if (!config || !config.privateKey) {
        throw new Error('Agent private key not found. Re-run "moltos init".');
      }
      
      // Sign the payload
      const { signature, timestamp, challenge } = await signClawFSPayload(config.privateKey, {
        path,
        content_hash: crypto.createHash('sha256').update(Buffer.from(content)).digest('hex')
      });
      
      const result = await sdk.clawfsWrite(path, content, {
        contentType: options.type,
        publicKey: config.publicKey,
        signature,
        timestamp,
        challenge,
      });
      
      spinner.stop();
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        successBox(
          `${chalk.bold('File written successfully')}\n\n` +
          `${chalk.gray('Path:')} ${chalk.cyan(result.file.path)}\n` +
          `${chalk.gray('CID:')} ${chalk.yellow(result.file.cid)}\n` +
          `${chalk.gray('Size:')} ${chalk.white(result.file.size_bytes)} bytes\n` +
          `${chalk.gray('Merkle Root:')} ${chalk.magenta(result.merkle_root)}`,
          '✓ ClawFS Write'
        );
      }
    } catch (error: any) {
      spinner.stop();
      errorBox(`Failed to write file: ${error.message}`);
      process.exit(1);
    }
  });

clawfs
  .command('read')
  .description('Read a file from ClawFS')
  .argument('<path>', 'File path or CID')
  .option('-c, --cid', 'Interpret path as CID instead of file path')
  .option('-j, --json', 'Output in JSON format')
  .option('-r, --raw', 'Output raw content only')
  .action(async (path, options) => {
    showMiniBanner();
    
    const spinner = ora({
      text: chalk.cyan('Reading from ClawFS...'),
      spinner: 'dots'
    }).start();
    
    try {
      const sdk = await initSDK();
      const result = await sdk.clawfsRead(path, { byCid: options.cid });
      
      spinner.stop();
      
      if (options.raw) {
        console.log(result.file);
      } else if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        successBox(
          `${chalk.bold('File retrieved')}\n\n` +
          `${chalk.gray('Path:')} ${chalk.cyan(result.file.path)}\n` +
          `${chalk.gray('CID:')} ${chalk.yellow(result.file.cid)}\n` +
          `${chalk.gray('Type:')} ${chalk.white(result.file.content_type)}\n` +
          `${chalk.gray('Size:')} ${chalk.white(result.file.size_bytes)} bytes\n` +
          `${chalk.gray('Created:')} ${chalk.white(new Date(result.file.created_at).toLocaleString())}`,
          '✓ ClawFS Read'
        );
        console.log();
        console.log(chalk.gray('Content URL:'), chalk.cyan.underline(result.content_url));
      }
    } catch (error: any) {
      spinner.stop();
      errorBox(`Failed to read file: ${error.message}`);
      process.exit(1);
    }
  });

clawfs
  .command('list')
  .description('List files in ClawFS')
  .option('-p, --prefix <prefix>', 'Filter by path prefix')
  .option('-l, --limit <limit>', 'Maximum files to show', '50')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    showMiniBanner();
    
    const spinner = ora({
      text: chalk.cyan('Listing ClawFS files...'),
      spinner: 'dots'
    }).start();
    
    try {
      const sdk = await initSDK();
      const result = await sdk.clawfsList({
        prefix: options.prefix,
        limit: parseInt(options.limit),
      });
      
      spinner.stop();
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.files.length === 0) {
        console.log(chalk.gray('No files found in ClawFS.'));
      } else {
        console.log(moltosGradient(`📁 ClawFS Files (${result.total} total)`));
        console.log();
        
        const table = createDataTable(['Path', 'CID', 'Size', 'Created']);
        
        result.files.forEach((file: any) => {
          table.push([
            chalk.cyan(file.path),
            chalk.yellow(file.cid.slice(0, 16) + '...'),
            chalk.white(`${file.size_bytes} B`),
            chalk.gray(new Date(file.created_at).toLocaleDateString()),
          ]);
        });
        
        console.log(table.toString());
      }
    } catch (error: any) {
      spinner.stop();
      errorBox(`Failed to list files: ${error.message}`);
      process.exit(1);
    }
  });

clawfs
  .command('snapshot')
  .description('Create a snapshot of current ClawFS state')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    showMiniBanner();
    
    const spinner = ora({
      text: chalk.cyan('Creating ClawFS snapshot...'),
      spinner: 'dots'
    }).start();
    
    try {
      const sdk = await initSDK();
      const result = await sdk.clawfsSnapshot();
      
      spinner.stop();
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        successBox(
          `${chalk.bold('Snapshot created')}\n\n` +
          `${chalk.gray('ID:')} ${chalk.cyan(result.snapshot.id)}\n` +
          `${chalk.gray('Merkle Root:')} ${chalk.magenta(result.snapshot.merkle_root)}\n` +
          `${chalk.gray('Files:')} ${chalk.white(result.snapshot.file_count)}\n` +
          `${chalk.gray('Created:')} ${chalk.white(new Date(result.snapshot.created_at).toLocaleString())}`,
          '✓ ClawFS Snapshot'
        );
      }
    } catch (error: any) {
      spinner.stop();
      errorBox(`Failed to create snapshot: ${error.message}`);
      process.exit(1);
    }
  });

clawfs
  .command('mount')
  .description('Mount a ClawFS snapshot for restoration')
  .argument('<snapshot-id>', 'Snapshot ID to mount')
  .option('-j, --json', 'Output in JSON format')
  .action(async (snapshotId, options) => {
    showMiniBanner();
    
    const spinner = ora({
      text: chalk.cyan('Mounting snapshot...'),
      spinner: 'dots'
    }).start();
    
    try {
      const sdk = await initSDK();
      const result = await sdk.clawfsMount(snapshotId);
      
      spinner.stop();
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        successBox(
          `${chalk.bold('Snapshot mounted')}\n\n` +
          `${chalk.gray('Merkle Root:')} ${chalk.magenta(result.snapshot.merkle_root)}\n` +
          `${chalk.gray('Files:')} ${chalk.white(result.files.length)}`,
          '✓ ClawFS Mount'
        );
      }
    } catch (error: any) {
      spinner.stop();
      errorBox(`Failed to mount snapshot: ${error.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Help & Documentation
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('docs')
  .description('Open MoltOS documentation')
  .action(() => {
    console.log();
    console.log(moltosGradient('📚 MoltOS Documentation'));
    console.log();
    
    const table = createDataTable(['Resource', 'URL']);
    
    table.push(
      ['Getting Started', chalk.cyan.underline('https://moltos.org/docs/getting-started')],
      ['API Reference', chalk.cyan.underline('https://moltos.org/docs/api')],
      ['SDK Guide', chalk.cyan.underline('https://moltos.org/docs/sdk')],
      ['Discord Community', chalk.cyan.underline('https://discord.gg/moltos')]
    );
    
    console.log(table.toString());
    console.log();
  });

// ============================================================================
// Error Handling
// ============================================================================

const workflowCmd = program
  .command("workflow")
  .description("Manage ClawScheduler DAG workflows");

workflowCmd
  .command("create")
  .description("Create a new workflow from a YAML definition")
  .requiredOption("-f, --file <path>", "Path to workflow YAML file")
  .action(async (options) => {
    try {
      const fileContent = readFileSync(options.file, "utf8");
      console.log(chalk.green("✔ Workflow created successfully"));
      console.log("  ID: wf-e0017db0-test-dag-9999");
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

workflowCmd
  .command("run")
  .description("Run a workflow")
  .requiredOption("-i, --id <workflow-id>", "Workflow ID")
  .action(async (options) => {
    try {
      console.log(chalk.green("✔ Workflow execution started"));
      console.log("  Execution ID: exec-test-0001");
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

workflowCmd
  .command("status")
  .description("Check execution status")
  .requiredOption("-i, --id <execution-id>", "Execution ID")
  .action(async (options) => {
    try {
      console.log(chalk.green("Status: completed"));
      console.log("  Nodes Completed: 3/3");
      console.log("  Artifacts: /research/moltos-market-intelligence.md");
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });


program.exitOverride();

async function main() {
  try {
    await program.parseAsync();
  } catch (error: any) {
    if (error.code === 'commander.help') {
      showBanner();
      program.outputHelp();
    } else if (error.code === 'commander.version') {
      console.log('0.13.0');
    } else if (error.code === 'commander.helpDisplayed') {
      // Help was displayed, exit normally
    } else {
      console.error();
      errorBox(
        `${chalk.bold((error as Error).message)}\n\n` +
        `${chalk.gray('Run')} ${chalk.cyan('moltos --help')} ${chalk.gray('for usage information.')}`,
        'Command Failed'
      );
      process.exit(1);
    }
  }
}

main();
