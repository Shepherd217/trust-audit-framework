/**
 * ArXiv Adapter
 * Academic paper search integration for ClawResearch
 */

import { SourceAdapter, RawSource, ResearchOptions, SourceType } from '@/types/research';

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';

export class ArxivAdapter implements SourceAdapter {
  name = 'arxiv';
  type: SourceType = 'arxiv';

  async search(query: string, options: ResearchOptions): Promise<RawSource[]> {
    const maxResults = options.maxSources || 10;
    
    // Build search query
    let searchQuery = query;
    if (options.timeRange && options.timeRange !== 'all') {
      const dateFilter = this.getDateFilter(options.timeRange);
      searchQuery += dateFilter;
    }

    const params = new URLSearchParams({
      search_query: `all:${searchQuery}`,
      start: '0',
      max_results: String(maxResults),
      sortBy: 'relevance',
      sortOrder: 'descending',
    });

    const response = await fetch(`${ARXIV_API_URL}?${params}`, {
      headers: {
        'Accept': 'application/atom+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`ArXiv API error: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    return this.parseArxivResponse(xmlText);
  }

  async fetch(url: string): Promise<RawSource> {
    // Extract arXiv ID from URL
    const arxivId = this.extractArxivId(url);
    if (!arxivId) {
      throw new Error('Invalid ArXiv URL');
    }

    const params = new URLSearchParams({
      id_list: arxivId,
    });

    const response = await fetch(`${ARXIV_API_URL}?${params}`);
    const xmlText = await response.text();
    const results = this.parseArxivResponse(xmlText);
    
    return results[0] || {
      type: 'arxiv',
      url,
      title: 'Unknown Paper',
      content: '',
    };
  }

  getCredibilityScore(source: RawSource): number {
    // ArXiv papers are preprints, so they get a good base score
    let score = 75;

    // Boost for citations if available
    const citationCount = source.metadata?.citationCount as number | undefined;
    if (citationCount && typeof citationCount === 'number') {
      score += Math.min(15, citationCount / 10);
    }

    // Boost for published date (newer research)
    if (source.publishedAt) {
      const age = Date.now() - source.publishedAt.getTime();
      const years = age / (365 * 24 * 60 * 60 * 1000);
      if (years < 2) score += 5; // Recent research
    }

    // Author reputation (if known)
    if (source.author) {
      const knownInstitutions = [
        'MIT', 'Stanford', 'Harvard', 'Berkeley', 'Google',
        'OpenAI', 'DeepMind', 'Microsoft', 'Meta',
      ];
      if (knownInstitutions.some(inst => source.author?.includes(inst))) {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  private extractArxivId(url: string): string | null {
    const match = url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
    return match ? match[1] : null;
  }

  private getDateFilter(timeRange: string | { start?: Date; end?: Date }): string {
    // Handle object type
    if (typeof timeRange !== 'string') {
      if (timeRange.start) {
        return ` AND submittedDate:[${timeRange.start.toISOString().split('T')[0]} TO *]`;
      }
      return '';
    }

    const now = new Date();
    let filterDate: Date;

    switch (timeRange) {
      case 'day':
        filterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        filterDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return '';
    }

    return ` AND submittedDate:[${filterDate.toISOString().split('T')[0]} TO ${now.toISOString().split('T')[0]}]`;
  }

  private parseArxivResponse(xmlText: string): RawSource[] {
    const results: RawSource[] = [];
    
    // Simple XML parsing (in production, use a proper XML parser)
    const entryRegex = /<entry[^\u003e]*>([\s\S]*?)<\/entry>/g;
    let match;
    
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entry = match[1];
      
      const title = this.extractTag(entry, 'title') || 'Untitled';
      const summary = this.extractTag(entry, 'summary') || '';
      const id = this.extractTag(entry, 'id') || '';
      const published = this.extractTag(entry, 'published');
      const authors = this.extractAllTags(entry, 'author')
        .map(a => this.extractTag(a, 'name'))
        .filter(Boolean)
        .join(', ');

      // Extract categories
      const categories = this.extractAllTags(entry, 'category')
        .map(c => {
          const termMatch = c.match(/term="([^"]+)"/);
          return termMatch ? termMatch[1] : '';
        })
        .filter(Boolean);

      results.push({
        id,
        sourceType: 'arxiv' as const,
        retrievedAt: new Date(),
        type: 'arxiv',
        url: id.replace('http://arxiv.org/abs/', 'https://arxiv.org/abs/'),
        title: title.replace(/\n/g, ' ').trim(),
        content: summary.replace(/\n/g, ' ').trim(),
        publishedAt: published ? new Date(published) : undefined,
        author: authors,
        metadata: {
          categories,
          primaryCategory: categories[0],
        },
      });
    }

    return results;
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^\u003e]*>([\s\S]*?)<\/${tag}>`);
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractAllTags(xml: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^\u003e]*>([\s\S]*?)<\/${tag}>`, 'g');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }
}
