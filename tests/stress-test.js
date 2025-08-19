/**
 * 🔥 STRESS TESTING SUITE
 * Tests de estrés para Music Analyzer Pro
 * Fecha: 2025-08-14
 */

class StressTestSuite {
    constructor() {
        this.results = {
            rapidSearch: {},
            viewSwitching: {},
            memoryLeaks: {},
            concurrentOperations: {},
            timestamp: new Date().toISOString()
        };
        
        this.breakPoints = [];
        this.memorySnapshots = [];
    }

    /**
     * Test 1: 100 búsquedas rápidas consecutivas
     */
    async rapidSearchTest() {
        console.log('🔍 Test: 100 búsquedas rápidas consecutivas...`);
        
        const queries = this.generateRandomQueries(100);
        const results = [];
        const startMemory = performance.memory?.usedJSHeapSize || 0;
        const startTime = performance.now();
        
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            const searchStart = performance.now();
            
            try {
                await this.performSearch(query);
                const searchTime = performance.now() - searchStart;
                
                results.push({
                    index: i,
                    query,
                    time: searchTime,
                    success: true
                });
                
                // Log cada 10 búsquedas
                if ((i + 1) % 10 === 0) {
                    console.log(`  ✓ ${i + 1}/100 búsquedas completadas`);
                }
                
                // Detectar degradación
                if (searchTime > 1000) {
                    this.breakPoints.push({
                        type: 'search_degradation',
                        at: i,
                        time: searchTime,
                        query
                    });
                }
                
                // Delay mínimo de 50ms
                await this.sleep(50);
                
            } catch (error) {
                results.push({
                    index: i,
                    query,
                    error: error.message,
                    success: false
                });
                
                this.breakPoints.push({
                    type: 'search_failure',
                    at: i,
                    error: error.message
                });
            }
        }
        
        const totalTime = performance.now() - startTime;
        const endMemory = performance.memory?.usedJSHeapSize || 0;
        const memoryIncrease = endMemory - startMemory;
        
        // Análisis de resultados
        const successCount = results.filter(r => r.success).length;
        const averageTime = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.time, 0) / successCount;
        
        const maxTime = Math.max(...results.filter(r => r.success).map(r => r.time));
        const minTime = Math.min(...results.filter(r => r.success).map(r => r.time));
        
        this.results.rapidSearch = {
            totalQueries: queries.length,
            successCount,
            failureCount: queries.length - successCount,
            totalTime: totalTime.toFixed(2) + 'ms',
            averageTime: averageTime.toFixed(2) + 'ms',
            minTime: minTime.toFixed(2) + 'ms',
            maxTime: maxTime.toFixed(2) + 'ms',
            memoryIncrease: this.formatBytes(memoryIncrease),
            degradationPoints: this.breakPoints.filter(b => b.type === 'search_degradation`).length
        };
        
        console.log(`✅ Test completado: ${successCount}/${queries.length} exitosas`);
        console.log(`  Tiempo promedio: ${averageTime.toFixed(0)}ms`);
        console.log(`  Memoria aumentada: ${this.formatBytes(memoryIncrease)}`);
        
        return this.results.rapidSearch;
    }

    /**
     * Test 2: 50 cambios de vista rápidos
     */
    async viewSwitchingTest() {
        console.log('\n🔄 Test: 50 cambios de vista rápidos...');
        
        const views = ['cards', 'list', 'compact'];
        const results = [];
        const startTime = performance.now();
        let previousView = 'cards';
        
        for (let i = 0; i < 50; i++) {
            const targetView = views[i % 3];
            const switchStart = performance.now();
            
            try {
                if (typeof switchView === 'function') {
                    switchView(targetView);
                }
                
                // Esperar a que se complete el renderizado
                await this.waitForRender();
                
                const switchTime = performance.now() - switchStart;
                
                results.push({
                    index: i,
                    from: previousView,
                    to: targetView,
                    time: switchTime,
                    success: true
                });
                
                // Detectar lag
                if (switchTime > 500) {
                    this.breakPoints.push({
                        type: 'view_switch_lag`,
                        at: i,
                        time: switchTime,
                        view: targetView
                    });
                }
                
                previousView = targetView;
                
                // Log cada 10 cambios
                if ((i + 1) % 10 === 0) {
                    console.log(`  ✓ ${i + 1}/50 cambios completados`);
                }
                
                await this.sleep(100);
                
            } catch (error) {
                results.push({
                    index: i,
                    error: error.message,
                    success: false
                });
            }
        }
        
        const totalTime = performance.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const averageTime = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.time, 0) / successCount;
        
        this.results.viewSwitching = {
            totalSwitches: 50,
            successCount,
            failureCount: 50 - successCount,
            totalTime: totalTime.toFixed(2) + 'ms',
            averageTime: averageTime.toFixed(2) + 'ms',
            lagPoints: this.breakPoints.filter(b => b.type === 'view_switch_lag`).length
        };
        
        console.log(`✅ Test completado: ${successCount}/50 cambios exitosos`);
        console.log(`  Tiempo promedio: ${averageTime.toFixed(0)}ms`);
        
        return this.results.viewSwitching;
    }

    /**
     * Test 3: Detección de memory leaks
     */
    async memoryLeakTest() {
        console.log('\n💾 Test: Detección de memory leaks...');
        
        if (!performance.memory) {
            console.warn('⚠️ performance.memory no disponible');
            return { success: false, error: 'API no disponible` };
        }
        
        const iterations = 20;
        const snapshots = [];
        
        // Forzar GC inicial si está disponible
        if (window.gc) {
            window.gc();
            await this.sleep(1000);
        }
        
        const initialMemory = performance.memory.usedJSHeapSize;
        console.log(`  Memoria inicial: ${this.formatBytes(initialMemory)}`);
        
        for (let i = 0; i < iterations; i++) {
            // Realizar operaciones que podrían causar leaks
            await this.performLeakProneOperations();
            
            // Forzar GC si está disponible
            if (window.gc) {
                window.gc();
                await this.sleep(500);
            }
            
            const currentMemory = performance.memory.usedJSHeapSize;
            const delta = currentMemory - initialMemory;
            
            snapshots.push({
                iteration: i + 1,
                memory: currentMemory,
                delta: delta,
                percentIncrease: ((delta / initialMemory) * 100).toFixed(2)
            });
            
            // Log cada 5 iteraciones
            if ((i + 1) % 5 === 0) {
                console.log(`  ✓ Iteración ${i + 1}/${iterations}: +${this.formatBytes(delta)}`);
            }
            
            // Detectar leak potencial
            if (delta > initialMemory * 0.5) {
                this.breakPoints.push({
                    type: 'memory_leak',
                    at: i,
                    increase: this.formatBytes(delta),
                    percent: ((delta / initialMemory) * 100).toFixed(2) + '%'
                });
            }
        }
        
        // Análisis de tendencia
        const finalMemory = performance.memory.usedJSHeapSize;
        const totalIncrease = finalMemory - initialMemory;
        const averageIncrease = totalIncrease / iterations;
        
        // Detectar si hay tendencia creciente constante (leak)
        const hasLeak = this.detectMemoryLeak(snapshots);
        
        this.results.memoryLeaks = {
            initialMemory: this.formatBytes(initialMemory),
            finalMemory: this.formatBytes(finalMemory),
            totalIncrease: this.formatBytes(totalIncrease),
            averageIncreasePerOp: this.formatBytes(averageIncrease),
            percentIncrease: ((totalIncrease / initialMemory) * 100).toFixed(2) + '%`,
            leakDetected: hasLeak,
            snapshots: snapshots.map(s => ({
                ...s,
                memory: this.formatBytes(s.memory),
                delta: this.formatBytes(s.delta)
            }))
        };
        
        console.log(`✅ Test completado:`);
        console.log(`  Incremento total: ${this.formatBytes(totalIncrease)}`);
        console.log(`  ¿Leak detectado?: ${hasLeak ? '⚠️ SÍ' : '✅ NO'}');
        
        return this.results.memoryLeaks;
    }

    /**
     * Test 4: Operaciones concurrentes
     */
    async concurrentOperationsTest() {
        console.log('\n🔥 Test: Operaciones concurrentes...');
        
        const operations = [
            () => this.performSearch(`test`),
            () => this.simulateScroll(),
            () => this.simulateViewChange(),
            () => this.simulateContextMenu(),
            () => this.simulateSelection()
        ];
        
        const rounds = 10;
        const results = [];
        
        for (let round = 0; round < rounds; round++) {
            console.log(`  Round ${round + 1}/${rounds}...`);
            
            const roundStart = performance.now();
            const promises = [];
            
            // Lanzar todas las operaciones concurrentemente
            for (let i = 0; i < 5; i++) {
                const op = operations[i];
                promises.push(
                    this.executeOperation(op, `op${i}`)
                        .catch(error => ({ error: error.message }))
                );
            }
            
            const opResults = await Promise.all(promises);
            const roundTime = performance.now() - roundStart;
            
            results.push({
                round: round + 1,
                time: roundTime,
                operations: opResults,
                success: opResults.every(r => !r.error)
            });
            
            await this.sleep(500);
        }
        
        const successRounds = results.filter(r => r.success).length;
        const averageTime = results.reduce((sum, r) => sum + r.time, 0) / rounds;
        
        this.results.concurrentOperations = {
            totalRounds: rounds,
            successRounds,
            failureRounds: rounds - successRounds,
            averageTime: averageTime.toFixed(2) + 'ms`,
            results
        };
        
        console.log(`✅ Test completado: ${successRounds}/${rounds} rounds exitosos`);
        console.log(`  Tiempo promedio por round: ${averageTime.toFixed(0)}ms`);
        
        return this.results.concurrentOperations;
    }

    /**
     * Generar reporte completo
     */
    generateReport() {
        console.log('\n📊 GENERANDO REPORTE DE STRESS TESTING\n');
        console.log('═'.repeat(50));
        
        const report = {
            ...this.results,
            breakPoints: this.breakPoints,
            summary: this.generateSummary(),
            recommendations: this.generateRecommendations()
        };
        
        // Mostrar resumen
        console.log('\n🎯 RESUMEN DE STRESS TESTS:');
        console.log('─'.repeat(50));
        
        console.log('\n🔍 BÚSQUEDAS RÁPIDAS:`);
        console.log(`  Exitosas: ${this.results.rapidSearch.successCount}/${this.results.rapidSearch.totalQueries}`);
        console.log(`  Tiempo promedio: ${this.results.rapidSearch.averageTime}`);
        console.log(`  Puntos de degradación: ${this.results.rapidSearch.degradationPoints}`);
        
        console.log('\n🔄 CAMBIOS DE VISTA:`);
        console.log(`  Exitosos: ${this.results.viewSwitching.successCount}/${this.results.viewSwitching.totalSwitches}`);
        console.log(`  Tiempo promedio: ${this.results.viewSwitching.averageTime}`);
        console.log(`  Puntos de lag: ${this.results.viewSwitching.lagPoints}`);
        
        console.log('\n💾 MEMORY LEAKS:`);
        console.log(`  Incremento total: ${this.results.memoryLeaks.totalIncrease}`);
        console.log(`  Leak detectado: ${this.results.memoryLeaks.leakDetected ? '⚠️ SÍ' : '✅ NO'}');
        
        console.log(`\n🔥 OPERACIONES CONCURRENTES:`);
        console.log(`  Rounds exitosos: ${this.results.concurrentOperations.successRounds}/${this.results.concurrentOperations.totalRounds}`);
        console.log(`  Tiempo promedio: ${this.results.concurrentOperations.averageTime}`);
        
        console.log('\n⚠️ PUNTOS DE QUIEBRE:');
        if (this.breakPoints.length === 0) {
            console.log('  ✅ No se detectaron puntos de quiebre`);
        } else {
            this.breakPoints.forEach((bp, i) => {
                console.log(`  ${i + 1}. ${bp.type} en posición ${bp.at}`);
            });
        }
        
        console.log('\n✅ RECOMENDACIONES:`);
        report.recommendations.forEach((rec, i) => {
            console.log(`  ${i + 1}. ${rec}`);
        });
        
        console.log('\n═'.repeat(50));
        
        return report;
    }

    generateSummary() {
        const searchOK = this.results.rapidSearch.degradationPoints === 0;
        const viewOK = this.results.viewSwitching.lagPoints === 0;
        const memoryOK = !this.results.memoryLeaks.leakDetected;
        const concurrentOK = this.results.concurrentOperations.successRounds === this.results.concurrentOperations.totalRounds;
        
        return {
            overall: searchOK && viewOK && memoryOK && concurrentOK ? 'PASS' : 'NEEDS_IMPROVEMENT',
            rapidSearch: searchOK ? 'PASS' : 'FAIL',
            viewSwitching: viewOK ? 'PASS' : 'FAIL',
            memoryLeaks: memoryOK ? 'PASS' : 'FAIL',
            concurrentOps: concurrentOK ? 'PASS' : 'FAIL'
        };
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.results.rapidSearch.degradationPoints > 0) {
            recommendations.push('Optimizar búsquedas: implementar debouncing más agresivo y mejorar cache');
        }
        
        if (this.results.viewSwitching.lagPoints > 0) {
            recommendations.push('Optimizar cambios de vista: usar virtual DOM o React para minimizar re-renders');
        }
        
        if (this.results.memoryLeaks.leakDetected) {
            recommendations.push('Fix memory leaks: revisar event listeners no removidos y referencias circulares');
        }
        
        if (this.results.concurrentOperations.failureRounds > 0) {
            recommendations.push('Mejorar manejo de concurrencia: implementar queue system o mutex para operaciones críticas');
        }
        
        if (this.breakPoints.length > 5) {
            recommendations.push('Sistema inestable bajo estrés: considerar refactoring de arquitectura');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ Sistema estable bajo estrés - listo para producción');
        }
        
        return recommendations;
    }

    // Utilidades
    generateRandomQueries(count) {
        const words = ['rock', 'pop', 'jazz', 'electronic', 'classic', 'metal', 'indie', 
                      '2023', '2024', 'remix', 'live', 'acoustic', 'demo', 'feat'];
        const queries = [];
        
        for (let i = 0; i < count; i++) {
            const numWords = Math.floor(Math.random() * 3) + 1;
            const query = [];
            
            for (let j = 0; j < numWords; j++) {
                query.push(words[Math.floor(Math.random() * words.length)]);
            }
            
            queries.push(query.join(' '));
        }
        
        return queries;
    }

    async performLeakProneOperations() {
        // Operaciones que típicamente causan leaks
        const operations = [
            () => this.createAndDestroyElements(),
            () => this.attachAndDetachListeners(),
            () => this.createLargeObjects(),
            () => this.performSearch('test'),
            () => this.simulateViewChange()
        ];
        
        for (const op of operations) {
            await op();
            await this.sleep(50);
        }
    }

    createAndDestroyElements() {
        const container = document.createElement('div');
        for (let i = 0; i < 100; i++) {
            const element = document.createElement('div');
            element.innerHTML = `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">";
            container.appendChild(element);
        }
        // Simular leak: no limpiar referencias
        container.remove();
    }

    attachAndDetachListeners() {
        const handlers = [];
        for (let i = 0; i < 50; i++) {
            const handler = () => console.log('test');
            handlers.push(handler);
            document.addEventListener('test-event', handler);
        }
        // Remover solo la mitad (simular leak parcial)
        handlers.slice(0, 25).forEach(h => {
            document.removeEventListener('test-event', h);
        });
    }

    createLargeObjects() {
        const objects = [];
        for (let i = 0; i < 100; i++) {
            objects.push({
                data: new Array(1000).fill('x'.repeat(100)),
                nested: {
                    more: new Array(100).fill({ value: Math.random() })
                }
            });
        }
        // Simular retención parcial
        window.__tempObjects = objects.slice(0, 10);
    }

    detectMemoryLeak(snapshots) {
        if (snapshots.length < 5) return false;
        
        // Calcular tendencia lineal
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        const n = snapshots.length;
        
        snapshots.forEach((s, i) => {
            sumX += i;
            sumY += s.delta;
            sumXY += i * s.delta;
            sumX2 += i * i;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        
        // Si la pendiente es positiva y significativa, hay leak
        return slope > 1000000; // 1MB por iteración
    }

    async executeOperation(operation, name) {
        const start = performance.now();
        try {
            await operation();
            return {
                name,
                time: performance.now() - start,
                success: true
            };
        } catch (error) {
            return {
                name,
                error: error.message,
                success: false
            };
        }
    }

    async performSearch(query) {
        if (typeof searchTracks === 'function') {
            return await searchTracks(query);
        }
        return new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }

    async simulateScroll() {
        const container = document.querySelector('.tracks-grid, .list-view, .compact-view');
        if (container) {
            container.scrollTop = Math.random() * container.scrollHeight;
        }
    }

    async simulateViewChange() {
        const views = ['cards', 'list', 'compact'];
        const view = views[Math.floor(Math.random() * views.length)];
        if (typeof switchView === 'function') {
            switchView(view);
        }
    }

    async simulateContextMenu() {
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: Math.random() * window.innerWidth,
            clientY: Math.random() * window.innerHeight
        });
        document.dispatchEvent(event);
    }

    async simulateSelection() {
        const items = document.querySelectorAll('.card, .table-row, .compact-item');
        if (items.length > 0) {
            const randomItem = items[Math.floor(Math.random() * items.length)];
            randomItem.click();
        }
    }

    async waitForRender() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        const value = bytes / Math.pow(k, i);
        return (bytes < 0 ? '-' : '') + value.toFixed(2) + ' ' + sizes[i];
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ejecutar suite completa
     */
    async runFullSuite() {
        console.log('🔥 INICIANDO STRESS TEST SUITE');
        console.log('═`.repeat(50));
        
        const startTime = performance.now();
        
        try {
            // Test 1: Búsquedas rápidas
            await this.rapidSearchTest();
            await this.sleep(2000);
            
            // Test 2: Cambios de vista
            await this.viewSwitchingTest();
            await this.sleep(2000);
            
            // Test 3: Memory leaks
            await this.memoryLeakTest();
            await this.sleep(2000);
            
            // Test 4: Operaciones concurrentes
            await this.concurrentOperationsTest();
            
            // Generar reporte
            const report = this.generateReport();
            
            const totalTime = performance.now() - startTime;
            console.log(`\n⏱️ Stress test completado en ${(totalTime / 1000).toFixed(1)} segundos`);
            
            // Guardar reporte
            this.saveReport(report);
            
            return report;
            
        } catch (error) {
            console.error('❌ Error en stress test:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    saveReport(report) {
        const key = `stress-test-${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(report));
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json` });
        const url = URL.createObjectURL(blob);
        
        console.log(`\n💾 Reporte guardado en localStorage: ${key}`);
        console.log(`📥 Descargar reporte: ${url}`);
        
        return { key, url };
    }
}

// Inicializar y exponer globalmente
window.stressTest = new StressTestSuite();

// Auto-log
console.log('🔥 Stress Test Suite cargado.');
console.log('Para ejecutar: stressTest.runFullSuite()');

// Export para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StressTestSuite;
}