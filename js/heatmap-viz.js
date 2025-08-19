// TASK_026: Canvas Visualization - BPM vs Energy Heatmap
class BPMEnergyHeatmap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
            this.canvas.width = 800;
            this.canvas.height = 400;
        }

        this.ctx = this.canvas.getContext('2d');
        this.data = [];
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.padding = 40;

        // Escalas
        this.scaleX = this.createScale(60, 200, this.padding, this.width - this.padding);
        this.scaleY = this.createScale(0, 1, this.height - this.padding, this.padding);

        // Grid para heatmap
        this.gridSize = 20;
        this.heatGrid = [];

        // Interacción
        this.selectedRegion = null;
        this.setupInteraction();
    }

    createScale(domainMin, domainMax, rangeMin, rangeMax) {
        return value => {
            const ratio = (value - domainMin) / (domainMax - domainMin);
            return rangeMin + ratio * (rangeMax - rangeMin);
        };
    }

    setData(tracks) {
        this.data = tracks.filter(t => t.AI_BPM && t.AI_ENERGY);
        this.calculateHeatmap();
        this.render();
    }

    calculateHeatmap() {
        // Inicializar grid
        this.heatGrid = Array(this.gridSize)
            .fill(null)
            .map(() => Array(this.gridSize).fill(0));

        // Contar puntos en cada celda
        this.data.forEach(track => {
            const bpm = parseInt(track.AI_BPM) || 0;
            const energy = parseFloat(track.AI_ENERGY) || 0;

            if (bpm >= 60 && bpm <= 200 && energy >= 0 && energy <= 1) {
                const gridX = Math.floor(((bpm - 60) / 140) * (this.gridSize - 1));
                const gridY = Math.floor((1 - energy) * (this.gridSize - 1));

                if (gridX >= 0 && gridX < this.gridSize && gridY >= 0 && gridY < this.gridSize) {
                    this.heatGrid[gridY][gridX]++;
                }
            }
        });

        // Normalizar valores
        const maxCount = Math.max(...this.heatGrid.flat());
        if (maxCount > 0) {
            this.heatGrid = this.heatGrid.map(row => row.map(count => count / maxCount));
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw heatmap
        this.drawHeatmap();

        // Draw points
        this.drawPoints();

        // Draw axes
        this.drawAxes();

        // Draw labels
        this.drawLabels();
    }

    drawHeatmap() {
        const cellWidth = (this.width - 2 * this.padding) / this.gridSize;
        const cellHeight = (this.height - 2 * this.padding) / this.gridSize;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const intensity = this.heatGrid[y][x];

                // Color gradient: blue -> purple -> red
                const hue = 240 - intensity * 240; // Blue to Red
                const saturation = 50 + intensity * 50;
                const lightness = 20 + intensity * 30;

                this.ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`;
                this.ctx.fillRect(
                    this.padding + x * cellWidth,
                    this.padding + y * cellHeight,
                    cellWidth,
                    cellHeight
                );
            }
        }
    }

    drawPoints() {
        this.data.forEach(track => {
            const x = this.scaleX(parseInt(track.AI_BPM) || 120);
            const y = this.scaleY(parseFloat(track.AI_ENERGY) || 0.5);

            // Draw point
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, 2 * Math.PI);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.fill();

            // Glow effect for high energy
            if (track.AI_ENERGY > 0.7) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
                this.ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                this.ctx.fill();
            }
        });
    }

    drawAxes() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;

        // X axis
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.height - this.padding);
        this.ctx.lineTo(this.width - this.padding, this.height - this.padding);
        this.ctx.stroke();

        // Y axis
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.padding);
        this.ctx.lineTo(this.padding, this.height - this.padding);
        this.ctx.stroke();

        // Grid lines
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';

        // Vertical grid
        for (let bpm = 60; bpm <= 200; bpm += 20) {
            const x = this.scaleX(bpm);
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.padding);
            this.ctx.lineTo(x, this.height - this.padding);
            this.ctx.stroke();
        }

        // Horizontal grid
        for (let energy = 0; energy <= 1; energy += 0.2) {
            const y = this.scaleY(energy);
            this.ctx.beginPath();
            this.ctx.moveTo(this.padding, y);
            this.ctx.lineTo(this.width - this.padding, y);
            this.ctx.stroke();
        }
    }

    drawLabels() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '12px -apple-system, sans-serif';

        // X axis labels (BPM)
        this.ctx.textAlign = 'center';
        for (let bpm = 60; bpm <= 200; bpm += 20) {
            const x = this.scaleX(bpm);
            this.ctx.fillText(bpm, x, this.height - this.padding + 20);
        }

        // X axis title
        this.ctx.fillText('BPM', this.width / 2, this.height - 5);

        // Y axis labels (Energy)
        this.ctx.textAlign = 'right';
        for (let energy = 0; energy <= 1; energy += 0.2) {
            const y = this.scaleY(energy);
            this.ctx.fillText((energy * 100).toFixed(0) + '%', this.padding - 10, y + 5);
        }

        // Y axis title
        this.ctx.save();
        this.ctx.translate(10, this.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Energy', 0, 0);
        this.ctx.restore();

        // Title
        this.ctx.textAlign = 'center';
        this.ctx.font = '16px -apple-system, sans-serif';
        this.ctx.fillText('BPM vs Energy Distribution', this.width / 2, 20);
    }

    setupInteraction() {
        this.canvas.addEventListener('click', e => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if click is within chart area
            if (
                x >= this.padding &&
                x <= this.width - this.padding &&
                y >= this.padding &&
                y <= this.height - this.padding
            ) {
                // Convert to BPM/Energy values
                const bpm = this.inverseScaleX(x);
                const energy = this.inverseScaleY(y);

                // Emit selection event
                if (this.onRegionSelect) {
                    this.onRegionSelect({
                        bpmMin: Math.max(60, bpm - 10),
                        bpmMax: Math.min(200, bpm + 10),
                        energyMin: Math.max(0, energy - 0.1),
                        energyMax: Math.min(1, energy + 0.1)
                    });
                }

                // Visual feedback
                this.highlightRegion(x, y);
            }
        });
    }

    inverseScaleX(pixelX) {
        const ratio = (pixelX - this.padding) / (this.width - 2 * this.padding);
        return 60 + ratio * 140;
    }

    inverseScaleY(pixelY) {
        const ratio = (pixelY - this.padding) / (this.height - 2 * this.padding);
        return 1 - ratio;
    }

    highlightRegion(x, y) {
        this.render(); // Redraw base

        // Draw highlight
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
        this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
        this.ctx.lineWidth = 2;

        const size = 40;
        this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
        this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    }

    // Export as image
    exportImage() {
        return this.canvas.toDataURL('image/png');
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BPMEnergyHeatmap };
} else {
    window.BPMEnergyHeatmap = BPMEnergyHeatmap;
}
