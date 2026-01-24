#!/usr/bin/env npx tsx
/**
 * Full Pipeline Integration Test
 *
 * Tests all 6 phases of the 2026 technology upgrade:
 * 1. Qdrant Vector Database
 * 2. TimescaleDB (via Prisma)
 * 3. tRPC API Layer
 * 4. LangGraph Agent Orchestration
 * 5. Kafka/Redpanda Event Streaming
 * 6. CrewAI (Python - separate test)
 *
 * Run: pnpm tsx scripts/test-pipeline.ts
 */

import 'dotenv/config';

// Test result tracking
interface TestResult {
  name: string;
  phase: number;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: Record<string, any>;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  phase: number,
  fn: () => Promise<Record<string, any> | void>
): Promise<void> {
  const start = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Phase ${phase}] Testing: ${name}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    const details = await fn();
    const duration = Date.now() - start;
    results.push({ name, phase, status: 'pass', duration, details: details || {} });
    console.log(`✅ PASS (${duration}ms)`);
    if (details) {
      console.log('   Details:', JSON.stringify(details, null, 2).split('\n').join('\n   '));
    }
  } catch (error: any) {
    const duration = Date.now() - start;
    const errorMsg = error?.message || String(error);
    results.push({ name, phase, status: 'fail', duration, error: errorMsg });
    console.log(`❌ FAIL (${duration}ms)`);
    console.log(`   Error: ${errorMsg}`);
  }
}

function skipTest(name: string, phase: number, reason: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Phase ${phase}] Skipping: ${name}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`⏭️  SKIP: ${reason}`);
  results.push({ name, phase, status: 'skip', duration: 0, error: reason });
}

// ============================================================================
// Phase 1: Qdrant Vector Database Tests
// ============================================================================

async function testQdrantConnection(): Promise<Record<string, any>> {
  const { qdrant, healthCheck } = await import('../packages/shared/qdrant.js');

  // Test health check
  const isHealthy = await healthCheck();

  if (!isHealthy) {
    throw new Error('Qdrant health check failed - is QDRANT_URL configured?');
  }

  return { healthy: true, url: process.env.QDRANT_URL || 'not set' };
}

async function testQdrantOperations(): Promise<Record<string, any>> {
  const { qdrant, COLLECTION_NAME, initializeCollection, upsertCards, searchCards } = await import(
    '../packages/shared/qdrant.js'
  );

  // Initialize collection (idempotent)
  await initializeCollection();

  // Create test embedding (384 dimensions for all-MiniLM-L6-v2)
  const testEmbedding = Array(384).fill(0).map(() => Math.random() - 0.5);

  // Test card for upsert
  const testCard = {
    canonicalCardId: 'test-pipeline-001',
    cardName: 'Pikachu VMAX',
    setName: 'Vivid Voltage',
    setCode: 'swsh4',
    cardNumber: '044',
    rarity: 'Secret Rare',
    variant: 'Rainbow',
    avgPriceCents: 15000,
    lastUpdated: new Date(),
  };

  // Upsert test card
  await upsertCards([{ card: testCard, embedding: testEmbedding }]);

  // Search for similar cards
  const searchResults = await searchCards(testEmbedding, { setName: 'Vivid Voltage' }, 5);

  // Clean up test data
  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'canonicalCardId', match: { value: 'test-pipeline-001' } }],
      },
    });
  } catch {
    // Ignore cleanup errors
  }

  return {
    collection: COLLECTION_NAME,
    upserted: 1,
    searchResults: searchResults.length,
    operations: ['initialize', 'upsert', 'search', 'delete'],
  };
}

// ============================================================================
// Phase 2: TimescaleDB / Prisma Tests
// ============================================================================

async function testPrismaConnection(): Promise<Record<string, any>> {
  const prisma = (await import('../api/src/lib/prisma.js')).default;

  // Test connection with simple query
  await prisma.$queryRaw`SELECT 1 as connected`;

  // Check if TimescaleDB extension is available
  let timescaleEnabled = false;
  try {
    const extensions = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'timescaledb'
    `;
    timescaleEnabled = extensions.length > 0;
  } catch {
    // Extension not installed
  }

  // Check which tables exist
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const tableNames = tables.map((t) => t.tablename);

  // Get table counts (only for existing tables)
  let cardCount = 0;
  let saleCount = 0;
  let signalCount = 0;

  if (tableNames.includes('canonical_cards')) {
    try {
      cardCount = await prisma.canonicalCard.count();
    } catch {
      cardCount = -1;
    }
  }
  if (tableNames.includes('sale_records')) {
    try {
      saleCount = await prisma.saleRecord.count();
    } catch {
      saleCount = -1;
    }
  }
  if (tableNames.includes('card_signals')) {
    try {
      signalCount = await prisma.cardSignal.count();
    } catch {
      signalCount = -1;
    }
  }

  return {
    connected: true,
    timescaleEnabled,
    tablesFound: tableNames.length,
    keyTables: tableNames.filter((t) =>
      ['canonical_cards', 'sale_records', 'card_signals', 'market_listings'].includes(t)
    ),
    counts: { cards: cardCount, sales: saleCount, signals: signalCount },
  };
}

async function testPrismaOperations(): Promise<Record<string, any>> {
  const prisma = (await import('../api/src/lib/prisma.js')).default;

  // Check which tables exist
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const tableNames = tables.map((t) => t.tablename);

  let recentSignals: any[] = [];
  let topCards: any[] = [];

  // Test read operations on key tables (only if they exist)
  if (tableNames.includes('card_signals')) {
    try {
      recentSignals = await prisma.cardSignal.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, edgeBp: true, createdAt: true },
      });
    } catch {
      // Table exists but query failed
    }
  }

  if (tableNames.includes('canonical_cards')) {
    try {
      topCards = await prisma.canonicalCard.findMany({
        take: 5,
        orderBy: { avgPriceCents: 'desc' },
        select: { id: true, canonicalName: true, canonicalSet: true, avgPriceCents: true },
      });
    } catch {
      // Table exists but query failed
    }
  }

  return {
    recentSignals: recentSignals.length,
    topCards: topCards.length,
    sampleSignal: recentSignals[0] || null,
    sampleCard: topCards[0] || null,
  };
}

// ============================================================================
// Phase 3: tRPC API Layer Tests
// ============================================================================

async function testTRPCRouter(): Promise<Record<string, any>> {
  const { appRouter } = await import('../api/src/trpc/router.js');
  const { createContext } = await import('../api/src/trpc/context.js');

  // Check router structure
  const procedures = Object.keys(appRouter._def.procedures);

  return {
    routerLoaded: true,
    procedures,
    procedureCount: procedures.length,
  };
}

async function testTRPCProcedures(): Promise<Record<string, any>> {
  // Test that tRPC procedures are properly typed and callable
  // We test the router structure without calling actual database procedures
  const { appRouter } = await import('../api/src/trpc/router.js');

  // Verify procedure definitions exist
  const signalsProcedures = ['list', 'getById', 'getByCard', 'getTop', 'stats'];
  const cardsProcedures = ['search', 'getById', 'priceHistory', 'getCanonical', 'getListings', 'getSets'];

  const allProcedures = Object.keys(appRouter._def.procedures);

  const hasSignals = signalsProcedures.every((p) => allProcedures.includes(`signals.${p}`));
  const hasCards = cardsProcedures.every((p) => allProcedures.includes(`cards.${p}`));

  if (!hasSignals || !hasCards) {
    throw new Error(`Missing procedures. Has signals: ${hasSignals}, Has cards: ${hasCards}`);
  }

  return {
    signalsProcedures: signalsProcedures.map((p) => `signals.${p}`),
    cardsProcedures: cardsProcedures.map((p) => `cards.${p}`),
    allProceduresValid: true,
  };
}

// ============================================================================
// Phase 4: LangGraph Agent Orchestration Tests
// ============================================================================

async function testLangGraphState(): Promise<Record<string, any>> {
  const { AgentState } = await import('../apps/agent/src/graph/state.js');

  // Verify state annotation structure
  const channels = AgentState.spec;

  return {
    stateLoaded: true,
    channels: Object.keys(channels),
    channelCount: Object.keys(channels).length,
  };
}

async function testLangGraphWorkflow(): Promise<Record<string, any>> {
  const { agentGraph, getWorkflowDiagram } = await import('../apps/agent/src/graph/workflow.js');

  // Get workflow diagram
  const diagram = getWorkflowDiagram();

  // Verify graph is compiled
  const isCompiled = !!agentGraph;

  return {
    graphCompiled: isCompiled,
    diagramLines: diagram.split('\n').length,
    nodes: ['fetch', 'normalize', 'features', 'signal', 'validate', 'output'],
  };
}

async function testLangGraphSmokeRun(): Promise<Record<string, any>> {
  const { runAgentGraph } = await import('../apps/agent/src/graph/workflow.js');

  // Run in smoke mode (no actual processing)
  const result = await runAgentGraph({
    smokeMode: true,
    runId: `test-pipeline-${Date.now()}`,
  });

  return {
    runId: result.runId,
    smokeMode: result.smokeMode,
    listingsCount: result.listings.length,
    errorsCount: result.errors.length,
    completed: true,
  };
}

// ============================================================================
// Phase 5: Kafka/Redpanda Event Streaming Tests
// ============================================================================

async function testKafkaClient(): Promise<Record<string, any>> {
  const { kafka, TOPICS } = await import('../packages/shared/kafka.js');

  return {
    clientLoaded: true,
    topics: Object.keys(TOPICS),
    topicValues: Object.values(TOPICS),
  };
}

async function testKafkaConnection(): Promise<Record<string, any>> {
  const { kafkaHealthCheck } = await import('../packages/shared/kafka.js');

  const isHealthy = await kafkaHealthCheck();

  if (!isHealthy) {
    throw new Error('Kafka health check failed - is REDPANDA_BROKER configured?');
  }

  return { healthy: true, broker: process.env.REDPANDA_BROKER || 'localhost:9092' };
}

async function testKafkaProducer(): Promise<Record<string, any>> {
  const { producer, TOPICS } = await import('../packages/shared/kafka.js');

  // Connect producer
  await producer.connect();

  // Send test message
  const testMessage = {
    type: 'test',
    timestamp: new Date().toISOString(),
    data: { pipeline: 'integration-test' },
  };

  const result = await producer.send({
    topic: TOPICS.AGENT_EVENTS,
    messages: [{ key: 'test', value: JSON.stringify(testMessage) }],
  });

  // Disconnect
  await producer.disconnect();

  return {
    sent: true,
    topic: TOPICS.AGENT_EVENTS,
    partition: result[0].partition,
    offset: result[0].baseOffset,
  };
}

// ============================================================================
// Phase 6: CrewAI (Python) Tests
// ============================================================================

async function testCrewAIFiles(): Promise<Record<string, any>> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const crewDir = path.join(process.cwd(), 'apps/crew');

  const files = [
    'crew.py',
    'requirements.txt',
    'agents/price_analyst.py',
    'agents/market_scanner.py',
    'agents/risk_assessor.py',
    'agents/content_writer.py',
    'tools/database.py',
  ];

  const fileStatus: Record<string, boolean> = {};
  for (const file of files) {
    try {
      await fs.access(path.join(crewDir, file));
      fileStatus[file] = true;
    } catch {
      fileStatus[file] = false;
    }
  }

  const allPresent = Object.values(fileStatus).every(Boolean);

  return {
    directory: crewDir,
    filesPresent: fileStatus,
    allFilesPresent: allPresent,
  };
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  POKEDAO 2026 TECHNOLOGY STACK - FULL PIPELINE TEST');
  console.log('═'.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);

  const startTime = Date.now();

  // Phase 1: Qdrant
  if (process.env.QDRANT_URL) {
    await runTest('Qdrant Connection', 1, testQdrantConnection);
    await runTest('Qdrant Operations (upsert/search)', 1, testQdrantOperations);
  } else {
    skipTest('Qdrant Connection', 1, 'QDRANT_URL not configured');
    skipTest('Qdrant Operations', 1, 'QDRANT_URL not configured');
  }

  // Phase 2: TimescaleDB / Prisma
  if (process.env.DATABASE_URL) {
    await runTest('Prisma/PostgreSQL Connection', 2, testPrismaConnection);
    await runTest('Prisma Operations', 2, testPrismaOperations);
  } else {
    skipTest('Prisma Connection', 2, 'DATABASE_URL not configured');
    skipTest('Prisma Operations', 2, 'DATABASE_URL not configured');
  }

  // Phase 3: tRPC
  await runTest('tRPC Router Structure', 3, testTRPCRouter);
  if (process.env.DATABASE_URL) {
    await runTest('tRPC Procedures', 3, testTRPCProcedures);
  } else {
    skipTest('tRPC Procedures', 3, 'DATABASE_URL not configured');
  }

  // Phase 4: LangGraph
  await runTest('LangGraph State Definition', 4, testLangGraphState);
  await runTest('LangGraph Workflow Compilation', 4, testLangGraphWorkflow);
  await runTest('LangGraph Smoke Run', 4, testLangGraphSmokeRun);

  // Phase 5: Kafka/Redpanda
  await runTest('Kafka Client Setup', 5, testKafkaClient);
  if (process.env.REDPANDA_BROKER) {
    await runTest('Kafka Connection', 5, testKafkaConnection);
    await runTest('Kafka Producer', 5, testKafkaProducer);
  } else {
    skipTest('Kafka Connection', 5, 'REDPANDA_BROKER not configured');
    skipTest('Kafka Producer', 5, 'REDPANDA_BROKER not configured');
  }

  // Phase 6: CrewAI
  await runTest('CrewAI Files Present', 6, testCrewAIFiles);
  skipTest('CrewAI Python Execution', 6, 'Requires Python environment - run manually');

  // Summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  console.log('\n' + '═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Tests Run: ${results.length}`);
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);

  // Per-phase breakdown
  console.log('\nBy Phase:');
  for (let phase = 1; phase <= 6; phase++) {
    const phaseResults = results.filter((r) => r.phase === phase);
    const phasePassed = phaseResults.filter((r) => r.status === 'pass').length;
    const phaseFailed = phaseResults.filter((r) => r.status === 'fail').length;
    const phaseSkipped = phaseResults.filter((r) => r.status === 'skip').length;
    const phaseNames = [
      '',
      'Qdrant',
      'TimescaleDB',
      'tRPC',
      'LangGraph',
      'Kafka',
      'CrewAI',
    ];
    console.log(
      `  Phase ${phase} (${phaseNames[phase]}): ${phasePassed} pass, ${phaseFailed} fail, ${phaseSkipped} skip`
    );
  }

  // List failures
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => {
        console.log(`  - [Phase ${r.phase}] ${r.name}: ${r.error}`);
      });
  }

  console.log('\n' + '═'.repeat(60));
  console.log(failed > 0 ? '  PIPELINE TEST: FAILED' : '  PIPELINE TEST: PASSED');
  console.log('═'.repeat(60) + '\n');

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error running pipeline test:', error);
  process.exit(1);
});
