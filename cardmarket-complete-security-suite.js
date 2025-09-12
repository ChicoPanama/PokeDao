#!/usr/bin/env node
/**
 * Complete CardMarket SDK Security Suite
 * Runs all security checks before installation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CardMarketSecuritySuite {
    constructor() {
        this.targetSDKs = ['cardmarket-wrapper', 'mkm-api'];
        this.securityChecks = [
            'cardmarket-security-scanner.js',
            'cardmarket-malicious-detector.js'
        ];
        this.results = {};
    }

    async runAllSecurityChecks() {
        console.log('🛡️ CARDMARKET SDK COMPREHENSIVE SECURITY SUITE');
        console.log('='.repeat(70));
        console.log(`📦 Packages to analyze: ${this.targetSDKs.join(', ')}`);
        console.log(`🔍 Security checks: ${this.securityChecks.length}`);
        console.log('='.repeat(70));

        const overallResults = {
            timestamp: new Date().toISOString(),
            packages: this.targetSDKs,
            checksPerformed: [],
            overallSafety: {},
            recommendations: [],
            installationAdvice: ''
        };

        // Run each security check
        for (const [index, checkScript] of this.securityChecks.entries()) {
            console.log(`\n[${'█'.repeat(index + 1)}${'░'.repeat(this.securityChecks.length - index - 1)}] Running ${checkScript}...`);
            
            try {
                const checkResult = await this.runSecurityCheck(checkScript);
                overallResults.checksPerformed.push({
                    script: checkScript,
                    success: true,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`✅ ${checkScript} completed successfully`);
                
            } catch (error) {
                console.log(`❌ ${checkScript} failed: ${error.message}`);
                overallResults.checksPerformed.push({
                    script: checkScript,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Analyze all results
        console.log('\n🔍 Analyzing security scan results...');
        overallResults.overallSafety = this.analyzeOverallSafety();
        overallResults.recommendations = this.generateFinalRecommendations(overallResults.overallSafety);
        overallResults.installationAdvice = this.generateInstallationAdvice(overallResults.overallSafety);

        // Generate final report
        const finalReport = this.generateFinalSecurityReport(overallResults);
        
        // Display final results
        this.displayFinalResults(finalReport);
        
        return finalReport;
    }

    async runSecurityCheck(scriptName) {
        const scriptPath = path.join(process.cwd(), scriptName);
        
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Security script not found: ${scriptPath}`);
        }
        
        try {
            execSync(`node ${scriptName}`, { 
                stdio: 'inherit',
                cwd: process.cwd(),
                timeout: 60000 // 1 minute timeout
            });
            return true;
        } catch (error) {
            throw new Error(`Script execution failed: ${error.message}`);
        }
    }

    analyzeOverallSafety() {
        const safety = {};
        
        // Analyze vulnerability scan results
        if (fs.existsSync('cardmarket-security-scan-report.json')) {
            const vulnReport = JSON.parse(fs.readFileSync('cardmarket-security-scan-report.json', 'utf8'));
            
            for (const [packageName, result] of Object.entries(vulnReport.results)) {
                if (!safety[packageName]) safety[packageName] = {};
                
                safety[packageName].vulnerabilities = {
                    safe: result.safe,
                    score: result.securityScore,
                    criticalVulns: result.vulnerabilities?.critical || 0,
                    highVulns: result.vulnerabilities?.high || 0,
                    trustScore: result.reputation?.trustScore || 0
                };
            }
        }
        
        // Analyze malicious code scan results
        if (fs.existsSync('cardmarket-malicious-scan-report.json')) {
            const maliciousReport = JSON.parse(fs.readFileSync('cardmarket-malicious-scan-report.json', 'utf8'));
            
            for (const [packageName, result] of Object.entries(maliciousReport.results)) {
                if (!safety[packageName]) safety[packageName] = {};
                
                safety[packageName].malicious = {
                    riskLevel: result.overallRisk,
                    maliciousPatterns: result.maliciousPatterns?.length || 0,
                    typosquatting: result.typosquatting || false,
                    maintainerSuspicious: result.maintainerSuspicious || false
                };
            }
        }
        
        // Calculate overall safety for each package
        for (const packageName of this.targetSDKs) {
            if (safety[packageName]) {
                safety[packageName].overallSafe = this.calculateOverallSafety(safety[packageName]);
                safety[packageName].riskLevel = this.calculateRiskLevel(safety[packageName]);
            }
        }
        
        return safety;
    }

    calculateOverallSafety(packageSafety) {
        // Package is safe if:
        // 1. No critical vulnerabilities
        // 2. Security score > 60
        // 3. Low malicious risk
        // 4. No typosquatting
        // 5. Trustworthy maintainers
        
        const vulnSafe = packageSafety.vulnerabilities?.safe && 
                         packageSafety.vulnerabilities?.criticalVulns === 0 &&
                         packageSafety.vulnerabilities?.highVulns === 0;
        
        const maliciousSafe = packageSafety.malicious?.riskLevel === 'LOW' &&
                             !packageSafety.malicious?.typosquatting &&
                             !packageSafety.malicious?.maintainerSuspicious;
        
        const trustworthy = packageSafety.vulnerabilities?.trustScore > 60;
        
        return vulnSafe && maliciousSafe && trustworthy;
    }

    calculateRiskLevel(packageSafety) {
        let riskScore = 0;
        
        // Vulnerability risk
        const vulns = packageSafety.vulnerabilities;
        if (vulns) {
            riskScore += (vulns.criticalVulns || 0) * 30;
            riskScore += (vulns.highVulns || 0) * 20;
            riskScore += vulns.score < 60 ? 15 : 0;
            riskScore += vulns.trustScore < 60 ? 10 : 0;
        }
        
        // Malicious code risk
        const malicious = packageSafety.malicious;
        if (malicious) {
            if (malicious.riskLevel === 'CRITICAL') riskScore += 40;
            else if (malicious.riskLevel === 'HIGH') riskScore += 25;
            else if (malicious.riskLevel === 'MEDIUM') riskScore += 15;
            
            riskScore += malicious.typosquatting ? 20 : 0;
            riskScore += malicious.maintainerSuspicious ? 15 : 0;
            riskScore += (malicious.maliciousPatterns || 0) * 10;
        }
        
        if (riskScore >= 60) return 'CRITICAL';
        if (riskScore >= 40) return 'HIGH';
        if (riskScore >= 20) return 'MEDIUM';
        return 'LOW';
    }

    generateFinalRecommendations(overallSafety) {
        const recommendations = [];
        const safePackages = [];
        const unsafePackages = [];
        
        for (const [packageName, safety] of Object.entries(overallSafety)) {
            if (safety.overallSafe) {
                safePackages.push({ name: packageName, ...safety });
            } else {
                unsafePackages.push({ name: packageName, ...safety });
            }
        }
        
        if (safePackages.length > 0) {
            // Sort by security score
            safePackages.sort((a, b) => {
                const scoreA = a.vulnerabilities?.score || 0;
                const scoreB = b.vulnerabilities?.score || 0;
                return scoreB - scoreA;
            });
            
            const bestPackage = safePackages[0];
            recommendations.push(`✅ RECOMMENDED: ${bestPackage.name}`);
            recommendations.push(`   🏆 Security Score: ${bestPackage.vulnerabilities?.score || 'N/A'}/100`);
            recommendations.push(`   🛡️ Risk Level: ${bestPackage.riskLevel}`);
            recommendations.push(`   📦 Safe to install: npm install ${bestPackage.name}`);
        }
        
        if (unsafePackages.length > 0) {
            recommendations.push(`\n⚠️ PACKAGES TO AVOID:`);
            
            for (const pkg of unsafePackages) {
                recommendations.push(`   ❌ ${pkg.name} - Risk: ${pkg.riskLevel}`);
                
                if (pkg.vulnerabilities?.criticalVulns > 0) {
                    recommendations.push(`      🚨 ${pkg.vulnerabilities.criticalVulns} critical vulnerabilities`);
                }
                
                if (pkg.malicious?.typosquatting) {
                    recommendations.push(`      🎯 Potential typosquatting`);
                }
                
                if (pkg.malicious?.maliciousPatterns > 0) {
                    recommendations.push(`      🔍 ${pkg.malicious.maliciousPatterns} suspicious code patterns`);
                }
            }
        }
        
        if (safePackages.length === 0 && unsafePackages.length > 0) {
            recommendations.push(`\n🔧 ALTERNATIVE APPROACH:`);
            recommendations.push(`   ⚡ Build custom OAuth implementation`);
            recommendations.push(`   🛡️ Use CardMarket official documentation`);
            recommendations.push(`   🔐 Implement secure API client from scratch`);
        }
        
        return recommendations;
    }

    generateInstallationAdvice(overallSafety) {
        const safePackages = Object.entries(overallSafety).filter(([_, safety]) => safety.overallSafe);
        
        if (safePackages.length > 0) {
            const bestPackage = safePackages.reduce((best, current) => {
                const currentScore = current[1].vulnerabilities?.score || 0;
                const bestScore = best[1].vulnerabilities?.score || 0;
                return currentScore > bestScore ? current : best;
            });
            
            return `PROCEED: Install ${bestPackage[0]} - All security checks passed`;
        } else {
            return `STOP: No packages passed security verification - Build custom implementation`;
        }
    }

    generateFinalSecurityReport(overallResults) {
        const report = {
            ...overallResults,
            summary: {
                totalPackagesScanned: this.targetSDKs.length,
                securityChecksRun: overallResults.checksPerformed.filter(c => c.success).length,
                failedChecks: overallResults.checksPerformed.filter(c => !c.success).length,
                safePackages: Object.values(overallResults.overallSafety).filter(s => s.overallSafe).length,
                unsafePackages: Object.values(overallResults.overallSafety).filter(s => !s.overallSafe).length
            }
        };
        
        fs.writeFileSync('cardmarket-final-security-report.json', JSON.stringify(report, null, 2));
        
        return report;
    }

    displayFinalResults(report) {
        console.log('\n' + '='.repeat(80));
        console.log('🛡️ CARDMARKET SDK SECURITY SUITE - FINAL RESULTS');
        console.log('='.repeat(80));
        
        console.log(`📊 SCAN SUMMARY:`);
        console.log(`   📦 Packages Scanned: ${report.summary.totalPackagesScanned}`);
        console.log(`   🔍 Security Checks: ${report.summary.securityChecksRun}/${this.securityChecks.length}`);
        console.log(`   ✅ Safe Packages: ${report.summary.safePackages}`);
        console.log(`   ⚠️ Unsafe Packages: ${report.summary.unsafePackages}`);
        
        console.log(`\n📋 PACKAGE ANALYSIS:`);
        for (const [packageName, safety] of Object.entries(report.overallSafety)) {
            const status = safety.overallSafe ? '✅ SAFE' : '❌ UNSAFE';
            const vulnScore = safety.vulnerabilities?.score || 'N/A';
            const riskLevel = safety.riskLevel || 'UNKNOWN';
            
            console.log(`   ${status} ${packageName}`);
            console.log(`      🏆 Security Score: ${vulnScore}/100`);
            console.log(`      🚨 Risk Level: ${riskLevel}`);
            
            if (safety.vulnerabilities?.criticalVulns > 0) {
                console.log(`      🚨 Critical Vulnerabilities: ${safety.vulnerabilities.criticalVulns}`);
            }
            
            if (safety.malicious?.maliciousPatterns > 0) {
                console.log(`      🔍 Suspicious Patterns: ${safety.malicious.maliciousPatterns}`);
            }
        }
        
        console.log(`\n🎯 FINAL RECOMMENDATION:`);
        console.log(`   ${report.installationAdvice}`);
        
        console.log(`\n📄 Reports Generated:`);
        console.log(`   📊 cardmarket-security-scan-report.json`);
        console.log(`   🕵️ cardmarket-malicious-scan-report.json`);
        console.log(`   📋 cardmarket-final-security-report.json`);
        
        console.log('\n' + '='.repeat(80));
        
        // Show specific recommendations
        if (report.recommendations.length > 0) {
            console.log('🎯 DETAILED RECOMMENDATIONS:');
            report.recommendations.forEach((rec, i) => {
                console.log(`   ${rec}`);
            });
        }
        
        console.log('='.repeat(80));
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting CardMarket SDK Security Suite...\n');
    
    const suite = new CardMarketSecuritySuite();
    const report = await suite.runAllSecurityChecks();
    
    console.log('\n✅ Security suite completed!');
    console.log('📄 Check the generated reports for detailed analysis.');
    
    return report;
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Security suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = CardMarketSecuritySuite;
