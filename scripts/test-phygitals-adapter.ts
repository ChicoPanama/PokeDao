/**
 * Test script for Phygitals adapter
 *
 * Run: pnpm tsx scripts/test-phygitals-adapter.ts
 */

import { createPhygitalsClient, ingestPhygitalsData } from '../packages/adapters/src/phygitals/index.js';

async function main() {
  console.log('🚀 Testing Phygitals Adapter\n');

  // Test 1: Client connection
  console.log('Test 1: Creating Phygitals client...');
  const client = createPhygitalsClient({
    requestsPerSecond: 2,
  });
  console.log('✅ Client created\n');

  // Test 2: Get marketplace filters
  console.log('Test 2: Fetching marketplace filters...');
  try {
    const filters = await client.getMarketplaceFilters();
    console.log('✅ Filters retrieved:');
    console.log(`   - Sets: ${filters.sets?.length || 0}`);
    console.log(`   - Graders: ${filters.graders?.length || 0}`);
    console.log(`   - Grades: ${filters.grades?.length || 0}\n`);
  } catch (error: any) {
    console.error('❌ Failed to get filters:', error.message, '\n');
  }

  // Test 3: Search for a single Pokemon card
  console.log('Test 3: Searching for Charizard...');
  try {
    const response = await client.searchPokemon('charizard', {
      itemsPerPage: 5,
      page: 0,
    });
    console.log(`✅ Found ${response.total} Charizard listings`);
    console.log(`   - Fetched ${response.listings.length} in this page\n`);

    if (response.listings.length > 0) {
      const first = response.listings[0];
      console.log('   First listing:');
      console.log(`   - Name: ${first.name}`);
      console.log(`   - Price: $${first.price || 'N/A'}`);
      console.log(`   - Grader: ${first.grader || 'N/A'}`);
      console.log(`   - Grade: ${first.grade || 'N/A'}\n`);
    }
  } catch (error: any) {
    console.error('❌ Failed to search:', error.message, '\n');
  }

  // Test 4: Get graded cards (PSA 10)
  console.log('Test 4: Fetching PSA 10 graded cards...');
  try {
    const response = await client.getGradedCards('PSA', '10', {
      itemsPerPage: 10,
      page: 0,
    });
    console.log(`✅ Found ${response.total} PSA 10 cards`);
    console.log(`   - Fetched ${response.listings.length} in this page\n`);
  } catch (error: any) {
    console.error('❌ Failed to get graded cards:', error.message, '\n');
  }

  // Test 5: Full ingestion (limited)
  console.log('Test 5: Running limited ingestion (100 cards max)...');
  try {
    const result = await ingestPhygitalsData({
      maxPages: 1, // Only fetch 1 page
      itemsPerPage: 100,
      includeSales: true,
      maxSales: 50,
      onProgress: (current, total, type) => {
        console.log(`   Progress (${type}): ${current}/${total}`);
      },
    });

    console.log('\n✅ Ingestion complete:');
    console.log(`   - Listings: ${result.listings.length}`);
    console.log(`   - Sales: ${result.sales.length}`);
    console.log(`   - Source: ${result.metadata.source}`);
    console.log(`   - Fetched at: ${result.metadata.fetchedAt.toISOString()}\n`);

    // Sample listing
    if (result.listings.length > 0) {
      const sample = result.listings[0];
      console.log('   Sample listing (mapped to unified schema):');
      console.log(`   - Price (cents): ${sample.priceCents}`);
      console.log(`   - Venue: ${sample.venue}`);
      console.log(`   - Grader: ${sample.grader}`);
      console.log(`   - Grade: ${sample.grade}`);
      console.log(`   - Is Active: ${sample.isActive}`);
      console.log(`   - Source ID: ${sample.sourceId}\n`);
    }

    // Sample sale
    if (result.sales.length > 0) {
      const sample = result.sales[0];
      console.log('   Sample sale (mapped to unified schema):');
      console.log(`   - Price (cents): ${sample.priceCents}`);
      console.log(`   - Sold at: ${sample.soldAt.toISOString()}`);
      console.log(`   - Venue: ${sample.venue}\n`);
    }
  } catch (error: any) {
    console.error('❌ Failed ingestion:', error.message, '\n');
    console.error(error.stack);
  }

  console.log('🎉 All tests complete!');
}

main().catch(console.error);
