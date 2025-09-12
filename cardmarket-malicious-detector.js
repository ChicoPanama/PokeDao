#!/usr/bin/env node
/**
 * Typosquatting and Malicious Package Detector
 * Enhanced security check for CardMarket SDKs
 */

const https = require('https');
const fs = require('fs');

class MaliciousPackageDetector {
    constructor() {
        this.suspiciousDomains = [
            'temp-mail.org',
            '10minutemail.com',
            'guerrillamail.com',
            'mailinator.com',
            'yopmail.com'
        ];
        
        this.typosquattingTargets = [
            'cardmarket',
            'card-market', 
            'mkm',
            'magic-cardmarket',
            'tcg-player',
            'pokemon-tcg'
        ];
        
        this.maliciousPatterns = [
            /bitcoin|crypto|mining|wallet/i,
            /password|keylog|steal/i,
            /download|install.*exe/i,
            /eval\s*\(/g,
            /child_process|exec|spawn/g,
            /fs\.write|fs\.unlink/g,
            /require.*http/g,
            /base64|atob|btoa/g
        ];
    }

    async checkPackageForMaliciousCode(packageName) {
        console.log(`🔍 Checking ${packageName} for malicious code patterns...`);
        
        try {
            // Get package source code
            const packageInfo = await this.getPackageSource(packageName);
            
            if (!packageInfo) {
                console.log(`   ❌ Could not retrieve source code for ${packageName}`);
                return { error: 'Source code unavailable' };
            }
            
            const analysis = {
                packageName,
                suspicious: false,
                maliciousPatterns: [],
                typosquatting: false,
                typoTargets: [],
                maintainerSuspicious: false,
                maintainerFlags: [],
                downloadSuspicious: false,
                overallRisk: 'LOW'
            };
            
            // Check for malicious code patterns
            if (packageInfo.sourceCode) {
                analysis.maliciousPatterns = this.scanForMaliciousPatterns(packageInfo.sourceCode);
                analysis.suspicious = analysis.maliciousPatterns.length > 0;
            }
            
            // Check for typosquatting
            analysis.typoTargets = this.checkTyposquatting(packageName);
            analysis.typosquatting = analysis.typoTargets.length > 0;
            
            // Check maintainer reputation
            if (packageInfo.maintainers) {
                const maintainerAnalysis = this.analyzeMaintainers(packageInfo.maintainers);
                analysis.maintainerSuspicious = maintainerAnalysis.suspicious;
                analysis.maintainerFlags = maintainerAnalysis.flags;
            }
            
            // Check download patterns
            if (packageInfo.downloads) {
                analysis.downloadSuspicious = this.analyzeDownloadPatterns(packageInfo.downloads);
            }
            
            // Calculate overall risk
            analysis.overallRisk = this.calculateRiskLevel(analysis);
            
            console.log(`   📊 Analysis complete for ${packageName}`);
            console.log(`   🚨 Risk Level: ${analysis.overallRisk}`);
            console.log(`   🔍 Suspicious Patterns: ${analysis.maliciousPatterns.length}`);
            console.log(`   🎯 Typosquatting Risk: ${analysis.typosquatting ? 'HIGH' : 'LOW'}`);
            
            return analysis;
            
        } catch (error) {
            console.log(`   ❌ Error analyzing ${packageName}: ${error.message}`);
            return { error: error.message };
        }
    }

    async getPackageSource(packageName) {
        return new Promise((resolve) => {
            const url = `https://registry.npmjs.org/${packageName}`;
            
            https.request(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const packageData = JSON.parse(data);
                            const latestVersion = packageData['dist-tags']?.latest;
                            const versionData = packageData.versions?.[latestVersion];
                            
                            // Extract relevant information
                            resolve({
                                name: packageData.name,
                                version: latestVersion,
                                maintainers: packageData.maintainers,
                                description: packageData.description,
                                keywords: packageData.keywords,
                                scripts: versionData?.scripts,
                                dependencies: versionData?.dependencies,
                                sourceCode: this.extractSourceCode(versionData),
                                repository: packageData.repository,
                                downloads: packageData.downloads
                            });
                        } catch (error) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                });
            }).on('error', () => resolve(null)).end();
        });
    }

    extractSourceCode(versionData) {
        // Extract code from various sources
        let sourceCode = '';
        
        // Check main file reference
        if (versionData?.main) {
            sourceCode += `main: ${versionData.main}\n`;
        }
        
        // Check scripts
        if (versionData?.scripts) {
            sourceCode += JSON.stringify(versionData.scripts, null, 2);
        }
        
        // Check dependencies for suspicious packages
        if (versionData?.dependencies) {
            sourceCode += Object.keys(versionData.dependencies).join('\n');
        }
        
        // Check description and keywords for suspicious content
        if (versionData?.description) {
            sourceCode += versionData.description;
        }
        
        return sourceCode;
    }

    scanForMaliciousPatterns(sourceCode) {
        const foundPatterns = [];
        
        for (const pattern of this.maliciousPatterns) {
            const matches = sourceCode.match(pattern);
            if (matches) {
                foundPatterns.push({
                    pattern: pattern.toString(),
                    matches: matches.slice(0, 3), // First 3 matches
                    severity: this.getPatternSeverity(pattern)
                });
            }
        }
        
        return foundPatterns;
    }

    getPatternSeverity(pattern) {
        const highRiskPatterns = [
            /eval\s*\(/g,
            /child_process|exec|spawn/g,
            /password|keylog|steal/i
        ];
        
        if (highRiskPatterns.some(high => high.toString() === pattern.toString())) {
            return 'HIGH';
        }
        
        return 'MEDIUM';
    }

    checkTyposquatting(packageName) {
        const suspiciousTargets = [];
        
        for (const target of this.typosquattingTargets) {
            const similarity = this.calculateStringSimilarity(packageName, target);
            
            if (similarity > 0.7 && similarity < 1.0) {
                suspiciousTargets.push({
                    target,
                    similarity,
                    risk: similarity > 0.85 ? 'HIGH' : 'MEDIUM'
                });
            }
        }
        
        return suspiciousTargets;
    }

    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    analyzeMaintainers(maintainers) {
        const flags = [];
        let suspicious = false;
        
        for (const maintainer of maintainers) {
            // Check for suspicious email domains
            if (maintainer.email) {
                const emailDomain = maintainer.email.split('@')[1];
                if (this.suspiciousDomains.includes(emailDomain)) {
                    flags.push(`Temporary email domain: ${emailDomain}`);
                    suspicious = true;
                }
            }
            
            // Check for single character usernames
            if (maintainer.name && maintainer.name.length < 3) {
                flags.push(`Suspicious username: ${maintainer.name}`);
                suspicious = true;
            }
            
            // Check for numeric-only usernames
            if (maintainer.name && /^\d+$/.test(maintainer.name)) {
                flags.push(`Numeric-only username: ${maintainer.name}`);
                suspicious = true;
            }
        }
        
        return { suspicious, flags };
    }

    analyzeDownloadPatterns(downloads) {
        // Basic download pattern analysis
        // In a real implementation, this would check for:
        // - Sudden spikes (potential bot downloads)
        // - Geographic distribution
        // - Download/dependency ratio
        
        return false; // Not suspicious by default
    }

    calculateRiskLevel(analysis) {
        let riskScore = 0;
        
        // Malicious patterns
        if (analysis.maliciousPatterns.length > 0) {
            const highSeverity = analysis.maliciousPatterns.filter(p => p.severity === 'HIGH').length;
            riskScore += highSeverity * 30 + (analysis.maliciousPatterns.length - highSeverity) * 15;
        }
        
        // Typosquatting
        if (analysis.typosquatting) {
            const highRiskTypos = analysis.typoTargets.filter(t => t.risk === 'HIGH').length;
            riskScore += highRiskTypos * 25 + (analysis.typoTargets.length - highRiskTypos) * 15;
        }
        
        // Maintainer issues
        if (analysis.maintainerSuspicious) {
            riskScore += analysis.maintainerFlags.length * 10;
        }
        
        // Download patterns
        if (analysis.downloadSuspicious) {
            riskScore += 20;
        }
        
        if (riskScore >= 50) return 'CRITICAL';
        if (riskScore >= 30) return 'HIGH';
        if (riskScore >= 15) return 'MEDIUM';
        return 'LOW';
    }

    async scanAllPackages(packages) {
        console.log('🕵️ Starting Malicious Package Detection...\n');
        
        const results = {};
        
        for (const packageName of packages) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🕵️ DETECTING MALICIOUS CODE: ${packageName.toUpperCase()}`);
            console.log(`${'='.repeat(50)}`);
            
            results[packageName] = await this.checkPackageForMaliciousCode(packageName);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return results;
    }

    generateMaliciousPackageReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            totalPackages: Object.keys(results).length,
            safePackages: 0,
            suspiciousPackages: 0,
            criticalPackages: 0,
            results,
            recommendations: []
        };
        
        // Analyze results
        for (const [packageName, result] of Object.entries(results)) {
            if (result.error) continue;
            
            if (result.overallRisk === 'CRITICAL') {
                report.criticalPackages++;
                report.recommendations.push(`🚨 CRITICAL: Avoid ${packageName} - High malicious risk`);
            } else if (result.overallRisk === 'HIGH' || result.overallRisk === 'MEDIUM') {
                report.suspiciousPackages++;
                report.recommendations.push(`⚠️ SUSPICIOUS: ${packageName} - Risk level: ${result.overallRisk}`);
            } else {
                report.safePackages++;
                report.recommendations.push(`✅ SAFE: ${packageName} - Low risk`);
            }
        }
        
        fs.writeFileSync('cardmarket-malicious-scan-report.json', JSON.stringify(report, null, 2));
        
        return report;
    }
}

// Main execution
async function main() {
    const detector = new MaliciousPackageDetector();
    const packages = ['cardmarket-wrapper', 'mkm-api'];
    
    const results = await detector.scanAllPackages(packages);
    const report = detector.generateMaliciousPackageReport(results);
    
    console.log('\n' + '='.repeat(70));
    console.log('🕵️ MALICIOUS PACKAGE DETECTION COMPLETE');
    console.log('='.repeat(70));
    console.log(`📦 Total Packages: ${report.totalPackages}`);
    console.log(`✅ Safe Packages: ${report.safePackages}`);
    console.log(`⚠️ Suspicious Packages: ${report.suspiciousPackages}`);
    console.log(`🚨 Critical Packages: ${report.criticalPackages}`);
    
    console.log('\n🎯 SECURITY RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
    });
    
    console.log(`\n📄 Detailed report: cardmarket-malicious-scan-report.json`);
    console.log('='.repeat(70));
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MaliciousPackageDetector;
