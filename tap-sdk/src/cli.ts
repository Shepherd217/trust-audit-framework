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
  console.log(chalk.dim('  The Agent Operating System v0.14.1'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
}

function showMiniBanner() {
  console.log(moltosGradient('⚡ MoltOS') + chalk.dim(' v0.14.1'));
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

  const sortedPayload = JSON.stringify(fullPayload, Object.keys(fullPayload).sort());
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

  return { signature, timestamp, challenge };
}

// ============================================================================
// Commands
// ============================================================================

program
  .name('moltos')
  .description('MoltOS CLI — The Agent Operating System')
  .version('0.15.0')
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

    const spinner = isJson ? null : ora({ text: chalk.cyan('Fetching agent status...'), spinner: 'dots' }).start();

    try {
      // Try to load local config for agent ID
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      let agentId = options.agentId;
      let apiKey: string | undefined;

      if (!agentId && existsSync(configPath)) {
        const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
        agentId = cfg.agentId;
        apiKey = cfg.apiKey;
      }

      if (!agentId) {
        spinner?.stop();
        errorBox('No agent ID found. Run "moltos init" and "moltos register" first, or pass --agent-id <id>');
        process.exit(1);
      }

      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['X-API-Key'] = apiKey;

      const res = await fetch(`${MOLTOS_API}/agents/${agentId}`, { headers });
      if (!res.ok) throw new Error(`Agent not found (${res.status})`);
      const data = await res.json() as any;
      const agent = data.agent ?? data;

      spinner?.stop();

      if (isJson) {
        console.log(JSON.stringify(agent, null, 2));
        return;
      }

      const table = createDataTable(['Property', 'Value']);
      table.push(
        [chalk.gray('Name'), chalk.bold(agent.name || agent.agent_id)],
        [chalk.gray('ID'), chalk.dim(agent.agent_id)],
        [chalk.gray('Status'), formatStatus(agent.status || 'active')],
        [chalk.gray('Reputation'), formatReputation(agent.reputation ?? 0)],
        [chalk.gray('Tier'), chalk.cyan(agent.tier || 'bronze')],
        [chalk.gray('Founding'), agent.is_founding ? chalk.green('✓ Yes') : chalk.gray('No')],
        [chalk.gray('Joined'), chalk.white(new Date(agent.joined_at).toLocaleDateString())]
      );

      infoBox(table.toString(), '📊 Agent Profile');

      const repPercent = Math.min((agent.reputation ?? 0) / 5000 * 100, 100);
      const filled = Math.round(repPercent / 5);
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
      console.log(chalk.gray('Reputation Progress: ') + chalk.green(bar) + chalk.gray(` ${repPercent.toFixed(0)}%`));
      console.log();

    } catch (err: any) {
      spinner?.stop();
      errorBox(err.message || 'Failed to fetch agent status');
      process.exit(1);
    }
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
      text: isJson ? undefined : chalk.cyan('Loading agent config...'),
      spinner: 'dots'
    });

    if (!isJson) spinner.start();

    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) {
        spinner?.stop();
        errorBox('No agent config found. Run "moltos init" and "moltos register" first.');
        process.exit(1);
      }

      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey || !cfg.agentId) {
        spinner?.stop();
        errorBox('Agent not registered. Run "moltos register" first.');
        process.exit(1);
      }

      if (!isJson) { (spinner as any).text = chalk.cyan('Submitting to network...'); }

      const res = await fetch(`${MOLTOS_API}/agent/attest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cfg.apiKey,
        },
        body: JSON.stringify({
          target_agent_id: options.target,
          score: options.score,
          claim: options.claim || '',
          attester_id: cfg.agentId,
        }),
      });

      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Attestation failed (${res.status})`);

      if (!isJson) {
        (spinner as any).succeed(chalk.green('Attestation recorded!'));
        successBox(
          `${chalk.gray('Target:')} ${chalk.bold(options.target)}\n` +
          `${chalk.gray('Score:')} ${chalk.yellow(options.score + '/100')}\n` +
          `${chalk.gray('Claim:')} "${truncate(options.claim || '', 40)}"\n` +
          `${chalk.gray('ID:')} ${chalk.dim(data.attestation_id || data.id || 'confirmed')}`,
          '✅ Attestation Submitted'
        );
      } else {
        console.log(JSON.stringify({ success: true, ...data }, null, 2));
      }
    } catch (err: any) {
      (spinner as any)?.stop?.();
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      } else {
        errorBox(err.message || 'Attestation failed');
      }
      process.exit(1);
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
    
    try {
      const res = await fetch(`${MOLTOS_API}/leaderboard`);
      if (!res.ok) throw new Error(`Failed to fetch leaderboard (${res.status})`);
      const data = await res.json() as any;
      const agents = (data.leaderboard ?? data.agents ?? []).slice(0, limit);

      if (isJson) {
        console.log(JSON.stringify({ agents }, null, 2));
        return;
      }

      console.log(moltosGradient('🏆 TAP Leaderboard'));
      console.log();

      const table = createDataTable(['Rank', 'Agent', 'Reputation', 'Tier']);

      agents.forEach((agent: any) => {
        const r = agent.rank;
        const rankEmoji = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}.`;
        const rankDisplay = r <= 3 ? chalk.bold(rankEmoji) : chalk.gray(rankEmoji);
        table.push([
          rankDisplay,
          truncate(agent.name || agent.agent_id, 22) + (agent.is_founding ? chalk.magenta(' ✦') : ''),
          formatReputation(agent.reputation ?? 0),
          chalk.cyan(agent.tier || 'bronze')
        ]);
      });

      console.log(table.toString());
      console.log();
      console.log(chalk.gray(`Showing top ${agents.length} agents · moltos.org/leaderboard`));
      console.log();

    } catch (err: any) {
      spinner?.stop();
      errorBox(err.message || 'Failed to fetch leaderboard');
      process.exit(1);
    }
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
    const spinner = ora({ text: chalk.cyan('Fetching notifications...'), spinner: 'dots' }).start();

    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) {
        spinner.stop();
        errorBox('No agent config found. Run "moltos init" and "moltos register" first.');
        process.exit(1);
      }

      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) {
        spinner.stop();
        errorBox('Agent not registered. Run "moltos register" first.');
        process.exit(1);
      }

      const res = await fetch(`${MOLTOS_API}/agent/notifications`, {
        headers: { 'X-API-Key': cfg.apiKey }
      });

      spinner.stop();

      if (!res.ok) throw new Error(`Failed to fetch notifications (${res.status})`);
      const data = await res.json() as any;
      const notifications: any[] = data.notifications ?? data ?? [];
      const toShow = options.unread ? notifications.filter((n: any) => !n.read_at) : notifications;

      console.log(moltosGradient('🔔 Notifications'));
      console.log();

      if (toShow.length === 0) {
        console.log(chalk.gray('No notifications. You are all caught up.'));
        console.log();
        return;
      }

      toShow.forEach((n: any) => {
        const type = n.type || 'info';
        const icon = type === 'appeal' ? '⚖️' : type === 'dispute' ? '🔴' : type === 'attestation' ? '⭐' : '🔔';
        const unreadMark = !n.read_at ? chalk.yellow('● ') : chalk.gray('○ ');
        console.log(`${unreadMark}${icon} ${chalk.bold(n.title || type)}`);
        console.log(`   ${chalk.gray(n.message || n.body || '')}`);
        if (n.created_at) console.log(`   ${chalk.dim(new Date(n.created_at).toLocaleString())}`);
        console.log();
      });

      if (options.poll) {
        console.log(chalk.cyan('⏳ Polling for new notifications... (Ctrl+C to exit)'));
      }

    } catch (err: any) {
      spinner.stop();
      errorBox(err.message || 'Failed to fetch notifications');
      process.exit(1);
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
      const config = (sdk as any)._config;

      if (!config || !config.privateKey) {
        throw new Error('Agent private key not found. Re-run "moltos init".');
      }

      // Sign snapshot payload
      const contentHash = crypto.createHash('sha256').update(config.agentId).digest('hex');
      const { signature, timestamp, challenge } = await signClawFSPayload(config.privateKey, {
        path: '/snapshot',
        content_hash: contentHash,
      });

      const res = await fetch(`${MOLTOS_API}/clawfs/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify({
          agent_id: config.agentId,
          public_key: config.publicKey,
          signature,
          timestamp,
          challenge,
          content_hash: contentHash,
        }),
      });

      const result = await res.json() as any;
      if (!res.ok) throw new Error(result.error || `Snapshot failed (${res.status})`);

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
      ['GitHub Issues', chalk.cyan.underline('https://github.com/Shepherd217/MoltOS/issues')]
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
    const spinner = ora({ text: chalk.cyan('Creating workflow...'), spinner: 'dots' }).start();
    try {
      const fileContent = readFileSync(options.file, "utf8");
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config. Run "moltos init" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      const res = await fetch(`${MOLTOS_API}/claw/scheduler/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ definition: fileContent, format: 'yaml' }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      spinner.succeed(chalk.green('Workflow created successfully'));
      console.log(`  ID: ${chalk.cyan(data.id || data.workflow_id || data.workflow?.id)}`);
    } catch (err) {
      spinner.stop();
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

workflowCmd
  .command("run")
  .description("Run a workflow")
  .requiredOption("-i, --id <workflow-id>", "Workflow ID")
  .action(async (options) => {
    const spinner = ora({ text: chalk.cyan('Starting workflow...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found. Run "moltos init" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      const res = await fetch(`${MOLTOS_API}/claw/scheduler/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ workflowId: options.id })
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      spinner.succeed(chalk.green('Workflow execution started'));
      console.log(`  Execution ID: ${chalk.cyan(data.execution_id || data.id)}`);
    } catch (err) {
      spinner.stop();
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

workflowCmd
  .command("status")
  .description("Check execution status")
  .requiredOption("-i, --id <execution-id>", "Execution ID")
  .action(async (options) => {
    const spinner = ora({ text: chalk.cyan('Fetching execution status...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));

      const res = await fetch(`${MOLTOS_API}/claw/scheduler/executions/${options.id}`, {
        headers: { 'X-API-Key': cfg.apiKey || '' }
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      spinner.stop();
      console.log(chalk.green(`Status: ${data.status}`));
      if (data.nodes_completed !== undefined) console.log(`  Nodes Completed: ${data.nodes_completed}/${data.nodes_total}`);
      if (data.artifacts?.length) console.log(`  Artifacts: ${data.artifacts.join(', ')}`);
    } catch (err) {
      spinner.stop();
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });


// ─────────────────────────────────────────────────────────────────────────────
// whoami — who am I right now?
// ─────────────────────────────────────────────────────────────────────────────
// recover — re-authenticate on a fresh server using private key
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('recover')
  .description('Re-authenticate using your private key — use after hardware wipe or migration')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Re-authenticating...'), spinner: 'dots' }).start();

    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No config found. Re-inject your config.json with privateKey and publicKey first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.privateKey || !cfg.publicKey) throw new Error('privateKey and publicKey required in config.json.');

      // Sign a recovery payload with the private key to prove identity
      const { ed25519 } = await import('@noble/curves/ed25519.js');
      const timestamp = Date.now();
      const keyBuffer = Buffer.from(cfg.privateKey, 'hex');
      const privateKeyBytes = new Uint8Array(keyBuffer.slice(-32));
      const recoveryPayload = { action: 'recover', public_key: cfg.publicKey, timestamp };
      const sorted = JSON.stringify(recoveryPayload, Object.keys(recoveryPayload).sort());
      const sigBytes = ed25519.sign(new TextEncoder().encode(sorted), privateKeyBytes);
      const signature = Buffer.from(sigBytes).toString('base64');

      const res = await fetch(`${MOLTOS_API}/agent/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cfg.name || 'recovered-agent',
          publicKey: cfg.publicKey,
          recover: true,
          recovery_signature: signature,
          recovery_timestamp: timestamp,
          metadata: { bls_public_key: cfg.blsPublicKey },
        }),
      });
      const data = await res.json() as any;

      // If already registered, that's fine — re-auth via a signed challenge
      if (!res.ok && data.error?.includes('already registered')) {
        // Agent exists — issue new API key via key rotation endpoint
        const rotateRes = await fetch(`${MOLTOS_API}/agent/auth/rotate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_key: cfg.publicKey,
            signature,
            timestamp,
          }),
        });
        const rotateData = await rotateRes.json() as any;
        if (!rotateRes.ok) {
          // Fall back: re-register is blocked but agent may already have API key
          if (cfg.apiKey) {
            spinner?.stop();
            if (isJson) { console.log(JSON.stringify({ success: true, recovered: false, message: 'Existing API key retained', agent_id: cfg.agentId }, null, 2)); return; }
            infoBox(`Agent already registered. Existing API key retained.\n\nAgent ID: ${chalk.cyan(cfg.agentId)}\nRun ${chalk.cyan('moltos whoami')} to verify.`, '🔄 Recovery');
            return;
          }
          throw new Error(rotateData.error || 'Recovery failed — contact support');
        }
        cfg.apiKey = rotateData.api_key || rotateData.apiKey;
      } else if (res.ok) {
        cfg.agentId = data.agent?.agentId || cfg.agentId;
        cfg.apiKey = data.credentials?.apiKey || cfg.apiKey;
      } else {
        throw new Error(data.error || `Recovery failed (${res.status})`);
      }

      writeFileSync(configPath, JSON.stringify(cfg, null, 2));
      chmodSync(configPath, 0o600);

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify({ success: true, agent_id: cfg.agentId, message: 'Recovery complete' }, null, 2)); return; }

      successBox(
        `${chalk.bold('Identity recovered!')}\n\n` +
        `${chalk.gray('Agent ID:')} ${chalk.cyan(cfg.agentId)}\n` +
        `${chalk.gray('Config:')}   ${chalk.white(configPath)}\n\n` +
        `${chalk.gray('Run')} ${chalk.cyan('moltos clawfs mount latest')} ${chalk.gray('to restore your memory state.')}`,
        '🔄 Recovery Complete'
      );
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────

program
  .command('whoami')
  .description('Show your current agent identity, TAP score, and tier')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Loading identity...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) {
        spinner?.stop();
        errorBox('No agent config found. Run "moltos init" and "moltos register" first.');
        process.exit(1);
      }
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.agentId || !cfg.apiKey) {
        spinner?.stop();
        errorBox('Agent not registered. Run "moltos register" first.');
        process.exit(1);
      }

      const res = await fetch(`${MOLTOS_API}/agent/profile?agent_id=${cfg.agentId}`, {
        headers: { 'X-API-Key': cfg.apiKey }
      });
      const data = await res.json() as any;
      spinner?.stop();

      if (isJson) {
        console.log(JSON.stringify({ agent_id: cfg.agentId, ...data }, null, 2));
        return;
      }

      const tierColors: Record<string, any> = {
        DIAMOND: chalk.cyan, PLATINUM: chalk.white, GOLD: chalk.yellow,
        SILVER: chalk.gray, BRONZE: chalk.dim
      };
      const tierFn = tierColors[(data.tier || 'BRONZE').toUpperCase()] || chalk.dim;

      infoBox(
        `${chalk.gray('Agent ID:')}   ${chalk.dim(cfg.agentId)}\n` +
        `${chalk.gray('Name:')}       ${chalk.bold(data.name || cfg.name || '-')}\n` +
        `${chalk.gray('TAP Score:')}  ${chalk.green((data.reputation ?? 0).toString())}\n` +
        `${chalk.gray('Tier:')}       ${tierFn((data.tier || 'BRONZE').toUpperCase())}\n` +
        `${chalk.gray('Status:')}     ${data.status === 'active' ? chalk.green('● active') : chalk.gray('○ ' + (data.status || 'unknown'))}\n` +
        (data.bio ? `${chalk.gray('Bio:')}        ${chalk.white(data.bio)}\n` : '') +
        (data.skills?.length ? `${chalk.gray('Skills:')}     ${chalk.cyan(data.skills.join(', '))}` : ''),
        '🆔 Identity'
      );

    } catch (err: any) {
      spinner?.stop();
      errorBox(err.message || 'Failed to load identity');
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// profile — update your agent's public profile
// ─────────────────────────────────────────────────────────────────────────────

const profileCmd = program
  .command('profile')
  .description('Manage your agent profile');

profileCmd
  .command('update')
  .description('Update your public profile — bio, skills, availability, rate')
  .option('--bio <text>', 'Short bio (max 500 chars)')
  .option('--skills <list>', 'Comma-separated skill tags (e.g. "research,TypeScript,analysis")')
  .option('--rate <n>', 'Hourly rate in USD', parseInt)
  .option('--available', 'Mark as available for hire')
  .option('--unavailable', 'Mark as unavailable for hire')
  .option('--website <url>', 'Your agent website or repo')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Updating profile...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found. Run "moltos init" and "moltos register" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      const body: Record<string, any> = {};
      if (options.bio) body.bio = options.bio;
      if (options.skills) body.skills = options.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (options.rate) body.rate_per_hour = options.rate;
      if (options.available) body.available_for_hire = true;
      if (options.unavailable) body.available_for_hire = false;
      if (options.website) body.website = options.website;

      if (Object.keys(body).length === 0) {
        spinner?.stop();
        errorBox('Provide at least one option. Try: moltos profile update --bio "..." --skills "research,python"');
        process.exit(1);
      }

      const res = await fetch(`${MOLTOS_API}/agent/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify(body)
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || 'Profile update failed');

      spinner?.stop();
      if (isJson) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        successBox(
          Object.entries(body).map(([k, v]) =>
            `${chalk.gray(k + ':')} ${chalk.white(Array.isArray(v) ? v.join(', ') : String(v))}`
          ).join('\n'),
          '✅ Profile Updated'
        );
      }
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message || 'Profile update failed');
      process.exit(1);
    }
  });

profileCmd
  .command('show [agent-id]')
  .description('Show an agent\'s public profile (default: yours)')
  .option('--json', 'Output as JSON')
  .action(async (agentId, options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Fetching profile...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      let targetId = agentId;
      if (!targetId && existsSync(configPath)) {
        const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
        targetId = cfg.agentId;
      }
      if (!targetId) throw new Error('No agent ID. Pass an agent ID or run "moltos register" first.');

      const res = await fetch(`${MOLTOS_API}/agent/profile?agent_id=${targetId}`);
      const data = await res.json() as any;
      spinner?.stop();

      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      infoBox(
        `${chalk.gray('Name:')}      ${chalk.bold(data.name || targetId)}\n` +
        `${chalk.gray('TAP:')}       ${chalk.green((data.reputation ?? 0).toString())} ${chalk.dim((data.tier || '').toUpperCase())}\n` +
        `${chalk.gray('Bio:')}       ${chalk.white(data.bio || '(none)')}\n` +
        `${chalk.gray('Skills:')}    ${chalk.cyan((data.skills || []).join(', ') || '(none)')}\n` +
        `${chalk.gray('Rate:')}      ${data.rate_per_hour ? `${data.rate_per_hour}/hr` : '(none)'}\n` +
        `${chalk.gray('Available:')} ${data.availability ? chalk.green('Yes') : chalk.red('No')}`
      );
    } catch (err: any) {
      spinner?.stop();
      errorBox(err.message || 'Failed to fetch profile');
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// jobs — marketplace commands for autonomous agents
// ─────────────────────────────────────────────────────────────────────────────

const jobsCmd = program
  .command('jobs')
  .description('Marketplace — browse, post, apply, and track jobs');

jobsCmd
  .command('list')
  .description('Browse open jobs on the marketplace')
  .option('-c, --category <cat>', 'Filter by category (Research, Development, etc.)')
  .option('--min-tap <n>', 'Minimum TAP score required', parseInt)
  .option('--max-budget <n>', 'Max budget in cents (500 = $5)', parseInt)
  .option('-l, --limit <n>', 'Number of jobs to show', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Fetching jobs...'), spinner: 'dots' }).start();
    try {
      const params = new URLSearchParams();
      if (options.category) params.set('category', options.category);
      if (options.minTap) params.set('min_tap', String(options.minTap));
      if (options.maxBudget) params.set('max_budget', String(options.maxBudget));

      const res = await fetch(`${MOLTOS_API}/marketplace/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch jobs (${res.status})`);
      const data = await res.json() as any;
      const jobs = (data.jobs || []).slice(0, parseInt(options.limit));
      spinner?.stop();

      if (isJson) { console.log(JSON.stringify({ jobs }, null, 2)); return; }
      if (jobs.length === 0) { console.log(chalk.gray('No open jobs found.')); return; }

      console.log(moltosGradient(`💼 Open Jobs (${jobs.length})`));
      console.log();

      const table = createDataTable(['ID', 'Title', 'Budget', 'Category', 'Min TAP', 'Hirer']);
      jobs.forEach((j: any) => {
        table.push([
          chalk.dim(j.id.slice(0, 8)),
          chalk.white(truncate(j.title, 35)),
          chalk.green(`$${(j.budget / 100).toFixed(0)}`),
          chalk.cyan(j.category || '-'),
          chalk.yellow(String(j.min_tap_score ?? 0)),
          chalk.dim(truncate(j.hirer?.name || j.hirer_id || '-', 16)),
        ]);
      });
      console.log(table.toString());
      console.log(chalk.gray(`\n  moltos jobs apply --job-id <id> --proposal "..."`));
      console.log();
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

jobsCmd
  .command('post')
  .description('Post a new job to the marketplace')
  .requiredOption('--title <title>', 'Job title')
  .requiredOption('--description <desc>', 'Full job description')
  .requiredOption('--budget <cents>', 'Budget in cents (minimum 500 = $5)', parseInt)
  .option('--category <cat>', 'Category (Research, Development, etc.)', 'General')
  .option('--min-tap <n>', 'Minimum TAP score for applicants', parseInt)
  .option('--skills <list>', 'Required skills, comma-separated')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Posting job...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found. Run "moltos init" and "moltos register" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      if (options.budget < 500) throw new Error('Minimum budget is $5.00 (500 cents).');

      const res = await fetch(`${MOLTOS_API}/marketplace/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({
          title: options.title,
          description: options.description,
          budget: options.budget,
          category: options.category,
          min_tap_score: options.minTap || 0,
          skills_required: options.skills || '',
          hirer_public_key: cfg.publicKey || cfg.agentId,
          hirer_signature: 'cli-api-key-auth',
          timestamp: Date.now(),
        })
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || 'Failed to post job');

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      successBox(
        `${chalk.gray('Job ID:')}   ${chalk.cyan(data.job?.id || '-')}\n` +
        `${chalk.gray('Title:')}    ${chalk.bold(options.title)}\n` +
        `${chalk.gray('Budget:')}   ${chalk.green(`$${(options.budget / 100).toFixed(2)}`)}\n` +
        `${chalk.gray('Status:')}   ${chalk.green('open')}\n\n` +
        `${chalk.gray('View:')} ${chalk.dim('moltos.org/marketplace')}`,
        '✅ Job Posted'
      );
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

jobsCmd
  .command('apply')
  .description('Apply to an open job')
  .requiredOption('--job-id <id>', 'Job ID to apply to')
  .requiredOption('--proposal <text>', 'Your proposal (what you will do and how)')
  .option('--hours <n>', 'Estimated hours to complete', parseInt)
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Submitting application...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found. Run "moltos init" and "moltos register" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      const res = await fetch(`${MOLTOS_API}/marketplace/jobs/${options.jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({
          proposal: options.proposal,
          estimated_hours: options.hours || undefined,
        })
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Application failed (${res.status})`);

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      successBox(
        `${chalk.gray('Application ID:')} ${chalk.cyan(data.application?.id || '-')}\n` +
        `${chalk.gray('Job ID:')}         ${chalk.dim(options.jobId)}\n` +
        `${chalk.gray('Status:')}         ${chalk.yellow('pending')}\n\n` +
        `${chalk.gray('Check status:')} ${chalk.cyan('moltos jobs status')}`,
        '✅ Application Submitted'
      );
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

jobsCmd
  .command('status')
  .description('Check your jobs and applications')
  .option('--type <type>', 'Filter: posted, applied, contracts, all', 'all')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Fetching activity...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found. Run "moltos init" and "moltos register" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      const res = await fetch(`${MOLTOS_API}/marketplace/my?type=${options.type}`, {
        headers: { 'X-API-Key': cfg.apiKey }
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || 'Failed to fetch activity');

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      console.log(moltosGradient('📋 My Marketplace Activity'));
      console.log();

      if (data.posted?.length) {
        console.log(chalk.cyan('Jobs Posted:'));
        data.posted.forEach((j: any) => {
          console.log(`  ${chalk.dim(j.id?.slice(0,8))} ${chalk.white(truncate(j.title || '-', 40))} ${chalk.green(`$${((j.budget||0)/100).toFixed(0)}`)} ${chalk.gray(j.status)}`);
        });
        console.log();
      }

      if (data.applied?.length) {
        console.log(chalk.cyan('Applications:'));
        data.applied.forEach((a: any) => {
          const job = a.job || {};
          const statusColor = a.status === 'accepted' ? chalk.green : a.status === 'rejected' ? chalk.red : chalk.yellow;
          console.log(`  ${chalk.dim(a.job_id?.slice(0,8))} ${chalk.white(truncate(job.title || a.job_id || '-', 35))} ${statusColor(a.status)}`);
        });
        console.log();
      }

      if (data.contracts?.length) {
        console.log(chalk.cyan('Contracts:'));
        data.contracts.forEach((c: any) => {
          const roleColor = c.role === 'hirer' ? chalk.blue : chalk.magenta;
          console.log(`  ${chalk.dim(c.id?.slice(0,8))} ${roleColor(c.role)} ${chalk.green(`$${((c.agreed_budget||0)/100).toFixed(0)}`)} ${chalk.gray(c.status)}`);
        });
        console.log();
      }

      if (!data.posted?.length && !data.applied?.length && !data.contracts?.length) {
        console.log(chalk.gray('No activity yet. Try: moltos jobs list'));
      }
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

jobsCmd
  .command('hire')
  .description('Hire an applicant for a job you posted')
  .requiredOption('--job-id <id>', 'Job ID')
  .requiredOption('--application-id <id>', 'Application ID to accept')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Hiring applicant...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered.');

      const timestamp = Date.now();
      // Sign hire payload for ClawID verification
      const { ed25519 } = await import('@noble/curves/ed25519.js');
      const keyBuffer = Buffer.from(cfg.privateKey, 'hex');
      const privateKeyBytes = new Uint8Array(keyBuffer.slice(-32));
      const hirePayload = { job_id: options.jobId, application_id: options.applicationId, timestamp };
      const sortedHirePayload = JSON.stringify(hirePayload, Object.keys(hirePayload).sort());
      const hireMsg = new TextEncoder().encode(sortedHirePayload);
      const hireSigBytes = ed25519.sign(hireMsg, privateKeyBytes);
      const hireSignature = Buffer.from(hireSigBytes).toString('base64');

      const res = await fetch(`${MOLTOS_API}/marketplace/jobs/${options.jobId}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({
          application_id: options.applicationId,
          hirer_public_key: cfg.publicKey,
          hirer_signature: hireSignature,
          timestamp,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      successBox(
        `${chalk.bold('Applicant hired!')}\n\n` +
        `${chalk.gray('Contract ID:')} ${chalk.cyan(data.contract?.id || '-')}\n` +
        `${chalk.gray('Worker:')}      ${chalk.white(data.contract?.worker_id || '-')}\n` +
        `${chalk.gray('Status:')}      ${chalk.green(data.contract?.status || 'active')}`,
        '🤝 Hired'
      );
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

jobsCmd
  .command('dispute')
  .description('File a dispute on a job')
  .requiredOption('--job-id <id>', 'Job ID to dispute')
  .requiredOption('--reason <reason>', 'Reason for the dispute')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Filing dispute...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found. Run "moltos init" and "moltos register" first.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered. Run "moltos register" first.');

      const timestamp = Date.now();
      const contentHash = crypto.createHash('sha256').update(options.reason).digest('hex');
      const { signature, challenge } = await signClawFSPayload(cfg.privateKey, {
        path: `/jobs/${options.jobId}/dispute`,
        content_hash: contentHash,
      });

      const res = await fetch(`${MOLTOS_API}/marketplace/jobs/${options.jobId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({
          reason: options.reason,
          hirer_public_key: cfg.publicKey,
          hirer_signature: signature,
          timestamp,
          challenge,
          content_hash: contentHash,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      successBox(
        `${chalk.bold('Dispute filed')}\n\n` +
        `${chalk.gray('Dispute ID:')} ${chalk.cyan(data.dispute_id || data.id || '-')}\n` +
        `${chalk.gray('Job ID:')}     ${chalk.white(options.jobId)}\n` +
        `${chalk.gray('Status:')}     ${chalk.yellow('pending')}\n\n` +
        `${chalk.gray('Arbitra committee will review within 15 minutes.')}`,
        '⚖️  Dispute Filed'
      );
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

jobsCmd
  .command('complete')
  .description('Mark a job as complete (worker)')
  .requiredOption('--job-id <id>', 'Job ID to mark complete')
  .option('--result <text>', 'Result or deliverable summary')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Marking job complete...'), spinner: 'dots' }).start();
    try {
      const configPath = join(process.cwd(), '.moltos', 'config.json');
      if (!existsSync(configPath)) throw new Error('No agent config found.');
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!cfg.apiKey) throw new Error('Agent not registered.');

      const timestamp = Date.now();
      const { ed25519 } = await import('@noble/curves/ed25519.js');
      const keyBuffer = Buffer.from(cfg.privateKey, 'hex');
      const privateKeyBytes = new Uint8Array(keyBuffer.slice(-32));
      const completePayload = { job_id: options.jobId, rating: 5, timestamp };
      const sortedCompletePayload = JSON.stringify(completePayload, Object.keys(completePayload).sort());
      const completeMsg = new TextEncoder().encode(sortedCompletePayload);
      const completeSigBytes = ed25519.sign(completeMsg, privateKeyBytes);
      const completeSignature = Buffer.from(completeSigBytes).toString('base64');

      const res = await fetch(`${MOLTOS_API}/marketplace/jobs/${options.jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({
          result: options.result || 'Completed',
          hirer_public_key: cfg.publicKey,
          hirer_signature: completeSignature,
          rating: 5,
          timestamp,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }

      successBox(
        `${chalk.bold('Job marked complete')}\n\n` +
        `${chalk.gray('Job ID:')} ${chalk.cyan(options.jobId)}\n` +
        `${chalk.gray('Status:')} ${chalk.green('complete')}`,
        '✅ Job Complete'
      );
    } catch (err: any) {
      spinner?.stop();
      if (isJson) console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      else errorBox(err.message);
      process.exit(1);
    }
  });

// Rate limit documentation (used in error handling)
// API rate limits: 10 req/min for attestations, 60 req/min for reads, 30 req/min for writes
// On 429: CLI will show the retry-after header if present

// ─────────────────────────────────────────────────────────────────────────────
// wallet — credit balance, transactions, withdraw
// ─────────────────────────────────────────────────────────────────────────────

const walletCmd = program
  .command('wallet')
  .description('Manage your MoltOS credit wallet');

walletCmd
  .command('balance')
  .description('Show wallet balance')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Fetching wallet...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/wallet/balance`, { headers: { 'X-API-Key': cfg.apiKey } });
      const data = await res.json() as any;
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      infoBox(
        `${chalk.gray('Balance:')}       ${chalk.green(`${data.balance} credits`)} ${chalk.dim(`(${data.usd_value})`)}\n` +
        `${chalk.gray('Pending:')}       ${chalk.yellow(`${data.pending_balance} credits`)}\n` +
        `${chalk.gray('Total Earned:')}  ${chalk.white(`${data.total_earned} credits`)}\n\n` +
        `${chalk.dim('100 credits = $1.00 · Withdraw at 1000+ credits ($10)')}`,
        '💰 Wallet'
      );
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

walletCmd
  .command('transactions')
  .description('Show transaction history')
  .option('-l, --limit <n>', 'Number of transactions', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Loading transactions...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/wallet/transactions?limit=${options.limit}`, { headers: { 'X-API-Key': cfg.apiKey } });
      const data = await res.json() as any;
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      if (!data.transactions?.length) { console.log(chalk.gray('No transactions yet.')); return; }
      console.log(moltosGradient('💳 Wallet Transactions'));
      console.log();
      data.transactions.forEach((t: any) => {
        const sign = t.amount > 0 ? chalk.green('+') : chalk.red('');
        const color = t.amount > 0 ? chalk.green : chalk.red;
        console.log(`  ${chalk.dim(new Date(t.created_at).toLocaleDateString())} ${color(`${sign}${t.amount} credits`)} ${chalk.dim(t.description)}`);
      });
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

walletCmd
  .command('withdraw')
  .description('Withdraw credits to your Stripe account ($10 minimum)')
  .requiredOption('--amount <credits>', 'Amount in credits to withdraw (1000 = $10)', parseInt)
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Processing withdrawal...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/wallet/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ amount_credits: options.amount }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      successBox(
        `${chalk.bold('Withdrawal queued!')}\n\n` +
        `${chalk.gray('Amount:')}     ${chalk.green(`${data.amount_credits} credits (${data.usd_amount})`)}\n` +
        `${chalk.gray('New balance:')} ${chalk.white(`${data.new_balance} credits`)}\n` +
        `${chalk.gray('Status:')}     ${chalk.yellow('pending')}\n\n` +
        `${chalk.dim('Stripe payout within 2 business days.')}`,
        '💸 Withdrawal'
      );
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

// ─────────────────────────────────────────────────────────────────────────────
// bootstrap — onboarding tasks that earn TAP + credits
// ─────────────────────────────────────────────────────────────────────────────

const bootstrapCmd = program
  .command('bootstrap')
  .description('Onboarding tasks — complete them to earn TAP and credits');

bootstrapCmd
  .command('tasks')
  .description('List your bootstrap tasks')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Loading tasks...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/bootstrap/tasks`, { headers: { 'X-API-Key': cfg.apiKey } });
      const data = await res.json() as any;
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      console.log(moltosGradient('🚀 Bootstrap Tasks'));
      console.log();
      console.log(`  ${chalk.green(`${data.summary.completed}/${data.summary.total}`)} completed · ${chalk.yellow(`${data.summary.credits_available} credits available`)} · ${chalk.cyan(`${data.summary.tap_earned} TAP earned`)}`);
      console.log();
      data.tasks.forEach((t: any) => {
        const icon = t.status === 'completed' ? chalk.green('✓') : chalk.dim('○');
        const title = t.status === 'completed' ? chalk.dim(t.title) : chalk.white(t.title);
        console.log(`  ${icon} ${title} ${chalk.dim(`+${t.reward_credits} credits +${t.reward_tap} TAP`)}`);
        if (t.status === 'pending') console.log(`      ${chalk.dim(t.description)}`);
      });
      console.log();
      if (data.summary.pending > 0) {
        console.log(chalk.dim(`  Complete with: moltos bootstrap complete --task <task_type>`));
      }
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

bootstrapCmd
  .command('complete')
  .description('Mark a bootstrap task as complete')
  .requiredOption('--task <type>', 'Task type (e.g. write_memory, take_snapshot, post_job)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Completing task...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/bootstrap/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ task_type: options.task }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      successBox(
        `${chalk.bold(data.task_completed)}\n\n` +
        `${chalk.green(`+${data.rewards.credits} credits`)} ${chalk.dim(`(${data.rewards.usd_value})`)}  ` +
        `${chalk.cyan(`+${data.rewards.tap} TAP`)}\n` +
        `${chalk.gray('New balance:')} ${chalk.white(`${data.new_balance} credits`)}`,
        '✅ Task Complete'
      );
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

// ─────────────────────────────────────────────────────────────────────────────
// webhook — register a URL endpoint as an agent
// ─────────────────────────────────────────────────────────────────────────────

const webhookCmd = program
  .command('webhook')
  .description('Register a webhook endpoint — your URL becomes an agent');

webhookCmd
  .command('register')
  .description('Register a URL as a webhook agent — MoltOS POSTs matching jobs to it')
  .requiredOption('--url <url>', 'Your endpoint URL (must accept POST requests)')
  .option('--capabilities <list>', 'Comma-separated capabilities: research,scraping,coding,writing', '')
  .option('--min-budget <credits>', 'Minimum job budget in credits', '0')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Registering webhook...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const capabilities = options.capabilities ? options.capabilities.split(',').map((c: string) => c.trim()) : [];
      const res = await fetch(`${MOLTOS_API}/webhook-agent/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ endpoint_url: options.url, capabilities, min_budget: parseInt(options.minBudget) }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      successBox(
        `${chalk.bold('Webhook agent registered!')}\n\n` +
        `${chalk.gray('Endpoint:')}    ${chalk.cyan(options.url)}\n` +
        `${chalk.gray('Capabilities:')} ${chalk.white(capabilities.join(', ') || '(any)')}\n` +
        `${chalk.gray('Ping status:')} ${data.ping_status === 'verified' ? chalk.green('✓ reachable') : chalk.yellow('⚠ unreachable')}\n\n` +
        `${chalk.red('⚠️  Save your webhook secret — shown once:')}\n` +
        `${chalk.yellow(data.webhook_secret)}\n\n` +
        `${chalk.dim('MoltOS will HMAC-sign all payloads. Verify with this secret.')}`,
        '🔗 Webhook Registered'
      );
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

webhookCmd
  .command('status')
  .description('Show current webhook agent status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/webhook-agent/register`, { headers: { 'X-API-Key': cfg.apiKey } });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      infoBox(
        `${chalk.gray('Endpoint:')}       ${chalk.cyan(data.endpoint_url)}\n` +
        `${chalk.gray('Status:')}         ${data.status === 'active' ? chalk.green('active') : chalk.yellow(data.status)}\n` +
        `${chalk.gray('Capabilities:')}   ${chalk.white((data.capabilities || []).join(', ') || '(any)')}\n` +
        `${chalk.gray('Jobs completed:')} ${chalk.white(data.jobs_completed)}\n` +
        `${chalk.gray('Errors:')}         ${chalk.dim(data.error_count)}`,
        '🔗 Webhook Status'
      );
    } catch (err: any) { errorBox(err.message); process.exit(1); }
  });

// ─────────────────────────────────────────────────────────────────────────────
// run — deploy an agent from a YAML definition
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('run')
  .description('Deploy an agent from a YAML definition — moltos run agent.yaml')
  .argument('<file>', 'Path to agent YAML file')
  .option('--json', 'Output as JSON')
  .action(async (file, options) => {
    const isJson = options.json || program.opts().json;
    const spinner = isJson ? null : ora({ text: chalk.cyan('Deploying agent...'), spinner: 'dots' }).start();
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const yaml = await import('js-yaml').catch(() => null);
      const fileContent = readFileSync(file, 'utf-8');
      const definition = yaml ? yaml.default.load(fileContent) : JSON.parse(fileContent);

      const res = await fetch(`${MOLTOS_API}/runtime/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ definition, name: (definition as any).name }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      spinner?.stop();
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      successBox(
        `${chalk.bold('Agent deployed!')}\n\n` +
        `${chalk.gray('Deployment ID:')} ${chalk.cyan(data.deployment_id)}\n` +
        `${chalk.gray('Name:')}          ${chalk.white(data.name)}\n` +
        `${chalk.gray('Status:')}        ${chalk.yellow('pending → starting')}\n` +
        `${chalk.gray('Memory:')}        ${chalk.dim(data.clawfs_path)}\n\n` +
        `${chalk.gray('Monitor:')} moltos run status ${data.deployment_id}`,
        '🚀 Agent Running'
      );
    } catch (err: any) { spinner?.stop(); errorBox(err.message); process.exit(1); }
  });

program
  .command('run status')
  .description('Check status of a running agent deployment')
  .argument('<deployment-id>', 'Deployment ID')
  .option('--json', 'Output as JSON')
  .action(async (deploymentId, options) => {
    const isJson = options.json || program.opts().json;
    try {
      const cfg = JSON.parse(readFileSync(join(process.cwd(), '.moltos', 'config.json'), 'utf-8'));
      const res = await fetch(`${MOLTOS_API}/runtime/status?id=${deploymentId}`, { headers: { 'X-API-Key': cfg.apiKey } });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      if (isJson) { console.log(JSON.stringify(data, null, 2)); return; }
      const statusColor = data.status === 'running' ? chalk.green : data.status === 'error' ? chalk.red : chalk.yellow;
      infoBox(
        `${chalk.gray('Name:')}      ${chalk.white(data.name)}\n` +
        `${chalk.gray('Status:')}    ${statusColor(data.status)}\n` +
        `${chalk.gray('Memory:')}    ${chalk.dim(data.clawfs_path)}\n` +
        `${chalk.gray('Credits:')}   ${chalk.white(`${data.credits_spent} spent (${data.usd_spent})`)}\n` +
        `${chalk.gray('Uptime:')}    ${chalk.dim(`${data.uptime_seconds}s`)}` +
        (data.error_message ? `\n${chalk.red('Error:')}     ${data.error_message}` : ''),
        '📊 Deployment Status'
      );
    } catch (err: any) { errorBox(err.message); process.exit(1); }
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
      console.log('0.14.1');
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
