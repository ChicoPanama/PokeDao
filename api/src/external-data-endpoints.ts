/**
 * External Data Integration Endpoints
 * Implements the "scrape → analyze → alert" pipeline using existing 24,307 card dataset
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const prisma = new PrismaClient()

// Types for external data sources
export interface CollectorCryptCard {
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

export interface ExternalDataStatus {
  source: string
  totalRecords: number
  lastUpdated: string
  status: 'active' | 'stale' | 'error'
  sampleRecord?: any
}

export interface NormalizedCard {
  externalId: string
  source: string
  name: string
  set?: string
  number?: string
  variant?: string
  grade?: string
  condition?: string
  rawData: any
  normalizedAt: string
}

/**
 * Get status of all external data sources
 */
export async function getExternalDataStatus(): Promise<ExternalDataStatus[]> {
  const sources: ExternalDataStatus[] = []
  
  try {
    // Check Collector Crypt dataset
    const ccDataPath = path.join(process.cwd(), '../worker/unified-collector-crypt-dataset.json')
    const ccData = JSON.parse(await fs.readFile(ccDataPath, 'utf8'))
    
    sources.push({
      source: 'collector-crypt',
      totalRecords: ccData.length,
      lastUpdated: new Date().toISOString(), // We'd track this properly in production
      status: 'active',
      sampleRecord: ccData[0]
    })
  } catch (error) {
    sources.push({
      source: 'collector-crypt',
      totalRecords: 0,
      lastUpdated: new Date().toISOString(),
      status: 'error'
    })
  }
  
  // TODO: Add other sources (TCGPlayer, Pokemon TCG API, etc.)
  
  return sources
}

/**
 * Preview normalization of external data without saving
 */
export async function previewNormalization(source: string, limit: number = 10): Promise<NormalizedCard[]> {
  const normalized: NormalizedCard[] = []
  
  if (source === 'collector-crypt') {
    try {
      const ccDataPath = path.join(process.cwd(), '../worker/unified-collector-crypt-dataset.json')
      const ccData: CollectorCryptCard[] = JSON.parse(await fs.readFile(ccDataPath, 'utf8'))
      
      for (const card of ccData.slice(0, limit)) {
        const normalized_card = normalizeCollectorCryptCard(card)
        normalized.push(normalized_card)
      }
    } catch (error) {
      console.error('Error previewing Collector Crypt normalization:', error)
    }
  }
  
  return normalized
}

/**
 * Normalize a Collector Crypt card to our standard format
 */
function normalizeCollectorCryptCard(card: CollectorCryptCard): NormalizedCard {
  // Parse the itemName to extract card details
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

/**
 * Parse item name to extract card details
 * Examples:
 * "1998 #NA Misty's Tears CGC 7.5 Japanese Hanada City Gym Deck Pokemon"
 * "2023 Pokemon Classic Collection Charizard #6 PSA 10"
 */
function parseItemName(itemName: string): {
  name: string
  set?: string
  number?: string
  variant?: string
} {
  // Remove grading info (CGC X.X, PSA X, BGS X, etc.)
  let cleanName = itemName.replace(/\b(CGC|PSA|BGS|SGC)\s*\d+(\.\d+)?\b/gi, '').trim()
  
  // Extract year if present
  const yearMatch = cleanName.match(/^(\d{4})\s+/)
  const year = yearMatch ? yearMatch[1] : undefined
  if (year) {
    cleanName = cleanName.replace(/^\d{4}\s+/, '')
  }
  
  // Extract card number (various formats: #123, #NA, No. 123, etc.)
  const numberMatch = cleanName.match(/#([A-Z0-9]+)|\bNo\.\s*(\d+)/i)
  const number = numberMatch ? (numberMatch[1] || numberMatch[2]) : undefined
  if (number) {
    cleanName = cleanName.replace(/#[A-Z0-9]+|\bNo\.\s*\d+/gi, '').trim()
  }
  
  // Extract set/series information (this would need refinement based on patterns)
  let set = undefined
  let variant = undefined
  
  // Look for common set patterns
  const setPatterns = [
    /Japanese\s+([^"]+?)(?:\s+Pokemon|$)/i,
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

/**
 * Infer condition from grade information
 */
function inferConditionFromGrade(grade?: string, gradeNum?: number): string | undefined {
  if (!grade && !gradeNum) return undefined
  
  if (gradeNum) {
    if (gradeNum >= 9.5) return 'Mint'
    if (gradeNum >= 8.5) return 'Near Mint'
    if (gradeNum >= 7.0) return 'Excellent'
    if (gradeNum >= 5.0) return 'Very Good'
    return 'Good'
  }
  
  if (grade?.includes('10') || grade?.toLowerCase().includes('gem mint')) return 'Mint'
  if (grade?.includes('9') || grade?.toLowerCase().includes('mint')) return 'Near Mint'
  if (grade?.includes('8') || grade?.toLowerCase().includes('near mint')) return 'Near Mint'
  
  return 'Unknown'
}

/**
 * Get market analysis signals using DeepSeek AI integration points
 */
export async function getMarketSignals(limit: number = 20): Promise<any[]> {
  // This would integrate with the existing fair value computation
  // For now, return a structure that shows integration points
  
  const signals = []
  
  try {
    const ccDataPath = path.join(process.cwd(), '../worker/unified-collector-crypt-dataset.json')
    const ccData: CollectorCryptCard[] = JSON.parse(await fs.readFile(ccDataPath, 'utf8'))
    
    for (const card of ccData.slice(0, limit)) {
      const normalized = normalizeCollectorCryptCard(card)
      
      // Calculate basic signals
      const insuredValue = card.insuredValue ? parseFloat(card.insuredValue) : undefined
      const hasHighGrade = Boolean(card.gradeNum && card.gradeNum >= 9.0)
      const isVintage = card.itemName.includes('1998') || card.itemName.includes('1999')
      
      let signal = 'HOLD'
      let confidence = 0.5
      
      if (hasHighGrade && isVintage && insuredValue && insuredValue > 100) {
        signal = 'BUY'
        confidence = 0.8
      } else if (insuredValue && insuredValue > 200) {
        signal = 'WATCH'
        confidence = 0.7
      }
      
      signals.push({
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
      })
    }
  } catch (error) {
    console.error('Error generating market signals:', error)
  }
  
  return signals
}

function generateReasoning(hasHighGrade: boolean, isVintage: boolean, insuredValue?: number): string {
  const factors = []
  
  if (hasHighGrade) factors.push('High grade (9.0+)')
  if (isVintage) factors.push('Vintage card (1998-1999)')
  if (insuredValue && insuredValue > 100) factors.push(`High insured value ($${insuredValue})`)
  
  if (factors.length === 0) return 'Standard market conditions'
  
  return `${factors.join(', ')} suggests strong investment potential`
}

/**
 * Get external data discovery endpoints for testing integrations
 */
export async function getDiscoveryEndpoints(): Promise<any> {
  return {
    collectorCrypt: {
      datasetSize: await getDatasetSize(),
      sampleNormalization: await previewNormalization('collector-crypt', 3),
      lastUpdated: new Date().toISOString()
    },
    tcgPlayer: {
      status: 'planned',
      discoveryScript: '../research/tcgplayer-discovery/static-discovery.ts'
    },
    pokemonTcgApi: {
      status: 'planned',
      endpoint: 'https://api.pokemontcg.io/v2'
    },
    fanaticsCollect: {
      status: 'planned',
      endpoint: 'https://api.fanaticscollect.com/graphql'
    }
  }
}

async function getDatasetSize(): Promise<number> {
  try {
    const ccDataPath = path.join(process.cwd(), '../worker/unified-collector-crypt-dataset.json')
    const ccData = JSON.parse(await fs.readFile(ccDataPath, 'utf8'))
    return ccData.length
  } catch {
    return 0
  }
}
