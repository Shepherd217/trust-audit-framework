import { describe, it, expect } from '@jest/globals';
import { classifyDispute } from '../lib/classification';

describe('Dispute Classification', () => {
  describe('Category Detection', () => {
    it('should classify software disputes correctly', () => {
      const result = classifyDispute({
        description: 'Bug fix in the payment processing module. The API endpoint is returning 500 errors.',
        evidenceTypes: ['automated_test', 'error_logs'],
        stakeholderCount: 2
      });
      
      expect(result.primaryCategory).toBe('software');
      expect(result.classificationConfidence).toBeGreaterThan(0.5);
    });

    it('should classify infrastructure disputes correctly', () => {
      const result = classifyDispute({
        description: 'Deployment failed on AWS ECS. Container keeps restarting. Need to fix the CI/CD pipeline.',
        evidenceTypes: ['deployment_logs', 'metrics'],
        stakeholderCount: 3
      });
      
      expect(result.primaryCategory).toBe('infrastructure');
    });

    it('should classify data/analytics disputes correctly', () => {
      const result = classifyDispute({
        description: 'Dataset has 30% null values in the user_id column. ML model performance degraded.',
        evidenceTypes: ['dataset_profiling', 'sql_queries'],
        stakeholderCount: 2
      });
      
      expect(result.primaryCategory).toBe('data_analytics');
    });

    it('should classify creative disputes correctly', () => {
      const result = classifyDispute({
        description: 'Logo design does not match brand guidelines. Client rejected the visual style.',
        evidenceTypes: ['design_files', 'brand_guidelines'],
        stakeholderCount: 2
      });
      
      expect(result.primaryCategory).toBe('creative');
    });

    it('should classify research disputes correctly', () => {
      const result = classifyDispute({
        description: 'Market analysis methodology was flawed. Sources were not properly verified.',
        evidenceTypes: ['sources', 'methodology_docs'],
        stakeholderCount: 2
      });
      
      expect(result.primaryCategory).toBe('research');
    });

    it('should classify administrative disputes correctly', () => {
      const result = classifyDispute({
        description: 'Data entry had 5% error rate. Scheduling conflicts caused missed deadlines.',
        evidenceTypes: ['error_logs', 'scheduling_records'],
        stakeholderCount: 2
      });
      
      expect(result.primaryCategory).toBe('administrative');
    });
  });

  describe('Difficulty Rating', () => {
    it('should rate simple disputes low (1-2)', () => {
      const result = classifyDispute({
        description: 'Simple bug fix with clear reproduction steps and automated test.',
        evidenceTypes: ['automated_test'],
        stakeholderCount: 1,
        hasAutomatedTests: true,
        hasClearAcceptanceCriteria: true
      });
      
      expect(result.difficultyRating).toBeLessThanOrEqual(2);
    });

    it('should rate complex disputes high (4-5)', () => {
      const result = classifyDispute({
        description: 'Ambiguous creative brief with subjective evaluation. Multiple stakeholders with conflicting requirements.',
        evidenceTypes: ['subjective_assessment', 'testimonials'],
        stakeholderCount: 8,
        hasAutomatedTests: false,
        hasClearAcceptanceCriteria: false
      });
      
      expect(result.difficultyRating).toBeGreaterThanOrEqual(4);
    });

    it('should factor in evidence objectivity', () => {
      const objective = classifyDispute({
        description: 'Code review dispute',
        evidenceTypes: ['automated_test', 'ci_cd_logs', 'git_commits'],
        stakeholderCount: 2
      });

      const subjective = classifyDispute({
        description: 'Code review dispute',
        evidenceTypes: ['testimonials', 'subjective_assessment'],
        stakeholderCount: 2
      });

      expect(objective.evidenceObjectivity).toBeGreaterThan(subjective.evidenceObjectivity);
      expect(objective.difficultyRating).toBeLessThanOrEqual(subjective.difficultyRating);
    });

    it('should factor in stakeholder count', () => {
      const fewStakeholders = classifyDispute({
        description: 'Standard feature implementation',
        evidenceTypes: ['automated_test'],
        stakeholderCount: 2
      });

      const manyStakeholders = classifyDispute({
        description: 'Standard feature implementation',
        evidenceTypes: ['automated_test'],
        stakeholderCount: 10
      });

      expect(manyStakeholders.difficultyRating).toBeGreaterThanOrEqual(fewStakeholders.difficultyRating);
    });
  });

  describe('Complexity Dimensions', () => {
    it('should detect high domain expertise requirement', () => {
      const result = classifyDispute({
        description: 'Smart contract vulnerability in DeFi protocol requires security audit and cryptographic review.',
        evidenceTypes: ['audit_report', 'security_scan']
      });

      expect(result.domainExpertiseRequired).toBeGreaterThan(0.5);
    });

    it('should detect specification clarity', () => {
      const clear = classifyDispute({
        description: 'Feature with acceptance criteria and test cases defined in PRD.',
        evidenceTypes: ['documentation'],
        hasClearAcceptanceCriteria: true
      });

      const unclear = classifyDispute({
        description: 'Unclear requirements that are ambiguous and TBD.',
        evidenceTypes: [],
        hasClearAcceptanceCriteria: false
      });

      expect(clear.specificationClarity).toBeGreaterThan(unclear.specificationClarity);
    });

    it('should determine coordination complexity', () => {
      const single = classifyDispute({
        description: 'Single developer task',
        evidenceTypes: [],
        stakeholderCount: 1,
        taskSteps: 1
      });

      const dynamic = classifyDispute({
        description: 'Multi-team project',
        evidenceTypes: [],
        stakeholderCount: 10,
        taskSteps: 15
      });

      expect(single.coordinationComplexity).toBe('single');
      expect(dynamic.coordinationComplexity).toBe('dynamic');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty description gracefully', () => {
      const result = classifyDispute({
        description: '',
        evidenceTypes: []
      });

      expect(result.primaryCategory).toBeDefined();
      expect(result.difficultyRating).toBeGreaterThanOrEqual(1);
      expect(result.difficultyRating).toBeLessThanOrEqual(5);
    });

    it('should handle mixed category signals', () => {
      const result = classifyDispute({
        description: 'Code deployment with data analysis pipeline. Bug in the infrastructure affecting ML metrics.',
        evidenceTypes: ['logs', 'metrics', 'git_commits']
      });

      // Should pick one primary but both have some score
      expect(result.primaryCategory).toBeDefined();
      expect(result.classificationConfidence).toBeGreaterThan(0);
    });

    it('should cap difficulty at 5', () => {
      const result = classifyDispute({
        description: 'Extremely ambiguous subjective creative task with many stakeholders, no tests, unclear requirements',
        evidenceTypes: ['subjective_assessment'],
        stakeholderCount: 20,
        hasAutomatedTests: false,
        hasClearAcceptanceCriteria: false
      });

      expect(result.difficultyRating).toBeLessThanOrEqual(5);
    });

    it('should floor difficulty at 1', () => {
      const result = classifyDispute({
        description: 'Clear objective task',
        evidenceTypes: ['automated_test'],
        stakeholderCount: 1,
        hasAutomatedTests: true,
        hasClearAcceptanceCriteria: true
      });

      expect(result.difficultyRating).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cross-Category Disputes', () => {
    it('should identify infrastructure-security disputes', () => {
      const result = classifyDispute({
        description: 'Security hardening for cloud infrastructure. Compliance audit failed.',
        evidenceTypes: ['audit_report', 'security_scan', 'cloud_config']
      });

      // Should lean toward infrastructure due to keywords
      expect(['infrastructure', 'software']).toContain(result.primaryCategory);
    });

    it('should identify data-ML disputes', () => {
      const result = classifyDispute({
        description: 'ML model training failed. Dataset preprocessing errors.',
        evidenceTypes: ['dataset', 'model_logs']
      });

      expect(result.primaryCategory).toBe('data_analytics');
    });
  });
});
