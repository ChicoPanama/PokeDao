#!/usr/bin/env tsx

import { Database } from 'better-sqlite3';
import axios from 'axios';
import fs from 'fs';

interface PokemonTCGCard {
  id: string;
  name: string;
  nationalPokedexNumbers: number[];
  images: {
    small: string;
    large: string;
  };
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    updatedAt: string;
  };
  number: string;
  rarity: string;
  subtypes: string[];
  types: string[];
  hp?: string;
  attacks?: any[];
  weaknesses?: any[];
  resistances?: any[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  level?: string;
  abilities?: any[];
  ancientTrait?: any;
  evolvesFrom?: string;
  evolvesTo?: string[];
  regulationMark?: string;
  legalities: {
    unlimited: string;
    standard?: string;
    expanded?: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      holofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      normal?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      reverseHolofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
    };
  };
}

interface CrossReferenceResult {
  ebayId: string;
  pokemonTcgId?: string;
  matchConfidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'none';
  matchedFields: {
    name: boolean;
    set: boolean;
    number: boolean;
  };
  pokemonTcgData?: PokemonTCGCard;
  discrepancies: string[];
}

interface MatchingStats {
  totalProcessed: number;
  exactMatches: number;
  fuzzyMatches: number;
  partialMatches: number;
  noMatches: number;
  averageConfidence: number;
  topDiscrepancies: { [key: string]: number };
}

class EBayCrossReferenceMatcher {
  private db: Database;
  private pokemonTCGAPI: string;
  private stats: MatchingStats;
  private pokemonCache: Map<string, PokemonTCGCard[]>;

  constructor(dbPath: string, pokemonTCGAPIKey?: string) {
    this.db = new Database(dbPath);
    this.pokemonTCGAPI = pokemonTCGAPIKey || 'https://api.pokemontcg.io/v2';
    this.stats = {
      totalProcessed: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      partialMatches: 0,
      noMatches: 0,
      averageConfidence: 0,
      topDiscrepancies: {}
    };
    this.pokemonCache = new Map();
  }

  async matchWithPokemonTCG(batchSize: number = 100, startId: number = 0): Promise<MatchingStats> {
    console.log('🔗 Starting eBay to Pokemon TCG API cross-reference matching...\n');

    // Create cross-reference table if it doesn't exist
    this.createCrossReferenceTable();

    // Get total count for progress tracking
    const totalCount = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings_cleaned 
      WHERE id >= ? AND confidence_score > 0.5
    `).get(startId).count;

    console.log(`📊 Processing ${totalCount.toLocaleString()} high-confidence records starting from ID ${startId}\n`);

    let processed = 0;
    let offset = startId;

    while (processed < totalCount) {
      const batch = this.db.prepare(`
        SELECT * FROM ebay_current_listings_cleaned 
        WHERE id >= ? AND confidence_score > 0.5
        ORDER BY id 
        LIMIT ?
      `).all(offset, batchSize);

      if (batch.length === 0) break;

      console.log(`🔄 Processing batch: ${processed + 1}-${processed + batch.length} of ${totalCount}`);

      for (const record of batch) {
        try {
          const matchResult = await this.matchRecord(record);
          this.insertCrossReference(matchResult);
          this.updateStats(matchResult);
        } catch (error) {
          console.error(`❌ Failed to match record ${record.id}:`, error);
        }
        
        this.stats.totalProcessed++;
        
        // Rate limiting - pause between API calls
        await this.sleep(100);
      }

      processed += batch.length;
      offset = batch[batch.length - 1].id + 1;

      // Log progress every 10 batches
      if (Math.floor(processed / batchSize) % 10 === 0) {
        this.logProgress();
      }
    }

    this.calculateFinalStats();
    this.logFinalReport();

    return this.stats;
  }

  private createCrossReferenceTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ebay_pokemon_tcg_cross_reference (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ebay_id TEXT UNIQUE,
        pokemon_tcg_id TEXT,
        match_confidence REAL,
        match_type TEXT,
        matched_name BOOLEAN,
        matched_set BOOLEAN,
        matched_number BOOLEAN,
        pokemon_tcg_data TEXT, -- JSON data
        discrepancies TEXT, -- JSON array
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_ebay_id (ebay_id),
        INDEX idx_pokemon_tcg_id (pokemon_tcg_id),
        INDEX idx_match_confidence (match_confidence),
        INDEX idx_match_type (match_type)
      )
    `);
  }

  private async matchRecord(record: any): Promise<CrossReferenceResult> {
    const result: CrossReferenceResult = {
      ebayId: record.ebay_item_id,
      matchConfidence: 0,
      matchType: 'none',
      matchedFields: { name: false, set: false, number: false },
      discrepancies: []
    };

    // Skip if essential data is missing
    if (!record.cleaned_pokemon_name) {
      return result;
    }

    try {
      // Search Pokemon TCG API
      const pokemonCards = await this.searchPokemonTCG(record.cleaned_pokemon_name);
      
      if (pokemonCards.length === 0) {
        return result;
      }

      // Find best match
      const bestMatch = this.findBestMatch(record, pokemonCards);
      
      if (bestMatch) {
        result.pokemonTcgId = bestMatch.card.id;
        result.pokemonTcgData = bestMatch.card;
        result.matchConfidence = bestMatch.confidence;
        result.matchType = bestMatch.type;
        result.matchedFields = bestMatch.matchedFields;
        result.discrepancies = bestMatch.discrepancies;
      }

    } catch (error) {
      console.error(`API error for record ${record.id}:`, error);
    }

    return result;
  }

  private async searchPokemonTCG(pokemonName: string): Promise<PokemonTCGCard[]> {
    // Check cache first
    const cacheKey = pokemonName.toLowerCase();
    if (this.pokemonCache.has(cacheKey)) {
      return this.pokemonCache.get(cacheKey)!;
    }

    try {
      const response = await axios.get(`${this.pokemonTCGAPI}/cards`, {
        params: {
          q: `name:"${pokemonName}"`,
          pageSize: 50,
          orderBy: 'name'
        },
        headers: {
          'Accept': 'application/json'
        }
      });

      const cards = response.data.data || [];
      this.pokemonCache.set(cacheKey, cards);
      return cards;

    } catch (error) {
      console.error(`Pokemon TCG API error for "${pokemonName}":`, error);
      return [];
    }
  }

  private findBestMatch(record: any, pokemonCards: PokemonTCGCard[]): {
    card: PokemonTCGCard;
    confidence: number;
    type: 'exact' | 'fuzzy' | 'partial';
    matchedFields: { name: boolean; set: boolean; number: boolean };
    discrepancies: string[];
  } | null {
    let bestMatch = null;
    let bestScore = 0;

    for (const card of pokemonCards) {
      const match = this.calculateMatchScore(record, card);
      
      if (match.score > bestScore) {
        bestScore = match.score;
        bestMatch = {
          card,
          confidence: match.score,
          type: match.type,
          matchedFields: match.matchedFields,
          discrepancies: match.discrepancies
        };
      }
    }

    return bestMatch;
  }

  private calculateMatchScore(record: any, card: PokemonTCGCard): {
    score: number;
    type: 'exact' | 'fuzzy' | 'partial';
    matchedFields: { name: boolean; set: boolean; number: boolean };
    discrepancies: string[];
  } {
    let score = 0;
    const matchedFields = { name: false, set: false, number: false };
    const discrepancies: string[] = [];

    // Name matching (highest weight)
    const recordName = record.cleaned_pokemon_name?.toLowerCase();
    const cardName = card.name.toLowerCase();
    
    if (recordName === cardName) {
      score += 0.5;
      matchedFields.name = true;
    } else if (this.isFuzzyNameMatch(recordName, cardName)) {
      score += 0.3;
      matchedFields.name = true;
      discrepancies.push(`Name mismatch: "${record.cleaned_pokemon_name}" vs "${card.name}"`);
    }

    // Set matching
    if (record.cleaned_set_code && card.set.id) {
      if (this.isSetMatch(record.cleaned_set_code, card.set.id, card.set.name)) {
        score += 0.3;
        matchedFields.set = true;
      } else {
        discrepancies.push(`Set mismatch: "${record.cleaned_set_name}" vs "${card.set.name}"`);
      }
    }

    // Card number matching
    if (record.cleaned_card_number && card.number) {
      if (this.isNumberMatch(record.cleaned_card_number, card.number)) {
        score += 0.2;
        matchedFields.number = true;
      } else {
        discrepancies.push(`Number mismatch: "${record.cleaned_card_number}" vs "${card.number}"`);
      }
    }

    // Determine match type
    let type: 'exact' | 'fuzzy' | 'partial' = 'partial';
    if (score >= 0.8 && matchedFields.name && matchedFields.set && matchedFields.number) {
      type = 'exact';
    } else if (score >= 0.6 && matchedFields.name) {
      type = 'fuzzy';
    }

    return {
      score,
      type,
      matchedFields,
      discrepancies
    };
  }

  private isFuzzyNameMatch(recordName: string, cardName: string): boolean {
    // Handle common variations
    const variations: { [key: string]: string[] } = {
      'charizard': ['charizard'],
      'pikachu': ['pikachu'],
      'mew': ['mew'],
      'mewtwo': ['mewtwo'],
      'blastoise': ['blastoise'],
      'venusaur': ['venusaur']
    };

    const variations_list = variations[recordName] || [recordName];
    return variations_list.some(variation => cardName.includes(variation));
  }

  private isSetMatch(recordSetCode: string, cardSetId: string, cardSetName: string): boolean {
    // Direct code match
    if (recordSetCode.toLowerCase() === cardSetId.toLowerCase()) {
      return true;
    }

    // Name-based matching
    const setNameMappings: { [key: string]: string[] } = {
      'BS1': ['base', 'base set'],
      'JU': ['jungle'],
      'FO': ['fossil'],
      'TR': ['team rocket'],
      'GH': ['gym heroes'],
      'GC': ['gym challenge'],
      'NG': ['neo genesis'],
      'ND': ['neo discovery', 'neo destiny'],
      'NR': ['neo revelation'],
      'RS': ['ruby', 'sapphire'],
      'DP': ['diamond', 'pearl'],
      'BW': ['black', 'white'],
      'XY': ['xy'],
      'SM': ['sun', 'moon'],
      'SS': ['sword', 'shield'],
      'SV': ['scarlet', 'violet']
    };

    const possibleNames = setNameMappings[recordSetCode] || [];
    const lowerSetName = cardSetName.toLowerCase();
    
    return possibleNames.some(name => lowerSetName.includes(name));
  }

  private isNumberMatch(recordNumber: string, cardNumber: string): boolean {
    // Remove common prefixes/suffixes
    const cleanRecord = recordNumber.replace(/[^\d]/g, '');
    const cleanCard = cardNumber.replace(/[^\d]/g, '');
    
    return cleanRecord === cleanCard;
  }

  private insertCrossReference(result: CrossReferenceResult) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ebay_pokemon_tcg_cross_reference (
        ebay_id, pokemon_tcg_id, match_confidence, match_type,
        matched_name, matched_set, matched_number,
        pokemon_tcg_data, discrepancies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.ebayId,
      result.pokemonTcgId,
      result.matchConfidence,
      result.matchType,
      result.matchedFields.name ? 1 : 0,
      result.matchedFields.set ? 1 : 0,
      result.matchedFields.number ? 1 : 0,
      result.pokemonTcgData ? JSON.stringify(result.pokemonTcgData) : null,
      JSON.stringify(result.discrepancies)
    );
  }

  private updateStats(result: CrossReferenceResult) {
    switch (result.matchType) {
      case 'exact':
        this.stats.exactMatches++;
        break;
      case 'fuzzy':
        this.stats.fuzzyMatches++;
        break;
      case 'partial':
        this.stats.partialMatches++;
        break;
      case 'none':
        this.stats.noMatches++;
        break;
    }

    // Track top discrepancies
    result.discrepancies.forEach(discrepancy => {
      const type = discrepancy.split(':')[0];
      this.stats.topDiscrepancies[type] = (this.stats.topDiscrepancies[type] || 0) + 1;
    });
  }

  private logProgress() {
    const progress = (this.stats.totalProcessed / (this.stats.totalProcessed + this.stats.noMatches)) * 100;
    console.log(`📈 Progress: ${progress.toFixed(1)}% - Processed: ${this.stats.totalProcessed.toLocaleString()}`);
    console.log(`   Exact: ${this.stats.exactMatches}, Fuzzy: ${this.stats.fuzzyMatches}, Partial: ${this.stats.partialMatches}, None: ${this.stats.noMatches}`);
  }

  private calculateFinalStats() {
    if (this.stats.totalProcessed > 0) {
      const totalMatches = this.stats.exactMatches + this.stats.fuzzyMatches + this.stats.partialMatches;
      this.stats.averageConfidence = totalMatches / this.stats.totalProcessed;
    }
  }

  private logFinalReport() {
    console.log('\n🎉 CROSS-REFERENCE MATCHING COMPLETE!\n');
    console.log('📊 MATCHING STATISTICS:');
    console.log(`   Total Processed: ${this.stats.totalProcessed.toLocaleString()}`);
    console.log(`   Exact Matches: ${this.stats.exactMatches.toLocaleString()}`);
    console.log(`   Fuzzy Matches: ${this.stats.fuzzyMatches.toLocaleString()}`);
    console.log(`   Partial Matches: ${this.stats.partialMatches.toLocaleString()}`);
    console.log(`   No Matches: ${this.stats.noMatches.toLocaleString()}`);
    console.log(`   Match Rate: ${((this.stats.exactMatches + this.stats.fuzzyMatches + this.stats.partialMatches) / this.stats.totalProcessed * 100).toFixed(1)}%\n`);

    if (Object.keys(this.stats.topDiscrepancies).length > 0) {
      console.log('🔍 TOP DISCREPANCIES:');
      const sortedDiscrepancies = Object.entries(this.stats.topDiscrepancies)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      sortedDiscrepancies.forEach(([type, count]) => {
        console.log(`   ${type}: ${count} occurrences`);
      });
      console.log('');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Export cross-reference data for analysis
  exportCrossReferenceData(limit?: number): CrossReferenceResult[] {
    const query = limit 
      ? `SELECT * FROM ebay_pokemon_tcg_cross_reference ORDER BY match_confidence DESC LIMIT ?`
      : `SELECT * FROM ebay_pokemon_tcg_cross_reference ORDER BY match_confidence DESC`;
    
    const params = limit ? [limit] : [];
    const rows = this.db.prepare(query).all(...params);
    
    return rows.map(row => ({
      ebayId: row.ebay_id,
      pokemonTcgId: row.pokemon_tcg_id,
      matchConfidence: row.match_confidence,
      matchType: row.match_type,
      matchedFields: {
        name: Boolean(row.matched_name),
        set: Boolean(row.matched_set),
        number: Boolean(row.matched_number)
      },
      pokemonTcgData: row.pokemon_tcg_data ? JSON.parse(row.pokemon_tcg_data) : undefined,
      discrepancies: row.discrepancies ? JSON.parse(row.discrepancies) : []
    }));
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const dbPath = process.argv[2] || 'research/tcgplayer-discovery/collector_crypt_ebay_complete.db';
  const batchSize = parseInt(process.argv[3]) || 100;
  const startId = parseInt(process.argv[4]) || 0;
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  const matcher = new EBayCrossReferenceMatcher(dbPath);
  
  try {
    const stats = await matcher.matchWithPokemonTCG(batchSize, startId);
    
    // Save statistics
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/ebay-cross-reference-stats.json', JSON.stringify(stats, null, 2));
    
    // Export sample of cross-reference data
    const sampleData = matcher.exportCrossReferenceData(1000);
    fs.writeFileSync('reports/ebay-cross-reference-sample.json', JSON.stringify(sampleData, null, 2));
    
    console.log('\n✅ Cross-reference matching complete! Reports saved to reports/ directory');
    
  } catch (error) {
    console.error('❌ Cross-reference matching failed:', error);
    process.exit(1);
  } finally {
    matcher.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EBayCrossReferenceMatcher, CrossReferenceResult, MatchingStats };
