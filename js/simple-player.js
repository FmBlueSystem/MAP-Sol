// Simple Audio Player - Sin complicaciones, solo funciona
class SimpleAudioPlayer {
    constructor() {
        this.audio = null;
        this.currentTrack = null;
        this.volume = 0.75;
        this.isPlaying = false;
    }

    play(filePath, trackData) {
        // Stop previous if exists
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }

        // Create new audio
        this.audio = new Audio(filePath);
        this.audio.volume = this.volume;
        this.currentTrack = trackData;

        // Update UI
        this.updateUI(trackData);

        // Setup events
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            document.getElementById('main-play-btn').textContent = '⏸';
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            document.getElementById('main-play-btn').textContent = '▶';
        });

        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.audio.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });

        this.audio.addEventListener('ended', () => {
            this.playNext();
        });

        this.audio.addEventListener('error', e => {
            console.error('❌ Audio error:', e);
        });

        // Play it!
        this.audio
            .play()
            .then(() => {})
            .catch(err => {
                console.error('❌ Play failed:', err);
                alert('Error playing file: ' + err.message);
            });
    }

    updateUI(trackData) {
        // Title
        const titleEl = document.getElementById('current-title');
        if (titleEl) {
            titleEl.textContent = trackData.title || trackData.file_name || 'Unknown';
        }

        // Artist
        const artistEl = document.getElementById('current-artist');
        if (artistEl) {
            artistEl.textContent = trackData.artist || 'Unknown Artist';
        }

        // Artwork
        const artworkEl = document.getElementById('current-artwork');
        if (artworkEl && trackData.artwork_url) {
            artworkEl.style.backgroundImage = `url('${trackData.artwork_url}')';
            artworkEl.style.backgroundSize = 'cover';
            artworkEl.textContent = '';
        }
    }

    updateProgress() {
        if (!this.audio) {
            return;
        }

        const current = this.audio.currentTime;
        const duration = this.audio.duration || 0;
        const percent = duration > 0 ? (current / duration) * 100 : 0;

        // Update progress bar
        const progressBar = document.getElementById('progress-fill');
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }

        // Update time
        const currentTimeEl = document.getElementById('time-current');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(current);
        }
    }

    updateDuration() {
        if (!this.audio) {
            return;
        }

        const durationEl = document.getElementById('time-total');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.audio.duration);
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) {
            return '0:00';
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}';
    }

    togglePlayPause() {
        if (!this.audio) {
            // Play first track if nothing loaded
            const firstCard = document.querySelector('.file-card');
            if (firstCard) {
                firstCard.click();
            }
            return;
        }

        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play();
        }
    }

    playNext() {
        const cards = Array.from(document.querySelectorAll('.file-card'));
        const currentCard = document.querySelector('.file-card.playing');

        if (currentCard) {
            const currentIndex = cards.indexOf(currentCard);
            const nextIndex = (currentIndex + 1) % cards.length;
            if (cards[nextIndex]) {
                cards[nextIndex].click();
            }
        }
    }

    playPrevious() {
        const cards = Array.from(document.querySelectorAll('.file-card'));
        const currentCard = document.querySelector('.file-card.playing');

        if (currentCard) {
            const currentIndex = cards.indexOf(currentCard);
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
            if (cards[prevIndex]) {
                cards[prevIndex].click();
            }
        }
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.audio) {
            this.audio.volume = this.volume;
        }
    }

    seek(event) {
        if (!this.audio || !this.audio.duration) {
            return;
        }

        const progressContainer = event.currentTarget;
        const rect = progressContainer.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.audio.currentTime = percent * this.audio.duration;
    }
}

// Create global instance
window.simplePlayer = new SimpleAudioPlayer();
