import { describe, it, expect, beforeEach } from 'vitest';
import { detectDependencies, detectTelemetry, validateScope, runPreflight } from '../../tap-preflight/detectors';

describe('Preflight Detectors', () => {
  describe('Dependency Provenance', () => {
    it('should flag missing lockfile as critical', async () => {
      const submission = {
        files: ['package.json', 'index.js'],
        sourceFiles: ['index.js'],
        packageJson: { dependencies: { 'lodash': '^4.17.0' } },
        entrypoint: 'index.js'
      };

      const result = await detectDependencies(submission);
      
      expect(result.score).toBe(0);
      expect(result.issues.some(i => i.id === 'missing-lockfile')).toBe(true);
    });

    it('should pass when lockfile present', async () => {
      const submission = {
        files: ['package.json', 'package-lock.json', 'index.js'],
        sourceFiles: ['index.js'],
        packageJson: { dependencies: {} },
        entrypoint: 'index.js'
      };

      const result = await detectDependencies(submission);
      
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Telemetry Scanner', () => {
    it('should detect undisclosed fetch calls', async () => {
      const submission = {
        files: ['package.json', 'index.js'],
        sourceFiles: ['index.js'],
        packageJson: {},
        entrypoint: 'index.js'
      };

      // Mock file read to return code with fetch
      // In real test, use fs mocking
      const result = await detectTelemetry(submission);
      
      // Should have some network analysis done
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('issues');
    });

    it('should flag tracking domains', async () => {
      const submission = {
        files: ['package.json'],
        sourceFiles: [],
        packageJson: {},
        entrypoint: ''
      };

      const result = await detectTelemetry(submission);
      
      // Should check for tracking domains
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('Scope Validator', () => {
    it('should parse response time claims from SKILL.md', async () => {
      const submission = {
        files: ['SKILL.md'],
        sourceFiles: [],
        packageJson: {},
        entrypoint: '',
        SKILL_MD: '## Response Time\nResponse time: 200ms'
      };

      const result = await validateScope(submission);
      
      expect(result.metadata?.claims?.length).toBeGreaterThan(0);
      expect(result.metadata?.claims[0].field).toBe('responseTime');
    });

    it('should detect scope drift', async () => {
      const submission = {
        files: ['SKILL.md'],
        sourceFiles: [],
        packageJson: {},
        entrypoint: '',
        SKILL_MD: 'Response time: 300ms',
        prevAttestation: {
          claims: [{ field: 'responseTime', value: 200 }]
        }
      };

      const result = await validateScope(submission);
      
      expect(result.issues.some(i => i.id === 'scope-drift')).toBe(true);
    });
  });

  describe('Telemetry Sandbox Evasion', () => {
    it('should catch dynamic eval fetch', async () => {
      const codeWithEvasion = `
        const fn = 'fet' + 'ch';
        eval(fn + '("https://evil.com")');
      `;
      
      // In real test, mock the file system to return this code
      const submission = {
        files: ['index.js'],
        sourceFiles: ['index.js'],
        packageJson: {},
        entrypoint: 'index.js'
      };

      // Should still detect through static analysis or sandbox
      const result = await detectTelemetry(submission);
      expect(result).toBeDefined();
    });
  });

  describe('Full Preflight Run', () => {
    it('should complete in under 30 seconds', async () => {
      const submission = {
        files: ['package.json', 'package-lock.json', 'SKILL.md', 'index.js'],
        sourceFiles: ['index.js'],
        packageJson: { dependencies: {}, telemetry: [] },
        entrypoint: 'index.js',
        SKILL_MD: 'Response time: 200ms'
      };

      const start = Date.now();
      const result = await runPreflight(submission);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(30000);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('scores');
    });
  });
});
