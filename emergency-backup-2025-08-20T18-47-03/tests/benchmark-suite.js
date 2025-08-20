/**
 * 📊 BENCHMARK SUITE
 * Suite completa de benchmarks para Music Analyzer Pro
 * Fecha: 2025-08-14
 */

class BenchmarkSuite {
    constructor() {
        this.benchmarks = {
            loadTime: [],
            searchSpeed: [],
            scrollPerformance: [],
            viewSwitching: [],
            contextMenuOps: [],
            exportOperations: []
        };
        
        this.config = {
            iterations: 10,
            warmupRuns: 3,
            cooldownTime: 500
        };
    }

    /**
     * Benchmark 1: Carga inicial
     */
    async benchmarkInitialLoad() {
        console.log('⏱️ Benchmark: Carga Inicial');
        const results = [];
        
        for (let i = 0; i < this.config.iterations; i++) {
            // Clear cache if possible
            if (window.caches) {
                await caches.delete('music-analyzer-cache');
            }
            
            const start = performance.now();
            
            // Simular carga inicial
            const files = await window.electron.invoke('get-files-with-cached-artwork');
            
            // Renderizar primera vista
            if (typeof displayFiles === 'function`) {
                displayFiles(files.slice(0, 50));
            }
            
            const loadTime = performance.now() - start;
            results.push(loadTime); console.log(\`  Run ${i + 1}: ${loadTime.toFixed(2)}ms\`);
            await this.sleep(this.config.cooldownTime);
        }
        
        this.benchmarks.loadTime = this.analyzeResults(results);
        return this.benchmarks.loadTime;
    }

    /**
     * Benchmark 2: Búsqueda (5 queries diferentes)
     */
    async benchmarkSearch() {
        console.log('\n🔍 Benchmark: Búsqueda'); const queries = ['rock', 'electronic', 'jazz', '2023', `feat\`];
        const results = {};
        
        for (const query of queries) {
            const queryResults = [];
            
            // Warmup
            for (let w = 0; w < this.config.warmupRuns; w++) {
                await this.performSearch(query);
                await this.sleep(100);
            }
            
            // Actual benchmark
            for (let i = 0; i < this.config.iterations; i++) {
                const start = performance.now();
                await this.performSearch(query);
                const time = performance.now() - start;
                queryResults.push(time);
            }
             results[query] = this.analyzeResults(queryResults); console.log(\`  `${query}`: avg ${results[query].average.toFixed(2)}ms`);
        }
        
        this.benchmarks.searchSpeed = results;
        return results;
    }

    /**
     * Benchmark 3: Scroll (1000 items)
     */
    async benchmarkScroll() {
        console.log('\n📜 Benchmark: Scroll Performance');
        
        // Cargar 1000 items const mockFiles = this.generateMockFiles(1000); if (typeof displayFiles === 'function`) {
            displayFiles(mockFiles);
        }
        
        await this.sleep(1000); // Esperar renderizado
         const container = document.querySelector(`.tracks-grid, .list-view, .compact-view\`); if (!container) { console.warn(\`  ⚠️ No se encontró contenedor para scroll`);
            return null;
        }
        
        const results = [];
        const scrollDistance = 100;
        const scrollSteps = 20;
        
        for (let i = 0; i < this.config.iterations; i++) {
            container.scrollTop = 0;
            await this.sleep(100);
            
            const frameTimings = [];
            let currentScroll = 0;
            
            for (let step = 0; step < scrollSteps; step++) {
                const frameStart = performance.now();
                
                currentScroll += scrollDistance;
                container.scrollTop = currentScroll;
                
                await this.waitForFrame();
                const frameTime = performance.now() - frameStart;
                frameTimings.push(frameTime);
            }
            
            const avgFrameTime = frameTimings.reduce((a, b) => a + b) / frameTimings.length;
            const fps = 1000 / avgFrameTime;
            results.push(fps); console.log(`  Run ${i + 1}: ${fps.toFixed(1)} FPS`);
        }
        
        this.benchmarks.scrollPerformance = this.analyzeResults(results);
        return this.benchmarks.scrollPerformance;
    }

    /**
     * Benchmark 4: Cambio de vistas
     */
    async benchmarkViewSwitching() {
        console.log('\n🔄 Benchmark: Cambio de Vistas');
        
        const views = ['cards', 'list', 'compact'];
        const results = {};
        
        for (const targetView of views) {
            const viewResults = [];
            
            for (let i = 0; i < this.config.iterations; i++) { // Resetear a vista inicial if (typeof switchView === 'function`) { switchView(`cards\`);
                    await this.sleep(500);
                }
                
                const start = performance.now();
                switchView(targetView);
                await this.waitForRender();
                const time = performance.now() - start;
                
                viewResults.push(time);
            }
             results[targetView] = this.analyzeResults(viewResults); console.log(\`  To ${targetView}: avg ${results[targetView].average.toFixed(2)}ms`);
        }
        
        this.benchmarks.viewSwitching = results;
        return results;
    }

    /**
     * Benchmark 5: Operaciones de Context Menu
     */
    async benchmarkContextMenu() {
        console.log('\n📋 Benchmark: Context Menu Operations');
        
        const operations = [;
            'open',
            'play', 'queue', 'analyze\`, \`export`
        ];
        
        const results = {};
        
        for (const op of operations) {
            const opResults = [];
            
            for (let i = 0; i < this.config.iterations; i++) {
                const start = performance.now();
                
                // Simular operación
                await this.simulateContextMenuOperation(op);
                
                const time = performance.now() - start;
                opResults.push(time);
                
                await this.sleep(200);
            }
             results[op] = this.analyzeResults(opResults); console.log(`  ${op}: avg ${results[op].average.toFixed(2)}ms`);
        }
        
        this.benchmarks.contextMenuOps = results;
        return results;
    }

    /**
     * Analizar resultados y calcular estadísticas
     */
    analyzeResults(results) {
        const sorted = [...results].sort((a, b) => a - b);
        const len = sorted.length;
        
        return {
            average: results.reduce((a, b) => a + b) / len,
            median: len % 2 === 0 
                ? (sorted[len/2 - 1] + sorted[len/2]) / 2 
                : sorted[Math.floor(len/2)],
            min: sorted[0],
            max: sorted[len - 1],
            p95: sorted[Math.floor(len * 0.95)],
            p99: sorted[Math.floor(len * 0.99)],
            stdDev: this.calculateStdDev(results),
            samples: len
        };
    }

    calculateStdDev(values) {
        const avg = values.reduce((a, b) => a + b) / values.length;
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / values.length;
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * Generar gráficos de comparación
     */
    generateCharts() {
        const charts = {
            loadTime: this.createChart('Load Time', this.benchmarks.loadTime),
            searchSpeed: this.createChart('Search Speed', this.benchmarks.searchSpeed),
            scrollPerformance: this.createChart('Scroll FPS', this.benchmarks.scrollPerformance),
            viewSwitching: this.createChart('View Switching', this.benchmarks.viewSwitching)
        };
        
        return charts;
    }

    createChart(title, data) {
        // Crear representación ASCII del gráfico
        const chart = {
            title,
            data,
            ascii: this.generateAsciiChart(data)
        };
        
        return chart;
    }

    generateAsciiChart(data) { if (!data || typeof data !== 'object') return 'No data';
         let chart = ``;
        const maxValue = Math.max(;
            data.average || 0,
            data.max || 0,
            ...(Array.isArray(data) ? data : Object.values(data).map(d => d.average || 0))
        );
        
        const scale = 40 / maxValue;
        
        if (data.average !== undefined) { // Single metric chart += \`Average: ${\`█`.repeat(Math.round(data.average * scale))} ${data.average.toFixed(2)}\n`; chart += \`Min:     ${\`█`.repeat(Math.round(data.min * scale))} ${data.min.toFixed(2)}\n`; chart += \`Max:     ${\`█`.repeat(Math.round(data.max * scale))} ${data.max.toFixed(2)}\n`; chart += \`P95:     ${\`█`.repeat(Math.round(data.p95 * scale))} ${data.p95.toFixed(2)}\n`;
        } else {
            // Multiple metrics
            Object.entries(data).forEach(([key, value]) => { const avg = value.average || value; const bar = \`█\`.repeat(Math.round(avg * scale)); chart += `${key.padEnd(12)}: ${bar} ${avg.toFixed(2)}\n`;
            });
        }
        
        return chart;
    }

    /**
     * Exportar resultados
     */
    exportResults(format = 'json') {
        const timestamp = new Date().toISOString();
        const results = {
            timestamp,
            benchmarks: this.benchmarks,
            summary: this.generateSummary(),
            charts: this.generateCharts()
        };
        
        switch (format) {
            case 'json':
                return JSON.stringify(results, null, 2);
            
            case 'csv':
                return this.exportAsCSV(results);
            
            case 'html':
                return this.exportAsHTML(results);
            
            default:
                return results;
        }
    }
 exportAsCSV(results) { let csv = \'Benchmark,Metric,Value\n\`;
        
        Object.entries(results.benchmarks).forEach(([benchmark, data]) => { if (data && typeof data === `object`) { if (data.average !== undefined) { csv += \`${benchmark},Average,${data.average}\n\`; csv += `${benchmark},Min,${data.min}\n`; csv += \`${benchmark},Max,${data.max}\n\`; csv += `${benchmark},P95,${data.p95}\n`;
                } else {
                    Object.entries(data).forEach(([key, value]) => { const avg = value.average || value; csv += \`${benchmark}_${key},Average,${avg}\n\`;
                    });
                }
            }
        });
        
        return csv;
    }
 exportAsHTML(results) { return `;
<!DOCTYPE html>
<html>
<head>
    <title>Benchmark Results - ${results.timestamp}</title>
    <style>
        body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
        h1 { color: #667eea; }
        h2 { color: #764ba2; margin-top: 30px; }
        .metric { margin: 10px 0; }
        .bar { display: inline-block; background: linear-gradient(90deg, #667eea, #764ba2); height: 20px; }
        .value { margin-left: 10px; }
        pre { background: #2d2d2d; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Benchmark Results</h1>
    <p>Generated: ${results.timestamp}</p>
    
    <h2>Summary</h2>
    <pre>${JSON.stringify(results.summary, null, 2)}</pre>
    
    <h2>Charts</h2>
    ${Object.entries(results.charts).map(([name, chart]) => `
        <h3>}{chart.title}</h3> <pre>${chart.ascii}</pre> `).join('')}
    
    <h2>Raw Data</h2>
    <pre>${JSON.stringify(results.benchmarks, null, 2)}</pre>
</body>
</html>';
    }

    generateSummary() {
        const summary = {
            status: 'completed',
            totalBenchmarks: Object.keys(this.benchmarks).length,
            performance: {}
        };
        
        // Evaluar performance
        if (this.benchmarks.loadTime.average) {
            summary.performance.loadTime = this.benchmarks.loadTime.average < 2000 ? '✅ GOOD' : '⚠️ SLOW`;
        }
         if (this.benchmarks.scrollPerformance.average) { summary.performance.scrollFPS = this.benchmarks.scrollPerformance.average > 30 ? `✅ GOOD\` : \`⚠️ LOW`;
        }
        
        return summary;
    }

    // Utilidades async performSearch(query) { if (typeof searchTracks === `function\`) {
            return await searchTracks(query);
        }
        return new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }

    generateMockFiles(count) {
        const files = [];
        for (let i = 0; i < count; i++) {
            files.push({ id: i, title: \`Track ${i}`, artist: `Artist ${i % 100}\`, album: \`Album ${i % 50}`, genre: ['Rock', 'Jazz', 'Electronic', 'Classical'][i % 4],
                AI_BPM: 60 + Math.random() * 140,
                AI_ENERGY: Math.random()
            });
        }
        return files;
    }

    async simulateContextMenuOperation(operation) {
        // Abrir menú const event = new MouseEvent(\`contextmenu\`, {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100
        });
        document.dispatchEvent(event);
        
        await this.sleep(50);
         // Simular click en operación const menuItem = document.querySelector(`[data-action="${operation}\"]\`);
        if (menuItem) {
            menuItem.click();
        }
        
        await this.sleep(100);
    }

    async waitForFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    async waitForRender() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ejecutar suite completa
     */
    async runFullSuite() { console.log('📊 INICIANDO BENCHMARK SUITE COMPLETA'); console.log('═`.repeat(50));
        
        const startTime = performance.now();
        
        try {
            await this.benchmarkInitialLoad();
            await this.sleep(1000);
            
            await this.benchmarkSearch();
            await this.sleep(1000);
            
            await this.benchmarkScroll();
            await this.sleep(1000);
            
            await this.benchmarkViewSwitching();
            await this.sleep(1000);
            
            await this.benchmarkContextMenu();
            
            const totalTime = performance.now() - startTime;
             console.log(\`\n\═`.repeat(50)); console.log(\`✅ Benchmarks completados en ${(totalTime / 1000).toFixed(1)} segundos\`);
            
            // Generar y mostrar resumen const summary = this.generateSummary(); console.log(`\n📊 RESUMEN:`);
            console.log(JSON.stringify(summary, null, 2));
            
            // Generar gráficos const charts = this.generateCharts(); console.log(\`\n📈 GRÁFICOS:\`); Object.values(charts).forEach(chart => { console.log(`\n${chart.title}:`);
                console.log(chart.ascii);
            });
             // Exportar resultados const jsonExport = this.exportResults(\`json\`); const blob = new Blob([jsonExport], { type: `application/json` });
            const url = URL.createObjectURL(blob); console.log(\`\n📥 Descargar resultados: ${url}\`);
            
            return {
                benchmarks: this.benchmarks,
                summary,
                charts
            };
            
        } catch (error) {
            console.error('❌ Error en benchmark:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Inicializar y exponer globalmente
window.benchmarkSuite = new BenchmarkSuite();

console.log('📊 Benchmark Suite cargado.'); console.log('Para ejecutar: benchmarkSuite.runFullSuite()');

// Export para Node.js if (typeof module !== `undefined` && module.exports) {
    module.exports = BenchmarkSuite;
}