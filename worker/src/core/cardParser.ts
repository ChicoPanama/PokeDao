import { CardData } from '../types/interfaces.js';

export class CardParser {
  static parseCardName(cardName: string): CardData {
    const name = cardName.toLowerCase();
    
    // Extract Pokemon name
    const pokemonNames = [
      'charizard', 'blastoise', 'venusaur', 'pikachu', 'raichu',
      'alakazam', 'machamp', 'gengar', 'chansey', 'mewtwo', 
      'mew', 'lugia', 'ho-oh', 'pidgeot', 'arcanine'
    ];
    
    let pokemon = 'Unknown';
    for (const p of pokemonNames) {
      if (name.includes(p)) {
        pokemon = p.charAt(0).toUpperCase() + p.slice(1);
        break;
      }
    }
    
    // Extract set
    let set = 'Unknown';
    if (name.includes('base set')) set = 'Base Set';
    else if (name.includes('jungle')) set = 'Jungle';
    else if (name.includes('fossil')) set = 'Fossil';
    else if (name.includes('aquapolis')) set = 'Aquapolis';
    else if (name.includes('expedition')) set = 'Expedition';
    else if (name.includes('paldea')) set = 'Paldea Evolved';
    
    // Extract number
    const numberMatch = name.match(/#(\d+)/);
    const number = numberMatch ? numberMatch[1] : undefined;
    
    // Extract grade
    const gradeMatch = name.match(/(psa|bgs|cgc)\s*(\d+(?:\.\d+)?)/);
    const grade = gradeMatch ? `${gradeMatch[1].toUpperCase()} ${gradeMatch[2]}` : undefined;
    
    // Extract condition
    let condition = 'Unknown';
    if (name.includes('mint')) condition = 'Mint';
    else if (name.includes('near mint')) condition = 'Near Mint';
    else if (grade) condition = 'Graded';
    
    // Language
    const language = name.includes('japanese') ? 'Japanese' : 'English';
    
    // Special attributes
    const isFirstEdition = name.includes('1st edition');
    const isHolo = name.includes('holo');
    
    return {
      name: pokemon,
      set,
      number,
      grade,
      condition,
      language,
      isFirstEdition,
      isHolo
    };
  }
}
