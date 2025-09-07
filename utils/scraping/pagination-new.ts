/**
 * Pagination Handling Utilities
 * 
 * Advanced pagination patterns for auction sites and marketplaces
 * with resumable scraping, fault tolerance, and intelligent retry logic.
 * Integrates with PokeDAO ScrapeCursor table for persistence.
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration
 * @inspired_by Robust scraping and pagination patterns
 */

import { PrismaClient } from '@prisma/client';

type ScrapeCursor = {
  id: number;
  sessionId: string;
  source: string;
  state: any; // JSON field
  createdAt: Date;
  lastUpdated: Date;
};

export interface PaginationState {
  currentPage: number;
  totalPages?: number;
  hasNextPage: boolean;
  cursor?: string;
  offset?: number;
  lastItemId?: string;
  processedCount: number;
  errorCount: number;
  lastError?: string;
  startTime: Date;
  lastUpdateTime: Date;
}

export interface PaginationConfig {
  pageSize: number;
  maxPages: number;
  paginationType: 'offset' | 'cursor' | 'page';
  baseDelay: number;
  maxRetries: number;
  retryDelay: number;
  userAgentRotation: boolean;
  saveStateInterval: number; // Pages between state saves
}

export interface ScrapingResult<T = any> {
  items: T[];
  metadata: {
    page: number;
    totalItems: number;
    hasMore: boolean;
    nextCursor?: string;
    processingTime: number;
  };
}

/**
 * Core pagination handler with resumable functionality
 */
export class PaginationHandler {
  protected static readonly SITE_CONFIGS: Record<string, PaginationConfig> = {
    goldin: {
      pageSize: 25,
      maxPages: 200,
      paginationType: 'offset',
      baseDelay: 1500,
      maxRetries: 3,
      retryDelay: 2000,
      userAgentRotation: true,
      saveStateInterval: 5
    },
    heritage: {
      pageSize: 50,
      maxPages: 100,
      paginationType: 'cursor',
      baseDelay: 2000,
      maxRetries: 3,
      retryDelay: 3000,
      userAgentRotation: true,
      saveStateInterval: 3
    },
    ebay: {
      pageSize: 100,
      maxPages: 50,
      paginationType: 'page',
      baseDelay: 1000,
      maxRetries: 5,
      retryDelay: 1000,
      userAgentRotation: false,
      saveStateInterval: 10
    }
  };

  protected prisma: PrismaClient;
  protected sessionId: string;
  protected source: string;
  protected state: PaginationState;
  protected config: PaginationConfig;

  constructor(
    prisma: PrismaClient,
    source: keyof typeof PaginationHandler.SITE_CONFIGS,
    sessionId?: string
  ) {
    this.prisma = prisma;
    this.source = source;
    this.sessionId = sessionId || this.generateSessionId();
    this.config = PaginationHandler.SITE_CONFIGS[source] || PaginationHandler.SITE_CONFIGS.ebay;
    this.state = this.initializeState();
  }

  /**
   * Resume pagination from saved state or start fresh
   */
  async initializePagination(forceReset = false): Promise<PaginationState> {
    if (!forceReset) {
      const savedCursor = await this.loadSavedState();
      if (savedCursor) {
        this.state = this.deserializeState(savedCursor.state as any);
        console.log(`Resuming pagination from page ${this.state.currentPage}`);
        return this.state;
      }
    }

    this.state = this.initializeState();
    await this.saveState();
    return this.state;
  }

  /**
   * Process single page with error handling and retry logic
   */
  async processPage(
    pageProcessor: (state: PaginationState) => Promise<ScrapingResult>
  ): Promise<ScrapingResult | null> {
    let retryCount = 0;
    
    while (retryCount <= this.config.maxRetries) {
      try {
        const startTime = Date.now();
        const result = await pageProcessor(this.state);
        
        // Update pagination state
        this.updateStateFromResult(result);
        
        // Save state periodically
        if (this.state.currentPage % this.config.saveStateInterval === 0) {
          await this.saveState();
        }

        result.metadata.processingTime = Date.now() - startTime;
        return result;

      } catch (error) {
        retryCount++;
        this.state.errorCount++;
        this.state.lastError = error instanceof Error ? error.message : String(error);
        
        console.warn(`Page ${this.state.currentPage} failed (attempt ${retryCount}): ${this.state.lastError}`);
        
        if (retryCount <= this.config.maxRetries) {
          const delay = this.calculateRetryDelay(retryCount);
          await this.sleep(delay);
        }
      }
    }

    // Max retries exceeded
    console.error(`Page ${this.state.currentPage} failed after ${this.config.maxRetries} attempts`);
    await this.saveState(); // Save failed state
    return null;
  }

  /**
   * Complete pagination workflow with resumability
   */
  async *paginateAll(
    pageProcessor: (state: PaginationState) => Promise<ScrapingResult>
  ): AsyncGenerator<ScrapingResult, void, unknown> {
    await this.initializePagination();

    while (this.state.hasNextPage && this.state.currentPage <= this.config.maxPages) {
      const result = await this.processPage(pageProcessor);
      
      if (result) {
        yield result;
        
        if (!result.metadata.hasMore) {
          this.state.hasNextPage = false;
          break;
        }
        
        // Apply base delay between pages
        await this.sleep(this.config.baseDelay);
      } else {
        // Failed page - decide whether to continue or abort
        if (this.state.errorCount > 10) {
          console.error('Too many errors, aborting pagination');
          break;
        }
        
        // Skip failed page and continue
        this.state.currentPage++;
      }
    }

    // Final state save
    await this.saveState();
    console.log(`Pagination completed. Processed ${this.state.processedCount} items across ${this.state.currentPage} pages`);
  }

  /**
   * Get current pagination status
   */
  getStatus(): {
    progress: number;
    estimatedTimeRemaining?: number;
    itemsPerSecond: number;
    errorRate: number;
  } {
    const elapsed = Date.now() - this.state.startTime.getTime();
    const elapsedSeconds = elapsed / 1000;
    const itemsPerSecond = this.state.processedCount / elapsedSeconds;
    const errorRate = this.state.errorCount / Math.max(1, this.state.currentPage);
    
    let progress = 0;
    let estimatedTimeRemaining: number | undefined;
    
    if (this.state.totalPages) {
      progress = this.state.currentPage / this.state.totalPages;
      const remainingPages = this.state.totalPages - this.state.currentPage;
      estimatedTimeRemaining = (remainingPages * elapsedSeconds) / this.state.currentPage;
    }

    return {
      progress,
      estimatedTimeRemaining,
      itemsPerSecond,
      errorRate
    };
  }

  /**
   * Save current state to database
   */
  protected async saveState(): Promise<void> {
    const serializedState = this.serializeState(this.state);
    
    await this.prisma.scrapeCursor.upsert({
      where: { sessionId: this.sessionId },
      update: {
        state: serializedState,
        lastUpdated: new Date()
      },
      create: {
        sessionId: this.sessionId,
        source: this.source,
        state: serializedState,
        createdAt: new Date(),
        lastUpdated: new Date()
      }
    });
  }

  /**
   * Load saved state from database
   */
  protected async loadSavedState(): Promise<ScrapeCursor | null> {
    return await this.prisma.scrapeCursor.findUnique({
      where: { sessionId: this.sessionId }
    });
  }

  /**
   * Initialize fresh pagination state
   */
  protected initializeState(): PaginationState {
    return {
      currentPage: 1,
      hasNextPage: true,
      processedCount: 0,
      errorCount: 0,
      startTime: new Date(),
      lastUpdateTime: new Date()
    };
  }

  /**
   * Update state based on page processing result
   */
  protected updateStateFromResult(result: ScrapingResult): void {
    this.state.currentPage++;
    this.state.processedCount += result.items.length;
    this.state.hasNextPage = result.metadata.hasMore;
    this.state.lastUpdateTime = new Date();
    
    if (result.metadata.nextCursor) {
      this.state.cursor = result.metadata.nextCursor;
    }
    
    if (this.config.paginationType === 'offset') {
      this.state.offset = (this.state.currentPage - 1) * this.config.pageSize;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  protected calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3; // ±30% jitter
    return exponentialDelay * (1 + jitter);
  }

  /**
   * Serialize state for database storage
   */
  protected serializeState(state: PaginationState): any {
    return {
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      hasNextPage: state.hasNextPage,
      cursor: state.cursor,
      offset: state.offset,
      lastItemId: state.lastItemId,
      processedCount: state.processedCount,
      errorCount: state.errorCount,
      lastError: state.lastError,
      startTime: state.startTime.toISOString(),
      lastUpdateTime: state.lastUpdateTime.toISOString()
    };
  }

  /**
   * Deserialize state from database
   */
  protected deserializeState(serialized: any): PaginationState {
    return {
      currentPage: serialized.currentPage || 1,
      totalPages: serialized.totalPages,
      hasNextPage: serialized.hasNextPage ?? true,
      cursor: serialized.cursor,
      offset: serialized.offset,
      lastItemId: serialized.lastItemId,
      processedCount: serialized.processedCount || 0,
      errorCount: serialized.errorCount || 0,
      lastError: serialized.lastError,
      startTime: new Date(serialized.startTime),
      lastUpdateTime: new Date(serialized.lastUpdateTime)
    };
  }

  /**
   * Generate unique session identifier
   */
  protected generateSessionId(): string {
    return `${this.source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Specialized pagination handler for auction sites
 */
export class AuctionPaginationHandler extends PaginationHandler {
  /**
   * Extract pagination metadata from auction site HTML
   */
  async extractPaginationData(html: string, source: keyof typeof PaginationHandler.SITE_CONFIGS): Promise<{
    totalPages?: number;
    hasNextPage: boolean;
    nextPageUrl?: string;
    itemCount: number;
  }> {
    const extractors: Record<string, (html: string) => any> = {
      goldin: this.extractGoldinPagination.bind(this),
      heritage: this.extractHeritagePagination.bind(this),
      ebay: this.extractEbayPagination.bind(this)
    };

    const extractor = extractors[source];
    if (!extractor) {
      throw new Error(`No pagination extractor for source: ${source}`);
    }

    const errors: string[] = [];
    let result: any = null;

    try {
      result = extractor(html);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`Error extracting pagination data: ${errorMessage}`);
      
      // Fallback: basic extraction
      result = this.basicPaginationExtraction(html);
    }

    if (errors.length > 0) {
      console.warn('Pagination extraction warnings:', errors);
    }

    return {
      totalPages: result?.totalPages,
      hasNextPage: result?.hasNextPage ?? false,
      nextPageUrl: result?.nextPageUrl,
      itemCount: result?.itemCount ?? 0
    };
  }

  /**
   * Resume from specific auction lot/item
   */
  async resumeFromItem(lastItemId: string): Promise<boolean> {
    const config = PaginationHandler.SITE_CONFIGS[this.source];
    
    if (!config) {
      return false;
    }

    // Update state to resume from specific item
    this.state.lastItemId = lastItemId;
    
    // Site-specific resume logic would go here
    // For now, we'll start from the beginning and skip until we find the item
    return true;
  }

  /**
   * Extract Goldin Auctions pagination
   */
  private extractGoldinPagination(html: string): any {
    // Mock implementation - would parse actual Goldin HTML structure
    const pageMatch = html.match(/Page (\d+) of (\d+)/i);
    const nextMatch = html.includes('Next Page');
    
    return {
      totalPages: pageMatch ? parseInt(pageMatch[2]) : undefined,
      hasNextPage: nextMatch,
      itemCount: (html.match(/class="auction-item"/g) || []).length
    };
  }

  /**
   * Extract Heritage Auctions pagination
   */
  private extractHeritagePagination(html: string): any {
    // Mock implementation - would parse actual Heritage HTML structure
    const paginationMatch = html.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/i);
    const nextMatch = html.includes('Next');
    
    return {
      totalPages: paginationMatch ? Math.ceil(parseInt(paginationMatch[3]) / 50) : undefined,
      hasNextPage: nextMatch,
      itemCount: (html.match(/class="lot-item"/g) || []).length
    };
  }

  /**
   * Extract eBay pagination
   */
  private extractEbayPagination(html: string): any {
    // Mock implementation - would parse actual eBay HTML structure
    const resultsMatch = html.match(/(\d+,?\d*)\s*results/i);
    const pageMatch = html.match(/Page (\d+)/i);
    
    return {
      totalPages: resultsMatch ? Math.ceil(parseInt(resultsMatch[1].replace(',', '')) / 100) : undefined,
      hasNextPage: html.includes('Next page'),
      itemCount: (html.match(/class="s-item"/g) || []).length
    };
  }

  /**
   * Basic fallback pagination extraction
   */
  private basicPaginationExtraction(html: string): any {
    // Generic patterns that work across sites
    const nextPatterns = [
      /next/i,
      /&gt;/,
      /→/,
      /more/i
    ];

    const hasNext = nextPatterns.some(pattern => pattern.test(html));

    return {
      hasNextPage: hasNext,
      itemCount: Math.max(
        (html.match(/class="[^"]*item[^"]*"/g) || []).length,
        (html.match(/data-testid="[^"]*item[^"]*"/g) || []).length,
        10 // Minimum assumption
      )
    };
  }
}
