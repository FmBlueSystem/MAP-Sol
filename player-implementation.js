/**
 * Implementación del Player con Sistema de Precarga
 * Integra Howler.js con el sistema de precarga de tracks
 */

// Asegurarse de que Howler esté cargado
if (typeof Howl === 'undefined') {
    console.error('⚠️ Howler.js no está cargado. Por favor incluye la biblioteca.');
}

class MusicPlayer {
    constructor() {
        this.currentSound = null;
        this.currentTrackId = null;
        this.currentTrackIndex = -1;
        this.playlist = [];
        this.isPlaying = false;
        this.volume = 0.7;
        this.isMuted = false;
        this.repeatMode = 'off'; // 'off', 'one', 'all'
        this.isShuffled = false;
        this.originalPlaylist = [];
        
        // Inicializar preloader si está disponible
        if (typeof trackPreloader !== 'undefined') {
            this.preloader = trackPreloader;
            console.log('✅ Sistema de precarga activado');
        } else {
            console.log('⚠️ Sistema de precarga no disponible');
            this.preloader = null;
        }
        
        // Bind de métodos para eventos
        this.updateProgress = this.updateProgress.bind(this);
        this.progressInterval = null;
    }

    /**
     * Establece la playlist actual
     */
    setPlaylist(tracks) {
        this.originalPlaylist = [...tracks];
        this.playlist = [...tracks];
        
        if (this.isShuffled) {
            this.shufflePlaylist();
        }
        
        // Configurar preloader con la playlist
        if (this.preloader) {
            this.preloader.setPlaylist(this.playlist, this.currentTrackIndex);
        }
    }

    /**
     * Reproduce un track específico
     */
    playTrack(trackId, trackData = null) {
        // Buscar el track en la playlist
        const trackIndex = this.playlist.findIndex(t => t.id === trackId);
        
        if (trackIndex === -1 && trackData) {
            // Si no está en la playlist, agregarlo temporalmente
            this.playlist = [trackData];
            this.currentTrackIndex = 0;
        } else if (trackIndex !== -1) {
            this.currentTrackIndex = trackIndex;
        } else {
            console.error('Track no encontrado:', trackId);
            return;
        }
        
        const track = this.playlist[this.currentTrackIndex];
        
        // Detener el sonido actual si existe
        if (this.currentSound) {
            this.currentSound.stop();
            this.currentSound.unload();
        }
        
        // Verificar si el track está precargado
        let soundToPlay = null;
        
        if (this.preloader) {
            const preloaded = this.preloader.getPreloadedTrack(trackId);
            if (preloaded && preloaded.howl) {
                soundToPlay = preloaded.howl;
                console.log('🚀 Usando track precargado');
            }
        }
        
        // Si no está precargado, crear nuevo Howl
        if (!soundToPlay) {
            soundToPlay = new Howl({
                src: [track.file_path],
                html5: true,
                volume: this.volume,
                onload: () => {
                    console.log('✅ Track cargado:', track.title);
                },
                onplay: () => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this.startProgressUpdate();
                    this.updateNowPlaying(track);
                },
                onpause: () => {
                    this.isPlaying = false;
                    this.updatePlayButton();
                    this.stopProgressUpdate();
                },
                onstop: () => {
                    this.isPlaying = false;
                    this.updatePlayButton();
                    this.stopProgressUpdate();
                },
                onend: () => {
                    this.handleTrackEnd();
                },
                onloaderror: (id, error) => {
                    console.error('Error cargando track:', error);
                    this.showError('Error al cargar el archivo de audio');
                }
            });
        }
        
        // Configurar volumen correcto
        soundToPlay.volume(this.isMuted ? 0 : this.volume);
        
        // Guardar referencia y reproducir
        this.currentSound = soundToPlay;
        this.currentTrackId = trackId;
        this.currentSound.play();
        
        // Actualizar UI
        this.highlightCurrentTrack(trackId);
        
        // Precargar siguientes tracks
        if (this.preloader) {
            this.preloader.updateCurrentIndex(this.currentTrackIndex);
        }
    }

    /**
     * Reproduce el siguiente track
     */
    playNext() {
        if (this.playlist.length === 0) return;
        
        let nextIndex = this.currentTrackIndex + 1;
        
        if (nextIndex >= this.playlist.length) {
            if (this.repeatMode === 'all') {
                nextIndex = 0;
            } else {
                // Fin de la playlist
                this.stop();
                return;
            }
        }
        
        const nextTrack = this.playlist[nextIndex];
        this.playTrack(nextTrack.id);
    }

    /**
     * Reproduce el track anterior
     */
    playPrevious() {
        if (this.playlist.length === 0) return;
        
        // Si estamos más de 3 segundos en el track actual, reiniciarlo
        if (this.currentSound && this.currentSound.seek() > 3) {
            this.currentSound.seek(0);
            return;
        }
        
        let prevIndex = this.currentTrackIndex - 1;
        
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') {
                prevIndex = this.playlist.length - 1;
            } else {
                prevIndex = 0;
            }
        }
        
        const prevTrack = this.playlist[prevIndex];
        this.playTrack(prevTrack.id);
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (!this.currentSound) {
            // Si no hay track actual, reproducir el primero
            if (this.playlist.length > 0) {
                this.playTrack(this.playlist[0].id);
            }
            return;
        }
        
        if (this.isPlaying) {
            this.currentSound.pause();
        } else {
            this.currentSound.play();
        }
    }

    /**
     * Detiene la reproducción
     */
    stop() {
        if (this.currentSound) {
            this.currentSound.stop();
            this.currentSound.unload();
            this.currentSound = null;
        }
        
        this.isPlaying = false;
        this.currentTrackId = null;
        this.currentTrackIndex = -1;
        this.updatePlayButton();
        this.stopProgressUpdate();
    }

    /**
     * Maneja el fin de un track
     */
    handleTrackEnd() {
        if (this.repeatMode === 'one') {
            // Repetir el mismo track
            this.currentSound.seek(0);
            this.currentSound.play();
        } else {
            // Reproducir siguiente
            this.playNext();
        }
    }

    /**
     * Actualiza el progreso del track
     */
    updateProgress() {
        if (!this.currentSound || !this.isPlaying) return;
        
        const seek = this.currentSound.seek() || 0;
        const duration = this.currentSound.duration() || 0;
        
        // Actualizar tiempo actual
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(seek);
        }
        
        // Actualizar duración total
        const durationEl = document.getElementById('duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(duration);
        }
        
        // Actualizar barra de progreso
        const progressFill = document.querySelector('.progress-bar-fill');
        if (progressFill && duration > 0) {
            const percentage = (seek / duration) * 100;
            progressFill.style.width = percentage + '%';
        }
    }

    /**
     * Inicia la actualización de progreso
     */
    startProgressUpdate() {
        this.stopProgressUpdate();
        this.progressInterval = setInterval(this.updateProgress, 100);
    }

    /**
     * Detiene la actualización de progreso
     */
    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * Busca una posición en el track
     */
    seek(percentage) {
        if (!this.currentSound) return;
        
        const duration = this.currentSound.duration();
        const seekTime = duration * percentage;
        this.currentSound.seek(seekTime);
        this.updateProgress();
    }

    /**
     * Establece el volumen
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        
        if (this.currentSound) {
            this.currentSound.volume(this.volume);
        }
        
        // Actualizar UI de volumen
        const volumeFill = document.querySelector('.volume-bar-fill');
        if (volumeFill) {
            volumeFill.style.width = (this.volume * 100) + '%';
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.currentSound) {
            this.currentSound.volume(this.isMuted ? 0 : this.volume);
        }
        
        // Actualizar icono de volumen
        const volumeBtn = document.getElementById('btn-volume');
        if (volumeBtn) {
            volumeBtn.classList.toggle('muted', this.isMuted);
        }
    }

    /**
     * Cambia el modo de repetición
     */
    cycleRepeatMode() {
        const modes = ['off', 'one', 'all'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        // Actualizar UI
        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn) {
            repeatBtn.className = 'control-button repeat-' + this.repeatMode;
            repeatBtn.title = 'Repeat: ' + this.repeatMode;
        }
    }

    /**
     * Toggle shuffle
     */
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        
        if (this.isShuffled) {
            this.shufflePlaylist();
        } else {
            // Restaurar orden original
            const currentTrack = this.playlist[this.currentTrackIndex];
            this.playlist = [...this.originalPlaylist];
            this.currentTrackIndex = this.playlist.findIndex(t => t.id === currentTrack.id);
        }
        
        // Actualizar preloader
        if (this.preloader) {
            this.preloader.setPlaylist(this.playlist, this.currentTrackIndex);
        }
        
        // Actualizar UI
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active', this.isShuffled);
        }
    }

    /**
     * Mezcla la playlist
     */
    shufflePlaylist() {
        const currentTrack = this.playlist[this.currentTrackIndex];
        
        // Fisher-Yates shuffle
        for (let i = this.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
        }
        
        // Mantener el track actual en su posición
        if (currentTrack) {
            this.currentTrackIndex = this.playlist.findIndex(t => t.id === currentTrack.id);
        }
    }

    /**
     * Formatea el tiempo en mm:ss
     */
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Actualiza el botón de play
     */
    updatePlayButton() {
        const playBtn = document.getElementById('mainPlayBtn');
        if (playBtn) {
            const playIcon = playBtn.querySelector('.icon-play');
            const pauseIcon = playBtn.querySelector('.icon-pause');
            
            if (this.isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
                playBtn.title = 'Pause';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                playBtn.title = 'Play';
            }
        }
    }

    /**
     * Actualiza la información del track actual
     */
    updateNowPlaying(track) {
        const titleEl = document.getElementById('currentTrackTitle');
        const artistEl = document.getElementById('currentTrackArtist');
        const artworkEl = document.getElementById('currentTrackArtwork');
        
        if (titleEl) titleEl.textContent = track.title || 'Unknown';
        if (artistEl) artistEl.textContent = track.artist || 'Unknown Artist';
        if (artworkEl && track.artwork_url) {
            artworkEl.src = track.artwork_url;
        }
    }

    /**
     * Resalta el track actual en la UI
     */
    highlightCurrentTrack(trackId) {
        // Quitar highlight anterior
        document.querySelectorAll('.track-playing').forEach(el => {
            el.classList.remove('track-playing');
        });
        
        // Agregar highlight al actual
        document.querySelectorAll(`[data-track-id="${trackId}"]`).forEach(el => {
            el.closest('.track-card, .track-row, .compact-card')?.classList.add('track-playing');
        });
    }

    /**
     * Muestra un error al usuario
     */
    showError(message) {
        console.error(message);
        // Aquí podrías mostrar un toast o notificación
    }

    /**
     * Obtiene estadísticas del player
     */
    getStats() {
        return {
            isPlaying: this.isPlaying,
            currentTrackId: this.currentTrackId,
            currentTrackIndex: this.currentTrackIndex,
            playlistLength: this.playlist.length,
            volume: this.volume,
            isMuted: this.isMuted,
            repeatMode: this.repeatMode,
            isShuffled: this.isShuffled,
            preloaderStats: this.preloader ? this.preloader.getStats() : null
        };
    }
}

// Crear instancia global del player
const player = new MusicPlayer();

// Funciones globales para compatibilidad con HTML
function handlePlay(filePath, trackId) {
    // Buscar datos del track
    const track = filteredTracks.find(t => t.id === trackId) || {
        id: trackId,
        file_path: filePath,
        title: 'Unknown',
        artist: 'Unknown'
    };
    
    // Establecer playlist si no existe
    if (player.playlist.length === 0) {
        player.setPlaylist(filteredTracks);
    }
    
    player.playTrack(trackId, track);
}

function togglePlayPause() {
    player.togglePlayPause();
}

function seekToPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    player.seek(percentage);
}

function setVolume(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    player.setVolume(percentage);
}

function toggleMute() {
    player.toggleMute();
}

// Exportar para debugging
window.player = player;