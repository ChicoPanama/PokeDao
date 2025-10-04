/**
 * Improved Collector Crypt Card Parser
 *
 * Handles multiple title formats:
 * - "2025 #151 Palafin EX PSA 9 Pre EN-Prismatic Evolutions Pokemon"
 * - "1999 #5 BASE SET HOLO CLEFAIRY CGC 9 POKEMON"
 * - "2021 #2 Blastoise-Holo CGC 10 Pristine Celebrations Classic Collection Pokemon"
 * - "2008 #57 Chimchar PSA 9 Diamond & Pearl Majestic Dawn Pokemon"
 */

interface ParsedCardData {
  pokemonName: string;
  setName: string;
  cardNumber: string;
  year?: number;
}

export class ImprovedCollectorCryptParser {
  /**
   * Parse card name with improved regex and fallback logic
   */
  parseCardName(itemName: string): ParsedCardData {
    const result: ParsedCardData = {
      pokemonName: '',
      setName: '',
      cardNumber: '',
      year: undefined,
    };

    // Normalize: convert to title case for easier parsing
    const normalized = itemName;

    // Extract year (first 4 digits)
    const yearMatch = normalized.match(/^(\d{4})/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
    }

    // Extract card number (#123 format)
    const numberMatch = normalized.match(/#(\d+)/);
    if (numberMatch) {
      result.cardNumber = numberMatch[1];
    }

    // Remove "Pokemon" suffix (case insensitive)
    let workingString = normalized.replace(/\s+Pokemon$/i, '').trim();

    // Remove year prefix if present
    if (result.year) {
      workingString = workingString.replace(/^\d{4}\s+/, '');
    }

    // Remove card number
    if (result.cardNumber) {
      workingString = workingString.replace(`#${result.cardNumber}`, '');
    }

    // Extract grading info (PSA 10, CGC 9, etc.)
    const graderPattern = /(PSA|BGS|CGC|SGC|ACE)\s+[\w\s-]+\d+/i;
    const graderMatch = workingString.match(graderPattern);
    let graderInfo = '';
    if (graderMatch) {
      graderInfo = graderMatch[0];
      workingString = workingString.replace(graderMatch[0], '').trim();
    }

    // Now workingString should have: Pokemon name + Set name
    // Try different patterns

    // Pattern 1: "Pre EN-" or "EN-" prefix for set
    const enSetMatch = workingString.match(/^(.+?)\s+(?:Pre\s+)?EN-(.+)$/i);
    if (enSetMatch) {
      result.pokemonName = enSetMatch[1].trim();
      result.setName = enSetMatch[2].trim();
      return result;
    }

    // Pattern 2: All caps set name (BASE SET, JUNGLE, etc.)
    const capsSetMatch = workingString.match(/^(.+?)\s+([A-Z][A-Z\s&]+)(?:\s+HOLO)?$/);
    if (capsSetMatch && capsSetMatch[2].length > 3) { // Avoid matching "EX" as set
      result.pokemonName = capsSetMatch[1].trim();
      result.setName = capsSetMatch[2].trim();
      return result;
    }

    // Pattern 3: Pokemon name with dash/hyphen variant, then set name
    // "Blastoise-Holo" -> "Blastoise", set is rest
    const hyphenMatch = workingString.match(/^([\w\s-]+?)\s+(.+)$/);
    if (hyphenMatch) {
      const possiblePokemon = hyphenMatch[1].trim();
      const possibleSet = hyphenMatch[2].trim();

      // If "possibleSet" contains common set keywords, use it
      if (this.isLikelySetName(possibleSet)) {
        result.pokemonName = possiblePokemon;
        result.setName = possibleSet;
        return result;
      }
    }

    // Pattern 4: Split on common set identifiers
    const setKeywords = [
      'Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes', 'Gym Challenge',
      'Neo Genesis', 'Neo Discovery', 'Neo Revelation', 'Neo Destiny',
      'Legendary Collection', 'Expedition', 'Aquapolis', 'Skyridge',
      'Ruby', 'Sapphire', 'Diamond', 'Pearl', 'Platinum',
      'HeartGold', 'SoulSilver', 'Black & White', 'XY', 'Sun & Moon',
      'Sword & Shield', 'Scarlet & Violet', 'Evolutions', 'Generations',
      'Shining Legends', 'Hidden Fates', 'Champion\'s Path', 'Shining Fates',
      'Celebrations', 'Fusion Strike', 'Brilliant Stars', 'Astral Radiance',
      'Lost Origin', 'Silver Tempest', 'Crown Zenith', 'Paldea Evolved',
      'Obsidian Flames', 'Paradox Rift', 'Paldean Fates', 'Temporal Forces',
      'Twilight Masquerade', 'Shrouded Fable', 'Stellar Crown', 'Surging Sparks',
      'Prismatic Evolutions', 'Majestic Dawn', 'Classic Collection',
    ];

    for (const keyword of setKeywords) {
      const keywordIndex = workingString.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordIndex !== -1) {
        result.pokemonName = workingString.substring(0, keywordIndex).trim();
        result.setName = workingString.substring(keywordIndex).trim();
        return result;
      }
    }

    // Fallback: Split at last space and hope for the best
    const lastSpaceIndex = workingString.lastIndexOf(' ');
    if (lastSpaceIndex !== -1) {
      result.pokemonName = workingString.substring(0, lastSpaceIndex).trim();
      result.setName = workingString.substring(lastSpaceIndex + 1).trim();
    } else {
      // Only one word left - assume it's Pokemon name
      result.pokemonName = workingString.trim();
      result.setName = '';
    }

    return result;
  }

  /**
   * Check if a string is likely a set name (contains multiple words or common set terms)
   */
  private isLikelySetName(str: string): boolean {
    const setIndicators = [
      'collection', 'classic', 'evolutions', 'strike', 'stars', 'radiance',
      'origin', 'tempest', 'zenith', 'evolved', 'flames', 'rift', 'fates',
      'forces', 'masquerade', 'fable', 'crown', 'sparks', 'majestic', 'dawn',
      'celebrations', 'fusion', 'brilliant', 'astral', 'lost', 'silver',
      'paldea', 'obsidian', 'paradox', 'paldean', 'temporal', 'twilight',
      'shrouded', 'stellar', 'surging', 'prismatic',
    ];

    const lowerStr = str.toLowerCase();
    return setIndicators.some(indicator => lowerStr.includes(indicator)) || str.split(/\s+/).length >= 2;
  }
}
