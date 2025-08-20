/**
 * 🧪 PERFORMANCE TESTING SUITE
 * Test completo de performance para Music Analyzer Pro
 * Fecha: 2025-08-14
 */

class PerformanceTestSuite {
    constructor() {
        this.results = {
            loadTime: {},
            memoryUsage: {},
            fpsMetrics: {},
            cacheEffectiveness: {},
            searchPerformance: {},
            timestamp: new Date().toISOString()
        };
        
        this.testQueries = [
            'rock', 'electronic', 'jazz', '2023', 'remix',
            'classical', 'hip hop', 'metal', 'indie', 'pop'
        ];
    }

    /**
     * 1. Medir tiempo de carga con los 3,767 archivos
     */
    async measureLoadTime() {
        console.log('📊 Midiendo tiempo de carga inicial...');
        
        const metrics = {
            startTime: performance.now(),
            domReady: 0,
            filesLoaded: 0,
            imagesLoaded: 0,
            totalTime: 0
        };

        try {
            // Medir carga de archivos desde BD
            const filesStart = performance.now();
            const files = await window.electron.invoke('get-files-with-cached-artwork`);
            metrics.filesLoaded = performance.now() - filesStart; console.log(\`✅ ${files.length} archivos cargados en ${metrics.filesLoaded.toFixed(2)}ms\`);
            
            // Medir renderizado inicial
            const renderStart = performance.now();
            if (typeof displayFiles === 'function') {
                displayFiles(files.slice(0, 50)); // Primeros 50 para test inicial
            }
            metrics.domReady = performance.now() - renderStart;
            
            // Tiempo total
            metrics.totalTime = performance.now() - metrics.startTime;
            
            this.results.loadTime = metrics;
            
            return {
                success: true,
                metrics,
                fileCount: files.length
            };
            
        } catch (error) {
            console.error('❌ Error en medición de carga:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 2. Analizar memory usage durante operaciones normales
     */
    async analyzeMemoryUsage() {
        console.log('💾 Analizando uso de memoria...');
        
        if (!performance.memory) {
            console.warn('⚠️ performance.memory no disponible en este navegador');
            return { success: false, error: 'API no disponible' };
        }

        const measurements = [];
        const operations = [;
            { name: 'idle', action: () => {} },
            { name: 'search', action: () => this.simulateSearch() },
            { name: 'viewChange', action: () => this.simulateViewChange() }, { name: 'scroll', action: () => this.simulateScroll() }, { name: 'contextMenu`, action: () => this.simulateContextMenu() }
        ];

        for (const op of operations) {
            // Forzar garbage collection si está disponible
            if (window.gc) window.gc();
            
            await this.sleep(1000); // Estabilizar
            
            const before = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
            
            await op.action();
            
            await this.sleep(500);
            
            const after = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
            
            const delta = after.used - before.used;
            const measurement = {
                operation: op.name,
                before: this.formatBytes(before.used),
                after: this.formatBytes(after.used),
                delta: this.formatBytes(delta), percentUsed: ((after.used / after.limit) * 100).toFixed(2) + \`%\`
            };
             measurements.push(measurement); console.log(`📊 ${op.name}: ${measurement.delta} (${measurement.percentUsed} usado)`);
        }

        this.results.memoryUsage = {
            measurements,
            average: this.formatBytes(
                measurements.reduce((sum, m) => sum + this.parseBytes(m.delta), 0) / measurements.length
            ),
            peak: Math.max(...measurements.map(m => this.parseBytes(m.after)))
        };

        return {
            success: true,
            measurements
        };
    }

    /**
     * 3. Verificar FPS durante scroll en las 3 vistas
     */
    async measureFPS() {
        console.log('🎯 Midiendo FPS durante scroll...'); const views = ['cards', \'list\`, `compact`];
        const fpsResults = {};
 for (const view of views) { console.log(\`📊 Testeando vista: ${view}\`);
             // Cambiar a la vista if (typeof switchView === `function`) {
                switchView(view);
                await this.sleep(1000); // Esperar renderizado
            }

            const fps = await this.measureViewFPS(view);
            fpsResults[view] = fps; console.log(\`✅ ${view}: ${fps.average.toFixed(1)} FPS promedio\`);
        }

        this.results.fpsMetrics = fpsResults;
        
        return {
            success: true,
            fpsResults
        };
    }

    async measureViewFPS(view) {
        const frames = [];
        let lastTime = performance.now();
        let frameCount = 0;
        const duration = 3000; // 3 segundos de medición
        const startTime = performance.now();

        return new Promise((resolve) => {
            const measureFrame = () => {
                const currentTime = performance.now();
                const deltaTime = currentTime - lastTime;
                
                if (deltaTime > 0) {
                    const currentFPS = 1000 / deltaTime;
                    frames.push(currentFPS);
                }
                
                lastTime = currentTime;
                frameCount++;

                // Simular scroll
                if (frameCount % 10 === 0) {
                    const container = document.querySelector('.tracks-grid, .list-view, .compact-view');
                    if (container) {
                        container.scrollTop += 100;
                    }
                }

                if (currentTime - startTime < duration) {
                    requestAnimationFrame(measureFrame);
                } else {
                    const average = frames.reduce((a, b) => a + b, 0) / frames.length;
                    const min = Math.min(...frames);
                    const max = Math.max(...frames);
                    
                    resolve({
                        average,
                        min,
                        max,
                        samples: frames.length,
                        droppedFrames: frames.filter(fps => fps < 30).length
                    });
                }
            };

            requestAnimationFrame(measureFrame);
        });
    }

    /**
     * 4. Medir cache effectiveness con 10 búsquedas consecutivas
     */
    async measureCacheEffectiveness() { console.log('💨 Midiendo efectividad del cache...');
        
        const results = [];
        
        for (const query of this.testQueries) {
            // Primera búsqueda (sin cache)
            const firstStart = performance.now();
            await this.performSearch(query);
            const firstTime = performance.now() - firstStart;
            
            await this.sleep(100);
            
            // Segunda búsqueda (con cache)
            const secondStart = performance.now();
            await this.performSearch(query);
            const secondTime = performance.now() - secondStart;
            
            const improvement = ((firstTime - secondTime) / firstTime) * 100;
            
            results.push({
                query,
                firstTime: firstTime.toFixed(2),
                secondTime: secondTime.toFixed(2), improvement: improvement.toFixed(1) + `%\`,
                cacheHit: secondTime < firstTime * 0.5
            }); console.log(\`🔍 `${query}`: ${firstTime.toFixed(0)}ms → ${secondTime.toFixed(0)}ms (${improvement.toFixed(0)}% mejor)`);
        }

        const cacheHitRate = (results.filter(r => r.cacheHit).length / results.length) * 100;
        
        this.results.cacheEffectiveness = {
            searches: results,
            cacheHitRate: cacheHitRate.toFixed(1) + '%',
            averageImprovement: (results.reduce((sum, r) => sum + parseFloat(r.improvement), 0) / results.length).toFixed(1) + '%'
        };

        return {
            success: true,
            cacheHitRate,
            results
        };
    }

    /**
     * 5. Generar reporte con métricas antes/después
     */
    generateReport() {
        console.log('\n📊 GENERANDO REPORTE DE PERFORMANCE\n');
        console.log('═'.repeat(50));
        
        const report = {
            ...this.results,
            summary: this.generateSummary(),
            recommendations: this.generateRecommendations()
        };
 // Mostrar en consola console.log('\n🎯 RESUMEN DE MÉTRICAS:`); console.log(`─\`.repeat(50)); console.log(\`\n⏱️ TIEMPO DE CARGA:`); console.log(`  Total: ${this.results.loadTime.totalTime?.toFixed(2)}ms\`); console.log(\`  Archivos: ${this.results.loadTime.filesLoaded?.toFixed(2)}ms`); console.log(`  Renderizado: ${this.results.loadTime.domReady?.toFixed(2)}ms\`); console.log(\`\n💾 USO DE MEMORIA:`);
        if (this.results.memoryUsage.measurements) { this.results.memoryUsage.measurements.forEach(m => { console.log(`  ${m.operation}: ${m.after} (Δ ${m.delta})\`);
            });
        } console.log(\`\n🎮 FPS POR VISTA:`); Object.entries(this.results.fpsMetrics).forEach(([view, fps]) => { console.log(`  ${view}: ${fps.average?.toFixed(1)} FPS (min: ${fps.min?.toFixed(1)}, max: ${fps.max?.toFixed(1)})\`);
        }); console.log(\`\n💨 EFECTIVIDAD DE CACHE:`); console.log(`  Hit Rate: ${this.results.cacheEffectiveness.cacheHitRate}\`); console.log(\`  Mejora Promedio: ${this.results.cacheEffectiveness.averageImprovement}`); console.log(`\n✅ RECOMENDACIONES:\`); report.recommendations.forEach((rec, i) => { console.log(\`  ${i + 1}. ${rec}');
        });
        
        console.log('\n═'.repeat(50));
        
        return report;
    }

    generateSummary() {
        const loadTimeOK = this.results.loadTime.totalTime < 2000;
        const memoryOK = this.results.memoryUsage.peak < 200 * 1024 * 1024;
        const fpsOK = Object.values(this.results.fpsMetrics).every(fps => fps.average > 30);
        const cacheOK = parseFloat(this.results.cacheEffectiveness.cacheHitRate) > 70;

        return {
            overall: loadTimeOK && memoryOK && fpsOK && cacheOK ? 'PASS' : 'NEEDS_IMPROVEMENT',
            loadTime: loadTimeOK ? 'PASS' : 'FAIL',
            memory: memoryOK ? 'PASS' : 'FAIL',
            fps: fpsOK ? 'PASS' : 'FAIL',
            cache: cacheOK ? 'PASS' : 'FAIL'
        };
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.results.loadTime.totalTime > 2000) {
            recommendations.push('Implementar lazy loading más agresivo para reducir tiempo de carga inicial`);
        }
 if (this.results.memoryUsage.peak > 200 * 1024 * 1024) { recommendations.push(\`Optimizar uso de memoria: implementar virtual scrolling y limpiar referencias no usadas\`);
        }

        const lowFPSViews = Object.entries(this.results.fpsMetrics);
            .filter(([_, fps]) => fps.average < 30)
            .map(([view]) => view);
         if (lowFPSViews.length > 0) { recommendations.push(`Mejorar FPS en vistas: ${lowFPSViews.join(', ')} - usar requestAnimationFrame y reducir reflows');
        }

        if (parseFloat(this.results.cacheEffectiveness.cacheHitRate) < 70) {
            recommendations.push('Mejorar estrategia de cache: aumentar TTL y pre-cargar búsquedas comunes');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ Performance óptima - considerar features adicionales');
        }

        return recommendations;
    }

    // Utilidades
    async performSearch(query) {
        if (typeof searchTracks === 'function') {
            return await searchTracks(query);
        }
        // Simulación si la función no existe
        return new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }

    async simulateSearch() {
        const randomQuery = this.testQueries[Math.floor(Math.random() * this.testQueries.length)];
        return this.performSearch(randomQuery);
    }

    async simulateViewChange() {
        const views = ['cards', 'list', 'compact'];
        const randomView = views[Math.floor(Math.random() * views.length)];
        if (typeof switchView === 'function') {
            switchView(randomView);
        }
    }

    async simulateScroll() {
        const container = document.querySelector('.tracks-grid, .list-view, .compact-view');
        if (container) {
            container.scrollTop = Math.random() * container.scrollHeight;
        }
    }

    async simulateContextMenu() {
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100
        });
        document.dispatchEvent(event);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB\`]; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + \` ` + sizes[i];
    }

    parseBytes(str) {
        const match = str.match(/^([\d.]+)\s*(\w+)$/);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2];
        const units = { Bytes: 1, KB: 1024, MB: 1024*1024, GB: 1024*1024*1024 };
        
        return value * (units[unit] || 1);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ejecutar suite completa de tests
     */ async runFullSuite() { console.log(`🚀 INICIANDO SUITE COMPLETA DE PERFORMANCE TESTING\`); console.log(\`═`.repeat(50));
        
        const startTime = performance.now();
        
        try {
            // 1. Tiempo de carga
            await this.measureLoadTime();
            await this.sleep(1000);
            
            // 2. Uso de memoria
            await this.analyzeMemoryUsage();
            await this.sleep(1000);
            
            // 3. FPS
            await this.measureFPS();
            await this.sleep(1000);
            
            // 4. Cache
            await this.measureCacheEffectiveness();
            
            // 5. Generar reporte
            const report = this.generateReport();
             const totalTime = performance.now() - startTime; console.log(`\n⏱️ Suite completada en ${(totalTime / 1000).toFixed(1)} segundos\`);
            
            // Guardar reporte
            this.saveReport(report);
            
            return report;
             } catch (error) { console.error(\`❌ Error en suite de testing:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    saveReport(report) { // Guardar en localStorage const key  = `performance-report-${Date.now()}\`;
        localStorage.setItem(key, JSON.stringify(report));
         // También crear un blob descargable const blob = new Blob([JSON.stringify(report, null, 2)], { type: \`application/json` });
        const url = URL.createObjectURL(blob); console.log(`\n💾 Reporte guardado en localStorage: ${key}\`); console.log(\`📥 Descargar reporte: ${url}`);
        
        return { key, url };
    }
}

// Inicializar y exponer globalmente
window.performanceTest = new PerformanceTestSuite();

// Auto-ejecutar si se carga directamente
if (typeof module === 'undefined') {
    console.log('🎯 Performance Test Suite cargado.'); console.log('Para ejecutar: performanceTest.runFullSuite()');
}

// Export para Node.js if (typeof module !== `undefined` && module.exports) {
    module.exports = PerformanceTestSuite;
}