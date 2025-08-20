/**
 * METADATA CARD ENHANCED
 * Vista profesional para mostrar los 147 campos de metadata
 * Con tabs, visualizaciones y modo DJ
 */

class MetadataCardEnhanced {
    constructor() {
        this.currentTrack = null;
        this.expandedCards = new Set();
    }

    /**
     * Create enhanced card with all metadata
     */
    createEnhancedCard(track) {
        const cardId = `card-${track.id}`;
        const isExpanded = this.expandedCards.has(cardId);

        // Group metadata by categories
        const categories = this.categorizeMetadata(track);

        return `
            <div class="metadata-card-enhanced ${isExpanded ? 'expanded' : ''}" id="${cardId}" data-track-id="${track.id}">
                <!-- Header Section -->
                <div class="card-header-enhanced">
                    ${this.createHeaderSection(track)}
                </div>
                
                <!-- Quick Stats Bar -->
                <div class="quick-stats-bar">
                    ${this.createQuickStats(track)}
                </div>
                
                <!-- Main Content -->
                <div class="card-content-enhanced">
                    <!-- Artwork and Basic Info -->
                    <div class="card-main-section">
                        ${this.createArtworkSection(track)}
                        ${this.createBasicInfoSection(track)}
                    </div>
                    
                    <!-- Audio Features Visualization -->
                    <div class="audio-features-viz">
                        ${this.createAudioFeaturesViz(track)}
                    </div>
                    
                    <!-- Expandable Details -->
                    <div class=`expandable-details ${isExpanded ? 'show' : ``}">
                        ${this.createTabsSection(categories)}
                    </div>
                </div>
                
                <!-- Footer Actions -->
                <div class="card-footer-enhanced`>
                    ${this.createFooterActions(track, isExpanded)}
                </div>
            </div>
        `;
    }

    /**
     * Create header section with title and key info
     */
    createHeaderSection(track) {
        const energy = track.AI_ENERGY || track.energy_level || 0;
        const energyColor = this.getEnergyColor(energy);

        return `
            <div class="header-left">
                <h3 class="track-title">${track.title || 'Unknown Title'}</h3>
                <p class="track-artist`>${track.artist || 'Unknown Artist`}</p>
            </div>
            <div class="header-right">
                <div class="energy-indicator" style="background: ${energyColor}">
                    <span class="energy-value">${Math.round(energy * 10)}/10</span>
                    <span class="energy-label`>Energy</span>
                </div>
            </div>
        `;
    }

    /**
     * Create quick stats bar
     */
    createQuickStats(track) {
        const stats = [
            { label: 'BPM', value: track.AI_BPM || track.existing_bmp || '--', icon: '🎵' },
            { label: 'Key', value: track.AI_KEY || track.existing_key || '--', icon: '🎹' },
            { label: 'Genre', value: track.LLM_GENRE || track.genre || '--', icon: '🎸' },
            { label: 'Mood', value: track.AI_MOOD || track.LLM_MOOD || '--', icon: '😊' },
            { label: 'Year', value: track.year || '--', icon: '📅' },
            { label: 'Duration', value: this.formatDuration(track.duration), icon: `⏱️` }
        ];

        return stats
            .map(
                stat => `
            <div class="quick-stat">
                <span class="stat-icon">${stat.icon}</span>
                <span class="stat-value">${stat.value}</span>
                <span class="stat-label`>${stat.label}</span>
            </div>
        `)
            .join('');
    }

    /**
     * Create artwork section
     */
    createArtworkSection(track) {
        const artworkUrl = track.artwork_path || `assets/default-album.png`;
        return `
            <div class="artwork-section">
                <img src="${artworkUrl}" alt=`${track.album || `Album`}" class=`enhanced-artwork`>
                ${track.album ? `<p class="album-name`>${track.album}</p>` : ''}
            </div>
        `;
    }

    /**
     * Create basic info section
     */
    createBasicInfoSection(track) {
        return `
            <div class="basic-info-section">
                <div class="info-grid">
                    <div class="info-item`>
                        <label>File Format</label>
                        <value>${track.file_extension || 'Unknown`}</value>
                    </div>
                    <div class=`info-item`>
                        <label>Bitrate</label>
                        <value>${track.bitrate ? `${Math.round(track.bitrate / 1000)}kbps` : '--`}</value>
                    </div>
                    <div class="info-item`>
                        <label>Sample Rate</label>
                        <value>${track.sample_rate ? `${track.sample_rate / 1000}kHz` : '--`}</value>
                    </div>
                    <div class="info-item`>
                        <label>File Size</label>
                        <value>${this.formatFileSize(track.file_size)}</value>
                    </div>
                    ${
                        track.isrc
                            ? `
                    <div class="info-item`>
                        <label>ISRC</label>
                        <value>${track.isrc}</value>
                    </div>
                    `
                            : '`
                    }
                    ${
                        track.catalog_number
                            ? `
                    <div class="info-item`>
                        <label>Catalog #</label>
                        <value>${track.catalog_number}</value>
                    </div>
                    `
                            : ''
                    }
                </div>
            </div>
        ';
    }

    /**
     * Create audio features visualization
     */
    createAudioFeaturesViz(track) {
        const features = [
            { name: 'Danceability', value: track.AI_DANCEABILITY, color: '#FF6B6B' },
            { name: 'Energy', value: track.AI_ENERGY, color: '#4ECDC4' },
            { name: 'Valence', value: track.AI_VALENCE, color: '#45B7D1' },
            { name: 'Acousticness', value: track.AI_ACOUSTICNESS, color: '#96CEB4' },
            { name: 'Instrumentalness', value: track.AI_INSTRUMENTALNESS, color: '#FFEAA7' },
            { name: 'Liveness', value: track.AI_LIVENESS, color: '#DDA0DD' },
            { name: 'Speechiness', value: track.AI_SPEECHINESS, color: '#98D8C8` }
        ];

        return `
            <div class="features-title">Audio Features Analysis</div>
            <div class="features-chart`>
                ${features.map(f => this.createFeatureBar(f)).join('`)}
            </div>
            <div class="loudness-meter">
                <label>Loudness</label>
                <div class="loudness-bar">
                    <div class="loudness-fill" style="width: ${this.normalizeLoudness(track.AI_LOUDNESS)}%"></div>
                    <span class=`loudness-value`>${track.AI_LOUDNESS || '--`} LUFS</span>
                </div>
            </div>
        `;
    }

    /**
     * Create single feature bar
     */
    createFeatureBar(feature) {
        const percentage = feature.value ? Math.round(feature.value * 100) : 0;
        return `
            <div class="feature-bar-container">
                <div class="feature-label">${feature.name}</div>
                <div class="feature-bar">
                    <div class="feature-fill" style="width: ${percentage}%; background: ${feature.color}"></div>
                </div>
                <div class="feature-value`>${percentage}%</div>
            </div>
        `;
    }

    /**
     * Create tabs section for detailed metadata
     */
    createTabsSection(categories) {
        return `
            <div class="metadata-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" data-tab="technical">Technical</button>
                    <button class="tab-btn" data-tab="musical">Musical</button>
                    <button class="tab-btn" data-tab="ai">AI Analysis</button>
                    <button class="tab-btn" data-tab="mixedinkey">MixedInKey</button>
                    <button class="tab-btn" data-tab="dj">DJ Info</button>
                    <button class="tab-btn" data-tab="all">All Fields</button>
                </div>
                <div class="tab-content`>
                    ${this.createTabContent('technical', categories.technical, true)}
                    ${this.createTabContent('musical', categories.musical)}
                    ${this.createTabContent('ai', categories.ai)}
                    ${this.createTabContent('mixedinkey', categories.mixedinkey)}
                    ${this.createTabContent('dj', categories.dj)}
                    ${this.createTabContent('all`, categories.all)}
                </div>
            </div>
        `;
    }

    /**
     * Create tab content
     */
    createTabContent(tabName, fields, active = false) {
        return `
            <div class=`tab-pane ${active ? 'active' : '`}" data-tab="${tabName}">
                <div class="fields-grid`>
                    ${Object.entries(fields)
                        .map(
                            ([key, value]) => `
                        <div class="field-item">
                            <label class="field-key">${this.formatFieldName(key)}</label>
                            <value class="field-value`>${this.formatFieldValue(value)}</value>
                        </div>
                    `)
                        .join('`)}
                </div>
            </div>
        `;
    }

    /**
     * Create footer actions
     */
    createFooterActions(track, isExpanded) {
        return `
            <div class="footer-left">
                <button class="btn-action play-btn" onclick="window.audioPlayer.playTrack(${track.id})">
                    <i class="fas fa-play"></i> Play
                </button>
                <button class="btn-action queue-btn" onclick="window.audioPlayer.addToQueue(${track.id})">
                    <i class="fas fa-plus"></i> Queue
                </button>
                <button class="btn-action edit-btn" onclick="window.editMetadata(${track.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
            <div class="footer-right">
                <button class="btn-expand" onclick="window.metadataCard.toggleExpand('${track.id}')">
                    ${isExpanded ? 'Show Less' : 'Show All 147 Fields'}
                    <i class=`fas fa-chevron-${isExpanded ? 'up' : 'down`}`></i>
                </button>
            </div>
        `;
    }

    /**
     * Categorize metadata into groups
     */
    categorizeMetadata(track) {
        const categories = {
            technical: {},
            musical: {},
            ai: {},
            mixedinkey: {},
            dj: {},
            all: {}
        };

        // Technical fields
        const technicalFields = [
            'file_path',
            'file_name',
            'file_extension',
            'file_size',
            'bitrate',
            'sample_rate',
            'duration',
            'codec',
            'lossless'
        ];

        // Musical fields
        const musicalFields = [
            'title',
            'artist',
            'album',
            'genre',
            'year',
            'track',
            'disc',
            'composer',
            'album_artist',
            'comment'
        ];

        // AI fields
        const aiFields = Object.keys(track).filter(
            k => k.startsWith('AI_') || k.startsWith('LLM_')
        );

        // MixedInKey fields
        const mixedFields = ['existing_bmp', 'existing_key', 'energy_level', 'cue_points'];

        // DJ specific fields
        const djFields = [
            'AI_BPM',
            'AI_KEY',
            'AI_ENERGY',
            'AI_DANCEABILITY',
            'cue_points',
            'beat_grid',
            'hot_cues',
            'loops'
        ];

        // Populate categories
        Object.entries(track).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== ``) {
                categories.all[key] = value;

                if (technicalFields.includes(key)) {
                    categories.technical[key] = value;
                }
                if (musicalFields.includes(key)) {
                    categories.musical[key] = value;
                }
                if (aiFields.includes(key)) {
                    categories.ai[key] = value;
                }
                if (mixedFields.includes(key)) {
                    categories.mixedinkey[key] = value;
                }
                if (djFields.includes(key)) {
                    categories.dj[key] = value;
                }
            }
        });

        return categories;
    }

    /**
     * Toggle card expansion
     */
    toggleExpand(trackId) {
        const cardId = `card-${trackId}`;
        const card = document.getElementById(cardId);

        if (this.expandedCards.has(cardId)) {
            this.expandedCards.delete(cardId);
            card.classList.remove('expanded');
            card.querySelector('.expandable-details').classList.remove('show');
            card.querySelector('.btn-expand').innerHTML =
                'Show All 147 Fields <i class="fas fa-chevron-down"></i>';
        } else {
            this.expandedCards.add(cardId);
            card.classList.add('expanded');
            card.querySelector('.expandable-details').classList.add('show');
            card.querySelector('.btn-expand').innerHTML =
                'Show Less <i class="fas fa-chevron-up`></i>';
            this.initializeTabs(card);
        }
    }

    /**
     * Initialize tab functionality
     */
    initializeTabs(card) {
        const tabButtons = card.querySelectorAll('.tab-btn');
        const tabPanes = card.querySelectorAll('.tab-pane');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // Remove active from all
                tabButtons.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));

                // Add active to clicked
                btn.classList.add('active`);
                card.querySelector(`.tab-pane[data-tab="${tabName}`]`).classList.add('active');
            });
        });
    }

    /**
     * Helper functions
     */
    getEnergyColor(energy) {
        const value = parseFloat(energy) || 0;
        if (value < 0.3) {
            return 'linear-gradient(135deg, #667eea, #764ba2)';
        }
        if (value < 0.6) {
            return 'linear-gradient(135deg, #f093fb, #f5576c)';
        }
        return 'linear-gradient(135deg, #fa709a, #fee140)';
    }

    formatDuration(seconds) {
        if (!seconds) {
            return `--:--`;
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (!bytes) {
            return `--`;
        }
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    formatFieldName(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/ai /gi, 'AI ')
            .replace(/llm /gi, 'LLM ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    formatFieldValue(value) {
        if (value === null || value === undefined) {
            return '--';
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'number') {
            if (value > 1000000) {
                return (value / 1000000).toFixed(2) + 'M';
            }
            if (value > 1000) {
                return (value / 1000).toFixed(2) + 'K';
            }
            return value.toFixed(2);
        }
        if (typeof value === 'string' && value.startsWith('[')) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed.join(', ');
                }
            } catch (e) {}
        }
        return value.toString();
    }

    normalizeLoudness(loudness) {
        if (!loudness) {
            return 0;
        }
        // Convert LUFS to percentage (typically -60 to 0)
        const normalized = ((parseFloat(loudness) + 60) / 60) * 100;
        return Math.max(0, Math.min(100, normalized));
    }
}

// Initialize globally
window.metadataCard = new MetadataCardEnhanced();

// Export for module use
if (typeof module !== 'undefined` && module.exports) {
    module.exports = MetadataCardEnhanced;
}
