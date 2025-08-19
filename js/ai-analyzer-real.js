/**
 * AI Analyzer Real - Muestra el estado REAL del análisis
 * No simula, muestra datos reales de la base de datos
 */

async function openAIAnalyzer() {
    // Obtener archivos y su estado real
    let files = window.allFiles || window.AppState?.allFiles || [];

    if (files.length === 0 && window.electronAPI) {
        try {
            const result = await window.electronAPI.invoke('get-files-with-cached-artwork', {
                limit: 100
            });
            if (result && result.files) {
                files = result.files;
            }
        } catch (error) {
            console.error('Error obteniendo archivos:', error);
        }
    }

    // Analizar el estado real de los archivos
    const analysisStatus = analyzeFilesStatus(files);

    // Crear modal con información REAL
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; background: white; border-radius: 16px; padding: 0; overflow: hidden;">
            <div class="modal-header" style="background: linear-gradient(135deg, #9333ea 0%, #c026d3 100%); padding: 20px; color: white; position: relative;">
                <h2 style="margin: 0;">✨ Estado del Análisis de tu Biblioteca</h2>
                <button onclick="this.closest('.modal-backdrop').remove()" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 20px;">×</button>
            </div>
            <div class="modal-body" style="padding: 30px;">
                ${renderAnalysisStatus(analysisStatus, files)}
            </div>
        </div>
    ";

    document.body.appendChild(modal);
}

function analyzeFilesStatus(files) {
    const status = {
        totalFiles: files.length,
        withBasicMetadata: 0,
        withMixedInKey: 0,
        withAIAnalysis: 0,
        withLLMEnrichment: 0,
        withArtwork: 0,
        fullyAnalyzed: 0,
        missingFields: {
            bpm: 0,
            key: 0,
            energy: 0,
            genre: 0,
            mood: 0,
            artwork: 0
        }
    };

    files.forEach(file => {
        // Verificar metadatos básicos
        if (file.title && file.artist) {
            status.withBasicMetadata++;
        }

        // Verificar análisis MixedInKey
        if (file.existing_bmp || file.existing_key || file.energy_level) {
            status.withMixedInKey++;
        }

        // Verificar análisis AI
        if (file.AI_BPM || file.AI_KEY || file.AI_ENERGY) {
            status.withAIAnalysis++;
        }

        // Verificar enriquecimiento LLM
        if (file.LLM_GENRE || file.LLM_MOOD) {
            status.withLLMEnrichment++;
        }

        // Verificar artwork
        if (file.artwork_path || file.has_artwork) {
            status.withArtwork++;
        }

        // Verificar campos faltantes
        if (!file.AI_BPM && !file.existing_bmp) {
            status.missingFields.bpm++;
        }
        if (!file.AI_KEY && !file.existing_key) {
            status.missingFields.key++;
        }
        if (!file.AI_ENERGY && !file.energy_level) {
            status.missingFields.energy++;
        }
        if (!file.genre && !file.LLM_GENRE) {
            status.missingFields.genre++;
        }
        if (!file.AI_MOOD && !file.LLM_MOOD) {
            status.missingFields.mood++;
        }
        if (!file.artwork_path && !file.has_artwork) {
            status.missingFields.artwork++;
        }

        // Archivo completamente analizado
        const hasBPM = file.AI_BPM || file.existing_bmp;
        const hasKey = file.AI_KEY || file.existing_key;
        const hasEnergy = file.AI_ENERGY || file.energy_level;
        const hasGenre = file.genre || file.LLM_GENRE;
        const hasMood = file.AI_MOOD || file.LLM_MOOD;
        const hasArtwork = file.artwork_path || file.has_artwork;

        if (hasBPM && hasKey && hasEnergy && hasGenre && hasMood && hasArtwork) {
            status.fullyAnalyzed++;
        }
    });

    return status;
}

function renderAnalysisStatus(status, files) {
    const percentComplete =
        status.totalFiles > 0 ? Math.round((status.fullyAnalyzed / status.totalFiles) * 100) : 0;

    const needsAnalysis = status.fullyAnalyzed < status.totalFiles;

    // Si solo hay un archivo, mostrar sus detalles específicos
    if (files.length === 1) {
        const file = files[0];
        return `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 20px;">📊 Análisis del Archivo</h3>

                <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">
                        ${file.title || file.file_name || 'Sin título'}
                    </h4>
                    <p style="margin: 5px 0; color: #666;">
                        <strong>Artista:</strong> ${file.artist || 'Desconocido'}
                    </p>
                    ${file.album ? `<p style="margin: 5px 0; color: #666;"><strong>Álbum:</strong> ${file.album}</p>` : ''}
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
                    ${renderFieldStatus('BPM', file.AI_BPM || file.existing_bmp, file.AI_BPM || file.existing_bmp || '--')}
                    ${renderFieldStatus('Tonalidad', file.AI_KEY || file.existing_key, file.AI_KEY || file.existing_key || '--')}
                    ${renderFieldStatus(
                        'Energía',
                        file.AI_ENERGY || file.energy_level,
                        file.AI_ENERGY
                            ? `${Math.round(file.AI_ENERGY * 10)}/10`
                            : file.energy_level
                              ? `${Math.round(file.energy_level * 10)}/10`
                              : '--'
                    )}
                    ${renderFieldStatus('Género', file.LLM_GENRE || file.genre, file.LLM_GENRE || file.genre || '--')}
                    ${renderFieldStatus('Mood', file.AI_MOOD || file.LLM_MOOD, file.AI_MOOD || file.LLM_MOOD || '--')}
                    ${renderFieldStatus(
                        'Carátula',
                        file.artwork_path || file.has_artwork,
                        file.artwork_path || file.has_artwork ? 'Disponible' : 'No disponible'
                    )}
                </div>

                <div style="background: ${percentComplete === 100 ? '#d4edda' : '#fff3cd'}; 
                            padding: 15px; border-radius: 8px; margin-bottom: 20px;
                            border: 1px solid ${percentComplete === 100 ? '#c3e6cb' : '#ffeeba'};">
                    <strong style="color: ${percentComplete === 100 ? '#155724' : '#856404'};">
                        ${percentComplete === 100 ? '✅ Archivo completamente analizado' : '⚠️ Análisis incompleto'}
                    </strong>
                    <div style="margin-top: 10px;">
                        <div style="background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden;">
                            <div style="background: ${percentComplete === 100 ? '#28a745' : '#ffc107'}; 
                                       height: 100%; width: ${percentComplete}%; transition: width 0.5s;">
                            </div>
                        </div>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
                            ${status.fullyAnalyzed} de ${status.totalFiles} campos completos
                        </p>
                    </div>
                </div>

                ${
                    needsAnalysis
                        ? `
                    <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976D2;">Opciones de Análisis Disponibles:</h4>
                        <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
                            ${!file.AI_BPM && !file.existing_bmp ? '<li>🎵 Análisis de BPM con Essentia</li>' : ''}
                            ${!file.AI_KEY && !file.existing_key ? '<li>🎼 Detección de tonalidad</li>' : ''}
                            ${!file.LLM_GENRE && !file.genre ? '<li>🏷️ Clasificación de género con AI</li>' : ''}
                            ${!file.AI_MOOD && !file.LLM_MOOD ? '<li>😊 Análisis de mood</li>' : ''}
                            ${!file.artwork_path && !file.has_artwork ? '<li>🎨 Búsqueda de carátula</li>' : ''}
                        </ul>
                        <p style="font-size: 13px; color: #666; margin: 10px 0 0 0;">
                            Para completar el análisis, ejecuta los scripts de análisis desde la terminal.
                        </p>
                    </div>
                `
                        : ''
                }

                <button onclick="this.closest('.modal-backdrop').remove()" style="
                    background: ${needsAnalysis ? '#6c757d' : '#28a745'};
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                ">
                    ${needsAnalysis ? 'Cerrar' : '✅ Completado'}
                </button>
            </div>
        ';
    }

    // Vista para múltiples archivos
    return `
        <div>
            <h3 style="text-align: center; margin-bottom: 25px;">📊 Estado de tu Biblioteca Musical</h3>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 25px;">
                <div style="background: #f0f8ff; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 36px; font-weight: bold; color: #2196F3;">
                        ${status.totalFiles}
                    </div>
                    <div style="color: #666; font-size: 14px;">Archivos Totales</div>
                </div>
                <div style="background: ${percentComplete === 100 ? '#d4edda' : '#fff3cd'}; 
                            padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 36px; font-weight: bold; 
                               color: ${percentComplete === 100 ? '#28a745' : '#ffc107'};">
                        ${percentComplete}%
                    </div>
                    <div style="color: #666; font-size: 14px;">Completado</div>
                </div>
            </div>

            <div style="margin-bottom: 25px;">
                <h4 style="margin-bottom: 15px;">Estado del Análisis:</h4>
                <div style="display: grid; gap: 10px;">
                    ${renderProgressBar('Metadatos Básicos', status.withBasicMetadata, status.totalFiles)}
                    ${renderProgressBar('Análisis MixedInKey', status.withMixedInKey, status.totalFiles)}
                    ${renderProgressBar('Análisis AI (Essentia)', status.withAIAnalysis, status.totalFiles)}
                    ${renderProgressBar('Enriquecimiento LLM', status.withLLMEnrichment, status.totalFiles)}
                    ${renderProgressBar('Carátulas', status.withArtwork, status.totalFiles)}
                </div>
            </div>

            ${
                needsAnalysis
                    ? `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; 
                           border-left: 4px solid #ffc107; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">Campos Faltantes:</h4>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${status.missingFields.bpm > 0 ? `<li>${status.missingFields.bpm} archivos sin BPM</li>` : ''}
                        ${status.missingFields.key > 0 ? `<li>${status.missingFields.key} archivos sin tonalidad</li>` : ''}
                        ${status.missingFields.energy > 0 ? `<li>${status.missingFields.energy} archivos sin energía</li>` : ''}
                        ${status.missingFields.genre > 0 ? `<li>${status.missingFields.genre} archivos sin género</li>` : ''}
                        ${status.missingFields.mood > 0 ? `<li>${status.missingFields.mood} archivos sin mood</li>` : ''}
                        ${status.missingFields.artwork > 0 ? `<li>${status.missingFields.artwork} archivos sin carátula</li>` : ''}
                    </ul>
                </div>
            `
                    : `
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; 
                           border-left: 4px solid #28a745; margin-bottom: 20px;">
                    <h4 style="margin: 0; color: #155724;">
                        ✅ ¡Todos los archivos están completamente analizados!
                    </h4>
                </div>
            "}

            <div style="text-align: center;">
                <button onclick="this.closest('.modal-backdrop').remove()" style="
                    background: ${needsAnalysis ? '#6c757d' : '#28a745'};
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                ">
                    Cerrar
                </button>
            </div>
        </div>
    ";
}

function renderFieldStatus(label, hasValue, value) {
    const color = hasValue ? '#28a745' : '#dc3545';
    const icon = hasValue ? '✅' : '❌';

    return `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; 
                   border-left: 3px solid ${color};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: #333;">${label}</span>
                <span style="font-size: 18px;">${icon}</span>
            </div>
            <div style="color: ${hasValue ? '#666' : '#999'}; font-size: 14px; margin-top: 5px;">
                ${value}
            </div>
        </div>
    ";
}

function renderProgressBar(label, current, total) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const color = percent === 100 ? '#28a745' : percent > 50 ? '#ffc107' : '#dc3545';

    return `
        <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 14px; color: #666;">${label}</span>
                <span style="font-size: 14px; color: #666;">${current}/${total}</span>
            </div>
            <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: ${color}; height: 100%; width: ${percent}%; transition: width 0.5s;"></div>
            </div>
        </div>
    ";
}

// Hacer la función global
window.openAIAnalyzer = openAIAnalyzer;
