import fs from 'fs'
import { DeepSeekCardEvaluator, CardData } from './deepseek-evaluator.js'
import { logger } from './logger.js'

async function runBatchEvaluation() {
  logger.info('🚀 PokeDAO Batch Evaluation Starting...')
  
  logger.info('📊 Loading complete dataset...')
  const rawData = fs.readFileSync('complete-dataset.json', 'utf8')
  const allCards = JSON.parse(rawData)
  
  const investmentCandidates = allCards.filter((card: any) => {
    const listing = card.listing || {}
    const price = listing.price || 0
    const currency = listing.currency || "USDC"
    const priceUSD = currency === "SOL" ? price * 140 : price
    
    return (
      card.category === "Pokemon" &&
      priceUSD >= 15 &&
      priceUSD <= 50000 &&
      card.itemName &&
      !card.itemName.toLowerCase().includes("energy removal")
    )
  })
  
  logger.info(`📋 Found ${investmentCandidates.length} investment candidates`)
  
  // Test with just 5 cards first
  const testCards: CardData[] = investmentCandidates.slice(0, 5)
  logger.info(`🎯 Testing with ${testCards.length} cards first`)
  
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    logger.error('❌ DEEPSEEK_API_KEY environment variable not set')
    process.exit(1)
  }
  
  const evaluator = new DeepSeekCardEvaluator(apiKey)
  
  try {
    logger.info('🧠 Starting DeepSeek evaluation...')
    const results = await evaluator.evaluateBatch(testCards, 2)
    
    logger.info('💾 Saving results...')
    evaluator.saveResults(results, 'test-evaluation.json')
    
    logger.info('📈 Generating report...')
    evaluator.generateReport(results)
    
    logger.info('\n✅ Test evaluation completed!')
    logger.info('📁 Check test-evaluation.json for detailed results')
    
  } catch (error) {
    logger.error('❌ Evaluation failed:', error)
  }
}

runBatchEvaluation().catch(logger.error)
