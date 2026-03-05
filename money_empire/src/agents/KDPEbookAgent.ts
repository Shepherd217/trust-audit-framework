import { BaseAgent, AgentConfig } from '../core/BaseAgent';
import { Logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

interface KDPEbookConfig extends AgentConfig {
  niches: string[];
  targetWordCount: number;
  chapters: number;
  publishingSchedule: string;
}

interface BookProgress {
  title: string;
  niche: string;
  currentChapter: number;
  totalChapters: number;
  wordCount: number;
  targetWordCount: number;
  status: 'outlining' | 'writing' | 'editing' | 'published';
  lastWorked: Date;
}

export class KDPEbookAgent extends BaseAgent {
  private config: KDPEbookConfig;
  private currentBook: BookProgress | null = null;
  private readonly dataDir: string;

  constructor(config: KDPEbookConfig) {
    super(config);
    this.config = {
      ...config,
      niches: config.niches || [
        'AI Agent Infrastructure',
        'Trust Frameworks for Agents',
        'Memory Systems for AI',
        'Agent Identity and Security',
        'Building Reliable AI Systems'
      ],
      targetWordCount: config.targetWordCount || 50000,
      chapters: config.chapters || 10,
      publishingSchedule: config.publishingSchedule || 'weekly'
    };
    this.dataDir = path.join(process.cwd(), 'data', 'kdp');
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.ensureDataDir();
    await this.loadCurrentBook();
    this.logger.info('KDP Ebook Agent initialized', {
      niches: this.config.niches,
      targetWordCount: this.config.targetWordCount
    });
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'books'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'outlines'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create data directories', error);
    }
  }

  private async loadCurrentBook(): Promise<void> {
    try {
      const progressPath = path.join(this.dataDir, 'current-book.json');
      const data = await fs.readFile(progressPath, 'utf-8');
      this.currentBook = JSON.parse(data);
      this.logger.info('Loaded current book progress', this.currentBook);
    } catch {
      this.logger.info('No current book in progress');
    }
  }

  private async saveProgress(): Promise<void> {
    if (this.currentBook) {
      const progressPath = path.join(this.dataDir, 'current-book.json');
      await fs.writeFile(progressPath, JSON.stringify(this.currentBook, null, 2));
    }
  }

  async execute(): Promise<void> {
    this.logger.info('KDP Ebook Agent executing');

    if (!this.currentBook || this.currentBook.status === 'published') {
      await this.startNewBook();
    }

    switch (this.currentBook?.status) {
      case 'outlining':
        await this.createOutline();
        break;
      case 'writing':
        await this.writeChapter();
        break;
      case 'editing':
        await this.editBook();
        break;
    }

    await this.saveProgress();
  }

  private async startNewBook(): Promise<void> {
    const niche = this.selectNiche();
    const title = await this.generateTitle(niche);
    
    this.currentBook = {
      title,
      niche,
      currentChapter: 0,
      totalChapters: this.config.chapters,
      wordCount: 0,
      targetWordCount: this.config.targetWordCount,
      status: 'outlining',
      lastWorked: new Date()
    };

    this.logger.info('Started new book', { title, niche });
  }

  private selectNiche(): string {
    // Rotate through niches or select based on market research
    const weights: Record<string, number> = {
      'Formula 1 Romance': 0.9,  // Emerging, less competition
      'Dark Romance': 0.8,       // High earnings
      'Enemies to Lovers': 0.7,
      'Billionaire Romance': 0.6,
      'Forced Proximity': 0.7
    };

    let totalWeight = 0;
    for (const niche of this.config.niches) {
      totalWeight += weights[niche] || 0.5;
    }

    let random = Math.random() * totalWeight;
    for (const niche of this.config.niches) {
      random -= weights[niche] || 0.5;
      if (random <= 0) return niche;
    }

    return this.config.niches[0];
  }

  private async generateTitle(niche: string): Promise<string> {
    const templates: Record<string, string[]> = {
      'Dark Romance': [
        'Shadows of {emotion}',
        'The {noun} We Buried',
        'Broken {noun}, Beautiful Lies',
        'Taming the {adjective} Beast'
      ],
      'Formula 1 Romance': [
        'Pole Position: A Racing Romance',
        'Lap {number}: Love at Full Speed',
        'The Driver and the {noun}',
        'Pit Stop for Love'
      ],
      'default': [
        'The {adjective} {noun}',
        'Love in {place}',
        'A {noun} to Remember'
      ]
    };

    const nicheTemplates = templates[niche] || templates['default'];
    const template = nicheTemplates[Math.floor(Math.random() * nicheTemplates.length)];
    
    // Simple template filling (would be more sophisticated in production)
    return template
      .replace('{emotion}', 'Desire')
      .replace('{noun}', 'Heart')
      .replace('{adjective}', 'Secret')
      .replace('{number}', 'One')
      .replace('{place}', 'Paris');
  }

  private async createOutline(): Promise<void> {
    if (!this.currentBook) return;

    this.logger.info('Creating outline', { title: this.currentBook.title });

    const outline = await this.generateOutline(this.currentBook);
    
    const outlinePath = path.join(
      this.dataDir, 
      'outlines', 
      `${this.currentBook.title.replace(/\s+/g, '-').toLowerCase()}.md`
    );
    
    await fs.writeFile(outlinePath, outline);
    
    this.currentBook.status = 'writing';
    this.currentBook.currentChapter = 1;
    
    this.logger.info('Outline complete', { chapters: this.config.chapters });
  }

  private async generateOutline(book: BookProgress): Promise<string> {
    const chapterWordCount = Math.floor(book.targetWordCount / book.totalChapters);
    
    let outline = `# ${book.title}\n\n`;
    outline += `## Genre: ${book.niche}\n\n`;
    outline += `## Target Word Count: ${book.targetWordCount.toLocaleString()}\n\n`;
    outline += `## Chapters (${book.totalChapters})\n\n`;

    for (let i = 1; i <= book.totalChapters; i++) {
      outline += `### Chapter ${i}\n`;
      outline += `- Word count: ${chapterWordCount.toLocaleString()}\n`;
      outline += `- Status: Not started\n`;
      outline += `- Summary: [To be outlined]\n\n`;
    }

    outline += `\n## Publishing Checklist\n`;
    outline += `- [ ] Cover design\n`;
    outline += `- [ ] Formatting for Kindle\n`;
    outline += `- [ ] KDP keywords optimization\n`;
    outline += `- [ ] Pricing strategy\n`;
    outline += `- [ ] Launch promotion\n`;

    return outline;
  }

  private async writeChapter(): Promise<void> {
    if (!this.currentBook) return;

    this.logger.info('Writing chapter', {
      chapter: this.currentBook.currentChapter,
      total: this.currentBook.totalChapters
    });

    // Simulate writing progress
    const chapterWordCount = Math.floor(this.currentBook.targetWordCount / this.currentBook.totalChapters);
    const wordsWritten = Math.min(
      2000, // Daily writing limit
      chapterWordCount
    );

    this.currentBook.wordCount += wordsWritten;
    
    const bookDir = path.join(
      this.dataDir, 
      'books', 
      this.currentBook.title.replace(/\s+/g, '-').toLowerCase()
    );
    
    await fs.mkdir(bookDir, { recursive: true });
    
    const chapterPath = path.join(bookDir, `chapter-${this.currentBook.currentChapter}.md`);
    await fs.appendFile(
      chapterPath, 
      `\n## Chapter ${this.currentBook.currentChapter}\n\n[Content written: ${wordsWritten} words]\n\n`
    );

    // Move to next chapter if current is complete
    if (this.currentBook.wordCount >= this.currentBook.targetWordCount * 
        (this.currentBook.currentChapter / this.currentBook.totalChapters)) {
      this.currentBook.currentChapter++;
      
      if (this.currentBook.currentChapter > this.currentBook.totalChapters) {
        this.currentBook.status = 'editing';
        this.logger.info('First draft complete');
      }
    }

    this.currentBook.lastWorked = new Date();
  }

  private async editBook(): Promise<void> {
    if (!this.currentBook) return;

    this.logger.info('Editing book', { title: this.currentBook.title });
    
    // Simulate editing process
    this.currentBook.status = 'published';
    this.currentBook.lastWorked = new Date();

    this.logger.info('Book published', {
      title: this.currentBook.title,
      wordCount: this.currentBook.wordCount,
      niche: this.currentBook.niche
    });
  }

  getCurrentBook(): BookProgress | null {
    return this.currentBook;
  }

  getProgress(): string {
    if (!this.currentBook) return 'No book in progress';
    
    const percentComplete = Math.round(
      (this.currentBook.wordCount / this.currentBook.targetWordCount) * 100
    );
    
    return `${this.currentBook.title} | Chapter ${this.currentBook.currentChapter}/${this.currentBook.totalChapters} | ${percentComplete}% complete | ${this.currentBook.wordCount.toLocaleString()} words`;
  }
}