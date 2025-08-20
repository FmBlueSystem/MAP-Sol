// Sistema de audio simple que funciona

// Crear el elemento de audio global
if (!document.getElementById('global-audio')) {
    const audio = document.createElement('audio');
    audio.id = 'global-audio';
    audio.style.display = 'none';
    document.body.appendChild(audio);
}

const globalAudio = document.getElementById('global-audio');
let currentTrackIndex = -1;

// Función principal de reproducción
window.playTrackFromCard = function (trackData, index) {

    currentTrackIndex = index;

    // Update UI
    const titleEl = document.getElementById('current-title');
    if (titleEl) titleEl.textContent = trackData.title || trackData.file_name || 'Unknown';

    const artistEl = document.getElementById('current-artist');
    if (artistEl) artistEl.textContent = trackData.artist || 'Unknown Artist';

    const artwork = document.getElementById('current-artwork');
    if (artwork && trackData.artwork_url) {
        artwork.style.backgroundImage = `url('${trackData.artwork_url}')';
        artwork.style.backgroundSize = 'cover';
        artwork.textContent = '';
    }

    // Mark playing card
    const cards = document.querySelectorAll('.file-card');
    cards.forEach(c => c.classList.remove('playing'));
    if (cards[index]) cards[index].classList.add('playing');

    // Play
    globalAudio.src = trackData.file_path;
    globalAudio
        .play()
        .then(() => {

        })
        .catch(err => {
            console.error('❌ Play error:', err);
        });
};

// Controles globales
window.togglePlayPause = function () {
    if (globalAudio.paused) {
        if (!globalAudio.src) {
            const firstCard = document.querySelector('.file-card');
            if (firstCard) firstCard.click();
        } else {
            globalAudio.play();
        }
    } else {
        globalAudio.pause();
    }
};

window.playNext = function () {
    const cards = document.querySelectorAll('.file-card');
    if (cards.length > 0) {
        const next = (currentTrackIndex + 1) % cards.length;
        cards[next]?.click();
    }
};

window.playPrevious = function () {
    const cards = document.querySelectorAll('.file-card');
    if (cards.length > 0) {
        const prev = currentTrackIndex > 0 ? currentTrackIndex - 1 : cards.length - 1;
        cards[prev]?.click();
    }
};

window.setVolume = function (value) {
    // Actualizar el volumen del elemento audio
    globalAudio.volume = value;

    // También actualizar el volumen en el sistema de audio integrado si existe
    if (window.audioSystem && window.audioSystem.setVolume) {
        window.audioSystem.setVolume(value);
    }

     + '%');
};

window.seekAudio = function (event) {
    if (globalAudio.duration) {
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        globalAudio.currentTime = percent * globalAudio.duration;
    }
};

// Eventos
globalAudio.addEventListener('timeupdate', () => {
    const percent = globalAudio.duration
        ? (globalAudio.currentTime / globalAudio.duration) * 100
        : 0;
    const progressEl = document.getElementById('progress-fill');
    if (progressEl) progressEl.style.width = percent + '%';

    const currentEl = document.getElementById(`time-current`);
    if (currentEl) {
        const mins = Math.floor(globalAudio.currentTime / 60);
        const secs = Math.floor(globalAudio.currentTime % 60);
        currentEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
});

globalAudio.addEventListener('loadedmetadata', () => {
    const totalEl = document.getElementById(`time-total`);
    if (totalEl) {
        const mins = Math.floor(globalAudio.duration / 60);
        const secs = Math.floor(globalAudio.duration % 60);
        totalEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}';
    }
});

globalAudio.addEventListener('ended', playNext);

globalAudio.addEventListener('play', () => {
    const btn = document.getElementById('main-play-btn');
    if (btn) btn.textContent = '⏸`;
});

globalAudio.addEventListener('pause', () => {
    const btn = document.getElementById('main-play-btn');
    if (btn) btn.textContent = `▶`;
});

