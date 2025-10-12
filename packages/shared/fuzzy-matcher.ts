/**
 * Fuzzy Matching Utility
 *
 * Provides string similarity matching for set names, card names, and variants.
 * Uses Levenshtein distance and phonetic matching to handle typos and variations.
 *
 * MIT Recommendation: Handle data inconsistencies across sources
 * (e.g., "Base Set" vs "base-set" vs "BS" vs "1st Edition Base Set")
 *
 * Usage:
 *   const matcher = new FuzzyMatcher();
 *   await matcher.loadCanonicalSets();
 *   const normalized = matcher.normalizeSetName("Base Set 1st Ed"); // => "Base Set"
 */

// ============================================================================
// STRING SIMILARITY ALGORITHMS
// ============================================================================

/**
 * Levenshtein distance - minimum number of edits to transform one string to another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Similarity score (0-1) based on Levenshtein distance
 */
export function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  return 1 - distance / maxLen;
}

/**
 * Jaro-Winkler similarity (better for short strings)
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification (boost score for common prefixes)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ============================================================================
// CANONICAL DATA
// ============================================================================

/**
 * Canonical Pokemon TCG set names
 * Source: TCGdex API / Pokemon Company official
 */
export const CANONICAL_SETS: Record<string, string[]> = {
  'Base Set': ['base', 'bs', 'base set', 'baseSet', 'base-set', '1st edition base set', 'base 1'],
  'Jungle': ['jungle', 'jung', 'jungl'],
  'Fossil': ['fossil', 'foss', 'fosil'],
  'Base Set 2': ['base 2', 'base set 2', 'base-set-2', 'bs2'],
  'Team Rocket': ['team rocket', 'rocket', 'tr', 'teamrocket'],
  'Gym Heroes': ['gym heroes', 'gh', 'gym-heroes', 'heroes'],
  'Gym Challenge': ['gym challenge', 'gc', 'gym-challenge', 'challenge'],
  'Neo Genesis': ['neo genesis', 'ng', 'neo-genesis', 'genesis'],
  'Neo Discovery': ['neo discovery', 'nd', 'neo-discovery', 'discovery'],
  'Neo Revelation': ['neo revelation', 'nr', 'neo-revelation', 'revelation'],
  'Neo Destiny': ['neo destiny', 'nde', 'neo-destiny', 'destiny'],
  'Legendary Collection': ['legendary collection', 'lc', 'legendary', 'legendary-collection'],
  'Expedition Base Set': ['expedition', 'exp', 'expedition base'],
  'Aquapolis': ['aquapolis', 'aq'],
  'Skyridge': ['skyridge', 'sk'],
  'EX Ruby & Sapphire': ['ruby sapphire', 'rs', 'ex ruby', 'ruby-sapphire'],
  'EX Sandstorm': ['sandstorm', 'ss', 'ex sandstorm'],
  'EX Dragon': ['dragon', 'dr', 'ex dragon'],
  'EX Team Magma vs Team Aqua': ['magma aqua', 'ma', 'team magma'],
  'EX Hidden Legends': ['hidden legends', 'hl'],
  'EX FireRed & LeafGreen': ['firered leafgreen', 'fr lg', 'frlg'],
  'EX Team Rocket Returns': ['rocket returns', 'trr'],
  'EX Deoxys': ['deoxys', 'dx'],
  'EX Emerald': ['emerald', 'em'],
  'EX Unseen Forces': ['unseen forces', 'uf'],
  'EX Delta Species': ['delta species', 'ds'],
  'EX Legend Maker': ['legend maker', 'lm'],
  'EX Holon Phantoms': ['holon phantoms', 'hp'],
  'EX Crystal Guardians': ['crystal guardians', 'cg'],
  'EX Dragon Frontiers': ['dragon frontiers', 'df'],
  'EX Power Keepers': ['power keepers', 'pk'],
  'Diamond & Pearl': ['diamond pearl', 'dp', 'd&p'],
  'Mysterious Treasures': ['mysterious treasures', 'mt'],
  'Secret Wonders': ['secret wonders', 'sw'],
  'Great Encounters': ['great encounters', 'ge'],
  'Majestic Dawn': ['majestic dawn', 'md'],
  'Legends Awakened': ['legends awakened', 'la'],
  'Stormfront': ['stormfront', 'sf'],
  'Platinum': ['platinum', 'pl'],
  'Rising Rivals': ['rising rivals', 'rr'],
  'Supreme Victors': ['supreme victors', 'sv'],
  'Arceus': ['arceus', 'ar'],
  'HeartGold & SoulSilver': ['hgss', 'heartgold soulsilver', 'heart gold'],
  'Unleashed': ['unleashed', 'ul'],
  'Undaunted': ['undaunted', 'ud'],
  'Triumphant': ['triumphant', 'tm'],
  'Call of Legends': ['call of legends', 'col', 'call-of-legends'],
  'Black & White': ['black white', 'bw', 'b&w'],
  'Emerging Powers': ['emerging powers', 'ep'],
  'Noble Victories': ['noble victories', 'nv'],
  'Next Destinies': ['next destinies', 'nd'],
  'Dark Explorers': ['dark explorers', 'dex'],
  'Dragons Exalted': ['dragons exalted', 'drx'],
  'Boundaries Crossed': ['boundaries crossed', 'bcr'],
  'Plasma Storm': ['plasma storm', 'ps'],
  'Plasma Freeze': ['plasma freeze', 'pf'],
  'Plasma Blast': ['plasma blast', 'pb'],
  'Legendary Treasures': ['legendary treasures', 'lt'],
  'XY': ['xy', 'x y'],
  'Flashfire': ['flashfire', 'ff'],
  'Furious Fists': ['furious fists', 'fuf'],
  'Phantom Forces': ['phantom forces', 'phf'],
  'Primal Clash': ['primal clash', 'prc'],
  'Roaring Skies': ['roaring skies', 'ros'],
  'Ancient Origins': ['ancient origins', 'ao'],
  'BREAKthrough': ['breakthrough', 'bkt'],
  'BREAKpoint': ['breakpoint', 'bkp'],
  'Fates Collide': ['fates collide', 'fcl'],
  'Steam Siege': ['steam siege', 'sts'],
  'Evolutions': ['evolutions', 'evo'],
  'Sun & Moon': ['sun moon', 'sm', 's&m'],
  'Guardians Rising': ['guardians rising', 'gri'],
  'Burning Shadows': ['burning shadows', 'bsh'],
  'Shining Legends': ['shining legends', 'shl'],
  'Crimson Invasion': ['crimson invasion', 'cri'],
  'Ultra Prism': ['ultra prism', 'upr'],
  'Forbidden Light': ['forbidden light', 'fli'],
  'Celestial Storm': ['celestial storm', 'ces'],
  'Lost Thunder': ['lost thunder', 'lot'],
  'Team Up': ['team up', 'tup'],
  'Unbroken Bonds': ['unbroken bonds', 'unb'],
  'Unified Minds': ['unified minds', 'unm'],
  'Cosmic Eclipse': ['cosmic eclipse', 'cec'],
  'Sword & Shield': ['sword shield', 'swsh', 'ssh'],
  'Rebel Clash': ['rebel clash', 'rcl'],
  'Darkness Ablaze': ['darkness ablaze', 'daa'],
  'Champion\'s Path': ['champions path', 'cp'],
  'Vivid Voltage': ['vivid voltage', 'viv'],
  'Shining Fates': ['shining fates', 'shf'],
  'Battle Styles': ['battle styles', 'bst'],
  'Chilling Reign': ['chilling reign', 'chr'],
  'Evolving Skies': ['evolving skies', 'evs'],
  'Celebrations': ['celebrations', 'cel'],
  'Fusion Strike': ['fusion strike', 'fst'],
  'Brilliant Stars': ['brilliant stars', 'brs'],
  'Astral Radiance': ['astral radiance', 'asr'],
  'Lost Origin': ['lost origin', 'lor'],
  'Silver Tempest': ['silver tempest', 'sit'],
  'Crown Zenith': ['crown zenith', 'crz'],
  'Scarlet & Violet': ['scarlet violet', 'sv', 's&v'],
  'Paldea Evolved': ['paldea evolved', 'pev'],
  'Obsidian Flames': ['obsidian flames', 'obf'],
  '151': ['151', 'one fifty one'],
  'Paradox Rift': ['paradox rift', 'par'],
  'Paldean Fates': ['paldean fates', 'paf'],
  'Temporal Forces': ['temporal forces', 'tef'],
  'Twilight Masquerade': ['twilight masquerade', 'twm'],
};

/**
 * Common variant patterns
 */
export const VARIANT_PATTERNS: Record<string, string[]> = {
  'Holo': ['holo', 'holofoil', 'holo-foil', 'holographic'],
  'Reverse Holo': ['reverse', 'reverse holo', 'reverse-holo', 'rev holo'],
  '1st Edition': ['1st', '1st edition', 'first edition', '1e'],
  'Shadowless': ['shadowless', 'shadow less', 'no shadow'],
  'Unlimited': ['unlimited', 'unl'],
  'Promo': ['promo', 'promotional'],
  'Prerelease': ['prerelease', 'pre-release', 'pre release'],
  'Staff': ['staff', 'staff promo'],
};

// ============================================================================
// FUZZY MATCHER CLASS
// ============================================================================

export class FuzzyMatcher {
  private setCache: Map<string, string> = new Map();
  private variantCache: Map<string, string> = new Map();
  private minSimilarity: number;

  constructor(minSimilarity: number = 0.75) {
    this.minSimilarity = minSimilarity;
    this.buildCaches();
  }

  /**
   * Build lookup caches from canonical data
   */
  private buildCaches(): void {
    // Build set name cache
    for (const [canonical, aliases] of Object.entries(CANONICAL_SETS)) {
      // Add canonical name
      this.setCache.set(canonical.toLowerCase(), canonical);

      // Add all aliases
      for (const alias of aliases) {
        this.setCache.set(alias.toLowerCase(), canonical);
      }
    }

    // Build variant cache
    for (const [canonical, aliases] of Object.entries(VARIANT_PATTERNS)) {
      this.variantCache.set(canonical.toLowerCase(), canonical);
      for (const alias of aliases) {
        this.variantCache.set(alias.toLowerCase(), canonical);
      }
    }
  }

  /**
   * Normalize a set name to canonical form
   *
   * @param rawSetName The raw set name from data source
   * @returns Canonical set name or null if no match found
   */
  normalizeSetName(rawSetName: string): string | null {
    if (!rawSetName) return null;

    const cleaned = this.cleanString(rawSetName);

    // Check exact match in cache
    const exactMatch = this.setCache.get(cleaned);
    if (exactMatch) return exactMatch;

    // Try fuzzy matching
    return this.fuzzyMatchSet(cleaned);
  }

  /**
   * Fuzzy match a set name against canonical list
   */
  private fuzzyMatchSet(cleaned: string): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [canonical, aliases] of Object.entries(CANONICAL_SETS)) {
      // Check canonical name
      const canonicalScore = this.matchScore(cleaned, canonical.toLowerCase());
      if (canonicalScore > bestScore && canonicalScore >= this.minSimilarity) {
        bestScore = canonicalScore;
        bestMatch = canonical;
      }

      // Check aliases
      for (const alias of aliases) {
        const aliasScore = this.matchScore(cleaned, alias);
        if (aliasScore > bestScore && aliasScore >= this.minSimilarity) {
          bestScore = aliasScore;
          bestMatch = canonical;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Normalize a variant name to canonical form
   */
  normalizeVariant(rawVariant: string): string | null {
    if (!rawVariant) return null;

    const cleaned = this.cleanString(rawVariant);

    // Check exact match
    const exactMatch = this.variantCache.get(cleaned);
    if (exactMatch) return exactMatch;

    // Fuzzy match
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [canonical, aliases] of Object.entries(VARIANT_PATTERNS)) {
      const canonicalScore = this.matchScore(cleaned, canonical.toLowerCase());
      if (canonicalScore > bestScore && canonicalScore >= this.minSimilarity) {
        bestScore = canonicalScore;
        bestMatch = canonical;
      }

      for (const alias of aliases) {
        const aliasScore = this.matchScore(cleaned, alias);
        if (aliasScore > bestScore && aliasScore >= this.minSimilarity) {
          bestScore = aliasScore;
          bestMatch = canonical;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate match score using multiple algorithms
   */
  private matchScore(str1: string, str2: string): number {
    // Weight different algorithms
    const levenshtein = similarityScore(str1, str2);
    const jaroWinkler = jaroWinklerSimilarity(str1, str2);

    // Jaro-Winkler is better for short strings, Levenshtein for longer
    const weight = str1.length < 10 ? 0.6 : 0.4;
    return jaroWinkler * weight + levenshtein * (1 - weight);
  }

  /**
   * Clean and normalize a string for matching
   */
  private cleanString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s&-]/g, '') // Keep alphanumeric, spaces, &, and -
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\s*&\s*/g, ' ') // Normalize &
      .replace(/\s*-\s*/g, ' '); // Normalize -
  }

  /**
   * Batch normalize set names
   */
  normalizeSetNames(setNames: string[]): Map<string, string | null> {
    const results = new Map<string, string | null>();
    for (const setName of setNames) {
      results.set(setName, this.normalizeSetName(setName));
    }
    return results;
  }

  /**
   * Get match quality metrics for debugging
   */
  getMatchMetrics(input: string, canonical: string): MatchMetrics {
    const cleaned = this.cleanString(input);
    const cleanedCanonical = canonical.toLowerCase();

    return {
      input,
      canonical,
      cleaned,
      levenshteinDistance: levenshteinDistance(cleaned, cleanedCanonical),
      similarityScore: similarityScore(cleaned, cleanedCanonical),
      jaroWinkler: jaroWinklerSimilarity(cleaned, cleanedCanonical),
      overallScore: this.matchScore(cleaned, cleanedCanonical),
      isMatch: this.matchScore(cleaned, cleanedCanonical) >= this.minSimilarity,
    };
  }
}

export interface MatchMetrics {
  input: string;
  canonical: string;
  cleaned: string;
  levenshteinDistance: number;
  similarityScore: number;
  jaroWinkler: number;
  overallScore: number;
  isMatch: boolean;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FuzzyMatcher;
