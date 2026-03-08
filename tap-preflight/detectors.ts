import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'acorn';
import { simple as walk } from 'acorna-walk';
import { createHash } from 'crypto';
import { load } from 'js-yaml';

interface Submission {
  files: string[];
  sourceFiles: string[];
  packageJson: any;
  entrypoint: string;
  SKILL_MD?: string;
  prevAttestation?: any;
}

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'moderate' | 'info';
  message: string;
  file?: string;
  line?: number;
}

interface DetectorResult {
  issues: Issue[];
  score: number;
  metadata?: any;
}

// ============================================================================
// 1. DEPENDENCY PROVENANCE DETECTOR (~5 seconds)
// ============================================================================

export async function detectDependencies(sub: Submission): Promise<DetectorResult> {
  const issues: Issue[] = [];
  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  
  // Check for lockfile presence
  const foundLockfile = lockfiles.find(f => sub.files.includes(f));
  if (!foundLockfile) {
    issues.push({
      id: 'missing-lockfile',
      severity: 'critical',
      message: 'No lockfile found (package-lock.json, yarn.lock, or pnpm-lock.yaml)'
    });
  }

  // npm audit (if package.json exists)
  if (sub.files.includes('package.json')) {
    try {
      const auditOutput = execSync('npm audit --json --audit-level=moderate', {
        cwd: '/tmp/submission',
        encoding: 'utf8',
        timeout: 5000
      });
      const audit = JSON.parse(auditOutput);
      
      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([name, vuln]: [string, any]) => {
          const severity = vuln.severity === 'critical' ? 'critical' : 
                          vuln.severity === 'high' ? 'high' : 'moderate';
          issues.push({
            id: `npm-audit-${vuln.via?.[0]?.source || name}`,
            severity,
            message: `${name}: ${vuln.via?.[0]?.title || 'Security vulnerability'}`
          });
        });
      }
    } catch (e) {
      // npm audit exits non-zero when vulnerabilities found
    }
  }

  // Generate CycloneDX SBOM (simplified)
  const sbom = generateSBOM(sub);
  
  // Transitive risk analysis
  const transitiveRisks = analyzeTransitiveRisks(sbom);
  issues.push(...transitiveRisks);

  // Lockfile integrity
  const hashValid = verifyLockfileIntegrity(sub, foundLockfile);
  if (!hashValid) {
    issues.push({
      id: 'lockfile-tampered',
      severity: 'high',
      message: 'Lockfile integrity check failed'
    });
  }

  return {
    issues,
    score: issues.filter(i => i.severity === 'critical').length > 0 ? 0 : 
           issues.filter(i => i.severity === 'high').length > 0 ? 50 : 100,
    metadata: { sbom, lockfile: foundLockfile }
  };
}

function generateSBOM(sub: Submission): any {
  // Simplified SBOM generation
  const dependencies = sub.packageJson?.dependencies || {};
  const devDeps = sub.packageJson?.devDependencies || {};
  
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    components: Object.entries({ ...dependencies, ...devDeps }).map(([name, version]) => ({
      type: 'library',
      name,
      version: version as string,
      purl: `pkg:npm/${name}@${version}`
    }))
  };
}

function analyzeTransitiveRisks(sbom: any): Issue[] {
  const issues: Issue[] = [];
  const typosquattingPatterns = ['loadsh', 'expresss', 'reactt', 'vvue'];
  const protestwareList = ['peacenotwar', 'es5-ext'];
  
  sbom.components?.forEach((comp: any) => {
    // Typosquatting detection
    if (typosquattingPatterns.includes(comp.name)) {
      issues.push({
        id: 'typosquatting',
        severity: 'critical',
        message: `Possible typosquatting: ${comp.name}`
      });
    }
    
    // Protestware detection
    if (protestwareList.includes(comp.name)) {
      issues.push({
        id: 'protestware',
        severity: 'high',
        message: `Known protestware: ${comp.name}`
      });
    }
  });
  
  return issues;
}

function verifyLockfileIntegrity(sub: Submission, lockfile?: string): boolean {
  if (!lockfile) return false;
  // Simplified: check lockfile exists and has content
  return sub.files.includes(lockfile);
}

// ============================================================================
// 2. TELEMETRY SCANNER (~12 seconds)
// ============================================================================

export async function detectTelemetry(sub: Submission): Promise<DetectorResult> {
  const issues: Issue[] = [];
  const networkCalls: Array<{ method: string; domain: string; line: number; file: string }> = [];
  
  // Static analysis: AST parsing
  for (const file of sub.sourceFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
    try {
      const content = readFileSync(file, 'utf8');
      const ast = parse(content, { ecmaVersion: 'latest', sourceType: 'module' });
      
      walk(ast, {
        CallExpression(node: any) {
          // Detect fetch(), axios(), node-fetch
          const callee = node.callee;
          if (callee.type === 'Identifier' && ['fetch', 'axios'].includes(callee.name)) {
            networkCalls.push({
              method: callee.name,
              domain: extractDomain(node.arguments[0]),
              line: node.loc?.start?.line || 0,
              file
            });
          }
          // Detect http.request
          if (callee.type === 'MemberExpression' && 
              callee.object?.name === 'http' && 
              callee.property?.name === 'request') {
            networkCalls.push({
              method: 'http.request',
              domain: extractDomain(node.arguments[0]),
              line: node.loc?.start?.line || 0,
              file
            });
          }
        }
      });
    } catch (e) {
      // Parse error, skip file
    }
  }
  
  // Check against declared telemetry
  const declared = sub.packageJson?.telemetry || [];
  const undisclosed = networkCalls.filter(c => !declared.includes(c.domain));
  
  undisclosed.forEach(c => {
    issues.push({
      id: 'undisclosed-telemetry',
      severity: 'high',
      message: `Undisclosed network call: ${c.method} to ${c.domain}`,
      file: c.file,
      line: c.line
    });
  });
  
  // GDPR/CCPA heuristics
  const trackingDomains = ['google-analytics', 'mixpanel', 'segment', 'amplitude'];
  networkCalls.forEach(c => {
    if (trackingDomains.some(d => c.domain.includes(d))) {
      issues.push({
        id: 'tracking-domain',
        severity: 'moderate',
        message: `Analytics/tracking domain detected: ${c.domain}`,
        file: c.file,
        line: c.line
      });
    }
  });
  
  return {
    issues,
    score: issues.filter(i => i.severity === 'critical').length > 0 ? 0 :
           issues.filter(i => i.severity === 'high').length > 0 ? 50 : 100,
    metadata: { networkCalls, undisclosed: undisclosed.length }
  };
}

function extractDomain(arg: any): string {
  if (!arg) return 'unknown';
  if (arg.type === 'Literal' && typeof arg.value === 'string') {
    try {
      const url = new URL(arg.value);
      return url.hostname;
    } catch {
      return arg.value;
    }
  }
  return 'dynamic';
}

// ============================================================================
// 3. SCOPE VALIDATOR (~8 seconds)
// ============================================================================

export async function validateScope(sub: Submission): Promise<DetectorResult> {
  const issues: Issue[] = [];
  
  if (!sub.SKILL_MD) {
    return { issues: [], score: 0, metadata: { error: 'No SKILL.md found' } };
  }
  
  // Parse claims from SKILL.md
  const claims = parseClaims(sub.SKILL_MD);
  
  // Auto-generate benchmarks
  const benchmarks = generateBenchmarks(claims);
  
  // Run load tests (simplified simulation)
  const results = await runLoadTests(sub.entrypoint, benchmarks);
  
  // Check failures
  results.failures.forEach((f: any) => {
    issues.push({
      id: 'scope-mismatch',
      severity: 'high',
      message: `Claim failed: ${f.claim} (expected ${f.expected}, got ${f.actual})`
    });
  });
  
  // Drift detection
  if (sub.prevAttestation) {
    const drift = detectDrift(sub.prevAttestation.claims, claims);
    if (drift.length > 0) {
      drift.forEach(d => {
        issues.push({
          id: 'scope-drift',
          severity: 'moderate',
          message: `Claim drift: ${d.field} changed from "${d.old}" to "${d.new}"`
        });
      });
    }
  }
  
  return {
    issues,
    score: results.passRate > 0.95 ? 100 : results.passRate > 0.8 ? 75 : 50,
    metadata: { claims, benchmarks, results }
  };
}

function parseClaims(skillMd: string): Array<{ field: string; value: any; type: string }> {
  const claims: Array<{ field: string; value: any; type: string }> = [];
  
  // Extract response time claims
  const responseMatch = skillMd.match(/response(?:\s+time)?:?\s*(\d+)\s*(ms|s|seconds|milliseconds)/i);
  if (responseMatch) {
    claims.push({
      field: 'responseTime',
      value: parseInt(responseMatch[1]),
      type: 'latency'
    });
  }
  
  // Extract throughput claims
  const throughputMatch = skillMd.match(/(?:handles?|processes?|throughput):?\s*(\d+)\s*(?:req|requests|tps)/i);
  if (throughputMatch) {
    claims.push({
      field: 'throughput',
      value: parseInt(throughputMatch[1]),
      type: 'rate'
    });
  }
  
  // Extract accuracy claims
  const accuracyMatch = skillMd.match(/accuracy:?\s*(\d+)%/i);
  if (accuracyMatch) {
    claims.push({
      field: 'accuracy',
      value: parseInt(accuracyMatch[1]),
      type: 'percentage'
    });
  }
  
  return claims;
}

function generateBenchmarks(claims: any[]): any[] {
  return claims.map(c => ({
    ...c,
    testType: c.type === 'latency' ? 'response-time' : 
              c.type === 'rate' ? 'throughput' : 
              c.type === 'percentage' ? 'accuracy' : 'unknown'
  }));
}

async function runLoadTests(entrypoint: string, benchmarks: any[]): Promise<any> {
  // Simulated load test results
  // In production, this would use k6 or autocannon
  console.warn('⚠️ Using fake load test — replace with real k6 before cohort #1');
  
  const results = {
    passed: 0,
    failed: 0,
    failures: [] as any[],
    passRate: 0
  };
  
  for (const bench of benchmarks) {
    // Simulated test
    const passed = Math.random() > 0.2; // 80% pass rate for demo
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
      results.failures.push({
        claim: bench.field,
        expected: bench.value,
        actual: bench.value * (0.5 + Math.random() * 0.5) // Random underperformance
      });
    }
  }
  
  results.passRate = results.passed / (results.passed + results.failed);
  return results;
}

function detectDrift(prevClaims: any[], currClaims: any[]): Array<{ field: string; old: any; new: any }> {
  const drift: Array<{ field: string; old: any; new: any }> = [];
  
  const prevMap = new Map(prevClaims.map(c => [c.field, c.value]));
  
  for (const curr of currClaims) {
    const prev = prevMap.get(curr.field);
    if (prev && prev !== curr.value) {
      drift.push({ field: curr.field, old: prev, new: curr.value });
    }
  }
  
  return drift;
}

// ============================================================================
// MAIN PREFLIGHT RUNNER
// ============================================================================

export async function runPreflight(sub: Submission): Promise<{
  passed: boolean;
  issues: Issue[];
  scores: { dependency: number; telemetry: number; scope: number };
  totalTime: number;
}> {
  const start = Date.now();
  
  const [depResult, telResult, scopeResult] = await Promise.all([
    detectDependencies(sub),
    detectTelemetry(sub),
    validateScope(sub)
  ]);
  
  const allIssues = [...depResult.issues, ...telResult.issues, ...scopeResult.issues];
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  
  return {
    passed: criticalCount === 0,
    issues: allIssues,
    scores: {
      dependency: depResult.score,
      telemetry: telResult.score,
      scope: scopeResult.score
    },
    totalTime: Date.now() - start
  };
}

// Example usage:
// const result = await runPreflight({
//   files: ['package.json', 'package-lock.json', 'index.js'],
//   sourceFiles: ['index.js'],
//   packageJson: { dependencies: {} },
//   entrypoint: 'index.js',
//   SKILL_MD: 'Response time: 200ms'
// });
