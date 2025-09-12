#!/usr/bin/env node

/**
 * 📱 FANATICS MOBILE APP HTTP PROXY INTERCEPTOR
 * ==============================================
 * Captures API calls by routing phone traffic through this proxy
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');

console.log('🚀 FANATICS HTTP PROXY INTERCEPTOR');
console.log('=====================================');

let capturedRequests = [];
let startTime = Date.now();

// Create HTTP proxy server
const proxy = http.createServer((req, res) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    const urlParts = url.parse(req.url);
    const options = {
        hostname: urlParts.hostname,
        port: urlParts.port || (urlParts.protocol === 'https:' ? 443 : 80),
        path: urlParts.path,
        method: req.method,
        headers: req.headers
    };

    // Check if this is a Fanatics request
    const isFanaticsRequest = req.headers.host && (
        req.headers.host.includes('fanatics') ||
        req.headers.host.includes('collect') ||
        urlParts.hostname?.includes('fanatics') ||
        urlParts.hostname?.includes('collect')
    );

    if (isFanaticsRequest) {
        console.log('🎯 FANATICS REQUEST INTERCEPTED!');
        console.log(`   🌐 Host: ${req.headers.host}`);
        console.log(`   📍 URL: ${req.url}`);
        console.log(`   🔑 Method: ${req.method}`);
        
        // Log headers
        console.log('   📋 Headers:');
        Object.entries(req.headers).forEach(([key, value]) => {
            if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token') || key.toLowerCase().includes('session')) {
                console.log(`      🔐 ${key}: ${value}`);
            } else {
                console.log(`      📄 ${key}: ${value}`);
            }
        });

        // Capture request data
        let requestBody = '';
        req.on('data', chunk => {
            requestBody += chunk.toString();
        });

        req.on('end', () => {
            const capturedRequest = {
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.url,
                host: req.headers.host,
                headers: req.headers,
                body: requestBody
            };
            
            capturedRequests.push(capturedRequest);
            
            if (requestBody && requestBody.length > 0) {
                console.log(`   📦 Request Body: ${requestBody.substring(0, 200)}${requestBody.length > 200 ? '...' : ''}`);
            }
        });
    }

    // Forward the request
    const protocol = urlParts.protocol === 'https:' ? https : http;
    const proxyReq = protocol.request(options, (proxyRes) => {
        // Copy response headers
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        if (isFanaticsRequest) {
            console.log(`   📤 Response Status: ${proxyRes.statusCode}`);
            console.log(`   📋 Response Headers:`, Object.keys(proxyRes.headers));
            
            let responseBody = '';
            proxyRes.on('data', chunk => {
                responseBody += chunk.toString();
                res.write(chunk);
            });
            
            proxyRes.on('end', () => {
                if (responseBody && responseBody.length > 0) {
                    console.log(`   📥 Response Body: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
                    
                    // Check for Pokemon-related content
                    if (responseBody.toLowerCase().includes('pokemon')) {
                        console.log('🎯 POKEMON CONTENT DETECTED IN RESPONSE!');
                    }
                    
                    // Update captured request with response
                    const lastRequest = capturedRequests[capturedRequests.length - 1];
                    if (lastRequest) {
                        lastRequest.response = {
                            statusCode: proxyRes.statusCode,
                            headers: proxyRes.headers,
                            body: responseBody
                        };
                    }
                }
                res.end();
            });
        } else {
            // Just pipe through for non-Fanatics requests
            proxyRes.pipe(res);
        }
    });

    proxyReq.on('error', (err) => {
        console.error('❌ Proxy request error:', err.message);
        res.writeHead(500);
        res.end('Proxy Error');
    });

    // Forward request body
    req.pipe(proxyReq);
});

// Start proxy server
const PORT = 8080;
proxy.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 PROXY SERVER RUNNING ON PORT ${PORT}`);
    console.log('=========================================');
    console.log(`📱 Configure your phone's HTTP proxy to:`);
    console.log(`   🏠 IP: 192.168.0.36 (or your computer's IP)`);
    console.log(`   🔌 Port: ${PORT}`);
    console.log(`\n📋 SETUP STEPS:`);
    console.log('1. Open iPhone Settings > Wi-Fi');
    console.log('2. Tap the (i) next to your network');
    console.log('3. Scroll to "HTTP Proxy" > Configure Proxy > Manual');
    console.log('4. Enter Server: 192.168.0.36, Port: 8080');
    console.log('5. Save and return to Fanatics app');
    console.log('\n🎯 Now browse Pokemon cards in the Fanatics app!');
    console.log('📡 All API calls will be intercepted and logged here');
    
    // Auto-stop after 5 minutes
    setTimeout(() => {
        console.log('\n⏹️ STOPPING PROXY AFTER 5 MINUTES');
        console.log('===================================');
        
        // Save captured data
        const results = {
            summary: {
                capturedRequests: capturedRequests.length,
                duration: `${Math.round((Date.now() - startTime) / 1000)} seconds`,
                timestamp: new Date().toISOString()
            },
            requests: capturedRequests
        };
        
        fs.writeFileSync('fanatics-proxy-capture.json', JSON.stringify(results, null, 2));
        console.log(`📄 Captured ${capturedRequests.length} Fanatics requests`);
        console.log('💾 Data saved to: fanatics-proxy-capture.json');
        
        if (capturedRequests.length > 0) {
            console.log('\n🎯 CAPTURED FANATICS API CALLS:');
            capturedRequests.forEach((req, i) => {
                console.log(`${i + 1}. ${req.method} ${req.url}`);
                if (req.headers.authorization) {
                    console.log(`   🔐 Auth: ${req.headers.authorization.substring(0, 50)}...`);
                }
            });
        }
        
        process.exit(0);
    }, 300000); // 5 minutes
});

proxy.on('error', (err) => {
    console.error('❌ Proxy server error:', err.message);
});

console.log('\n⏰ Proxy will run for 5 minutes');
console.log('🎯 Waiting for Fanatics app traffic...\n');
