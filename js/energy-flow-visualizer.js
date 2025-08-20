// Energy Flow Visualizer - Visualización profesional de flujo de energía
class EnergyFlowVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.tracks = [];
        this.isPlaying = false;
        this.currentTrackIndex = 0;
        this.animationFrame = null;
        this.colors = {
            low: '#3B82F6',      // Blue - Low energy (0-0.3)
            medium: '#10B981',   // Green - Medium energy (0.3-0.6)
            high: '#F59E0B',     // Orange - High energy (0.6-0.8)
            peak: '#EF4444'      // Red - Peak energy (0.8-1.0)
        };
        this.init();
    }

    init() {
        this.createVisualizerPanel();
        this.attachEventListeners();
        this.loadQueueTracks();
    }

    createVisualizerPanel() {
        const panelHTML = `
            <div id="energy-flow-panel" class="energy-flow-panel" style="display: none;">
                <div class="flow-container">
                    <div class="flow-header">
                        <h3>🎵 Energy Flow Visualizer</h3>
                        <div class="flow-controls">
                            <button class="flow-btn" onclick="energyFlow.toggleView()">
                                <span class="btn-icon">📊</span>
                                <span class="btn-text">Graph View</span>
                            </button>
                            <button class="flow-btn" onclick="energyFlow.analyzeFlow()">
                                <span class="btn-icon">🔍</span>
                                <span class="btn-text">Analyze</span>
                            </button>
                            <button class="flow-btn" onclick="energyFlow.optimizeFlow()">
                                <span class="btn-icon">✨</span>
                                <span class="btn-text">Auto-Optimize</span>
                            </button>
                            <button class="close-btn" onclick="energyFlow.close()">✕</button>
                        </div>
                    </div>
                    
                    <div class="flow-content">
                        <!-- Canvas for energy visualization -->
                        <div class="canvas-container">
                            <canvas id="energy-flow-canvas"></canvas>
                            <div class="canvas-overlay">
                                <div class="time-ruler" id="time-ruler"></div>
                                <div class="energy-zones" id="energy-zones"></div>
                            </div>
                        </div>
                        
                        <!-- Track list with energy bars -->
                        <div class="energy-track-list">
                            <div class="list-header">
                                <span>Track</span>
                                <span>Energy</span>
                                <span>Transition</span>
                            </div>
                            <div id="energy-tracks-container" class="tracks-container">
                                <!-- Tracks will be rendered here -->
                            </div>
                        </div>
                        
                        <!-- Analysis Panel -->
                        <div class="analysis-panel" id="analysis-panel" style="display: none;">
                            <h4>Flow Analysis</h4>
                            <div class="analysis-content">
                                <div class="metric">
                                    <span class="metric-label">Energy Variance:</span>
                                    <span class="metric-value" id="energy-variance">--</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Smooth Transitions:</span>
                                    <span class="metric-value" id="smooth-transitions">--</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Energy Peaks:</span>
                                    <span class="metric-value" id="energy-peaks">--</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Flow Score:</span>
                                    <span class="metric-value score" id="flow-score">--</span>
                                </div>
                            </div>
                            <div class="suggestions" id="flow-suggestions">
                                <!-- Suggestions will appear here -->
                            </div>
                        </div>
                    </div>
                    
                    <!-- Statistics Bar -->
                    <div class="flow-stats">
                        <div class="stat">
                            <span class="stat-label">Total Tracks:</span>
                            <span class="stat-value" id="total-tracks">0</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Duration:</span>
                            <span class="stat-value" id="total-duration">0:00</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Avg Energy:</span>
                            <span class="stat-value" id="avg-energy">0%</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Energy Range:</span>
                            <span class="stat-value" id="energy-range">0-0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = panelHTML;
        document.body.appendChild(container.firstElementChild);
        
        this.panel = document.getElementById('energy-flow-panel');
        this.canvas = document.getElementById('energy-flow-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resizeCanvas();
    }

    attachEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Listen for queue updates
        document.addEventListener('queueUpdated', () => this.loadQueueTracks());
        
        // Listen for track changes
        document.addEventListener('trackChanged', (e) => {
            this.currentTrackIndex = e.detail.index;
            this.updateVisualization();
        });
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth - 40;
        this.canvas.height = 300;
        this.drawEnergyFlow();
    }

    async loadQueueTracks() {
        try {
            // Get tracks from queue or current playlist
            const response = await window.api.invoke('get-queue-tracks');
            if (response.success) {
                this.tracks = response.tracks;
                this.updateVisualization();
            }
        } catch (error) {
            console.error('Error loading queue tracks:', error);
            // Use sample data for demonstration
            this.loadSampleData();
        }
    }

    loadSampleData() {
        // Sample tracks for demonstration
        this.tracks = [
            { title: 'Opening Track', artist: 'DJ Intro', energy: 0.3, bpm: 120, duration: 240 },
            { title: 'Warm Up', artist: 'Builder', energy: 0.45, bpm: 122, duration: 300 },
            { title: 'Rising Energy', artist: 'Progressive', energy: 0.6, bpm: 124, duration: 320 },
            { title: 'First Peak', artist: 'Mainfloor', energy: 0.75, bpm: 126, duration: 280 },
            { title: 'Peak Time', artist: 'Big Room', energy: 0.9, bpm: 128, duration: 260 },
            { title: 'Sustained Energy', artist: 'Festival', energy: 0.85, bpm: 128, duration: 290 },
            { title: 'Second Wave', artist: 'Anthem', energy: 0.95, bpm: 130, duration: 270 },
            { title: 'Energy Dip', artist: 'Breather', energy: 0.65, bpm: 125, duration: 310 },
            { title: 'Build Again', artist: 'Progressive 2', energy: 0.7, bpm: 126, duration: 300 },
            { title: 'Final Peak', artist: 'Closer', energy: 0.88, bpm: 128, duration: 280 },
            { title: 'Cool Down', artist: 'Outro', energy: 0.5, bpm: 122, duration: 320 },
            { title: 'Closing', artist: 'Ambient', energy: 0.25, bpm: 118, duration: 360 }
        ];
        this.updateVisualization();
    }

    updateVisualization() {
        this.drawEnergyFlow();
        this.renderTrackList();
        this.updateStatistics();
    }

    drawEnergyFlow() {
        if (!this.ctx || !this.tracks.length) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 20;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Draw background zones
        this.drawEnergyZones(width, height);
        
        // Calculate positions
        const graphWidth = width - (padding * 2);
        const graphHeight = height - (padding * 2);
        const stepX = graphWidth / Math.max(this.tracks.length - 1, 1);
        
        // Draw grid
        this.drawGrid(width, height, padding);
        
        // Draw energy line
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = 'rgba(102, 126, 234, 0.5)';
        this.ctx.shadowBlur = 10;
        
        // Create gradient fill
        const gradient = this.ctx.createLinearGradient(0, padding, 0, height - padding);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');   // Red at top
        gradient.addColorStop(0.2, 'rgba(245, 158, 11, 0.3)'); // Orange
        gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.3)'); // Green
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');   // Blue at bottom
        
        // Draw smooth curve through energy points
        const points = this.tracks.map((track, index) => ({
            x: padding + (index * stepX),
            y: height - padding - (track.energy * graphHeight)
        }));
        
        // Move to first point
        this.ctx.moveTo(points[0].x, points[0].y);
        
        // Draw smooth curve using quadratic bezier
        for (let i = 1; i < points.length; i++) {
            const xMid = (points[i].x + points[i - 1].x) / 2;
            const yMid = (points[i].y + points[i - 1].y) / 2;
            const cp1x = (xMid + points[i - 1].x) / 2;
            const cp2x = (xMid + points[i].x) / 2;
            
            this.ctx.quadraticCurveTo(cp1x, points[i - 1].y, xMid, yMid);
            this.ctx.quadraticCurveTo(cp2x, points[i].y, points[i].x, points[i].y);
        }
        
        this.ctx.stroke();
        
        // Fill area under curve
        this.ctx.lineTo(points[points.length - 1].x, height - padding);
        this.ctx.lineTo(points[0].x, height - padding);
        this.ctx.closePath();
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Draw points
        points.forEach((point, index) => {
            const track = this.tracks[index];
            const color = this.getEnergyColor(track.energy);
            
            // Outer circle
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            
            // Inner circle
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = 'white';
            this.ctx.fill();
            
            // Highlight current track
            if (index === this.currentTrackIndex) {
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        });
        
        // Draw labels
        this.ctx.fillStyle = '#666';
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        
        // Y-axis labels (energy levels)
        const energyLevels = [0, 0.25, 0.5, 0.75, 1];
        energyLevels.forEach(level => {
            const y = height - padding - (level * graphHeight);
            this.ctx.fillText(`${(level * 100).toFixed(0)}%`, padding - 10, y + 3);
        });
    }

    drawEnergyZones(width, height) {
        const zones = [
            { start: 0, end: 0.3, color: 'rgba(59, 130, 246, 0.1)', label: 'Low' },
            { start: 0.3, end: 0.6, color: 'rgba(16, 185, 129, 0.1)', label: 'Medium' },
            { start: 0.6, end: 0.8, color: 'rgba(245, 158, 11, 0.1)', label: 'High' },
            { start: 0.8, end: 1, color: 'rgba(239, 68, 68, 0.1)', label: 'Peak' }
        ];
        
        const padding = 20;
        const graphHeight = height - (padding * 2);
        
        zones.forEach(zone => {
            const yStart = height - padding - (zone.end * graphHeight);
            const yEnd = height - padding - (zone.start * graphHeight);
            const zoneHeight = yEnd - yStart;
            
            this.ctx.fillStyle = zone.color;
            this.ctx.fillRect(padding, yStart, width - (padding * 2), zoneHeight);
        });
    }

    drawGrid(width, height, padding) {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding + (i * (height - padding * 2) / 4);
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
        }
        
        // Vertical grid lines
        const numLines = Math.min(this.tracks.length, 12);
        for (let i = 0; i < numLines; i++) {
            const x = padding + (i * (width - padding * 2) / (numLines - 1));
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, height - padding);
            this.ctx.stroke();
        }
    }

    renderTrackList() {
        const container = document.getElementById('energy-tracks-container');
        if (!container) return;
        
        let html = '';
        this.tracks.forEach((track, index) => {
            const energy = track.energy || track.AI_ENERGY || 0;
            const energyPercent = (energy * 100).toFixed(0);
            const color = this.getEnergyColor(energy);
            const isPlaying = index === this.currentTrackIndex;
            
            // Calculate transition quality
            const prevEnergy = index > 0 ? (this.tracks[index - 1].energy || 0) : energy;
            const energyDiff = Math.abs(energy - prevEnergy);
            const transitionQuality = this.getTransitionQuality(energyDiff);
            
            html += `
                <div class="energy-track-item ${isPlaying ? 'playing' : ''}" data-index="${index}">
                    <div class="track-info">
                        <span class="track-number">${index + 1}</span>
                        <div class="track-details">
                            <div class="track-title">${track.title || track.file_name || 'Unknown'}</div>
                            <div class="track-artist">${track.artist || 'Unknown'}</div>
                        </div>
                    </div>
                    <div class="energy-meter">
                        <div class="energy-bar" style="width: ${energyPercent}%; background: ${color}">
                            <span class="energy-value">${energyPercent}%</span>
                        </div>
                    </div>
                    <div class="transition-indicator ${transitionQuality.class}">
                        ${transitionQuality.icon} ${transitionQuality.label}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    getTransitionQuality(energyDiff) {
        if (energyDiff < 0.1) {
            return { class: 'smooth', icon: '✅', label: 'Smooth' };
        } else if (energyDiff < 0.2) {
            return { class: 'good', icon: '👍', label: 'Good' };
        } else if (energyDiff < 0.3) {
            return { class: 'moderate', icon: '⚠️', label: 'Moderate' };
        } else {
            return { class: 'harsh', icon: '⚡', label: 'Harsh' };
        }
    }

    updateStatistics() {
        // Calculate statistics
        const totalTracks = this.tracks.length;
        const totalDuration = this.tracks.reduce((sum, t) => sum + (t.duration || 180), 0);
        const avgEnergy = this.tracks.reduce((sum, t) => sum + (t.energy || 0), 0) / totalTracks;
        const minEnergy = Math.min(...this.tracks.map(t => t.energy || 0));
        const maxEnergy = Math.max(...this.tracks.map(t => t.energy || 0));
        
        // Update UI
        document.getElementById('total-tracks').textContent = totalTracks;
        document.getElementById('total-duration').textContent = this.formatDuration(totalDuration);
        document.getElementById('avg-energy').textContent = `${(avgEnergy * 100).toFixed(0)}%`;
        document.getElementById('energy-range').textContent = 
            `${(minEnergy * 100).toFixed(0)}-${(maxEnergy * 100).toFixed(0)}%`;
    }

    analyzeFlow() {
        const analysisPanel = document.getElementById('analysis-panel');
        analysisPanel.style.display = analysisPanel.style.display === 'none' ? 'block' : 'none';
        
        if (analysisPanel.style.display === 'block') {
            this.performFlowAnalysis();
        }
    }

    performFlowAnalysis() {
        // Calculate metrics
        const energies = this.tracks.map(t => t.energy || 0);
        
        // Energy variance
        const mean = energies.reduce((a, b) => a + b) / energies.length;
        const variance = energies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / energies.length;
        
        // Smooth transitions count
        let smoothCount = 0;
        for (let i = 1; i < energies.length; i++) {
            if (Math.abs(energies[i] - energies[i - 1]) < 0.15) {
                smoothCount++;
            }
        }
        const smoothPercent = (smoothCount / (energies.length - 1) * 100).toFixed(0);
        
        // Energy peaks
        let peaks = 0;
        for (let i = 1; i < energies.length - 1; i++) {
            if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1] && energies[i] > 0.7) {
                peaks++;
            }
        }
        
        // Flow score (0-100)
        const flowScore = Math.min(100, Math.round(
            (smoothPercent * 0.4) + 
            ((1 - variance) * 100 * 0.3) + 
            (Math.min(peaks, 3) / 3 * 100 * 0.3)
        ));
        
        // Update UI
        document.getElementById('energy-variance').textContent = variance.toFixed(2);
        document.getElementById('smooth-transitions').textContent = `${smoothPercent}%`;
        document.getElementById('energy-peaks').textContent = peaks;
        document.getElementById('flow-score').textContent = flowScore;
        
        // Generate suggestions
        this.generateSuggestions(variance, smoothPercent, peaks, flowScore);
    }

    generateSuggestions(variance, smoothPercent, peaks, flowScore) {
        const suggestions = [];
        
        if (variance > 0.1) {
            suggestions.push('⚠️ High energy variance detected. Consider smoother transitions.');
        }
        if (smoothPercent < 50) {
            suggestions.push('💡 Many harsh transitions. Try reordering tracks for better flow.');
        }
        if (peaks === 0) {
            suggestions.push('📈 No energy peaks detected. Add some high-energy tracks.');
        } else if (peaks > 4) {
            suggestions.push('📊 Too many peaks. Consider spacing them out more.');
        }
        if (flowScore > 80) {
            suggestions.push('✨ Excellent flow! This playlist is well-structured.');
        }
        
        const container = document.getElementById('flow-suggestions');
        container.innerHTML = suggestions.map(s => `<div class="suggestion">${s}</div>`).join('');
    }

    optimizeFlow() {
        // Auto-optimize track order for better energy flow
        const optimized = [...this.tracks];
        
        // Simple optimization: sort by energy with smooth transitions
        optimized.sort((a, b) => {
            // Create a wave pattern: low -> high -> low
            const midPoint = optimized.length / 2;
            const aDistance = Math.abs(optimized.indexOf(a) - midPoint);
            const bDistance = Math.abs(optimized.indexOf(b) - midPoint);
            
            if (aDistance < bDistance) {
                return (b.energy || 0) - (a.energy || 0);
            } else {
                return (a.energy || 0) - (b.energy || 0);
            }
        });
        
        this.tracks = optimized;
        this.updateVisualization();
        window.showToast('Playlist optimized for better energy flow!', 'success');
    }

    toggleView() {
        // Toggle between different visualization modes
        window.showToast('Alternative views coming soon', 'info');
    }

    getEnergyColor(energy) {
        if (energy < 0.3) return this.colors.low;
        if (energy < 0.6) return this.colors.medium;
        if (energy < 0.8) return this.colors.high;
        return this.colors.peak;
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    open() {
        this.panel.style.display = 'block';
        this.loadQueueTracks();
        setTimeout(() => {
            this.resizeCanvas();
        }, 100);
    }

    close() {
        this.panel.style.display = 'none';
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.energyFlow = new EnergyFlowVisualizer();
    });
} else {
    window.energyFlow = new EnergyFlowVisualizer();
}