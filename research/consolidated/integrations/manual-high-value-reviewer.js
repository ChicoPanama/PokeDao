/**
 * Manual High-Value Card Reviewer
 * Provides interactive review and manual matching for $14,000+ cards
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const readline = require('readline');

class ManualHighValueReviewer {
  constructor() {
    const path = require('path');
    const workingDir = process.cwd();
    
    this.phygitalsDb = new Database(path.join(workingDir, 'phygitals_pokemon_complete.db'));
    this.ultimateDb = new Database(path.join(workingDir, 'collector_crypt_ultimate_pricing.db'));
    
    // Solana conversion rate
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Get high-value unmatched cards for manual review
  getHighValueUnmatchedCards() {
    console.log('🔍 IDENTIFYING HIGH-VALUE UNMATCHED CARDS');
    console.log('========================================');

    const highValueCards = this.phygitalsDb.prepare(`
      SELECT id, name, price, grader, grade 
      FROM phygitals_cards 
      WHERE price > 0 
      AND (price / ${this.LAMPORTS_PER_SOL} * ${this.SOL_TO_USD}) >= 1000
      AND id NOT IN (
        SELECT SUBSTR(phygitals_source, -44) FROM collector_crypt_ultimate_pricing 
        WHERE phygitals_source IS NOT NULL
        AND phygitals_source LIKE '%phygitals.com/card/%'
      )
      ORDER BY price DESC
    `).all();

    console.log(`💰 Found ${highValueCards.length} high-value unmatched cards:`);
    
    return highValueCards.map(card => ({
      ...card,
      usdPrice: (card.price / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD
    }));
  }

  // Find potential matches for a high-value card
  findPotentialMatches(phygitalsCard, usdPrice) {
    const cardInfo = this.extractCardInfo(phygitalsCard.name);
    
    // Strategy 1: Exact Pokemon + Set + Grade match
    let matches = this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
      ORDER BY ABS(final_market_value - ?) ASC
      LIMIT 5
    `).all(`%${cardInfo.pokemonName}%`, `%${cardInfo.set}%`, `%${cardInfo.grade}%`, usdPrice);

    // Strategy 2: Pokemon + Set match (if no exact matches)
    if (matches.length === 0 && cardInfo.pokemonName && cardInfo.set) {
      matches = this.ultimateDb.prepare(`
        SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
        WHERE phygitals_price IS NULL
          AND LOWER(cc_title) LIKE LOWER(?)
          AND LOWER(cc_title) LIKE LOWER(?)
        ORDER BY ABS(final_market_value - ?) ASC
        LIMIT 5
      `).all(`%${cardInfo.pokemonName}%`, `%${cardInfo.set}%`, usdPrice);
    }

    // Strategy 3: Pokemon + Year match
    if (matches.length === 0 && cardInfo.pokemonName && cardInfo.year) {
      matches = this.ultimateDb.prepare(`
        SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
        WHERE phygitals_price IS NULL
          AND LOWER(cc_title) LIKE LOWER(?)
          AND LOWER(cc_title) LIKE LOWER(?)
        ORDER BY ABS(final_market_value - ?) ASC
        LIMIT 5
      `).all(`%${cardInfo.pokemonName}%`, `%${cardInfo.year}%`, usdPrice);
    }

    // Strategy 4: Price range match (last resort)
    if (matches.length === 0) {
      matches = this.ultimateDb.prepare(`
        SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
        WHERE phygitals_price IS NULL
          AND final_market_value BETWEEN ? AND ?
        ORDER BY ABS(final_market_value - ?) ASC
        LIMIT 10
      `).all(usdPrice * 0.3, usdPrice * 3.0, usdPrice);
    }

    return matches;
  }

  extractCardInfo(cardName) {
    const info = {
      year: null,
      pokemonName: null,
      set: null,
      grade: null,
      gradingCompany: null,
      edition: null
    };

    // Extract year
    const yearMatch = cardName.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) info.year = yearMatch[0];

    // Extract Pokemon name
    const pokemonPatterns = [
      /\b(Charizard|Pikachu|Blastoise|Venusaur|Mew|Mewtwo|Lugia|Ho-oh|Rayquaza|Arceus|Dialga|Palkia|Giratina|Reshiram|Zekrom|Kyurem|Xerneas|Yveltal|Zygarde|Solgaleo|Lunala|Necrozma|Zacian|Zamazenta|Eternatus)\b/i,
      /Pokemon\s+.*?\b([A-Z][a-z]+(?:'s)?)\b/i,
      /\b([A-Z][a-z]+)\s+(?:ex|EX|GX|V|VMAX|VSTAR)\b/i
    ];

    for (const pattern of pokemonPatterns) {
      const match = cardName.match(pattern);
      if (match) {
        info.pokemonName = match[1].toLowerCase();
        break;
      }
    }

    // Extract set
    const setPatterns = [
      /Base Set/i, /Shadowless/i, /1st Edition/i, /Jungle/i, /Fossil/i,
      /Team Rocket/i, /Gym/i, /Neo/i, /Expedition/i, /Aquapolis/i, /Skyridge/i
    ];

    for (const pattern of setPatterns) {
      if (pattern.test(cardName)) {
        info.set = cardName.match(pattern)[0];
        break;
      }
    }

    // Extract grading
    const gradingMatch = cardName.match(/(PSA|BGS|CGC|SGC)\s*(\d+(?:\.\d+)?)/i);
    if (gradingMatch) {
      info.gradingCompany = gradingMatch[1];
      info.grade = gradingMatch[2];
    }

    // Extract edition
    if (cardName.toLowerCase().includes('1st edition') || cardName.toLowerCase().includes('first edition')) {
      info.edition = '1st edition';
    } else if (cardName.toLowerCase().includes('shadowless')) {
      info.edition = 'shadowless';
    }

    return info;
  }

  // Interactive review process
  async reviewHighValueCards() {
    console.log('🎯 STARTING MANUAL HIGH-VALUE CARD REVIEW');
    console.log('========================================');

    const highValueCards = this.getHighValueUnmatchedCards();
    let reviewedCount = 0;
    let matchedCount = 0;
    const reviewResults = [];

    for (const card of highValueCards) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📋 REVIEWING CARD ${reviewedCount + 1}/${highValueCards.length}`);
      console.log(`${'='.repeat(80)}`);
      
      console.log(`\n💎 PHYGITALS CARD:`);
      console.log(`   Name: ${card.name}`);
      console.log(`   Price: $${card.usdPrice.toFixed(2)}`);
      console.log(`   Grade: ${card.grade || 'Raw'}`);
      console.log(`   ID: ${card.id}`);

      // Find potential matches
      const potentialMatches = this.findPotentialMatches(card, card.usdPrice);
      
      if (potentialMatches.length > 0) {
        console.log(`\n🎯 POTENTIAL MATCHES:`);
        potentialMatches.forEach((match, index) => {
          const priceDiff = Math.abs(match.final_market_value - card.usdPrice);
          const priceDiffPct = (priceDiff / card.usdPrice) * 100;
          console.log(`\n   ${index + 1}. ${match.cc_title}`);
          console.log(`      💰 Market Value: $${match.final_market_value.toFixed(2)}`);
          console.log(`      📊 Price Difference: $${priceDiff.toFixed(2)} (${priceDiffPct.toFixed(1)}%)`);
          console.log(`      🆔 ID: ${match.id}`);
        });

        // Ask for user input
        const choice = await this.askQuestion(
          `\n❓ Do you want to match this card? (Enter number 1-${potentialMatches.length}, or 's' to skip, or 'q' to quit): `
        );

        if (choice.toLowerCase() === 'q') {
          console.log('\n👋 Review process terminated by user.');
          break;
        } else if (choice.toLowerCase() === 's') {
          console.log('⏭️  Skipped this card.');
          reviewResults.push({
            phygitalsCard: card,
            action: 'skipped',
            reason: 'user_choice'
          });
        } else {
          const matchIndex = parseInt(choice) - 1;
          if (matchIndex >= 0 && matchIndex < potentialMatches.length) {
            const selectedMatch = potentialMatches[matchIndex];
            
            // Confirm the match
            const confirm = await this.askQuestion(
              `\n✅ Confirm match: "${card.name}" → "${selectedMatch.cc_title}"? (y/n): `
            );
            
            if (confirm.toLowerCase() === 'y') {
              // Update the database
              const updateStmt = this.ultimateDb.prepare(`
                UPDATE collector_crypt_ultimate_pricing 
                SET phygitals_price = ?, phygitals_source = ?
                WHERE id = ?
              `);
              
              updateStmt.run(
                card.usdPrice,
                `https://www.phygitals.com/card/${card.id}`,
                selectedMatch.id
              );
              
              console.log('✅ Match confirmed and saved to database!');
              matchedCount++;
              
              reviewResults.push({
                phygitalsCard: card,
                action: 'matched',
                matchedCard: selectedMatch,
                priceDifference: Math.abs(selectedMatch.final_market_value - card.usdPrice)
              });
            } else {
              console.log('❌ Match cancelled.');
              reviewResults.push({
                phygitalsCard: card,
                action: 'cancelled',
                reason: 'user_cancelled'
              });
            }
          } else {
            console.log('❌ Invalid choice. Skipping this card.');
            reviewResults.push({
              phygitalsCard: card,
              action: 'skipped',
              reason: 'invalid_choice'
            });
          }
        }
      } else {
        console.log(`\n❌ No potential matches found for this card.`);
        reviewResults.push({
          phygitalsCard: card,
          action: 'no_matches',
          reason: 'no_potential_matches'
        });
      }

      reviewedCount++;
      
      // Show progress
      if (reviewedCount % 5 === 0) {
        console.log(`\n📊 Progress: ${reviewedCount}/${highValueCards.length} reviewed, ${matchedCount} matched`);
      }
    }

    // Generate final report
    this.generateReviewReport(reviewResults, reviewedCount, matchedCount);
    
    return {
      totalReviewed: reviewedCount,
      totalMatched: matchedCount,
      reviewResults
    };
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  generateReviewReport(reviewResults, totalReviewed, totalMatched) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 MANUAL REVIEW COMPLETE');
    console.log(`${'='.repeat(80)}`);
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total cards reviewed: ${totalReviewed}`);
    console.log(`   Total matches made: ${totalMatched}`);
    console.log(`   Match rate: ${((totalMatched / totalReviewed) * 100).toFixed(1)}%`);

    const matchedCards = reviewResults.filter(r => r.action === 'matched');
    const skippedCards = reviewResults.filter(r => r.action === 'skipped');
    const noMatchCards = reviewResults.filter(r => r.action === 'no_matches');

    console.log(`\n📋 BREAKDOWN:`);
    console.log(`   ✅ Matched: ${matchedCards.length}`);
    console.log(`   ⏭️  Skipped: ${skippedCards.length}`);
    console.log(`   ❌ No matches: ${noMatchCards.length}`);

    if (matchedCards.length > 0) {
      console.log(`\n🏆 SUCCESSFUL MATCHES:`);
      matchedCards.forEach((result, index) => {
        console.log(`\n   ${index + 1}. ${result.phygitalsCard.name}`);
        console.log(`      💵 Phygitals: $${result.phygitalsCard.usdPrice.toFixed(2)}`);
        console.log(`      💎 Market: $${result.matchedCard.final_market_value.toFixed(2)}`);
        console.log(`      📊 Difference: $${result.priceDifference.toFixed(2)}`);
      });
    }

    // Save detailed report
    const report = {
      summary: {
        totalReviewed,
        totalMatched,
        matchRate: `${((totalMatched / totalReviewed) * 100).toFixed(1)}%`,
        timestamp: new Date().toISOString()
      },
      breakdown: {
        matched: matchedCards.length,
        skipped: skippedCards.length,
        noMatches: noMatchCards.length
      },
      successfulMatches: matchedCards.map(result => ({
        phygitalsCard: {
          name: result.phygitalsCard.name,
          price: result.phygitalsCard.usdPrice,
          id: result.phygitalsCard.id
        },
        matchedCard: {
          name: result.matchedCard.cc_title,
          marketValue: result.matchedCard.final_market_value,
          id: result.matchedCard.id
        },
        priceDifference: result.priceDifference
      })),
      allResults: reviewResults
    };

    fs.writeFileSync('manual-review-report.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: manual-review-report.json`);
  }

  // Close resources
  close() {
    this.rl.close();
    this.phygitalsDb.close();
    this.ultimateDb.close();
  }
}

// Run manual review
async function main() {
  const reviewer = new ManualHighValueReviewer();
  
  try {
    await reviewer.reviewHighValueCards();
  } catch (error) {
    console.error('💥 Manual review failed:', error);
  } finally {
    reviewer.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ManualHighValueReviewer;
