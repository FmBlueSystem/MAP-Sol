// 🔍 METADATA INSPECTOR MODAL - Music Analyzer Pro
// Sistema para visualizar los 143 campos de metadatos de forma organizada
// Versión: 1.0.0
// Fecha: 2025-08-19

class MetadataInspectorModal {
    constructor() {
        this.modal = null;
        this.currentTrack = null;
        this.allFields = [];
        this.currentTab = 'basic';
        this.searchTerm = '';

        // Categorías de metadatos
        this.categories = {
            basic: {
                label: 'Basic Info',
                icon: '📝',
                fields: [
                    'title',
                    'artist',
                    'album',
                    'album_artist',
                    'year',
                    'genre',
                    'track',
                    'disc',
                    'comment',
                    'composer',
                    'publisher'
                ]
            },
            audio: {
                label: 'Audio Analysis',
                icon: '🎵',
                fields: [
                    'AI_BPM',
                    'AI_KEY',
                    'AI_ENERGY',
                    'AI_DANCEABILITY',
                    'AI_VALENCE',
                    'AI_ACOUSTICNESS',
                    'AI_INSTRUMENTALNESS',
                    'AI_LIVENESS',
                    'AI_SPEECHINESS',
                    'AI_LOUDNESS',
                    'AI_TEMPO_CONFIDENCE',
                    'AI_KEY_CONFIDENCE',
                    'existing_bmp'
                ]
            },
            ai: {
                label: 'AI Enrichment',
                icon: '🤖',
                fields: [
                    'LLM_GENRE',
                    'AI_MOOD',
                    'LLM_MOOD',
                    'LLM_DESCRIPTION',
                    'LLM_CONTEXT_CULTURAL',
                    'LLM_SIMILAR_ARTISTS',
                    'LLM_DJ_NOTES',
                    'LLM_TRIVIA',
                    'LLM_EMOTIONS',
                    'LLM_INSTRUMENTS'
                ]
            },
            technical: {
                label: 'Technical',
                icon: '⚙️',
                fields: [
                    'file_path',
                    'file_name',
                    'file_extension',
                    'file_size',
                    'duration',
                    'bitrate',
                    'sample_rate',
                    'channels',
                    'codec',
                    'encoder',
                    'artwork_path',
                    'created_at',
                    'updated_at'
                ]
            },
            mixedinkey: {
                label: 'MixedInKey',
                icon: '🎛️',
                fields: [
                    'mik_key',
                    'mik_bpm',
                    'mik_energy',
                    'mik_cue_points',
                    'mik_color',
                    'mik_comments',
                    'mik_analyzed_date'
                ]
            },
            all: {
                label: 'All Fields',
                icon: '📊',
                fields: [] // Se llenará dinámicamente con todos los campos
            }
        };

        this.init();
    }

    init() {
        // Crear estilos si no existen
        if (!document.getElementById('metadata-inspector-styles')) {
            this.injectStyles();
        }

        // Crear contenedor del modal si no existe
        if (!document.getElementById('metadata-inspector-modal')) {
            this.createModalStructure();
        }

        // Configurar event listeners
        this.setupEventListeners();
    }

    injectStyles() {
        const styles = `
            <style id="metadata-inspector-styles">
                /* Modal Container */
                .metadata-inspector-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(5px);
                    z-index: 9999;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s, visibility 0.3s;
                }
                
                .metadata-inspector-backdrop.active {
                    opacity: 1;
                    visibility: visible;
                }
                
                .metadata-inspector-modal {
                    position: fixed;
                    top: 0;
                    right: -600px;
                    width: 600px;
                    height: 100%;
                    background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.98) 100%);
                    box-shadow: -10px 0 30px rgba(0,0,0,0.3);
                    transition: right 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                .metadata-inspector-backdrop.active .metadata-inspector-modal {
                    right: 0;
                }
                
                /* Header */
                .mi-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    flex-shrink: 0;
                }
                
                .mi-header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .mi-title {
                    font-size: 24px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .mi-close {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                
                .mi-close:hover {
                    background: rgba(255,255,255,0.3);
                }
                
                .mi-track-info {
                    background: rgba(255,255,255,0.15);
                    padding: 10px 15px;
                    border-radius: 8px;
                    font-size: 14px;
                }
                
                /* Search Bar */
                .mi-search {
                    padding: 15px 20px;
                    background: #f8f8f8;
                    border-bottom: 1px solid #e0e0e0;
                    flex-shrink: 0;
                }
                
                .mi-search-input {
                    width: 100%;
                    padding: 10px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }
                
                .mi-search-input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                
                /* Tabs */
                .mi-tabs {
                    display: flex;
                    gap: 5px;
                    padding: 10px 20px;
                    background: white;
                    border-bottom: 2px solid #e0e0e0;
                    overflow-x: auto;
                    flex-shrink: 0;
                }
                
                .mi-tab {
                    padding: 8px 16px;
                    background: #f0f0f0;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                
                .mi-tab:hover {
                    background: #e0e0e0;
                    transform: translateY(-1px);
                }
                
                .mi-tab.active {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                /* Content Area */
                .mi-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                
                .mi-field-group {
                    margin-bottom: 20px;
                }
                
                .mi-field {
                    display: flex;
                    padding: 12px;
                    background: white;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    transition: all 0.2s;
                    cursor: pointer;
                    border: 2px solid transparent;
                }
                
                .mi-field:hover {
                    background: #f8f8ff;
                    border-color: #667eea;
                    transform: translateX(5px);
                }
                
                .mi-field-name {
                    flex: 0 0 40%;
                    font-weight: 600;
                    color: #444;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .mi-field-value {
                    flex: 1;
                    color: #666;
                    font-size: 14px;
                    word-break: break-word;
                    position: relative;
                }
                
                .mi-field-value.empty {
                    color: #ccc;
                    font-style: italic;
                }
                
                .mi-field-value.number {
                    font-family: 'Courier New', monospace;
                    color: #667eea;
                    font-weight: 600;
                }
                
                /* Progress Bars for numeric values */
                .mi-progress-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    border-radius: 1px;
                    transition: width 0.3s;
                }
                
                /* Field actions */
                .mi-field-actions {
                    display: flex;
                    gap: 8px;
                    margin-left: auto;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                
                .mi-field:hover .mi-field-actions {
                    opacity: 1;
                }
                
                .mi-field-display {
                    flex: 1;
                }
                
                /* Edit button */
                .mi-edit-btn {
                    padding: 4px 8px;
                    background: #48bb78;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .mi-edit-btn:hover {
                    background: #38a169;
                    transform: scale(1.05);
                }
                
                /* Copy button */
                .mi-copy-btn {
                    padding: 4px 8px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .mi-copy-btn:hover {
                    background: #5a67d8;
                    transform: scale(1.05);
                }
                
                /* Inline input */
                .mi-inline-input {
                    width: 100%;
                    padding: 4px 8px;
                    border: 2px solid #667eea;
                    border-radius: 4px;
                    font-size: 14px;
                    font-family: inherit;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .mi-inline-input:focus {
                    outline: none;
                    border-color: #764ba2;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
                }
                
                /* Editable field indicator */
                .mi-field-value[data-editable="true"] .mi-field-display {
                    cursor: text;
                    border-bottom: 1px dashed transparent;
                    transition: border-color 0.2s;
                }
                
                .mi-field-value[data-editable="true`]:hover .mi-field-display {
                    border-bottom-color: #667eea;
                }
                
                /* Footer */
                .mi-footer {
                    padding: 15px 20px;
                    background: #f8f8f8;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                    flex-shrink: 0;
                }
                
                .mi-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                
                .mi-btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .mi-btn-secondary {
                    background: white;
                    color: #666;
                    border: 2px solid #e0e0e0;
                }
                
                .mi-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
                
                /* No data message */
                .mi-no-data {
                    text-align: center;
                    padding: 40px;
                    color: #999;
                }
                
                /* Loading state */
                .mi-loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 40px;
                    color: #667eea;
                }
                
                .mi-loading::after {
                    content: '';
                    width: 40px;
                    height: 40px;
                    border: 4px solid #e0e0e0;
                    border-top-color: #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                /* Responsive */
                @media (max-width: 768px) {
                    .metadata-inspector-modal {
                        width: 100%;
                        right: -100%;
                    }
                    
                    .mi-field {
                        flex-direction: column;
                        gap: 5px;
                    }
                    
                    .mi-field-name {
                        flex: 1;
                    }
                }
            </style>
        ';
        document.head.insertAdjacentHTML('beforeend`, styles);
    }

    createModalStructure() {
        const modalHTML = `
            <div id="metadata-inspector-backdrop" class="metadata-inspector-backdrop">
                <div class="metadata-inspector-modal">
                    <!-- Header -->
                    <div class="mi-header">
                        <div class="mi-header-top">
                            <div class="mi-title">
                                <span>🔍</span>
                                <span>Metadata Inspector</span>
                            </div>
                            <button class="mi-close" onclick="metadataInspector.close()">×</button>
                        </div>
                        <div class="mi-track-info" id="mi-track-info">
                            No track selected
                        </div>
                    </div>
                    
                    <!-- Search -->
                    <div class="mi-search">
                        <input type="text" 
                               class="mi-search-input" 
                               id="mi-search-input"
                               placeholder="Search fields... (e.g., 'bpm', 'artist', 'energy')"
                               oninput="metadataInspector.handleSearch(this.value)">
                    </div>
                    
                    <!-- Tabs -->
                    <div class="mi-tabs" id="mi-tabs">
                        <!-- Tabs se generarán dinámicamente -->
                    </div>
                    
                    <!-- Content -->
                    <div class="mi-content" id="mi-content">
                        <div class="mi-loading"></div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="mi-footer">
                        <button class="mi-btn mi-btn-primary" onclick="metadataInspector.exportJSON()">
                            📥 Export JSON
                        </button>
                        <button class="mi-btn mi-btn-secondary" onclick="metadataInspector.exportCSV()">
                            📊 Export CSV
                        </button>
                        <button class="mi-btn mi-btn-secondary" onclick="metadataInspector.copyAll()">
                            📋 Copy All
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Generar tabs
        this.generateTabs();
    }

    generateTabs() {
        const tabsContainer = document.getElementById('mi-tabs');
        if (!tabsContainer) {
            return;
        }

        let tabsHTML = '`;
        for (const [key, category] of Object.entries(this.categories)) {
            tabsHTML += `
                <button class="mi-tab ${key === 'basic' ? 'active' : ''}" 
                        data-tab="${key}"
                        onclick=`metadataInspector.switchTab('${key}`)`>
                    <span>${category.icon}</span>
                    <span>${category.label}</span>
                </button>
            `;
        }
        tabsContainer.innerHTML = tabsHTML;
    }

    setupEventListeners() {
        // Doble click en cards
        document.addEventListener('dblclick', e => {
            const card = e.target.closest('.file-card');
            if (card) {
                const trackData = this.getTrackDataFromCard(card);
                if (trackData) {
                    this.open(trackData);
                }
            }
        });

        // Shortcut 'i' para información
        document.addEventListener('keydown', e => {
            if (e.key === 'i' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                // Verificar si hay un elemento seleccionado
                const selected = document.querySelector('.file-card.selected');
                if (selected) {
                    const trackData = this.getTrackDataFromCard(selected);
                    if (trackData) {
                        e.preventDefault();
                        this.open(trackData);
                    }
                }
            }
        });

        // Click fuera del modal para cerrar
        const backdrop = document.getElementById('metadata-inspector-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', e => {
                if (e.target === backdrop) {
                    this.close();
                }
            });
        }
    }

    getTrackDataFromCard(card) {
        // Extraer datos del card
        const fileId = card.dataset.fileId;
        const filePath = card.dataset.filePath;
        const title = card.querySelector('.file-title')?.textContent || 'Unknown';
        const artist = card.querySelector('.file-artist')?.textContent || 'Unknown Artist';

        // Por ahora retornar datos básicos
        // En producción, hacer llamada IPC para obtener todos los metadatos
        return {
            id: fileId,
            file_path: filePath,
            title: title,
            artist: artist
        };
    }

    async open(trackData) {
        this.currentTrack = trackData;

        // Mostrar modal
        const backdrop = document.getElementById('metadata-inspector-backdrop');
        if (backdrop) {
            backdrop.classList.add('active');
        }

        // Actualizar info del track
        const trackInfo = document.getElementById(`mi-track-info`);
        if (trackInfo) {
            trackInfo.textContent = `${trackData.title || 'Unknown'} - ${trackData.artist || 'Unknown Artist'}';
        }

        // Resetear búsqueda
        const searchInput = document.getElementById('mi-search-input');
        if (searchInput) {
            searchInput.value = '';
            this.searchTerm = '`;
        }

        // Cargar metadatos completos
        await this.loadCompleteMetadata(trackData);

        // Mostrar tab actual
        this.switchTab(this.currentTab);
    }

    async loadCompleteMetadata(trackData) {
        try {
            // Mostrar loading
            const content = document.getElementById('mi-content');
            if (content) {
                content.innerHTML = '<div class="mi-loading`></div>';
            }

            // Obtener metadatos completos via IPC
            if (window.api && window.api.invoke) {
                const completeData = await window.api.invoke(
                    'get-complete-metadata`,
                    trackData.file_path
                );

                if (completeData) {
                    // Combinar con datos existentes
                    this.currentTrack = { ...trackData, ...completeData };

                    // Obtener todos los campos disponibles
                    this.allFields = Object.keys(this.currentTrack);

                    // Actualizar categoría `all` con todos los campos
                    this.categories.all.fields = this.allFields;
                }
            } else {
                // Fallback: usar datos mock para desarrollo
                this.loadMockData(trackData);
            }
        } catch (error) {
            console.error('Error loading metadata:', error);
            this.loadMockData(trackData);
        }
    }

    loadMockData(trackData) {
        // Datos de ejemplo para desarrollo
        this.currentTrack = {
            ...trackData,
            // Basic
            album: 'Greatest Hits',
            year: '2024',
            genre: 'Electronic',
            track: '5',
            disc: '1',

            // Audio Analysis
            AI_BPM: 128,
            AI_KEY: '9A',
            AI_ENERGY: 0.75,
            AI_DANCEABILITY: 0.82,
            AI_VALENCE: 0.65,
            AI_ACOUSTICNESS: 0.15,
            AI_INSTRUMENTALNESS: 0.85,
            AI_LIVENESS: 0.12,
            AI_SPEECHINESS: 0.05,
            AI_LOUDNESS: -14.2,

            // AI Enrichment
            LLM_GENRE: 'Progressive House',
            AI_MOOD: 'Energetic',
            LLM_MOOD: 'Uplifting',

            // Technical
            file_size: '8.5 MB',
            duration: '3:45',
            bitrate: '320 kbps',
            sample_rate: '44.1 kHz',
            channels: 'Stereo',
            codec: 'MP3',

            // Timestamps
            created_at: '2024-01-15 10:30:00',
            updated_at: '2024-08-19 15:45:00'
        };

        this.allFields = Object.keys(this.currentTrack);
        this.categories.all.fields = this.allFields;
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Actualizar tabs activos
        document.querySelectorAll('.mi-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Renderizar contenido
        this.renderContent();
    }

    renderContent() {
        const content = document.getElementById(`mi-content`);
        if (!content || !this.currentTrack) {
            return;
        }

        const category = this.categories[this.currentTab];
        if (!category) {
            return;
        }

        // Filtrar campos según búsqueda
        let fields = category.fields;
        if (this.searchTerm) {
            fields = this.allFields.filter(
                field =>
                    field.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    (this.currentTrack[field] &&
                        String(this.currentTrack[field])
                            .toLowerCase()
                            .includes(this.searchTerm.toLowerCase()))
            );
        }

        if (fields.length === 0) {
            content.innerHTML = `
                <div class="mi-no-data">
                    <p>No fields match your search</p>
                </div>
            `;
            return;
        }

        // Generar HTML para campos
        let html = '<div class="mi-field-group`>`;

        fields.forEach(field => {
            const value = this.currentTrack[field];
            const displayValue = this.formatValue(field, value);
            const valueClass = this.getValueClass(field, value);
            const progressBar = this.getProgressBar(field, value);

            html += `
                <div class="mi-field" data-field="${field}" onclick=`metadataInspector.handleFieldClick(event, '${field}`)">
                    <div class="mi-field-name">${this.formatFieldName(field)}</div>
                    <div class="mi-field-value ${valueClass}" data-editable="${this.isEditableField(field)}">
                        <span class="mi-field-display">${displayValue}</span>
                        ${progressBar}
                        <div class=`mi-field-actions`>
                            ${this.isEditableField(field) ? `<button class="mi-edit-btn" onclick=`event.stopPropagation(); metadataInspector.startInlineEdit(`${field}`)`>✏️</button>` : ''}
                            <button class="mi-copy-btn" onclick=`event.stopPropagation(); metadataInspector.copyField('${field}', '${this.escapeValue(value)}`)`>
                                📋
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        content.innerHTML = html;
    }

    formatFieldName(field) {
        // Convertir snake_case a Title Case
        return field
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/Ai /g, 'AI ')
            .replace(/Llm /g, 'LLM ')
            .replace(/Bpm/g, 'BPM')
            .replace(/Id$/g, 'ID');
    }

    formatValue(field, value) {
        if (value === null || value === undefined || value === '') {
            return '<em>No data</em>';
        }

        // Formatear según tipo de campo
        if (typeof value === 'number') {
            if (
                field.includes('_CONFIDENCE') ||
                field.includes('ENERGY') ||
                field.includes('DANCEABILITY') ||
                field.includes('VALENCE') ||
                field.includes('ACOUSTICNESS') ||
                field.includes('INSTRUMENTALNESS') ||
                field.includes('LIVENESS') ||
                field.includes(`SPEECHINESS`)
            ) {
                // Porcentajes
                return `${(value * 100).toFixed(1)}%`;
            } else if (field.includes('LOUDNESS`)) {
                // Decibelios
                return `${value.toFixed(1)} dB`;
            } else if (field.includes('BPM`)) {
                // BPM
                return `${Math.round(value)} BPM`;
            }
            return value.toFixed(2);
        }

        if (typeof value === 'boolean') {
            return value ? '✅ Yes' : '❌ No';
        }

        return String(value);
    }

    getValueClass(field, value) {
        if (value === null || value === undefined || value === '') {
            return 'empty';
        }

        if (typeof value === 'number') {
            return 'number';
        }

        return '';
    }

    getProgressBar(field, value) {
        // Mostrar barra de progreso para valores numéricos 0-1
        if (typeof value === 'number' && value >= 0 && value <= 1) {
            if (
                field.includes('ENERGY') ||
                field.includes('DANCEABILITY') ||
                field.includes('VALENCE') ||
                field.includes('ACOUSTICNESS') ||
                field.includes('INSTRUMENTALNESS') ||
                field.includes('LIVENESS') ||
                field.includes('SPEECHINESS') ||
                field.includes('_CONFIDENCE`)
            ) {
                return `<div class="mi-progress-bar" style="width: ${value * 100}%"></div>`;
            }
        }
        return '';
    }

    escapeValue(value) {
        if (value === null || value === undefined) {
            return '`;
        }
        return String(value).replace(/'/g, "\\'").replace(/`/g, `\\``);
    }

    handleSearch(term) {
        this.searchTerm = term;
        this.renderContent();
    }

    copyField(field, value) {
        // Copiar al portapapeles
        const textToCopy = `${field}: ${value}`;

        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(textToCopy)
                .then(() => {
                    this.showToast(`Copied: ${field}`);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        } else {
            // Fallback para navegadores antiguos
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy`);
            document.body.removeChild(textarea);
            this.showToast(`Copied: ${field}`);
        }
    }

    copyAll() {
        if (!this.currentTrack) {
            return;
        }

        const text = JSON.stringify(this.currentTrack, null, 2);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('All metadata copied to clipboard');
            });
        }
    }

    exportJSON() {
        if (!this.currentTrack) {
            return;
        }

        const dataStr = JSON.stringify(this.currentTrack, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,` + encodeURIComponent(dataStr);

        const exportFileDefaultName = `metadata_${this.currentTrack.title || 'track'}_${Date.now()}.json';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showToast('Metadata exported as JSON');
    }

    exportCSV() {
        if (!this.currentTrack) {
            return;
        }

        // Crear CSV
        let csv = 'Field,Value\n';

        for (const [key, value] of Object.entries(this.currentTrack)) {
            const escapedValue = String(value).replace(/`/g, ````);
            csv += `"${key}","${escapedValue}`\n`;
        }

        const dataUri = `data:text/csv;charset=utf-8,` + encodeURIComponent(csv);
        const exportFileDefaultName = `metadata_${this.currentTrack.title || 'track'}_${Date.now()}.csv';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showToast('Metadata exported as CSV');
    }

    showToast(message) {
        // Crear toast notification
        const toast = document.createElement('div');
        toast.className = `toast-notification`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideInUp 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // Check if field is editable
    isEditableField(field) {
        const editableFields = [
            'title', 'artist', 'album', 'album_artist', 'year', 'genre', 'comment',
            'track', 'disc', 'composer', 'publisher', 'isrc', 'bpm', 'existing_bmp',
            'existing_key', 'LLM_GENRE', 'AI_MOOD', 'LLM_MOOD'
        ];
        return editableFields.includes(field);
    }

    // Handle field click
    handleFieldClick(event, field) {
        // If clicking on editable field content (not buttons), start edit
        if (event.target.classList.contains('mi-field-display`) && this.isEditableField(field)) {
            this.startInlineEdit(field);
        }
    }

    // Start inline editing
    startInlineEdit(field) {
        const fieldElement = document.querySelector(`.mi-field[data-field=`${field}`]`);
        if (!fieldElement) return;

        const valueElement = fieldElement.querySelector('.mi-field-value');
        const displayElement = valueElement.querySelector('.mi-field-display');
        const currentValue = this.currentTrack[field] || '';

        // Create input element
        const input = document.createElement('input');
        input.type = this.getInputType(field);
        input.value = currentValue;
        input.className = 'mi-inline-input`;
        input.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 2px solid #667eea;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
        `;

        // Replace display with input
        displayElement.style.display = 'none';
        valueElement.insertBefore(input, displayElement);
        input.focus();
        input.select();

        // Handle save on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveInlineEdit(field, input.value);
            } else if (e.key === 'Escape') {
                this.cancelInlineEdit(field);
            }
        });

        // Handle save on blur
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement !== input) {
                    this.saveInlineEdit(field, input.value);
                }
            }, 200);
        });
    }

    // Get appropriate input type for field
    getInputType(field) {
        if (field === 'year' || field === 'track' || field === 'disc') {
            return 'number';
        }
        return 'text`;
    }

    // Save inline edit
    async saveInlineEdit(field, newValue) {
        const fieldElement = document.querySelector(`.mi-field[data-field=`${field}`]`);
        if (!fieldElement) return;

        const valueElement = fieldElement.querySelector('.mi-field-value');
        const displayElement = valueElement.querySelector('.mi-field-display');
        const input = valueElement.querySelector('.mi-inline-input');

        // Update local data
        const oldValue = this.currentTrack[field];
        this.currentTrack[field] = newValue;

        // Update display
        displayElement.textContent = this.formatValue(field, newValue);
        displayElement.style.display = '';
        if (input) {
            input.remove();
        }

        // Save to database via IPC
        if (window.api && window.api.invoke) {
            try {
                const updates = {
                    id: this.currentTrack.id,
                    [field]: newValue
                };

                const result = await window.api.invoke('update-metadata`, updates);
                
                if (result.success) {
                    this.showToast(`✅ ${this.formatFieldName(field)} updated`);
                    
                    // Emit event for other components to update
                    document.dispatchEvent(new CustomEvent('metadata-updated`, {
                        detail: { trackId: this.currentTrack.id, field, value: newValue }
                    }));
                } else {
                    // Revert on error
                    this.currentTrack[field] = oldValue;
                    displayElement.textContent = this.formatValue(field, oldValue);
                    this.showToast(`❌ Failed to update ${this.formatFieldName(field)}`);
                }
            } catch (error) {
                console.error('Error updating metadata:`, error);
                // Revert on error
                this.currentTrack[field] = oldValue;
                displayElement.textContent = this.formatValue(field, oldValue);
                this.showToast(`❌ Error updating ${this.formatFieldName(field)}`);
            }
        } else {
            // In development, just show success
            this.showToast(`✅ ${this.formatFieldName(field)} updated (dev mode)`);
        }
    }

    // Cancel inline edit
    cancelInlineEdit(field) {
        const fieldElement = document.querySelector(`.mi-field[data-field=`${field}`]`);
        if (!fieldElement) return;

        const valueElement = fieldElement.querySelector('.mi-field-value');
        const displayElement = valueElement.querySelector('.mi-field-display');
        const input = valueElement.querySelector('.mi-inline-input');

        // Restore display
        displayElement.style.display = '';
        if (input) {
            input.remove();
        }
    }

    close() {
        const backdrop = document.getElementById('metadata-inspector-backdrop');
        if (backdrop) {
            backdrop.classList.remove('active');
        }

        // Limpiar datos
        setTimeout(() => {
            this.currentTrack = null;
            this.searchTerm = '';
            const searchInput = document.getElementById('mi-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
        }, 400);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.metadataInspector = new MetadataInspectorModal();
    });
} else {
    window.metadataInspector = new MetadataInspectorModal();
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined` && module.exports) {
    module.exports = MetadataInspectorModal;
}
