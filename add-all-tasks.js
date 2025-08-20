#!/usr/bin/env node

const http = require('http');

const PROJECT_ID = '26c4c114-f142-4720-9417-ca471a50e84d';

// Las 24 tareas restantes que faltan agregar
const tasks = [
    {
        title: 'Fix: Resolver 89+ archivos con análisis fallido',
        description:
            'Files en missing_89_errors.txt están fallando. Implementar manejo robusto de errores y retry para FLAC/M4A. Referencia: missing_89_errors.txt',
        status: 'todo',
        task_order: 10,
        feature: 'Bug Fix'
    },
    {
        title: 'Fix: Implementar IPC handlers faltantes',
        description:
            'Completar handlers: update-metadata, delete-track, create-playlist, add-to-playlist, export-json, export-csv en main-secure.js líneas 289-311',
        status: 'todo',
        task_order: 9,
        feature: 'Bug Fix'
    },
    {
        title: 'Fix: Saturación de audio en K-Meter',
        description:
            'K-Meter causa saturación y artifacts. Actualmente deshabilitado. Arreglar cadena de audio sin distorsión. Ref: PROJECT_STATUS_FINAL.md línea 17',
        status: 'todo',
        task_order: 8,
        feature: 'Bug Fix'
    },
    {
        title: 'Perf: Virtual Scrolling completo para 10k+ tracks',
        description:
            'Virtual scrolling con Intersection Observer. Meta: <20ms scroll, máx 50 elementos DOM. Ref: ROADMAP.md líneas 23-73',
        status: 'todo',
        task_order: 9,
        feature: 'Performance'
    },
    {
        title: 'Perf: Web Workers para búsqueda sin bloqueo',
        description:
            'Mover procesamiento de búsqueda a Web Workers. Meta: <30ms para 10k items. Ref: ROADMAP.md líneas 76-124, workers/search-worker.js',
        status: 'todo',
        task_order: 8,
        feature: 'Performance'
    },
    {
        title: 'Perf: Optimización SQL con cache LRU',
        description:
            'Implementar CTEs, prepared statements y cache LRU. Meta: queries <50ms, 85%+ cache hit rate. Ref: ROADMAP.md líneas 127-192',
        status: 'todo',
        task_order: 7,
        feature: 'Performance'
    },
    {
        title: 'Audio: Sistema HAMMS de similaridad 7D',
        description:
            'Sistema 7-dimensional: BPM, energy, danceability, valence, acousticness, instrumentalness, key. Ref: ROADMAP.md líneas 304-374',
        status: 'todo',
        task_order: 8,
        feature: 'Audio Analysis'
    },
    {
        title: 'Audio: Visualización Canvas BPM vs Energy',
        description:
            'Heatmap interactivo Canvas con zoom, pan y export para BPM vs Energy. Ref: ROADMAP.md líneas 377-462',
        status: 'todo',
        task_order: 6,
        feature: 'Audio Analysis'
    },
    {
        title: 'Audio: Fix pipeline Essentia/Python',
        description:
            'Resolver ModuleNotFoundError y compatibilidad NumPy. Meta: 100% success rate análisis. Ref: ESSENTIA_STATUS_REPORT.md',
        status: 'todo',
        task_order: 7,
        feature: 'Audio Analysis'
    },
    {
        title: 'Build: Webpack config producción optimizada',
        description:
            'Code splitting, tree shaking, optimización. Meta: main <250KB, vendor <500KB. Ref: PENDING_PHASES.md líneas 24-75',
        status: 'todo',
        task_order: 8,
        feature: 'Build Process'
    },
    {
        title: 'PWA: Service Worker con soporte offline',
        description:
            'Service Worker con cache strategies y manifest PWA. Meta: offline load <500ms. Ref: PENDING_PHASES.md líneas 114-230',
        status: 'todo',
        task_order: 7,
        feature: 'PWA'
    },
    {
        title: 'TypeScript: Migración completa del proyecto',
        description:
            'Migrar JS a TypeScript con 100% type coverage. Ref: PENDING_PHASES.md líneas 234-373, tsconfig.json',
        status: 'todo',
        task_order: 6,
        feature: 'Technical Debt'
    },
    {
        title: 'UI: Dark Mode profesional con persistencia',
        description:
            'Dark mode con CSS variables, toggle, localStorage y detección sistema. Ref: PENDING_PHASES.md líneas 447-504',
        status: 'todo',
        task_order: 5,
        feature: 'UI/UX'
    },
    {
        title: 'UI: Sistema de animaciones y micro-interacciones',
        description:
            'Micro-interacciones, loading states, respetando prefers-reduced-motion. Ref: PENDING_PHASES.md líneas 377-444',
        status: 'todo',
        task_order: 4,
        feature: 'UI/UX'
    },
    {
        title: 'UI: Conectar Context Menu al backend',
        description:
            'Integrar Edit Metadata, Create Playlist, Export al backend. Frontend listo, falta backend integration',
        status: 'todo',
        task_order: 7,
        feature: 'UI/UX'
    },
    {
        title: 'Monitor: Sistema global de tracking de errores',
        description:
            'Error tracking con clasificación, agrupación inteligente y dashboard. Ref: PENDING_PHASES.md líneas 570-631',
        status: 'todo',
        task_order: 8,
        feature: 'Monitoring'
    },
    {
        title: 'Monitor: Dashboard performance real-time',
        description:
            'Web Vitals tracking, métricas custom, alertas. Meta: <1% CPU overhead. Ref: PENDING_PHASES.md líneas 510-568',
        status: 'todo',
        task_order: 6,
        feature: 'Monitoring'
    },
    {
        title: 'Security: Actualizar todas las dependencias',
        description:
            'Update electron 32.3.3→37.2.6, music-metadata 7.14.0→11.7.3, revisar vulnerabilidades. Ref: package.json',
        status: 'todo',
        task_order: 7,
        feature: 'Security'
    },
    {
        title: 'Export: Formatos DJ (Rekordbox, Traktor, Serato)',
        description:
            'Exportar a M3U8, Rekordbox XML, Traktor NML con metadata completa. Ref: ROADMAP.md líneas 465-535',
        status: 'todo',
        task_order: 6,
        feature: 'Export'
    },
    {
        title: 'Feature: Sistema 5-star rating y favoritos',
        description: '5-star rating, favoritos con corazón, persistencia DB, filtros. Ref: ROADMAP.md líneas 538-556',
        status: 'todo',
        task_order: 5,
        feature: 'Feature'
    },
    {
        title: 'Test: Suite automática de performance',
        description:
            'Tests de load time, search, memoria, stress testing. Ref: ROADMAP.md líneas 247-297, NEXT_STEPS_DETAILED.md',
        status: 'todo',
        task_order: 7,
        feature: 'Testing'
    },
    {
        title: 'Test: E2E para flujos críticos del usuario',
        description:
            'Tests end-to-end para playback, búsqueda, context menu, carga de datos. Ref: CLAUDE.md lessons learned',
        status: 'todo',
        task_order: 6,
        feature: 'Testing'
    },
    {
        title: 'Refactor: Modularización completa del backend',
        description: 'Split main.js en módulos lógicos. Meta: main.js <100 líneas. Ref: ROADMAP.md líneas 195-244',
        status: 'todo',
        task_order: 6,
        feature: 'Technical Debt'
    },
    {
        title: 'Memory: Prevención de memory leaks',
        description:
            'Cleanup de event listeners, monitoreo memoria, fix leaks en visualizaciones. Ref: CLAUDE.md known issues #3',
        status: 'todo',
        task_order: 6,
        feature: 'Technical Debt'
    }
];

async function createTask(task) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            ...task,
            project_id: PROJECT_ID,
            assignee: 'Archon'
        });

        const options = {
            hostname: 'localhost',
            port: 8181,
            path: `/api/projects/${PROJECT_ID}/tasks`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, res => {
            let responseData = '';

            res.on('data', chunk => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    logInfo('✅ Creada: ${task.title}');
                    resolve(responseData);
                } else {
                    logError('❌ Error en: ${task.title} - Status: ${res.statusCode}');
                    reject(new Error(`Status ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', error => {
            logError(`❌ Error de conexión: ${error.message}`);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function createAllTasks() {
    logInfo('🚀 Agregando 24 tareas a Music Analyzer Pro en Archon...\n');
    logDebug(`📁 Proyecto ID: ${PROJECT_ID}\n`);

    let created = 0;
    let failed = 0;

    for (const task of tasks) {
        try {
            await createTask(task);
            created++;
            // Pequeña pausa para no sobrecargar el servidor
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            failed++;
            logError(`Error detallado: ${error.message}`);
        }
    }

    logDebug('\n📊 Resumen:');
    logInfo('✅ Tareas creadas: ${created}');
    logError('❌ Tareas fallidas: ${failed}');
    logDebug(`📋 Total de tareas en el proyecto: ${created + 1} (incluyendo la existente)`);

    if (created > 0) {
        logDebug('\n🎯 Próximos pasos:');
        logDebug('1. Ve a http://localhost:3737 → Projects → Map');
        logDebug('2. Verás todas las tareas organizadas por prioridad');
        logDebug('3. Comienza con las de prioridad 10 (más críticas)');
        logDebug('\n💡 En Claude CLI puedes ahora decir:');
        logDebug('"Muestra mis tareas de Music Analyzer Pro y ayúdame con la más crítica"');
    }
}

// Ejecutar
createAllTasks().catch(console.error);
