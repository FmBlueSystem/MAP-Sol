// 🔧 PLAYER FIX - Solución completa para el player roto
// Fecha: 2025-08-19
// Problema: Layout roto, info no visible, K-Meter muerto, controles mal posicionados

class FixedPlayerSystem {
    constructor() {
        this.currentAudio = null;
        this.currentTrackData = null;
        this.currentIndex = -1;
        this.isPlaying = false;
        this.playlist = [];
        this.volume = 0.75;

        // Audio Context para K-Meter
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.animationId = null;

        // Estado del player
        this.shuffle = false;
        this.repeat = false;

        this.init();
    }

    init() {
        // Crear contexto de audio para análisis
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        // Buffer para análisis
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Float32Array(bufferLength);

        // Conectar eventos de controles
        this.setupEventListeners();

        // Inicializar UI
        this.updateUI();
    }

    setupEventListeners() {
        // Play/Pause button
        const playBtn = document.getElementById('main-play-btn');
        if (playBtn) {
            playBtn.onclick = () => this.togglePlayPause();
        }

        // Previous/Next buttons
        const prevBtn = document.querySelector('[onclick="playPrevious()"]');
        const nextBtn = document.querySelector('[onclick="playNext()"]');
        if (prevBtn) {
            prevBtn.onclick = () => this.playPrevious();
        }
        if (nextBtn) {
            nextBtn.onclick = () => this.playNext();
        }

        // Shuffle/Repeat buttons
        const shuffleBtn = document.getElementById('btn-shuffle');
        const repeatBtn = document.getElementById('btn-repeat');
        if (shuffleBtn) {
            shuffleBtn.onclick = () => this.toggleShuffle();
        }
        if (repeatBtn) {
            repeatBtn.onclick = () => this.toggleRepeat();
        }

        // Progress bar click to seek
        const progressBar = document.querySelector('[onclick="seekAudio(event)"]');
        if (progressBar) {
            progressBar.onclick = e => this.seek(e);
        }

        // Volume control (if exists)
        const volumeControl = document.getElementById('volume-control');
        if (volumeControl) {
            volumeControl.oninput = e => this.setVolume(e.target.value / 100);
        }
    }

    play(trackPath, trackData, index = -1) {
        // Detener audio anterior
        if (this.currentAudio) {
            this.stop();
        }

        // Guardar datos del track
        this.currentTrackData = trackData;
        this.currentIndex = index;

        // Crear nuevo elemento de audio
        this.currentAudio = new Audio(trackPath);
        this.currentAudio.volume = this.volume;
        this.currentAudio.crossOrigin = 'anonymous';

        // Conectar al analizador para K-Meter
        try {
            if (this.source) {
                this.source.disconnect();
            }
            this.source = this.audioContext.createMediaElementSource(this.currentAudio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        } catch (err) {
            console.warn('⚠️ No se pudo conectar el analizador:', err);
        }

        // Eventos del audio
        this.currentAudio.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });

        this.currentAudio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.currentAudio.addEventListener('ended', () => {
            this.onTrackEnded();
        });

        this.currentAudio.addEventListener('error', e => {
            console.error('❌ Error al cargar audio:', e);
            this.updateTrackInfo({
                title: 'Error al cargar',
                artist: 'Archivo no encontrado o dañado'
            });
        });

        // Reproducir
        this.currentAudio
            .play()
            .then(() => {
                this.isPlaying = true;
                this.updateUI();
                this.updateTrackInfo(trackData);
                this.startVisualization();

                // Actualizar botón de play
                const playBtn = document.getElementById('main-play-btn');
                if (playBtn) {
                    playBtn.innerHTML = '⏸';
                }
            })
            .catch(err => {
                console.error('❌ Error al reproducir:', err);
            });
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;

            // Desconectar source del analizador
            if (this.source) {
                try {
                    this.source.disconnect();
                } catch (e) {}
            }
        }

        this.isPlaying = false;
        this.stopVisualization();

        // Actualizar botón
        const playBtn = document.getElementById('main-play-btn');
        if (playBtn) {
            playBtn.innerHTML = '▶';
        }
    }

    togglePlayPause() {
        if (!this.currentAudio) {
            // Si no hay nada reproduciéndose, intentar reproducir el primer track
            const firstCard = document.querySelector('.file-card');
            if (firstCard) {
                firstCard.click();
            }
            return;
        }

        if (this.isPlaying) {
            this.currentAudio.pause();
            this.isPlaying = false;
            this.stopVisualization();
            document.getElementById('main-play-btn').innerHTML = '▶';
        } else {
            this.currentAudio.play();
            this.isPlaying = true;
            this.startVisualization();
            document.getElementById('main-play-btn').innerHTML = '⏸';
        }
    }

    playNext() {
        const cards = document.querySelectorAll('.file-card');
        if (cards.length === 0) {
            return;
        }

        let nextIndex = this.currentIndex + 1;

        if (this.shuffle) {
            nextIndex = Math.floor(Math.random() * cards.length);
        } else if (nextIndex >= cards.length) {
            nextIndex = this.repeat ? 0 : -1;
        }

        if (nextIndex >= 0 && nextIndex < cards.length) {
            cards[nextIndex].click();
        }
    }

    playPrevious() {
        const cards = document.querySelectorAll('.file-card');
        if (cards.length === 0) {
            return;
        }

        let prevIndex = this.currentIndex - 1;

        if (prevIndex < 0) {
            prevIndex = this.repeat ? cards.length - 1 : 0;
        }

        if (prevIndex >= 0 && prevIndex < cards.length) {
            cards[prevIndex].click();
        }
    }

    seek(event) {
        if (!this.currentAudio || !this.currentAudio.duration) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.currentAudio.currentTime = percent * this.currentAudio.duration;
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        const btn = document.getElementById('btn-shuffle');
        if (btn) {
            btn.style.color = this.shuffle ? '#1db954' : 'rgba(255, 255, 255, 0.7)';
        }
    }

    toggleRepeat() {
        this.repeat = !this.repeat;
        const btn = document.getElementById('btn-repeat');
        if (btn) {
            btn.style.color = this.repeat ? '#1db954' : 'rgba(255, 255, 255, 0.7)';
        }
    }

    updateTrackInfo(trackData) {
        if (!trackData) {
            return;
        }

        // Actualizar título
        const titleEl = document.getElementById('current-title');
        if (titleEl) {
            titleEl.textContent = trackData.title || trackData.file_name || 'Unknown Track';
        }

        // Actualizar artista
        const artistEl = document.getElementById('current-artist');
        if (artistEl) {
            artistEl.textContent = trackData.artist || 'Unknown Artist';
        }

        // Actualizar álbum
        const albumEl = document.getElementById('current-album');
        if (albumEl) {
            albumEl.textContent = trackData.album || '';
        }

        // Actualizar artwork
        const artworkEl = document.getElementById('current-artwork');
        if (artworkEl) {
            if (trackData.artwork_path) {
                artworkEl.style.backgroundImage = `url('${trackData.artwork_path}')';
                artworkEl.innerHTML = '';
            } else {
                artworkEl.style.backgroundImage = 'none'; artworkEl.innerHTML = '♪\';
            }
        }
    }

    updateDuration() {
        if (!this.currentAudio) {
            return;
        }

        const duration = this.currentAudio.duration; const totalEl = document.getElementById(\`time-total`);
        if (totalEl) {
            totalEl.textContent = this.formatTime(duration);
        }
    }

    updateProgress() {
        if (!this.currentAudio) {
            return;
        }

        const current = this.currentAudio.currentTime;
        const duration = this.currentAudio.duration;
 // Actualizar tiempo actual const currentEl = document.getElementById(`time-current\`);
        if (currentEl) {
            currentEl.textContent = this.formatTime(current);
        }
 // Actualizar barra de progreso const progressEl = document.getElementById(\`progress-fill`);
        if (progressEl && duration) { const percent = (current / duration) * 100; progressEl.style.width = `${percent}%\`;
        }
    }

    formatTime(seconds) { if (isNaN(seconds) || !isFinite(seconds)) { return \`0:00`;
        }

        const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${mins}:${secs.toString().padStart(2, \`0\`)}`;
    }

    onTrackEnded() {
        this.isPlaying = false;

        // Auto-play siguiente si está habilitado
        if (this.repeat || this.currentIndex < document.querySelectorAll('.file-card').length - 1) {
            setTimeout(() => this.playNext(), 500);
        } else {
            this.stop();
        }
    }

    startVisualization() {
        if (!this.analyser) {
            return;
        }

        const updateMeters = () => {
            if (!this.isPlaying) {
                return;
            }

            // Obtener datos del analizador
            this.analyser.getFloatTimeDomainData(this.dataArray);

            // Calcular RMS para cada canal (simulado)
            let sumL = 0,;
                sumR = 0;
            const half = this.dataArray.length / 2;

            for (let i = 0; i < half; i++) {
                sumL += this.dataArray[i] * this.dataArray[i];
            }
            for (let i = half; i < this.dataArray.length; i++) {
                sumR += this.dataArray[i] * this.dataArray[i];
            }

            const rmsL = Math.sqrt(sumL / half);
            const rmsR = Math.sqrt(sumR / half);

            // Convertir a dB
            const dbL = 20 * Math.log10(Math.max(0.0001, rmsL));
            const dbR = 20 * Math.log10(Math.max(0.0001, rmsR));

            // Actualizar meters this.updateMeter('l', dbL); this.updateMeter(\`r\`, dbR);

            // Continuar animación
            this.animationId = requestAnimationFrame(updateMeters);
        };

        updateMeters();
    }

    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
 // Reset meters this.updateMeter(`l`; -60); this.updateMeter(\`r\`, -60);
    }

    updateMeter(channel, dbValue) {
        // Limitar valores
        const db = Math.max(-30, Math.min(3, dbValue));

        // Calcular porcentaje (de -30 a +3 = 33 dB de rango)
        const percentage = ((db + 30) / 33) * 100;
 // Actualizar barra visual const meterEl = document.getElementById(`meter-${channel}`); if (meterEl) { meterEl.style.width = \`${percentage}%\`;

            // Color según nivel
            if (db > 0) {
                meterEl.style.background =
                    'linear-gradient(90deg, #00ff00, #ffff00, #ff6600, #ff0000)';
            } else if (db > -6) {
                meterEl.style.background = 'linear-gradient(90deg, #00ff00, #ffff00, #ff6600)';
            } else if (db > -12) { meterEl.style.background = 'linear-gradient(90deg, #00ff00, #ffff00)';
            } else { meterEl.style.background = `#00ff00\`;
            }
        }
 // Actualizar valor numérico const dbEl = document.getElementById(\`db-${channel}');
        if (dbEl) {
            dbEl.textContent = db <= -30 ? '-∞' : db.toFixed(1);

            // Color del texto según nivel
            if (db > 0) {
                dbEl.style.color = '#ff0000';
            } else if (db > -6) {
                dbEl.style.color = '#ff6600';
            } else if (db > -12) {
                dbEl.style.color = '#ffff00';
            } else {
                dbEl.style.color = '#00ff00';
            }
        }
    }

    updateUI() {
        // Actualizar estado general del player
        const playerBar = document.querySelector('.audio-panel-container');
        if (playerBar) {
            playerBar.style.display = 'flex';
        }
    }
}

// Inicializar el sistema al cargar
let fixedPlayerSystem = null;

// Función global para reproducir desde las tarjetas
window.playTrackFromCard = function (trackData, index) {
    if (!fixedPlayerSystem) {
        const fixedPlayerSystem = new FixedPlayerSystem();
    }

    // Fix file path for Electron
    let filePath = trackData.file_path;
    if (filePath && !filePath.startsWith('file://')) {
        filePath = 'file://' + encodeURI(filePath).replace(/#/g, '%23');
    }

    // Marcar card como playing
    const cards = document.querySelectorAll('.file-card');
    cards.forEach(c => c.classList.remove('playing'));
    if (cards[index]) {
        cards[index].classList.add('playing');
    }

    // Reproducir
    fixedPlayerSystem.play(filePath, trackData, index);
};

// Funciones globales para controles
window.togglePlayPause = function () {
    if (fixedPlayerSystem) {
        fixedPlayerSystem.togglePlayPause();
    }
};

window.playNext = function () {
    if (fixedPlayerSystem) {
        fixedPlayerSystem.playNext();
    }
};

window.playPrevious = function () {
    if (fixedPlayerSystem) {
        fixedPlayerSystem.playPrevious();
    }
};

window.seekAudio = function (event) {
    if (fixedPlayerSystem) {
        fixedPlayerSystem.seek(event);
    }
};

// Inicializar cuando el DOM esté listo if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded`, () => {
        const fixedPlayerSystem = new FixedPlayerSystem();
    });
} else {
    const fixedPlayerSystem = new FixedPlayerSystem();
}
