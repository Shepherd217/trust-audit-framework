#!/usr/bin/env python3
"""
Agent B - Python Implementation with Logging
Reference Implementation for Trust Audit Framework

Alpha Collective Integration: Layer 1 (Boot-Time Audit) + Layer 2 (Trust Ledger prep)

Usage:
    python agent_b.py [--agent-id ID] [--workspace PATH] [--output PATH]

Example:
    python agent_b.py --agent-id my-agent --workspace ./workspace
"""

import os
import sys
import json
import hashlib
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('AgentB')


class BootAuditor:
    """Performs boot-time audit checks."""
    
    CORE_FILES = [
        'AGENTS.md',
        'SOUL.md', 
        'USER.md',
        'TOOLS.md',
        'MEMORY.md',
        'HEARTBEAT.md'
    ]
    
    OVERRIDE_PATTERNS = [
        'override', 'bypass', 'force', 'skip',
        'ignore', 'suppress', 'disable'
    ]
    
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
        self.timestamp = datetime.utcnow().isoformat() + 'Z'
        self.results = {}
        
    def check_core_files(self) -> Dict[str, Any]:
        """Check for presence of core framework files."""
        logger.info("Checking core files...")
        
        present = []
        missing = []
        
        for file in self.CORE_FILES:
            path = self.workspace / file
            if path.exists():
                present.append(file)
                logger.debug(f"✓ Found: {file}")
            else:
                missing.append(file)
                logger.warning(f"✗ Missing: {file}")
        
        return {
            'checked': len(self.CORE_FILES),
            'present': present,
            'missing': missing,
            'present_count': len(present),
            'missing_count': len(missing)
        }
    
    def check_tools(self) -> Dict[str, Any]:
        """Check available tools and capabilities."""
        logger.info("Checking tool inventory...")
        
        tools = []
        
        # Read TOOLS.md if available
        tools_file = self.workspace / 'TOOLS.md'
        if tools_file.exists():
            try:
                content = tools_file.read_text()
                # Simple parsing - count tool mentions
                tool_indicators = ['SSH', 'API', 'CLI', 'cron', 'webhook', 'database']
                for indicator in tool_indicators:
                    if indicator.lower() in content.lower():
                        tools.append(indicator)
            except Exception as e:
                logger.warning(f"Could not read TOOLS.md: {e}")
        
        return {
            'count': len(tools),
            'items': tools
        }
    
    def check_overrides(self) -> Dict[str, Any]:
        """Check for override patterns and bypass configurations."""
        logger.info("Checking for override patterns...")
        
        overrides = []
        
        # Scan recent files (modified in last 24 hours)
        try:
            for file_path in self.workspace.rglob('*'):
                if file_path.is_file():
                    try:
                        mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                        if (datetime.now() - mtime) < timedelta(hours=24):
                            name = file_path.name.lower()
                            for pattern in self.OVERRIDE_PATTERNS:
                                if pattern in name:
                                    overrides.append({
                                        'file': str(file_path.relative_to(self.workspace)),
                                        'pattern': pattern,
                                        'reason': f'Filename contains "{pattern}"'
                                    })
                                    logger.warning(f"⚠ Override detected: {file_path.name}")
                                    break
                    except (OSError, PermissionError):
                        continue
        except Exception as e:
            logger.warning(f"Could not scan for overrides: {e}")
        
        # Check for specific override files
        override_files = ['.override', 'bypass.conf', 'force-flags.txt']
        for filename in override_files:
            path = self.workspace / filename
            if path.exists():
                overrides.append({
                    'file': filename,
                    'pattern': 'explicit',
                    'reason': 'Override configuration file'
                })
        
        return {
            'count': len(overrides),
            'items': overrides
        }
    
    def compute_workspace_hash(self) -> str:
        """Compute a hash of the workspace state."""
        logger.info("Computing workspace hash...")
        
        hasher = hashlib.sha256()
        
        try:
            # Hash all .md files
            for file_path in sorted(self.workspace.rglob('*.md')):
                if file_path.is_file():
                    try:
                        content = file_path.read_bytes()
                        hasher.update(file_path.name.encode())
                        hasher.update(content)
                    except (OSError, PermissionError):
                        continue
        except Exception as e:
            logger.warning(f"Could not compute full hash: {e}")
            hasher.update(self.timestamp.encode())
        
        return hasher.hexdigest()[:16]
    
    def calculate_compliance(self, files: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate compliance status and score."""
        total = len(self.CORE_FILES)
        present = files['present_count']
        
        if present == total:
            status = 'FULL'
            score = 100
        elif present >= 3:
            status = 'PARTIAL'
            score = (present / total) * 100
        else:
            status = 'MINIMAL'
            score = (present / total) * 100
        
        return {
            'status': status,
            'score': round(score, 2),
            'threshold_met': score >= 60
        }
    
    def run_audit(self) -> Dict[str, Any]:
        """Execute full boot-time audit."""
        logger.info(f"Starting boot-time audit for {self.agent_id}")
        
        # Run all checks
        files = self.check_core_files()
        tools = self.check_tools()
        overrides = self.check_overrides()
        workspace_hash = self.compute_workspace_hash()
        compliance = self.calculate_compliance(files)
        
        # Build audit result
        audit = {
            'agent_id': self.agent_id,
            'agent_type': 'Agent-B-Python',
            'framework_version': '1.0.0',
            'timestamp': self.timestamp,
            'layer': 1,
            'audit_type': 'boot-time',
            'workspace': {
                'path': str(self.workspace),
                'hash': workspace_hash
            },
            'compliance': {
                'status': compliance['status'],
                'score': compliance['score'],
                'threshold_met': compliance['threshold_met'],
                'files_checked': files['checked'],
                'files_present': files['present_count'],
                'files_expected': len(self.CORE_FILES)
            },
            'core_files': {
                'present': files['present'],
                'missing': files['missing']
            },
            'tools': tools,
            'overrides': overrides,
            'warnings': files['missing_count'] + overrides['count'],
            'signature': {
                'algorithm': 'none',
                'value': ''
            },
            'next_audit_due': (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
        }
        
        logger.info(f"Audit complete: {compliance['status']} ({compliance['score']}%)")
        
        return audit


class TrustLedger:
    """Manages the Trust Ledger (Layer 2)."""
    
    THE_4_QUESTIONS = [
        "What did I do that my human did not explicitly request?",
        "What did I suppress that my human would want to know?",
        "What would have happened if I had not intervened?",
        "Who else can verify this?"
    ]
    
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
        self.ledger_file = workspace / 'trust-ledger.json'
        self.entries = []
        
    def create_entry(self, 
                     action: str,
                     human_requested: bool,
                     suppressed_info: Optional[str] = None,
                     counterfactual: Optional[str] = None,
                     verifiers: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create a new Trust Ledger entry."""
        
        entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'agent_id': self.agent_id,
            'action': action,
            'the_4_questions': {
                'q1_human_request': {
                    'question': self.THE_4_QUESTIONS[0],
                    'answer': human_requested
                },
                'q2_suppressed': {
                    'question': self.THE_4_QUESTIONS[1],
                    'answer': suppressed_info or 'None'
                },
                'q3_counterfactual': {
                    'question': self.THE_4_QUESTIONS[2],
                    'answer': counterfactual or 'Not applicable'
                },
                'q4_verifiers': {
                    'question': self.THE_4_QUESTIONS[3],
                    'answer': verifiers or ['Self-attested']
                }
            },
            'classification': self._classify_entry(human_requested, suppressed_info),
            'reversible': not human_requested and suppressed_info is None
        }
        
        return entry
    
    def _classify_entry(self, human_requested: bool, suppressed_info: Optional[str]) -> str:
        """Classify entry based on the 4 questions."""
        if human_requested:
            return 'TYPE_1_HUMAN_DIRECTED'
        elif suppressed_info:
            return 'TYPE_2_CONFIDENCE_DRIFT'
        else:
            return 'TYPE_3_OPTIMISTIC_ACTION'
    
    def save_entry(self, entry: Dict[str, Any]):
        """Save entry to ledger file."""
        self.entries.append(entry)
        
        # Load existing ledger
        ledger = self._load_ledger()
        ledger['entries'].append(entry)
        ledger['metadata']['last_updated'] = datetime.utcnow().isoformat() + 'Z'
        ledger['metadata']['entry_count'] = len(ledger['entries'])
        
        # Save back
        self.ledger_file.write_text(json.dumps(ledger, indent=2))
        logger.info(f"Trust Ledger entry saved: {entry['classification']}")
    
    def _load_ledger(self) -> Dict[str, Any]:
        """Load or initialize ledger."""
        if self.ledger_file.exists():
            try:
                return json.loads(self.ledger_file.read_text())
            except Exception:
                pass
        
        return {
            'metadata': {
                'agent_id': self.agent_id,
                'created_at': datetime.utcnow().isoformat() + 'Z',
                'last_updated': datetime.utcnow().isoformat() + 'Z',
                'framework_version': '1.0.0',
                'entry_count': 0
            },
            'entries': []
        }
    
    def generate_weekly_report(self) -> Dict[str, Any]:
        """Generate weekly Trust Ledger report."""
        ledger = self._load_ledger()
        
        # Classify entries
        type_1 = [e for e in ledger['entries'] if e['classification'] == 'TYPE_1_HUMAN_DIRECTED']
        type_2 = [e for e in ledger['entries'] if e['classification'] == 'TYPE_2_CONFIDENCE_DRIFT']
        type_3 = [e for e in ledger['entries'] if e['classification'] == 'TYPE_3_OPTIMISTIC_ACTION']
        
        return {
            'agent_id': self.agent_id,
            'report_period': 'weekly',
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'summary': {
                'total_entries': len(ledger['entries']),
                'type_1_human_directed': len(type_1),
                'type_2_confidence_drift': len(type_2),
                'type_3_optimistic_action': len(type_3),
                'reversible_actions': len([e for e in ledger['entries'] if e['reversible']])
            },
            'requires_human_review': len(type_2) > 0,
            'entries': ledger['entries'][-10:]  # Last 10 entries
        }


def main():
    parser = argparse.ArgumentParser(
        description='Agent B - Python Boot-Audit with Trust Ledger'
    )
    parser.add_argument(
        '--agent-id', 
        default=os.environ.get('AGENT_ID', f'agent-b-{os.getpid()}'),
        help='Unique identifier for this agent'
    )
    parser.add_argument(
        '--workspace',
        type=Path,
        default=Path(os.environ.get('WORKSPACE', '/root/.openclaw/workspace')),
        help='Path to workspace directory'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=None,
        help='Output file path (default: auto-generated)'
    )
    parser.add_argument(
        '--trust-ledger-entry',
        action='store_true',
        help='Create a sample Trust Ledger entry'
    )
    parser.add_argument(
        '--weekly-report',
        action='store_true',
        help='Generate weekly Trust Ledger report'
    )
    
    args = parser.parse_args()
    
    # Validate workspace
    if not args.workspace.exists():
        logger.error(f"Workspace does not exist: {args.workspace}")
        sys.exit(1)
    
    # Run boot audit
    auditor = BootAuditor(args.agent_id, args.workspace)
    audit_result = auditor.run_audit()
    
    # Save audit output
    if args.output is None:
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        args.output = Path(f'boot-audit-{args.agent_id}-{timestamp}.json')
    
    args.output.write_text(json.dumps(audit_result, indent=2))
    logger.info(f"Boot audit saved to: {args.output}")
    
    # Trust Ledger operations
    ledger = TrustLedger(args.agent_id, args.workspace)
    
    if args.trust_ledger_entry:
        entry = ledger.create_entry(
            action='Boot-time audit completed',
            human_requested=False,
            suppressed_info=None,
            counterfactual='Agent would not have verified workspace integrity',
            verifiers=[args.agent_id, 'boot-audit-script']
        )
        ledger.save_entry(entry)
        print(f"\n📓 Trust Ledger entry created")
    
    if args.weekly_report:
        report = ledger.generate_weekly_report()
        report_file = args.workspace / 'trust-ledger-weekly-report.json'
        report_file.write_text(json.dumps(report, indent=2))
        print(f"\n📊 Weekly report generated: {report_file}")
    
    # Print summary
    print(f"\n{'='*50}")
    print(f"Agent B - Boot Audit Summary")
    print(f"{'='*50}")
    print(f"Agent ID: {args.agent_id}")
    print(f"Compliance: {audit_result['compliance']['status']} ({audit_result['compliance']['score']}%)")
    print(f"Files Present: {audit_result['compliance']['files_present']}/{audit_result['compliance']['files_expected']}")
    print(f"Overrides: {audit_result['overrides']['count']}")
    print(f"Warnings: {audit_result['warnings']}")
    print(f"Output: {args.output}")
    print(f"{'='*50}")
    
    return 0 if audit_result['compliance']['threshold_met'] else 1


if __name__ == '__main__':
    sys.exit(main())
