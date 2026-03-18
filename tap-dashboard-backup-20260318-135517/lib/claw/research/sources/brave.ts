/**
 * Brave Search Adapter
 * Web search integration for ClawResearch
 */

import { SourceAdapter, RawSource, ResearchOptions, SourceType } from '@/types/research';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

export class BraveSearchAdapter implements SourceAdapter {
  name = 'Brave Search';
  type: SourceType = 'web';

  async search(query: string, options: ResearchOptions): Promise<RawSource[]> {
    if (!BRAVE_API_KEY) {
      throw new Error('BRAVE_API_KEY not configured');
    }

    const params = new URLSearchParams({
      q: query,
      count: String(options.maxSources || 10),
      offset: '0',
      mkt: options.language || 'en-US',
      safesearch: 'off',
      text_decorations: 'false',
    });

    // Time range filtering
    if (options.timeRange && options.timeRange !== 'all') {
      const freshnessMap: Record<string, string> = {
        day: 'pd',
        week: 'pw',
        month: 'pm',
        year: 'py',
      };
      const timeRangeStr = typeof options.timeRange === 'string' ? options.timeRange : 'month';
      params.append('freshness', freshnessMap[timeRangeStr] || '');
    }

    const response = await fetch(`${BRAVE_API_URL}?${params}`, {
      headers: {
        'X-Subscription-Token': BRAVE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results: RawSource[] = [];

    for (const result of data.web?.results || []) {
      // Skip excluded domains
      if (options.excludeDomains?.some((d: string) => result.url.includes(d))) {
        continue;
      }

      // Filter by domain if specified
      if (options.domains && options.domains.length > 0 && !options.domains.some((d: string) => result.url.includes(d))) {
        continue;
      }

      results.push({
        id: result.url,
        sourceType: 'web' as const,
        retrievedAt: new Date(),
        type: 'web',
        url: result.url,
        title: result.title,
        content: result.description,
        publishedAt: result.age ? this.parseAge(result.age) : undefined,
        metadata: {
          score: result.score,
          page_age: result.page_age,
        },
      });
    }

    return results;
  }

  async fetch(url: string): Promise<RawSource> {
    // Use web_fetch to get full content
    try {
      const response = await fetch(`http://localhost:3000/api/fetch?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      return {
        id: url,
        sourceType: 'web' as const,
        retrievedAt: new Date(),
        type: 'web',
        url,
        title: data.title || url,
        content: data.content || data.description || '',
        metadata: {
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        id: url,
        sourceType: 'web' as const,
        retrievedAt: new Date(),
        type: 'web',
        url,
        title: url,
        content: '',
        metadata: { error: String(error) },
      };
    }
  }

  getCredibilityScore(source: RawSource): number {
    if (!source.url) return 50;
    const domain = new URL(source.url).hostname;
    
    // High credibility domains
    const trustedDomains = [
      'edu', 'gov', 'ac.uk', 'arxiv.org', 'nature.com',
      'science.org', 'ieee.org', 'acm.org', 'mit.edu',
      'stanford.edu', 'harvard.edu', 'wikipedia.org',
    ];
    
    // Low credibility indicators
    const suspiciousIndicators = [
      'blogspot', 'wordpress.com', 'medium.com',
      'substack.com', 'newsletter',
    ];

    let score = 50; // Base score

    // Domain reputation
    if (trustedDomains.some(d => domain.includes(d))) {
      score += 30;
    }
    
    if (suspiciousIndicators.some(d => domain.includes(d))) {
      score -= 15;
    }

    // Content quality indicators
    if (source.content?.length > 1000) score += 10;
    if (source.author) score += 10;
    if (source.publishedAt) score += 5;

    // Cap at 100
    return Math.min(100, Math.max(0, score));
  }

  private parseAge(age: string): Date | undefined {
    // Parse relative age strings like "1 day ago", "2 weeks ago"
    const now = new Date();
    const match = age.match(/(\d+)\s+(day|week|month|year)s?\s+ago/);
    
    if (!match) return undefined;
    
    const [, num, unit] = match;
    const value = parseInt(num);
    
    switch (unit) {
      case 'day': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
      case 'year': return new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000);
      default: return undefined;
    }
  }
}
