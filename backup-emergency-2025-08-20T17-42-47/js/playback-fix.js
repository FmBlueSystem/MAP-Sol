// Playback Fix - Critical function for playing tracks
// This function was missing and causing playback to fail

function playTrackFromCard(trackData) {
    try {
        // Initialize audio player if needed
        if (!window.audioPlayer) {
            window.audioPlayer = new AudioPlayer();
        }

        // Ensure file path is correct
        let filePath = trackData.file_path;

        // For Electron, we need file:// protocol
        if (typeof process !== 'undefined' && !filePath.startsWith('file://')) {
            // Encode the path properly for file:// protocol
            filePath = 'file://' + encodeURI(filePath).replace(/#/g, '%23');
        }

        // Play the track
        window.audioPlayer.play(filePath, trackData.id || 0, trackData);

        // Update player bar UI
        const playerBar = document.querySelector('.player-bar');
        if (playerBar) {
            playerBar.classList.add('active');
        }

        // Update now playing info
        const nowPlayingTitle = document.querySelector('.now-playing-title');
        const nowPlayingArtist = document.querySelector('.now-playing-artist');
        const nowPlayingArtwork = document.querySelector('.now-playing-artwork');

        if (nowPlayingTitle) {
            nowPlayingTitle.textContent = trackData.title || trackData.file_name || 'Unknown';
        }
        if (nowPlayingArtist) {
            nowPlayingArtist.textContent = trackData.artist || 'Unknown Artist';
        }
        if (nowPlayingArtwork && trackData.artwork_url) {
            nowPlayingArtwork.src = trackData.artwork_url;
        }

        // Update play button icon
        const playBtn = document.getElementById('main-play-btn');
        if (playBtn) {
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }

        // Show notification
        const trackName = trackData.title || trackData.file_name || 'Unknown';
        const artistName = trackData.artist || 'Unknown Artist';
        if (window.showNotification) {
            window.showNotification(`Now playing: ${artistName} - ${trackName}`, 'success');
        }
    } catch (error) {
        console.error('❌ Error playing track:', error);
        if (window.showNotification) {
            window.showNotification('Error playing track: ' + error.message, 'error');
        }
    }
}

// Make sure function is available globally
window.playTrackFromCard = playTrackFromCard;
