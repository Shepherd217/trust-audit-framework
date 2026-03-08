import { describe, it, expect, beforeEach } from 'vitest';
import { 
  updateVirtueRBTS, 
  calculateTotalReputation, 
  quadraticScore, 
  predictionBonus,
  canTransferReputation,
  simulateCollusionAttack 
} from '../virtue/rbts';

describe('RBTS Virtue Layer', () => {
  describe('quadraticScore', () => {
    it('should give perfect score when report equals mean', () => {
      expect(quadraticScore(0.5, 0.5)).toBe(1);
      expect(quadraticScore(0.8, 0.8)).toBe(1);
    });

    it('should give zero score when report is opposite of mean', () => {
      expect(quadraticScore(0, 1)).toBe(0);
      expect(quadraticScore(1, 0)).toBe(0);
    });

    it('should decrease as report deviates from mean', () => {
      const score1 = quadraticScore(0.6, 0.5);
      const score2 = quadraticScore(0.7, 0.5);
      expect(score2).toBeLessThan(score1);
    });
  });

  describe('predictionBonus', () => {
    it('should reward accurate predictions', () => {
      const accurate = predictionBonus(0.5, 0.5);
      const inaccurate = predictionBonus(0.9, 0.5);
      expect(accurate).toBeGreaterThan(inaccurate);
    });
  });

  describe('Collusion Ring Test', () => {
    it('should detect and penalize 10-agent rating ring', async () => {
      // Setup: 10 agents all colluding to rate each other 100
      const colluders = new Map();
      for (let i = 0; i < 10; i++) {
        colluders.set(`agent-${i}`, {
          id: `agent-${i}`,
          integrityScore: 80,
          virtueScore: 70,
          totalReputation: 0,
          interactions: Array(9).fill(0).map((_, j) => `agent-${j !== i ? j : (j + 1) % 10}`)
        });
      }

      // All rate each other maximum
      const ratings = [];
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          if (i !== j) {
            ratings.push({
              raterId: `agent-${i}`,
              rateeId: `agent-${j}`,
              rating: 1.0,  // Maximum collusion
              prediction: 0.95,  // Predict everyone gives high ratings
              timestamp: Date.now()
            });
          }
        }
      }

      // RBTS should detect this and give low/zero payments
      const result = await updateVirtueRBTS('agent-0', colluders, ratings, 5);
      
      // Mean should still reflect some variance (not all 1.0)
      // Payments should be low for colluders who all predict wrong
      expect(result.meanRating).toBeLessThan(0.9);
    });

    it('should verify collusion resistance: <1% at 67% honest', () => {
      const manipulationProb = simulateCollusionAttack(0.67, 9, 3, 1000);
      expect(manipulationProb).toBeLessThan(0.01);
    });
  });

  describe('Domain Transfer', () => {
    it('should allow transfer for similar domains', () => {
      const vectors = new Map([
        ['code-review', [0.9, 0.8, 0.7, 0.1]],
        ['code-audit', [0.85, 0.75, 0.75, 0.15]]  // Similar
      ]);
      
      expect(canTransferReputation('code-review', 'code-audit', vectors, 0.7)).toBe(true);
    });

    it('should block transfer for dissimilar domains', () => {
      const vectors = new Map([
        ['code-review', [0.9, 0.8, 0.7, 0.1]],
        ['financial-advice', [0.1, 0.2, 0.1, 0.9]]  # Dissimilar
      ]);
      
      expect(canTransferReputation('code-review', 'financial-advice', vectors, 0.7)).toBe(false);
    });
  });

  describe('Total Reputation Calculation', () => {
    it('should weight integrity at 60% and virtue at 40%', () => {
      const agent = {
        id: 'test',
        integrityScore: 100,
        virtueScore: 0,
        totalReputation: 0,
        interactions: []
      };
      
      expect(calculateTotalReputation(agent)).toBe(60); // 0.6 * 100 + 0.4 * 0
      
      agent.virtueScore = 100;
      expect(calculateTotalReputation(agent)).toBe(100); // 0.6 * 100 + 0.4 * 100
    });
  });
});
