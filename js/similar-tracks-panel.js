// Sistema HAMMS Visible - Panel de Tracks Similares
class SimilarTracksPanel {
    constructor() {
        this.currentTrack = null;
        this.similarTracks = [];
        this.isVisible = false;
        this.panel = null;
        this.init();
    }

    init() {
        this.createPanel();
        this.attachEventListeners();
    }

    createPanel() {
        const panelHTML = `
            <div id="similar-tracks-modal" class="modal-backdrop" style="display: none;">
                <div class="similar-tracks-panel">
                    <div class="panel-header">
                        <h2>🎵 Similar Tracks - HAMMS Algorithm</h2>
                        <button class="close-btn" onclick="similarTracksPanel.hide()">✕</button>
                    </div>
                    
                    <div class="reference-track">
                        <h3>Reference Track</h3>
                        <div class="ref-track-info">
                            <img class="ref-artwork" src="image.png" alt="Reference">
                            <div class="ref-details">
                                <h4 class="ref-title">--</h4>
                                <p class="ref-artist">--</p>
                                <div class="ref-metrics">
                                    <span class="metric">BPM: <strong>--</strong></span>
                                    <span class="metric">Key: <strong>--</strong></span>
                                    <span class="metric">Energy: <strong>--</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="similarity-info">
                        <p>Finding tracks with similar characteristics using 7 HAMMS dimensions:</p>
                        <div class="dimensions-list">
                            <span class="dimension">Energy</span>
                            <span class="dimension">Danceability</span>
                            <span class="dimension">Valence</span>
                            <span class="dimension">Acousticness</span>
                            <span class="dimension">Instrumentalness</span>
                            <span class="dimension">Liveness</span>
                            <span class="dimension">Speechiness</span>
                        </div>
                    </div>
                    
                    <div class="similar-tracks-list" id="similar-tracks-container">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                            <p>Analyzing similarity...</p>
                        </div>
                    </div>
                    
                    <div class="panel-footer">
                        <button class="action-btn" onclick="similarTracksPanel.createPlaylistFromSimilar()">
                            📝 Create Playlist
                        </button>
                        <button class="action-btn" onclick="similarTracksPanel.queueAllSimilar()">
                            ➕ Add All to Queue
                        </button>
                        <button class="action-btn" onclick="similarTracksPanel.exportSimilar()">
                            💾 Export List
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insertar el panel en el DOM
        const container = document.createElement('div');
        container.innerHTML = panelHTML;
        document.body.appendChild(container.firstElementChild);
        this.panel = document.getElementById('similar-tracks-modal');
    }

    attachEventListeners() {
        // Escuchar eventos de búsqueda de tracks similares
        document.addEventListener('findSimilarTracks', async e => {
            await this.findSimilar(e.detail);
        });

        // Cerrar con ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Cerrar al hacer click fuera
        this.panel.addEventListener('click', e => {
            if (e.target === this.panel) {
                this.hide();
            }
        });
    }

    async findSimilar(track) {
        this.currentTrack = track;
        this.show();
        this.updateReferenceTrack(track);

        // Mostrar loading
        const container = document.getElementById('similar-tracks-container');
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Analyzing similarity...</p>
            </div>
        `;

        try {
            // Llamar al handler IPC para buscar tracks similares
            const response = await window.api.invoke('find-similar-tracks', track.id || track);

            if (response.success) {
                this.similarTracks = response.tracks;
                this.renderSimilarTracks(response.tracks);
            } else {
                this.showError('Could not find similar tracks');
            }
        } catch (error) {
            console.error('Error finding similar tracks:', error);
            this.showError('Error analyzing similarity');
        }
    }

    updateReferenceTrack(track) {
        const panel = this.panel;

        // Actualizar información del track de referencia
        panel.querySelector('.ref-title').textContent = track.title || track.file_name || '--';
        panel.querySelector('.ref-artist').textContent = track.artist || 'Unknown Artist';

        // Actualizar artwork
        const artwork = panel.querySelector('.ref-artwork');
        artwork.src = track.artwork_url || 'image.png';

        // Actualizar métricas
        const bpm = track.AI_BPM || track.existing_bmp || '--';
        const key = track.AI_KEY || track.existing_key || '--';
        const energy = track.AI_ENERGY ? Math.round(track.AI_ENERGY * 100) + '%' : '--';

        panel.querySelector('.ref-metrics').innerHTML = `
            <span class="metric">BPM: <strong>${bpm}</strong></span>
            <span class="metric">Key: <strong>${key}</strong></span>
            <span class="metric">Energy: <strong>${energy}</strong></span>
        `;
    }

    renderSimilarTracks(tracks) {
        const container = document.getElementById('similar-tracks-container');

        if (!tracks || tracks.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No similar tracks found</p>
                    <small>Try analyzing more tracks to get better results</small>
                </div>
            `;
            return;
        }

        let html = '';
        tracks.forEach((track, index) => {
            const bpm = track.AI_BPM || track.existing_bmp || '--';
            const key = track.AI_KEY || track.existing_key || '--';
            const energy = track.AI_ENERGY ? Math.round(track.AI_ENERGY * 100) : 0;
            const similarity = track.similarity_percent || 0;

            // Color basado en similitud
            let similarityClass = 'low';
            if (similarity > 80) {
                similarityClass = 'high';
            } else if (similarity > 60) {
                similarityClass = 'medium';
            }

            // Indicador de key compatible
            const keyMatch = track.key_match > 0 ? '🎵' : '';

            html += `
                <div class="similar-track-item" data-track-id="${track.id}">
                    <div class="rank">#${index + 1}</div>
                    <img class="track-artwork" src="${track.artwork_url || 'image.png'}" alt="${track.title}">
                    <div class="track-info">
                        <h4>${track.title || track.file_name}</h4>
                        <p>${track.artist || 'Unknown Artist'}</p>
                        <div class="track-metrics">
                            <span class="metric-small">BPM: ${bpm}</span>
                            <span class="metric-small">Key: ${key} ${keyMatch}</span>
                            <span class="metric-small">Energy: ${energy}%</span>
                        </div>
                    </div>
                    <div class="similarity-score ${similarityClass}">
                        <div class="score-circle">
                            <svg width="60" height="60">
                                <circle cx="30" cy="30" r="25" fill="none" stroke="#e0e0e0" stroke-width="3"/>
                                <circle cx="30" cy="30" r="25" fill="none" 
                                    stroke="${this.getColorForScore(similarity)}" 
                                    stroke-width="3"
                                    stroke-dasharray="${similarity * 1.57} 157"
                                    stroke-dashoffset="0"
                                    transform="rotate(-90 30 30)"/>
                            </svg>
                            <div class="score-text">${similarity}%</div>
                        </div>
                        <small>Match</small>
                    </div>
                    <div class="track-actions">
                        <button class="mini-btn play-btn" onclick="similarTracksPanel.playTrack('${track.file_path}', ${track.id})" title="Play">
                            ▶
                        </button>
                        <button class="mini-btn queue-btn" onclick="similarTracksPanel.addToQueue(${track.id})" title="Add to Queue">
                            +
                        </button>
                        <button class="mini-btn info-btn" onclick="similarTracksPanel.showTrackInfo(${track.id})" title="Info">
                            ℹ
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Animar entrada
        const items = container.querySelectorAll('.similar-track-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('fade-in');
            }, index * 50);
        });
    }

    getColorForScore(score) {
        if (score > 80) {
            return '#4CAF50';
        }
        if (score > 60) {
            return '#FFC107';
        }
        if (score > 40) {
            return '#FF9800';
        }
        return '#F44336';
    }

    playTrack(filePath, trackId) {
        // Llamar a la función de reproducción global
        if (window.handlePlay) {
            window.handlePlay(filePath, trackId);
        }
    }

    addToQueue(trackId) {
        // Agregar a la cola
        if (window.audioPlayer && window.audioPlayer.addToQueue) {
            window.audioPlayer.addToQueue(trackId);
            window.showToast('Added to queue', 'success');
        }
    }

    showTrackInfo(trackId) {
        // Mostrar info del track en el panel principal
        document.dispatchEvent(
            new CustomEvent('trackSelected', {
                detail: trackId
            })
        );
        this.hide();
    }

    createPlaylistFromSimilar() {
        if (this.similarTracks.length === 0) {
            window.showToast('No tracks to add', 'error');
            return;
        }

        // Crear playlist con los tracks similares
        const playlistName = `Similar to ${this.currentTrack.title || 'Track'}`;
        const trackIds = this.similarTracks.map(t => t.id);

        // Disparar evento para crear playlist
        document.dispatchEvent(
            new CustomEvent('createPlaylist', {
                detail: {
                    name: playlistName,
                    trackIds: trackIds,
                    description: `Tracks similar to "${this.currentTrack.title}" using HAMMS algorithm`
                }
            })
        );

        window.showToast('Playlist created', 'success');
    }

    queueAllSimilar() {
        if (this.similarTracks.length === 0) {
            window.showToast('No tracks to add', 'error');
            return;
        }

        // Agregar todos a la cola
        this.similarTracks.forEach(track => {
            if (window.audioPlayer && window.audioPlayer.addToQueue) {
                window.audioPlayer.addToQueue(track.id);
            }
        });

        window.showToast(`Added ${this.similarTracks.length} tracks to queue`, 'success');
    }

    exportSimilar() {
        if (this.similarTracks.length === 0) {
            window.showToast('No tracks to export', 'error');
            return;
        }

        // Preparar datos para exportar
        const exportData = {
            reference: {
                title: this.currentTrack.title,
                artist: this.currentTrack.artist,
                bpm: this.currentTrack.AI_BPM,
                key: this.currentTrack.AI_KEY,
                energy: this.currentTrack.AI_ENERGY
            },
            similar_tracks: this.similarTracks.map(t => ({
                title: t.title,
                artist: t.artist,
                bpm: t.AI_BPM,
                key: t.AI_KEY,
                energy: t.AI_ENERGY,
                similarity: t.similarity_percent,
                file_path: t.file_path
            })),
            generated_at: new Date().toISOString(),
            algorithm: 'HAMMS-7D'
        };

        // Descargar como JSON
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `similar-tracks-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast('Similar tracks exported', 'success');
    }

    show() {
        this.panel.style.display = 'flex';
        this.isVisible = true;
        document.body.style.overflow = 'hidden';
    }

    hide() {
        this.panel.style.display = 'none';
        this.isVisible = false;
        document.body.style.overflow = '';
    }

    showError(message) {
        const container = document.getElementById('similar-tracks-container');
        container.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${message}</p>
            </div>
        `;
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.similarTracksPanel = new SimilarTracksPanel();
    });
} else {
    window.similarTracksPanel = new SimilarTracksPanel();
}
