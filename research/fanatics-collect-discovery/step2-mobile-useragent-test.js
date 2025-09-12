#!/usr/bin/env node
/**
 * 🔍 STEP 2: MOBILE USER-AGENT TESTING
 * ===================================
 * 
 * Test if Fanatics Collect responds differently to mobile user-agents
 * Simple approach - no complex browser automation
 */

const https = require('https');
const fs = require('fs');

class MobileUserAgentTester {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.testResults = [];
        
        // Different mobile user-agents to test
        this.userAgents = [
            {
                name: 'iPhone Safari',
                agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
            },
            {
                name: 'Android Chrome',
                agent: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36'
            },
            {
                name: 'Fanatics iOS App',
                agent: 'FanaticsCollect/3.2.1 (iPhone; iOS 16.0; Scale/3.00)'
            },
            {
                name: 'Fanatics Android App',
                agent: 'FanaticsCollect/3.2.1 (Android 12; Samsung SM-G991B)'
            },
            {
                name: 'Desktop (Control)',
                agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        ];
        
        // URLs to test
        this.testUrls = [
            '/',
            '/search?q=pokemon',
            '/auctions',
            '/cards',
            '/categories/trading-cards'
        ];
    }

    async testMobileUserAgents() {
        console.log('🔍 STEP 2: MOBILE USER-AGENT TESTING');
        console.log('===================================');
        console.log(`Testing ${this.userAgents.length} user-agents on ${this.testUrls.length} URLs...\n`);

        let testCount = 0;
        const totalTests = this.userAgents.length * this.testUrls.length;

        for (const userAgent of this.userAgents) {
            console.log(`📱 Testing: ${userAgent.name}`);
            
            for (const url of this.testUrls) {
                testCount++;
                console.log(`  [${testCount}/${totalTests}] ${url}`);
                
                try {
                    const result = await this.makeRequest(url, userAgent);
                    this.testResults.push(result);
                    
                    if (result.statusCode === 200) {
                        console.log(`  ✅ ${result.statusCode} - ${result.contentLength} bytes`);
                        
                        // Check if response contains Pokemon content
                        if (this.containsPokemonContent(result.content)) {
                            console.log(`  🎯 Pokemon content detected!`);
                        }
                    } else {
                        console.log(`  ❌ ${result.statusCode}`);
                    }
                    
                } catch (error) {
                    console.log(`  ❌ Error: ${error.message}`);
                    this.testResults.push({
                        userAgent: userAgent.name,
                        url: url,
                        error: error.message,
                        statusCode: null
                    });
                }
                
                // Rate limiting
                await this.delay(1000);
            }
            
            console.log(''); // Empty line between user-agents
        }

        return this.generateReport();
    }

    makeRequest(path, userAgent) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: path,
                method: 'GET',
                headers: {
                    'User-Agent': userAgent.agent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        userAgent: userAgent.name,
                        userAgentString: userAgent.agent,
                        url: path,
                        statusCode: res.statusCode,
                        headers: res.headers,
                        contentLength: data.length,
                        content: data.substring(0, 2000), // First 2KB for analysis
                        timestamp: new Date().toISOString()
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    containsPokemonContent(content) {
        if (!content) return false;
        
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'trading cards',
            'psa graded', 'base set', 'shadowless'
        ];
        
        const lowerContent = content.toLowerCase();
        return pokemonIndicators.some(indicator => lowerContent.includes(indicator));
    }

    generateReport() {
        console.log('📊 STEP 2 COMPLETE - MOBILE USER-AGENT REPORT');
        console.log('=============================================');

        // Analyze results
        const successfulRequests = this.testResults.filter(r => r.statusCode === 200);
        const pokemonContent = this.testResults.filter(r => r.content && this.containsPokemonContent(r.content));
        
        // Group by user-agent
        const byUserAgent = {};
        for (const result of this.testResults) {
            if (!byUserAgent[result.userAgent]) {
                byUserAgent[result.userAgent] = { total: 0, successful: 0, pokemon: 0 };
            }
            byUserAgent[result.userAgent].total++;
            if (result.statusCode === 200) {
                byUserAgent[result.userAgent].successful++;
            }
            if (result.content && this.containsPokemonContent(result.content)) {
                byUserAgent[result.userAgent].pokemon++;
            }
        }

        const report = {
            step: 2,
            description: 'Mobile User-Agent Testing',
            summary: {
                total_tests: this.testResults.length,
                successful_requests: successfulRequests.length,
                pokemon_content_found: pokemonContent.length,
                success_rate: `${Math.round((successfulRequests.length / this.testResults.length) * 100)}%`
            },
            user_agent_analysis: byUserAgent,
            best_user_agents: Object.entries(byUserAgent)
                .filter(([name, stats]) => stats.successful > 0)
                .map(([name, stats]) => ({
                    name,
                    success_rate: `${Math.round((stats.successful / stats.total) * 100)}%`,
                    pokemon_content: stats.pokemon > 0
                })),
            recommendations: this.generateRecommendations(byUserAgent, pokemonContent),
            detailed_results: this.testResults
        };

        // Save report
        const reportPath = 'step2-mobile-useragent-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Display summary
        console.log(`🎯 Tests Completed: ${this.testResults.length}`);
        console.log(`✅ Successful Requests: ${successfulRequests.length}`);
        console.log(`🎴 Pokemon Content Found: ${pokemonContent.length}`);
        console.log(`📈 Success Rate: ${report.summary.success_rate}`);

        if (report.best_user_agents.length > 0) {
            console.log('\n🏆 BEST USER-AGENTS:');
            for (const ua of report.best_user_agents) {
                console.log(`  📱 ${ua.name}: ${ua.success_rate} ${ua.pokemon_content ? '🎴' : ''}`);
            }
        }

        console.log(`\n📄 Report saved: ${reportPath}`);
        console.log('➡️  Ready for Step 3: Mobile Page Analysis');

        return report;
    }

    generateRecommendations(userAgentStats, pokemonResults) {
        const recommendations = [];

        // Find best performing user-agents
        const bestUA = Object.entries(userAgentStats)
            .sort(([,a], [,b]) => b.successful - a.successful)
            .slice(0, 2);

        if (bestUA.length > 0) {
            recommendations.push(`Use ${bestUA[0][0]} user-agent for best success rate`);
        }

        if (pokemonResults.length > 0) {
            recommendations.push('Pokemon content is accessible - proceed to detailed page analysis');
        } else {
            recommendations.push('No Pokemon content detected - try alternative URLs or deeper page analysis');
        }

        // Check if mobile vs desktop makes a difference
        const mobileResults = Object.entries(userAgentStats).filter(([name]) => 
            name.includes('iPhone') || name.includes('Android') || name.includes('App'));
        const desktopResults = Object.entries(userAgentStats).filter(([name]) => 
            name.includes('Desktop') || name.includes('Macintosh'));

        if (mobileResults.length > 0 && desktopResults.length > 0) {
            const mobileAvg = mobileResults.reduce((sum, [,stats]) => sum + stats.successful, 0) / mobileResults.length;
            const desktopAvg = desktopResults.reduce((sum, [,stats]) => sum + stats.successful, 0) / desktopResults.length;

            if (mobileAvg > desktopAvg) {
                recommendations.push('Mobile user-agents perform better than desktop');
            } else if (desktopAvg > mobileAvg) {
                recommendations.push('Desktop user-agents perform better than mobile');
            }
        }

        return recommendations;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const tester = new MobileUserAgentTester();
    await tester.testMobileUserAgents();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MobileUserAgentTester;
