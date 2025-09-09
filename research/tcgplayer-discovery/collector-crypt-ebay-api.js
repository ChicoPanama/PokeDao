
/**
 * 🛒 COLLECTOR CRYPT EBAY PRICING API
 * Access comprehensive eBay market data
 */

const Database = require('better-sqlite3');
const db = new Database('collector_crypt_ebay_complete.db');

// Get complete eBay analysis for a card
function getEbayAnalysis(collectorCryptId) {
    const analytics = db.prepare(`
        SELECT * FROM ebay_price_analytics 
        WHERE collector_crypt_id = ?
    `).get(collectorCryptId);
    
    const currentListings = db.prepare(`
        SELECT * FROM ebay_current_listings 
        WHERE collector_crypt_id = ? 
        ORDER BY current_price ASC
    `).all(collectorCryptId);
    
    const recentSold = db.prepare(`
        SELECT * FROM ebay_sold_listings 
        WHERE collector_crypt_id = ? 
        ORDER BY sold_date DESC 
        LIMIT 10
    `).all(collectorCryptId);
    
    return {
        analytics,
        currentListings,
        recentSold,
        marketInsight: generateMarketInsight(analytics, currentListings, recentSold)
    };
}

// Search eBay data by Pokemon name
function searchEbayByPokemon(pokemonName) {
    return db.prepare(`
        SELECT * FROM ebay_price_analytics 
        WHERE card_name LIKE ? 
        ORDER BY avg_sold_price DESC
    `).all(`%${pokemonName}%`);
}

// Get market opportunities
function getMarketOpportunities(minSavings = 10) {
    return db.prepare(`
        SELECT *, (avg_sold_price - avg_asking_price) as potential_savings
        FROM ebay_price_analytics 
        WHERE asking_vs_sold_ratio < 0.9 
        AND (avg_sold_price - avg_asking_price) >= ?
        ORDER BY potential_savings DESC
    `).all(minSavings);
}

function generateMarketInsight(analytics, currentListings, recentSold) {
    if (!analytics) return 'No data available';
    
    let insight = `Market Analysis for ${analytics.card_name}:\n`;
    insight += `• Current market has ${analytics.current_listings_count} active listings\n`;
    insight += `• Average asking price: $${analytics.avg_asking_price?.toFixed(2)}\n`;
    insight += `• Recent sold average: $${analytics.avg_sold_price?.toFixed(2)}\n`;
    insight += `• Market velocity: ${analytics.market_velocity} days to sell\n`;
    insight += `• Demand level: ${analytics.demand_indicator}\n`;
    
    if (analytics.asking_vs_sold_ratio < 0.8) {
        insight += `🔥 HOT DEAL: Current asking prices are ${((1 - analytics.asking_vs_sold_ratio) * 100).toFixed(0)}% below recent sold prices!\n`;
    } else if (analytics.asking_vs_sold_ratio > 1.2) {
        insight += `⚠️ OVERPRICED: Current asking prices are ${((analytics.asking_vs_sold_ratio - 1) * 100).toFixed(0)}% above recent sold prices.\n`;
    }
    
    return insight;
}

module.exports = { 
    getEbayAnalysis, 
    searchEbayByPokemon, 
    getMarketOpportunities,
    generateMarketInsight
};
