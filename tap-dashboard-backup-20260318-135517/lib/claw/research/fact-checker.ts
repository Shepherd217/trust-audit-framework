/**
 * Fact Checker
 * Automatic fact verification against multiple sources
 */

import { FactCheckResult, RawSource, Finding, Contradiction } from '@/types/research';

interface Claim {
  text: string;
  source: string;
  context?: string;
}

export class FactChecker {
  private similarityThreshold = 0.7;

  /**
   * Verify a claim against multiple sources
   */
  async checkClaim(claim: string, sources: RawSource[]): Promise<FactCheckResult> {
    const claimLower = claim.toLowerCase();
    const claimWords = this.extractKeyTerms(claim);
    
    const supporting: RawSource[] = [];
    const contradicting: RawSource[] = [];
    const neutral: RawSource[] = [];

    for (const source of sources) {
      const relevance = this.calculateRelevance(claimWords, source.content);
      
      if (relevance < 0.3) {
        neutral.push(source);
        continue;
      }

      const stance = this.determineStance(claim, source.content);
      
      if (stance > 0.3) {
        supporting.push(source);
      } else if (stance < -0.3) {
        contradicting.push(source);
      } else {
        neutral.push(source);
      }
    }

    // Calculate confidence based on evidence balance
    const totalEvidence = supporting.length + contradicting.length;
    if (totalEvidence === 0) {
      return {
        claim,
        verified: false,
        confidence: 0,
        findings: [],
        contradictions: [],
        sources: [],
        supportingSources: [],
        contradictingSources: [],
        explanation: 'Insufficient evidence found to verify claim',
      };
    }

    const supportRatio = supporting.length / totalEvidence;
    const contradictionRatio = contradicting.length / totalEvidence;
    
    let verified = false;
    let confidence = 0;
    let explanation = '';

    if (supportRatio > 0.7 && contradicting.length === 0) {
      verified = true;
      confidence = Math.min(100, 70 + supportRatio * 30);
      explanation = `Strong consensus: ${supporting.length} sources support this claim with no contradictions`;
    } else if (supportRatio > 0.5) {
      verified = true;
      confidence = Math.min(90, 50 + supportRatio * 40);
      explanation = `Moderate consensus: ${supporting.length} sources support, ${contradicting.length} contradict`;
    } else if (contradictionRatio > 0.5) {
      verified = false;
      confidence = Math.min(90, 50 + contradictionRatio * 40);
      explanation = `Claim appears incorrect: ${contradicting.length} sources contradict`;
    } else {
      verified = false;
      confidence = 30;
      explanation = `Mixed evidence: ${supporting.length} support, ${contradicting.length} contradict`;
    }

    // Adjust confidence by source credibility
    const avgSupportCred = this.avgCredibility(supporting);
    const avgContradictCred = this.avgCredibility(contradicting);
    
    if (verified) {
      confidence = confidence * (0.7 + avgSupportCred / 333);
    } else if (contradictionRatio > 0.5) {
      confidence = confidence * (0.7 + avgContradictCred / 333);
    }

    return {
      claim,
      verified,
      confidence: Math.round(confidence),
      findings: [],
      contradictions: [],
      sources: [],
      supportingSources: supporting.map(s => s.url!),
      contradictingSources: contradicting.map(s => s.url!),
      explanation,
    };
  }

  /**
   * Find contradictions between sources
   */
  findContradictions(findings: Finding[]): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const a = findings[i];
        const b = findings[j];

        const conflict = this.detectConflict(a.statement || '', b.statement || '');
        if (conflict.hasConflict) {
          contradictions.push({
            id: `contradiction_${i}_${j}`,
            claimA: a.statement,
            claimB: b.statement,
            sourceA: a.sources[0] || 'unknown',
            sourceB: b.sources[0] || 'unknown',
            severity: conflict.severity,
            resolution: conflict.suggestion,
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * Cross-reference findings with existing knowledge
   */
  async crossReference(
    findings: Finding[],
    knowledgeBase: Map<string, string>
  ): Promise<{
    confirmed: Finding[];
    updated: Finding[];
    novel: Finding[];
  }> {
    const confirmed: Finding[] = [];
    const updated: Finding[] = [];
    const novel: Finding[] = [];

    for (const finding of findings) {
      const relatedKnowledge = this.findRelatedKnowledge(finding, knowledgeBase);
      
      if (relatedKnowledge.length === 0) {
        novel.push(finding);
        continue;
      }

      let hasConfirmation = false;
      let hasConflict = false;

      for (const knowledge of relatedKnowledge) {
        const similarity = this.textSimilarity(finding.statement || '', knowledge || '');
        if (similarity > 0.8) {
          hasConfirmation = true;
        } else if (similarity > 0.3) {
          const conflict = this.detectConflict(finding.statement || '', knowledge || '');
          if (conflict.hasConflict) {
            hasConflict = true;
          }
        }
      }

      if (hasConfirmation && !hasConflict) {
        confirmed.push(finding);
      } else if (hasConflict) {
        updated.push({
          ...finding,
          confidence: Math.max(0, finding.confidence - 20),
        });
      } else {
        novel.push(finding);
      }
    }

    return { confirmed, updated, novel };
  }

  /**
   * Calculate semantic similarity between texts
   */
  private textSimilarity(a: string, b: string): number {
    const aWords = new Set(this.extractKeyTerms(a));
    const bWords = new Set(this.extractKeyTerms(b));
    
    const intersection = [...aWords].filter(w => bWords.has(w));
    const union = new Set([...aWords, ...bWords]);
    
    return intersection.length / union.size;
  }

  private calculateRelevance(queryTerms: string[], content: string): number {
    const contentWords = new Set(this.extractKeyTerms(content));
    const matches = queryTerms.filter(t => contentWords.has(t));
    return matches.length / queryTerms.length;
  }

  private determineStance(claim: string, content: string): number {
    const claimLower = claim.toLowerCase();
    const contentLower = content.toLowerCase();

    // Direct affirmation/negation patterns
    const affirmations = [
      'yes', 'true', 'correct', 'confirmed', 'agree', 'support',
      'evidence shows', 'study found', 'research indicates',
    ];
    
    const negations = [
      'no', 'false', 'incorrect', 'denied', 'disagree', 'refute',
      'evidence does not show', 'study found no', 'contradicts',
      'myth', 'misconception', 'not true',
    ];

    let affirmScore = 0;
    let negateScore = 0;

    for (const term of affirmations) {
      if (contentLower.includes(term)) affirmScore++;
    }

    for (const term of negations) {
      if (contentLower.includes(term)) negateScore++;
    }

    // Check if claim appears in content
    if (contentLower.includes(claimLower)) {
      affirmScore += 2;
    }

    // Check for negated claim
    const negatedClaim = claimLower
      .replace(/\bis\b/g, 'is not')
      .replace(/\bare\b/g, 'are not')
      .replace(/\bwas\b/g, 'was not');
    
    if (contentLower.includes(negatedClaim)) {
      negateScore += 3;
    }

    return (affirmScore - negateScore) / Math.max(affirmScore + negateScore, 1);
  }

  private detectConflict(
    statementA: string,
    statementB: string
  ): { hasConflict: boolean; severity: 'low' | 'medium' | 'high'; suggestion?: string } {
    const aLower = statementA.toLowerCase();
    const bLower = statementB.toLowerCase();

    // Direct negation check
    const negators = ['not', 'no ', 'never', 'false', 'incorrect'];
    const aHasNegation = negators.some(n => aLower.includes(n));
    const bHasNegation = negators.some(n => bLower.includes(n));

    if (aHasNegation !== bHasNegation) {
      // One negates, other affirms - check if same subject
      const similarity = this.textSimilarity(statementA, statementB);
      if (similarity > 0.5) {
        return {
          hasConflict: true,
          severity: 'high',
          suggestion: 'Direct contradiction detected - verify primary source',
        };
      }
    }

    // Numerical contradiction check
    const aNumbers = this.extractNumbers(statementA);
    const bNumbers = this.extractNumbers(statementB);
    
    for (const [key, aVal] of Object.entries(aNumbers)) {
      const bVal = bNumbers[key];
      if (bVal !== undefined && Math.abs(aVal - bVal) / Math.max(aVal, bVal) > 0.2) {
        return {
          hasConflict: true,
          severity: 'medium',
          suggestion: `Numerical discrepancy: ${aVal} vs ${bVal}`,
        };
      }
    }

    return { hasConflict: false, severity: 'low' };
  }

  private extractKeyTerms(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3)
      .filter(w => !this.isStopWord(w));
  }

  private extractNumbers(text: string): Record<string, number> {
    const numbers: Record<string, number> = {};
    const regex = /(\d+(?:\.\d+)?)\s*(%|percent|million|billion|thousand)?/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      const unit = match[2] || 'count';
      numbers[`${unit}_${match.index}`] = value;
    }
    
    return numbers;
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
      'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day',
      'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now',
      'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'she',
      'use', 'her', 'way', 'many', 'oil', 'sit', 'set', 'run',
      'eat', 'far', 'sea', 'eye', 'ask', 'own', 'say', 'too',
      'any', 'try', 'let', 'put', 'end', 'why', 'turn', 'here',
      'show', 'every', 'good', 'give', 'most', 'very', 'when',
      'much', 'would', 'there', 'their', 'what', 'your',
    ]);
    return stopWords.has(word);
  }

  private avgCredibility(sources: RawSource[]): number {
    if (sources.length === 0) return 50;
    const sum = sources.reduce((acc, s) => {
      const credibility = s.metadata?.credibility as number | undefined;
      return acc + (typeof credibility === 'number' ? credibility : 50);
    }, 0);
    return sum / sources.length;
  }

  private findRelatedKnowledge(
    finding: Finding,
    knowledgeBase: Map<string, string>
  ): string[] {
    const related: string[] = [];
    const findingTerms = new Set(this.extractKeyTerms(finding.statement || ''));

    for (const [, knowledge] of knowledgeBase) {
      const knowledgeTerms = new Set(this.extractKeyTerms(knowledge));
      const overlap = [...findingTerms].filter(t => knowledgeTerms.has(t));
      
      if (overlap.length / Math.max(findingTerms.size, knowledgeTerms.size) > 0.3) {
        related.push(knowledge);
      }
    }

    return related;
  }
}

// Singleton instance
export const factChecker = new FactChecker();
