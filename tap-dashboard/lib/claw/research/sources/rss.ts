/**
 * RSS Adapter
 * News and blog feed aggregation for ClawResearch
 */

import { SourceAdapter, RawSource, ResearchOptions, SourceType } from '@/types/research';

interface FeedConfig {
  name: string;
  url: string;
  category: string;
  credibilityBoost: number;
}

// Curated list of high-quality RSS feeds
const DEFAULT_FEEDS: FeedConfig[] = [
  // Tech News
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech', credibilityBoost: 10 },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', credibilityBoost: 10 },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', credibilityBoost: 15 },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tech', credibilityBoost: 15 },
  
  // Science
  { name: 'Nature News', url: 'https://www.nature.com/nature.rss', category: 'science', credibilityBoost: 25 },
  { name: 'Science Magazine', url: 'https://www.science.org/rss/news_current.xml', category: 'science', credibilityBoost: 25 },
  { name: 'Scientific American', url: 'https://www.scientificamerican.com/rss/feed/', category: 'science', credibilityBoost: 20 },
  
  // AI/ML
  { name: 'MIT AI News', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', category: 'ai', credibilityBoost: 25 },
  { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', category: 'ai', credibilityBoost: 25 },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', category: 'ai', credibilityBoost: 25 },
  
  // Business/Finance
  { name: 'Bloomberg Tech', url: 'https://feeds.bloomberg.com/bloomberg/markets/news.rss', category: 'business', credibilityBoost: 20 },
  { name: 'Reuters Tech', url: 'https://www.reutersagency.com/feed/?taxonomy=markets&post_type=reuters-best', category: 'business', credibilityBoost: 25 },
  
  // Academic/Research
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss', category: 'tech', credibilityBoost: 10 },
];

export class RssAdapter implements SourceAdapter {
  name = 'RSS';
  type: SourceType = 'rss';
  private feeds: FeedConfig[];

  constructor(customFeeds?: FeedConfig[]) {
    this.feeds = customFeeds || DEFAULT_FEEDS;
  }

  async search(query: string, options: ResearchOptions): Promise<RawSource[]> {
    const results: RawSource[] = [];
    const maxResults = options.maxSources || 10;
    const queryLower = query.toLowerCase();
    
    // Filter feeds by relevance to query
    const relevantFeeds = this.getRelevantFeeds(query);
    
    // Fetch from multiple feeds in parallel
    const feedPromises = relevantFeeds.map(feed => this.fetchFeed(feed));
    const feedResults = await Promise.allSettled(feedPromises);
    
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          // Filter by relevance to query
          const relevance = this.calculateRelevance(item, queryLower);
          if (relevance > 0.3) {
            results.push({
              ...item,
              metadata: {
                ...item.metadata,
                relevance,
              },
            });
          }
        }
      }
    }

    // Sort by relevance and date, return top results
    return results
      .sort((a, b) => {
        const relA = (a.metadata?.relevance as number) || 0;
        const relB = (b.metadata?.relevance as number) || 0;
        const relevanceDiff = relB - relA;
        if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
        return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
      })
      .slice(0, maxResults);
  }

  async fetch(url: string): Promise<RawSource> {
    // Direct RSS item fetch - try to find in known feeds
    for (const feed of this.feeds) {
      const items = await this.fetchFeed(feed);
      const item = items.find(i => i.url === url);
      if (item) return item;
    }

    // Fallback: try to fetch the URL directly
    try {
      const response = await fetch(url);
      const html = await response.text();
      const title = this.extractTitle(html) || url;
      const content = this.extractContent(html) || '';

      return {
        id: url,
        sourceType: 'rss' as const,
        retrievedAt: new Date(),
        type: 'rss',
        url,
        title,
        content,
        metadata: { fetched: true },
      };
    } catch (error) {
      return {
        id: url,
        sourceType: 'rss' as const,
        retrievedAt: new Date(),
        type: 'rss',
        url,
        title: url,
        content: '',
        metadata: { error: String(error) },
      };
    }
  }

  getCredibilityScore(source: RawSource): number {
    let score = 55; // Base score for news

    // Feed credibility boost
    const feedName = source.metadata?.feedName;
    const feed = this.feeds.find(f => f.name === feedName);
    if (feed) {
      score += feed.credibilityBoost;
    }

    // Recency bonus
    if (source.publishedAt) {
      const age = Date.now() - source.publishedAt.getTime();
      const days = age / (24 * 60 * 60 * 1000);
      if (days < 7) score += 5;
      if (days < 30) score += 3;
    }

    // Content quality
    if (source.content?.length > 1000) score += 5;
    if (source.author) score += 5;

    return Math.min(100, score);
  }

  private getRelevantFeeds(query: string): FeedConfig[] {
    const queryLower = query.toLowerCase();
    const categoryScores = new Map<string, number>();
    
    // Score categories by keyword presence
    const categoryKeywords: Record<string, string[]> = {
      tech: ['technology', 'software', 'hardware', 'app', 'startup', 'silicon valley'],
      science: ['science', 'research', 'study', 'discovery', 'experiment'],
      ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural', 'llm', 'gpt'],
      business: ['business', 'finance', 'market', 'stock', 'investment', 'economy'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) score += 1;
      }
      categoryScores.set(category, score);
    }

    // Return feeds sorted by relevance
    return this.feeds
      .map(feed => ({
        ...feed,
        relevance: categoryScores.get(feed.category) || 0,
      }))
      .sort((a, b) => (b as any).relevance - (a as any).relevance)
      .slice(0, 5); // Top 5 most relevant feeds
  }

  private async fetchFeed(feed: FeedConfig): Promise<RawSource[]> {
    try {
      const response = await fetch(feed.url, {
        headers: {
          'Accept': 'application/rss+xml, application/atom+xml, application/xml',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      return this.parseRSS(xml, feed);
    } catch (error) {
      console.warn(`Failed to fetch RSS feed ${feed.name}:`, error);
      return [];
    }
  }

  private parseRSS(xml: string, feed: FeedConfig): RawSource[] {
    const items: RawSource[] = [];
    
    // Try RSS 2.0 format
    const rssItems = xml.match(/<item>([\s\S]*?)<\/item>/g);
    if (rssItems) {
      for (const item of rssItems) {
        items.push(this.parseRSSItem(item, feed));
      }
      return items;
    }

    // Try Atom format
    const atomEntries = xml.match(/<entry>([\s\S]*?)<\/entry>/g);
    if (atomEntries) {
      for (const entry of atomEntries) {
        items.push(this.parseAtomEntry(entry, feed));
      }
    }

    return items;
  }

  private parseRSSItem(item: string, feed: FeedConfig): RawSource {
    const title = this.extractTag(item, 'title') || 'Untitled';
    const link = this.extractTag(item, 'link') || '';
    const description = this.extractTag(item, 'description') || this.extractTag(item, 'content:encoded') || '';
    const pubDate = this.extractTag(item, 'pubDate');
    const author = this.extractTag(item, 'author') || this.extractTag(item, 'dc:creator') || undefined;

    return {
      id: link || title,
      sourceType: 'rss' as const,
      retrievedAt: new Date(),
      type: 'rss',
      url: link,
      title: this.cleanHtml(title),
      content: this.cleanHtml(description),
      publishedAt: pubDate ? new Date(pubDate) : undefined,
      author,
      metadata: {
        feedName: feed.name,
        category: feed.category,
      },
    };
  }

  private parseAtomEntry(entry: string, feed: FeedConfig): RawSource {
    const title = this.extractTag(entry, 'title') || 'Untitled';
    const content = this.extractTag(entry, 'content') || this.extractTag(entry, 'summary') || '';
    const updated = this.extractTag(entry, 'updated');
    const published = this.extractTag(entry, 'published');
    
    // Extract link
    const linkMatch = entry.match(/href="([^"]+)"/);
    const link = linkMatch ? linkMatch[1] : '';

    return {
      id: link || title,
      sourceType: 'rss' as const,
      retrievedAt: new Date(),
      type: 'rss',
      url: link,
      title: this.cleanHtml(title),
      content: this.cleanHtml(content),
      publishedAt: published ? new Date(published) : updated ? new Date(updated) : undefined,
      metadata: {
        feedName: feed.name,
        category: feed.category,
      },
    };
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^\u003e]*>([\s\S]*?)<\/${tag}>`);
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^\u003e]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateRelevance(item: RawSource, queryLower: string): number {
    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();
    
    const queryWords = queryLower.split(/\s+/);
    let matches = 0;
    
    for (const word of queryWords) {
      if (word.length < 3) continue;
      if (titleLower.includes(word)) matches += 2;
      if (contentLower.includes(word)) matches += 1;
    }
    
    return Math.min(1, matches / (queryWords.length * 1.5));
  }

  private extractTitle(html: string): string | null {
    const match = html.match(/<title[^\u003e]*>([^]*?)<\/title>/i);
    return match ? match[1].trim() : null;
  }

  private extractContent(html: string): string | null {
    // Try to extract main content
    const articleMatch = html.match(/<article[^\u003e]*>([^]*?)<\/article>/i);
    if (articleMatch) return this.cleanHtml(articleMatch[1]);
    
    const mainMatch = html.match(/<main[^\u003e]*>([^]*?)<\/main>/i);
    if (mainMatch) return this.cleanHtml(mainMatch[1]);
    
    return null;
  }
}
