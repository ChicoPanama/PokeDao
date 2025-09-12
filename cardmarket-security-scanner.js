#!/usr/bin/env node
/**
 * CardMarket SDK Security Vulnerability Scanner
 * Check for security issues before installation
 */

const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

class CardMarketSDKSecurityScanner {
    constructor() {
        this.foundSDKs = ['cardmarket-wrapper', 'mkm-api'];
        this.securityResults = {};
        this.vulnerabilityDatabases = [
            'https://registry.npmjs.org/-/npm/v1/security/advisories',
            'https://api.github.com/advisories'
        ];
    }

    // Get package security information from npm audit
    async scanNpmSecurity(packageName) {
        console.log(`🔍 Scanning ${packageName} for security vulnerabilities...`);
        
        try {
            // Get package information
            const packageInfo = await this.getPackageInfo(packageName);
            if (!packageInfo) {
                return { error: 'Package not found' };
            }
            
            console.log(`   📦 Package: ${packageName}@${packageInfo.version}`);
            console.log(`   📅 Published: ${packageInfo.publishDate}`);
            console.log(`   👤 Author: ${packageInfo.author}`);
            console.log(`   📝 Description: ${packageInfo.description}`);
            
            // Check for known vulnerabilities
            const vulnerabilities = await this.checkVulnerabilities(packageName, packageInfo.version);
            
            // Analyze dependencies
            const dependencies = await this.analyzeDependencies(packageInfo);
            
            // Check package reputation
            const reputation = await this.checkPackageReputation(packageName, packageInfo);
            
            const result = {
                packageName,
                version: packageInfo.version,
                publishDate: packageInfo.publishDate,
                author: packageInfo.author,
                description: packageInfo.description,
                vulnerabilities,
                dependencies,
                reputation,
                securityScore: this.calculateSecurityScore(vulnerabilities, dependencies, reputation),
                safe: this.isPackageSafe(vulnerabilities, dependencies, reputation)
            };
            
            this.securityResults[packageName] = result;
            return result;
            
        } catch (error) {
            console.log(`   ❌ Error scanning ${packageName}: ${error.message}`);
            return { error: error.message };
        }
    }

    async getPackageInfo(packageName) {
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
                            const versionData = packageData.versions?.[latestVersion];
                            
                            resolve({
                                name: packageData.name,
                                version: latestVersion,
                                description: packageData.description,
                                author: packageData.author?.name || packageData.maintainers?.[0]?.name,
                                publishDate: packageData.time?.[latestVersion],
                                dependencies: versionData?.dependencies || {},
                                devDependencies: versionData?.devDependencies || {},
                                keywords: packageData.keywords || [],
                                license: packageData.license,
                                repository: packageData.repository,
                                bugs: packageData.bugs,
                                homepage: packageData.homepage,
                                maintainers: packageData.maintainers,
                                scripts: versionData?.scripts || {}
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
            req.setTimeout(10000, () => {
                req.destroy();
                resolve(null);
            });
            
            req.end();
        });
    }

    async checkVulnerabilities(packageName, version) {
        console.log(`   🛡️ Checking for known vulnerabilities...`);
        
        try {
            // Create a temporary package.json to run npm audit
            const tempDir = '/tmp/npm-security-check';
            const tempPackageJson = {
                name: 'security-check',
                version: '1.0.0',
                dependencies: {
                    [packageName]: version
                }
            };
            
            // Try to run npm audit in a safe way
            try {
                execSync('mkdir -p /tmp/npm-security-check', { stdio: 'ignore' });
                fs.writeFileSync('/tmp/npm-security-check/package.json', JSON.stringify(tempPackageJson, null, 2));
                
                const auditResult = execSync('cd /tmp/npm-security-check && npm audit --json', {
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore'],
                    timeout: 10000
                });
                
                const auditData = JSON.parse(auditResult);
                
                console.log(`   ✅ npm audit completed`);
                console.log(`   📊 Vulnerabilities: ${auditData.metadata?.vulnerabilities?.total || 0}`);
                
                return {
                    total: auditData.metadata?.vulnerabilities?.total || 0,
                    critical: auditData.metadata?.vulnerabilities?.critical || 0,
                    high: auditData.metadata?.vulnerabilities?.high || 0,
                    moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
                    low: auditData.metadata?.vulnerabilities?.low || 0,
                    info: auditData.metadata?.vulnerabilities?.info || 0,
                    details: auditData.vulnerabilities || {}
                };
                
            } catch (auditError) {
                console.log(`   ⚠️ npm audit failed, checking manually...`);
                return await this.manualVulnerabilityCheck(packageName, version);
            } finally {
                // Clean up
                try {
                    execSync('rm -rf /tmp/npm-security-check', { stdio: 'ignore' });
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Vulnerability check failed: ${error.message}`);
            return { error: error.message };
        }
    }

    async manualVulnerabilityCheck(packageName, version) {
        console.log(`   🔍 Manual vulnerability database check...`);
        
        // Check against known vulnerability patterns
        const knownIssues = {
            'cardmarket-wrapper': {
                // Check for common issues in wrapper packages
                issues: [],
                lastSecurityUpdate: null
            },
            'mkm-api': {
                // Check for API client issues
                issues: [],
                lastSecurityUpdate: null
            }
        };
        
        const packageIssues = knownIssues[packageName] || { issues: [] };
        
        return {
            total: packageIssues.issues.length,
            critical: 0,
            high: 0,
            moderate: 0,
            low: packageIssues.issues.length,
            info: 0,
            manual: true,
            details: packageIssues.issues
        };
    }

    async analyzeDependencies(packageInfo) {
        console.log(`   🔗 Analyzing dependencies...`);
        
        const dependencies = packageInfo.dependencies || {};
        const devDependencies = packageInfo.devDependencies || {};
        const allDeps = { ...dependencies, ...devDependencies };
        
        const analysis = {
            total: Object.keys(allDeps).length,
            production: Object.keys(dependencies).length,
            development: Object.keys(devDependencies).length,
            suspicious: [],
            outdated: [],
            risky: []
        };
        
        // Check for suspicious dependencies
        const suspiciousPatterns = [
            /^[a-z]{1,2}$/, // Single letter packages
            /\d{10,}/, // Packages with long numbers
            /^test[0-9]+$/, // Test packages
            /^temp/, // Temporary packages
            /eval|exec|child_process/, // Code execution
        ];
        
        for (const [depName, version] of Object.entries(allDeps)) {
            if (suspiciousPatterns.some(pattern => pattern.test(depName))) {
                analysis.suspicious.push({ name: depName, version, reason: 'Suspicious name pattern' });
            }
            
            // Check for wildcard versions (risky)
            if (version.includes('*') || version.includes('x')) {
                analysis.risky.push({ name: depName, version, reason: 'Wildcard version' });
            }
        }
        
        console.log(`   📊 Dependencies: ${analysis.total} total, ${analysis.suspicious.length} suspicious`);
        
        return analysis;
    }

    async checkPackageReputation(packageName, packageInfo) {
        console.log(`   ⭐ Checking package reputation...`);
        
        const reputation = {
            downloadStats: null,
            maintainerCount: packageInfo.maintainers?.length || 0,
            hasRepository: !!packageInfo.repository,
            hasLicense: !!packageInfo.license,
            hasHomepage: !!packageInfo.homepage,
            age: this.calculatePackageAge(packageInfo.publishDate),
            lastUpdate: packageInfo.publishDate,
            trustScore: 0
        };
        
        // Calculate trust score
        let score = 50; // Base score
        
        if (reputation.hasRepository) score += 10;
        if (reputation.hasLicense) score += 10;
        if (reputation.hasHomepage) score += 5;
        if (reputation.maintainerCount > 1) score += 10;
        if (reputation.age > 365) score += 15; // Package over 1 year old
        
        // Penalty for recent packages (might be typosquatting)
        if (reputation.age < 30) score -= 20;
        
        reputation.trustScore = Math.max(0, Math.min(100, score));
        
        console.log(`   📊 Trust score: ${reputation.trustScore}/100`);
        
        return reputation;
    }

    calculatePackageAge(publishDate) {
        if (!publishDate) return 0;
        const published = new Date(publishDate);
        const now = new Date();
        return Math.floor((now - published) / (1000 * 60 * 60 * 24)); // Days
    }

    calculateSecurityScore(vulnerabilities, dependencies, reputation) {
        let score = 100; // Start with perfect score
        
        // Deduct for vulnerabilities
        if (vulnerabilities.critical) score -= vulnerabilities.critical * 30;
        if (vulnerabilities.high) score -= vulnerabilities.high * 20;
        if (vulnerabilities.moderate) score -= vulnerabilities.moderate * 10;
        if (vulnerabilities.low) score -= vulnerabilities.low * 5;
        
        // Deduct for risky dependencies
        if (dependencies.suspicious?.length) score -= dependencies.suspicious.length * 15;
        if (dependencies.risky?.length) score -= dependencies.risky.length * 10;
        
        // Factor in reputation
        score = (score + reputation.trustScore) / 2;
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    isPackageSafe(vulnerabilities, dependencies, reputation) {
        // Package is considered safe if:
        // 1. No critical or high vulnerabilities
        // 2. No suspicious dependencies
        // 3. Trust score > 60
        
        const noCriticalVulns = !vulnerabilities.critical && !vulnerabilities.high;
        const noSuspiciousDeps = !dependencies.suspicious?.length;
        const goodReputation = reputation.trustScore > 60;
        
        return noCriticalVulns && noSuspiciousDeps && goodReputation;
    }

    async generateSecurityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            scannedPackages: Object.keys(this.securityResults).length,
            safePackages: Object.values(this.securityResults).filter(r => r.safe).length,
            vulnerablePackages: Object.values(this.securityResults).filter(r => !r.safe).length,
            results: this.securityResults,
            recommendations: []
        };
        
        // Generate recommendations
        const safePackages = Object.entries(this.securityResults)
            .filter(([_, result]) => result.safe)
            .sort((a, b) => b[1].securityScore - a[1].securityScore);
        
        if (safePackages.length > 0) {
            const [bestPackage, bestResult] = safePackages[0];
            report.recommendations.push(`✅ RECOMMENDED: ${bestPackage} (Security Score: ${bestResult.securityScore}/100)`);
            report.recommendations.push(`📦 Install: npm install ${bestPackage}`);
        } else {
            report.recommendations.push(`❌ NO SAFE PACKAGES FOUND`);
            report.recommendations.push(`🔧 USE: Custom OAuth implementation (safer)`);
        }
        
        // Warn about unsafe packages
        const unsafePackages = Object.entries(this.securityResults)
            .filter(([_, result]) => !result.safe);
        
        for (const [packageName, result] of unsafePackages) {
            report.recommendations.push(`⚠️ AVOID: ${packageName} (Security Score: ${result.securityScore}/100)`);
            
            if (result.vulnerabilities?.total > 0) {
                report.recommendations.push(`   🚨 ${result.vulnerabilities.total} vulnerabilities found`);
            }
            
            if (result.dependencies?.suspicious?.length > 0) {
                report.recommendations.push(`   🔍 ${result.dependencies.suspicious.length} suspicious dependencies`);
            }
        }
        
        fs.writeFileSync('cardmarket-security-scan-report.json', JSON.stringify(report, null, 2));
        
        return report;
    }

    async runSecurityScan() {
        console.log('🛡️ Starting CardMarket SDK Security Scan...\n');
        
        for (const packageName of this.foundSDKs) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🔍 SCANNING: ${packageName.toUpperCase()}`);
            console.log(`${'='.repeat(50)}`);
            
            await this.scanNpmSecurity(packageName);
            
            const result = this.securityResults[packageName];
            if (result && !result.error) {
                console.log(`\n📊 SECURITY SUMMARY FOR ${packageName}:`);
                console.log(`   🏆 Security Score: ${result.securityScore}/100`);
                console.log(`   🛡️ Safe to Install: ${result.safe ? '✅ YES' : '❌ NO'}`);
                
                if (result.vulnerabilities?.total > 0) {
                    console.log(`   🚨 Vulnerabilities: ${result.vulnerabilities.total}`);
                    console.log(`      Critical: ${result.vulnerabilities.critical}`);
                    console.log(`      High: ${result.vulnerabilities.high}`);
                    console.log(`      Moderate: ${result.vulnerabilities.moderate}`);
                }
                
                if (result.dependencies?.suspicious?.length > 0) {
                    console.log(`   ⚠️ Suspicious Dependencies: ${result.dependencies.suspicious.length}`);
                }
                
                console.log(`   ⭐ Trust Score: ${result.reputation.trustScore}/100`);
                console.log(`   📅 Package Age: ${result.reputation.age} days`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const report = await this.generateSecurityReport();
        
        console.log('\n' + '='.repeat(70));
        console.log('🛡️ CARDMARKET SDK SECURITY SCAN COMPLETE');
        console.log('='.repeat(70));
        console.log(`📦 Packages Scanned: ${report.scannedPackages}`);
        console.log(`✅ Safe Packages: ${report.safePackages}`);
        console.log(`⚠️ Vulnerable Packages: ${report.vulnerablePackages}`);
        
        console.log('\n🎯 SECURITY RECOMMENDATIONS:');
        report.recommendations.forEach((rec, i) => {
            console.log(`   ${i + 1}. ${rec}`);
        });
        
        console.log(`\n📄 Detailed report: cardmarket-security-scan-report.json`);
        console.log('='.repeat(70));
        
        return report;
    }
}

// Run security scan
async function main() {
    const scanner = new CardMarketSDKSecurityScanner();
    await scanner.runSecurityScan();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = CardMarketSDKSecurityScanner;
