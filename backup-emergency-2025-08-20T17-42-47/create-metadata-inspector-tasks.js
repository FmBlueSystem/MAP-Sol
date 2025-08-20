#!/usr/bin/env node

const http = require('http');

const PROJECT_ID = '26c4c114-f142-4720-9417-ca471a50e84d'; // Music Analyzer Pro
const API_URL = 'http://localhost:8181';

// Las 10 tareas del Metadata Inspector Modal
const tasks = [
    {
        title: 'Crear Modal Component Base para Metadata Inspector',
        description:
            'Implementar estructura HTML/CSS del modal con tabs y secciones para mostrar 143 campos de metadata. Incluir diseño responsive y animaciones smooth.',
        status: 'todo',
        task_order: 10,
        feature: 'UI Component',
    },
    {
        title: 'Implementar Categorización de 143 Campos',
        description:
            'Crear lógica para agrupar los 143 campos en categorías lógicas: Basic, Audio, AI/LLM, Technical, Artwork, Analysis. Mapear cada campo a su categoría correspondiente.',
        status: 'todo',
        task_order: 9,
        feature: 'Data Processing',
    },
    {
        title: 'Agregar Búsqueda y Filtrado en Tiempo Real',
        description:
            'Implementar búsqueda fuzzy across all 143 fields con highlighting de resultados. Filtros por categoría, tipo de dato, campos vacíos/llenos.',
        status: 'todo',
        task_order: 8,
        feature: 'Search',
    },
    {
        title: 'Implementar Edición Inline de Campos',
        description:
            "Permitir editar valores directamente en el modal con validación por tipo de dato. Guardar cambios via IPC handler 'update-complete-metadata'.",
        status: 'todo',
        task_order: 8,
        feature: 'CRUD',
    },
    {
        title: 'Agregar Exportación Multi-formato',
        description:
            'Export metadata completa a JSON, CSV, XML con opciones de selección de campos. Incluir templates predefinidos para diferentes usos.',
        status: 'todo',
        task_order: 7,
        feature: 'Export',
    },
    {
        title: 'Crear Vista de Árbol para Datos Anidados',
        description:
            'Tree view colapsable para objetos JSON complejos en campos como llm_metadata. Expandir/colapsar con animaciones smooth.',
        status: 'todo',
        task_order: 7,
        feature: 'UI Component',
    },
    {
        title: 'Implementar Estadísticas de Campos',
        description:
            'Dashboard mostrando: campos null vs llenos, tipos de datos, tamaño de valores, campos más/menos usados. Gráficos con Chart.js.',
        status: 'todo',
        task_order: 6,
        feature: 'Analytics',
    },
    {
        title: 'Agregar Comparación Entre Archivos',
        description:
            'Comparar metadata de 2+ archivos lado a lado. Highlighting de diferencias. Export de comparación.',
        status: 'todo',
        task_order: 6,
        feature: 'Comparison',
    },
    {
        title: 'Crear Historial de Cambios',
        description:
            'Track todos los cambios en metadata con timestamp y usuario. Función undo/redo. Revertir a versión anterior.',
        status: 'todo',
        task_order: 5,
        feature: 'Version Control',
    },
    {
        title: 'Implementar Atajos de Teclado',
        description:
            'Ctrl+F buscar, Ctrl+E editar campo actual, Tab navegar campos, ESC cerrar modal, Ctrl+S guardar cambios, Ctrl+C copiar valor.',
        status: 'todo',
        task_order: 5,
        feature: 'UX',
    }
];

async function createTask(task) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            ...task,
            project_id: PROJECT_ID,
            assignee: 'Developer',
        });

        const options = {
            hostname: 'localhost',
            port: 8181,
            path: `/api/projects/${PROJECT_ID}/tasks`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
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

        req.on('error', (error) => {
            logError(`❌ Error de conexión: ${error.message}`);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function createAllTasks() {
    logDebug('🧠 CMD_BRAINSTORM: Metadata Inspector Modal');
    logDebug('📋 Creando 10 tareas en Archon para implementar el inspector de 143 campos...\n');
    logDebug('📁 Proyecto: Music Analyzer Pro');
    logDebug(`🆔 ID: ${PROJECT_ID}\n`);

    let created = 0;
    let failed = 0;

    for (const task of tasks) {
        try {
            await createTask(task);
            created++;
            // Pequeña pausa para no sobrecargar el servidor
            await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
            failed++;
            logError(`Error detallado: ${error.message}`);
        }
    }

    logDebug('\n📊 Resumen del Brainstorm:');
    logInfo('✅ Tareas creadas: ${created}');
    logError('❌ Tareas fallidas: ${failed}');
    logDebug(`📋 Total de tareas del inspector: ${created}`);

    if (created > 0) {
        logDebug('\n🎯 Resultado del CMD_BRAINSTORM:');
        logDebug('El Metadata Inspector Modal permitirá:');
        logDebug('• Ver los 143 campos de metadata de cualquier archivo');
        logDebug('• Buscar y filtrar campos en tiempo real');
        logDebug('• Editar valores directamente');
        logDebug('• Exportar a múltiples formatos');
        logDebug('• Comparar metadata entre archivos');
        logDebug('\n💡 Próximo paso:');
        logDebug('Ve a http://localhost:3737 → Projects → Music Analyzer Pro');
        logDebug('Las tareas están ordenadas por prioridad para implementación');
    }
}

// Check if Archon is running
function checkArchonStatus() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:8181/health', (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

// Main execution
async function main() {
    logDebug('🔍 Verificando si Archon está ejecutándose...');

    const isRunning = await checkArchonStatus();

    if (!isRunning) {
        logError('❌ Archon no está ejecutándose en http://localhost:8181');
        logDebug('Por favor inicia Archon primero:');
        logDebug('cd "/Users/freddymolina/Desktop/Archon V2/Archon" && docker-compose up');
        process.exit(1);
    }

    logInfo('✅ Archon está activo\n');
    await createAllTasks();
}

// Execute
main().catch(console.error);
