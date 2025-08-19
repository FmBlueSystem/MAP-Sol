#!/usr/bin/env node

/**
 * @fileoverview Lighthouse Performance Runner
 * @module run-lighthouse
 * @description Automated Lighthouse performance analysis for Music Analyzer Pro
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');
const config = require('./lighthouse-config');

/**
 * Run Lighthouse analysis
 * @async
 * @param {string} url - URL to analyze
 * @param {Object} [options={}] - Lighthouse options
 * @returns {Promise<Object>} Lighthouse results
 */
async function runLighthouse(url, options = {}) {
    let chrome = null;
    
    try {
        // Launch Chrome
        chrome = await chromeLauncher.launch({
            chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
        });
        
        const opts = {
            logLevel: 'info',
            output: 'html',
            port: chrome.port,
            ...options
        };
        
        // Run Lighthouse
        const runnerResult = await lighthouse(url, opts, config);
        
        return runnerResult;
    } finally {
        if (chrome) {
            await chrome.kill();
        }
    }
}

/**
 * Analyze performance results
 * @param {Object} results - Lighthouse results
 * @returns {Object} Performance analysis
 */
function analyzeResults(results) {
    const { categories, audits } = results.lhr;
    
    const analysis = {
        scores: {},
        metrics: {},
        opportunities: [],
        diagnostics: [],
        passed: [],
        failed: []
    };
    
    // Extract scores
    for (const [key, category] of Object.entries(categories)) {
        analysis.scores[key] = {
            score: Math.round(category.score * 100),
            title: category.title
        };
    }
    
    // Extract key metrics
    const metricAudits = [
        'first-contentful-paint',
        'largest-contentful-paint',
        'total-blocking-time',
        'cumulative-layout-shift',
        'speed-index',
        'interactive'
    ];
    
    for (const metric of metricAudits) {
        if (audits[metric]) {
            analysis.metrics[metric] = {
                value: audits[metric].numericValue,
                displayValue: audits[metric].displayValue,
                score: audits[metric].score
            };
        }
    }
    
    // Extract opportunities and diagnostics
    for (const [key, audit] of Object.entries(audits)) {
        if (audit.details && audit.details.type === 'opportunity') {
            analysis.opportunities.push({
                id: key,
                title: audit.title,
                description: audit.description,
                savings: audit.details.overallSavingsMs
            });
        }
        
        if (audit.score !== null) {
            if (audit.score >= 0.9) {
                analysis.passed.push(audit.title);
            } else if (audit.score < 0.5) {
                analysis.failed.push({
                    title: audit.title,
                    description: audit.description,
                    score: audit.score
                });
            }
        }
    }
    
    // Sort opportunities by savings
    analysis.opportunities.sort((a, b) => (b.savings || 0) - (a.savings || 0));
    
    return analysis;
}

/**
 * Generate performance report
 * @param {Object} analysis - Performance analysis
 * @returns {string} Markdown report
 */
function generateReport(analysis) {
    const timestamp = new Date().toISOString();
    
    let report = `# 📊 Lighthouse Performance Report\n\n`;
    report += `**Generated**: ${timestamp}\n`;
    report += `**URL**: file://${path.resolve('index-production.html')}\n\n`;
    
    // Scores
    report += `## 🎯 Scores\n\n`;
    for (const [key, data] of Object.entries(analysis.scores)) {
        const emoji = data.score >= 80 ? '✅' : data.score >= 50 ? '⚠️' : '❌';
        report += `- ${emoji} **${data.title}**: ${data.score}/100\n`;
    }
    
    // Key Metrics
    report += `\n## ⚡ Key Metrics\n\n`;
    report += `| Metric | Value | Score |\n`;
    report += `|--------|-------|-------|\n`;
    
    for (const [key, data] of Object.entries(analysis.metrics)) {
        const score = Math.round((data.score || 0) * 100);
        const emoji = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '❌';
        report += `| ${key.replace(/-/g, ' ')} | ${data.displayValue || data.value} | ${emoji} ${score} |\n`;
    }
    
    // Opportunities
    if (analysis.opportunities.length > 0) {
        report += `\n## 💡 Optimization Opportunities\n\n`;
        
        for (const opportunity of analysis.opportunities.slice(0, 10)) {
            const savings = opportunity.savings ? `(~${Math.round(opportunity.savings)}ms)` : '';
            report += `1. **${opportunity.title}** ${savings}\n`;
            report += `   ${opportunity.description}\n\n`;
        }
    }
    
    // Failed audits
    if (analysis.failed.length > 0) {
        report += `\n## ❌ Failed Audits\n\n`;
        
        for (const fail of analysis.failed.slice(0, 10)) {
            report += `- **${fail.title}** (Score: ${Math.round(fail.score * 100)})\n`;
            report += `  ${fail.description}\n\n`;
        }
    }
    
    // Summary
    const avgScore = Object.values(analysis.scores)
        .reduce((sum, s) => sum + s.score, 0) / Object.keys(analysis.scores).length;
    
    report += `\n## 📈 Summary\n\n`;
    report += `- **Average Score**: ${Math.round(avgScore)}/100\n`;
    report += `- **Passed Audits**: ${analysis.passed.length}\n`;
    report += `- **Failed Audits**: ${analysis.failed.length}\n`;
    report += `- **Opportunities Found**: ${analysis.opportunities.length}\n`;
    
    // Recommendations
    report += `\n## 🎯 Recommendations\n\n`;
    
    if (avgScore < 80) {
        report += `### Priority Actions:\n\n`;
        
        if (analysis.metrics['largest-contentful-paint']?.score < 0.5) {
            report += `1. **Optimize Largest Contentful Paint**\n`;
            report += `   - Implement lazy loading for images\n`;
            report += `   - Use WebP format for images\n`;
            report += `   - Preload critical resources\n\n`;
        }
        
        if (analysis.metrics['total-blocking-time']?.score < 0.5) {
            report += `2. **Reduce Total Blocking Time**\n`;
            report += `   - Split large JavaScript bundles\n`;
            report += `   - Defer non-critical scripts\n`;
            report += `   - Use Web Workers for heavy computations\n\n`;
        }
        
        if (analysis.metrics['cumulative-layout-shift']?.score < 0.5) {
            report += `3. **Fix Layout Shifts**\n`;
            report += `   - Add size attributes to images\n`;
            report += `   - Reserve space for dynamic content\n`;
            report += `   - Avoid inserting content above existing content\n\n`;
        }
    } else {
        report += `✅ **Performance is Good!** (Score: ${Math.round(avgScore)}/100)\n\n`;
        report += `Continue monitoring and optimizing:\n`;
        report += `- Keep bundle sizes small\n`;
        report += `- Monitor third-party scripts\n`;
        report += `- Regular performance audits\n`;
    }
    
    return report;
}

/**
 * Save results to files
 * @param {Object} results - Lighthouse results
 * @param {Object} analysis - Performance analysis
 * @param {string} report - Markdown report
 * @returns {void}
 */
function saveResults(results, analysis, report) {
    const timestamp = Date.now();
    const outputDir = path.join(__dirname, 'lighthouse-reports');
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    
    // Save HTML report
    const htmlPath = path.join(outputDir, `report-${timestamp}.html`);
    fs.writeFileSync(htmlPath, results.report);
    console.log(`✅ HTML report saved: ${htmlPath}`);
    
    // Save JSON data
    const jsonPath = path.join(outputDir, `data-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
    console.log(`✅ JSON data saved: ${jsonPath}`);
    
    // Save Markdown report
    const mdPath = path.join(outputDir, `analysis-${timestamp}.md`);
    fs.writeFileSync(mdPath, report);
    console.log(`✅ Markdown report saved: ${mdPath}`);
    
    // Update latest report symlink
    const latestPath = path.join(outputDir, 'latest-report.md');
    fs.writeFileSync(latestPath, report);
    console.log(`✅ Latest report updated: ${latestPath}`);
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Starting Lighthouse Performance Analysis...\n');
    
    try {
        // Build URL
        const url = process.argv[2] || `file://${path.resolve('index-production.html')}`;
        console.log(`📍 Analyzing: ${url}\n`);
        
        // Run Lighthouse
        console.log('🔍 Running Lighthouse tests...');
        const results = await runLighthouse(url);
        
        // Analyze results
        console.log('📊 Analyzing results...');
        const analysis = analyzeResults(results);
        
        // Generate report
        console.log('📝 Generating report...');
        const report = generateReport(analysis);
        
        // Save results
        console.log('💾 Saving results...\n');
        saveResults(results, analysis, report);
        
        // Print summary
        console.log('=' .repeat(50));
        console.log('📈 PERFORMANCE SUMMARY');
        console.log('=' .repeat(50));
        
        for (const [key, data] of Object.entries(analysis.scores)) {
            const emoji = data.score >= 80 ? '✅' : data.score >= 50 ? '⚠️' : '❌';
            console.log(`${emoji} ${data.title}: ${data.score}/100`);
        }
        
        console.log('=' .repeat(50));
        
        // Exit with appropriate code
        const avgScore = Object.values(analysis.scores)
            .reduce((sum, s) => sum + s.score, 0) / Object.keys(analysis.scores).length;
        
        if (avgScore >= 80) {
            console.log('\n✅ Performance PASSED! Average score:', Math.round(avgScore));
            process.exit(0);
        } else {
            console.log('\n⚠️ Performance needs improvement. Average score:', Math.round(avgScore));
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Error running Lighthouse:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { runLighthouse, analyzeResults, generateReport };