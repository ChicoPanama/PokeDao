import { CardData } from '../types/interfaces.js';

export class CardParser {
  parseCardName(cardName: string): CardData {
    const parsed: CardData = {
      name: 'Unknown',
      set: 'Unknown',
      number: undefined,
      grade: undefined,
      grader: undefined,
      language: 'English',
      isHolo: false,
      isFirstEdition: false,
      isShadowless: false
    };

    // Extract card name (usually the Pokemon name)
    const nameMatch = cardName.match(/(?:^|\s)([\w\s]+?)(?:\s+(?:Base|Team|Neo|Gym|Expedition|Aquapolis)|\s+#|\s+CGC|\s+PSA|\s+BGS|$)/i);
    if (nameMatch) {
      parsed.name = nameMatch[1].trim();
    }

    // Extract set information
    if (cardName.toLowerCase().includes('base set')) {
      parsed.set = 'Base Set';
    } else if (cardName.toLowerCase().includes('team rocket')) {
      parsed.set = 'Team Rocket';
    } else if (cardName.toLowerCase().includes('jungle')) {
      parsed.set = 'Jungle';
    } else if (cardName.toLowerCase().includes('fossil')) {
      parsed.set = 'Fossil';
    } else if (cardName.toLowerCase().includes('neo')) {
      parsed.set = 'Neo Genesis';
    } else if (cardName.toLowerCase().includes('gym')) {
      parsed.set = 'Gym Heroes';
    }

    // Extract card number
    const numberMatch = cardName.match(/#(\d+)/);
    if (numberMatch) {
      parsed.number = numberMatch[1];
    }

    // Extract grade and grader
    const gradeMatch = cardName.match(/(CGC|PSA|BGS)\s+(\d+(?:\.\d+)?)/i);
    if (gradeMatch) {
      parsed.grader = gradeMatch[1].toUpperCase();
      parsed.grade = `${parsed.grader} ${gradeMatch[2]}`;
    }

    // Check for language
    if (cardName.toLowerCase().includes('japanese')) {
      parsed.language = 'Japanese';
    }

    // Check for special attributes
    parsed.isHolo = cardName.toLowerCase().includes('holo');
    parsed.isFirstEdition = cardName.toLowerCase().includes('1st edition');
    parsed.isShadowless = cardName.toLowerCase().includes('shadowless');

    return parsed;
  }
}
