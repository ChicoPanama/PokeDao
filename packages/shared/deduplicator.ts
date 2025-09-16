/**
 * DEDUPLICATION ENGINE
 * ===================
 * Removes duplicate and invalid data to ensure 10/10 integrity
 */

import { PrismaClient } from '@prisma/client';

export interface DeduplicationResult {
  duplicatesRemoved: number;
  invalidRecordsRemoved: number;
  totalRecordsProcessed: number;
  issues: string[];
}

export class DataDeduplicator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Remove duplicate cards based on canonical key
   */
  async deduplicateCards(): Promise<DeduplicationResult> {
    const issues: string[] = [];
    let duplicatesRemoved = 0;
    let invalidRecordsRemoved = 0;
    let totalRecordsProcessed = 0;

    console.log('🔍 Starting card deduplication...');

    // Find cards with duplicate canonical keys
    const duplicateGroups = await this.prisma.$queryRaw`
      SELECT "cardKey", COUNT(*) as count
      FROM "Card"
      WHERE "cardKey" IS NOT NULL
      GROUP BY "cardKey"
      HAVING COUNT(*) > 1
    ` as Array<{ cardKey: string; count: number }>;

    console.log(`Found ${duplicateGroups.length} duplicate card groups`);

    for (const group of duplicateGroups) {
      const duplicateCards = await this.prisma.card.findMany({
        where: { cardKey: group.cardKey },
        orderBy: [
          { isValidated: 'desc' },
          { validationScore: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      // Keep the first (best) card, remove the rest
      const cardsToRemove = duplicateCards.slice(1);
      
      for (const card of cardsToRemove) {
        // Check if card has any related data
        const hasListings = await this.prisma.listing.count({
          where: { cardId: card.id }
        });

        const hasOpportunities = await this.prisma.opportunity.count({
          where: { cardId: card.id }
        });

        if (hasListings > 0 || hasOpportunities > 0) {
          issues.push(`Cannot remove card ${card.id} - has ${hasListings} listings and ${hasOpportunities} opportunities`);
          continue;
        }

        await this.prisma.card.delete({
          where: { id: card.id }
        });

        duplicatesRemoved++;
      }

      totalRecordsProcessed += duplicateCards.length;
    }

    // Remove cards with invalid data
    const invalidCards = await this.prisma.card.findMany({
      where: {
        OR: [
          { name: { equals: '' } },
          { setCode: { equals: '' } },
          { number: { equals: '' } },
          { cardKey: null }
        ]
      }
    });

    for (const card of invalidCards) {
      // Check for related data
      const hasRelatedData = await this.prisma.listing.count({
        where: { cardId: card.id }
      });

      if (hasRelatedData === 0) {
        await this.prisma.card.delete({
          where: { id: card.id }
        });
        invalidRecordsRemoved++;
      } else {
        issues.push(`Cannot remove invalid card ${card.id} - has ${hasRelatedData} listings`);
      }
    }

    console.log(`✅ Card deduplication complete: ${duplicatesRemoved} duplicates, ${invalidRecordsRemoved} invalid records removed`);

    return {
      duplicatesRemoved,
      invalidRecordsRemoved,
      totalRecordsProcessed,
      issues
    };
  }

  /**
   * Remove duplicate listings
   */
  async deduplicateListings(): Promise<DeduplicationResult> {
    const issues: string[] = [];
    let duplicatesRemoved = 0;
    let invalidRecordsRemoved = 0;
    let totalRecordsProcessed = 0;

    console.log('🔍 Starting listing deduplication...');

    // Find duplicate listings by source + externalId
    const duplicateGroups = await this.prisma.$queryRaw`
      SELECT source, "externalId", COUNT(*) as count
      FROM "Listing"
      GROUP BY source, "externalId"
      HAVING COUNT(*) > 1
    ` as Array<{ source: string; externalId: string; count: number }>;

    console.log(`Found ${duplicateGroups.length} duplicate listing groups`);

    for (const group of duplicateGroups) {
      const duplicateListings = await this.prisma.listing.findMany({
        where: {
          source: group.source,
          externalId: group.externalId
        },
        orderBy: [
          { isVerified: 'desc' },
          { scrapedAt: 'desc' }
        ]
      });

      // Keep the most recent verified listing, remove the rest
      const listingsToRemove = duplicateListings.slice(1);
      
      for (const listing of listingsToRemove) {
        await this.prisma.listing.delete({
          where: { id: listing.id }
        });
        duplicatesRemoved++;
      }

      totalRecordsProcessed += duplicateListings.length;
    }

    // Remove invalid listings
    const invalidListings = await this.prisma.listing.findMany({
      where: {
        OR: [
          { price: { lte: 0 } },
          { source: { equals: '' } },
          { externalId: { equals: '' } },
          { url: { equals: '' } }
        ]
      }
    });

    for (const listing of invalidListings) {
      await this.prisma.listing.delete({
        where: { id: listing.id }
      });
      invalidRecordsRemoved++;
    }

    console.log(`✅ Listing deduplication complete: ${duplicatesRemoved} duplicates, ${invalidRecordsRemoved} invalid records removed`);

    return {
      duplicatesRemoved,
      invalidRecordsRemoved,
      totalRecordsProcessed,
      issues
    };
  }

  /**
   * Remove duplicate market listings
   */
  async deduplicateMarketListings(): Promise<DeduplicationResult> {
    const issues: string[] = [];
    let duplicatesRemoved = 0;
    let invalidRecordsRemoved = 0;
    let totalRecordsProcessed = 0;

    console.log('🔍 Starting market listing deduplication...');

    // Find duplicate market listings by source + sourceId
    const duplicateGroups = await this.prisma.$queryRaw`
      SELECT source, "sourceId", COUNT(*) as count
      FROM "MarketListing"
      GROUP BY source, "sourceId"
      HAVING COUNT(*) > 1
    ` as Array<{ source: string; sourceId: string; count: number }>;

    console.log(`Found ${duplicateGroups.length} duplicate market listing groups`);

    for (const group of duplicateGroups) {
      const duplicateListings = await this.prisma.marketListing.findMany({
        where: {
          source: group.source,
          sourceId: group.sourceId
        },
        orderBy: [
          { seenAt: 'desc' }
        ]
      });

      // Keep the most recent listing, remove the rest
      const listingsToRemove = duplicateListings.slice(1);
      
      for (const listing of listingsToRemove) {
        await this.prisma.marketListing.delete({
          where: { id: listing.id }
        });
        duplicatesRemoved++;
      }

      totalRecordsProcessed += duplicateListings.length;
    }

    // Remove invalid market listings
    const invalidListings = await this.prisma.marketListing.findMany({
      where: {
        OR: [
          { priceCents: { lte: 0 } },
          { source: { equals: '' } },
          { sourceId: { equals: '' } },
          { url: { equals: '' } }
        ]
      }
    });

    for (const listing of invalidListings) {
      await this.prisma.marketListing.delete({
        where: { id: listing.id }
      });
      invalidRecordsRemoved++;
    }

    console.log(`✅ Market listing deduplication complete: ${duplicatesRemoved} duplicates, ${invalidRecordsRemoved} invalid records removed`);

    return {
      duplicatesRemoved,
      invalidRecordsRemoved,
      totalRecordsProcessed,
      issues
    };
  }

  /**
   * Remove orphaned records
   */
  async removeOrphanedRecords(): Promise<DeduplicationResult> {
    const issues: string[] = [];
    let duplicatesRemoved = 0;
    let invalidRecordsRemoved = 0;
    let totalRecordsProcessed = 0;

    console.log('🔍 Starting orphaned record cleanup...');

    // Remove listings without valid cards
    const orphanedListings = await this.prisma.listing.findMany({
      where: {
        card: null
      }
    });

    for (const listing of orphanedListings) {
      await this.prisma.listing.delete({
        where: { id: listing.id }
      });
      invalidRecordsRemoved++;
    }

    // Remove opportunities without valid cards or listings
    const orphanedOpportunities = await this.prisma.opportunity.findMany({
      where: {
        OR: [
          { card: null },
          { listing: null }
        ]
      }
    });

    for (const opportunity of orphanedOpportunities) {
      await this.prisma.opportunity.delete({
        where: { id: opportunity.id }
      });
      invalidRecordsRemoved++;
    }

    // Remove signals without valid cards or listings
    const orphanedSignals = await this.prisma.signal.findMany({
      where: {
        OR: [
          { card: null },
          { listing: null }
        ]
      }
    });

    for (const signal of orphanedSignals) {
      await this.prisma.signal.delete({
        where: { id: signal.id }
      });
      invalidRecordsRemoved++;
    }

    console.log(`✅ Orphaned record cleanup complete: ${invalidRecordsRemoved} orphaned records removed`);

    return {
      duplicatesRemoved,
      invalidRecordsRemoved,
      totalRecordsProcessed,
      issues
    };
  }

  /**
   * Run complete deduplication process
   */
  async runCompleteDeduplication(): Promise<{
    totalDuplicatesRemoved: number;
    totalInvalidRemoved: number;
    totalProcessed: number;
    allIssues: string[];
  }> {
    console.log('🚀 Starting complete data deduplication...');

    const cardResult = await this.deduplicateCards();
    const listingResult = await this.deduplicateListings();
    const marketListingResult = await this.deduplicateMarketListings();
    const orphanResult = await this.removeOrphanedRecords();

    const totalDuplicatesRemoved = 
      cardResult.duplicatesRemoved + 
      listingResult.duplicatesRemoved + 
      marketListingResult.duplicatesRemoved;

    const totalInvalidRemoved = 
      cardResult.invalidRecordsRemoved + 
      listingResult.invalidRecordsRemoved + 
      marketListingResult.invalidRecordsRemoved + 
      orphanResult.invalidRecordsRemoved;

    const totalProcessed = 
      cardResult.totalRecordsProcessed + 
      listingResult.totalRecordsProcessed + 
      marketListingResult.totalRecordsProcessed + 
      orphanResult.totalRecordsProcessed;

    const allIssues = [
      ...cardResult.issues,
      ...listingResult.issues,
      ...marketListingResult.issues,
      ...orphanResult.issues
    ];

    console.log(`✅ Complete deduplication finished:`);
    console.log(`   - ${totalDuplicatesRemoved} duplicates removed`);
    console.log(`   - ${totalInvalidRemoved} invalid records removed`);
    console.log(`   - ${totalProcessed} total records processed`);
    console.log(`   - ${allIssues.length} issues encountered`);

    return {
      totalDuplicatesRemoved,
      totalInvalidRemoved,
      totalProcessed,
      allIssues
    };
  }
}
