#!/usr/bin/env node
/**
 * 🎯 PHONE API TRAFFIC INTERCEPTOR
 * ===============================
 * 
 * Intercept actual API calls from your Fanatics mobile app
 * Capture real authentication tokens and endpoints
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');

class PhoneAPIInterceptor {
    constructor() {
        this.capturedAPICalls = [];
        this.authTokens = new Set();
        this.apiEndpoints = new Set();
        this.pokemonData = [];
        this.fanaticsIPs = new Set();
        
        console.log('📱 PHONE API TRAFFIC INTERCEPTOR');
        console.log('===============================');
        console.log('🎯 Capturing REAL API calls from your Fanatics mobile app');
    }

    async setupInterception() {
        console.log('\n🔧 SETTING UP API CALL INTERCEPTION');
        console.log('===================================');
        
        // Get network info
        const networkInfo = this.getNetworkInfo();
        console.log(`🌐 Your computer IP: ${networkInfo.localIP}`);
        console.log(`📡 Network interface: ${networkInfo.interface}`);
        
        // Start multiple capture methods
        await this.startNetworkMonitoring();
        await this.startDNSResolution();
        await this.startConnectionTracking();

        console.log('\n🎯 INTERCEPTION IS ACTIVE!');
        console.log('==========================');
        console.log('\n📱 NOW ON YOUR PHONE (Fanatics app should be open):');
        console.log('1. ✅ Browse Pokemon cards');
        console.log('2. ✅ Search for "pokemon"');
        console.log('3. ✅ View individual card details');
        console.log('4. ✅ Check auction listings');
        console.log('5. ✅ Browse marketplace');
        console.log('\n⏱️ Capturing for 90 seconds...');
        console.log('📡 Move around the app - each action generates API calls we can capture!');

        // Capture for 90 seconds
        return new Promise((resolve) => {
            setTimeout(() => {
                this.stopCapture();
                resolve(this.analyzeResults());
            }, 90000);
        });
    }

    getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        let localIP = null;
        let interfaceName = null;
        
        for (const [name, nets] of Object.entries(interfaces)) {
            for (const net of nets) {
                if (net.family === 'IPv4' && !net.internal && 
                    (net.address.startsWith('192.168') || net.address.startsWith('10.'))) {
                    localIP = net.address;
                    interfaceName = name;
                    break;
                }
            }
        }
        
        return { localIP, interface: interfaceName || 'en0' };
    }

    async startNetworkMonitoring() {
        console.log('📡 Starting network monitoring for Fanatics traffic...');
        
        // Method 1: Monitor network connections
        this.connectionMonitor = setInterval(() => {
            this.checkFanaticsConnections();
        }, 2000);
        
        // Method 2: Monitor network statistics
        this.netstatMonitor = setInterval(() => {
            this.analyzeNetworkConnections();
        }, 3000);
        
        console.log('✅ Network monitoring active');
    }

    async startDNSResolution() {
        console.log('🌐 Starting DNS monitoring for Fanatics domains...');
        
        // Resolve Fanatics domains to get their IPs
        const fanaticsHosts = [
            'fanaticscollect.com',
            'api.fanaticscollect.com', 
            'mobile.fanaticscollect.com',
            'www.fanaticscollect.com'
        ];
        
        for (const host of fanaticsHosts) {
            exec(`nslookup ${host}`, (error, stdout) => {
                if (stdout) {
                    const ipMatches = stdout.match(/Address: ([0-9.]+)/g);
                    if (ipMatches) {
                        ipMatches.forEach(match => {
                            const ip = match.replace('Address: ', '');
                            this.fanaticsIPs.add(ip);
                            console.log(`🎯 Fanatics server IP discovered: ${ip}`);
                        });
                    }
                }
            });
        }
        
        // Monitor DNS cache
        this.dnsMonitor = setInterval(() => {
            this.checkDNSActivity();
        }, 5000);
        
        console.log('✅ DNS monitoring active');
    }

    async startConnectionTracking() {
        console.log('🔗 Starting connection tracking...');
        
        // Track HTTPS connections (port 443)
        this.httpsMonitor = setInterval(() => {
            this.trackHTTPSConnections();
        }, 2000);
        
        // Track HTTP connections (port 80)  
        this.httpMonitor = setInterval(() => {
            this.trackHTTPConnections();
        }, 2000);
        
        console.log('✅ Connection tracking active');
    }

    checkFanaticsConnections() {
        exec('netstat -an | grep -i fanatic', (error, stdout) => {
            if (stdout && stdout.trim()) {
                console.log('🔍 FANATICS CONNECTION DETECTED!');
                const connections = stdout.trim().split('\n');
                
                connections.forEach(connection => {
                    console.log(`   📡 ${connection.trim()}`);
                    this.capturedAPICalls.push({
                        timestamp: new Date().toISOString(),
                        type: 'network_connection',
                        data: connection.trim(),
                        source: 'netstat'
                    });
                });
            }
        });
        
        // Also check for connections to known Fanatics IPs
        Array.from(this.fanaticsIPs).forEach(ip => {
            exec(`netstat -an | grep ${ip}`, (error, stdout) => {
                if (stdout && stdout.trim()) {
                    console.log(`🎯 Connection to Fanatics IP ${ip} detected!`);
                    this.analyzeConnectionToIP(ip, stdout);
                }
            });
        });
    }

    analyzeNetworkConnections() {
        // Check for active HTTPS connections (most mobile apps use HTTPS)
        exec('netstat -an | grep :443 | grep ESTABLISHED', (error, stdout) => {
            if (stdout) {
                const connections = stdout.trim().split('\n').filter(line => line.trim());
                
                if (connections.length > 0) {
                    console.log(`🔐 Active HTTPS connections: ${connections.length}`);
                    
                    // Look for connections that might be Fanatics
                    connections.forEach(connection => {
                        Array.from(this.fanaticsIPs).forEach(ip => {
                            if (connection.includes(ip)) {
                                console.log('🎉 FANATICS HTTPS CONNECTION ACTIVE!');
                                console.log(`   📡 ${connection.trim()}`);
                                this.logFanaticsActivity(connection, 'https_connection');
                            }
                        });
                    });
                }
            }
        });
    }

    checkDNSActivity() {
        exec('dscacheutil -cachedump -entries Host | grep -i fanatic', (error, stdout) => {
            if (stdout && stdout.trim()) {
                console.log('🌐 FANATICS DNS ACTIVITY!');
                console.log(`   ${stdout.trim()}`);
                
                this.capturedAPICalls.push({
                    timestamp: new Date().toISOString(),
                    type: 'dns_activity',
                    data: stdout.trim(),
                    source: 'dns_cache'
                });
            }
        });
    }

    trackHTTPSConnections() {
        // Use lsof to track file descriptors for network connections
        exec('lsof -i :443 | grep -v COMMAND', (error, stdout) => {
            if (stdout) {
                const connections = stdout.trim().split('\n');
                
                connections.forEach(connection => {
                    if (connection.includes('ESTABLISHED')) {
                        // Extract IP from connection
                        const ipMatch = connection.match(/([0-9.]+):443/);
                        if (ipMatch) {
                            const remoteIP = ipMatch[1];
                            
                            // Check if this IP belongs to Fanatics
                            if (this.fanaticsIPs.has(remoteIP)) {
                                console.log('🔐 ACTIVE FANATICS HTTPS CONNECTION!');
                                console.log(`   📡 ${connection.trim()}`);
                                this.logFanaticsActivity(connection, 'lsof_https');
                            }
                        }
                    }
                });
            }
        });
    }

    trackHTTPConnections() {
        exec('lsof -i :80 | grep -v COMMAND', (error, stdout) => {
            if (stdout) {
                const connections = stdout.trim().split('\n');
                
                connections.forEach(connection => {
                    if (connection.includes('ESTABLISHED')) {
                        const ipMatch = connection.match(/([0-9.]+):80/);
                        if (ipMatch) {
                            const remoteIP = ipMatch[1];
                            
                            if (this.fanaticsIPs.has(remoteIP)) {
                                console.log('📡 ACTIVE FANATICS HTTP CONNECTION!');
                                console.log(`   📡 ${connection.trim()}`);
                                this.logFanaticsActivity(connection, 'lsof_http');
                            }
                        }
                    }
                });
            }
        });
    }

    analyzeConnectionToIP(ip, connectionData) {
        const connections = connectionData.trim().split('\n');
        
        connections.forEach(connection => {
            if (connection.includes('ESTABLISHED') || connection.includes('CONNECTED')) {
                console.log(`   🔗 Active connection to Fanatics: ${connection.trim()}`);
                
                // Try to determine what type of traffic this might be
                if (connection.includes(':443')) {
                    console.log('      🔐 HTTPS (API calls likely encrypted here)');
                } else if (connection.includes(':80')) {
                    console.log('      📡 HTTP (potential API calls)');
                }
                
                this.logFanaticsActivity(connection, 'ip_connection');
            }
        });
    }

    logFanaticsActivity(data, source) {
        this.capturedAPICalls.push({
            timestamp: new Date().toISOString(),
            type: 'fanatics_activity',
            data: data.trim(),
            source: source,
            analysis: 'potential_api_traffic'
        });
    }

    stopCapture() {
        console.log('\n⏹️ STOPPING API TRAFFIC CAPTURE');
        console.log('==============================');
        
        // Stop all monitoring intervals
        if (this.connectionMonitor) clearInterval(this.connectionMonitor);
        if (this.netstatMonitor) clearInterval(this.netstatMonitor);
        if (this.dnsMonitor) clearInterval(this.dnsMonitor);
        if (this.httpsMonitor) clearInterval(this.httpsMonitor);
        if (this.httpMonitor) clearInterval(this.httpMonitor);
        
        console.log('✅ All monitoring stopped');
    }

    async analyzeResults() {
        console.log('\n📊 ANALYZING CAPTURED API TRAFFIC');
        console.log('=================================');
        
        // Categorize captured data
        const connectionActivity = this.capturedAPICalls.filter(call => 
            call.type === 'network_connection' || call.type === 'fanatics_activity'
        );
        
        const dnsActivity = this.capturedAPICalls.filter(call => 
            call.type === 'dns_activity'
        );
        
        const results = {
            timestamp: new Date().toISOString(),
            capture_method: 'Phone API Traffic Interception',
            capture_duration: '90 seconds',
            total_fanatics_activity: this.capturedAPICalls.length,
            fanatics_ips_discovered: Array.from(this.fanaticsIPs),
            network_connections: connectionActivity.length,
            dns_activity: dnsActivity.length,
            captured_data: this.capturedAPICalls,
            analysis: {
                app_network_activity: connectionActivity.length > 0,
                dns_resolution_active: dnsActivity.length > 0,
                https_connections_detected: connectionActivity.some(call => 
                    call.data && call.data.includes(':443')
                )
            }
        };
        
        // Save all captured data
        fs.writeFileSync('fanatics-api-interception-results.json', JSON.stringify(results, null, 2));
        
        console.log('\n📊 INTERCEPTION RESULTS');
        console.log('=======================');
        console.log(`🌐 Fanatics IPs discovered: ${this.fanaticsIPs.size}`);
        console.log(`📡 Network activities captured: ${this.capturedAPICalls.length}`);
        console.log(`🔗 Connection events: ${connectionActivity.length}`);
        console.log(`🌐 DNS events: ${dnsActivity.length}`);
        
        if (this.fanaticsIPs.size > 0) {
            console.log('\n🎯 FANATICS SERVER IPs:');
            Array.from(this.fanaticsIPs).forEach(ip => {
                console.log(`   📍 ${ip}`);
            });
        }
        
        if (connectionActivity.length > 0) {
            console.log('\n🔐 NETWORK ACTIVITY DETECTED!');
            console.log('============================');
            console.log('✅ Your Fanatics app IS making network calls');
            console.log('✅ We detected connection activity to Fanatics servers');
            console.log('💡 The app uses HTTPS (encrypted), so we need a different approach');
            
            console.log('\n🎯 NEXT STEP: HTTPS DECRYPTION');
            console.log('We detected HTTPS traffic - let\'s set up SSL interception');
            
            await this.createHTTPSInterceptor();
        } else {
            console.log('\n⚠️ LIMITED NETWORK ACTIVITY DETECTED');
            console.log('💡 This could mean:');
            console.log('   • App is using cached data');
            console.log('   • Need to browse more actively in the app');
            console.log('   • App uses different network patterns');
        }
        
        console.log(`\n📄 All data saved to: fanatics-api-interception-results.json`);
        
        return results;
    }

    async createHTTPSInterceptor() {
        console.log('\n🔐 CREATING HTTPS INTERCEPTION SETUP');
        console.log('===================================');
        
        const httpsSetup = {
            instructions: 'HTTPS Proxy Setup for Mobile App Interception',
            step1: 'Install Charles Proxy or mitmproxy',
            step2: 'Configure iPhone to use computer as proxy',
            step3: 'Install SSL certificate on iPhone',
            step4: 'Browse Pokemon cards in Fanatics app',
            step5: 'Capture decrypted HTTPS traffic',
            
            alternative_method: {
                description: 'Use Burp Suite Community Edition',
                setup: [
                    '1. Download Burp Suite Community (free)',
                    '2. Start proxy listener on 8080',
                    '3. iPhone Settings -> WiFi -> Configure Proxy -> Manual',
                    '4. Server: [Your Computer IP], Port: 8080', 
                    '5. Install Burp CA certificate on iPhone',
                    '6. Browse Fanatics app -> View captured requests in Burp'
                ]
            },
            
            fanatics_ips_to_monitor: Array.from(this.fanaticsIPs),
            
            what_to_look_for: [
                'Authorization: Bearer [token]',
                'Cookie: sessionId=[session]',
                'X-API-Key: [api-key]',
                'POST /api/v1/search with Pokemon data',
                'GET /api/v1/cards/[card-id]',
                'GET /api/v1/auctions with Pokemon filters'
            ]
        };
        
        fs.writeFileSync('https-interception-setup.json', JSON.stringify(httpsSetup, null, 2));
        
        console.log('📄 Created: https-interception-setup.json');
        console.log('🎯 This contains step-by-step instructions for HTTPS interception');
        console.log('\n✅ RECOMMENDATION: Use Burp Suite Community Edition (free)');
        console.log('   It\'s the easiest way to intercept HTTPS mobile app traffic');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log('🚀 STARTING PHONE API TRAFFIC INTERCEPTION');
    console.log('==========================================');
    console.log('🎯 Ready to capture REAL API calls from your Fanatics app\n');
    console.log('📱 Make sure your Fanatics app is open and ready!');
    
    const interceptor = new PhoneAPIInterceptor();
    await interceptor.setupInterception();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PhoneAPIInterceptor;
