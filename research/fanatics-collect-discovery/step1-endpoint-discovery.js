#!/usr/bin/env node
/**
 * 🎯 STEP 1: FANATICS MOBILE API ENDPOINT DISCOVERY
 * ================================================
 * 
 * Simple, focused approach to discover working mobile API endpoints
 * No browser automation - just direct HTTP requests
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

class FanaticsMobileEndpointDiscovery {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.foundEndpoints = [];
        
        // Mobile app headers (iPhone)
        this.mobileHeaders = {
            'User-Agent': 'FanaticsCollect/3.2.1 (iPhone; iOS 16.0; Scale/3.00)',
            'Accept': 'application/json, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'X-Requested-With': 'com.fanatics.collect',
            'X-App-Version': '3.2.1',
            'X-Platform': 'iOS'
        };
        
        // Common mobile API endpoints to test
        this.testEndpoints = [
            '/api/v1/cards',
            '/api/v1/search', 
            '/api/v1/auctions',
            '/api/v1/pokemon',
            '/api/v2/cards',
            '/api/v2/search',
            '/mobile/api/cards',
            '/mobile/search',
            '/app/api/cards',
            '/graphql'
        ];
    }

    async discoverEndpoints() {
        console.log('🔍 STEP 1: MOBILE API ENDPOINT DISCOVERY');
        console.log('========================================');
        console.log(`Testing ${this.testEndpoints.length} common mobile endpoints...`);
        
        for (let i = 0; i < this.testEndpoints.length; i++) {
            const endpoint = this.testEndpoints[i];
            console.log(`\n[${i + 1}/${this.testEndpoints.length}] Testing: ${endpoint}`);
            
            try {
                const result = await this.testEndpoint(endpoint);
                
                if (result.working) {
                    this.foundEndpoints.push(result);
                    console.log(`✅ WORKING: ${endpoint} (${result.status}) - ${result.contentType}`);
                } else {
                    console.log(`❌ Failed: ${endpoint} (${result.status || 'timeout'})`);
                }
                
            } catch (error) {
                console.log(`❌ Error: ${endpoint} - ${error.message}`);
            }
            
            // Rate limiting - wait 2 seconds between requests
            await this.delay(2000);
        }
        
        return this.generateReport();
    }

    async testEndpoint(endpoint) {
        return new Promise((resolve) => {
            const path = endpoint;
            
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: path,
                method: 'GET',
                headers: this.mobileHeaders,
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const result = {
                        endpoint: endpoint,
                        working: res.statusCode < 400,
                        status: res.statusCode, 
                        contentType: res.headers['content-type'] || 'unknown',
                        responseSize: data.length,
                        containsPokemon: data.toLowerCase().includes('pokemon'),
                        responsePreview: data.substring(0, 200)
                    };
                    
                    resolve(result);
                });
            });

            req.on('error', (error) => {
                resolve({
                    endpoint: endpoint,
                    working: false,
                    error: error.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    endpoint: endpoint,
                    working: false,
                    error: 'timeout'
                });
            });

            req.end();
        });
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            step: 'Mobile API Endpoint Discovery',
            total_endpoints_tested: this.testEndpoints.length,
            working_endpoints: this.foundEndpoints.length,
            success_rate: `${Math.round((this.foundEndpoints.length / this.testEndpoints.length) * 100)}%`,
            discovered_endpoints: this.foundEndpoints,
            next_step: this.foundEndpoints.length > 0 ? 
                'Step 2: Query working endpoints for Pokemon data' : 
                'Step 2: Try alternative mobile approaches'
        };
        
        const reportFile = 'step1-endpoint-discovery-report.json';
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log('\n📊 STEP 1 COMPLETE - ENDPOINT DISCOVERY REPORT');
        console.log('==============================================');
        console.log(`🎯 Endpoints Tested: ${this.testEndpoints.length}`);
        console.log(`✅ Working Endpoints: ${this.foundEndpoints.length}`);
        console.log(`📈 Success Rate: ${report.success_rate}`);
        
        if (this.foundEndpoints.length > 0) {
            console.log('\n🎉 WORKING ENDPOINTS FOUND:');
            this.foundEndpoints.forEach(endpoint => {
                console.log(`   • ${endpoint.endpoint} (${endpoint.status}) - ${endpoint.contentType}`);
            });
            console.log('\n➡️  Ready for Step 2: Query these endpoints for Pokemon data');
        } else {
            console.log('\n⚠️  No working endpoints found');
            console.log('➡️  Ready for Step 2: Try alternative mobile approaches');
        }
        
        console.log(`📄 Report saved: ${reportFile}`);
        
        return report;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const discovery = new FanaticsMobileEndpointDiscovery();
    await discovery.discoverEndpoints();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsMobileEndpointDiscovery;
