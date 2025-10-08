import { describe, it, expect } from 'vitest';
import { extractCardMentions } from '../reddit-scraper';

describe('Reddit Scraper', () => {
  describe('extractCardMentions', () => {
    it('should extract single card mention', () => {
      const text = 'Just bought a Charizard card!';
      const mentions = extractCardMentions(text);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].cardName).toBe('Charizard');
    });

    it('should extract card with set name', () => {
      const text = 'Charizard from Base Set is amazing';
      const mentions = extractCardMentions(text);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].cardName).toBe('Charizard');
      expect(mentions[0].setName).toBe('Base Set');
    });

    it('should extract multiple cards', () => {
      const text = 'I have Pikachu, Charizard, and Mewtwo';
      const mentions = extractCardMentions(text);

      expect(mentions.length).toBeGreaterThan(1);
    });

    it('should return empty array for no matches', () => {
      const text = 'Just some random text with no Pokemon';
      const mentions = extractCardMentions(text);

      expect(mentions).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const text = 'CHARIZARD is the best';
      const mentions = extractCardMentions(text);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].cardName).toBe('Charizard');
    });
  });
});
