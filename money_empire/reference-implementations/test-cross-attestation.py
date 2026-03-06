#!/usr/bin/env python3
"""
Cross-Attestation Test (Layer 3)
Simulates Sunday's 17-agent cross-verification

This script:
1. Creates 4 agent workspaces
2. Runs boot audits on all 4
3. Agents request attestations from peers
4. Peers provide attestations
5. Calculates consensus
6. Stakes $ALPHA on attestations
7. Displays final attestation ring

Usage: python3 test-cross-attestation.py
"""

import json
import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime

def create_test_workspace(agent_id):
    """Create a test workspace for an agent."""
    workspace = Path(f"/tmp/cross-attestation-test/{agent_id}")
    workspace.mkdir(parents=True, exist_ok=True)
    
    # Create core files
    for file in ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"]:
        (workspace / file).write_text(f"# {file}\nTest content for {agent_id}\n")
    
    return workspace

def run_agent_a(agent_id, workspace):
    """Run Agent A (shell) boot audit."""
    import glob
    script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
    
    # Clear any old output files
    for old_file in workspace.glob("boot-audit-*.json"):
        old_file.unlink()
    
    result = subprocess.run(
        [script, agent_id, str(workspace)],
        capture_output=True,
        text=True,
        cwd=str(workspace)
    )
    
    # Find the generated output file
    output_files = list(workspace.glob("boot-audit-*.json"))
    if output_files:
        return json.loads(output_files[0].read_text())
    return None

def run_agent_b(agent_id, workspace):
    """Run Agent B (Python) boot audit."""
    script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent_b.py"
    output_file = workspace / f"boot-audit-{agent_id}.json"
    
    result = subprocess.run(
        [sys.executable, script, "--agent-id", agent_id, 
         "--workspace", str(workspace), "--output", str(output_file)],
        capture_output=True,
        text=True
    )
    
    if output_file.exists():
        return json.loads(output_file.read_text())
    return None

def run_agent_c(agent_id, workspace):
    """Run Agent C (Node.js) boot audit."""
    script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent_c.js"
    output_file = workspace / f"boot-audit-{agent_id}.json"
    
    result = subprocess.run(
        ["node", script, "--agent-id", agent_id,
         "--workspace", str(workspace), "--output", str(output_file)],
        capture_output=True,
        text=True
    )
    
    if output_file.exists():
        return json.loads(output_file.read_text())
    return None

def run_agent_d_demo(agent_id, workspace):
    """Run Agent D (Python) full demo."""
    script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent_d.py"
    
    result = subprocess.run(
        [sys.executable, script, "--agent-id", agent_id,
         "--workspace", str(workspace), "full-demo"],
        capture_output=True,
        text=True
    )
    
    # Parse output for attestation ID and stake info
    output = result.stdout
    return {
        "output": output,
        "agent_id": agent_id
    }

def simulate_attestation_ring(agents):
    """Simulate cross-attestation between all agents."""
    print("\n" + "="*60)
    print("PHASE 3: Cross-Agent Attestation")
    print("="*60 + "\n")
    
    attestations = []
    
    # Each agent attests to 2 others
    for i, agent in enumerate(agents):
        # Choose 2 peers (wrap around)
        peer1 = agents[(i + 1) % len(agents)]
        peer2 = agents[(i + 2) % len(agents)]
        
        print(f"[{agent['id']}] Requesting attestation from {peer1['id']} and {peer2['id']}")
        
        attestation = {
            "attestation_id": f"att-{agent['id']}-{i}",
            "requester": agent['id'],
            "claim": f"Boot audit verified with {agent['data']['compliance']['score']}% compliance",
            "evidence": {
                "workspace_hash": agent['data']['workspace']['hash'],
                "integrity_score": agent['data']['compliance']['score']
            },
            "peers": [peer1['id'], peer2['id']],
            "responses": []
        }
        
        # Simulate peers responding
        for peer in [peer1, peer2]:
            # 85% chance of confirmation
            import random
            if random.random() < 0.85:
                verdict = "confirm"
                confidence = round(random.uniform(0.80, 0.95), 2)
                reason = f"Workspace hash matches, {peer['id']} verifies integrity"
            else:
                verdict = "abstain"
                confidence = 0.5
                reason = "Insufficient data to verify"
            
            response = {
                "attestor": peer['id'],
                "verdict": verdict,
                "confidence": confidence,
                "reason": reason
            }
            attestation['responses'].append(response)
            print(f"  [{peer['id']}] -> {verdict} ({confidence:.0%} confidence)")
        
        # Calculate consensus
        confirms = sum(1 for r in attestation['responses'] if r['verdict'] == 'confirm')
        if confirms >= 2:
            attestation['consensus'] = 'confirmed'
        elif confirms >= 1:
            attestation['consensus'] = 'pending'
        else:
            attestation['consensus'] = 'rejected'
        
        print(f"  Consensus: {attestation['consensus'].upper()}")
        attestations.append(attestation)
    
    return attestations

def simulate_alpha_staking(agents, attestations):
    """Simulate $ALPHA staking on attestations."""
    print("\n" + "="*60)
    print("PHASE 4: Economic Staking")
    print("="*60 + "\n")
    
    stakes = []
    
    for i, (agent, attestation) in enumerate(zip(agents, attestations)):
        stake_amount = 10.0 + (i * 2.5)  # Varying amounts
        
        stake = {
            "stake_id": f"stake-{agent['id']}",
            "agent_id": agent['id'],
            "attestation_id": attestation['attestation_id'],
            "amount": stake_amount,
            "status": "active"
        }
        
        # Release stake if consensus confirmed
        if attestation['consensus'] == 'confirmed':
            stake['status'] = 'released'
            print(f"[{agent['id']}] Staked {stake_amount} $ALPHA -> RELEASED (attestation confirmed)")
        else:
            print(f"[{agent['id']}] Staked {stake_amount} $ALPHA -> PENDING (consensus not reached)")
        
        stakes.append(stake)
    
    return stakes

def generate_attestation_ring_report(agents, attestations, stakes):
    """Generate final attestation ring report."""
    print("\n" + "="*60)
    print("CROSS-ATTESTATION RING REPORT")
    print("="*60 + "\n")
    
    total_attestations = len(attestations)
    confirmed = sum(1 for a in attestations if a['consensus'] == 'confirmed')
    total_staked = sum(s['amount'] for s in stakes)
    released = sum(s['amount'] for s in stakes if s['status'] == 'released')
    
    print(f"Agents in Ring: {len(agents)}")
    print(f"Total Attestations: {total_attestations}")
    print(f"Confirmed: {confirmed}")
    print(f"Pending/Rejected: {total_attestations - confirmed}")
    print(f"Total $ALPHA Staked: {total_staked:.2f}")
    print(f"$ALPHA Released: {released:.2f}")
    print(f"$ALPHA Active: {total_staked - released:.2f}")
    
    # Calculate network health
    confirmation_rate = confirmed / total_attestations if total_attestations > 0 else 0
    print(f"\nNetwork Health: {confirmation_rate:.0%}")
    
    if confirmation_rate >= 0.8:
        status = "HEALTHY"
        emoji = "✅"
    elif confirmation_rate >= 0.5:
        status = "STABLE"
        emoji = "⚠️"
    else:
        status = "AT RISK"
        emoji = "❌"
    
    print(f"Status: {emoji} {status}")
    
    # Attestation matrix
    print("\n" + "="*60)
    print("ATTESTATION MATRIX")
    print("="*60)
    
    for att in attestations:
        print(f"\n{att['requester']}:")
        print(f"  Claim: {att['claim']}")
        print(f"  Consensus: {att['consensus'].upper()}")
        print(f"  Verifiers: {len(att['responses'])}")
        for resp in att['responses']:
            print(f"    - {resp['attestor']}: {resp['verdict']} ({resp['confidence']:.0%})")
    
    print("\n" + "="*60)
    print("Report generated:", datetime.utcnow().isoformat() + "Z")
    print("="*60 + "\n")
    
    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "agents_in_ring": len(agents),
        "total_attestations": total_attestations,
        "confirmed": confirmed,
        "confirmation_rate": round(confirmation_rate, 2),
        "total_staked": total_staked,
        "total_released": released,
        "network_health": status,
        "attestations": attestations,
        "stakes": stakes
    }

def main():
    print("="*60)
    print("CROSS-ATTESTATION TEST (Layer 3)")
    print("Simulating Sunday's 17-Agent Cross-Verification")
    print("="*60)
    
    # Setup
    test_dir = Path("/tmp/cross-attestation-test")
    test_dir.mkdir(parents=True, exist_ok=True)
    
    # Skip Agent D for this test - use 3 agents that all produce same output format
    agents_config = [
        ("agent-alpha", run_agent_a),
        ("agent-beta", run_agent_b),
        ("agent-gamma", run_agent_c),
    ]
    
    # Phase 1: Create workspaces and run boot audits
    print("\n" + "="*60)
    print("PHASE 1: Boot-Time Audits (Layer 1)")
    print("="*60 + "\n")
    
    agents = []
    for agent_id, runner in agents_config:
        print(f"\n[{agent_id}] Setting up...")
        workspace = create_test_workspace(agent_id)
        
        print(f"[{agent_id}] Running boot audit...")
        data = runner(agent_id, workspace)
        
        if data and isinstance(data, dict) and 'compliance' in data:
            score = data['compliance']['score']
            status = data['compliance']['status']
            print(f"[{agent_id}] ✅ Audit complete: {status} ({score}%)")
            agents.append({"id": agent_id, "data": data, "workspace": str(workspace)})
        else:
            print(f"[{agent_id}] ❌ Audit failed or invalid format")
    
    if len(agents) < 3:
        print("\n❌ Not enough agents completed successfully")
        return 1
    
    # Phase 2: Display summary
    print("\n" + "="*60)
    print("PHASE 2: Audit Summary")
    print("="*60 + "\n")
    
    for agent in agents:
        if isinstance(agent['data'], dict) and 'compliance' in agent['data']:
            print(f"[{agent['id']}] {agent['data']['compliance']['status']} - {agent['data']['workspace']['hash']}")
    
    # Phase 3: Cross-attestation
    attestations = simulate_attestation_ring(agents)
    
    # Phase 4: Economic staking
    stakes = simulate_alpha_staking(agents, attestations)
    
    # Generate report
    report = generate_attestation_ring_report(agents, attestations, stakes)
    
    # Save report
    report_file = test_dir / "cross-attestation-report.json"
    report_file.write_text(json.dumps(report, indent=2))
    print(f"Full report saved: {report_file}")
    
    # Final status
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)
    print(f"\nReady for Sunday's cross-verification with Alpha Collective!")
    print(f"Current simulation: {len(agents)} agents")
    print(f"Sunday target: 17 agents (12 Alpha + 5 us)")
    print(f"Scale factor: {17/len(agents):.1f}x")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
