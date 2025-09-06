import fs from 'fs'
import { DeepSeekCardEvaluator, type CardData } from './deepseek-evaluator.js'

async function runBatchEvaluation() {
  console.log('🚀 PokeDAO Batch Evaluation Starting...')
  
  console.log('📊 Loading complete dataset...')
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
  
  console.log(`📋 Found ${investmentCandidates.length} investment candidates`)
  
  // Test with just 5 cards first
  const testCards = investmentCandidates.slice(0, 5)
  console.log(`🎯 Testing with ${testCards.length} cards first`)
  
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY environment variable not set')
    process.exit(1)
  }
  
  const evaluator = new DeepSeekCardEvaluator(apiKey)
  
  try {
    console.log('🧠 Starting DeepSeek evaluation...')
    const results = await evaluator.evaluateBatch(testCards, 2)
    
    console.log('💾 Saving results...')
    evaluator.saveResults(results, 'test-evaluation.json')
    
    console.log('📈 Generating report...')
    evaluator.generateReport(results)
    
    console.log('\n✅ Test evaluation completed!')
    console.log('📁 Check test-evaluation.json for detailed results')
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error)
  }
}

runBatchEvaluation().catch(console.error)
