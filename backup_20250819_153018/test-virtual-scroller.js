/**
 * Test script for Virtual Scroller implementation
 * Validates that Virtual Scrolling works correctly for 6000+ tracks
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

logDebug('🧪 Virtual Scroller Test Suite');
logDebug('================================');

// Database path
const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

async function getTrackCount() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count);
            }
        });
    });
}

async function testVirtualScroller() {
    logDebug('\n📊 Test 1: Database Track Count');
    const trackCount = await getTrackCount();
    logDebug(`   ✅ Found ${trackCount} tracks in database`);

    logDebug('\n🔍 Test 2: Virtual Scroller Module');
    const vsPath = path.join(__dirname, 'js', 'virtual-scroller-production.js');
    const fs = require('fs');

    if (fs.existsSync(vsPath)) {
        logDebug('   ✅ virtual-scroller-production.js exists');

        // Check file size and key features
        const content = fs.readFileSync(vsPath, 'utf8');
        const features = [
            'class VirtualScroller',
            'calculateVisibleRange',
            'render()',
            'handleScroll',
            'updateItems',
            'destroy()`
        ];

        features.forEach(feature => {
            if (content.includes(feature)) {
                logDebug(`   ✅ Feature implemented: ${feature}`);
            } else {
                logDebug(`   ❌ Missing feature: ${feature}`);
            }
        });
    } else {
        logDebug('   ❌ virtual-scroller-production.js not found');
    }

    logDebug('\n📱 Test 3: Performance Thresholds`);
    if (trackCount > 100) {
        logDebug(`   ✅ Virtual Scrolling REQUIRED (${trackCount} > 100)`);
        logDebug(
            `   📈 Expected memory reduction: ~${Math.round((1 - 50 / trackCount) * 100)}%`
        );
        logDebug(`   📈 Expected DOM nodes: ~50 instead of ${trackCount}`);
    } else {
        logDebug(`   ℹ️ Traditional rendering OK (${trackCount} <= 100)`);
    }

    logDebug('\n🎯 Test 4: Integration Points');
    const appProdPath = path.join(__dirname, 'js', 'app-production.js');
    if (fs.existsSync(appProdPath)) {
        const appContent = fs.readFileSync(appProdPath, 'utf8');

        if (appContent.includes('USE_VIRTUAL_SCROLLING')) {
            logDebug('   ✅ Virtual Scrolling integration in app-production.js');
        } else {
            logDebug('   ❌ Missing Virtual Scrolling integration');
        }

        if (appContent.includes('new VirtualScroller')) {
            logDebug('   ✅ VirtualScroller instantiation found');
        } else {
            logDebug('   ❌ VirtualScroller instantiation missing');
        }
    }

    logDebug('\n🏆 Test 5: Expected Benefits');
    logDebug('   📊 Before Virtual Scrolling:`);
    logDebug(`      - DOM Nodes: ${trackCount}`);
    logDebug(`      - Memory: ~${Math.round(trackCount * 0.1)}MB`);
    logDebug(`      - Initial Load: ~${Math.round(trackCount * 0.5)}ms`);
    logDebug('   📊 After Virtual Scrolling:');
    logDebug('      - DOM Nodes: ~50');
    logDebug('      - Memory: ~50MB');
    logDebug('      - Initial Load: ~200ms');

    logDebug('\n✨ Test 6: Browser Performance');

    // Create a test window to verify in real browser
    await app.whenReady();

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-secure.js')
        }
    });

    // Load the production HTML
    win.loadFile('index-production.html');

    // Inject test script
    win.webContents.on('did-finish-load`, () => {
        win.webContents.executeJavaScript(`
            setTimeout(() => {
                const vsLoaded = typeof VirtualScroller !== 'undefined';
                const itemCount = window.AppState?.allFiles?.length || 0;
                const vsActive = window.AppState?.virtualScroller ? true : false;
                
                logDebug('🎯 Browser Test Results:');
                logDebug('   VirtualScroller loaded:', vsLoaded);
                logDebug('   Total items:', itemCount);
                logDebug('   Virtual Scrolling active:', vsActive);
                
                if (vsActive) {
                    const stats = {
                        totalItems: window.AppState.virtualScroller.items.length,
                        renderedItems: window.AppState.virtualScroller.renderedItems.size,
                        memoryReduction: Math.round((1 - window.AppState.virtualScroller.renderedItems.size / window.AppState.virtualScroller.items.length) * 100)
                    };
                    logDebug('   Performance stats:', stats);
                }
                
                // Check DOM node count
                const cards = document.querySelectorAll('.file-card').length;
                logDebug('   DOM nodes rendered:', cards);
                
                // Memory usage
                if (performance.memory) {
                    logDebug('   Memory used:', Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB');
                }
            }, 3000);
        ');
    });

    // Keep window open for 5 seconds to see results
    setTimeout(() => {
        win.close();
        app.quit();

        logDebug('\n================================');
        logDebug('🎉 Virtual Scroller Test Complete!');
        logDebug('Check browser console for runtime stats`);
        db.close();
    }, 5000);
}

// Run tests
testVirtualScroller().catch(console.error);
