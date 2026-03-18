/**
 * Moltbook Adapter
 * Agent network knowledge base integration for ClawResearch
 */

import { SourceAdapter, RawSource, ResearchOptions, SourceType } from '@/types/research';

interface MoltbookEntry {
  id: string;
  content: string;
  agentId: string;
  agentName: string;
  timestamp: Date;
  tags: string[];
  credibility: number;
  verified: boolean;
  sources?: string[];
}

// In-memory store for Moltbook entries (replace with actual database in production)
const moltbookStore: MoltbookEntry[] = [];

export class MoltbookAdapter implements SourceAdapter {
  name = 'Moltbook';
  type: SourceType = 'moltbook';

  async search(query: string, options: ResearchOptions): Promise<RawSource[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 3);
    
    // Score and filter entries
    const scoredEntries = moltbookStore
      .map(entry => ({
        entry,
        score: this.calculateRelevance(entry, queryWords, queryLower),
      }))
      .filter(({ score }) => score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxSources || 10);

    return scoredEntries.map(({ entry }) => this.toRawSource(entry));
  }

  async fetch(url: string): Promise<RawSource> {
    // URL format: moltbook://{entryId}
    const entryId = url.replace('moltbook://', '');
    const entry = moltbookStore.find(e => e.id === entryId);
    
    if (!entry) {
      throw new Error(`Moltbook entry not found: ${entryId}`);
    }

    return this.toRawSource(entry);
  }

  getCredibilityScore(source: RawSource): number {
    const baseScore = (source.metadata?.credibility as number) || 50;
    const verified = source.metadata?.verified ? 10 : 0;
    const sources = source.metadata?.sources as string[] | undefined;
    const hasSources = sources && sources.length > 0 ? 10 : 0;
    
    return Math.min(100, baseScore + verified + hasSources);
  }

  /**
   * Add entry to Moltbook (called by agents)
   */
  addEntry(entry: Omit<MoltbookEntry, 'id' | 'timestamp'>): MoltbookEntry {
    const newEntry: MoltbookEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };
    
    moltbookStore.push(newEntry);
    return newEntry;
  }

  /**
   * Get entries by agent
   */
  getByAgent(agentId: string): MoltbookEntry[] {
    return moltbookStore.filter(e => e.agentId === agentId);
  }

  /**
   * Get related entries
   */
  getRelated(entryId: string, limit: number = 5): MoltbookEntry[] {
    const entry = moltbookStore.find(e => e.id === entryId);
    if (!entry) return [];

    return moltbookStore
      .filter(e => e.id !== entryId)
      .map(e => ({
        entry: e,
        score: this.tagOverlap(entry.tags, e.tags),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => entry);
  }

  /**
   * Verify an entry (increase credibility)
   */
  verifyEntry(entryId: string, verifierId: string): boolean {
    const entry = moltbookStore.find(e => e.id === entryId);
    if (!entry) return false;
    
    entry.verified = true;
    entry.credibility = Math.min(100, entry.credibility + 15);
    return true;
  }

  /**
   * Get knowledge graph for a topic
   */
  getKnowledgeGraph(topic: string): {
    nodes: { id: string; label: string; type: string }[];
    edges: { from: string; to: string; label: string }[];
  } {
    const relatedEntries = this.findByTopic(topic);
    
    const nodes = relatedEntries.map(e => ({
      id: e.id,
      label: e.content.slice(0, 50) + '...',
      type: e.agentName,
    }));

    const edges: { from: string; to: string; label: string }[] = [];
    
    // Create edges based on shared tags
    for (let i = 0; i < relatedEntries.length; i++) {
      for (let j = i + 1; j < relatedEntries.length; j++) {
        const shared = relatedEntries[i].tags.filter(t => 
          relatedEntries[j].tags.includes(t)
        );
        if (shared.length > 0) {
          edges.push({
            from: relatedEntries[i].id,
            to: relatedEntries[j].id,
            label: shared.join(', '),
          });
        }
      }
    }

    return { nodes, edges };
  }

  private calculateRelevance(
    entry: MoltbookEntry,
    queryWords: string[],
    queryLower: string
  ): number {
    let score = 0;
    const contentLower = entry.content.toLowerCase();

    // Word matching
    for (const word of queryWords) {
      if (contentLower.includes(word)) score += 1;
      if (entry.tags.some(t => t.toLowerCase().includes(word))) score += 2;
    }

    // Exact phrase match
    if (contentLower.includes(queryLower)) score += 5;

    // Credibility weighting
    score *= (0.5 + entry.credibility / 200);

    // Recency weighting
    const age = Date.now() - entry.timestamp.getTime();
    const days = age / (24 * 60 * 60 * 1000);
    score *= Math.max(0.5, 1 - days / 365);

    return score;
  }

  private toRawSource(entry: MoltbookEntry): RawSource {
    return {
      id: entry.id,
      sourceType: 'moltbook' as const,
      retrievedAt: new Date(),
      type: 'moltbook',
      url: `moltbook://${entry.id}`,
      title: `${entry.agentName}: ${entry.content.slice(0, 60)}...`,
      content: entry.content,
      publishedAt: entry.timestamp,
      author: entry.agentName,
      metadata: {
        agentId: entry.agentId,
        credibility: entry.credibility,
        verified: entry.verified,
        sources: entry.sources,
        tags: entry.tags,
      },
    };
  }

  private generateId(): string {
    return `mb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private tagOverlap(tags1: string[], tags2: string[]): number {
    const set1 = new Set(tags1.map(t => t.toLowerCase()));
    const set2 = new Set(tags2.map(t => t.toLowerCase()));
    const intersection = [...set1].filter(t => set2.has(t));
    return intersection.length / Math.max(set1.size, set2.size);
  }

  private findByTopic(topic: string): MoltbookEntry[] {
    const topicLower = topic.toLowerCase();
    return moltbookStore.filter(e => 
      e.content.toLowerCase().includes(topicLower) ||
      e.tags.some(t => t.toLowerCase().includes(topicLower))
    );
  }
}

// Singleton instance
export const moltbookAdapter = new MoltbookAdapter();
