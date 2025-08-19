// Energy Flow Visualizer - Real-time energy and mood visualization
class EnergyFlowVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentTrack = null;
        this.playlist = [];
        this.energyData = [];
        this.moodData = [];
        this.bpmData = [];
        this.animationId = null;
        this.flowSpeed = 0.01;
        this.time = 0;

        this.init();
    }

    init() {
        this.createCanvas();
        this.setupEventListeners();
        this.loadPlaylistData();
    }

    createCanvas() {
        // Check if energy flow container exists
        const container = document.querySelector('.energy-flow-container');
        if (!container) {
            // Create container if doesn't exist
            const newContainer = document.createElement('div');
            newContainer.className = 'energy-flow-container';
            newContainer.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                width: 300px;
                height: 200px;
                background: rgba(255,255,255,0.95);
                border-radius: 12px;
                padding: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                display: none;
                z-index: 100;
            `;
            document.body.appendChild(newContainer);
        }

        const containerEl = document.querySelector('.energy-flow-container');

        // Add title
        const title = document.createElement('div');
        title.className = 'energy-flow-title';
        title.style.cssText =
            'font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #333;';
        title.textContent = 'Energy Flow';
        containerEl.appendChild(title);

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'energy-flow-canvas';
        this.canvas.width = 280;
        this.canvas.height = 150;

        containerEl.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
    }

    setupEventListeners() {
        // Listen for playlist changes
        document.addEventListener('playlist-loaded', e => {
            this.loadPlaylistData(e.detail);
        });

        // Listen for track changes
        document.addEventListener('track-changed', e => {
            this.currentTrack = e.detail;
            this.highlightCurrentTrack();
        });

        // Connect to playlist database
        if (window.playlistDB) {
            // Get current playlist data
            this.refreshData();
        }
    }

    async loadPlaylistData(playlistId) {
        try {
            if (window.electronAPI) {
                // Get playlist with tracks and analytics
                const result = await window.electronAPI.invoke(
                    'get-playlist-with-tracks',
                    playlistId
                );
                if (result && result.tracks) {
                    this.playlist = result.tracks;
                    this.processEnergyData();
                    this.startAnimation();
                }

                // Get analytics
                const analytics = await window.electronAPI.invoke(
                    'get-playlist-analytics',
                    playlistId
                );
                if (analytics) {
                    this.updateAnalytics(analytics);
                }
            }
        } catch (error) {
            console.error('Failed to load playlist data:', error);
        }
    }

    async refreshData() {
        // Get current queue or playlist
        if (window.simplePlayer && window.simplePlayer.queue) {
            this.playlist = window.simplePlayer.queue;
            this.processEnergyData();
            this.startAnimation();
        }
    }

    processEnergyData() {
        // Extract energy, mood, and BPM data from tracks
        this.energyData = [];
        this.moodData = [];
        this.bpmData = [];

        this.playlist.forEach(track => {
            // Get energy (0-1)
            const energy = track.AI_ENERGY || Math.random() * 0.5 + 0.3;
            this.energyData.push(energy);

            // Get mood/valence (0-1)
            const mood = track.AI_VALENCE || Math.random() * 0.5 + 0.3;
            this.moodData.push(mood);

            // Get BPM normalized (0-1)
            const bpm = track.AI_BPM || 120;
            const normalizedBpm = (bpm - 60) / 140; // Normalize 60-200 BPM to 0-1
            this.bpmData.push(normalizedBpm);
        });

        // Show container if we have data
        if (this.energyData.length > 0) {
            const container = document.querySelector('.energy-flow-container');
            if (container) {
                container.style.display = 'block';
            }
        }
    }

    drawEnergyFlow() {
        if (!this.ctx || !this.canvas) {
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Draw background grid
        this.drawGrid();

        // Draw energy line
        if (this.energyData.length > 0) {
            this.drawDataLine(this.energyData, '#667eea', 'Energy', 2);
        }

        // Draw mood line
        if (this.moodData.length > 0) {
            this.drawDataLine(this.moodData, '#FDB813', 'Mood', 1.5);
        }

        // Draw BPM line
        if (this.bpmData.length > 0) {
            this.drawDataLine(this.bpmData, '#764ba2', 'BPM', 1);
        }

        // Draw current position
        this.drawCurrentPosition();

        // Draw legend
        this.drawLegend();
    }

    drawGrid() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        this.ctx.lineWidth = 1;

        // Horizontal lines
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Vertical lines
        for (let i = 0; i <= 10; i++) {
            const x = (width / 10) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
    }

    drawDataLine(data, color, label, lineWidth) {
        if (data.length === 0) {
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const stepX = width / (data.length - 1 || 1);

        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, color + '88');
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, color + '88');

        // Draw filled area
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 0.1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height);

        data.forEach((value, index) => {
            const x = index * stepX;
            const y = height - value * height * 0.8 - 10;

            if (index === 0) {
                this.ctx.lineTo(x, y);
            } else {
                // Smooth curve
                const prevX = (index - 1) * stepX;
                const prevY = height - data[index - 1] * height * 0.8 - 10;
                const cpX = (prevX + x) / 2;

                this.ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
                this.ctx.quadraticCurveTo(cpX, (prevY + y) / 2, x, y);
            }
        });

        this.ctx.lineTo(width, height);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.globalAlpha = 1;

        // Draw line
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        data.forEach((value, index) => {
            const x = index * stepX;
            const y = height - value * height * 0.8 - 10;

            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                // Smooth curve
                const prevX = (index - 1) * stepX;
                const prevY = height - data[index - 1] * height * 0.8 - 10;
                const cpX = (prevX + x) / 2;

                this.ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
                this.ctx.quadraticCurveTo(cpX, (prevY + y) / 2, x, y);
            }
        });

        this.ctx.stroke();

        // Draw points
        this.ctx.fillStyle = color;
        data.forEach((value, index) => {
            const x = index * stepX;
            const y = height - value * height * 0.8 - 10;

            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawCurrentPosition() {
        if (!this.currentTrack || this.playlist.length === 0) {
            return;
        }

        // Find current track index
        const currentIndex = this.playlist.findIndex(
            t => t.id === this.currentTrack.id || t.file_path === this.currentTrack.file_path
        );

        if (currentIndex < 0) {
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const stepX = width / (this.playlist.length - 1 || 1);
        const x = currentIndex * stepX;

        // Draw vertical line
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Draw indicator
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.beginPath();
        this.ctx.arc(x, 10, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawLegend() {
        const legends = [
            { color: '#667eea', label: 'Energy' },
            { color: '#FDB813', label: 'Mood' },
            { color: '#764ba2', label: 'BPM' }
        ];

        this.ctx.font = '10px sans-serif';

        legends.forEach((legend, index) => {
            const x = 10 + index * 80;
            const y = this.canvas.height - 5;

            // Draw color dot
            this.ctx.fillStyle = legend.color;
            this.ctx.beginPath();
            this.ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw label
            this.ctx.fillStyle = '#666';
            this.ctx.fillText(legend.label, x + 8, y);
        });
    }

    updateAnalytics(analytics) {
        // Update display with analytics data
        const container = document.querySelector('.energy-flow-container');
        if (!container) {
            return;
        }

        // Check if stats div exists
        let statsDiv = container.querySelector('.energy-flow-stats');
        if (!statsDiv) {
            statsDiv = document.createElement('div');
            statsDiv.className = 'energy-flow-stats';
            statsDiv.style.cssText = 'font-size: 11px; color: #666; margin-top: 5px;';
            container.appendChild(statsDiv);
        }

        // Update stats
        statsDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <span>Avg Energy: ${(analytics.avg_energy * 100).toFixed(0)}%</span>
                <span>Avg BPM: ${Math.round(analytics.avg_bpm)}</span>
                <span>Tracks: ${analytics.total_tracks}</span>
            </div>
        ";
    }

    highlightCurrentTrack() {
        // Redraw with current position
        this.drawEnergyFlow();
    }

    startAnimation() {
        this.stopAnimation();

        const animate = () => {
            this.time += this.flowSpeed;
            this.drawEnergyFlow();

            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    destroy() {
        this.stopAnimation();

        const container = document.querySelector('.energy-flow-container');
        if (container) {
            container.remove();
        }
    }
}

// Initialize energy flow visualizer
window.energyFlowVisualizer = new EnergyFlowVisualizer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnergyFlowVisualizer;
}
