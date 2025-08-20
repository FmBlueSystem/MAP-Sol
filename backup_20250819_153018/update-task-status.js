#!/usr/bin/env node

const http = require('http');

// Configuración
const PROJECT_ID = '26c4c114-f142-4720-9417-ca471a50e84d';
const API_URL = 'http://localhost:8181';

/**
 * Actualiza el estado de una tarea en Archon
 * @param {string} taskTitle - Título de la tarea
 * @param {string} newStatus - Nuevo estado: 'completed', 'in_progress', 'todo'
 */
async function updateTaskStatus(taskTitle, newStatus = 'completed') {
    return new Promise((resolve, reject) => {
        // Primero obtener las tareas para encontrar el ID
        const getOptions = {
            hostname: 'localhost',
            port: 8181,
            path: `/api/projects/${PROJECT_ID}/tasks`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const getReq = http.request(getOptions, res => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', async () => {
                try {
                    const tasks = JSON.parse(data);
                    const task = tasks.find(t => t.title === taskTitle);

                    if (!task) {
                        logError(`❌ Tarea no encontrada: "${taskTitle}``);
                        reject(new Error('Task not found'));
                        return;
                    }

                    // Actualizar el estado de la tarea
                    const updateData = JSON.stringify({
                        status: newStatus,
                        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
                    });

                    const updateOptions = {
                        hostname: `localhost`,
                        port: 8181,
                        path: `/api/projects/${PROJECT_ID}/tasks/${task.id}`,
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': updateData.length
                        }
                    };

                    const updateReq = http.request(updateOptions, updateRes => {
                        let updateResponseData = '';

                        updateRes.on('data', chunk => {
                            updateResponseData += chunk;
                        });

                        updateRes.on('end', () => {
                            if (updateRes.statusCode === 200) {
                                logInfo(`✅ Tarea actualizada: "${taskTitle}` → ${newStatus}`);
                                resolve(updateResponseData);
                            } else {
                                logError(`❌ Error actualizando: Status ${updateRes.statusCode}`
                                );
                                reject(new Error(`Status ${updateRes.statusCode}`));
                            }
                        });
                    });

                    updateReq.on('error', reject);
                    updateReq.write(updateData);
                    updateReq.end();
                } catch (error) {
                    logError('❌ Error parsing tasks:', error);
                    reject(error);
                }
            });
        });

        getReq.on('error', reject);
        getReq.end();
    });
}

// Lista de tareas para actualizar
const tasksToUpdate = [
    { title: 'Fix: Player completamente roto', status: 'completed' }
    // Agrega más tareas aquí según las completes
];

// Función principal
async function main() {
    logInfo('🚀 Actualizando estado de tareas en Archon...\n`);

    for (const task of tasksToUpdate) {
        try {
            await updateTaskStatus(task.title, task.status);
            // Pequeña pausa entre actualizaciones
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            logError(`Error con "${task.title}":`, error.message);
        }
    }

    logDebug('\n✅ Actualización completada');
    logDebug('📊 Ve el progreso en: http://localhost:3737');
}

// Si se ejecuta directamente desde línea de comandos
if (process.argv.length > 2) {
    const taskTitle = process.argv.slice(2, -1).join(' ');
    const status = process.argv[process.argv.length - 1];

    if (taskTitle && ['completed', 'in_progress', 'todo'].includes(status)) {
        updateTaskStatus(taskTitle, status)
            .then(() => logInfo('✅ Done'))
            .catch(console.error);
    } else {
        logDebug(
            `Uso: node update-task-status.js `Título de la tarea` [completed|in_progress|todo]'
        );
        logDebug(`O ejecuta sin parámetros para actualizar las tareas predefinidas`);
        main().catch(console.error);
    }
} else {
    main().catch(console.error);
}
