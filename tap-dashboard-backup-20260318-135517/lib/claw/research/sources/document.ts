/**
 * Document Adapter
 * User-provided document processing for ClawResearch
 */

import { SourceAdapter, RawSource, ResearchOptions, SourceType } from '@/types/research';

interface ProcessedDocument {
  id: string;
  filename: string;
  content: string;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy?: string;
  metadata?: Record<string, any>;
}

// In-memory store (replace with actual storage in production)
const documentStore: Map<string, ProcessedDocument> = new Map();

export class DocumentAdapter implements SourceAdapter {
  name = 'Document';
  type: SourceType = 'document';

  async search(query: string, options: ResearchOptions): Promise<RawSource[]> {
    const queryLower = query.toLowerCase();
    const results: RawSource[] = [];

    for (const doc of documentStore.values()) {
      const relevance = this.calculateRelevance(doc, queryLower);
      if (relevance > 0.2) {
        results.push(this.toRawSource(doc, relevance));
      }
    }

    return results
      .sort((a, b) => {
        const relA = (a.metadata?.relevance as number) || 0;
        const relB = (b.metadata?.relevance as number) || 0;
        return relB - relA;
      })
      .slice(0, options.maxSources || 10);
  }

  async fetch(url: string): Promise<RawSource> {
    // URL format: doc://{docId}
    const docId = url.replace('doc://', '');
    const doc = documentStore.get(docId);
    
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    return this.toRawSource(doc, 1);
  }

  getCredibilityScore(source: RawSource): number {
    // User documents get a base credibility score
    // Can be adjusted based on user reputation, verification, etc.
    let score = 60;

    // Boost for structured documents
    const mimeType = source.metadata?.mimeType as string | undefined;
    if (mimeType?.includes('pdf')) score += 10;
    if (mimeType?.includes('officedocument')) score += 5;

    // Content length indicates thoroughness
    if (source.content?.length > 5000) score += 10;

    // Metadata completeness
    if (source.metadata?.uploadedBy) score += 5;

    return Math.min(100, score);
  }

  /**
   * Upload and process a document
   */
  async uploadDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    uploadedBy?: string
  ): Promise<ProcessedDocument> {
    const id = this.generateId();
    
    // Extract text content based on mime type
    const content = await this.extractContent(buffer, mimeType);
    
    const doc: ProcessedDocument = {
      id,
      filename,
      content,
      mimeType,
      uploadedAt: new Date(),
      uploadedBy,
      metadata: {
        size: buffer.length,
        wordCount: content.split(/\s+/).length,
      },
    };

    documentStore.set(id, doc);
    return doc;
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): ProcessedDocument | undefined {
    return documentStore.get(id);
  }

  /**
   * List all documents
   */
  listDocuments(): ProcessedDocument[] {
    return Array.from(documentStore.values());
  }

  /**
   * Delete document
   */
  deleteDocument(id: string): boolean {
    return documentStore.delete(id);
  }

  /**
   * Get document chunks for RAG processing
   */
  getDocumentChunks(id: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const doc = documentStore.get(id);
    if (!doc) return [];

    return this.chunkText(doc.content, chunkSize, overlap);
  }

  private async extractContent(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
        return buffer.toString('utf-8');
      
      case 'text/markdown':
      case 'text/x-markdown':
        return buffer.toString('utf-8');
      
      case 'text/html':
        return this.stripHtml(buffer.toString('utf-8'));
      
      case 'application/pdf':
        // In production, use pdf-parse or similar
        return `[PDF content: ${buffer.length} bytes]`;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // In production, use mammoth or similar
        return `[DOCX content: ${buffer.length} bytes]`;
      
      default:
        // Try to extract as text
        try {
          return buffer.toString('utf-8');
        } catch {
          return `[Binary content: ${buffer.length} bytes]`;
        }
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^\u003e]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^\u003e]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^\u003e]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      start = end - overlap;
      if (start >= end) start = end;
    }

    return chunks;
  }

  private calculateRelevance(doc: ProcessedDocument, queryLower: string): number {
    const contentLower = doc.content.toLowerCase();
    const filenameLower = doc.filename.toLowerCase();
    
    const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 3);
    let matches = 0;

    // Check filename
    if (filenameLower.includes(queryLower)) matches += 3;

    // Check content
    for (const word of queryWords) {
      const count = (contentLower.match(new RegExp(word, 'g')) || []).length;
      matches += Math.min(count, 3); // Cap per word
    }

    // Exact phrase match
    if (contentLower.includes(queryLower)) matches += 5;

    return Math.min(1, matches / (queryWords.length * 2 + 5));
  }

  private toRawSource(doc: ProcessedDocument, relevance: number): RawSource {
    return {
      id: doc.id,
      sourceType: 'document' as const,
      retrievedAt: new Date(),
      type: 'document',
      url: `doc://${doc.id}`,
      title: doc.filename,
      content: doc.content.slice(0, 5000), // Limit content length
      publishedAt: doc.uploadedAt,
      author: doc.uploadedBy,
      metadata: {
        fullId: doc.id,
        relevance,
      },
    };
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// Singleton instance
export const documentAdapter = new DocumentAdapter();
