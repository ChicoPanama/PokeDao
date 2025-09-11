/**
 * Enhanced external data integration test
 * Tests our 24,307 card dataset integration WI    console.log('==========================================')
    console.log('Next Steps:')
    console.log('1. ✅ Database schema ready (unified schema)')
    console.log('2. ✅ External data normalization working')
    console.log('3. Create real-time market analysis pipeline')
    console.log('4. Connect to Telegram bot for alerts')base integration
 * Now supports unified schema integration
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

interface CollectorCryptCard {
  id: string
  itemName: string
  grade?: string
  gradeNum?: number
  gradingCompany?: string
  nftAddress: string
  owner: {
    id: string
    name: string
    wallet: string
  }
  images: {
    front: string
    back: string
    frontM: string
    backM: string
    frontS: string
    backS: string
  }
  insuredValue?: string
  location?: string[]
  blockchain: string
  category: string
  createdAt: string
}

async function testExternalDataIntegration() {
  console.log('🚀 Testing PokeDAO External Data Integration')
  console.log('================================================')
  
  try {
    // Load the 24,307 card dataset (resolve relative to this file)
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const ccDataPath = path.resolve(currentDir, '../worker/unified-collector-crypt-dataset.json')
    console.log(`📂 Loading dataset from: ${ccDataPath}`)
    
    const ccData: CollectorCryptCard[] = JSON.parse(await fs.readFile(ccDataPath, 'utf8'))
    console.log(`✅ Loaded ${ccData.length} cards from Collector Crypt`)
    
    // Test normalization on first 5 cards
    console.log('\n🔄 Testing Normalization Pipeline:')
    console.log('===================================')
    
    for (let i = 0; i < Math.min(5, ccData.length); i++) {
      const card = ccData[i]
      const normalized = normalizeCollectorCryptCard(card)
      
      console.log(`\nCard ${i + 1}:`)
      console.log(`  Raw: ${card.itemName}`)
      console.log(`  Normalized Name: ${normalized.name}`)
      console.log(`  Set: ${normalized.set || 'Unknown'}`)
      console.log(`  Number: ${normalized.number || 'Unknown'}`)
      console.log(`  Grade: ${normalized.grade || 'Ungraded'}`)
      console.log(`  Condition: ${normalized.condition || 'Unknown'}`)
      console.log(`  NFT Address: ${card.nftAddress}`)
    }
    
    // Test market signals generation
    console.log('\n📈 Testing Market Signals Generation:')
    console.log('====================================')
    
    const signals = generateMarketSignals(ccData.slice(0, 10))
    signals.forEach((signal, index) => {
      console.log(`\nSignal ${index + 1}:`)
      console.log(`  Card: ${signal.cardName}`)
      console.log(`  Signal: ${signal.signal}`)
      console.log(`  Confidence: ${(signal.confidence * 100).toFixed(1)}%`)
      console.log(`  Insured Value: $${signal.insuredValue || 'N/A'}`)
      console.log(`  Reasoning: ${signal.reasoning}`)
    })
    
    // Test data quality metrics
    console.log('\n📊 Data Quality Analysis:')
    console.log('========================')
    
    const qualityMetrics = analyzeDataQuality(ccData)
    console.log(`Total Cards: ${qualityMetrics.totalCards}`)
    console.log(`Graded Cards: ${qualityMetrics.gradedCards} (${qualityMetrics.gradedPercentage.toFixed(1)}%)`)
    console.log(`High Grade (9.0+): ${qualityMetrics.highGradeCards} (${qualityMetrics.highGradePercentage.toFixed(1)}%)`)
    console.log(`Vintage Cards (1996-2002): ${qualityMetrics.vintageCards} (${qualityMetrics.vintagePercentage.toFixed(1)}%)`)
    console.log(`Cards with Insurance: ${qualityMetrics.insuredCards} (${qualityMetrics.insuredPercentage.toFixed(1)}%)`)
    console.log(`Average Insured Value: $${qualityMetrics.avgInsuredValue.toFixed(2)}`)
    
    // Test database integration if available
    console.log('\n🔗 Testing Database Integration:')
    console.log('===============================')
    
    try {
      console.log('🔌 Attempting database connection...')
      await testDatabaseIntegration(ccData.slice(0, 3))
    } catch (dbError) {
      console.log('⚠️  Database integration failed:', dbError instanceof Error ? dbError.message : String(dbError))
      console.log('💡 This is expected if database is not configured')
    }
    
    console.log('\n✅ External Data Integration Test Complete!')
    console.log('==========================================')
    console.log('Next Steps:')
    console.log('1. Set up database with proper schema')
    console.log('2. Create external data ingestion pipeline')
    console.log('3. Implement real-time market analysis')
    console.log('4. Connect to Telegram bot for alerts')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  }
}

async function testDatabaseIntegration(sampleCards: CollectorCryptCard[]) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`📝 Testing basic database connectivity with ${sampleCards.length} sample cards...`)
    
    for (const [index, ccCard] of sampleCards.entries()) {
      const normalized = normalizeCollectorCryptCard(ccCard)
      const marketSignal = generateMarketSignals([ccCard])[0]
      
      // Test basic card creation (create unique test cards)
      const uniqueId = `cc-test-${ccCard.id}-${Date.now()}`
      const card = await prisma.card.create({
        data: {
          name: normalized.name || 'Unknown Card',
          set: normalized.set || 'Unknown',
          number: `${normalized.number || 'Unknown'}-${uniqueId}`, // Make unique
          variant: normalized.variant,
          grade: normalized.grade,
          condition: normalized.condition
        }
      })
      
      console.log(`  ${index + 1}. ✅ ${card.name} (${card.set}) - ${marketSignal.signal}`)
    }
    
    console.log('📊 Basic database integration test completed successfully!')
    
    // Test querying the created cards
    const cardCount = await prisma.card.count()
    console.log(`📈 Total cards in database: ${cardCount}`)
    
  } catch (error) {
    console.error('❌ Database integration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

function generateCardKey(normalized: ReturnType<typeof normalizeCollectorCryptCard>): string {
  const parts = [
    normalized.set?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
    normalized.number?.toLowerCase() || 'unknown',
    normalized.variant?.toLowerCase().replace(/\s+/g, '-') || null,
    normalized.grade?.toLowerCase().replace(/\s+/g, '-') || null
  ].filter(Boolean)
  
  return parts.join('-')
}

function cleanCardName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeCollectorCryptCard(card: CollectorCryptCard) {
  const nameParser = parseItemName(card.itemName)
  
  return {
    externalId: card.id,
    source: 'collector-crypt',
    name: nameParser.name,
    set: nameParser.set,
    number: nameParser.number,
    variant: nameParser.variant,
    grade: card.grade,
    condition: inferConditionFromGrade(card.grade, card.gradeNum),
    rawData: card,
    normalizedAt: new Date().toISOString()
  }
}

export function parseItemName(itemName: string): {
  name: string
  set?: string
  number?: string
  variant?: string
} {
  // Remove grading info (CGC X.X, PSA X, BGS X, etc.)
  let cleanName = itemName.replace(/\b(CGC|PSA|BGS|SGC)\s*\d+(\.\d+)?\b/gi, '').trim()
  
  // Extract year if present (support anywhere)
  const yearMatch = cleanName.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    cleanName = cleanName.replace(yearMatch[0], '').trim()
  }
  
  // Extract card number (various formats: #123, #NA, No. 123, etc.)
  const numberMatch = cleanName.match(/(?:#|No\.?\s*)([A-Z0-9-]+)/i)
  const number = numberMatch?.[1]
  if (number) {
    cleanName = cleanName.replace(/(?:#|No\.?\s*)[A-Z0-9-]+/i, '').trim()
  }
  
  // Extract set/series information
  let set: string | undefined = undefined
  let variant: string | undefined = undefined
  
  // Look for common set patterns
  const setPatterns = [
    /Japanese\s+(.+?)(?:\s+Pok[eé]mon|$)/i,
    /\b(Base Set|Jungle|Fossil|Team Rocket|Gym|Neo|Legendary|Classic Collection)\b/i
  ]
  
  for (const pattern of setPatterns) {
    const match = cleanName.match(pattern)
    if (match) {
      set = match[1] || match[0]
      cleanName = cleanName.replace(pattern, '').trim()
      break
    }
  }
  
  // Basic variant detection
  const variantMatch = cleanName.match(/\b(Reverse Holo|Holo|Hologram|1st Edition|Shadowless)\b/i)
  if (variantMatch) {
    variant = variantMatch[1]
    cleanName = cleanName.replace(variantMatch[0], '').trim()
  }

  // What's left should be the card name
  let name = cleanName
    .replace(/\bPokemon\b/gi, '') // Remove "Pokemon" suffix
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  // Handle special cases
  if (name.includes("'s")) {
    // Extract trainer cards like "Misty's Tears"
    const trainerMatch = name.match(/([^']+)'s\s+(.+)/)
    if (trainerMatch) {
      name = `${trainerMatch[1]}'s ${trainerMatch[2]}`
    }
  }
  
  return { name, set, number, variant }
}

export function inferConditionFromGrade(grade?: string, gradeNum?: number): string | undefined {
  if (!grade && !gradeNum) return undefined
  
  if (gradeNum) {
    if (gradeNum >= 9.5) return 'Mint'
    if (gradeNum >= 8.5) return 'Near Mint'
    if (gradeNum >= 7.0) return 'Excellent'
    if (gradeNum >= 5.0) return 'Very Good'
    return 'Good'
  }
  
  const g = grade?.toLowerCase()
  if (g?.includes('pristine') || g?.includes('black label')) return 'Mint'
  if (g?.includes('gem') && g?.includes('mint')) return 'Mint'
  if (g?.includes('10')) return 'Mint'
  if (g?.includes('9') || g?.includes('mint')) return 'Near Mint'
  if (g?.includes('8') || g?.includes('near mint')) return 'Near Mint'
  
  return 'Unknown'
}

export function generateMarketSignals(cards: CollectorCryptCard[]) {
  return cards.map(card => {
    const normalized = normalizeCollectorCryptCard(card)
    const insuredValue = parseMoney(card.insuredValue)
    const hasHighGrade = !!(card.gradeNum && card.gradeNum >= 9.0)
    const year = extractYear(card.itemName)
    const isVintage = typeof year === 'number' && year >= 1996 && year <= 2002
    
    let signal = 'HOLD'
    let confidence = 0.5
    
    if (hasHighGrade && isVintage && insuredValue && insuredValue > 100) {
      signal = 'BUY'
      confidence = 0.8
    } else if (insuredValue && insuredValue > 200) {
      signal = 'WATCH'
      confidence = 0.7
    }
    
    return {
      id: card.id,
      cardName: normalized.name,
      set: normalized.set,
      grade: card.grade,
      insuredValue: insuredValue,
      signal: signal,
      confidence: confidence,
      reasoning: generateReasoning(hasHighGrade, isVintage, insuredValue),
      nftAddress: card.nftAddress,
      source: 'collector-crypt',
      lastAnalyzed: new Date().toISOString()
    }
  })
}

function generateReasoning(hasHighGrade: boolean, isVintage: boolean, insuredValue?: number): string {
  const factors: string[] = []
  
  if (hasHighGrade) factors.push('High grade (9.0+)')
  if (isVintage) factors.push('Vintage card (1996-2002)')
  if (insuredValue && insuredValue > 100) factors.push(`High insured value ($${insuredValue})`)
  
  if (factors.length === 0) return 'Standard market conditions'
  
  return `${factors.join(', ')} suggests strong investment potential`
}

export function analyzeDataQuality(cards: CollectorCryptCard[]) {
  const totalCards = cards.length
  const gradedCards = cards.filter(c => c.grade && c.gradeNum).length
  const highGradeCards = cards.filter(c => c.gradeNum && c.gradeNum >= 9.0).length
  const vintageCards = cards.filter(c => {
    const y = extractYear(c.itemName)
    return typeof y === 'number' && y >= 1996 && y <= 2002
  }).length
  const insuredCards = cards.filter(c => parseMoney(c.insuredValue)).length
  
  const insuredValues = cards
    .map(c => parseMoney(c.insuredValue))
    .filter((v): v is number => typeof v === 'number' && !isNaN(v))
  
  const avgInsuredValue = insuredValues.length > 0 
    ? (insuredValues.reduce((a, b) => a + b, 0) / insuredValues.length)
    : 0
  
  return {
    totalCards,
    gradedCards,
    gradedPercentage: totalCards ? (gradedCards / totalCards) * 100 : 0,
    highGradeCards,
    highGradePercentage: totalCards ? (highGradeCards / totalCards) * 100 : 0,
    vintageCards,
    vintagePercentage: totalCards ? (vintageCards / totalCards) * 100 : 0,
    insuredCards,
    insuredPercentage: totalCards ? (insuredCards / totalCards) * 100 : 0,
    avgInsuredValue
  }
}

export function parseMoney(value?: string): number | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/[^0-9.]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

export function extractYear(text: string): number | undefined {
  const m = text.match(/\b(19\d{2}|20\d{2})\b/)
  if (!m) return undefined
  const y = Number(m[1])
  return Number.isFinite(y) ? y : undefined
}

// Run only when executed directly (not when imported by tests)
if (typeof process !== 'undefined') {
  const isDirect = (() => {
    try {
      const thisFile = fileURLToPath(import.meta.url)
      const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
      return thisFile === invoked
    } catch {
      return false
    }
  })()
  if (isDirect) void testExternalDataIntegration()
}
