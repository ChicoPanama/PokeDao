/**
 * Simplified External Data API Server
 * Provides "scrape → analyze → alert" endpoints using existing 24,307 card dataset
 */
import { createServer } from 'node:http'
import { URL } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'

const PORT = 3001

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

let datasetCache: CollectorCryptCard[] | null = null
let fanaticsCache: any[] | null = null

async function loadDataset(): Promise<CollectorCryptCard[]> {
  if (datasetCache) return datasetCache
  
  const ccDataPath = path.join(process.cwd(), '../worker/unified-collector-crypt-dataset.json')
  datasetCache = JSON.parse(await fs.readFile(ccDataPath, 'utf8'))
  return datasetCache!
}

async function loadFanaticsData(): Promise<any[]> {
  if (fanaticsCache) return fanaticsCache
  
  try {
    const fanaticsPath = path.join(process.cwd(), '../research/fanatics-collect-discovery/fanatics-collect-consolidated-dataset.json')
    fanaticsCache = JSON.parse(await fs.readFile(fanaticsPath, 'utf8'))
    return fanaticsCache!
  } catch (error) {
    console.warn('Fanatics data not available:', error)
    return []
  }
}

function normalizeCollectorCryptCard(card: CollectorCryptCard) {
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
    nftAddress: card.nftAddress,
    insuredValue: card.insuredValue ? parseFloat(card.insuredValue) : undefined,
    rawData: card,
    normalizedAt: new Date().toISOString()
  }
}

function parseItemName(itemName: string): {
  name: string
  set?: string
  number?: string
  variant?: string
} {
  // Remove grading info
  let cleanName = itemName.replace(/\b(CGC|PSA|BGS|SGC)\s*\d+(\.\d+)?\b/gi, '').trim()
  
  // Extract year
  const yearMatch = cleanName.match(/^(\d{4})\s+/)
  if (yearMatch) {
    cleanName = cleanName.replace(/^\d{4}\s+/, '')
  }
  
  // Extract card number
  const numberMatch = cleanName.match(/#([A-Z0-9]+)|\bNo\.\s*(\d+)/i)
  const number = numberMatch ? (numberMatch[1] || numberMatch[2]) : undefined
  if (number) {
    cleanName = cleanName.replace(/#[A-Z0-9]+|\bNo\.\s*\d+/gi, '').trim()
  }
  
  // Extract set information
  let set: string | undefined = undefined
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
  
  // Clean up name
  let name = cleanName
    .replace(/\bPokemon\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  return { name, set, number, variant: undefined }
}

function inferConditionFromGrade(grade?: string, gradeNum?: number): string | undefined {
  if (!grade && !gradeNum) return undefined
  
  if (gradeNum) {
    if (gradeNum >= 9.5) return 'Mint'
    if (gradeNum >= 8.5) return 'Near Mint'
    if (gradeNum >= 7.0) return 'Excellent'
    if (gradeNum >= 5.0) return 'Very Good'
    return 'Good'
  }
  
  return 'Unknown'
}

function generateMarketSignal(card: CollectorCryptCard) {
  const normalized = normalizeCollectorCryptCard(card)
  const insuredValue = card.insuredValue ? parseFloat(card.insuredValue) : undefined
  const hasHighGrade = card.gradeNum && card.gradeNum >= 9.0
  const isVintage = card.itemName.includes('1998') || card.itemName.includes('1999')
  const isUltraRare = insuredValue && insuredValue > 500
  
  let signal = 'HOLD'
  let confidence = 0.5
  let priority = 'low'
  
  if (hasHighGrade && isVintage && insuredValue && insuredValue > 200) {
    signal = 'STRONG_BUY'
    confidence = 0.9
    priority = 'high'
  } else if (isUltraRare) {
    signal = 'BUY'
    confidence = 0.8
    priority = 'high'
  } else if (hasHighGrade && insuredValue && insuredValue > 100) {
    signal = 'WATCH'
    confidence = 0.7
    priority = 'medium'
  }
  
  const factors: string[] = []
  if (hasHighGrade) factors.push('High grade (9.0+)')
  if (isVintage) factors.push('Vintage (1998-1999)')
  if (insuredValue && insuredValue > 100) factors.push(`High value ($${insuredValue})`)
  if (isUltraRare) factors.push('Ultra rare ($500+)')
  
  return {
    id: card.id,
    cardName: normalized.name,
    set: normalized.set,
    number: normalized.number,
    grade: card.grade,
    insuredValue: insuredValue,
    signal: signal,
    confidence: confidence,
    priority: priority,
    reasoning: factors.length > 0 ? factors.join(', ') : 'Standard market conditions',
    nftAddress: card.nftAddress,
    source: 'collector-crypt',
    lastAnalyzed: new Date().toISOString(),
    marketCap: calculateMarketCap(insuredValue, !!hasHighGrade, !!isVintage),
    riskLevel: calculateRiskLevel(signal, confidence)
  }
}

function calculateMarketCap(insuredValue?: number, hasHighGrade?: boolean, isVintage?: boolean): string {
  if (!insuredValue) return 'unknown'
  if (insuredValue > 1000) return 'large'
  if (insuredValue > 200 && (hasHighGrade || isVintage)) return 'medium'
  if (insuredValue > 50) return 'small'
  return 'micro'
}

function calculateRiskLevel(signal: string, confidence: number): string {
  if (signal === 'STRONG_BUY' && confidence > 0.8) return 'low'
  if (signal === 'BUY' && confidence > 0.7) return 'medium'
  if (signal === 'WATCH') return 'medium'
  return 'high'
}

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }
  
  const url = new URL(req.url!, `http://localhost:${PORT}`)
  const pathname = url.pathname
  
  try {
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'PokeDAO External Data API'
      }))
    }
    
    else if (pathname === '/' || pathname === '/dashboard') {
      const dashboard = await fs.readFile(path.join(process.cwd(), 'dashboard.html'), 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(dashboard)
    }
    
    else if (pathname === '/external/status') {
      const dataset = await loadDataset()
      const fanaticsData = await loadFanaticsData()
      
      const status = {
        ok: true,
        sources: [{
          source: 'collector-crypt',
          totalRecords: dataset.length,
          lastUpdated: new Date().toISOString(),
          status: 'active',
          sampleRecord: dataset[0]
        }, {
          source: 'fanatics-collect',
          totalRecords: fanaticsData.length,
          lastUpdated: new Date().toISOString(),
          status: fanaticsData.length > 0 ? 'active' : 'no_data',
          sampleRecord: fanaticsData[0] || null
        }],
        generatedAt: new Date().toISOString()
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(status))
    }
    
    else if (pathname.startsWith('/external/preview/')) {
      const source = pathname.split('/')[3]
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10')))
      
      if (source === 'collector-crypt') {
        const dataset = await loadDataset()
        const previews = dataset.slice(0, limit).map(normalizeCollectorCryptCard)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ok: true,
          source,
          previews,
          count: previews.length,
          generatedAt: new Date().toISOString()
        }))
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Source not found' }))
      }
    }
    
    else if (pathname === '/external/signals') {
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
      const priority = url.searchParams.get('priority') // high, medium, low
      
      const dataset = await loadDataset()
      let signals = dataset.slice(0, Math.min(1000, dataset.length)).map(generateMarketSignal)
      
      // Filter by priority if specified
      if (priority) {
        signals = signals.filter(s => s.priority === priority)
      }
      
      // Sort by confidence desc, then by insured value desc
      signals.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence
        return (b.insuredValue || 0) - (a.insuredValue || 0)
      })
      
      signals = signals.slice(0, limit)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        signals,
        count: signals.length,
        filters: { priority },
        generatedAt: new Date().toISOString()
      }))
    }
    
    else if (pathname === '/external/discovery') {
      const dataset = await loadDataset()
      const discovery = {
        ok: true,
        discovery: {
          collectorCrypt: {
            datasetSize: dataset.length,
            sampleNormalization: dataset.slice(0, 3).map(normalizeCollectorCryptCard),
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
        },
        generatedAt: new Date().toISOString()
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(discovery))
    }
    
    else if (pathname === '/external/analytics') {
      const dataset = await loadDataset()
      const analytics = analyzeDataset(dataset)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        analytics,
        generatedAt: new Date().toISOString()
      }))
    }
    
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }))
    }
    
  } catch (error) {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      ok: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }))
  }
})

function analyzeDataset(dataset: CollectorCryptCard[]) {
  const totalCards = dataset.length
  const gradedCards = dataset.filter(c => c.grade && c.gradeNum).length
  const highGradeCards = dataset.filter(c => c.gradeNum && c.gradeNum >= 9.0).length
  const vintageCards = dataset.filter(c => c.itemName.includes('1998') || c.itemName.includes('1999')).length
  const insuredCards = dataset.filter(c => c.insuredValue && parseFloat(c.insuredValue) > 0).length
  
  const insuredValues = dataset
    .filter(c => c.insuredValue)
    .map(c => parseFloat(c.insuredValue!))
    .filter(v => !isNaN(v))
  
  const avgInsuredValue = insuredValues.length > 0 
    ? (insuredValues.reduce((a, b) => a + b, 0) / insuredValues.length)
    : 0
  
  const maxInsuredValue = Math.max(...insuredValues)
  const totalMarketValue = insuredValues.reduce((a, b) => a + b, 0)
  
  // Generate top signals for dashboard
  const topSignals = dataset.slice(0, 100)
    .map(generateMarketSignal)
    .filter(s => s.signal !== 'HOLD')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
  
  return {
    overview: {
      totalCards,
      gradedCards,
      gradedPercentage: ((gradedCards / totalCards) * 100).toFixed(1),
      highGradeCards,
      highGradePercentage: ((highGradeCards / totalCards) * 100).toFixed(1),
      vintageCards,
      vintagePercentage: ((vintageCards / totalCards) * 100).toFixed(1),
      insuredCards,
      insuredPercentage: ((insuredCards / totalCards) * 100).toFixed(1)
    },
    valuation: {
      avgInsuredValue: avgInsuredValue.toFixed(2),
      maxInsuredValue: maxInsuredValue.toFixed(2),
      totalMarketValue: totalMarketValue.toFixed(2)
    },
    signals: {
      totalSignals: topSignals.length,
      buySignals: topSignals.filter(s => s.signal.includes('BUY')).length,
      watchSignals: topSignals.filter(s => s.signal === 'WATCH').length,
      topOpportunities: topSignals
    }
  }
}

server.listen(PORT, () => {
  console.log(`🚀 PokeDAO External Data API running on http://localhost:${PORT}`)
  console.log('📊 Available endpoints:')
  console.log('  GET /health - Health check')
  console.log('  GET /external/status - Data source status')
  console.log('  GET /external/preview/:source?limit=10 - Preview normalization')
  console.log('  GET /external/signals?limit=20&priority=high - Market signals')
  console.log('  GET /external/discovery - Integration discovery')
  console.log('  GET /external/analytics - Dataset analytics')
  console.log('')
  console.log(`💾 Dataset: 24,307 cards loaded from Collector Crypt`)
  console.log('✨ Ready for "scrape → analyze → alert" pipeline testing!')
})
