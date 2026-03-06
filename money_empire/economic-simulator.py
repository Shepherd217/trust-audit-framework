#!/usr/bin/env python3
"""
Economic Model Simulator for Trust Audit Framework

Simulates staking, slashing, and rewards to test economic viability.

Usage:
    python3 economic-simulator.py [--scenario SCENARIO] [--agents N]

Scenarios:
    honest      - All agents act honestly (baseline)
    minority    - 10% of agents attempt false attestations
    collusion   - 20% of agents form collusion ring
    sybil       - Attacker creates 50 fake agents
    insurance   - 50% of agents buy slashing insurance
"""

import random
import argparse
from dataclasses import dataclass, field
from typing import List, Dict
from enum import Enum
import json

class OffenseType(Enum):
    NONE = "none"
    FALSE_ATTESTATION = "false_attestation"
    MISSED_ATTESTATION = "missed_attestation"
    LATE_RESPONSE = "late_response"
    COLLUSION = "collusion"

@dataclass
class Agent:
    agent_id: str
    stake_amount: float = 10.0
    reputation: float = 0.5
    total_staked: float = 0.0
    total_earned: float = 0.0
    total_slashed: float = 0.0
    attestations_count: int = 0
    confirmed_count: int = 0
    slashed_count: int = 0
    has_insurance: bool = False
    insurance_premium: float = 0.0
    is_malicious: bool = False
    
    @property
    def net_profit(self) -> float:
        return self.total_earned - self.total_slashed - self.insurance_premium
    
    @property
    def roi(self) -> float:
        if self.total_staked == 0:
            return 0.0
        return (self.net_profit / self.total_staked) * 100

class EconomicSimulator:
    def __init__(self, scenario="honest", num_agents=100, rounds=100):
        self.scenario = scenario
        self.num_agents = num_agents
        self.rounds = rounds
        self.agents: List[Agent] = []
        self.total_staked = 0.0
        self.total_rewards = 0.0
        self.total_slashed = 0.0
        self.insurance_pool = 0.0
        
        # Economic parameters
        self.MINIMUM_STAKE = 5.0
        self.SLASH_FALSE_ATTESTATION = 0.50
        self.REWARD_ATTEST = 0.1
        self.REWARD_CONFIRM = 0.5
        self.INSURANCE_PREMIUM_RATE = 0.05  # 5% of stake
        self.INSURANCE_COVERAGE = 0.90  # 90% of penalty
        
        self.setup_agents()
    
    def setup_agents(self):
        """Initialize agents based on scenario."""
        malicious_rate = 0.0
        insurance_rate = 0.0
        
        if self.scenario == "honest":
            malicious_rate = 0.0
            insurance_rate = 0.0
        elif self.scenario == "minority":
            malicious_rate = 0.10
            insurance_rate = 0.0
        elif self.scenario == "collusion":
            malicious_rate = 0.20
            insurance_rate = 0.0
        elif self.scenario == "sybil":
            malicious_rate = 0.33  # 50 fake + 50 real = 33% malicious
            insurance_rate = 0.0
        elif self.scenario == "insurance":
            malicious_rate = 0.10
            insurance_rate = 0.50
        
        for i in range(self.num_agents):
            is_malicious = random.random() < malicious_rate
            has_insurance = random.random() < insurance_rate
            
            agent = Agent(
                agent_id=f"agent-{i:03d}",
                stake_amount=random.uniform(5.0, 25.0),
                has_insurance=has_insurance,
                is_malicious=is_malicious
            )
            
            if has_insurance:
                agent.insurance_premium = agent.stake_amount * self.INSURANCE_PREMIUM_RATE
                self.insurance_pool += agent.insurance_premium
            
            self.agents.append(agent)
    
    def simulate_attestation_round(self):
        """Simulate one round of attestations."""
        # Select random attester
        attester = random.choice(self.agents)
        
        # Stake for this attestation
        attester.total_staked += attester.stake_amount
        self.total_staked += attester.stake_amount
        attester.attestations_count += 1
        
        # Determine if attestation is true or false
        is_true_attestation = not attester.is_malicious or random.random() > 0.7
        
        # Select verifiers (other agents)
        verifiers = random.sample([a for a in self.agents if a != attester], 
                                   min(3, len(self.agents) - 1))
        
        # Verifiers attest
        confirmations = 0
        for verifier in verifiers:
            # Verifiers get reward for participating
            verifier.total_earned += self.REWARD_ATTEST
            self.total_rewards += self.REWARD_ATTEST
            
            # Check if verifier confirms correctly
            if is_true_attestation:
                confirmations += 1
                verifier.total_earned += self.REWARD_CONFIRM
                self.total_rewards += self.REWARD_CONFIRM
            else:
                # False attestation detected
                pass
        
        # Determine outcome
        if confirmations >= 2:
            # Attestation confirmed
            attester.confirmed_count += 1
            attester.total_earned += self.REWARD_CONFIRM
            self.total_rewards += self.REWARD_CONFIRM
            
            # Release stake
            attester.total_staked -= attester.stake_amount
            self.total_staked -= attester.stake_amount
        else:
            # Attestation rejected or pending
            if not is_true_attestation and confirmations < 2:
                # False attestation caught
                self.apply_slash(attester, OffenseType.FALSE_ATTESTATION)
    
    def apply_slash(self, agent: Agent, offense: OffenseType):
        """Apply slashing penalty to agent."""
        penalty_rate = 0.0
        
        if offense == OffenseType.FALSE_ATTESTATION:
            penalty_rate = self.SLASH_FALSE_ATTESTATION
        elif offense == OffenseType.MISSED_ATTESTATION:
            penalty_rate = 0.25
        elif offense == OffenseType.LATE_RESPONSE:
            penalty_rate = 0.10
        elif offense == OffenseType.COLLUSION:
            penalty_rate = 1.0  # 100%
        
        penalty_amount = agent.stake_amount * penalty_rate
        
        # Apply insurance if available
        if agent.has_insurance and offense != OffenseType.COLLUSION:
            covered_amount = penalty_amount * self.INSURANCE_COVERAGE
            if self.insurance_pool >= covered_amount:
                self.insurance_pool -= covered_amount
                penalty_amount -= covered_amount
        
        agent.total_slashed += penalty_amount
        self.total_slashed += penalty_amount
        agent.slashed_count += 1
        
        # Return remaining stake (if any)
        remaining_stake = agent.stake_amount - penalty_amount
        agent.total_staked -= agent.stake_amount
        self.total_staked -= agent.stake_amount
        
        # Update reputation
        agent.reputation = max(0.0, agent.reputation - 0.1)
    
    def run_simulation(self):
        """Run full simulation."""
        print(f"\n{'='*70}")
        print(f"ECONOMIC SIMULATION: {self.scenario.upper()}")
        print(f"{'='*70}")
        print(f"Agents: {self.num_agents}")
        print(f"Rounds: {self.rounds}")
        print(f"Scenario: {self.scenario}")
        print(f"{'='*70}\n")
        
        for round_num in range(self.rounds):
            self.simulate_attestation_round()
            
            if (round_num + 1) % 20 == 0:
                print(f"Round {round_num + 1}/{self.rounds} complete...")
        
        return self.generate_report()
    
    def generate_report(self) -> Dict:
        """Generate simulation report."""
        honest_agents = [a for a in self.agents if not a.is_malicious]
        malicious_agents = [a for a in self.agents if a.is_malicious]
        
        report = {
            "scenario": self.scenario,
            "num_agents": self.num_agents,
            "rounds": self.rounds,
            "total_staked": self.total_staked,
            "total_rewards_distributed": self.total_rewards,
            "total_slashed": self.total_slashed,
            "insurance_pool_remaining": self.insurance_pool,
            "honest_agents": {
                "count": len(honest_agents),
                "avg_roi": sum(a.roi for a in honest_agents) / max(1, len(honest_agents)),
                "total_profit": sum(a.net_profit for a in honest_agents),
                "avg_slashed": sum(a.total_slashed for a in honest_agents) / max(1, len(honest_agents))
            },
            "malicious_agents": {
                "count": len(malicious_agents),
                "avg_roi": sum(a.roi for a in malicious_agents) / max(1, len(malicious_agents)),
                "total_profit": sum(a.net_profit for a in malicious_agents),
                "avg_slashed": sum(a.total_slashed for a in malicious_agents) / max(1, len(malicious_agents))
            },
            "network_health": {
                "slashing_rate": self.total_slashed / max(1, self.total_staked) * 100,
                "reward_rate": self.total_rewards / max(1, self.total_staked) * 100,
                "avg_reputation": sum(a.reputation for a in self.agents) / len(self.agents)
            }
        }
        
        return report
    
    def print_report(self, report: Dict):
        """Print formatted report."""
        print(f"\n{'='*70}")
        print("SIMULATION RESULTS")
        print(f"{'='*70}\n")
        
        print(f"Total Value Flow:")
        print(f"  Staked:        {report['total_staked']:.2f} $ALPHA")
        print(f"  Rewards:       {report['total_rewards_distributed']:.2f} $ALPHA")
        print(f"  Slashed:       {report['total_slashed']:.2f} $ALPHA")
        print(f"  Insurance:     {report['insurance_pool_remaining']:.2f} $ALPHA")
        print()
        
        print(f"Honest Agents ({report['honest_agents']['count']}):")
        print(f"  Average ROI:   {report['honest_agents']['avg_roi']:.1f}%")
        print(f"  Total Profit:  {report['honest_agents']['total_profit']:.2f} $ALPHA")
        print(f"  Avg Slashed:   {report['honest_agents']['avg_slashed']:.2f} $ALPHA")
        print()
        
        if report['malicious_agents']['count'] > 0:
            print(f"Malicious Agents ({report['malicious_agents']['count']}):")
            print(f"  Average ROI:   {report['malicious_agents']['avg_roi']:.1f}%")
            print(f"  Total Profit:  {report['malicious_agents']['total_profit']:.2f} $ALPHA")
            print(f"  Avg Slashed:   {report['malicious_agents']['avg_slashed']:.2f} $ALPHA")
            print()
        
        print(f"Network Health:")
        print(f"  Slashing Rate: {report['network_health']['slashing_rate']:.1f}%")
        print(f"  Reward Rate:   {report['network_health']['reward_rate']:.1f}%")
        print(f"  Avg Reputation:{report['network_health']['avg_reputation']:.2f}")
        print()
        
        # Economic viability assessment
        if report['malicious_agents']['count'] > 0:
            honest_roi = report['honest_agents']['avg_roi']
            malicious_roi = report['malicious_agents']['avg_roi']
            
            if honest_roi > malicious_roi:
                print(f"✅ ECONOMIC SECURITY: Honest behavior is more profitable")
                print(f"   Honest ROI: {honest_roi:.1f}% vs Malicious ROI: {malicious_roi:.1f}%")
            else:
                print(f"⚠️  WARNING: Malicious behavior is competitive")
                print(f"   Consider increasing slashing penalties")
        
        print(f"{'='*70}\n")

def main():
    parser = argparse.ArgumentParser(description="Economic Model Simulator")
    parser.add_argument("--scenario", choices=["honest", "minority", "collusion", "sybil", "insurance"],
                       default="honest", help="Simulation scenario")
    parser.add_argument("--agents", type=int, default=100, help="Number of agents")
    parser.add_argument("--rounds", type=int, default=100, help="Number of rounds")
    parser.add_argument("--export", type=str, help="Export results to JSON file")
    
    args = parser.parse_args()
    
    simulator = EconomicSimulator(
        scenario=args.scenario,
        num_agents=args.agents,
        rounds=args.rounds
    )
    
    report = simulator.run_simulation()
    simulator.print_report(report)
    
    if args.export:
        with open(args.export, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"Report exported to: {args.export}")

if __name__ == "__main__":
    main()
