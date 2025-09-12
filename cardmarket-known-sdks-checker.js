#!/usr/bin/env node
/**
 * Check for Known CardMarket SDKs
 * Based on community research and known implementations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

// Known CardMarket SDKs from community research
const KNOWN_CARDMARKET_SDKS = [
    {
        name: 'mkmsdk',
        language: 'Python',
        github: 'https://github.com/evonove/mkmsdk',
        description: 'Official-like Python SDK for MagicCardMarket (CardMarket)',
        status: 'Active',
        canAdapt: true,
        priority: 'High'
    },
    {
        name: 'cardmarket-api',
        language: 'JavaScript',
        npm: 'cardmarket-api',
        description: 'Node.js wrapper for CardMarket API',
        status: 'Unknown',
        priority: 'High'
    },
    {
        name: 'mkm-sdk-js', 
        language: 'JavaScript',
        github: 'https://github.com/alexanderkjall/mkm-sdk-js',
        description: 'JavaScript SDK for MagicCardMarket',
        status: 'Community',
        priority: 'Medium'
    },
    {
        name: 'cardmarket-wrapper',
        language: 'JavaScript',
        npm: 'cardmarket-wrapper',
        description: 'Simple CardMarket API wrapper',
        status: 'Unknown',
        priority: 'Medium'
    },
    {
        name: 'mkm-api',
        language: 'JavaScript',
        npm: 'mkm-api',
        description: 'MagicCardMarket API client',
        status: 'Unknown',
        priority: 'Medium'
    },
    {
        name: 'cardmarket-js',
        language: 'JavaScript',
        npm: 'cardmarket-js',
        description: 'CardMarket JavaScript client',
        status: 'Unknown',
        priority: 'Low'
    }
];

class KnownSDKChecker {
    constructor() {
        this.workingSDKs = [];
        this.availableSDKs = [];
    }

    async checkGitHubRepo(repoUrl) {
        return new Promise((resolve) => {
            // Extract owner/repo from URL
            const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
            if (!match) {
                resolve(null);
                return;
            }

            const repoPath = match[1];
            const apiUrl = `https://api.github.com/repos/${repoPath}`;
            
            const req = https.request(apiUrl, {
                headers: {
                    'User-Agent': 'PokeDAO-SDK-Checker/1.0'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const repoData = JSON.parse(data);
                            resolve({
                                stars: repoData.stargazers_count,
                                forks: repoData.forks_count,
                                issues: repoData.open_issues_count,
                                lastUpdate: repoData.updated_at,
                                language: repoData.language,
                                description: repoData.description
                            });
                        } catch (error) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                });
            });
            
            req.on('error', () => resolve(null));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(null);
            });
            
            req.end();
        });
    }

    async checkNpmPackage(packageName) {
        return new Promise((resolve) => {
            const url = `https://registry.npmjs.org/${packageName}`;
            
            const req = https.request(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const packageData = JSON.parse(data);
                            const latestVersion = packageData['dist-tags']?.latest;
                            
                            resolve({
                                version: latestVersion,
                                description: packageData.description,
                                keywords: packageData.keywords || [],
                                lastUpdate: packageData.time?.[latestVersion],
                                weeklyDownloads: null // Would need separate API call
                            });
                        } catch (error) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                });
            });
            
            req.on('error', () => resolve(null));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(null);
            });
            
            req.end();
        });
    }

    async checkKnownSDKs() {
        console.log('🔍 Checking Known CardMarket SDKs...\n');
        
        for (const sdk of KNOWN_CARDMARKET_SDKS) {
            console.log(`📦 Checking: ${sdk.name}`);
            console.log(`   📝 ${sdk.description}`);
            console.log(`   💻 Language: ${sdk.language}`);
            console.log(`   ⭐ Priority: ${sdk.priority}`);
            
            let sdkInfo = { ...sdk };
            
            // Check npm if available
            if (sdk.npm) {
                console.log(`   📊 Checking npm registry...`);
                const npmInfo = await this.checkNpmPackage(sdk.npm);
                
                if (npmInfo) {
                    console.log(`   ✅ Available on npm`);
                    console.log(`   📊 Version: ${npmInfo.version}`);
                    console.log(`   🕒 Updated: ${new Date(npmInfo.lastUpdate).toLocaleDateString()}`);
                    
                    sdkInfo.npmInfo = npmInfo;
                    sdkInfo.installCommand = `npm install ${sdk.npm}`;
                    this.availableSDKs.push(sdkInfo);
                } else {
                    console.log(`   ❌ Not available on npm`);
                }
            }
            
            // Check GitHub if available
            if (sdk.github) {
                console.log(`   🐙 Checking GitHub repo...`);
                const githubInfo = await this.checkGitHubRepo(sdk.github);
                
                if (githubInfo) {
                    console.log(`   ✅ GitHub repo active`);
                    console.log(`   ⭐ Stars: ${githubInfo.stars}`);
                    console.log(`   🍴 Forks: ${githubInfo.forks}`);
                    console.log(`   🐛 Open issues: ${githubInfo.issues}`);
                    console.log(`   🕒 Last update: ${new Date(githubInfo.lastUpdate).toLocaleDateString()}`);
                    
                    sdkInfo.githubInfo = githubInfo;
                    sdkInfo.installMethod = 'git clone or manual download';
                    
                    if (!sdkInfo.npmInfo) {
                        this.availableSDKs.push(sdkInfo);
                    }
                } else {
                    console.log(`   ❌ GitHub repo not accessible`);
                }
            }
            
            console.log('');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async testBestSDK() {
        if (this.availableSDKs.length === 0) {
            console.log('❌ No available SDKs found to test');
            return;
        }
        
        // Sort by priority and availability
        const sortedSDKs = this.availableSDKs.sort((a, b) => {
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            
            // Prefer npm packages, then high priority
            if (a.npmInfo && !b.npmInfo) return -1;
            if (!a.npmInfo && b.npmInfo) return 1;
            return bPriority - aPriority;
        });
        
        const bestSDK = sortedSDKs[0];
        console.log(`🏆 Testing best option: ${bestSDK.name}\n`);
        
        if (bestSDK.installCommand) {
            try {
                console.log(`📥 Installing ${bestSDK.name}...`);
                execSync(bestSDK.installCommand, {
                    stdio: ['ignore', 'ignore', 'ignore'],
                    timeout: 30000
                });
                
                console.log(`📦 Loading ${bestSDK.name}...`);
                const sdk = require(bestSDK.npm);
                
                console.log(`✅ ${bestSDK.name} loaded successfully!`);
                console.log(`📋 Available exports:`, Object.keys(sdk));
                
                this.workingSDKs.push({
                    ...bestSDK,
                    sdk: sdk,
                    loadedSuccessfully: true
                });
                
                await this.createTestScript(bestSDK);
                
            } catch (error) {
                console.log(`❌ Failed to install/load ${bestSDK.name}: ${error.message}`);
            }
        }
    }

    async createTestScript(sdk) {
        const testScript = `#!/usr/bin/env node
/**
 * CardMarket SDK Test Script - ${sdk.name}
 * Auto-generated test for ${sdk.name}
 */

const ${sdk.name.replace(/-/g, '_')} = require('${sdk.npm || sdk.name}');

async function testCardMarketSDK() {
    console.log('🧪 Testing ${sdk.name} SDK...');
    
    try {
        // Replace with your actual credentials
        const credentials = {
            appToken: process.env.CARDMARKET_APP_TOKEN || 'your_app_token',
            appSecret: process.env.CARDMARKET_APP_SECRET || 'your_app_secret',
            accessToken: process.env.CARDMARKET_ACCESS_TOKEN || 'your_access_token',
            accessTokenSecret: process.env.CARDMARKET_ACCESS_TOKEN_SECRET || 'your_access_token_secret'
        };
        
        console.log('📋 SDK exports:', Object.keys(${sdk.name.replace(/-/g, '_')}));
        
        // Try different initialization patterns
        let client;
        try {
            if (typeof ${sdk.name.replace(/-/g, '_')} === 'function') {
                client = new ${sdk.name.replace(/-/g, '_')}(credentials);
                console.log('✅ Initialized as constructor');
            } else if (${sdk.name.replace(/-/g, '_')}.Client) {
                client = new ${sdk.name.replace(/-/g, '_')}.Client(credentials);
                console.log('✅ Initialized as Client class');
            } else if (${sdk.name.replace(/-/g, '_')}.default) {
                client = new ${sdk.name.replace(/-/g, '_')}.default(credentials);
                console.log('✅ Initialized as default export');
            } else {
                client = ${sdk.name.replace(/-/g, '_')};
                console.log('✅ Using direct export');
            }
        } catch (initError) {
            console.log('⚠️ Standard initialization failed:', initError.message);
            client = ${sdk.name.replace(/-/g, '_')};
        }
        
        // Test basic functionality
        console.log('📡 Testing API connection...');
        
        if (client && typeof client === 'object') {
            console.log('📋 Available methods:', Object.keys(client));
            
            // Common method patterns to try
            const testMethods = ['getGames', 'games', 'fetchGames', 'listGames'];
            
            for (const method of testMethods) {
                if (typeof client[method] === 'function') {
                    console.log(\`🔍 Trying method: \${method}\`);
                    
                    try {
                        const result = await client[method]();
                        console.log(\`✅ \${method} worked!\`);
                        
                        // Look for Pokemon
                        if (Array.isArray(result)) {
                            const pokemonGame = result.find(item => 
                                item.name && item.name.toLowerCase().includes('pokemon')
                            );
                            
                            if (pokemonGame) {
                                console.log('🎮 Pokemon game found!', pokemonGame);
                            }
                        }
                        
                        console.log('📊 Sample result:', result);
                        break;
                        
                    } catch (methodError) {
                        console.log(\`❌ \${method} failed: \${methodError.message}\`);
                    }
                }
            }
        }
        
        console.log('✅ SDK test completed!');
        console.log('💡 Configure your CardMarket API credentials to test with real data');
        
    } catch (error) {
        console.error('❌ SDK test failed:', error.message);
        console.log('💡 Make sure to set your CardMarket API credentials');
        console.log('🔑 Required: CARDMARKET_APP_TOKEN, CARDMARKET_APP_SECRET, CARDMARKET_ACCESS_TOKEN, CARDMARKET_ACCESS_TOKEN_SECRET');
    }
}

if (require.main === module) {
    testCardMarketSDK().catch(console.error);
}

module.exports = testCardMarketSDK;
`;

        const filename = `test-${sdk.name}-sdk.js`;
        fs.writeFileSync(filename, testScript);
        
        console.log(`📝 Created test script: ${filename}`);
        console.log(`🚀 Run with: node ${filename}`);
        console.log(`📥 Installed: ${sdk.installCommand}\n`);
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalKnownSDKs: KNOWN_CARDMARKET_SDKS.length,
            availableSDKs: this.availableSDKs.length,
            workingSDKs: this.workingSDKs.length,
            availableSDKsList: this.availableSDKs,
            workingSDKsList: this.workingSDKs,
            recommendations: []
        };
        
        // Generate recommendations
        if (this.workingSDKs.length > 0) {
            const bestSDK = this.workingSDKs[0];
            report.recommendations.push(`✅ RECOMMENDED: Use ${bestSDK.name}`);
            report.recommendations.push(`📥 Install: ${bestSDK.installCommand}`);
            report.recommendations.push(`🧪 Test: node test-${bestSDK.name}-sdk.js`);
            report.recommendations.push(`🔑 Configure CardMarket OAuth credentials`);
        } else if (this.availableSDKs.length > 0) {
            const topSDK = this.availableSDKs[0];
            report.recommendations.push(`⚠️ MANUAL SETUP: ${topSDK.name} available but needs manual configuration`);
            report.recommendations.push(`📥 Install: ${topSDK.installCommand || topSDK.installMethod}`);
        } else {
            report.recommendations.push(`❌ NO SDKs AVAILABLE: Use custom OAuth implementation`);
            report.recommendations.push(`🔧 Alternative: Build custom CardMarket client`);
        }
        
        // Check Python SDK for adaptation
        const pythonSDK = this.availableSDKs.find(sdk => sdk.language === 'Python');
        if (pythonSDK && pythonSDK.githubInfo) {
            report.recommendations.push(`💡 ADAPTATION OPPORTUNITY: ${pythonSDK.name} (Python) could be adapted to JavaScript`);
        }
        
        fs.writeFileSync('cardmarket-known-sdks-report.json', JSON.stringify(report, null, 2));
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 KNOWN CARDMARKET SDKs CHECK COMPLETE');
        console.log('='.repeat(60));
        console.log(`🔍 Total Known SDKs: ${report.totalKnownSDKs}`);
        console.log(`📦 Available SDKs: ${report.availableSDKs}`);
        console.log(`✅ Working SDKs: ${report.workingSDKs}`);
        
        if (this.workingSDKs.length > 0) {
            console.log('\n🎉 SUCCESS! Working SDK Found:');
            const bestSDK = this.workingSDKs[0];
            console.log(`   📦 ${bestSDK.name}`);
            console.log(`   📝 ${bestSDK.description}`);
            console.log(`   📥 ${bestSDK.installCommand}`);
            console.log(`   🧪 test-${bestSDK.name}-sdk.js`);
        } else if (this.availableSDKs.length > 0) {
            console.log('\n📋 Available SDKs (manual setup needed):');
            this.availableSDKs.slice(0, 3).forEach((sdk, i) => {
                console.log(`   ${i + 1}. ${sdk.name} (${sdk.language})`);
                console.log(`      📝 ${sdk.description}`);
                if (sdk.installCommand) {
                    console.log(`      📥 ${sdk.installCommand}`);
                }
                if (sdk.github) {
                    console.log(`      🐙 ${sdk.github}`);
                }
            });
        }
        
        console.log('\n📋 NEXT STEPS:');
        report.recommendations.forEach((rec, i) => {
            console.log(`   ${i + 1}. ${rec}`);
        });
        
        console.log(`\n📄 Full report: cardmarket-known-sdks-report.json`);
        console.log('='.repeat(60));
        
        return report;
    }

    async run() {
        console.log('🚀 CardMarket Known SDKs Checker Starting...\n');
        
        await this.checkKnownSDKs();
        await this.testBestSDK();
        await this.generateReport();
    }
}

async function main() {
    const checker = new KnownSDKChecker();
    await checker.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = KnownSDKChecker;
