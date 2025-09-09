
/**
 * 🎯 COLLECTOR CRYPT PRICING API
 * Query the complete pricing database
 */

const Database = require('better-sqlite3');
const db = new Database('collector_crypt_pricing_complete.db');

// Get card pricing by title
function getCardPricing(title) {
    return db.prepare(`
        SELECT * FROM collector_crypt_pricing 
        WHERE cc_title LIKE ? 
        ORDER BY confidence_score DESC
    `).all(`%${title}%`);
}

// Get high-value cards
function getHighValueCards(minPrice = 100) {
    return db.prepare(`
        SELECT cc_title, recommended_price, confidence_score 
        FROM collector_crypt_pricing 
        WHERE recommended_price >= ? AND confidence_score > 70
        ORDER BY recommended_price DESC
    `).all(minPrice);
}

// Search by Pokemon name
function searchPokemon(pokemonName) {
    return db.prepare(`
        SELECT * FROM collector_crypt_pricing 
        WHERE cc_title LIKE ? OR ptcg_name LIKE ?
        ORDER BY confidence_score DESC
    `).all(`%${pokemonName}%`, `%${pokemonName}%`);
}

module.exports = { getCardPricing, getHighValueCards, searchPokemon };
