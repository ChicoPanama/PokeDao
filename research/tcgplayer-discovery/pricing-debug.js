#!/usr/bin/env node

// Quick diagnostic to understand the pricing logic issue

const Database = require('better-sqlite3');

const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
const pokemonDb = new Database('pokemon_tcg_complete.db', { readonly: true });

// Get the problematic card
const problemCard = ccDb.prepare("SELECT * FROM collector_crypt_cards WHERE price = 21000.0 LIMIT 1").get();

console.log('🔍 DEBUGGING PRICING LOGIC');
console.log('==========================');
console.log('Problem Card:', problemCard.title);
console.log('CC Price:', problemCard.price);

// Check Pokemon TCG API match
const pokemonMatch = pokemonDb.prepare(`
    SELECT name, json_extract(tcgplayer, '$.prices.holofoil.market') as market_price
    FROM pokemon_cards 
    WHERE name LIKE '%Mew%' 
    LIMIT 5
`).all();

console.log('\nPokemon TCG API matches for Mew:');
pokemonMatch.forEach((card, i) => {
    console.log(`${i+1}. ${card.name}: $${card.market_price}`);
});

// Test the marketPrices array logic
let marketPrices = [];
let ptcg_price = 0.0;
let tcgp_price = 0.04;

console.log('\nTesting marketPrices logic:');
console.log('ptcg_price:', ptcg_price, 'tcgp_price:', tcgp_price);

if (ptcg_price > 0) {
    console.log('Adding ptcg_price to array');
    marketPrices.push(ptcg_price);
} else {
    console.log('Skipping ptcg_price (not > 0)');
}

if (tcgp_price > 0) {
    console.log('Adding tcgp_price to array');
    marketPrices.push(tcgp_price);
} else {
    console.log('Skipping tcgp_price (not > 0)');
}

console.log('Final marketPrices array:', marketPrices);
console.log('Math.min(...marketPrices):', Math.min(...marketPrices));

ccDb.close();
pokemonDb.close();
