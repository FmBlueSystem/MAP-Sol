/**
 * Enhanced View Fixed - Muestra TODOS los metadatos de los archivos
 */

async function showEnhancedView() {
    // Obtener datos de la aplicación
    let files = window.allFiles || window.currentFiles || [];

    // Si no hay archivos en memoria, intentar obtenerlos via IPC
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

    // Si aún no hay archivos, buscar en el DOM
    if (files.length === 0) {
        const cards = document.querySelectorAll('.card, .file-card');
        if (cards.length > 0) {
            files = [];
            cards.forEach(card => {
                // Intentar obtener los datos del card
                const fileData = card.dataset || {};
                if (Object.keys(fileData).length > 0) {
                    files.push(fileData);
                }
            });
        }
    }

    if (files.length === 0) {
        alert('No se pudieron obtener los archivos. Intenta recargar la página.');
        return;
    }

    // Crear modal overlay
    const existingModal = document.getElementById('enhanced-view-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'enhanced-view-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        z-index: 10000;
        overflow: auto;
        padding: 20px;
    `;

    // Contenido del modal
    modal.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <h2 style="color: white; margin: 0;">
                    📊 Vista Detallada de Metadatos
                    <span style="font-size: 16px; opacity: 0.8; margin-left: 10px;">
                        (${files.length} archivo${files.length !== 1 ? 's' : ''})
                    </span>
                </h2>
                <button onclick="document.getElementById('enhanced-view-modal').remove();" 
                        style="background: #ef4444; color: white; border: none; 
                               padding: 10px 20px; border-radius: 25px; cursor: pointer; 
                               font-size: 16px; font-weight: 600;">
                    ✕ Cerrar
                </button>
            </div>

            <div id="enhanced-cards-container">
                <!-- Cards se agregarán aquí -->
            </div>
        </div>
    ";

    document.body.appendChild(modal);

    // Container para las cards
    const container = document.getElementById('enhanced-cards-container');

    // Mostrar solo los primeros 10 archivos para no sobrecargar
    const filesToShow = files.slice(0, 10);

    filesToShow.forEach((file, index) => {
        const card = createEnhancedCard(file, index);
        container.innerHTML += card;
    });

    if (files.length > 10) {
        container.innerHTML += `
            <div style="text-align: center; padding: 40px; color: white;">
                <p style="opacity: 0.8;">Mostrando 10 de ${files.length} archivos</p>
                <p style="opacity: 0.6; font-size: 14px;">Para mejor rendimiento, solo se muestran los primeros 10 archivos</p>
            </div>
        ";
    }
}

function createEnhancedCard(file, index) {
    // Contar campos con valores
    const nonNullFields = Object.entries(file).filter(
        ([key, value]) => value !== null && value !== undefined && value !== ''
    );
    const fieldCount = nonNullFields.length;
    const totalFields = Object.keys(file).length;

    // Campos principales
    const title = file.title || file.file_name || 'Sin título';
    const artist = file.artist || 'Artista desconocido';
    const album = file.album || 'Álbum desconocido';
    const genre = file.LLM_GENRE || file.genre || 'Sin género';
    const bpm = file.AI_BPM || file.existing_bmp || '--';
    const key = file.AI_KEY || file.existing_key || '--';
    const energy = file.AI_ENERGY || 0;
    const mood = file.AI_MOOD || file.LLM_MOOD || '--';

    // Agrupar campos por categoría
    const categories = {
        'Información Básica': ['title', 'artist', 'album', 'genre', 'year', 'track', 'disc'],
        'Análisis Musical': [
            'AI_BPM',
            'AI_KEY',
            'AI_ENERGY',
            'AI_DANCEABILITY',
            'AI_VALENCE',
            'AI_ACOUSTICNESS',
            'AI_INSTRUMENTALNESS',
            'AI_LIVENESS',
            'AI_SPEECHINESS',
            'AI_LOUDNESS'
        ],
        MixedInKey: ['existing_bmp', 'existing_key', 'energy_level'],
        'Metadatos LLM': [
            'LLM_GENRE',
            'LLM_SUBGENRE',
            'LLM_MOOD',
            'LLM_DECADE',
            'LLM_INSTRUMENTS',
            'LLM_VOCAL_TYPE',
            'LLM_DESCRIPTION'
        ],
        'Información Técnica': [
            'file_path',
            'file_name',
            'file_extension',
            'duration',
            'bitrate',
            'sample_rate',
            'channels'
        ],
        Fechas: ['created_at', 'updated_at', 'analyzed_at'],
        Artwork: ['artwork_path', 'artwork_url', 'artwork_extracted']
    };

    return `
        <div style="background: rgba(255,255,255,0.05); border-radius: 15px; 
                    padding: 25px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.1);">

            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: start; 
                        border-bottom: 2px solid rgba(102, 126, 234, 0.3); 
                        padding-bottom: 15px; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0; font-size: 22px; color: white;">
                        ${index + 1}. ${title}
                    </h3>
                    <p style="margin: 5px 0; color: #a0a0a0; font-size: 16px;">${artist}</p>
                    <p style="margin: 5px 0; color: #808080; font-size: 14px;">${album}</p>
                </div>
                <div style="text-align: right;">
                    <div style="background: rgba(102, 126, 234, 0.2); padding: 8px 16px; 
                                border-radius: 20px; color: white; font-size: 14px;">
                        ${fieldCount}/${totalFields} campos
                    </div>
                </div>
            </div>

            <!-- Quick Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); 
                        gap: 15px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: white; font-size: 24px; font-weight: bold;">${bpm}</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 12px;">BPM</div>
                </div>
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                            padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: white; font-size: 24px; font-weight: bold;">${key}</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 12px;">KEY</div>
                </div>
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                            padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: white; font-size: 24px; font-weight: bold;">
                        ${Math.round(energy * 10)}/10
                    </div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 12px;">ENERGY</div>
                </div>
                <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); 
                            padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: white; font-size: 16px; font-weight: bold; 
                                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${mood}
                    </div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 12px;">MOOD</div>
                </div>
            </div>

            <!-- All Metadata Fields -->
            <details style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 5px;">
                <summary style="cursor: pointer; padding: 15px; font-weight: bold; color: white; 
                               list-style: none; user-select: none;">
                    📋 Ver todos los ${fieldCount} campos con datos
                    <span style="float: right; font-size: 20px;">▼</span>
                </summary>

                <div style="padding: 20px;">
                    ${Object.entries(categories)
                        .map(([category, fields]) => {
                            const categoryFields = fields.filter(
                                field =>
                                    file[field] !== null &&
                                    file[field] !== undefined &&
                                    file[field] !== ''
                            );

                            if (categoryFields.length === 0) {
                                return '';
                            }

                            return `
                            <div style="margin-bottom: 20px;">
                                <h4 style="color: #667eea; margin-bottom: 10px; font-size: 14px; 
                                          text-transform: uppercase; letter-spacing: 1px;">
                                    ${category}
                                </h4>
                                <div style="background: rgba(255,255,255,0.05); padding: 15px; 
                                           border-radius: 8px;">
                                    ${categoryFields
                                        .map(
                                            field => `
                                        <div style="display: flex; justify-content: space-between; 
                                                   padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <span style="color: #a0a0a0; font-size: 13px; font-family: monospace;">
                                                ${field}:
                                            </span>
                                            <span style="color: white; font-size: 13px; text-align: right; 
                                                       max-width: 70%; word-break: break-all; font-family: monospace;">
                                                ${formatValue(file[field])}
                                            </span>
                                        </div>
                                    ")
                                        .join('')}
                                </div>
                            </div>
                        ';
                        })
                        .join('')}

                    <!-- Otros campos no categorizados -->
                    ${(() => {
                        const allCategoryFields = Object.values(categories).flat();
                        const otherFields = nonNullFields.filter(
                            ([key]) => !allCategoryFields.includes(key)
                        );

                        if (otherFields.length === 0) {
                            return '';
                        }

                        return `
                            <div style="margin-bottom: 20px;">
                                <h4 style="color: #667eea; margin-bottom: 10px; font-size: 14px; 
                                          text-transform: uppercase; letter-spacing: 1px;">
                                    Otros Campos
                                </h4>
                                <div style="background: rgba(255,255,255,0.05); padding: 15px; 
                                           border-radius: 8px;">
                                    ${otherFields
                                        .map(
                                            ([key, value]) => `
                                        <div style="display: flex; justify-content: space-between; 
                                                   padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <span style="color: #a0a0a0; font-size: 13px; font-family: monospace;">
                                                ${key}:
                                            </span>
                                            <span style="color: white; font-size: 13px; text-align: right; 
                                                       max-width: 70%; word-break: break-all; font-family: monospace;">
                                                ${formatValue(value)}
                                            </span>
                                        </div>
                                    ")
                                        .join('')}
                                </div>
                            </div>
                        ';
                    })()}
                </div>
            </details>
        </div>
    ';
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '--';
    }
    if (typeof value === 'boolean') {
        return value ? '✓' : '✗';
    }
    if (typeof value === 'number') {
        if (value % 1 === 0) {
            return value.toString();
        }
        return value.toFixed(3);
    }
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return value.toString();
}

// Hacer la función global
window.showEnhancedView = showEnhancedView;
