/**
 * Enrich Courtyard NFTs with pricing data from Polygon blockchain
 *
 * Strategy:
 * 1. Query Courtyard NFTs from database without prices
 * 2. Fetch metadata from IPFS/Arweave via Polygon RPC
 * 3. Parse card name, set, grade from metadata
 * 4. Check on-chain marketplace contracts for listing prices
 * 5. Update database with enriched data
 *
 * Run: pnpm tsx scripts/enrich-courtyard-pricing.ts
 */

import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';

const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const COURTYARD_CONTRACT = '0xd4ac3CE8e1E14CD60666D49AC34Ff2d2937cF6FA'; // Courtyard Registry
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 500;

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function polygonRpcCall(method: string, params: any[]): Promise<any> {
  const response = await fetch(POLYGON_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  const data: any = await response.json();
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }
  return data.result;
}

async function getTokenURI(tokenId: string): Promise<string | null> {
  try {
    // ERC-721 tokenURI(uint256) selector: 0xc87b56dd
    const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
    const result = await polygonRpcCall('eth_call', [
      {
        to: COURTYARD_CONTRACT,
        data: `0xc87b56dd${tokenIdHex}`,
      },
      'latest',
    ]);

    // Decode the response (ABI-encoded string)
    if (!result || result === '0x') return null;

    // Remove '0x' and parse hex string
    const hex = result.slice(2);
    // Skip first 64 chars (offset pointer) and next 64 (length), then decode
    const dataStart = 128; // 64 * 2
    const uri = Buffer.from(hex.slice(dataStart), 'hex')
      .toString('utf8')
      .replace(/\0/g, ''); // Remove null bytes

    return uri;
  } catch (error: any) {
    console.error(`  ✗ Error getting tokenURI for ${tokenId}:`, error.message);
    return null;
  }
}

async function fetchMetadata(uri: string): Promise<NFTMetadata | null> {
  try {
    // Handle IPFS URIs
    if (uri.startsWith('ipfs://')) {
      uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    const response = await fetch(uri, { timeout: 10000 });
    if (!response.ok) return null;

    const metadata = await response.json() as NFTMetadata;
    return metadata;
  } catch (error) {
    return null;
  }
}

function parseCardName(title: string, metadata?: NFTMetadata): string {
  if (metadata?.name && metadata.name !== 'Courtyard NFT') {
    // Try to extract card name from metadata
    const match = metadata.name.match(/^(.+?)\s+(?:PSA|CGC|BGS)/i);
    if (match) return match[1].trim();

    // Look for attributes
    const cardAttr = metadata.attributes?.find(
      (a) => a.trait_type.toLowerCase() === 'card' || a.trait_type.toLowerCase() === 'name'
    );
    if (cardAttr) return String(cardAttr.value);
  }

  return 'Unknown';
}

function parseSetName(metadata?: NFTMetadata): string {
  const setAttr = metadata?.attributes?.find(
    (a) => a.trait_type.toLowerCase() === 'set' || a.trait_type.toLowerCase() === 'series'
  );
  if (setAttr) return String(setAttr.value);
  return 'Unknown';
}

function parseGrade(metadata?: NFTMetadata): number | null {
  const gradeAttr = metadata?.attributes?.find(
    (a) => a.trait_type.toLowerCase() === 'grade'
  );
  if (gradeAttr) {
    const gradeVal = String(gradeAttr.value);
    const match = gradeVal.match(/(\d+\.?\d*)/);
    if (match) return parseFloat(match[1]);
  }

  // Try parsing from name
  if (metadata?.name) {
    const match = metadata.name.match(/(?:PSA|CGC|BGS)\s+(\d+\.?\d*)/i);
    if (match) return parseFloat(match[1]);
  }

  return null;
}

function parseGradeCompany(metadata?: NFTMetadata): 'PSA' | 'CGC' | 'BGS' | null {
  const gradeAttr = metadata?.attributes?.find(
    (a) => a.trait_type.toLowerCase() === 'grading company' ||
           a.trait_type.toLowerCase() === 'grader'
  );
  if (gradeAttr) {
    const val = String(gradeAttr.value).toUpperCase();
    if (val.includes('PSA')) return 'PSA';
    if (val.includes('CGC')) return 'CGC';
    if (val.includes('BGS')) return 'BGS';
  }

  // Try parsing from name
  if (metadata?.name) {
    if (/\bPSA\b/i.test(metadata.name)) return 'PSA';
    if (/\bCGC\b/i.test(metadata.name)) return 'CGC';
    if (/\bBGS\b/i.test(metadata.name)) return 'BGS';
  }

  return null;
}

async function enrichCourtyard() {
  console.log('🔍 COURTYARD NFT ENRICHMENT');
  console.log('='.repeat(60));
  console.log(`📡 Polygon RPC: ${POLYGON_RPC}`);
  console.log(`📜 Contract: ${COURTYARD_CONTRACT}`);
  console.log('='.repeat(60));
  console.log('');

  // Get all Courtyard NFTs without proper metadata
  const nfts = await prisma.unifiedMarketListing.findMany({
    where: {
      source: 'COURTYARD',
      cardName: 'Unknown',
    },
    take: 1000, // Process first 1000 for now
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${nfts.length} NFTs to enrich`);
  console.log('');

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];

    if ((i + 1) % 10 === 0) {
      console.log(`📈 Progress: ${i + 1}/${nfts.length} (${enriched} enriched, ${failed} failed)`);
    }

    try {
      // Get token URI from blockchain
      const tokenURI = await getTokenURI(nft.sourceId);
      if (!tokenURI) {
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Fetch metadata
      const metadata = await fetchMetadata(tokenURI);
      if (!metadata) {
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Parse card details
      const cardName = parseCardName(nft.title, metadata);
      const setName = parseSetName(metadata);
      const grade = parseGrade(metadata);
      const gradeCompany = parseGradeCompany(metadata);

      // Update database (price still 0, but metadata is enriched)
      await prisma.unifiedMarketListing.update({
        where: { id: nft.id },
        data: {
          cardName: cardName.substring(0, 255),
          setName: setName.substring(0, 255),
          grade: grade,
          gradeCompany: gradeCompany,
          dataQuality: cardName !== 'Unknown' ? 0.8 : 0.3,
        },
      });

      enriched++;
      await sleep(RATE_LIMIT_MS);

    } catch (error: any) {
      console.error(`  ✗ Error enriching NFT ${nft.sourceId}:`, error.message);
      failed++;
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ENRICHMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total: ${nfts.length}`);
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

enrichCourtyard().catch(console.error);
