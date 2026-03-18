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
  publishedAt?: Date;
  author?: string;
  type?: SourceType;
  metadata?: Record<string, unknown>;
}

export interface Finding {
  id: string;
  content: string;
  statement?: string;
  confidence: number;
  sources: string[];
  citations: Citation[];
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Citation {
  sourceId: string;
  excerpt: string;
  url?: string;
}

export interface Contradiction {
  id?: string;
  findingA?: Finding;
  findingB?: Finding;
  claimA?: string;
  claimB?: string;
  sourceA?: string;
  sourceB?: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

export interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  findings: Finding[];
  contradictions: Contradiction[];
  sources: RawSource[];
  supportingSources?: RawSource[] | string[];
  opposingSources?: RawSource[] | string[];
  contradictingSources?: RawSource[] | string[];
  explanation?: string;
}

export interface ResearchMemory {
  id: string;
  query: string;
  findings: string[] | Finding[];
  sources: RawSource[];
  createdAt: Date;
  updatedAt: Date;
  timestamp?: Date;
  accessCount?: number;
  relatedQueries?: string[];
  relatedEntries?: string[];
}

export interface ResearchJob {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  findings: Finding[];
  sources: RawSource[];
  depth?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  completedAt?: Date;
}

export interface ResearchOptions {
  maxSources?: number;
  minConfidence?: number;
  timeoutMs?: number;
  sourceTypes?: SourceType[];
  depth?: number;
  timeRange?: { start?: Date; end?: Date } | 'all';
  language?: string;
  excludeDomains?: string[];
  domains?: string[];
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
