#!/usr/bin/env tsx

interface ParsedCardInfo {
  pokemonName?: string;
  setCode?: string;
  setName?: string;
  cardNumber?: string;
  grade?: string;
  gradingCompany?: string;
  condition?: string;
  variant?: string;
  confidence: number;
  originalTitle: string;
}

interface SetMapping {
  [key: string]: {
    code: string;
    fullName: string;
    year?: number;
  };
}

class EBayTitleParser {
  private setMappings: SetMapping;
  private pokemonNames: Set<string>;
  private gradingCompanies: Set<string>;

  constructor() {
    this.initializeSetMappings();
    this.initializePokemonNames();
    this.initializeGradingCompanies();
  }

  private initializeSetMappings() {
    this.setMappings = {
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
      
      // e-Card series
      'expedition base set': { code: 'EB', fullName: 'Expedition Base Set', year: 2002 },
      'aquapolis': { code: 'AQ', fullName: 'Aquapolis', year: 2003 },
      'skyridge': { code: 'SK', fullName: 'Skyridge', year: 2003 },
      
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
  }

  private initializePokemonNames() {
    // Common Pokemon names that appear in titles
    this.pokemonNames = new Set([
      'charizard', 'blastoise', 'venusaur', 'pikachu', 'mew', 'mewtwo', 'machamp',
      'alakazam', 'gengar', 'gyarados', 'lapras', 'ditto', 'eevee', 'snorlax',
      'dragonite', 'moltres', 'zapdos', 'articuno', 'lugia', 'ho-oh', 'rayquaza',
      'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus', 'reshiram',
      'zekrom', 'kyurem', 'xerneas', 'yveltal', 'zygarde', 'solgaleo', 'lunala',
      'necrozma', 'zacian', 'zamazenta', 'eternatus', 'koraidon', 'miraidon'
    ]);
  }

  private initializeGradingCompanies() {
    this.gradingCompanies = new Set([
      'psa', 'bgs', 'cgc', 'sgc', 'beckett', 'professional sports authenticator',
      'black label', 'gold label', 'silver label'
    ]);
  }

  parseTitle(title: string): ParsedCardInfo {
    const result: ParsedCardInfo = {
      confidence: 0,
      originalTitle: title
    };

    const lowerTitle = title.toLowerCase();

    // Extract Pokemon name
    result.pokemonName = this.extractPokemonName(lowerTitle);
    
    // Extract set information
    const setInfo = this.extractSetInfo(lowerTitle);
    result.setCode = setInfo.code;
    result.setName = setInfo.fullName;
    
    // Extract card number
    result.cardNumber = this.extractCardNumber(lowerTitle);
    
    // Extract grading information
    const gradingInfo = this.extractGradingInfo(lowerTitle);
    result.grade = gradingInfo.grade;
    result.gradingCompany = gradingInfo.company;
    
    // Extract condition
    result.condition = this.extractCondition(lowerTitle);
    
    // Extract variant information
    result.variant = this.extractVariant(lowerTitle);
    
    // Calculate confidence score
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  private extractPokemonName(title: string): string | undefined {
    // Look for Pokemon names in the title
    for (const pokemon of this.pokemonNames) {
      if (title.includes(pokemon)) {
        return pokemon;
      }
    }
    return undefined;
  }

  private extractSetInfo(title: string): { code: string; fullName: string } {
    // Look for set names in the title
    for (const [setName, setInfo] of Object.entries(this.setMappings)) {
      if (title.includes(setName)) {
        return setInfo;
      }
    }
    return { code: '', fullName: '' };
  }

  private extractCardNumber(title: string): string | undefined {
    // Look for card numbers (various patterns)
    const patterns = [
      /\b(\d{1,3})\b/,  // 1-3 digit number
      /#(\d{1,3})\b/,    // # followed by number
      /number\s*(\d{1,3})\b/i,  // "number" followed by number
      /\b(\d{1,3})\/\d+\b/  // fraction format like "4/102"
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private extractGradingInfo(title: string): { company: string; grade: string } {
    const result = { company: '', grade: '' };

    // Look for grading companies
    for (const company of this.gradingCompanies) {
      if (title.includes(company)) {
        result.company = company.toUpperCase();
        break;
      }
    }

    // Look for grades
    const gradePatterns = [
      /\bpsa\s*(\d+(?:\.\d+)?)\b/i,  // PSA 10, PSA 9.5
      /\bbgs\s*(\d+(?:\.\d+)?)\b/i,  // BGS 9.5
      /\bcgc\s*(\d+(?:\.\d+)?)\b/i,  // CGC 9.5
      /\bsgc\s*(\d+(?:\.\d+)?)\b/i,  // SGC 9.5
      /\b(\d+(?:\.\d+)?)\b/  // Just a number
    ];

    for (const pattern of gradePatterns) {
      const match = title.match(pattern);
      if (match) {
        result.grade = match[1];
        break;
      }
    }

    return result;
  }

  private extractCondition(title: string): string | undefined {
    const conditions = [
      'mint', 'near mint', 'nm', 'lightly played', 'lp', 'moderately played', 'mp',
      'heavily played', 'hp', 'damaged', 'poor'
    ];

    for (const condition of conditions) {
      if (title.includes(condition)) {
        return condition;
      }
    }
    return undefined;
  }

  private extractVariant(title: string): string | undefined {
    const variants = [
      '1st edition', 'first edition', 'shadowless', 'holo', 'reverse holo',
      'full art', 'secret rare', 'rainbow rare', 'gold', 'shiny'
    ];

    for (const variant of variants) {
      if (title.includes(variant)) {
        return variant;
      }
    }
    return undefined;
  }

  private calculateConfidence(result: ParsedCardInfo): number {
    let confidence = 0;
    
    // Base confidence for having a title
    confidence += 0.1;
    
    // Pokemon name found
    if (result.pokemonName) confidence += 0.3;
    
    // Set information found
    if (result.setCode) confidence += 0.25;
    
    // Card number found
    if (result.cardNumber) confidence += 0.2;
    
    // Grading information found
    if (result.grade && result.gradingCompany) confidence += 0.15;
    
    // Additional confidence for having multiple pieces of information
    const infoCount = [
      result.pokemonName,
      result.setCode,
      result.cardNumber,
      result.grade,
      result.gradingCompany
    ].filter(Boolean).length;
    
    if (infoCount >= 3) confidence += 0.1;
    if (infoCount >= 4) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  // Batch processing method for large datasets
  parseTitles(titles: string[]): ParsedCardInfo[] {
    return titles.map(title => this.parseTitle(title));
  }

  // Get set mapping for external use
  getSetMappings(): SetMapping {
    return this.setMappings;
  }

  // Add custom set mapping
  addSetMapping(key: string, code: string, fullName: string, year?: number) {
    this.setMappings[key.toLowerCase()] = { code, fullName, year };
  }
}

// Test the parser with sample titles
function testParser() {
  const parser = new EBayTitleParser();
  
  const testTitles = [
    "1999 Charizard Base Set PSA 10 Pokemon Card #4/102",
    "Pikachu Jungle Set BGS 9.5 Near Mint Pokemon Card",
    "Mewtwo Fossil Set CGC 8.5 Lightly Played",
    "PSA 10 Charizard Base Set Unlimited Holo",
    "Blastoise Team Rocket Returns Secret Rare",
    "Gengar Fossil Set #6/62 Moderately Played",
    "Lugia Neo Genesis Set BGS 9.5 Gold Label"
  ];

  console.log('🧪 Testing eBay Title Parser:\n');
  
  testTitles.forEach((title, i) => {
    const result = parser.parseTitle(title);
    console.log(`${i + 1}. "${title}"`);
    console.log(`   Pokemon: ${result.pokemonName || 'N/A'}`);
    console.log(`   Set: ${result.setName || 'N/A'} (${result.setCode || 'N/A'})`);
    console.log(`   Card #: ${result.cardNumber || 'N/A'}`);
    console.log(`   Grade: ${result.gradingCompany || 'N/A'} ${result.grade || 'N/A'}`);
    console.log(`   Condition: ${result.condition || 'N/A'}`);
    console.log(`   Variant: ${result.variant || 'N/A'}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);
  });
}

if (require.main === module) {
  testParser();
}

export { EBayTitleParser, ParsedCardInfo };
