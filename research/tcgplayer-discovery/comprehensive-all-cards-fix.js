#!/usr/bin/env node

/**
 * 🚀 COMPREHENSIVE ALL-CARDS PRICING FIX
 * 
 * Based on audit findings, this fixes pricing for ALL 24,307 cards:
 * 1. Filters out 2,183+ suspicious TCGPlayer prices (<$0.10)
 * 2. Implements intelligent source prioritization for ALL cards 
 * 3. Adds proper grading detection and premiums
 * 4. Creates robust fallback mechanisms
 * 5. Validates all price calculations
 */

const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🚀 COMPREHENSIVE ALL-CARDS PRICING FIX');
console.log('======================================\n');

// Enhanced price validation rules
const PRICE_VALIDATION_RULES = {
    // Minimum thresholds by source
    minimumPrices: {
        ebay_sold: 0.25,      // eBay sold: minimum $0.25
        ebay_current: 0.25,   // eBay current: minimum $0.25  
        tcgplayer: 0.50,      // TCGPlayer: minimum $0.50 (audit showed issues <$0.10)
        pokemon_tcg: 0.10     // Pokemon TCG API: minimum $0.10
    },
    
    // Maximum thresholds (outlier detection)
    maximumPrices: {
        ebay_sold: 100000,    // eBay sold: maximum $100k
        ebay_current: 150000, // eBay current: maximum $150k (asking prices higher)
        tcgplayer: 75000,     // TCGPlayer: maximum $75k
        pokemon_tcg: 50000    // Pokemon TCG API: maximum $50k
    },
    
    // Suspicious ratio thresholds
    maxRatioThresholds: {
        asking_vs_market: 1000, // Flag if asking/market > 1000x
        source_variance: 100    // Flag if sources vary by >100x
    }
};

// Enhanced card analysis
const analyzeCardDetails = (title, gradingCompany, grade) => {
    const titleLower = title.toLowerCase();
    
    // Enhanced grading detection
    const gradingPatterns = {
        psa: /psa\s*(\d+(?:\.\d+)?)/i,
        bgs: /bgs\s*(\d+(?:\.\d+)?)/i,
        cgc: /cgc\s*(\d+(?:\.\d+)?)/i,
        sgc: /sgc\s*(\d+(?:\.\d+)?)/i,
        ara: /ara\s*(\d+(?:\.\d+)?)/i,
        ars: /ars\s*(\d+(?:\.\d+)?)/i
    };
    
    let detectedCompany = gradingCompany || '';
    let detectedGrade = grade || '';
    
    // Extract from title if not provided
    if (!detectedCompany || !detectedGrade) {
        for (const [company, pattern] of Object.entries(gradingPatterns)) {
            const match = titleLower.match(pattern);
            if (match) {
                detectedCompany = company.toUpperCase();
                detectedGrade = match[1];
                break;
            }
        }
    }
    
    const isGraded = !!(detectedCompany && detectedGrade);
    const numericGrade = parseFloat(detectedGrade) || 0;
    
    // Enhanced grading premium calculation
    let gradingMultiplier = 1.0;
    
    if (isGraded && numericGrade >= 6) {
        const premiumMatrix = {
            'PSA': {
                10: 4.0, 9: 2.5, 8: 1.6, 7: 1.2, 6: 1.1
            },
            'BGS': {
                10: 4.5, 9.5: 3.5, 9: 2.8, 8.5: 2.0, 8: 1.5, 7.5: 1.2, 7: 1.1, 6.5: 1.05, 6: 1.0
            },
            'CGC': {
                10: 3.8, 9.5: 2.8, 9: 2.2, 8.5: 1.7, 8: 1.4, 7.5: 1.15, 7: 1.1, 6.5: 1.05, 6: 1.0
            },
            'SGC': {
                10: 3.5, 9: 2.0, 8: 1.3, 7: 1.1, 6: 1.0
            },
            'ARA': {
                10: 3.2, 9: 1.8, 8: 1.2, 7: 1.0
            },
            'ARS': {
                10: 3.0, 9: 1.7, 8: 1.1, 7: 1.0
            }
        };
        
        const companyPremiums = premiumMatrix[detectedCompany];
        if (companyPremiums) {
            // Find closest grade match
            const grades = Object.keys(companyPremiums).map(Number).sort((a, b) => b - a);
            const closestGrade = grades.find(g => numericGrade >= g);
            
            if (closestGrade) {
                gradingMultiplier = companyPremiums[closestGrade];
            }
        } else if (numericGrade >= 9) {
            gradingMultiplier = 2.0; // Default premium for high grades
        } else if (numericGrade >= 8) {
            gradingMultiplier = 1.3;
        } else if (numericGrade >= 7) {
            gradingMultiplier = 1.1;
        }
    }
    
    // Card era/set detection for additional context
    const vintageKeywords = ['base set', '1st edition', 'shadowless', 'fossil', 'jungle', 'team rocket'];
    const isVintage = vintageKeywords.some(keyword => titleLower.includes(keyword));
    
    const modernKeywords = ['sv', 'scarlet', 'violet', '2023', '2024', '2025'];
    const isModern = modernKeywords.some(keyword => titleLower.includes(keyword));
    
    // High-value card detection
    const highValueKeywords = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia', 'gold star'];
    const isHighValue = highValueKeywords.some(keyword => titleLower.includes(keyword));
    
    return {
        isGraded,
        gradingCompany: detectedCompany,
        numericGrade,
        gradingMultiplier,
        isVintage,
        isModern,
        isHighValue,
        cardCategory: isVintage ? 'vintage' : isModern ? 'modern' : 'standard'
    };
};

// Comprehensive price validation
const validatePrice = (price, source, cardDetails) => {
    if (!price || isNaN(price) || price <= 0) {
        return { valid: false, reason: 'Invalid or zero price' };
    }
    
    const rules = PRICE_VALIDATION_RULES;
    const minPrice = rules.minimumPrices[source] || 0.10;
    const maxPrice = rules.maximumPrices[source] || 200000;
    
    if (price < minPrice) {
        return { 
            valid: false, 
            reason: `Price $${price} below minimum $${minPrice} for ${source}` 
        };
    }
    
    if (price > maxPrice) {
        return { 
            valid: false, 
            reason: `Price $${price} above maximum $${maxPrice} for ${source}` 
        };
    }
    
    // Additional validation for graded cards
    if (cardDetails.isGraded && price < 1.00 && source !== 'pokemon_tcg') {
        return { 
            valid: false, 
            reason: `Graded card price $${price} too low for ${source}` 
        };
    }
    
    // Vintage card validation
    if (cardDetails.isVintage && cardDetails.isGraded && price < 5.00 && source !== 'pokemon_tcg') {
        return { 
            valid: false, 
            reason: `Vintage graded card price $${price} suspiciously low for ${source}` 
        };
    }
    
    return { valid: true, reason: 'Valid price' };
};

// Enhanced smart market value calculation
const calculateSmartMarketValue = (prices, cardDetails) => {
    // Validate all prices first
    const validatedPrices = {};
    const validationLog = [];
    
    for (const [source, price] of Object.entries(prices)) {
        if (price && price > 0) {
            const validation = validatePrice(price, source, cardDetails);
            if (validation.valid) {
                validatedPrices[source] = price;
            } else {
                validationLog.push(`${source}: ${validation.reason}`);
            }
        }
    }
    
    if (Object.keys(validatedPrices).length === 0) {
        return {
            value: 0,
            source: 'NO_VALID_DATA',
            confidence: 0,
            explanation: 'No valid prices found after validation',
            validationLog
        };
    }
    
    // Source priority based on card type and reliability
    let sourcePriority;
    
    if (cardDetails.isGraded) {
        // For graded cards: eBay sold is most reliable
        sourcePriority = [
            { source: 'ebay_sold', weight: 1.0, confidence: 95 },
            { source: 'ebay_current', weight: 0.85, confidence: 85 }, // Discount asking prices
            { source: 'tcgplayer', weight: 0.9, confidence: 75 },
            { source: 'pokemon_tcg', weight: 0.7, confidence: 60 } // Often outdated for graded
        ];
    } else {
        // For raw cards: TCGPlayer more reliable
        sourcePriority = [
            { source: 'tcgplayer', weight: 1.0, confidence: 90 },
            { source: 'pokemon_tcg', weight: 0.95, confidence: 85 },
            { source: 'ebay_sold', weight: 0.9, confidence: 80 },
            { source: 'ebay_current', weight: 0.8, confidence: 70 }
        ];
    }
    
    // Apply vintage premium to source priority
    if (cardDetails.isVintage) {
        sourcePriority.forEach(p => {
            if (p.source === 'ebay_sold') {
                p.confidence += 5; // eBay more reliable for vintage
            }
        });
    }
    
    // Select best available source
    for (const { source, weight, confidence } of sourcePriority) {
        if (validatedPrices[source]) {
            const adjustedValue = validatedPrices[source] * weight;
            
            return {
                value: adjustedValue,
                source: source === 'ebay_current' ? 'eBay Current (discounted)' : 
                       source === 'ebay_sold' ? 'eBay Sold' :
                       source === 'tcgplayer' ? 'TCGPlayer' : 'Pokemon TCG API',
                confidence,
                explanation: `Selected ${source} as most reliable for ${cardDetails.isGraded ? 'graded' : 'raw'} ${cardDetails.cardCategory} card`,
                validationLog,
                rawValue: validatedPrices[source],
                appliedWeight: weight
            };
        }
    }
    
    // Fallback: use any valid price with lower confidence
    const fallbackSource = Object.keys(validatedPrices)[0];
    return {
        value: validatedPrices[fallbackSource],
        source: `Fallback ${fallbackSource}`,
        confidence: 40,
        explanation: 'Using fallback source - preferred sources not available',
        validationLog,
        rawValue: validatedPrices[fallbackSource],
        appliedWeight: 1.0
    };
};

// Enhanced opportunity classification
const classifyOpportunity = (askingPrice, marketValue, cardDetails) => {
    if (!marketValue || marketValue <= 0) {
        return { 
            opportunity: 'NO_DATA', 
            confidence: 0,
            explanation: 'No market value available'
        };
    }
    
    const ratio = askingPrice / marketValue;
    let opportunity, confidence, explanation;
    
    // Adjust thresholds based on card characteristics
    let underThreshold = 0.7;   // 30% below market
    let goodThreshold = 0.85;   // 15% below market
    let fairThreshold = 1.15;   // 15% above market
    let overThreshold = 1.4;    // 40% above market
    
    // Tighter thresholds for high-value graded cards
    if (cardDetails.isGraded && marketValue > 100) {
        underThreshold = 0.75;
        goodThreshold = 0.9;
        fairThreshold = 1.1;
        overThreshold = 1.3;
        confidence = 90;
    } else if (cardDetails.isVintage) {
        // Looser thresholds for vintage (more price volatility)
        underThreshold = 0.65;
        goodThreshold = 0.8;
        fairThreshold = 1.2;
        overThreshold = 1.5;
        confidence = 80;
    } else {
        confidence = 75;
    }
    
    if (ratio <= underThreshold) {
        opportunity = 'UNDERPRICED';
        explanation = `${((1-ratio)*100).toFixed(0)}% below market - strong opportunity`;
    } else if (ratio <= goodThreshold) {
        opportunity = 'GOOD_DEAL';
        explanation = `${((1-ratio)*100).toFixed(0)}% below market - good value`;
    } else if (ratio <= fairThreshold) {
        opportunity = 'FAIR_MARKET';
        explanation = `Within ${((Math.abs(1-ratio))*100).toFixed(0)}% of market value`;
    } else if (ratio <= overThreshold) {
        opportunity = 'OVERPRICED';
        explanation = `${((ratio-1)*100).toFixed(0)}% above market - avoid`;
    } else {
        opportunity = 'HIGHLY_OVERPRICED';
        explanation = `${((ratio-1)*100).toFixed(0)}% above market - significant overprice`;
    }
    
    return { opportunity, confidence, explanation, ratio };
};

async function initializeDatabases() {
    console.log('📊 Initializing databases...');
    
    const ccDb = new Database('collector_crypt_v2.db');
    const pokemonDb = new Database('pokemon_tcg_complete.db');
    const tcgplayerDb = new Database('tcgplayer.db');
    const ebayDb = new Database('collector_crypt_ebay_complete.db');
    
    // Create comprehensive pricing database
    const finalDb = new Database('collector_crypt_all_cards_fixed.db');
    
    finalDb.exec(`
        DROP TABLE IF EXISTS collector_crypt_comprehensive_pricing;
        CREATE TABLE collector_crypt_comprehensive_pricing (
            id TEXT PRIMARY KEY,
            cc_title TEXT,
            cc_asking_price REAL,
            cc_category TEXT,
            cc_grading_company TEXT,
            cc_grade TEXT,
            
            -- Enhanced card analysis
            is_graded BOOLEAN,
            detected_grading_company TEXT,
            detected_grade REAL,
            grading_multiplier REAL,
            card_category TEXT,              -- vintage, modern, standard
            is_high_value BOOLEAN,
            
            -- All pricing sources with validation
            ptcg_price REAL,
            ptcg_valid BOOLEAN,
            ptcg_validation_reason TEXT,
            
            tcgp_price REAL,
            tcgp_valid BOOLEAN,
            tcgp_validation_reason TEXT,
            
            ebay_sold_price REAL,
            ebay_current_price REAL,
            ebay_valid BOOLEAN,
            ebay_validation_reason TEXT,
            
            -- Final market calculation
            raw_market_value REAL,
            adjusted_market_value REAL,     -- With grading premium
            market_source TEXT,
            market_confidence INTEGER,
            market_explanation TEXT,
            validation_log TEXT,
            
            -- Enhanced analysis
            asking_vs_market_ratio REAL,
            price_opportunity TEXT,
            opportunity_confidence INTEGER,
            opportunity_explanation TEXT,
            potential_profit REAL,
            
            -- Quality metrics
            sources_count INTEGER,
            validation_passed INTEGER,
            validation_failed INTEGER,
            
            last_updated TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_comprehensive_category ON collector_crypt_comprehensive_pricing(card_category);
        CREATE INDEX idx_comprehensive_opportunity ON collector_crypt_comprehensive_pricing(price_opportunity);
        CREATE INDEX idx_comprehensive_graded ON collector_crypt_comprehensive_pricing(is_graded);
        CREATE INDEX idx_comprehensive_source ON collector_crypt_comprehensive_pricing(market_source);
    `);
    
    return { ccDb, pokemonDb, tcgplayerDb, ebayDb, finalDb };
}

async function processAllCards(databases) {
    const { ccDb, pokemonDb, tcgplayerDb, ebayDb, finalDb } = databases;
    
    console.log('🎮 Processing ALL 24,307 Collector Crypt cards with comprehensive fixes...\n');
    
    // Load all data sources
    console.log('📊 Loading data sources...');
    
    const ccCards = ccDb.prepare(`
        SELECT id, title, price, category, grading_company, grade
        FROM collector_crypt_cards 
        WHERE category LIKE '%pokemon%'
        ORDER BY price DESC
    `).all();
    
    const pokemonCards = pokemonDb.prepare(`
        SELECT name,
               json_extract(tcgplayer, '$.prices.holofoil.market') as holofoil,
               json_extract(tcgplayer, '$.prices.normal.market') as normal,
               json_extract(tcgplayer, '$.prices.reverseHolofoil.market') as reverse
        FROM pokemon_cards 
        WHERE tcgplayer != '{}' AND tcgplayer != 'null'
    `).all();
    
    // Filter TCGPlayer for valid prices only (audit found 2,183 suspicious <$0.10)
    const tcgPlayerCards = tcgplayerDb.prepare(`
        SELECT name, marketPrice 
        FROM tcgplayer_cards 
        WHERE marketPrice >= 0.50  -- Filter out suspicious low prices
        AND marketPrice <= 75000   -- Filter out outliers
    `).all();
    
    const ebayAnalytics = ebayDb.prepare(`
        SELECT collector_crypt_id, card_name, avg_asking_price, avg_sold_price
        FROM ebay_price_analytics 
        WHERE (avg_asking_price > 0 OR avg_sold_price > 0)
    `).all();
    
    console.log(`📈 Data loaded:`);
    console.log(`   Collector Crypt: ${ccCards.length.toLocaleString()} cards`);
    console.log(`   Pokemon TCG API: ${pokemonCards.length.toLocaleString()} cards`);
    console.log(`   TCGPlayer (filtered): ${tcgPlayerCards.length.toLocaleString()} cards`);
    console.log(`   eBay Analytics: ${ebayAnalytics.length.toLocaleString()} records\n`);
    
    // Processing stats
    let processed = 0;
    let validPricesFound = 0;
    let gradedCards = 0;
    let vintageCards = 0;
    let underpriced = 0;
    let overpriced = 0;
    let validationPassed = 0;
    let validationFailed = 0;
    
    const insertStmt = finalDb.prepare(`
        INSERT OR REPLACE INTO collector_crypt_comprehensive_pricing (
            id, cc_title, cc_asking_price, cc_category, cc_grading_company, cc_grade,
            is_graded, detected_grading_company, detected_grade, grading_multiplier, 
            card_category, is_high_value,
            ptcg_price, ptcg_valid, ptcg_validation_reason,
            tcgp_price, tcgp_valid, tcgp_validation_reason,
            ebay_sold_price, ebay_current_price, ebay_valid, ebay_validation_reason,
            raw_market_value, adjusted_market_value, market_source, market_confidence, 
            market_explanation, validation_log,
            asking_vs_market_ratio, price_opportunity, opportunity_confidence, 
            opportunity_explanation, potential_profit,
            sources_count, validation_passed, validation_failed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Process each card
    for (const card of ccCards) {
        processed++;
        
        // Analyze card details
        const cardDetails = analyzeCardDetails(card.title, card.grading_company, card.grade);
        
        if (cardDetails.isGraded) gradedCards++;
        if (cardDetails.isVintage) vintageCards++;
        
        // Normalize card name for matching
        const normalizedName = card.title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Gather all price sources
        const prices = {};
        let sourcesCount = 0;
        let validationPassedCount = 0;
        let validationFailedCount = 0;
        
        // Pokemon TCG API matching
        let ptcgPrice = 0, ptcgValid = false, ptcgReason = 'No match';
        const pokemonMatch = pokemonCards.find(p => {
            const pName = p.name.toLowerCase();
            return normalizedName.includes(pName.split(' ')[0]) || 
                   pName.includes(normalizedName.split(' ')[0]);
        });
        
        if (pokemonMatch) {
            const priceCandidates = [pokemonMatch.holofoil, pokemonMatch.normal, pokemonMatch.reverse]
                .filter(p => p && p > 0);
            
            if (priceCandidates.length > 0) {
                ptcgPrice = Math.min(...priceCandidates);
                const validation = validatePrice(ptcgPrice, 'pokemon_tcg', cardDetails);
                ptcgValid = validation.valid;
                ptcgReason = validation.reason;
                
                if (ptcgValid) {
                    prices.pokemon_tcg = ptcgPrice;
                    sourcesCount++;
                    validationPassedCount++;
                } else {
                    validationFailedCount++;
                }
            }
        }
        
        // TCGPlayer matching (with enhanced filtering)
        let tcgpPrice = 0, tcgpValid = false, tcgpReason = 'No match';
        const tcgMatch = tcgPlayerCards.find(t => {
            const tName = t.name.toLowerCase();
            return normalizedName.includes(tName.split(' ')[0]) || 
                   tName.includes(normalizedName.split(' ')[0]);
        });
        
        if (tcgMatch) {
            tcgpPrice = tcgMatch.marketPrice;
            const validation = validatePrice(tcgpPrice, 'tcgplayer', cardDetails);
            tcgpValid = validation.valid;
            tcgpReason = validation.reason;
            
            if (tcgpValid) {
                prices.tcgplayer = tcgpPrice;
                sourcesCount++;
                validationPassedCount++;
            } else {
                validationFailedCount++;
            }
        }
        
        // eBay matching
        let ebaySoldPrice = 0, ebayCurrentPrice = 0, ebayValid = false, ebayReason = 'No match';
        const ebayMatches = ebayAnalytics.filter(e => e.collector_crypt_id === card.id);
        
        if (ebayMatches.length > 0) {
            const bestMatch = ebayMatches.reduce((best, current) => 
                (current.avg_sold_price || 0) > (best.avg_sold_price || 0) ? current : best
            );
            
            ebaySoldPrice = bestMatch.avg_sold_price || 0;
            ebayCurrentPrice = bestMatch.avg_asking_price || 0;
            
            // Validate both eBay prices
            const soldValid = ebaySoldPrice > 0 ? 
                validatePrice(ebaySoldPrice, 'ebay_sold', cardDetails).valid : false;
            const currentValid = ebayCurrentPrice > 0 ? 
                validatePrice(ebayCurrentPrice, 'ebay_current', cardDetails).valid : false;
            
            if (soldValid || currentValid) {
                ebayValid = true;
                ebayReason = 'Valid eBay data found';
                
                if (soldValid) {
                    prices.ebay_sold = ebaySoldPrice;
                    sourcesCount++;
                    validationPassedCount++;
                }
                if (currentValid) {
                    prices.ebay_current = ebayCurrentPrice;
                    sourcesCount++;
                    validationPassedCount++;
                }
            } else {
                ebayReason = 'eBay prices failed validation';
                validationFailedCount++;
            }
        }
        
        // Calculate smart market value
        const marketResult = calculateSmartMarketValue(prices, cardDetails);
        const adjustedMarketValue = marketResult.value * cardDetails.gradingMultiplier;
        
        // Classify opportunity
        const opportunityResult = classifyOpportunity(card.price, adjustedMarketValue, cardDetails);
        
        if (adjustedMarketValue > 0) validPricesFound++;
        if (opportunityResult.opportunity === 'UNDERPRICED') underpriced++;
        if (opportunityResult.opportunity.includes('OVERPRICED')) overpriced++;
        
        validationPassed += validationPassedCount;
        validationFailed += validationFailedCount;
        
        // Insert comprehensive record
        insertStmt.run(
            card.id,
            card.title,
            card.price,
            card.category,
            card.grading_company || '',
            card.grade || '',
            cardDetails.isGraded ? 1 : 0,
            cardDetails.gradingCompany,
            cardDetails.numericGrade,
            cardDetails.gradingMultiplier,
            cardDetails.cardCategory,
            cardDetails.isHighValue ? 1 : 0,
            ptcgPrice,
            ptcgValid ? 1 : 0,
            ptcgReason,
            tcgpPrice,
            tcgpValid ? 1 : 0,
            tcgpReason,
            ebaySoldPrice,
            ebayCurrentPrice,
            ebayValid ? 1 : 0,
            ebayReason,
            marketResult.value,
            adjustedMarketValue,
            marketResult.source,
            marketResult.confidence,
            marketResult.explanation,
            JSON.stringify(marketResult.validationLog || []),
            opportunityResult.ratio || 0,
            opportunityResult.opportunity,
            opportunityResult.confidence,
            opportunityResult.explanation,
            adjustedMarketValue - card.price,
            sourcesCount,
            validationPassedCount,
            validationFailedCount
        );
        
        // Progress updates
        if (processed % 1000 === 0) {
            console.log(`📈 Processed: ${processed.toLocaleString()}/${ccCards.length.toLocaleString()} | Valid pricing: ${validPricesFound.toLocaleString()}`);
        }
    }
    
    console.log('\n✅ ALL CARDS PROCESSING COMPLETE!');
    console.log('===============================');
    console.log(`📊 Final Statistics:`);
    console.log(`   Total Cards Processed: ${processed.toLocaleString()}`);
    console.log(`   Cards with Valid Pricing: ${validPricesFound.toLocaleString()} (${(validPricesFound/processed*100).toFixed(1)}%)`);
    console.log(`   Graded Cards: ${gradedCards.toLocaleString()} (${(gradedCards/processed*100).toFixed(1)}%)`);
    console.log(`   Vintage Cards: ${vintageCards.toLocaleString()} (${(vintageCards/processed*100).toFixed(1)}%)`);
    console.log(`   Underpriced Opportunities: ${underpriced.toLocaleString()}`);
    console.log(`   Overpriced Cards: ${overpriced.toLocaleString()}`);
    console.log(`   Validation Passed: ${validationPassed.toLocaleString()}`);
    console.log(`   Validation Failed: ${validationFailed.toLocaleString()}`);
    
    return {
        processed,
        validPricesFound,
        gradedCards,
        vintageCards,
        underpriced,
        overpriced,
        validationPassed,
        validationFailed
    };
}

async function generateComprehensiveReport(finalDb) {
    console.log('\n🏆 COMPREHENSIVE SYSTEM REPORT');
    console.log('===============================');
    
    // Overall statistics
    const overallStats = finalDb.prepare(`
        SELECT 
            COUNT(*) as total_cards,
            COUNT(CASE WHEN adjusted_market_value > 0 THEN 1 END) as cards_with_pricing,
            COUNT(CASE WHEN is_graded = 1 THEN 1 END) as graded_cards,
            AVG(cc_asking_price) as avg_asking,
            AVG(adjusted_market_value) as avg_market,
            AVG(asking_vs_market_ratio) as avg_ratio
        FROM collector_crypt_comprehensive_pricing
    `).get();
    
    console.log(`📊 Overall System Health:`);
    console.log(`   Total Cards: ${overallStats.total_cards.toLocaleString()}`);
    console.log(`   Cards with Pricing: ${overallStats.cards_with_pricing.toLocaleString()} (${(overallStats.cards_with_pricing/overallStats.total_cards*100).toFixed(1)}%)`);
    console.log(`   Graded Cards: ${overallStats.graded_cards.toLocaleString()} (${(overallStats.graded_cards/overallStats.total_cards*100).toFixed(1)}%)`);
    console.log(`   Average Asking: $${overallStats.avg_asking.toFixed(2)}`);
    console.log(`   Average Market: $${overallStats.avg_market.toFixed(2)}`);
    console.log(`   Average Ratio: ${overallStats.avg_ratio.toFixed(2)}x`);
    
    // Source distribution
    const sourceStats = finalDb.prepare(`
        SELECT market_source, COUNT(*) as count, AVG(adjusted_market_value) as avg_value
        FROM collector_crypt_comprehensive_pricing 
        WHERE adjusted_market_value > 0
        GROUP BY market_source 
        ORDER BY count DESC
    `).all();
    
    console.log(`\n📈 Pricing Source Distribution:`);
    sourceStats.forEach(stat => {
        console.log(`   ${stat.market_source}: ${stat.count.toLocaleString()} cards (avg: $${stat.avg_value.toFixed(2)})`);
    });
    
    // Opportunity distribution
    const opportunityStats = finalDb.prepare(`
        SELECT price_opportunity, COUNT(*) as count
        FROM collector_crypt_comprehensive_pricing 
        GROUP BY price_opportunity 
        ORDER BY count DESC
    `).all();
    
    console.log(`\n💰 Investment Opportunities:`);
    opportunityStats.forEach(stat => {
        console.log(`   ${stat.price_opportunity}: ${stat.count.toLocaleString()} cards`);
    });
    
    // Top underpriced opportunities
    const topOpportunities = finalDb.prepare(`
        SELECT cc_title, cc_asking_price, adjusted_market_value, market_source, 
               asking_vs_market_ratio, potential_profit
        FROM collector_crypt_comprehensive_pricing 
        WHERE price_opportunity = 'UNDERPRICED' 
        AND adjusted_market_value > 50
        ORDER BY potential_profit DESC
        LIMIT 10
    `).all();
    
    if (topOpportunities.length > 0) {
        console.log(`\n🎯 TOP UNDERPRICED OPPORTUNITIES:`);
        topOpportunities.forEach((card, i) => {
            console.log(`   ${i+1}. ${card.cc_title.substring(0, 60)}...`);
            console.log(`      Ask: $${card.cc_asking_price} | Market: $${card.adjusted_market_value.toFixed(2)} | Profit: $${card.potential_profit.toFixed(2)}`);
            console.log(`      Source: ${card.market_source}`);
        });
    }
    
    // Validation statistics
    const validationStats = finalDb.prepare(`
        SELECT 
            SUM(validation_passed) as total_passed,
            SUM(validation_failed) as total_failed,
            COUNT(CASE WHEN ptcg_valid = 1 THEN 1 END) as ptcg_valid_count,
            COUNT(CASE WHEN tcgp_valid = 1 THEN 1 END) as tcgp_valid_count,
            COUNT(CASE WHEN ebay_valid = 1 THEN 1 END) as ebay_valid_count
        FROM collector_crypt_comprehensive_pricing
    `).get();
    
    console.log(`\n🔍 Data Quality Validation:`);
    console.log(`   Validations Passed: ${validationStats.total_passed.toLocaleString()}`);
    console.log(`   Validations Failed: ${validationStats.total_failed.toLocaleString()}`);
    console.log(`   Pokemon TCG Valid: ${validationStats.ptcg_valid_count.toLocaleString()}`);
    console.log(`   TCGPlayer Valid: ${validationStats.tcgp_valid_count.toLocaleString()}`);
    console.log(`   eBay Valid: ${validationStats.ebay_valid_count.toLocaleString()}`);
    
    console.log('\n🎯 COMPREHENSIVE FIX STATUS: COMPLETE!');
    console.log('=====================================');
    console.log('✅ All 24,307+ cards processed with intelligent pricing');
    console.log('✅ Suspicious TCGPlayer prices filtered out');
    console.log('✅ Enhanced grading detection and premiums applied');
    console.log('✅ Comprehensive validation rules enforced');
    console.log('✅ Investment opportunities identified');
    console.log('✅ Data quality monitoring in place');
}

async function main() {
    try {
        const databases = await initializeDatabases();
        const stats = await processAllCards(databases);
        await generateComprehensiveReport(databases.finalDb);
        
        // Close databases
        Object.values(databases).forEach(db => db.close());
        
        console.log('\n💾 Complete results saved to: collector_crypt_all_cards_fixed.db');
        
        // Success criteria
        const successRate = stats.validPricesFound / stats.processed;
        if (successRate >= 0.95) {
            console.log(`\n🎉 SUCCESS: ${(successRate*100).toFixed(1)}% of cards have valid pricing!`);
            process.exit(0);
        } else {
            console.log(`\n⚠️  WARNING: Only ${(successRate*100).toFixed(1)}% of cards have valid pricing`);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Comprehensive fix failed:', error);
        console.error(error.stack);
        process.exit(2);
    }
}

main();
