// Generic title parsing utilities for extracting structured data
// Shared parsing logic that can be used across all marketplace adapters

import { GradeCompany, CanonicalListing } from './types';

// Pokemon names for title parsing
const POKEMON_NAMES = new Set([
  'charizard', 'blastoise', 'venusaur', 'pikachu', 'mew', 'mewtwo', 'machamp',
  'alakazam', 'gengar', 'gyarados', 'lapras', 'ditto', 'eevee', 'snorlax',
  'dragonite', 'moltres', 'zapdos', 'articuno', 'lugia', 'ho-oh', 'rayquaza',
  'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus', 'reshiram',
  'zekrom', 'kyurem', 'xerneas', 'yveltal', 'zygarde', 'solgaleo', 'lunala',
  'necrozma', 'zacian', 'zamazenta', 'eternatus', 'koraidon', 'miraidon',
  'bulbasaur', 'ivysaur', 'charmander', 'charmeleon', 'squirtle', 'wartortle',
  'caterpie', 'metapod', 'butterfree', 'weedle', 'kakuna', 'beedrill',
  'pidgey', 'pidgeotto', 'pidgeot', 'rattata', 'raticate', 'spearow', 'fearow',
  'ekans', 'arbok', 'pikachu', 'raichu', 'sandshrew', 'sandslash', 'nidoran',
  'nidorina', 'nidoqueen', 'nidorino', 'nidoking', 'clefairy', 'clefable',
  'vulpix', 'ninetales', 'jigglypuff', 'wigglytuff', 'zubat', 'golbat',
  'oddish', 'gloom', 'vileplume', 'paras', 'parasect', 'venonat', 'venomoth',
  'diglett', 'dugtrio', 'meowth', 'persian', 'psyduck', 'golduck', 'mankey',
  'primeape', 'growlithe', 'arcanine', 'poliwag', 'poliwhirl', 'poliwrath',
  'abra', 'kadabra', 'machop', 'machoke', 'bellsprout', 'weepinbell',
  'victreebel', 'tentacool', 'tentacruel', 'geodude', 'graveler', 'golem',
  'ponyta', 'rapidash', 'slowpoke', 'slowbro', 'magnemite', 'magneton',
  'farfetchd', 'doduo', 'dodrio', 'seel', 'dewgong', 'grimer', 'muk',
  'shellder', 'cloyster', 'gastly', 'haunter', 'onix', 'drowzee', 'hypno',
  'krabby', 'kingler', 'voltorb', 'electrode', 'exeggcute', 'exeggutor',
  'cubone', 'marowak', 'hitmonlee', 'hitmonchan', 'lickitung', 'koffing',
  'weezing', 'rhyhorn', 'rhydon', 'chansey', 'tangela', 'kangaskhan',
  'horsea', 'seadra', 'goldeen', 'seaking', 'staryu', 'starmie', 'mr-mime',
  'scyther', 'jynx', 'electabuzz', 'magmar', 'pinsir', 'tauros', 'magikarp',
  'aerodactyl', 'mew', 'mewtwo'
]);

// Set name mappings for Pokemon TCG
const SET_MAPPINGS: Record<string, { code: string; fullName: string; year?: number }> = {
  // Base Set variations
  'base set': { code: 'BS1', fullName: 'Base Set', year: 1999 },
  'base set 2': { code: 'BS2', fullName: 'Base Set 2', year: 2000 },
  'base set unlimited': { code: 'BS1', fullName: 'Base Set Unlimited', year: 1999 },
  'base set 1st edition': { code: 'BS1', fullName: 'Base Set 1st Edition', year: 1999 },
  'base set shadowless': { code: 'BS1', fullName: 'Base Set Shadowless', year: 1999 },
  
  // Early sets
  'jungle': { code: 'JU', fullName: 'Jungle', year: 1999 },
  'fossil': { code: 'FO', fullName: 'Fossil', year: 1999 },
  'team rocket': { code: 'TR', fullName: 'Team Rocket', year: 2000 },
  'gym heroes': { code: 'GH', fullName: 'Gym Heroes', year: 2000 },
  'gym challenge': { code: 'GC', fullName: 'Gym Challenge', year: 2000 },
  
  // Neo series
  'neo genesis': { code: 'NG', fullName: 'Neo Genesis', year: 2000 },
  'neo discovery': { code: 'ND', fullName: 'Neo Discovery', year: 2001 },
  'neo revelation': { code: 'NR', fullName: 'Neo Revelation', year: 2001 },
  'neo destiny': { code: 'ND', fullName: 'Neo Destiny', year: 2002 },
  
  // EX series
  'ruby & sapphire': { code: 'RS', fullName: 'Ruby & Sapphire', year: 2003 },
  'sandstorm': { code: 'SS', fullName: 'Sandstorm', year: 2003 },
  'dragon': { code: 'DR', fullName: 'Dragon', year: 2003 },
  'team magma vs team aqua': { code: 'MA', fullName: 'Team Magma vs Team Aqua', year: 2004 },
  'hidden legends': { code: 'HL', fullName: 'Hidden Legends', year: 2004 },
  'firered & leafgreen': { code: 'FL', fullName: 'FireRed & LeafGreen', year: 2004 },
  'team rocket returns': { code: 'TRR', fullName: 'Team Rocket Returns', year: 2004 },
  'deoxys': { code: 'DX', fullName: 'Deoxys', year: 2005 },
  'emerald': { code: 'EM', fullName: 'Emerald', year: 2005 },
  'unseen forces': { code: 'UF', fullName: 'Unseen Forces', year: 2005 },
  'delta species': { code: 'DS', fullName: 'Delta Species', year: 2005 },
  'legend maker': { code: 'LM', fullName: 'Legend Maker', year: 2006 },
  'holon phantoms': { code: 'HP', fullName: 'Holon Phantoms', year: 2006 },
  'crystal guardians': { code: 'CG', fullName: 'Crystal Guardians', year: 2006 },
  'dragon frontiers': { code: 'DF', fullName: 'Dragon Frontiers', year: 2006 },
  'power keepers': { code: 'PK', fullName: 'Power Keepers', year: 2007 },
  
  // Diamond & Pearl series
  'diamond & pearl': { code: 'DP', fullName: 'Diamond & Pearl', year: 2007 },
  'mysterious treasures': { code: 'MT', fullName: 'Mysterious Treasures', year: 2007 },
  'secret wonders': { code: 'SW', fullName: 'Secret Wonders', year: 2007 },
  'great encounters': { code: 'GE', fullName: 'Great Encounters', year: 2008 },
  'majestic dawn': { code: 'MD', fullName: 'Majestic Dawn', year: 2008 },
  'legends awakened': { code: 'LA', fullName: 'Legends Awakened', year: 2008 },
  'stormfront': { code: 'SF', fullName: 'Stormfront', year: 2008 },
  
  // Platinum series
  'platinum': { code: 'PL', fullName: 'Platinum', year: 2009 },
  'rising rivals': { code: 'RR', fullName: 'Rising Rivals', year: 2009 },
  'supreme victors': { code: 'SV', fullName: 'Supreme Victors', year: 2009 },
  'arceus': { code: 'AR', fullName: 'Arceus', year: 2009 },
  
  // HeartGold & SoulSilver series
  'heartgold & soulsilver': { code: 'HGSS', fullName: 'HeartGold & SoulSilver', year: 2010 },
  'unleashed': { code: 'UL', fullName: 'Unleashed', year: 2010 },
  'undunted': { code: 'UD', fullName: 'Undunted', year: 2010 },
  'triumphant': { code: 'TR', fullName: 'Triumphant', year: 2010 },
  'call of legends': { code: 'CL', fullName: 'Call of Legends', year: 2011 },
  
  // Black & White series
  'black & white': { code: 'BW', fullName: 'Black & White', year: 2011 },
  'emerging powers': { code: 'EP', fullName: 'Emerging Powers', year: 2011 },
  'noble victories': { code: 'NV', fullName: 'Noble Victories', year: 2011 },
  'next destinies': { code: 'ND', fullName: 'Next Destinies', year: 2012 },
  'dark explorers': { code: 'DE', fullName: 'Dark Explorers', year: 2012 },
  'dragons exalted': { code: 'DRX', fullName: 'Dragons Exalted', year: 2012 },
  'boundaries crossed': { code: 'BC', fullName: 'Boundaries Crossed', year: 2012 },
  'plasma storm': { code: 'PS', fullName: 'Plasma Storm', year: 2013 },
  'plasma freeze': { code: 'PF', fullName: 'Plasma Freeze', year: 2013 },
  'plasma blast': { code: 'PB', fullName: 'Plasma Blast', year: 2013 },
  'legendary treasures': { code: 'LT', fullName: 'Legendary Treasures', year: 2013 },
  
  // XY series
  'xy': { code: 'XY', fullName: 'XY', year: 2014 },
  'flashfire': { code: 'FF', fullName: 'Flashfire', year: 2014 },
  'furious fists': { code: 'FF', fullName: 'Furious Fists', year: 2014 },
  'phantom forces': { code: 'PF', fullName: 'Phantom Forces', year: 2014 },
  'primal clash': { code: 'PC', fullName: 'Primal Clash', year: 2015 },
  'roaring skies': { code: 'RS', fullName: 'Roaring Skies', year: 2015 },
  'ancient origins': { code: 'AO', fullName: 'Ancient Origins', year: 2015 },
  'breakthrough': { code: 'BT', fullName: 'Breakthrough', year: 2015 },
  'breakpoint': { code: 'BP', fullName: 'Breakpoint', year: 2016 },
  'fates collide': { code: 'FC', fullName: 'Fates Collide', year: 2016 },
  'steam siege': { code: 'SS', fullName: 'Steam Siege', year: 2016 },
  'evolutions': { code: 'EV', fullName: 'Evolutions', year: 2016 },
  
  // Sun & Moon series
  'sun & moon': { code: 'SM', fullName: 'Sun & Moon', year: 2017 },
  'guardians rising': { code: 'GR', fullName: 'Guardians Rising', year: 2017 },
  'burning shadows': { code: 'BS', fullName: 'Burning Shadows', year: 2017 },
  'crimson invasion': { code: 'CI', fullName: 'Crimson Invasion', year: 2017 },
  'ultra prism': { code: 'UP', fullName: 'Ultra Prism', year: 2018 },
  'forbidden light': { code: 'FL', fullName: 'Forbidden Light', year: 2018 },
  'celestial storm': { code: 'CS', fullName: 'Celestial Storm', year: 2018 },
  'lost thunder': { code: 'LT', fullName: 'Lost Thunder', year: 2018 },
  'team up': { code: 'TU', fullName: 'Team Up', year: 2019 },
  'detective pikachu': { code: 'DP', fullName: 'Detective Pikachu', year: 2019 },
  'unbroken bonds': { code: 'UB', fullName: 'Unbroken Bonds', year: 2019 },
  'unified minds': { code: 'UM', fullName: 'Unified Minds', year: 2019 },
  'hidden fates': { code: 'HF', fullName: 'Hidden Fates', year: 2019 },
  'cosmic eclipse': { code: 'CE', fullName: 'Cosmic Eclipse', year: 2019 },
  
  // Sword & Shield series
  'sword & shield': { code: 'SS', fullName: 'Sword & Shield', year: 2020 },
  'rebel clash': { code: 'RC', fullName: 'Rebel Clash', year: 2020 },
  'darkness ablaze': { code: 'DA', fullName: 'Darkness Ablaze', year: 2020 },
  'champion\'s path': { code: 'CP', fullName: 'Champion\'s Path', year: 2020 },
  'vivid voltage': { code: 'VV', fullName: 'Vivid Voltage', year: 2020 },
  'shining fates': { code: 'SF', fullName: 'Shining Fates', year: 2021 },
  'battle styles': { code: 'BS', fullName: 'Battle Styles', year: 2021 },
  'chilling reign': { code: 'CR', fullName: 'Chilling Reign', year: 2021 },
  'evolving skies': { code: 'ES', fullName: 'Evolving Skies', year: 2021 },
  'fusion strike': { code: 'FS', fullName: 'Fusion Strike', year: 2021 },
  'brilliant stars': { code: 'BS', fullName: 'Brilliant Stars', year: 2022 },
  'astral radiance': { code: 'AR', fullName: 'Astral Radiance', year: 2022 },
  'lost origin': { code: 'LO', fullName: 'Lost Origin', year: 2022 },
  'silver tempest': { code: 'ST', fullName: 'Silver Tempest', year: 2022 },
  
  // Scarlet & Violet series
  'scarlet & violet': { code: 'SV', fullName: 'Scarlet & Violet', year: 2023 },
  'paldea evolved': { code: 'PE', fullName: 'Paldea Evolved', year: 2023 },
  'obsidian flames': { code: 'OF', fullName: 'Obsidian Flames', year: 2023 },
  '151': { code: '151', fullName: '151', year: 2023 },
  'paradox rift': { code: 'PR', fullName: 'Paradox Rift', year: 2023 },
  'paldean fates': { code: 'PF', fullName: 'Paldean Fates', year: 2024 },
  'temporal forces': { code: 'TF', fullName: 'Temporal Forces', year: 2024 },
  'shrouded fable': { code: 'SF', fullName: 'Shrouded Fable', year: 2024 },
  'stellar crown': { code: 'SC', fullName: 'Stellar Crown', year: 2024 }
};

// Grading company mappings
const GRADING_COMPANIES: Record<string, GradeCompany> = {
  'psa': GradeCompany.PSA,
  'professional sports authenticator': GradeCompany.PSA,
  'bgs': GradeCompany.BGS,
  'beckett': GradeCompany.BGS,
  'cgc': GradeCompany.CGC,
  'sgc': GradeCompany.SGC,
  'black label': GradeCompany.BGS,
  'gold label': GradeCompany.BGS,
  'silver label': GradeCompany.BGS
};

// Condition mappings
const CONDITIONS = [
  'mint', 'near mint', 'nm', 'lightly played', 'lp', 'moderately played', 'mp',
  'heavily played', 'hp', 'damaged', 'poor'
];

// Variant mappings
const VARIANTS = [
  '1st edition', 'first edition', 'shadowless', 'holo', 'reverse holo',
  'full art', 'secret rare', 'rainbow rare', 'gold', 'shiny', 'alt art'
];

/**
 * Extract Pokemon name from title
 */
export function extractPokemonName(title: string): string | undefined {
  const lowerTitle = title.toLowerCase();
  
  for (const pokemon of POKEMON_NAMES) {
    if (lowerTitle.includes(pokemon)) {
      return pokemon;
    }
  }
  
  return undefined;
}

/**
 * Extract set information from title
 */
export function extractSetInfo(title: string): { code: string; fullName: string; year?: number } | undefined {
  const lowerTitle = title.toLowerCase();
  
  for (const [setName, setInfo] of Object.entries(SET_MAPPINGS)) {
    if (lowerTitle.includes(setName)) {
      return setInfo;
    }
  }
  
  return undefined;
}

/**
 * Extract card number from title
 */
export function extractCardNumber(title: string): string | undefined {
  const patterns = [
    /\b(\d{1,3})\b/,              // 1-3 digit number
    /#(\d{1,3})\b/,               // # followed by number
    /number\s*(\d{1,3})\b/i,      // "number" followed by number
    /\b(\d{1,3})\/\d+\b/          // fraction format like "4/102"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return undefined;
}

/**
 * Extract grading information from title
 */
export function extractGradingInfo(title: string): { company: GradeCompany | undefined; grade: number | undefined } {
  const lowerTitle = title.toLowerCase();
  
  // Find grading company
  let company: GradeCompany | undefined;
  for (const [key, value] of Object.entries(GRADING_COMPANIES)) {
    if (lowerTitle.includes(key)) {
      company = value;
      break;
    }
  }
  
  // Find grade
  const gradePatterns = [
    /\bpsa\s*(\d+(?:\.\d+)?)\b/i,  // PSA 10, PSA 9.5
    /\bbgs\s*(\d+(?:\.\d+)?)\b/i,  // BGS 9.5
    /\bcgc\s*(\d+(?:\.\d+)?)\b/i,  // CGC 9.5
    /\bsgc\s*(\d+(?:\.\d+)?)\b/i,  // SGC 9.5
    /\b(\d+(?:\.\d+)?)\b/          // Just a number
  ];

  let grade: number | undefined;
  for (const pattern of gradePatterns) {
    const match = lowerTitle.match(pattern);
    if (match) {
      const parsedGrade = parseFloat(match[1]);
      if (parsedGrade >= 0 && parsedGrade <= 10) {
        grade = parsedGrade;
        break;
      }
    }
  }
  
  return { company, grade };
}

/**
 * Extract condition from title
 */
export function extractCondition(title: string): string | undefined {
  const lowerTitle = title.toLowerCase();
  
  for (const condition of CONDITIONS) {
    if (lowerTitle.includes(condition)) {
      return condition;
    }
  }
  
  return undefined;
}

/**
 * Extract variant from title
 */
export function extractVariant(title: string): string | undefined {
  const lowerTitle = title.toLowerCase();
  
  for (const variant of VARIANTS) {
    if (lowerTitle.includes(variant)) {
      return variant;
    }
  }
  
  return undefined;
}

/**
 * Parse title and extract all structured data
 */
export function parseTitle(title: string): Partial<CanonicalListing> {
  const pokemonName = extractPokemonName(title);
  const setInfo = extractSetInfo(title);
  const cardNumber = extractCardNumber(title);
  const gradingInfo = extractGradingInfo(title);
  const condition = extractCondition(title);
  const variant = extractVariant(title);
  
  return {
    cardName: pokemonName,
    setName: setInfo?.fullName,
    cardNumber,
    variant,
    gradeCompany: gradingInfo.company,
    grade: gradingInfo.grade,
    condition,
  };
}

/**
 * Calculate parsing confidence score
 */
export function calculateParsingConfidence(parsed: Partial<CanonicalListing>): number {
  let confidence = 0;
  
  // Base confidence for having a title
  confidence += 0.1;
  
  // Pokemon name found
  if (parsed.cardName) confidence += 0.3;
  
  // Set information found
  if (parsed.setName) confidence += 0.25;
  
  // Card number found
  if (parsed.cardNumber) confidence += 0.2;
  
  // Grading information found
  if (parsed.grade && parsed.gradeCompany) confidence += 0.15;
  
  // Additional confidence for having multiple pieces of information
  const infoCount = [
    parsed.cardName,
    parsed.setName,
    parsed.cardNumber,
    parsed.grade,
    parsed.gradeCompany
  ].filter(Boolean).length;
  
  if (infoCount >= 3) confidence += 0.1;
  if (infoCount >= 4) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

/**
 * Normalize Pokemon name (handle variations)
 */
export function normalizePokemonName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Normalize set name (handle variations)
 */
export function normalizeSetName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Normalize card number (remove non-numeric characters)
 */
export function normalizeCardNumber(number: string): string {
  return number.replace(/[^\d]/g, '');
}

/**
 * Validate parsed data
 */
export function validateParsedData(parsed: Partial<CanonicalListing>): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Validate Pokemon name
  if (parsed.cardName && !POKEMON_NAMES.has(parsed.cardName.toLowerCase())) {
    issues.push(`Unknown Pokemon name: ${parsed.cardName}`);
  }
  
  // Validate grade
  if (parsed.grade !== undefined && parsed.grade !== null && (parsed.grade < 0 || parsed.grade > 10)) {
    issues.push(`Invalid grade: ${parsed.grade}`);
  }
  
  // Validate card number
  if (parsed.cardNumber && !/^\d+$/.test(parsed.cardNumber)) {
    issues.push(`Invalid card number format: ${parsed.cardNumber}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Get all Pokemon names
 */
export function getPokemonNames(): string[] {
  return Array.from(POKEMON_NAMES).sort();
}

/**
 * Get all set mappings
 */
export function getSetMappings(): Record<string, { code: string; fullName: string; year?: number }> {
  return SET_MAPPINGS;
}

/**
 * Get set by code
 */
export function getSetByCode(code: string): { code: string; fullName: string; year?: number } | undefined {
  return Object.values(SET_MAPPINGS).find(set => set.code === code);
}

/**
 * Get grading companies
 */
export function getGradingCompanies(): Record<string, GradeCompany> {
  return GRADING_COMPANIES;
}

/**
 * Batch parse multiple titles
 */
export function batchParseTitles(titles: string[]): Array<Partial<CanonicalListing> & { confidence: number }> {
  return titles.map(title => {
    const parsed = parseTitle(title);
    const confidence = calculateParsingConfidence(parsed);
    return { ...parsed, confidence };
  });
}

/**
 * Extract year from title (for vintage cards)
 */
export function extractYear(title: string): number | undefined {
  const yearPattern = /\b(19[89]\d|20[0-2]\d)\b/;
  const match = title.match(yearPattern);
  
  if (match) {
    const year = parseInt(match[1]);
    if (year >= 1996 && year <= 2024) { // Pokemon TCG started in 1996
      return year;
    }
  }
  
  return undefined;
}

/**
 * Determine if card is vintage (pre-2000)
 */
export function isVintageCard(parsed: Partial<CanonicalListing>, title: string): boolean {
  // Check by set name
  if (parsed.setName) {
    const setInfo = Object.values(SET_MAPPINGS).find(set => set.fullName === parsed.setName);
    if (setInfo?.year && setInfo.year < 2000) {
      return true;
    }
  }
  
  // Check by year in title
  const year = extractYear(title);
  if (year && year < 2000) {
    return true;
  }
  
  return false;
}

/**
 * Determine if card is high-value (based on Pokemon name and grade)
 */
export function isHighValueCard(parsed: Partial<CanonicalListing>): boolean {
  const highValuePokemon = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia', 'blastoise', 'venusaur'];
  const isHighValuePokemon = parsed.cardName && highValuePokemon.includes(parsed.cardName.toLowerCase());
  const isHighGrade = parsed.grade && parsed.grade >= 9;
  
  return Boolean(isHighValuePokemon || isHighGrade);
}
