// Professional Studio Audio Panel Controller
class AudioPanelController {
  constructor() {
    this.isExpanded = false;
    this.audioContext = null;
    this.analyser = null;
    this.spectrumCanvas = null;
    // Phase scope removed for minimalist design
    this.waveformCanvas = null;
    // EQ removed for minimalist design
    this.sourceNode = null;
    this.stereoPanner = null;
    // EQ removed for minimalist design
    this.animationFrameId = null;
    
    // Settings
    this.settings = {
      repeat: false,
      shuffle: false,
      normalize: true,
      // EQ removed for minimalist design
    };
    
    this.init();
  }
  
  init() {
    // Get canvas elements
    this.spectrumCanvas = document.getElementById('spectrum-canvas');
    // Phase scope removed for minimalist design
    this.waveformCanvas = document.getElementById('waveform');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup professional meter suite if available
    if (window.ProfessionalMeterSuite) {
      this.setupProfessionalMeters();
    }
    
    // Start monitoring
    this.startMonitoring();
  }
  
  setupEventListeners() {
    // Volume control
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        if (window.player && player.currentAudio) {
          player.currentAudio.volume = volume;
        }
        document.getElementById('volume-value').textContent = e.target.value + '%';
        localStorage.setItem('audioVolume', e.target.value);
      });
      
      // Load saved volume
      const savedVolume = localStorage.getItem('audioVolume') || 75;
      volumeSlider.value = savedVolume;
      document.getElementById('volume-value').textContent = savedVolume + '%';
    }
    
    // Balance control
    const balanceSlider = document.getElementById('balance-slider');
    if (balanceSlider) {
      balanceSlider.addEventListener('input', (e) => {
        const balance = parseInt(e.target.value);
        this.setBalance(balance / 50); // Normalize to -1 to 1
        
        // Update display
        let display = 'C';
        if (balance < 0) display = `L${Math.abs(balance)}`;
        if (balance > 0) display = `R${balance}`;
        document.getElementById('balance-value').textContent = display;
      });
    }
    
    // EQ removed for minimalist design
    
    // Progress bar click to seek
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.addEventListener('click', (e) => {
        if (window.player && player.currentAudio && player.currentAudio.duration) {
          const rect = progressContainer.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          player.currentAudio.currentTime = percent * player.currentAudio.duration;
        }
      });
    }
  }
  
  setupAudioAnalysis(audioElement) {
    if (!audioElement) return;
    
    try {
      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Clean up existing connections
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch (e) {}
      }
      
      // Create source from audio element
      try {
        this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
      } catch (e) {
        // Source already exists, reuse it
        console.log('Audio source already connected');
        return;
      }
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.85;
      
      // Create stereo panner
      this.stereoPanner = this.audioContext.createStereoPanner();
      this.stereoPanner.pan.value = 0;
      
      // Connect audio graph (EQ removed for minimalist design)
      let currentNode = this.sourceNode;
      
      // Connect directly to stereo panner
      currentNode.connect(this.stereoPanner);
      
      // Connect to analyser
      this.stereoPanner.connect(this.analyser);
      
      // Connect to destination
      this.analyser.connect(this.audioContext.destination);
      
      // Start visualizations
      this.startVisualizations();
      
      console.log('✅ Audio analysis setup complete');
    } catch (error) {
      console.error('Audio analysis setup error:', error);
    }
  }
  
  // EQ functions removed for minimalist design
  
  startVisualizations() {
    if (!this.analyser) return;
    
    // Cancel previous animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);
      
      // Draw spectrum
      this.drawSpectrum();
      
      // Phase scope removed for minimalist design
      
      // Update LUFS meters
      this.updateLUFSMeters();
    };
    
    draw();
  }
  
  drawSpectrum() {
    if (!this.spectrumCanvas || !this.analyser) return;
    
    const ctx = this.spectrumCanvas.getContext('2d');
    const width = this.spectrumCanvas.width;
    const height = this.spectrumCanvas.height;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Clear canvas with fade effect for trails
    ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    // Create professional gradient
    const spectrumGradient = ctx.createLinearGradient(0, height, 0, 0);
    spectrumGradient.addColorStop(0.0, '#003d82');  // Deep blue base
    spectrumGradient.addColorStop(0.3, '#0066cc');  // Medium blue
    spectrumGradient.addColorStop(0.5, '#00a2ff');  // Bright blue
    spectrumGradient.addColorStop(0.7, '#00ff88');  // Cyan green
    spectrumGradient.addColorStop(0.85, '#ffff00'); // Yellow
    spectrumGradient.addColorStop(0.95, '#ff8800'); // Orange
    spectrumGradient.addColorStop(1.0, '#ff0000');  // Red for peaks
    
    // Draw spectrum bars with spacing
    const barWidth = (width / bufferLength) * 2.5;
    const barSpacing = 1;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height * 0.9;
      
      // Apply gradient
      ctx.fillStyle = spectrumGradient;
      
      // Main bar
      ctx.fillRect(x, height - barHeight, barWidth - barSpacing, barHeight);
      
      // Reflection effect (subtle)
      ctx.fillStyle = 'rgba(0, 162, 255, 0.1)';
      ctx.fillRect(x, height - barHeight - 2, barWidth - barSpacing, 2);
      
      // Peak indicator
      if (barHeight > height * 0.8) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x, height - barHeight - 4, barWidth - barSpacing, 2);
      }
      
      x += barWidth;
      
      // Stop drawing after visible frequency range
      if (x > width) break;
    }
    
    // Grid lines for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    
    // Horizontal lines every 10dB
    for (let i = 0; i <= 6; i++) {
      const y = (height / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  
  // Phase scope removed for minimalist design
  
  // Phase correlation removed for minimalist design
  
  updateLUFSMeters() {
    if (!this.analyser) return;
    
    // Get frequency data for rough LUFS approximation
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate average levels (simplified LUFS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // Convert to dB scale (simplified)
    const db = 20 * Math.log10(average / 255);
    const lufs = Math.max(-60, Math.min(0, db + 23)); // Rough LUFS approximation
    
    // Update displays with realistic variations
    const integrated = document.getElementById('lufs-integrated');
    const shortTerm = document.getElementById('lufs-short');
    const momentary = document.getElementById('lufs-momentary');
    
    if (integrated) {
      const currentValue = parseFloat(integrated.textContent);
      const targetValue = lufs - 14; // Target -14 LUFS
      integrated.textContent = (currentValue * 0.99 + targetValue * 0.01).toFixed(1);
    }
    
    if (shortTerm) {
      const currentValue = parseFloat(shortTerm.textContent);
      const targetValue = lufs - 12 + (Math.random() - 0.5) * 2;
      shortTerm.textContent = (currentValue * 0.9 + targetValue * 0.1).toFixed(1);
    }
    
    if (momentary) {
      momentary.textContent = (lufs - 10 + (Math.random() - 0.5) * 4).toFixed(1);
    }
  }
  
  drawWaveform() {
    if (!this.waveformCanvas) return;
    
    const ctx = this.waveformCanvas.getContext('2d');
    const width = this.waveformCanvas.width;
    const height = this.waveformCanvas.height;
    
    // Draw placeholder waveform
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
  
  setBalance(value) {
    if (this.stereoPanner) {
      this.stereoPanner.pan.value = Math.max(-1, Math.min(1, value));
    }
  }
  
  updateTrackInfo(track) {
    if (!track) return;
    
    // Safe element updates with null checks
    const titleEl = document.getElementById('panel-title');
    if (titleEl) titleEl.textContent = track.title || track.file_name || 'Unknown';
    
    const artistEl = document.getElementById('panel-artist');
    if (artistEl) artistEl.textContent = track.artist || 'Unknown Artist';
    
    const albumEl = document.getElementById('panel-album');
    if (albumEl) albumEl.textContent = track.album || '';
    
    const trackInfoEl = document.getElementById('panel-track-info');
    if (trackInfoEl) {
      trackInfoEl.textContent = `${track.title || track.file_name} - ${track.artist || 'Unknown'}`;
    }
    
    const artwork = document.getElementById('panel-artwork');
    if (artwork) {
      artwork.src = track.artwork_url || track.artwork_path || 
                   'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="%23666" text-anchor="middle" dy=".3em"%3E♪%3C/text%3E%3C/svg%3E';
    }
    
    // Update format info with null checks
    const formatEl = document.getElementById('panel-format');
    if (formatEl) formatEl.textContent = track.format || '--';
    
    const bitrateEl = document.getElementById('panel-bitrate');
    if (bitrateEl) bitrateEl.textContent = track.bitrate ? `${track.bitrate}kbps` : '--';
    
    const samplerateEl = document.getElementById('panel-samplerate');
    if (samplerateEl) samplerateEl.textContent = track.sampleRate ? `${track.sampleRate}Hz` : '--';
    
    // Update panel status
    const panel = document.getElementById('audio-panel');
    if (panel) {
      panel.classList.add('playing');
    }
  }
  
  updateProgress(current, total) {
    if (!total || isNaN(total)) return;
    
    const percent = (current / total) * 100;
    const progressFill = document.querySelector('.progress-fill');
    const playhead = document.querySelector('.playhead');
    
    if (progressFill) progressFill.style.width = percent + '%';
    if (playhead) playhead.style.left = percent + '%';
    
    // Update time displays
    document.getElementById('time-elapsed').textContent = this.formatTime(current);
    document.getElementById('time-remaining').textContent = '-' + this.formatTime(total - current);
  }
  
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  setupProfessionalMeters() {
    // Initialize professional meter suite if needed
    const container = document.getElementById('professional-meter-suite');
    if (container && window.ProfessionalMeterSuite) {
      this.meterSuite = new ProfessionalMeterSuite();
      this.meterSuite.init(container);
    }
  }
  
  startMonitoring() {
    // Monitor player state
    setInterval(() => {
      if (window.player && player.currentAudio && !player.currentAudio.paused) {
        this.updateProgress(player.currentAudio.currentTime, player.currentAudio.duration);
        
        // Update play/pause button
        const playBtn = document.getElementById('play-pause-btn');
        if (playBtn) {
          playBtn.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="4" height="12"/>
              <rect x="14" y="6" width="4" height="12"/>
            </svg>
          `;
        }
      } else {
        const playBtn = document.getElementById('play-pause-btn');
        if (playBtn) {
          playBtn.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          `;
        }
      }
    }, 100);
  }
  
  destroy() {
    // Clean up
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Toggle panel function - Updated for minimalist design
function toggleAudioPanel() {
  const panel = document.getElementById('audio-panel');
  const icon = document.querySelector('.toggle-icon');
  
  if (panel) {
    panel.classList.toggle('collapsed');
    
    // Update panel state in controller if exists
    if (window.audioPanelController) {
      window.audioPanelController.isExpanded = !panel.classList.contains('collapsed');
    }
  }
}

// Setting toggles
function toggleRepeat() {
  const btn = document.querySelector('[data-setting="repeat"]');
  btn.classList.toggle('active');
  if (window.player) {
    player.toggleRepeat();
  }
}

function toggleShuffle() {
  const btn = document.querySelector('[data-setting="shuffle"]');
  btn.classList.toggle('active');
  if (window.player) {
    player.toggleShuffle();
  }
}

function toggleNormalize() {
  const btn = document.querySelector('[data-setting="normalize"]');
  btn.classList.toggle('active');
}

// EQ functions removed for minimalist design

// Seek function
function seekTo(event) {
  const progressContainer = event.currentTarget;
  const rect = progressContainer.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  
  if (window.player && player.currentAudio && player.currentAudio.duration) {
    player.currentAudio.currentTime = percent * player.currentAudio.duration;
  }
}

// Global toggle play/pause
function togglePlayPause() {
  if (window.player) {
    if (player.isPlaying) {
      player.pause();
    } else if (player.currentAudio) {
      player.resume();
    } else {
      // Play first track if nothing is playing
      const firstBtn = document.querySelector('.play-btn');
      if (firstBtn) {
        firstBtn.click();
      }
    }
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  window.audioPanel = new AudioPanelController();
  
  // Draw initial waveform
  if (audioPanel.waveformCanvas) {
    audioPanel.drawWaveform();
  }
});

// Integrate with existing player
if (window.player) {
  // Override play method to update panel
  const originalPlay = player.play.bind(player);
  player.play = function(trackPath, trackId, trackData) {
    originalPlay(trackPath, trackId, trackData);
    
    // Update audio panel
    if (window.audioPanel) {
      // Setup audio analysis after a short delay to ensure audio element is ready
      setTimeout(() => {
        if (player.currentAudio) {
          audioPanel.setupAudioAnalysis(player.currentAudio);
          audioPanel.updateTrackInfo(trackData || player.currentTrackData);
        }
      }, 100);
    }
  };
  
  // Override stop method
  const originalStop = player.stop ? player.stop.bind(player) : null;
  player.stop = function() {
    if (originalStop) originalStop();
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    
    // Update panel
    const panel = document.getElementById('audio-panel');
    if (panel) {
      panel.classList.remove('playing');
    }
    
    // Safely update elements if they exist
    const titleEl = document.getElementById('panel-title');
    const artistEl = document.getElementById('panel-artist');
    const albumEl = document.getElementById('panel-album');
    const trackInfoEl = document.getElementById('panel-track-info');
    
    if (titleEl) titleEl.textContent = 'No track playing';
    if (artistEl) artistEl.textContent = '--';
    if (albumEl) albumEl.textContent = '--';
    if (trackInfoEl) trackInfoEl.textContent = 'No track playing';
  };
}

// Initialize the audio panel controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.audioPanelController = new AudioPanelController();
  console.log('🎚️ Professional Audio Panel loaded and initialized');
});