/**
 * Harvest Pokemon card listings from Fanatics Collect auctions
 *
 * Uses GraphQL API to fetch active auction listings with pricing
 *
 * Run: pnpm tsx scripts/harvest-fanatics-collect.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';

const GRAPHQL_URL = 'https://app.fanaticscollect.com/graphql';
const WEB_URL = 'https://www.fanaticscollect.com';
const RATE_LIMIT_MS = 1000; // 1 second between requests

const AUCTIONS_QUERY = `
  query webGlobalAuctionsQuery {
    collectGlobalAuctions {
      id
      integerId
      name
      shortName
      status
      startsAt
      endsAt
    }
  }
`;

const LISTINGS_QUERY = `
  query webListingsQuery($input: CollectListingSearchInput!) {
    collectListings(input: $input) {
      id
      title
      subtitle
      status
      bidCount
      currentBid {
        amountInCents
        currency
      }
      auction {
        id
        name
        status
        endsAt
      }
      imageSets {
        medium
        small
        thumbnail
      }
      certifiedSeller
      favoritedCount
      collectSales {
        id
        finalPrice {
          amountInCents
          currency
        }
        soldAt
      }
      states {
        isClosed
        isFanaticsAuthentic
        isGreatPrice
      }
    }
  }
`;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function graphqlRequest(query: string, variables: any = {}): Promise<any> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PokeDAO/1.0.0',
      'Referer': WEB_URL,
      'Origin': WEB_URL,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fanatics API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data = await response.json();
  return data;
}

async function harvestFanatics() {
  const startTime = Date.now();

  console.log('🚀 FANATICS COLLECT HARVESTER');
  console.log('='.repeat(60));
  console.log(`📡 GraphQL: ${GRAPHQL_URL}`);
  console.log(`🎯 Target: Pokemon card auctions`);
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Fetch all auctions
  console.log('📥 Fetching active auctions...');
  const auctionsData = await graphqlRequest(AUCTIONS_QUERY);
  const allAuctions = auctionsData?.data?.collectGlobalAuctions || [];

  const liveAuctions = allAuctions.filter((a: any) =>
    a.status === 'LIVE' || a.status === 'PREVIEW'
  );

  console.log(`  ✓ Found ${allAuctions.length} total auctions`);
  console.log(`  ✓ ${liveAuctions.length} are LIVE or PREVIEW`);
  console.log('');

  if (liveAuctions.length === 0) {
    console.log('⚠️  No live auctions found');
    return;
  }

  // Step 2: Fetch listings from live auctions
  const auctionIds = liveAuctions.map((a: any) => a.id);
  let totalListings = 0;
  let pokemonListings = 0;
  let savedListings = 0;

  console.log('📥 Fetching listings from live auctions...');

  const variables = {
    input: {
      auctionIds: auctionIds,
      first: 100, // Max per request
    },
  };

  const listingsData = await graphqlRequest(LISTINGS_QUERY, variables);
  const listings = listingsData?.data?.collectListings || [];

  totalListings = listings.length;
  console.log(`  ✓ Found ${totalListings} total listings`);
  console.log('');

  // Step 3: Filter for Pokemon and save to database
  console.log('💾 Processing listings...');

  for (const listing of listings) {
    try {
      const title = listing.title?.toLowerCase() || '';

      // Filter for Pokemon cards
      if (!title.includes('pokemon') && !title.includes('pokémon')) {
        continue;
      }

      pokemonListings++;

      // Extract price
      const priceCents = listing.currentBid?.amountInCents || 0;

      // Parse card name and set from title
      const fullTitle = listing.title || '';
      const cardName = fullTitle.split('-')[0]?.trim() || 'Unknown';
      const setMatch = fullTitle.match(/(\d{4})\s+(.+?)\s+#/);
      const setName = setMatch ? setMatch[2].trim() : 'Unknown';

      // Save to database
      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'FANATICS',
            sourceId: listing.id.substring(0, 100),
          },
        },
        create: {
          id: `fanatics-${listing.id}`.substring(0, 191),
          source: 'FANATICS',
          sourceId: listing.id.substring(0, 100),
          title: fullTitle.substring(0, 500),
          rawTitle: fullTitle.substring(0, 255),
          cardName: cardName.substring(0, 255),
          setName: setName.substring(0, 255),
          cardNumber: null,
          variant: null,
          gradeCompany: null,
          grade: null,
          condition: null,
          priceCents: priceCents,
          currency: listing.currentBid?.currency || 'USD',
          url: `https://www.fanaticscollect.com/lot/${listing.id}`,
          dataQuality: 0.85,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          priceCents: priceCents,
          dataQuality: 0.85,
          updatedAt: new Date(),
        },
      });

      savedListings++;

      if (savedListings % 10 === 0) {
        console.log(`  💰 Saved ${savedListings} Pokemon listings...`);
      }

    } catch (error: any) {
      console.error(`  ✗ Error processing listing ${listing.id}: ${error.message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total Listings Fetched: ${totalListings}`);
  console.log(`🎮 Pokemon Listings: ${pokemonListings}`);
  console.log(`💰 Saved to Database: ${savedListings}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));
}

harvestFanatics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
