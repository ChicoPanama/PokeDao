/**
 * Fanatics Collect Data Consolidator
 * Combines all discovered Fanatics Collect Pokemon card data into a unified dataset
 */
import fs from 'node:fs/promises'
import path from 'node:path'

interface FanaticsCard {
  id: string
  title: string
  subtitle?: string
  slug: string
  currentBid: {
    amountInCents: number
    currency: string
  }
  startingPrice: {
    amountInCents: number
    currency: string
  }
  bidCount: number
  favoritedCount: number
  certifiedSeller: string
  lotString: string
  status: string
  listingType: string
  imageSets: Array<{
    medium: string
    small: string
    thumbnail: string
  }>
  marketplaceEyeAppeal?: string
  auction: {
    id: string
  }
}

interface ConsolidatedCard {
  source: 'fanatics-collect'
  externalId: string
  title: string
  slug: string
  currentPriceCents: number
  startingPriceCents: number
  currency: string
  bidCount: number
  favoritedCount: number
  seller: string
  lotString: string
  status: string
  listingType: string
  auctionId: string
  images: string[]
  capturedAt: string
  
  // Normalized fields
  normalized: {
    name: string
    set?: string
    number?: string
    variant?: string
    grade?: string
    condition?: string
    year?: number
    language?: string
    edition?: string
    foil?: boolean
  }
}

async function consolidateFanaticsData() {
  console.log('🔄 Consolidating Fanatics Collect Pokemon Data')
  console.log('==============================================')
  
  const dataDir = '/Users/arcadio/dev/pokedao/research/fanatics-collect-discovery'
  const files = await fs.readdir(dataDir)
  
  // Find all API files with Pokemon data
  const apiFiles = files.filter(f => 
    f.startsWith('fanaticscollect-api-') && 
    f.endsWith('.json')
  )
  
  console.log(`📁 Found ${apiFiles.length} API data files`)
  
  const allCards: ConsolidatedCard[] = []
  const seenIds = new Set<string>()
  
  for (const file of apiFiles) {
    try {
      console.log(`📖 Processing ${file}...`)
      
      const filePath = path.join(dataDir, file)
      const content = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(content)
      
      if (data.data?.collectListings) {
        const listings: FanaticsCard[] = data.data.collectListings
        console.log(`   Found ${listings.length} listings`)
        
        for (const listing of listings) {
          // Skip duplicates
          if (seenIds.has(listing.id)) continue
          seenIds.add(listing.id)
          
          // Normalize the card data
          const normalized = normalizeCardTitle(listing.title)
          
          const consolidatedCard: ConsolidatedCard = {
            source: 'fanatics-collect',
            externalId: listing.id,
            title: listing.title,
            slug: listing.slug,
            currentPriceCents: listing.currentBid.amountInCents,
            startingPriceCents: listing.startingPrice.amountInCents,
            currency: listing.currentBid.currency,
            bidCount: listing.bidCount,
            favoritedCount: listing.favoritedCount,
            seller: listing.certifiedSeller,
            lotString: listing.lotString,
            status: listing.status,
            listingType: listing.listingType,
            auctionId: listing.auction.id,
            images: listing.imageSets.map(img => img.medium),
            capturedAt: new Date().toISOString(),
            normalized
          }
          
          allCards.push(consolidatedCard)
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error processing ${file}:`, error instanceof Error ? error.message : error)
    }
  }
  
  console.log(`\n📊 Consolidation Results:`)
  console.log(`   Total unique cards: ${allCards.length}`)
  console.log(`   Total bid volume: $${(allCards.reduce((sum, c) => sum + c.currentPriceCents, 0) / 100).toLocaleString()}`)
  console.log(`   Average current bid: $${(allCards.reduce((sum, c) => sum + c.currentPriceCents, 0) / allCards.length / 100).toFixed(2)}`)
  console.log(`   Cards with bids: ${allCards.filter(c => c.bidCount > 0).length}`)
  
  // Show sample of high-value cards
  const highValueCards = allCards
    .filter(c => c.currentPriceCents > 50000) // Over $500
    .sort((a, b) => b.currentPriceCents - a.currentPriceCents)
    .slice(0, 5)
  
  console.log(`\n💰 Top High-Value Cards:`)
  for (const card of highValueCards) {
    console.log(`   $${(card.currentPriceCents / 100).toLocaleString()} - ${card.title}`)
    console.log(`      Bids: ${card.bidCount}, Favorites: ${card.favoritedCount}`)
    console.log(`      Normalized: ${card.normalized.name} | ${card.normalized.set || 'Unknown Set'} | ${card.normalized.grade || 'Ungraded'}`)
  }
  
  // Save consolidated dataset
  const outputPath = path.join(dataDir, 'fanatics-collect-consolidated-dataset.json')
  await fs.writeFile(outputPath, JSON.stringify(allCards, null, 2))
  
  console.log(`\n✅ Saved consolidated dataset to: fanatics-collect-consolidated-dataset.json`)
  console.log(`📦 Ready for integration with PokeDAO external data pipeline!`)
  
  return allCards
}

function normalizeCardTitle(title: string) {
  // Extract year
  const yearMatch = title.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : undefined
  
  // Extract language
  let language: string | undefined = 'English'
  if (title.toLowerCase().includes('japanese')) language = 'Japanese'
  else if (title.toLowerCase().includes('korean')) language = 'Korean'
  else if (title.toLowerCase().includes('italian')) language = 'Italian'
  else if (title.toLowerCase().includes('german')) language = 'German'
  else if (title.toLowerCase().includes('french')) language = 'French'
  
  // Extract edition
  let edition: string | undefined = undefined
  if (title.toLowerCase().includes('1st edition')) edition = '1st Edition'
  else if (title.toLowerCase().includes('unlimited')) edition = 'Unlimited'
  
  // Extract foil/holo
  const foil = title.toLowerCase().includes('holo') || 
               title.toLowerCase().includes('foil') ||
               title.toLowerCase().includes('full art')
  
  // Extract card number
  const numberMatch = title.match(/#(\d+[A-Z]?)/i)
  const number = numberMatch ? numberMatch[1] : undefined
  
  // Extract grade
  let grade: string | undefined = undefined
  const gradeMatch = title.match(/(?:PSA|CGC|BGS)\s*(\d+(?:\.\d+)?)\s*(?:GEM\s*MINT|MINT|NR?MT?|EX|VG|GOOD)?/i)
  if (gradeMatch) {
    const gradeNum = gradeMatch[1]
    const gradeText = title.match(/(?:PSA|CGC|BGS)\s*\d+(?:\.\d+)?\s*(GEM\s*MINT|MINT|NR?MT?|EX|VG|GOOD)?/i)
    grade = gradeText ? `${gradeMatch[0]}` : `${gradeMatch[1]}`
  }
  
  // Extract condition
  let condition: string | undefined = undefined
  if (grade) {
    if (grade.includes('GEM MINT') || grade.includes('10')) condition = 'Gem Mint'
    else if (grade.includes('MINT') || grade.includes('9')) condition = 'Mint'
    else if (grade.includes('NRMT') || grade.includes('NM') || grade.includes('8')) condition = 'Near Mint'
    else if (grade.includes('EX') || grade.includes('7')) condition = 'Excellent'
    else if (grade.includes('VG') || grade.includes('6')) condition = 'Very Good'
  }
  
  // Extract set
  let set: string | undefined = undefined
  const setPatterns = [
    /Base Set/i,
    /XY Steam Siege/i,
    /Jungle/i,
    /Fossil/i,
    /Team Rocket/i,
    /Neo Genesis/i,
    /Neo Discovery/i,
    /Neo Revelation/i,
    /Neo Destiny/i,
    /Gym Heroes/i,
    /Gym Challenge/i,
    /Black & White/i,
    /Diamond & Pearl/i,
    /Sun & Moon/i,
    /Sword & Shield/i,
    /Scarlet & Violet/i
  ]
  
  for (const pattern of setPatterns) {
    const match = title.match(pattern)
    if (match) {
      set = match[0]
      break
    }
  }
  
  // Extract card name (everything before the grade/number)
  let name = title
    .replace(/\d{4}/, '') // Remove year
    .replace(/Pokemon/i, '') // Remove Pokemon
    .replace(new RegExp(language, 'i'), '') // Remove language
    .replace(/(?:1st Edition|Unlimited)/i, '') // Remove edition
    .replace(/#\d+[A-Z]?/i, '') // Remove number
    .replace(/(?:PSA|CGC|BGS)\s*\d+(?:\.\d+)?\s*(?:GEM\s*MINT|MINT|NR?MT?|EX|VG|GOOD)?/i, '') // Remove grade
    .replace(new RegExp(set || '', 'i'), '') // Remove set
    .trim()
  
  // Clean up name
  name = name
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-]+|[\s\-]+$/g, '')
    .trim()
  
  return {
    name: name || 'Unknown Card',
    set,
    number,
    grade,
    condition,
    year,
    language,
    edition,
    foil
  }
}

// Run the consolidation
consolidateFanaticsData().catch(console.error)
