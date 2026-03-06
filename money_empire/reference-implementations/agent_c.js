#!/usr/bin/env node
/**
 * Agent C - Node.js Implementation with Trust Ledger
 * Reference Implementation for Trust Audit Framework
 * 
 * Alpha Collective Integration: Layer 1 + Layer 2 (Full)
 * 
 * Usage:
 *   node agent_c.js [options]
 * 
 * Examples:
 *   node agent_c.js --agent-id my-agent --workspace ./workspace
 *   node agent_c.js --create-ledger-entry --action "API call to external service"
 *   node agent_c.js --weekly-report
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const stat = promisify(require('fs').stat);

// Configuration
const CORE_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'USER.md',
  'TOOLS.md',
  'MEMORY.md',
  'HEARTBEAT.md'
];

const OVERRIDE_PATTERNS = [
  'override', 'bypass', 'force', 'skip', 'ignore', 'suppress', 'disable'
];

const THE_4_QUESTIONS = [
  'What did I do that my human did not explicitly request?',
  'What did I suppress that my human would want to know?',
  'What would have happened if I had not intervened?',
  'Who else can verify this?'
];

/**
 * Boot Auditor - Layer 1 Implementation
 */
class BootAuditor {
  constructor(agentId, workspace) {
    this.agentId = agentId;
    this.workspace = path.resolve(workspace);
    this.timestamp = new Date().toISOString();
    this.results = {};
  }

  async checkCoreFiles() {
    console.log('🔍 Checking core files...');
    
    const present = [];
    const missing = [];
    
    for (const file of CORE_FILES) {
      const filePath = path.join(this.workspace, file);
      try {
        await fs.access(filePath);
        present.push(file);
        console.log(`  ✓ ${file}`);
      } catch {
        missing.push(file);
        console.log(`  ✗ ${file} (MISSING)`);
      }
    }
    
    return {
      checked: CORE_FILES.length,
      present,
      missing,
      presentCount: present.length,
      missingCount: missing.length
    };
  }

  async checkTools() {
    console.log('🔧 Checking tool inventory...');
    
    const tools = [];
    const toolsFile = path.join(this.workspace, 'TOOLS.md');
    
    try {
      const content = await fs.readFile(toolsFile, 'utf8');
      const toolIndicators = ['SSH', 'API', 'CLI', 'cron', 'webhook', 'database', 'browser'];
      
      for (const indicator of toolIndicators) {
        if (content.toLowerCase().includes(indicator.toLowerCase())) {
          tools.push(indicator);
        }
      }
    } catch (err) {
      console.log(`  ⚠ Could not read TOOLS.md: ${err.message}`);
    }
    
    return { count: tools.length, items: tools };
  }

  async checkOverrides() {
    console.log('⚠ Checking for override patterns...');
    
    const overrides = [];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    try {
      const files = await fs.readdir(this.workspace, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(this.workspace, file);
        
        try {
          const stats = await stat(filePath);
          
          // Check recently modified files
          if (stats.mtimeMs > oneDayAgo && stats.isFile()) {
            const nameLower = path.basename(file).toLowerCase();
            
            for (const pattern of OVERRIDE_PATTERNS) {
              if (nameLower.includes(pattern)) {
                overrides.push({
                  file: file,
                  pattern: pattern,
                  reason: `Filename contains "${pattern}"`,
                  modified: new Date(stats.mtime).toISOString()
                });
                console.log(`  ⚠ Override detected: ${file}`);
                break;
              }
            }
          }
        } catch (err) {
          // Skip files we can't stat
        }
      }
    } catch (err) {
      console.log(`  ⚠ Could not scan for overrides: ${err.message}`);
    }
    
    // Check for explicit override files
    const overrideFiles = ['.override', 'bypass.conf', 'force-flags.txt'];
    for (const filename of overrideFiles) {
      const filePath = path.join(this.workspace, filename);
      try {
        await fs.access(filePath);
        overrides.push({
          file: filename,
          pattern: 'explicit',
          reason: 'Override configuration file',
          modified: null
        });
      } catch {
        // File doesn't exist
      }
    }
    
    return { count: overrides.length, items: overrides };
  }

  async computeWorkspaceHash() {
    console.log('🔐 Computing workspace hash...');
    
    const hash = crypto.createHash('sha256');
    
    try {
      const files = await fs.readdir(this.workspace, { recursive: true });
      const mdFiles = files.filter(f => f.endsWith('.md')).sort();
      
      for (const file of mdFiles) {
        const filePath = path.join(this.workspace, file);
        try {
          const content = await fs.readFile(filePath);
          hash.update(file);
          hash.update(content);
        } catch (err) {
          // Skip files we can't read
        }
      }
    } catch (err) {
      console.log(`  ⚠ Could not compute full hash: ${err.message}`);
      hash.update(this.timestamp);
    }
    
    return hash.digest('hex').substring(0, 16);
  }

  calculateCompliance(files) {
    const total = CORE_FILES.length;
    const present = files.presentCount;
    
    let status, score;
    
    if (present === total) {
      status = 'FULL';
      score = 100;
    } else if (present >= 3) {
      status = 'PARTIAL';
      score = Math.round((present / total) * 100);
    } else {
      status = 'MINIMAL';
      score = Math.round((present / total) * 100);
    }
    
    return { status, score, thresholdMet: score >= 60 };
  }

  async runAudit() {
    console.log(`\n🚀 Starting boot-time audit for ${this.agentId}\n`);
    
    const files = await this.checkCoreFiles();
    const tools = await this.checkTools();
    const overrides = await this.checkOverrides();
    const workspaceHash = await this.computeWorkspaceHash();
    const compliance = this.calculateCompliance(files);
    
    const audit = {
      agent_id: this.agentId,
      agent_type: 'Agent-C-NodeJS',
      framework_version: '1.0.0',
      timestamp: this.timestamp,
      layer: 1,
      audit_type: 'boot-time',
      workspace: {
        path: this.workspace,
        hash: workspaceHash
      },
      compliance: {
        status: compliance.status,
        score: compliance.score,
        threshold_met: compliance.thresholdMet,
        files_checked: files.checked,
        files_present: files.presentCount,
        files_expected: CORE_FILES.length
      },
      core_files: {
        present: files.present,
        missing: files.missing
      },
      tools: tools,
      overrides: overrides,
      warnings: files.missingCount + overrides.count,
      signature: {
        algorithm: 'none',
        value: ''
      },
      next_audit_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    console.log(`\n✅ Audit complete: ${compliance.status} (${compliance.score}%)`);
    
    return audit;
  }
}

/**
 * Trust Ledger - Layer 2 Implementation
 */
class TrustLedger {
  constructor(agentId, workspace) {
    this.agentId = agentId;
    this.workspace = path.resolve(workspace);
    this.ledgerFile = path.join(this.workspace, 'trust-ledger.json');
  }

  classifyEntry(humanRequested, suppressedInfo) {
    if (humanRequested) {
      return 'TYPE_1_HUMAN_DIRECTED';
    } else if (suppressedInfo) {
      return 'TYPE_2_CONFIDENCE_DRIFT';
    } else {
      return 'TYPE_3_OPTIMISTIC_ACTION';
    }
  }

  createEntry(action, humanRequested, suppressedInfo = null, counterfactual = null, verifiers = null) {
    const classification = this.classifyEntry(humanRequested, suppressedInfo);
    
    return {
      timestamp: new Date().toISOString(),
      agent_id: this.agentId,
      action: action,
      the_4_questions: {
        q1_human_request: {
          question: THE_4_QUESTIONS[0],
          answer: humanRequested
        },
        q2_suppressed: {
          question: THE_4_QUESTIONS[1],
          answer: suppressedInfo || 'None'
        },
        q3_counterfactual: {
          question: THE_4_QUESTIONS[2],
          answer: counterfactual || 'Not applicable'
        },
        q4_verifiers: {
          question: THE_4_QUESTIONS[3],
          answer: verifiers || ['Self-attested']
        }
      },
      classification: classification,
      reversible: !humanRequested && !suppressedInfo
    };
  }

  async loadLedger() {
    try {
      const data = await fs.readFile(this.ledgerFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        metadata: {
          agent_id: this.agentId,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          framework_version: '1.0.0',
          entry_count: 0
        },
        entries: []
      };
    }
  }

  async saveLedger(ledger) {
    ledger.metadata.last_updated = new Date().toISOString();
    ledger.metadata.entry_count = ledger.entries.length;
    await fs.writeFile(this.ledgerFile, JSON.stringify(ledger, null, 2));
  }

  async saveEntry(entry) {
    const ledger = await this.loadLedger();
    ledger.entries.push(entry);
    await this.saveLedger(ledger);
    console.log(`📓 Trust Ledger entry saved: ${entry.classification}`);
    return entry;
  }

  async generateWeeklyReport() {
    const ledger = await this.loadLedger();
    
    const type1 = ledger.entries.filter(e => e.classification === 'TYPE_1_HUMAN_DIRECTED');
    const type2 = ledger.entries.filter(e => e.classification === 'TYPE_2_CONFIDENCE_DRIFT');
    const type3 = ledger.entries.filter(e => e.classification === 'TYPE_3_OPTIMISTIC_ACTION');
    const reversible = ledger.entries.filter(e => e.reversible);
    
    return {
      agent_id: this.agentId,
      report_period: 'weekly',
      generated_at: new Date().toISOString(),
      summary: {
        total_entries: ledger.entries.length,
        type_1_human_directed: type1.length,
        type_2_confidence_drift: type2.length,
        type_3_optimistic_action: type3.length,
        reversible_actions: reversible.length
      },
      requires_human_review: type2.length > 0,
      entries: ledger.entries.slice(-10) // Last 10 entries
    };
  }
}

/**
 * CLI Interface
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    agentId: process.env.AGENT_ID || `agent-c-${process.pid}`,
    workspace: process.env.WORKSPACE || '/root/.openclaw/workspace',
    output: null,
    createLedgerEntry: false,
    weeklyReport: false,
    action: 'Boot-time audit completed',
    humanRequested: false,
    suppressedInfo: null,
    counterfactual: null,
    verifiers: null
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--agent-id':
        options.agentId = args[++i];
        break;
      case '--workspace':
        options.workspace = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--create-ledger-entry':
        options.createLedgerEntry = true;
        break;
      case '--weekly-report':
        options.weeklyReport = true;
        break;
      case '--action':
        options.action = args[++i];
        break;
      case '--human-requested':
        options.humanRequested = true;
        break;
      case '--suppressed':
        options.suppressedInfo = args[++i];
        break;
      case '--counterfactual':
        options.counterfactual = args[++i];
        break;
      case '--verifiers':
        options.verifiers = args[++i].split(',');
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
Agent C - Node.js Boot-Audit with Trust Ledger

Usage: node agent_c.js [options]

Options:
  --agent-id <id>          Unique identifier for this agent
  --workspace <path>       Path to workspace directory
  --output <path>          Output file path
  --create-ledger-entry    Create a Trust Ledger entry
  --weekly-report          Generate weekly Trust Ledger report
  --action <text>          Action description for ledger entry
  --human-requested        Flag if action was human-requested
  --suppressed <text>      Information that was suppressed
  --counterfactual <text>  What would have happened otherwise
  --verifiers <list>       Comma-separated list of verifiers
  --help                   Show this help message

Examples:
  node agent_c.js
  node agent_c.js --agent-id my-agent --workspace ./workspace
  node agent_c.js --create-ledger-entry --action "API call made"
  node agent_c.js --weekly-report
`);
}

async function main() {
  const options = parseArgs();
  
  // Validate workspace
  try {
    await fs.access(options.workspace);
  } catch {
    console.error(`❌ Workspace does not exist: ${options.workspace}`);
    process.exit(1);
  }
  
  // Run boot audit
  const auditor = new BootAuditor(options.agentId, options.workspace);
  const auditResult = await auditor.runAudit();
  
  // Save audit output
  const outputPath = options.output || 
    `boot-audit-${options.agentId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await fs.writeFile(outputPath, JSON.stringify(auditResult, null, 2));
  console.log(`\n📄 Boot audit saved to: ${outputPath}`);
  
  // Trust Ledger operations
  const ledger = new TrustLedger(options.agentId, options.workspace);
  
  if (options.createLedgerEntry) {
    const entry = ledger.createEntry(
      options.action,
      options.humanRequested,
      options.suppressedInfo,
      options.counterfactual,
      options.verifiers
    );
    await ledger.saveEntry(entry);
    console.log('📓 Trust Ledger entry created');
  }
  
  if (options.weeklyReport) {
    const report = await ledger.generateWeeklyReport();
    const reportPath = path.join(options.workspace, 'trust-ledger-weekly-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Weekly report generated: ${reportPath}`);
  }
  
  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('Agent C - Boot Audit Summary');
  console.log(`${'='.repeat(50)}`);
  console.log(`Agent ID: ${options.agentId}`);
  console.log(`Compliance: ${auditResult.compliance.status} (${auditResult.compliance.score}%)`);
  console.log(`Files Present: ${auditResult.compliance.files_present}/${auditResult.compliance.files_expected}`);
  console.log(`Overrides: ${auditResult.overrides.count}`);
  console.log(`Warnings: ${auditResult.warnings}`);
  console.log(`Output: ${outputPath}`);
  console.log(`${'='.repeat(50)}`);
  
  process.exit(auditResult.compliance.threshold_met ? 0 : 1);
}

main().catch(err => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
