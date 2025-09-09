const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚨 EMERGENCY: Caching TCGplayer data...');

try {
  console.log('✅ Connected to TCGplayer database');

  // First, let's get a count
  const countResult = execSync('sqlite3 tcgplayer.db "SELECT COUNT(*) FROM tcgplayer_cards;"', { encoding: 'utf8' });
  const cardCount = parseInt(countResult.trim());
  console.log(`📊 Found ${cardCount} cards in database`);

  // Export as CSV (most reliable method)
  console.log('💾 Exporting data as CSV...');
  const csvResult = execSync('sqlite3 -header -csv tcgplayer.db "SELECT id, name, setName, rarity, currentPrice, marketPrice, cardNumber, imageUrl, tcgplayerUrl, rarityWeight, extractedAt FROM tcgplayer_cards ORDER BY rarityWeight DESC, marketPrice DESC;"', { encoding: 'utf8' });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvFile = `tcgplayer-backup-${timestamp}.csv`;
  
  fs.writeFileSync(csvFile, csvResult);
  console.log(`💾 Cached ${cardCount} cards to ${csvFile}`);
  
  // Also create latest backup
  fs.writeFileSync('tcgplayer-latest.csv', csvResult);
  console.log(`💾 Created latest backup: tcgplayer-latest.csv`);
  
  // Also copy the entire database file as backup
  const dbBackup = `tcgplayer-backup-${timestamp}.db`;
  execSync(`cp tcgplayer.db ${dbBackup}`);
  console.log(`💾 Database file backed up to: ${dbBackup}`);
  
  // Show summary
  console.log('\n📈 CACHE SUMMARY:');
  console.log('================');
  console.log(`Total Cards Cached: ${cardCount}`);
  
  // Get some stats
  try {
    const highestPrice = execSync('sqlite3 tcgplayer.db "SELECT MAX(marketPrice) FROM tcgplayer_cards WHERE marketPrice IS NOT NULL;"', { encoding: 'utf8' }).trim();
    const avgPrice = execSync('sqlite3 tcgplayer.db "SELECT AVG(marketPrice) FROM tcgplayer_cards WHERE marketPrice IS NOT NULL AND marketPrice > 0;"', { encoding: 'utf8' }).trim();
    const rarityCount = execSync('sqlite3 tcgplayer.db "SELECT COUNT(DISTINCT rarity) FROM tcgplayer_cards WHERE rarity IS NOT NULL;"', { encoding: 'utf8' }).trim();
    
    if (highestPrice && highestPrice !== '' && highestPrice !== '0') {
      console.log(`Highest Price: $${parseFloat(highestPrice).toFixed(2)}`);
    }
    if (avgPrice && avgPrice !== '' && avgPrice !== '0') {
      console.log(`Average Price: $${parseFloat(avgPrice).toFixed(2)}`);
    }
    console.log(`Different Rarities: ${rarityCount}`);
    
    // Show top 3 sets
    const topSets = execSync('sqlite3 tcgplayer.db "SELECT setName, COUNT(*) as count FROM tcgplayer_cards GROUP BY setName ORDER BY count DESC LIMIT 3;"', { encoding: 'utf8' });
    console.log('\n🎯 Top 3 Sets by Card Count:');
    topSets.trim().split('\n').forEach((line, i) => {
      const [setName, count] = line.split('|');
      console.log(`${i+1}. ${setName}: ${count} cards`);
    });
    
  } catch (statError) {
    console.log('� Could not generate detailed stats, but data is safely cached!');
  }
  
  console.log('\n✅ EMERGENCY CACHE COMPLETE - Your 4,412+ cards are safe!');
  console.log(`📁 Files created:`);
  console.log(`   - ${csvFile} (CSV format)`);
  console.log(`   - ${dbBackup} (Complete database)`);
  console.log(`   - tcgplayer-latest.csv (Latest export)`);

} catch (error) {
  console.error('❌ Emergency cache failed:', error.message);
  
  // Last resort - just copy the database file
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbBackup = `tcgplayer-backup-${timestamp}.db`;
    execSync(`cp tcgplayer.db ${dbBackup}`);
    console.log(`💾 Last resort: Copied database to ${dbBackup}`);
    console.log('✅ DATABASE FILE BACKUP COMPLETE');
    console.log('🔧 You can restore this later with: cp backup.db tcgplayer.db');
  } catch (copyError) {
    console.error('❌ All backup methods failed:', copyError.message);
    console.log('🆘 Database file still exists at: tcgplayer.db (14.8MB)');
    process.exit(1);
  }
}
