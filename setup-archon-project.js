#!/usr/bin/env node

/**
 * Script para crear el proyecto Music Analyzer Pro en Archon
 * y generar todas las tareas basadas en el ROADMAP
 */

const fetch = require('node-fetch');

const ARCHON_API = 'http://localhost:8181/api';
const MCP_API = 'http://localhost:8051/mcp';

// Proyecto principal
const project = {
    title: 'Music Analyzer Pro - DJ Library Manager',
    description:
        'Professional DJ library management app with 6000+ tracks, Electron-based with advanced audio analysis using Essentia and AI enrichment',
    github_repo: 'https://github.com/BlueSystemIO/music-analyzer-pro',
    features: [
        'Audio Analysis Pipeline',
        'Performance Optimization',
        'UI/UX Improvements',
        'Smart Playlists',
        'BPM & Key Detection',
        'Waveform Visualization'
    ]
};

// Tareas basadas en el ROADMAP.md
const tasks = [
    // Sprint 1 - Performance & Core
    {
        title: 'Optimizar carga inicial para 6000+ tracks',
        description:
            'Implementar lazy loading y virtual scrolling para manejar bibliotecas grandes sin problemas de rendimiento',
        feature: 'Performance Optimization',
        priority: 10,
        status: 'todo'
    },
    {
        title: 'Implementar sistema de caché inteligente',
        description:
            'Crear sistema de caché en memoria y disco para metadata y artwork, reduciendo consultas a DB',
        feature: 'Performance Optimization',
        priority: 9,
        status: 'todo'
    },
    {
        title: 'Mejorar indexación de base de datos',
        description: 'Optimizar índices SQLite para búsquedas rápidas por BPM, key, género, mood',
        feature: 'Performance Optimization',
        priority: 8,
        status: 'todo'
    },

    // Sprint 2 - Audio Analysis
    {
        title: 'Integrar detección de BPM con Essentia',
        description: 'Implementar análisis de BPM preciso usando Essentia C++ bindings',
        feature: 'BPM & Key Detection',
        priority: 7,
        status: 'todo'
    },
    {
        title: 'Implementar detección de tonalidad (Key)',
        description: 'Agregar detección de key musical usando algoritmos de Essentia',
        feature: 'BPM & Key Detection',
        priority: 7,
        status: 'todo'
    },
    {
        title: 'Crear pipeline de análisis batch',
        description: 'Sistema para analizar múltiples tracks en paralelo sin bloquear UI',
        feature: 'Audio Analysis Pipeline',
        priority: 6,
        status: 'todo'
    },

    // Sprint 3 - UI/UX
    {
        title: 'Implementar visualización de waveform',
        description: 'Mostrar waveform de tracks con marcadores de cue points y beats',
        feature: 'Waveform Visualization',
        priority: 5,
        status: 'todo'
    },
    {
        title: 'Mejorar player bar estilo Spotify',
        description: 'Refinar controles del player con scrubbing, keyboard shortcuts mejorados',
        feature: 'UI/UX Improvements',
        priority: 5,
        status: 'todo'
    },
    {
        title: 'Agregar modo oscuro profesional',
        description: 'Implementar tema oscuro optimizado para uso en clubs/ambientes con poca luz',
        feature: 'UI/UX Improvements',
        priority: 4,
        status: 'todo'
    },

    // Sprint 4 - Smart Features
    {
        title: 'Implementar Smart Playlists',
        description: 'Playlists automáticas basadas en BPM, key, energy, mood usando IA',
        feature: 'Smart Playlists',
        priority: 3,
        status: 'todo'
    },
    {
        title: 'Agregar recomendaciones de mezcla',
        description: 'Sugerir próximos tracks basados en compatibilidad armónica y BPM',
        feature: 'Smart Playlists',
        priority: 3,
        status: 'todo'
    },
    {
        title: 'Crear exportación para DJ software',
        description: 'Exportar playlists y metadata a formatos de Rekordbox, Serato, Traktor',
        feature: 'Smart Playlists',
        priority: 2,
        status: 'todo'
    },

    // Bugs & Fixes
    {
        title: 'Fix: Saturación de audio en K-Meter',
        description: 'Resolver problema de saturación cuando K-Meter está activo',
        feature: 'Audio Analysis Pipeline',
        priority: 10,
        status: 'done' // Ya resuelto según el README
    },
    {
        title: 'Fix: Conflictos de AudioContext',
        description: 'Resolver conflictos múltiples de AudioContext',
        feature: 'Audio Analysis Pipeline',
        priority: 10,
        status: 'done' // Ya resuelto según el README
    }
];

async function createProject() {
    logInfo('🚀 Creando proyecto en Archon...');

    try {
        // Intentar crear proyecto via MCP
        const response = await fetch(`${MCP_API}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: 'manage_project',
                    arguments: {
                        action: 'create',
                        title: project.title,
                        description: project.description,
                        github_repo: project.github_repo
                    }
                },
                id: 1
            })
        });

        const result = await response.text();
        logInfo('✅ Proyecto creado:', result);
        return JSON.parse(result);
    } catch (error) {
        logError('❌ Error creando proyecto:', error);
        return null;
    }
}

async function createTasks(projectId) {
    logDebug('📝 Creando tareas...');

    for (const task of tasks) {
        try {
            const response = await fetch(`${MCP_API}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'tools/call',
                    params: {
                        name: 'manage_task',
                        arguments: {
                            action: 'create',
                            project_id: projectId,
                            title: task.title,
                            description: task.description,
                            feature: task.feature,
                            status: task.status,
                            task_order: task.priority
                        }
                    },
                    id: tasks.indexOf(task) + 2
                })
            });

            logInfo('✅ Tarea creada: ${task.title}');
        } catch (error) {
            logError(`❌ Error creando tarea "${task.title}":", error);
        }
    }
}

async function main() {
    logDebug('🎵 Music Analyzer Pro - Setup en Archon');
    logDebug('=========================================\n');

    // Crear proyecto
    const projectResult = await createProject();

    if (projectResult && projectResult.result) {
        const projectId = projectResult.result.id || projectResult.result.project_id;

        if (projectId) {
            // Crear tareas
            await createTasks(projectId);

            logDebug('\n✨ ¡Setup completo!');
            logDebug('📊 Proyecto ID: ${projectId}');
            logDebug(`📝 ${tasks.length} tareas creadas`);
            logDebug('\n🎯 Próximos pasos:');
            logDebug('1. Ve a http://localhost:3737');
            logDebug('2. Navega a Projects para ver tu proyecto');
            logDebug('3. Comienza con las tareas de mayor prioridad');
        }
    } else {
        logDebug('\n⚠️  Nota: El proyecto puede haberse creado pero sin ID de respuesta.');
        logDebug('Verifica en http://localhost:3737 en la sección Projects');
    }
}

// Ejecutar
main().catch(console.error);
