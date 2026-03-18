/**
 * Research Memory
 * Persistent knowledge base that builds over time
 */

import { ResearchMemory, ResearchJob, Finding, Citation } from '@/types/research';

interface MemoryEntry {
  id: string;
  query: string;
  normalizedQuery: string;
  findings: MemoryFinding[];
  citations: MemoryCitation[];
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
  relatedEntries: string[];
  agentId?: string;
}

interface MemoryFinding {
  statement: string;
  confidence: number;
  sources: string[];
  category?: string;
}

interface MemoryCitation {
  url: string;
  title: string;
  credibility: number;
}

export class ResearchMemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private queryIndex: Map<string, string[]> = new Map(); // normalized query -> entry IDs

  /**
   * Store research results in memory
   */
  store(job: ResearchJob): void {
    const normalizedQuery = this.normalizeQuery(job.query);
    
    const entry: MemoryEntry = {
      id: job.id,
      query: job.query,
      normalizedQuery,
      findings: job.result?.keyFindings?.map((f: any) => ({
        statement: f.statement,
        confidence: f.confidence,
        sources: f.sources,
        category: f.category,
      })) || [],
      citations: job.result?.citations?.map((c: any) => ({
        url: c.url,
        title: c.title,
        credibility: c.credibilityScore,
      })) || [],
      timestamp: job.createdAt,
      accessCount: 0,
      lastAccessed: job.createdAt,
      tags: this.extractTags(job),
      relatedEntries: [],
      agentId: job.metadata?.agentId as string | undefined,
    };

    this.entries.set(job.id, entry);
    
    // Update index
    const existing = this.queryIndex.get(normalizedQuery) || [];
    existing.push(job.id);
    this.queryIndex.set(normalizedQuery, existing);

    // Find related entries
    this.updateRelationships(entry);
  }

  /**
   * Search memory for relevant past research
   */
  search(query: string, limit: number = 5): ResearchMemory[] {
    const normalizedQuery = this.normalizeQuery(query);
    const queryTerms = normalizedQuery.split(/\s+/);
    
    const scored = Array.from(this.entries.values()).map(entry => ({
      entry,
      score: this.scoreRelevance(entry, queryTerms, normalizedQuery),
    }));

    return scored
      .filter(({ score }) => score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => this.toResearchMemory(entry));
  }

  /**
   * Get memory entry by ID
   */
  get(id: string): ResearchMemory | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    
    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    return this.toResearchMemory(entry);
  }

  /**
   * Find related queries
   */
  findRelated(query: string, limit: number = 5): string[] {
    const normalizedQuery = this.normalizeQuery(query);
    const queryTerms = new Set(normalizedQuery.split(/\s+/));
    
    const scored: { query: string; score: number }[] = [];
    
    for (const [storedQuery, entryIds] of this.queryIndex) {
      if (storedQuery === normalizedQuery) continue;
      
      const storedTerms = new Set(storedQuery.split(/\s+/));
      const intersection = [...queryTerms].filter(t => storedTerms.has(t));
      const union = new Set([...queryTerms, ...storedTerms]);
      
      const similarity = intersection.length / union.size;
      if (similarity > 0.3) {
        // Get the most recent entry for this query
        const latestEntry = entryIds
          .map(id => this.entries.get(id))
          .filter(Boolean)
          .sort((a, b) => b!.timestamp.getTime() - a!.timestamp.getTime())[0];
        
        if (latestEntry) {
          scored.push({ query: latestEntry.query, score: similarity });
        }
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.query);
  }

  /**
   * Get trending topics from memory
   */
  getTrending(days: number = 7, limit: number = 10): { topic: string; count: number }[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const topicCounts = new Map<string, number>();

    for (const entry of this.entries.values()) {
      if (entry.timestamp < cutoff) continue;
      
      for (const tag of entry.tags) {
        topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
      }
    }

    return [...topicCounts.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get knowledge gaps for a query
   */
  getKnowledgeGaps(query: string): string[] {
    const normalizedQuery = this.normalizeQuery(query);
    const relatedEntries = this.search(query, 10);
    
    const allFindings = new Set<string>();
    for (const entry of relatedEntries) {
      for (const finding of entry.findings as string[]) {
        allFindings.add(finding.toLowerCase());
      }
    }

    const gaps: string[] = [];
    const commonSubtopics = this.extractSubtopics(query);
    
    for (const subtopic of commonSubtopics) {
      const hasCoverage = [...allFindings].some(f => 
        f.toLowerCase().includes(subtopic.toLowerCase())
      );
      if (!hasCoverage) {
        gaps.push(subtopic);
      }
    }

    return gaps;
  }

  /**
   * Consolidate duplicate findings across entries
   */
  consolidate(): void {
    const findingMap = new Map<string, string[]>(); // normalized finding -> entry IDs

    for (const entry of this.entries.values()) {
      for (const finding of entry.findings) {
        const normalized = this.normalizeQuery(finding.statement);
        const existing = findingMap.get(normalized) || [];
        existing.push(entry.id);
        findingMap.set(normalized, existing);
      }
    }

    // Merge entries with highly similar findings
    for (const [normalizedFinding, entryIds] of findingMap) {
      if (entryIds.length > 1) {
        // Boost confidence for consensus findings
        for (const entryId of entryIds) {
          const entry = this.entries.get(entryId);
          if (entry) {
            const finding = entry.findings.find(f => 
              this.normalizeQuery(f.statement) === normalizedFinding
            );
            if (finding) {
              finding.confidence = Math.min(100, finding.confidence + 10);
            }
          }
        }
      }
    }
  }

  /**
   * Get stats about the memory store
   */
  getStats(): {
    totalEntries: number;
    totalFindings: number;
    totalCitations: number;
    topTags: { tag: string; count: number }[];
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let totalFindings = 0;
    let totalCitations = 0;
    const tagCounts = new Map<string, number>();
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    for (const entry of this.entries.values()) {
      totalFindings += entry.findings.length;
      totalCitations += entry.citations.length;
      
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    const topTags = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries: this.entries.size,
      totalFindings,
      totalCitations,
      topTags,
      oldestEntry,
      newestEntry,
    };
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTags(job: ResearchJob): string[] {
    const tags = new Set<string>();
    const queryWords = job.query.toLowerCase().split(/\s+/);
    
    // Extract meaningful keywords
    for (const word of queryWords) {
      if (word.length >= 4 && !this.isStopWord(word)) {
        tags.add(word);
      }
    }

    // Add depth as tag
    if (job.depth !== undefined) {
      tags.add(String(job.depth));
    }

    return [...tags];
  }

  private extractSubtopics(query: string): string[] {
    // Common subtopics to check for coverage
    const commonPatterns = [
      'history', 'future', 'trends', 'market', 'technology',
      'applications', 'challenges', 'benefits', 'risks', 'regulation',
      'comparison', 'alternatives', 'best practices', 'case studies',
    ];

    return commonPatterns.filter(p => 
      !query.toLowerCase().includes(p)
    );
  }

  private updateRelationships(entry: MemoryEntry): void {
    for (const [id, otherEntry] of this.entries) {
      if (id === entry.id) continue;
      
      const similarity = this.calculateEntrySimilarity(entry, otherEntry);
      if (similarity > 0.6) {
        entry.relatedEntries.push(id);
        otherEntry.relatedEntries.push(entry.id);
      }
    }
  }

  private calculateEntrySimilarity(a: MemoryEntry, b: MemoryEntry): number {
    const aTerms = new Set(a.normalizedQuery.split(/\s+/));
    const bTerms = new Set(b.normalizedQuery.split(/\s+/));
    
    const intersection = [...aTerms].filter(t => bTerms.has(t));
    const union = new Set([...aTerms, ...bTerms]);
    
    return intersection.length / union.size;
  }

  private scoreRelevance(
    entry: MemoryEntry,
    queryTerms: string[],
    normalizedQuery: string
  ): number {
    let score = 0;

    // Query similarity
    const entryTerms = new Set(entry.normalizedQuery.split(/\s+/));
    const matchingTerms = queryTerms.filter(t => entryTerms.has(t));
    score += matchingTerms.length / queryTerms.length * 50;

    // Exact match bonus
    if (entry.normalizedQuery.includes(normalizedQuery)) {
      score += 30;
    }

    // Tag overlap
    const queryTermSet = new Set(queryTerms);
    const tagOverlap = entry.tags.filter(t => queryTermSet.has(t));
    score += tagOverlap.length * 5;

    // Recency weighting
    const age = Date.now() - entry.timestamp.getTime();
    const days = age / (24 * 60 * 60 * 1000);
    score *= Math.max(0.5, 1 - days / 90); // Decay over 90 days

    // Popularity weighting
    score *= (1 + entry.accessCount * 0.05);

    return score;
  }

  private toResearchMemory(entry: MemoryEntry): ResearchMemory {
    return {
      id: entry.id,
      query: entry.query,
      findings: entry.findings.map(f => f.statement),
      sources: [],
      createdAt: entry.timestamp,
      updatedAt: entry.lastAccessed,
      timestamp: entry.timestamp,
      accessCount: entry.accessCount,
      relatedQueries: entry.relatedEntries
        .map(id => this.entries.get(id)?.query)
        .filter(Boolean) as string[],
    };
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'what', 'when', 'where', 'which', 'who', 'why', 'how',
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
      'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day',
    ]);
    return stopWords.has(word);
  }
}

// Singleton instance
export const researchMemory = new ResearchMemoryStore();
