import { CardData, SearchStrategy } from '../types/interfaces.js';

export class CardSearchEngine {
  generateSearchStrategies(cardName: string): SearchStrategy {
    const parsed = this.parseCardName(cardName);
    
    const primary = this.buildPrimarySearch(parsed);
    const fallbacks = this.buildFallbackSearches(parsed);
    const fuzzy = this.buildFuzzySearches(parsed);
    
    return { primary, fallbacks, fuzzy };
  }

  private parseCardName(cardName: string): CardData {
    const name = cardName.toLowerCase();
    
    // Extract year
    const yearMatch = name.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    // Extract card number
    const numberMatch = name.match(/#(\d+)/);
    const number = numberMatch ? numberMatch[1] : undefined;
    
    // Extract Pokemon name
    const pokemon = this.extractPokemonName(name);
    
    // Extract set
    const set = this.extractSet(name);
    
    // Extract grade
    const grade = this.extractGrade(name);
    
    // Extract condition
    const condition = this.extractCondition(name);
    
    // Determine language
    const language = name.includes('japanese') ? 'Japanese' : 'English';
    
    // Check for special attributes
    const isFirstEdition = name.includes('1st edition') || name.includes('1st ed');
    const isHolo = name.includes('holo');
    
    return {
      name: pokemon || 'Unknown',
      set: set || 'Unknown',
      number,
      grade,
      condition,
      language,
      isFirstEdition,
      isHolo
    };
  }

  private extractPokemonName(name: string): string | null {
    const pokemonNames = [
      'charizard', 'blastoise', 'venusaur', 'pikachu', 'raichu',
      'alakazam', 'machamp', 'golem', 'gengar', 'chansey',
      'mewtwo', 'mew', 'lugia', 'ho-oh', 'celebi',
      'pidgeot', 'fearow', 'arcanine', 'poliwrath', 'victreebel'
    ];
    
    for (const pokemon of pokemonNames) {
      if (name.includes(pokemon)) {
        return pokemon.charAt(0).toUpperCase() + pokemon.slice(1);
      }
    }
    
    return null;
  }

  private extractSet(name: string): string {
    const sets = {
      'base set': 'Base Set',
      'jungle': 'Jungle',
      'fossil': 'Fossil',
      'base set 2': 'Base Set 2',
      'team rocket': 'Team Rocket',
      'gym heroes': 'Gym Heroes',
      'gym challenge': 'Gym Challenge',
      'neo genesis': 'Neo Genesis',
      'neo discovery': 'Neo Discovery',
      'neo destiny': 'Neo Destiny',
      'neo revelation': 'Neo Revelation',
      'legendary collection': 'Legendary Collection',
      'expedition': 'Expedition',
      'aquapolis': 'Aquapolis',
      'skyridge': 'Skyridge',
      'paldea evolved': 'Paldea Evolved',
      'prismatic evolutions': 'Prismatic Evolutions'
    };
    
    for (const [key, value] of Object.entries(sets)) {
      if (name.includes(key)) return value;
    }
    
    return 'Unknown';
  }

  private extractGrade(name: string): string | undefined {
    const gradeMatch = name.match(/(psa|bgs|cgc)\s*(\d+(?:\.\d+)?)/);
    if (gradeMatch) {
      return `${gradeMatch[1].toUpperCase()} ${gradeMatch[2]}`;
    }
    return undefined;
  }

  private extractCondition(name: string): string {
    if (name.includes('mint')) return 'Mint';
    if (name.includes('near mint')) return 'Near Mint';
    if (name.includes('excellent')) return 'Excellent';
    if (name.includes('good')) return 'Good';
    if (name.includes('played')) return 'Played';
    return 'Unknown';
  }

  private buildPrimarySearch(card: CardData): string {
    let search = card.name;
    
    if (card.set !== 'Unknown') search += ` ${card.set}`;
    if (card.number) search += ` ${card.number}`;
    if (card.isFirstEdition) search += ' 1st Edition';
    if (card.isHolo) search += ' Holo';
    
    return search;
  }

  private buildFallbackSearches(card: CardData): string[] {
    const fallbacks = [];
    
    // Pokemon name only
    fallbacks.push(card.name);
    
    // Pokemon + set
    if (card.set !== 'Unknown') {
      fallbacks.push(`${card.name} ${card.set}`);
    }
    
    // Pokemon + number
    if (card.number) {
      fallbacks.push(`${card.name} ${card.number}`);
    }
    
    // Set abbreviations
    if (card.set === 'Base Set') {
      fallbacks.push(`${card.name} BS`);
    }
    
    return fallbacks;
  }

  private buildFuzzySearches(card: CardData): string[] {
    const fuzzy = [];
    
    // Common misspellings
    const misspellings: Record<string, string[]> = {
      'charizard': ['charizrd', 'charizard'],
      'pikachu': ['pickachu', 'pikchu'],
      'blastoise': ['blastois', 'blastose']
    };
    
    if (misspellings[card.name.toLowerCase()]) {
      fuzzy.push(...misspellings[card.name.toLowerCase()]);
    }
    
    return fuzzy;
  }

