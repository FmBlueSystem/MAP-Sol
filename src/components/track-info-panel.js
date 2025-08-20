// Track Info Panel - Muestra TODOS los datos analizados
class TrackInfoPanel {
    constructor() {
        this.currentTrack = null;
        this.isExpanded = true;
        this.panel = null;
        this.init();
    }

    init() {
        this.createPanel();
        this.attachEventListeners();
        this.loadLastTrack();
    }

    createPanel() {
        // Crear el panel HTML
        const panelHTML = `
            <div id="track-info-panel" class="track-info-panel ${this.isExpanded ? 'expanded' : 'collapsed'}">
                <div class="panel-header">
                    <h3>Track Analysis</h3>
                    <button class="toggle-btn" title="Toggle Panel">
                        <span class="icon">◀</span>
                    </button>
                </div>
                
                <div class="panel-content">
                    <!-- Artwork y Info Básica -->
                    <div class="track-basic-info">
                        <img class="track-artwork" src="image.png" alt="Track artwork">
                        <div class="track-details">
                            <h4 class="track-title">No track selected</h4>
                            <p class="track-artist">Select a track to view analysis</p>
                            <p class="track-album"></p>
                        </div>
                    </div>

                    <!-- Métricas Principales -->
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">BPM</span>
                            <span class="metric-value" data-field="bpm">--</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Key</span>
                            <span class="metric-value" data-field="key">--</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Energy</span>
                            <div class="metric-bar">
                                <div class="metric-fill energy-fill" style="width: 0%"></div>
                            </div>
                            <span class="metric-percent" data-field="energy">0%</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Danceability</span>
                            <div class="metric-bar">
                                <div class="metric-fill dance-fill" style="width: 0%"></div>
                            </div>
                            <span class="metric-percent" data-field="danceability">0%</span>
                        </div>
                    </div>

                    <!-- HAMMS Radar Chart -->
                    <div class="radar-section">
                        <h4>HAMMS Analysis (7 Dimensions)</h4>
                        <canvas id="hamms-radar" width="250" height="250"></canvas>
                    </div>

                    <!-- Análisis Detallado -->
                    <div class="detailed-analysis">
                        <h4>Detailed Analysis</h4>
                        
                        <div class="analysis-group">
                            <h5>Audio Features</h5>
                            <div class="feature-list">
                                <div class="feature-item">
                                    <span class="feature-label">Valence:</span>
                                    <span class="feature-value" data-field="valence">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Acousticness:</span>
                                    <span class="feature-value" data-field="acousticness">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Instrumentalness:</span>
                                    <span class="feature-value" data-field="instrumentalness">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Liveness:</span>
                                    <span class="feature-value" data-field="liveness">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Speechiness:</span>
                                    <span class="feature-value" data-field="speechiness">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Loudness:</span>
                                    <span class="feature-value" data-field="loudness">-- dB</span>
                                </div>
                            </div>
                        </div>

                        <div class="analysis-group">
                            <h5>Musical Context</h5>
                            <div class="feature-list">
                                <div class="feature-item">
                                    <span class="feature-label">Mode:</span>
                                    <span class="feature-value" data-field="mode">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Time Signature:</span>
                                    <span class="feature-value" data-field="time_signature">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Genre:</span>
                                    <span class="feature-value" data-field="genre">--</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-label">Mood:</span>
                                    <span class="feature-value" data-field="mood">--</span>
                                </div>
                            </div>
                        </div>

                        <div class="analysis-group">
                            <h5>Tags & Classification</h5>
                            <div class="tags-container" id="track-tags">
                                <!-- Tags dinámicos aquí -->
                            </div>
                        </div>
                    </div>

                    <!-- Acciones Rápidas -->
                    <div class="panel-actions">
                        <button class="action-btn" onclick="trackInfoPanel.findSimilar()">
                            🔍 Find Similar
                        </button>
                        <button class="action-btn" onclick="trackInfoPanel.analyzeDeep()">
                            🧬 Deep Analysis
                        </button>
                        <button class="action-btn" onclick="trackInfoPanel.exportData()">
                            📊 Export Data
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insertar el panel en el DOM
        const container = document.createElement('div');
        container.innerHTML = panelHTML;
        document.body.appendChild(container.firstElementChild);
        this.panel = document.getElementById('track-info-panel');
    }

    attachEventListeners() {
        // Toggle panel
        const toggleBtn = this.panel.querySelector('.toggle-btn');
        toggleBtn.addEventListener('click', () => this.togglePanel());

        // Escuchar eventos de selección de tracks
        document.addEventListener('trackSelected', (e) => {
            this.loadTrackData(e.detail);
        });

        // Escuchar playback events
        if (window.audioPlayer) {
            document.addEventListener('trackChanged', (e) => {
                this.loadTrackData(e.detail);
            });
        }
    }

    togglePanel() {
        this.isExpanded = !this.isExpanded;
        this.panel.classList.toggle('expanded');
        this.panel.classList.toggle('collapsed');

        const icon = this.panel.querySelector('.toggle-btn .icon');
        icon.textContent = this.isExpanded ? '◀' : '▶';

        // Guardar estado
        localStorage.setItem('trackInfoPanelExpanded', this.isExpanded);
    }

    async loadTrackData(trackId) {
        if (!trackId) {
            return;
        }

        try {
            // Obtener datos completos del track
            const response = await window.api.invoke('get-track-complete-data', trackId);
            if (response.success) {
                this.currentTrack = response.data;
                this.updatePanel(response.data);
            }
        } catch (error) {
            console.error('Error loading track data:', error);
        }
    }

    updatePanel(track) {
        if (!track) {
            return;
        }

        // Actualizar información básica
        this.panel.querySelector('.track-title').textContent = track.title || track.file_name;
        this.panel.querySelector('.track-artist').textContent = track.artist || 'Unknown Artist';
        this.panel.querySelector('.track-album').textContent = track.album || '';

        // Actualizar artwork
        const artwork = this.panel.querySelector('.track-artwork');
        if (track.artwork_url) {
            artwork.src = track.artwork_url;
        } else {
            artwork.src = 'image.png';
        }

        // Actualizar métricas principales
        this.updateMetric('bpm', track.AI_BPM || track.existing_bmp || '--');
        this.updateMetric('key', track.AI_KEY || track.existing_key || '--');
        this.updateMetric('energy', track.AI_ENERGY, true);
        this.updateMetric('danceability', track.AI_DANCEABILITY, true);

        // Actualizar features detallados
        this.updateMetric('valence', track.AI_VALENCE, true);
        this.updateMetric('acousticness', track.AI_ACOUSTICNESS, true);
        this.updateMetric('instrumentalness', track.AI_INSTRUMENTALNESS, true);
        this.updateMetric('liveness', track.AI_LIVENESS, true);
        this.updateMetric('speechiness', track.AI_SPEECHINESS, true);
        this.updateMetric('loudness', track.AI_LOUDNESS ? `${track.AI_LOUDNESS} dB` : '--');

        // Actualizar contexto musical
        this.updateMetric('mode', track.AI_MODE === 1 ? 'Major' : track.AI_MODE === 0 ? 'Minor' : '--');
        this.updateMetric('time_signature', track.AI_TIME_SIGNATURE || '--');
        this.updateMetric('genre', track.LLM_GENRE || track.genre || '--');
        this.updateMetric('mood', track.AI_MOOD || track.LLM_MOOD || '--');

        // Actualizar tags
        this.updateTags(track);

        // Dibujar radar chart
        this.drawRadarChart(track);
    }

    updateMetric(field, value, isPercentage = false) {
        const element = this.panel.querySelector(`[data-field="${field}"]`);
        if (!element) {
            return;
        }

        if (isPercentage && value !== null && value !== undefined) {
            const percent = Math.round(value * 100);
            element.textContent = `${percent}%`;

            // Actualizar barra si existe
            const card = element.closest('.metric-card');
            if (card) {
                const fill = card.querySelector('.metric-fill');
                if (fill) {
                    fill.style.width = `${percent}%`;
                    // Color basado en el valor
                    fill.style.background = this.getGradientColor(value);
                }
            }
        } else {
            element.textContent = value || '--';
        }
    }

    getGradientColor(value) {
        // Gradiente de color basado en el valor (0-1)
        if (value < 0.3) {
            return '#3498db';
        } // Azul
        if (value < 0.6) {
            return '#2ecc71';
        } // Verde
        if (value < 0.8) {
            return '#f39c12';
        } // Naranja
        return '#e74c3c'; // Rojo
    }

    updateTags(track) {
        const container = document.getElementById('track-tags');
        container.innerHTML = '';

        const tags = [];

        // Agregar tags basados en los datos
        if (track.AI_ENERGY > 0.7) {
            tags.push('High Energy');
        }
        if (track.AI_DANCEABILITY > 0.7) {
            tags.push('Danceable');
        }
        if (track.AI_VALENCE > 0.7) {
            tags.push('Happy');
        }
        if (track.AI_VALENCE < 0.3) {
            tags.push('Dark');
        }
        if (track.AI_ACOUSTICNESS > 0.7) {
            tags.push('Acoustic');
        }
        if (track.AI_INSTRUMENTALNESS > 0.7) {
            tags.push('Instrumental');
        }
        if (track.AI_LIVENESS > 0.7) {
            tags.push('Live');
        }
        if (track.AI_SPEECHINESS > 0.3) {
            tags.push('Vocal');
        }

        // Agregar mood y genre como tags
        if (track.AI_MOOD) {
            tags.push(track.AI_MOOD);
        }
        if (track.LLM_GENRE && track.LLM_GENRE !== track.genre) {
            tags.push(track.LLM_GENRE);
        }

        // Renderizar tags
        tags.forEach((tag) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            container.appendChild(tagEl);
        });
    }

    drawRadarChart(track) {
        const canvas = document.getElementById('hamms-radar');
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 80;

        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dimensiones HAMMS
        const dimensions = [
            { label: 'Energy', value: track.AI_ENERGY || 0 },
            { label: 'Danceability', value: track.AI_DANCEABILITY || 0 },
            { label: 'Valence', value: track.AI_VALENCE || 0 },
            { label: 'Acousticness', value: track.AI_ACOUSTICNESS || 0 },
            { label: 'Instrumentalness', value: track.AI_INSTRUMENTALNESS || 0 },
            { label: 'Liveness', value: track.AI_LIVENESS || 0 },
            { label: 'Speechiness', value: track.AI_SPEECHINESS || 0 },
        ];

        const angleStep = (Math.PI * 2) / dimensions.length;

        // Dibujar líneas de fondo
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;

        for (let level = 0.2; level <= 1; level += 0.2) {
            ctx.beginPath();
            for (let i = 0; i < dimensions.length; i++) {
                const angle = i * angleStep - Math.PI / 2;
                const x = centerX + Math.cos(angle) * radius * level;
                const y = centerY + Math.sin(angle) * radius * level;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Dibujar líneas radiales
        for (let i = 0; i < dimensions.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
            ctx.stroke();
        }

        // Dibujar el polígono de datos
        ctx.fillStyle = 'rgba(118, 75, 162, 0.3)';
        ctx.strokeStyle = '#764ba2';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < dimensions.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const value = dimensions[i].value;
            const x = centerX + Math.cos(angle) * radius * value;
            const y = centerY + Math.sin(angle) * radius * value;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Dibujar puntos
        ctx.fillStyle = '#764ba2';
        for (let i = 0; i < dimensions.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const value = dimensions[i].value;
            const x = centerX + Math.cos(angle) * radius * value;
            const y = centerY + Math.sin(angle) * radius * value;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dibujar etiquetas
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < dimensions.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (radius + 20);
            const y = centerY + Math.sin(angle) * (radius + 20);

            ctx.fillText(dimensions[i].label, x, y);
        }
    }

    findSimilar() {
        if (!this.currentTrack) {
            window.showToast('No track selected', 'error');
            return;
        }

        // Disparar evento para buscar tracks similares
        document.dispatchEvent(
            new CustomEvent('findSimilarTracks', {
                detail: this.currentTrack,
            })
        );
    }

    analyzeDeep() {
        if (!this.currentTrack) {
            window.showToast('No track selected', 'error');
            return;
        }

        // Disparar evento para análisis profundo
        document.dispatchEvent(
            new CustomEvent('deepAnalysis', {
                detail: this.currentTrack,
            })
        );
    }

    exportData() {
        if (!this.currentTrack) {
            window.showToast('No track selected', 'error');
            return;
        }

        // Exportar datos como JSON
        const dataStr = JSON.stringify(this.currentTrack, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `track-analysis-${this.currentTrack.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast('Track data exported', 'success');
    }

    loadLastTrack() {
        // Cargar último track si existe
        const lastTrackId = localStorage.getItem('lastSelectedTrack');
        if (lastTrackId) {
            this.loadTrackData(lastTrackId);
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.trackInfoPanel = new TrackInfoPanel();
    });
} else {
    window.trackInfoPanel = new TrackInfoPanel();
}
