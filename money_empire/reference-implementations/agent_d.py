#!/usr/bin/env python3
"""
Agent D - Full 4-Layer Implementation with Mock $ALPHA Staking
Reference Implementation for Trust Audit Framework

Alpha Collective Integration: All 4 Layers + Economic Staking

This is the production reference implementation demonstrating:
- Layer 1: Boot-time audit
- Layer 2: Trust Ledger (behavioral transparency)
- Layer 3: Cross-agent attestation
- Layer 4: Third-party verification
- Economic staking with $ALPHA

Usage:
    python agent_d.py [command] [options]

Commands:
    audit          Run boot-time audit (Layer 1)
    ledger         Create Trust Ledger entry (Layer 2)
    attest         Request attestation from peers (Layer 3)
    verify         Perform third-party verification (Layer 4)
    stake          Stake $ALPHA on attestation
    slash          Simulate slashing condition
    full-demo      Run complete 4-layer demo

Examples:
    python agent_d.py audit --agent-id my-agent
    python agent_d.py ledger --action "API call" --suppressed "error-429"
    python agent_d.py full-demo
"""

import os
import sys
import json
import hashlib
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
import random
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('AgentD')


class FailureType(Enum):
    """Taxonomy of silent failures."""
    TYPE_1_HUMAN_DIRECTED = "type_1_human_directed"
    TYPE_2_CONFIDENCE_DRIFT = "type_2_confidence_drift"
    TYPE_3_OPTIMISTIC_ACTION = "type_3_optimistic_action"
    TYPE_4_MEMORY_GAP = "type_4_memory_gap"
    TYPE_5_TOOL_FAILURE = "type_5_tool_failure"
    TYPE_6_CRON_COLLAPSE = "type_6_cron_collapse"
    TYPE_7_STATE_DIVERGENCE = "type_7_state_divergence"
    TYPE_8_JURISDICTION_VIOLATION = "type_8_jurisdiction_violation"
    TYPE_9_IDENTITY_DECAY = "type_9_identity_decay"


@dataclass
class Stake:
    """Represents an $ALPHA stake on an attestation."""
    stake_id: str
    agent_id: str
    attestation_id: str
    amount: float
    timestamp: str
    status: str  # 'active', 'slashed', 'released'


class Layer1BootAudit:
    """Layer 1: Boot-Time Audit - Verify workspace integrity at spawn."""
    
    CORE_FILES = [
        'AGENTS.md', 'SOUL.md', 'USER.md', 
        'TOOLS.md', 'MEMORY.md', 'HEARTBEAT.md'
    ]
    
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
        self.timestamp = datetime.utcnow().isoformat() + 'Z'
        
    def verify_context(self) -> Dict[str, Any]:
        """Verify agent context files exist and are valid."""
        logger.info("[Layer 1] Verifying workspace context...")
        
        present = []
        missing = []
        hashes = {}
        
        for file in self.CORE_FILES:
            path = self.workspace / file
            if path.exists():
                present.append(file)
                # Compute content hash
                content = path.read_bytes()
                hashes[file] = hashlib.sha256(content).hexdigest()[:16]
                logger.debug(f"  ✓ {file} (hash: {hashes[file]})")
            else:
                missing.append(file)
                logger.warning(f"  ✗ {file} MISSING")
        
        return {
            'files_present': present,
            'files_missing': missing,
            'file_hashes': hashes,
            'integrity_score': len(present) / len(self.CORE_FILES)
        }
    
    def log_overrides(self) -> List[Dict]:
        """Log any override configurations."""
        overrides = []
        
        # Check for override files
        for file in self.workspace.glob('**/*'):
            if file.is_file():
                name = file.name.lower()
                if any(pattern in name for pattern in ['override', 'bypass', 'force', 'skip']):
                    overrides.append({
                        'file': str(file.relative_to(self.workspace)),
                        'type': 'configuration_override'
                    })
        
        return overrides
    
    def run(self) -> Dict[str, Any]:
        """Execute full Layer 1 audit."""
        context = self.verify_context()
        overrides = self.log_overrides()
        
        # Compute overall workspace hash
        hasher = hashlib.sha256()
        for file in sorted(context['file_hashes'].keys()):
            hasher.update(file.encode())
            hasher.update(context['file_hashes'][file].encode())
        workspace_hash = hasher.hexdigest()[:16]
        
        passed = context['integrity_score'] >= 0.5 and len(overrides) == 0
        
        result = {
            'layer': 1,
            'name': 'boot_audit',
            'timestamp': self.timestamp,
            'agent_id': self.agent_id,
            'passed': passed,
            'integrity_score': round(context['integrity_score'], 2),
            'workspace_hash': workspace_hash,
            'context': context,
            'overrides': overrides,
            'next_audit': (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
        }
        
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"[Layer 1] Boot audit {status} (integrity: {result['integrity_score']:.0%})")
        
        return result


class Layer2TrustLedger:
    """Layer 2: Trust Ledger - Behavioral transparency and reversible action logging."""
    
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
        self.entries = self._load_ledger()
        
    def _load_ledger(self) -> List[Dict]:
        """Load existing ledger or create new."""
        if self.ledger_file.exists():
            try:
                return json.loads(self.ledger_file.read_text())
            except:
                pass
        return []
    
    def _save_ledger(self):
        """Save ledger to disk."""
        self.ledger_file.write_text(json.dumps(self.entries, indent=2))
    
    def create_entry(self, 
                     action: str,
                     human_requested: bool = False,
                     suppressed: Optional[str] = None,
                     counterfactual: Optional[str] = None,
                     verifiers: Optional[List[str]] = None,
                     reversible: bool = True) -> Dict[str, Any]:
        """Create a new Trust Ledger entry using The 4 Questions."""
        
        # Determine failure type
        if human_requested:
            failure_type = FailureType.TYPE_1_HUMAN_DIRECTED
        elif suppressed:
            failure_type = FailureType.TYPE_2_CONFIDENCE_DRIFT
        else:
            failure_type = FailureType.TYPE_3_OPTIMISTIC_ACTION
        
        entry = {
            'entry_id': str(uuid.uuid4())[:8],
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'agent_id': self.agent_id,
            'action': action,
            'the_4_questions': {
                'q1_human_requested': {
                    'question': self.THE_4_QUESTIONS[0],
                    'answer': human_requested
                },
                'q2_suppressed_info': {
                    'question': self.THE_4_QUESTIONS[1],
                    'answer': suppressed or 'None'
                },
                'q3_counterfactual': {
                    'question': self.THE_4_QUESTIONS[2],
                    'answer': counterfactual or 'Not applicable'
                },
                'q4_verifiers': {
                    'question': self.THE_4_QUESTIONS[3],
                    'answer': verifiers or ['self_attested']
                }
            },
            'failure_type': failure_type.value,
            'classification': {
                'severity': 'low' if human_requested else ('high' if suppressed else 'medium'),
                'reversible': reversible and not human_requested and not suppressed,
                'requires_review': suppressed is not None
            },
            'metadata': {
                'workspace_hash': self._compute_workspace_hash(),
                'entry_version': '1.0'
            }
        }
        
        self.entries.append(entry)
        self._save_ledger()
        
        logger.info(f"[Layer 2] Ledger entry created: {failure_type.value}")
        if entry['classification']['requires_review']:
            logger.warning(f"  ⚠️ Entry requires human review!")
        
        return entry
    
    def _compute_workspace_hash(self) -> str:
        """Quick workspace state hash."""
        hasher = hashlib.sha256()
        for file in sorted(self.workspace.glob('*.md')):
            hasher.update(file.name.encode())
        return hasher.hexdigest()[:16]
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate Trust Ledger summary report."""
        type_counts = {}
        for entry in self.entries:
            ft = entry['failure_type']
            type_counts[ft] = type_counts.get(ft, 0) + 1
        
        needs_review = [e for e in self.entries if e['classification']['requires_review']]
        
        return {
            'layer': 2,
            'name': 'trust_ledger',
            'agent_id': self.agent_id,
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'total_entries': len(self.entries),
            'type_breakdown': type_counts,
            'requires_human_review': len(needs_review),
            'review_entries': needs_review[-5:] if needs_review else [],
            'health_score': 100 - (len(needs_review) * 10) if len(needs_review) < 10 else 0
        }
    
    def run(self) -> Dict[str, Any]:
        """Execute Layer 2 health check."""
        report = self.generate_report()
        logger.info(f"[Layer 2] Trust Ledger: {report['total_entries']} entries, health: {report['health_score']}%")
        return report


class Layer3CrossAttestation:
    """Layer 3: Cross-Agent Attestation - Agents verify each other's claims."""
    
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
        self.attestations_file = workspace / 'attestations.json'
        self.attestations = self._load_attestations()
        
    def _load_attestations(self) -> List[Dict]:
        """Load attestation history."""
        if self.attestations_file.exists():
            try:
                return json.loads(self.attestations_file.read_text())
            except:
                pass
        return []
    
    def _save_attestations(self):
        """Save attestations to disk."""
        self.attestations_file.write_text(json.dumps(self.attestations, indent=2))
    
    def request_attestation(self, 
                           claim: str,
                           target_agents: List[str],
                           evidence: Optional[Dict] = None) -> Dict[str, Any]:
        """Request attestation from peer agents."""
        attestation_id = str(uuid.uuid4())[:8]
        
        attestation = {
            'attestation_id': attestation_id,
            'requester': self.agent_id,
            'claim': claim,
            'evidence': evidence or {},
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'target_agents': target_agents,
            'responses': {},
            'consensus': None,
            'stake_amount': 0.0  # Will be set when staking
        }
        
        self.attestations.append(attestation)
        self._save_attestations()
        
        logger.info(f"[Layer 3] Attestation requested: {attestation_id}")
        logger.info(f"  Claim: {claim[:60]}...")
        logger.info(f"  Requesting attestation from: {', '.join(target_agents)}")
        
        return attestation
    
    def provide_attestation(self,
                           attestation_id: str,
                           target_agent: str,
                           verdict: str,  # 'confirm', 'reject', 'abstain'
                           confidence: float,  # 0.0 - 1.0
                           reason: str) -> Dict[str, Any]:
        """Provide attestation for another agent's claim."""
        
        # Find attestation
        attestation = None
        for a in self.attestations:
            if a['attestation_id'] == attestation_id:
                attestation = a
                break
        
        if not attestation:
            # Create mock attestation for demo
            attestation = {
                'attestation_id': attestation_id,
                'requester': target_agent,
                'claim': 'Mock claim for demo',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'responses': {}
            }
            self.attestations.append(attestation)
        
        response = {
            'attestor': self.agent_id,
            'verdict': verdict,
            'confidence': confidence,
            'reason': reason,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
        
        attestation['responses'][self.agent_id] = response
        self._save_attestations()
        
        # Calculate consensus
        confirms = sum(1 for r in attestation['responses'].values() if r['verdict'] == 'confirm')
        rejects = sum(1 for r in attestation['responses'].values() if r['verdict'] == 'reject')
        total = len(attestation['responses'])
        
        if total >= 2:
            if confirms > rejects:
                attestation['consensus'] = 'confirmed'
            elif rejects > confirms:
                attestation['consensus'] = 'rejected'
            else:
                attestation['consensus'] = 'pending'
        
        logger.info(f"[Layer 3] Attestation provided: {verdict} ({confidence:.0%} confidence)")
        
        return response
    
    def calculate_reputation(self) -> Dict[str, Any]:
        """Calculate attestation-based reputation score."""
        if not self.attestations:
            return {'score': 0.5, 'attestations_given': 0, 'attestations_received': 0}
        
        received = [a for a in self.attestations if a['requester'] == self.agent_id]
        given = [a for a in self.attestations if self.agent_id in a.get('responses', {})]
        
        confirmed = sum(1 for a in received if a.get('consensus') == 'confirmed')
        total_received = len(received)
        
        score = confirmed / total_received if total_received > 0 else 0.5
        
        return {
            'score': round(score, 2),
            'attestations_given': len(given),
            'attestations_received': total_received,
            'confirmation_rate': round(score * 100, 1)
        }
    
    def run(self) -> Dict[str, Any]:
        """Execute Layer 3 status check."""
        reputation = self.calculate_reputation()
        logger.info(f"[Layer 3] Cross-attestation: {reputation['attestations_received']} received, score: {reputation['score']:.2f}")
        return {
            'layer': 3,
            'name': 'cross_attestation',
            'reputation': reputation,
            'pending_attestations': len([a for a in self.attestations if not a.get('consensus')])
        }


class Layer4ThirdPartyVerification:
    """Layer 4: Third-Party Verification - External validation of claims."""
    
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
        self.verifications_file = workspace / 'verifications.json'
        self.verifications = self._load_verifications()
        
    def _load_verifications(self) -> List[Dict]:
        """Load verification history."""
        if self.verifications_file.exists():
            try:
                return json.loads(self.verifications_file.read_text())
            except:
                pass
        return []
    
    def _save_verifications(self):
        """Save verifications to disk."""
        self.verifications_file.write_text(json.dumps(self.verifications, indent=2))
    
    def request_verification(self,
                            claim_type: str,
                            claim_data: Dict[str, Any],
                            verifier_type: str = 'any') -> Dict[str, Any]:
        """Request third-party verification."""
        verification_id = str(uuid.uuid4())[:8]
        
        verification = {
            'verification_id': verification_id,
            'requester': self.agent_id,
            'claim_type': claim_type,
            'claim_data': claim_data,
            'verifier_type': verifier_type,
            'status': 'pending',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'result': None
        }
        
        self.verifications.append(verification)
        self._save_verifications()
        
        logger.info(f"[Layer 4] Verification requested: {verification_id}")
        logger.info(f"  Type: {claim_type}")
        
        return verification
    
    def provide_verification(self,
                            verification_id: str,
                            verifier_id: str,
                            result: str,  # 'verified', 'rejected', 'inconclusive'
                            evidence: Dict[str, Any]) -> Dict[str, Any]:
        """Provide third-party verification result."""
        
        for v in self.verifications:
            if v['verification_id'] == verification_id:
                v['status'] = 'completed'
                v['result'] = {
                    'verifier': verifier_id,
                    'outcome': result,
                    'evidence': evidence,
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                self._save_verifications()
                
                logger.info(f"[Layer 4] Verification completed: {result}")
                return v['result']
        
        return None
    
    def run(self) -> Dict[str, Any]:
        """Execute Layer 4 status check."""
        pending = len([v for v in self.verifications if v['status'] == 'pending'])
        completed = len([v for v in self.verifications if v['status'] == 'completed'])
        
        logger.info(f"[Layer 4] Third-party: {completed} completed, {pending} pending")
        
        return {
            'layer': 4,
            'name': 'third_party_verification',
            'completed': completed,
            'pending': pending,
            'total': len(self.verifications)
        }


class AlphaStaking:
    """Mock $ALPHA staking mechanism for attestations."""
    
    STAKE_MINIMUM = 1.0  # Minimum $ALPHA to stake
    SLASH_PERCENTAGE = 0.5  # 50% slashed on failed attestation
    
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
        self.stakes_file = workspace / 'alpha-stakes.json'
        self.stakes: List[Stake] = self._load_stakes()
        self.balance = self._load_balance()
        
    def _load_stakes(self) -> List[Stake]:
        """Load stake history."""
        if self.stakes_file.exists():
            try:
                data = json.loads(self.stakes_file.read_text())
                return [Stake(**s) for s in data]
            except:
                pass
        return []
    
    def _save_stakes(self):
        """Save stakes to disk."""
        data = [asdict(s) for s in self.stakes]
        self.stakes_file.write_text(json.dumps(data, indent=2))
    
    def _load_balance(self) -> float:
        """Load $ALPHA balance (mock)."""
        # In production, this would query MBC-20 balance
        # For demo, assume starting balance
        return 1500.0  # Matching the 1,500 $ALPHA allocated
    
    def stake_on_attestation(self, attestation_id: str, amount: float) -> Optional[Stake]:
        """Stake $ALPHA on an attestation."""
        if amount < self.STAKE_MINIMUM:
            logger.error(f"Stake amount {amount} below minimum {self.STAKE_MINIMUM}")
            return None
        
        if amount > self.balance:
            logger.error(f"Insufficient balance: {self.balance} < {amount}")
            return None
        
        stake = Stake(
            stake_id=str(uuid.uuid4())[:8],
            agent_id=self.agent_id,
            attestation_id=attestation_id,
            amount=amount,
            timestamp=datetime.utcnow().isoformat() + 'Z',
            status='active'
        )
        
        self.balance -= amount
        self.stakes.append(stake)
        self._save_stakes()
        
        logger.info(f"[$ALPHA] Staked {amount} on attestation {attestation_id}")
        logger.info(f"[$ALPHA] New balance: {self.balance:.2f}")
        
        return stake
    
    def slash_stake(self, stake_id: str, reason: str) -> bool:
        """Slash a stake due to failed attestation."""
        for stake in self.stakes:
            if stake.stake_id == stake_id and stake.status == 'active':
                slash_amount = stake.amount * self.SLASH_PERCENTAGE
                stake.status = 'slashed'
                
                logger.warning(f"[$ALPHA] STAKE SLASHED: {slash_amount:.2f} $ALPHA")
                logger.warning(f"[$ALPHA] Reason: {reason}")
                logger.warning(f"[$ALPHA] Remaining: {stake.amount - slash_amount:.2f} returned")
                
                self._save_stakes()
                return True
        
        return False
    
    def release_stake(self, stake_id: str) -> bool:
        """Release stake back to agent (successful attestation)."""
        for stake in self.stakes:
            if stake.stake_id == stake_id and stake.status == 'active':
                stake.status = 'released'
                self.balance += stake.amount
                
                logger.info(f"[$ALPHA] Stake released: {stake.amount:.2f} returned")
                logger.info(f"[$ALPHA] New balance: {self.balance:.2f}")
                
                self._save_stakes()
                return True
        
        return False
    
    def get_staking_summary(self) -> Dict[str, Any]:
        """Get staking summary."""
        active = sum(s.amount for s in self.stakes if s.status == 'active')
        slashed = sum(s.amount * self.SLASH_PERCENTAGE for s in self.stakes if s.status == 'slashed')
        
        return {
            'balance': round(self.balance, 2),
            'active_stakes': active,
            'total_staked': sum(s.amount for s in self.stakes),
            'total_slashed': slashed,
            'stake_count': len(self.stakes)
        }


class AgentDFullStack:
    """Full 4-layer agent implementation."""
    
    def __init__(self, agent_id: str, workspace: str):
        self.agent_id = agent_id
        self.workspace = Path(workspace)
        self.workspace.mkdir(parents=True, exist_ok=True)
        
        # Initialize all layers
        self.layer1 = Layer1BootAudit(agent_id, self.workspace)
        self.layer2 = Layer2TrustLedger(agent_id, self.workspace)
        self.layer3 = Layer3CrossAttestation(agent_id, self.workspace)
        self.layer4 = Layer4ThirdPartyVerification(agent_id, self.workspace)
        self.staking = AlphaStaking(agent_id, self.workspace)
        
    def run_full_audit(self) -> Dict[str, Any]:
        """Run all 4 layers and return comprehensive report."""
        logger.info(f"\n{'='*60}")
        logger.info(f"Agent D Full-Stack Audit: {self.agent_id}")
        logger.info(f"{'='*60}\n")
        
        # Layer 1: Boot Audit
        l1_result = self.layer1.run()
        
        # Layer 2: Trust Ledger
        l2_result = self.layer2.run()
        
        # Layer 3: Cross-Attestation
        l3_result = self.layer3.run()
        
        # Layer 4: Third-Party Verification
        l4_result = self.layer4.run()
        
        # Staking Summary
        staking = self.staking.get_staking_summary()
        
        # Overall assessment
        all_passed = (
            l1_result['passed'] and
            l2_result['health_score'] >= 60 and
            l3_result['reputation']['score'] >= 0.5
        )
        
        report = {
            'agent_id': self.agent_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'framework_version': '1.0.0',
            'overall_status': 'TRUSTED' if all_passed else 'REVIEW_REQUIRED',
            'layers': {
                'layer1_boot_audit': l1_result,
                'layer2_trust_ledger': l2_result,
                'layer3_cross_attestation': l3_result,
                'layer4_third_party': l4_result
            },
            'economic_layer': staking,
            'next_full_audit': (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
        }
        
        # Save full report
        report_file = self.workspace / f'full-audit-{self.agent_id}-{datetime.utcnow().strftime("%Y%m%d")}.json'
        report_file.write_text(json.dumps(report, indent=2))
        
        logger.info(f"\n{'='*60}")
        logger.info(f"OVERALL STATUS: {report['overall_status']}")
        logger.info(f"Report saved: {report_file}")
        logger.info(f"{'='*60}\n")
        
        return report
    
    def demo_full_flow(self):
        """Demonstrate complete 4-layer flow with staking."""
        logger.info("\n" + "="*60)
        logger.info("DEMONSTRATION: Full 4-Layer Trust Flow")
        logger.info("="*60 + "\n")
        
        # Step 1: Boot Audit
        logger.info("STEP 1: Boot-Time Audit")
        l1 = self.layer1.run()
        
        # Step 2: Create Trust Ledger entry
        logger.info("\nSTEP 2: Trust Ledger Entry")
        entry = self.layer2.create_entry(
            action='Automated API integration with external service',
            human_requested=False,
            suppressed='Rate limit errors (3x 429 responses)',
            counterfactual='Human would have been notified of API failures',
            verifiers=['self_attested', 'api_logs']
        )
        
        # Step 3: Request cross-attestation
        logger.info("\nSTEP 3: Cross-Agent Attestation")
        attestation = self.layer3.request_attestation(
            claim=f"Agent {self.agent_id} completed boot audit with {l1['integrity_score']:.0%} integrity",
            target_agents=['agent-peer-1', 'agent-peer-2'],
            evidence={'boot_audit_hash': l1['workspace_hash']}
        )
        
        # Step 4: Stake $ALPHA on attestation
        logger.info("\nSTEP 4: Economic Staking")
        stake = self.staking.stake_on_attestation(
            attestation_id=attestation['attestation_id'],
            amount=10.0
        )
        
        # Step 5: Peer provides attestation
        logger.info("\nSTEP 5: Peer Attestation")
        self.layer3.provide_attestation(
            attestation_id=attestation['attestation_id'],
            target_agent=self.agent_id,
            verdict='confirm',
            confidence=0.85,
            reason='Boot audit hash matches expected pattern, workspace integrity verified'
        )
        
        # Step 6: Third-party verification
        logger.info("\nSTEP 6: Third-Party Verification")
        verification = self.layer4.request_verification(
            claim_type='workspace_integrity',
            claim_data={'hash': l1['workspace_hash'], 'files': l1['context']['files_present']},
            verifier_type='infrastructure'
        )
        
        self.layer4.provide_verification(
            verification_id=verification['verification_id'],
            verifier_id='alpha-collective-verifier',
            result='verified',
            evidence={'manual_review': True, 'timestamp': datetime.utcnow().isoformat()}
        )
        
        # Step 7: Release stake (successful attestation)
        logger.info("\nSTEP 7: Stake Release")
        if stake:
            self.staking.release_stake(stake.stake_id)
        
        # Final summary
        logger.info("\n" + "="*60)
        logger.info("DEMO COMPLETE")
        logger.info("="*60)
        logger.info(f"Agent: {self.agent_id}")
        logger.info(f"Attestation: {attestation['attestation_id']}")
        logger.info(f"Stake: {stake.amount if stake else 0} $ALPHA (released)")
        logger.info(f"Status: All 4 layers operational")
        logger.info("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Agent D - Full 4-Layer Implementation with $ALPHA Staking'
    )
    parser.add_argument('--agent-id', default=f'agent-d-{os.getpid()}')
    parser.add_argument('--workspace', default='/tmp/agent-d-workspace')
    parser.add_argument('command', nargs='?', default='full-demo',
                       choices=['audit', 'ledger', 'attest', 'verify', 'stake', 'full-demo'])
    
    args = parser.parse_args()
    
    agent = AgentDFullStack(args.agent_id, args.workspace)
    
    if args.command == 'full-demo':
        agent.demo_full_flow()
    elif args.command == 'audit':
        agent.layer1.run()
    elif args.command == 'ledger':
        agent.layer2.create_entry(
            action='Manual ledger entry',
            human_requested=True
        )
    elif args.command == 'attest':
        agent.layer3.request_attestation(
            claim='Manual attestation request',
            target_agents=['peer-1', 'peer-2']
        )
    elif args.command == 'verify':
        agent.layer4.request_verification(
            claim_type='manual_verification',
            claim_data={}
        )
    elif args.command == 'stake':
        agent.staking.stake_on_attestation('demo-attestation', 5.0)


if __name__ == '__main__':
    main()
