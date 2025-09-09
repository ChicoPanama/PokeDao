const Database = require('better-sqlite3');

console.log('Testing database connections...');

try {
  console.log('Testing phygitals database...');
  const phygitalsDb = new Database('phygitals_pokemon_complete.db');
  const phygitalsCount = phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_cards WHERE price > 0').get();
  console.log(`✅ Phygitals DB: ${phygitalsCount.count} cards with prices`);
  phygitalsDb.close();
  
  console.log('Testing ultimate database...');
  const ultimateDb = new Database('collector_crypt_ultimate_pricing.db');
  const ultimateCount = ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_ultimate_pricing').get();
  console.log(`✅ Ultimate DB: ${ultimateCount.count} total cards`);
  
  const integratedCount = ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_ultimate_pricing WHERE phygitals_price IS NOT NULL').get();
  console.log(`✅ Already integrated: ${integratedCount.count} cards`);
  
  ultimateDb.close();
  
  console.log('✅ Database connections successful!');
  
} catch (error) {
  console.error('❌ Database connection failed:', error);
}
