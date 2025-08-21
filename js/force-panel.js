// FORCE CREATE AUDIO PANEL - EMERGENCY FIX
console.log('🚨 EMERGENCY: Force creating audio panel...');

// Wait for page to load
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Check if panel exists
        let panel = document.getElementById('simple-player-bar');

        if (!panel) {
            console.log('❌ Panel missing! Creating it now...');

            // Create the panel HTML directly
            const panelHTML = `
                <div id="simple-player-bar" class="simple-player-bar" style="
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    height: 110px !important;
                    background: linear-gradient(135deg, rgba(15, 15, 25, 0.98) 0%, rgba(25, 25, 40, 0.98) 50%, rgba(20, 20, 35, 0.98) 100%) !important;
                    z-index: 99999 !important;
                    display: flex !important;
                    align-items: center !important;
                    padding: 16px 20px !important;
                    gap: 24px !important;
                    border-top: 2px solid rgba(0, 255, 150, 0.3) !important;
                ">
                    <!-- Track Info Section -->
                    <div class="player-track-info">
                        <img src="image.png" id="player-artwork" class="player-artwork" style="width: 60px; height: 60px; border-radius: 8px;" />
                        <div class="track-details" style="margin-left: 12px;">
                            <div id="player-title" style="color: white; font-size: 14px; font-weight: 600;">--</div>
                            <div id="player-artist" style="color: #999; font-size: 12px;">--</div>
                            <div class="player-meta" style="color: #666; font-size: 11px; margin-top: 4px;">
                                <span id="player-bpm">-- BPM</span> • 
                                <span id="player-key">--</span> • 
                                <span id="player-energy">--</span> • 
                                <span id="player-mood">--</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Controls Section -->
                    <div class="player-controls" style="display: flex; gap: 12px;">
                        <button id="btn-prev" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;">⏮</button>
                        <button id="btn-play" style="background: #00ff88; border: none; color: black; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">▶</button>
                        <button id="btn-next" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;">⏭</button>
                    </div>
                    
                    <!-- Time Section -->
                    <div class="player-time" style="color: white; font-size: 12px;">
                        <span id="current-time">0:00</span> / <span id="total-time">0:00</span>
                    </div>
                    
                    <!-- Volume Section -->
                    <div class="volume-section" style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: white;">🔊</span>
                        <input type="range" id="volume-slider" min="0" max="100" value="70" style="width: 80px;" />
                    </div>
                </div>
            `;

            // Add to body
            document.body.insertAdjacentHTML('beforeend', panelHTML);

            panel = document.getElementById('simple-player-bar');
            console.log('✅ Panel created manually!');

            // Initialize basic controls
            const playBtn = document.getElementById('btn-play');
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    console.log('Play clicked');
                    if (window.simplePlayer) {
                        window.simplePlayer.togglePlay();
                    }
                });
            }
        } else {
            console.log("✅ Panel exists, making sure it's visible...");
            panel.style.display = 'flex';
            panel.style.visibility = 'visible';
        }

        // Update with current track if exists
        if (window.simplePlayer && window.simplePlayer.currentTrack) {
            const track = window.simplePlayer.currentTrack;
            document.getElementById('player-title').textContent = track.title || '--';
            document.getElementById('player-artist').textContent = track.artist || '--';
            document.getElementById('player-bpm').textContent = track.bpm ? `${track.bpm} BPM` : '-- BPM';
            document.getElementById('player-key').textContent = track.key || '--';
            document.getElementById('player-energy').textContent = track.energy
                ? `${Math.round(track.energy * 100)}%`
                : '--';
            document.getElementById('player-mood').textContent = track.mood || '--';
        }
    }, 500);
});
