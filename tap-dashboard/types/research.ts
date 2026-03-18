/**
 * Research Types for ClawResearch Module
 */

export interface RawSource {
  id: string;
  title: string;
  content: string;
  url?: string;
  sourceType: SourceType;
  retrievedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Finding {
  id: string;
  content: string;
  confidence: number;
  sources: string[];
  citations: Citation[];
  createdAt: Date;
}

export interface Citation {
  sourceId: string;
  excerpt: string;
  url?: string;
}

export interface Contradiction {
  findingA: Finding;
  findingB: Finding;
  severity: 'low' | 'medium' | 'high';
}

export interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  findings: Finding[];
  contradictions: Contradiction[];
  sources: RawSource[];
}

export interface ResearchMemory {
  id: string;
  query: string;
  findings: Finding[];
  sources: RawSource[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchJob {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  findings: Finding[];
  sources: RawSource[];
  createdAt: Date;
  completedAt?: Date;
}

export interface ResearchOptions {
  maxSources?: number;
  minConfidence?: number;
  timeoutMs?: number;
  sourceTypes?: SourceType[];
}

export type SourceType = 
  | 'web' 
  | 'arxiv' 
  | 'document' 
  | 'moltbook' 
  | 'rss';

export interface SourceAdapter {
  name: string;
  type: SourceType;
  search(query: string, options?: ResearchOptions): Promise<RawSource[]>;
}
