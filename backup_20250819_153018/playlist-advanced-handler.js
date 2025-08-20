// Advanced Playlist Handler
// Funcionalidades avanzadas para gestión de playlists

const path = require('path');
const fs = require('fs').promises;

class AdvancedPlaylistHandler {
    constructor(db) {
        this.db = db;
    }

    createHandlers() {
        return {
            // Ordenamiento de tracks
            reorderPlaylistTracks: this.reorderPlaylistTracks.bind(this),
            moveTrackInPlaylist: this.moveTrackInPlaylist.bind(this),

            // Duplicación y merge
            duplicatePlaylist: this.duplicatePlaylist.bind(this),
            mergePlaylists: this.mergePlaylists.bind(this),

            // Folders/Carpetas
            createPlaylistFolder: this.createPlaylistFolder.bind(this),
            movePlaylistToFolder: this.movePlaylistToFolder.bind(this),
            getPlaylistHierarchy: this.getPlaylistHierarchy.bind(this),

            // Export avanzado
            exportToRekordbox: this.exportToRekordbox.bind(this),
            exportToSerato: this.exportToSerato.bind(this),
            exportToTraktor: this.exportToTraktor.bind(this),
            exportToM3U8: this.exportToM3U8.bind(this),

            // Analytics
            getPlaylistAnalytics: this.getPlaylistAnalytics.bind(this),
            getPlaylistEnergyFlow: this.getPlaylistEnergyFlow.bind(this),
            getKeyCompatibility: this.getKeyCompatibility.bind(this),
            getBPMTransitions: this.getBPMTransitions.bind(this),

            // Tags y colores
            setPlaylistColor: this.setPlaylistColor.bind(this),
            addPlaylistTag: this.addPlaylistTag.bind(this),
            getPlaylistsByTag: this.getPlaylistsByTag.bind(this),

            // Búsqueda
            searchInPlaylist: this.searchInPlaylist.bind(this),
            findDuplicatesInPlaylist: this.findDuplicatesInPlaylist.bind(this),

            // Smart features
            autoArrangeByEnergy: this.autoArrangeByEnergy.bind(this),
            autoArrangeByKey: this.autoArrangeByKey.bind(this),
            suggestNextTrack: this.suggestNextTrack.bind(this)
        };
    }

    // Reordenar todos los tracks de una playlist
    async reorderPlaylistTracks(event, playlistId, trackIds) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                try {
                    // Primero eliminar todos los tracks
                    this.db.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);

                    // Insertar en el nuevo orden
                    const stmt = this.db.prepare(
                        'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, datetime("now"))'
                    );

                    trackIds.forEach((trackId, index) => {
                        stmt.run(playlistId, trackId, index);
                    });

                    stmt.finalize();
                    this.db.run('COMMIT');

                    resolve({ success: true, message: 'Playlist reordered' });
                } catch (error) {
                    this.db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    }

    // Mover un track a una nueva posición
    async moveTrackInPlaylist(event, playlistId, trackId, newPosition) {
        return new Promise((resolve, reject) => {
            // Obtener posición actual
            this.db.get(
                'SELECT position FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
                [playlistId, trackId],
                async (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!row) {
                        return reject(new Error('Track not found in playlist'));
                    }

                    const oldPosition = row.position;

                    this.db.serialize(() => {
                        this.db.run('BEGIN TRANSACTION');

                        try {
                            if (newPosition > oldPosition) {
                                // Mover hacia abajo
                                this.db.run(
                                    'UPDATE playlist_tracks SET position = position - 1 WHERE playlist_id = ? AND position > ? AND position <= ?',
                                    [playlistId, oldPosition, newPosition]
                                );
                            } else {
                                // Mover hacia arriba
                                this.db.run(
                                    'UPDATE playlist_tracks SET position = position + 1 WHERE playlist_id = ? AND position >= ? AND position < ?',
                                    [playlistId, newPosition, oldPosition]
                                );
                            }

                            // Actualizar posición del track
                            this.db.run(
                                'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?',
                                [newPosition, playlistId, trackId]
                            );

                            this.db.run('COMMIT');
                            resolve({ success: true });
                        } catch (error) {
                            this.db.run('ROLLBACK');
                            reject(error);
                        }
                    });
                }
            );
        });
    }

    // Duplicar playlist
    async duplicatePlaylist(event, playlistId) {
        return new Promise((resolve, reject) => {
            // Obtener playlist original
            this.db.get('SELECT * FROM playlists WHERE id = ?', [playlistId], (err, playlist) => {
                if (err) {
                    return reject(err);
                }
                if (!playlist) {
                    return reject(new Error('Playlist not found'));
                }

                // Crear copia
                this.db.run(
                    'INSERT INTO playlists (name, description, type, parent_id, color, tags) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        playlist.name + ' (Copy)',
                        playlist.description,
                        playlist.type,
                        playlist.parent_id,
                        playlist.color,
                        playlist.tags
                    ],
                    function (err) {
                        if (err) {
                            return reject(err);
                        }

                        const newPlaylistId = this.lastID;

                        // Copiar tracks
                        this.db.run(
                            `INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
                                 SELECT ?, track_id, position, datetime('now')
                                 FROM playlist_tracks
                                 WHERE playlist_id = ?',
                            [newPlaylistId, playlistId],
                            err => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve({
                                    success: true,
                                    newPlaylistId: newPlaylistId,
                                    message: 'Playlist duplicated successfully'
                                });
                            }
                        );
                    }
                );
            });
        });
    }

    // Fusionar playlists
    async mergePlaylists(event, sourceIds, targetName) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                try {
                    // Crear nueva playlist
                    this.db.run(
                        'INSERT INTO playlists (name, description, type) VALUES (?, ?, ?)',
                        [targetName, 'Merged playlist', 'manual'],
                        function (err) {
                            if (err) {
                                throw err;
                            }

                            const newPlaylistId = this.lastID;
                            let position = 0;

                            // Agregar tracks de cada playlist fuente
                            sourceIds.forEach(sourceId => {
                                this.db.all(
                                    'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position',
                                    [sourceId],
                                    (err, tracks) => {
                                        if (err) {
                                            throw err;
                                        }

                                        const stmt = this.db.prepare(
                                            'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, datetime("now`))'
                                        );

                                        tracks.forEach(track => {
                                            stmt.run(newPlaylistId, track.track_id, position++);
                                        });

                                        stmt.finalize();
                                    }
                                );
                            });

                            this.db.run('COMMIT`);
                            resolve({
                                success: true,
                                newPlaylistId: newPlaylistId,
                                message: `Merged ${sourceIds.length} playlists`
                            });
                        }
                    );
                } catch (error) {
                    this.db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    }

    // Crear carpeta de playlists
    async createPlaylistFolder(event, name, parentId = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO playlists (name, type, parent_id) VALUES (?, ?, ?)',
                [name, 'folder', parentId],
                function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve({
                        success: true,
                        folderId: this.lastID,
                        message: 'Folder created'
                    });
                }
            );
        });
    }

    // Mover playlist a carpeta
    async movePlaylistToFolder(event, playlistId, folderId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE playlists SET parent_id = ? WHERE id = ?`,
                [folderId, playlistId],
                err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve({ success: true });
                }
            );
        });
    }

    // Obtener jerarquía de playlists
    async getPlaylistHierarchy(event) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT p.*, COUNT(pt.track_id) as track_count
                 FROM playlists p
                 LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
                 GROUP BY p.id
                 ORDER BY p.parent_id, p.name`,
                [],
                (err, rows) => {
                    if (err) {
                        return reject(err);
                    }

                    // Construir árbol
                    const tree = this.buildTree(rows);
                    resolve({ success: true, hierarchy: tree });
                }
            );
        });
    }

    buildTree(items, parentId = null) {
        const tree = [];

        items
            .filter(item => item.parent_id === parentId)
            .forEach(item => {
                const node = {
                    ...item,
                    children: this.buildTree(items, item.id)
                };
                tree.push(node);
            });

        return tree;
    }

    // Export a Rekordbox XML
    async exportToRekordbox(event, playlistId, outputPath) {
        return new Promise((resolve, reject) => {
            // Obtener playlist con tracks
            this.db.all(
                `SELECT af.*, pt.position
                 FROM playlist_tracks pt
                 JOIN audio_files af ON pt.track_id = af.id
                 WHERE pt.playlist_id = ?
                 ORDER BY pt.position`,
                [playlistId],
                async (err, tracks) => {
                    if (err) {
                        return reject(err);
                    }

                    // Generar XML de Rekordbox
                    const xml = this.generateRekordboxXML(tracks);

                    try {
                        await fs.writeFile(outputPath, xml, 'utf8');
                        resolve({ success: true, path: outputPath });
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    generateRekordboxXML(tracks) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<DJ_PLAYLISTS Version="1.0.0">\n';
        xml += '  <COLLECTION Entries="' + tracks.length + '`>\n`;

        tracks.forEach((track, index) => {
            xml += `    <TRACK TrackID="${index + 1}" Name="${this.escapeXML(track.title || track.file_name)}" 
                     Artist="${this.escapeXML(track.artist || '')}" 
                     Album="${this.escapeXML(track.album || '')}"
                     Genre="${this.escapeXML(track.genre || '')}"
                     Location="file://localhost${this.escapeXML(track.file_path)}"
                     TotalTime="${Math.round(track.duration || 0)}"
                     AverageBpm="${track.AI_BPM || track.existing_bmp || 0}"
                     Key="${track.AI_KEY || ''}">\n`;
            xml += '    </TRACK>\n';
        });

        xml += '  </COLLECTION>\n';
        xml += '</DJ_PLAYLISTS>';

        return xml;
    }

    escapeXML(str) {
        if (!str) {
            return '';
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;`)
            .replace(/`/g, '&quot;')
            .replace(/'/g, `&apos;`);
    }

    // Export a M3U8
    async exportToM3U8(event, playlistId, outputPath) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT af.*
                 FROM playlist_tracks pt
                 JOIN audio_files af ON pt.track_id = af.id
                 WHERE pt.playlist_id = ?
                 ORDER BY pt.position`,
                [playlistId],
                async (err, tracks) => {
                    if (err) {
                        return reject(err);
                    }

                    let m3u8 = '#EXTM3U\n`;

                    tracks.forEach(track => {
                        const duration = Math.round(track.duration || -1);
                        const title = track.artist
                            ? `${track.artist} - ${track.title || track.file_name}`
                            : track.file_name;
                        m3u8 += `#EXTINF:${duration},${title}\n`;
                        m3u8 += `${track.file_path}\n`;
                    });

                    try {
                        await fs.writeFile(outputPath, m3u8, 'utf8`);
                        resolve({ success: true, path: outputPath });
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    // Analytics de playlist
    async getPlaylistAnalytics(event, playlistId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    af.*,
                    lm.*,
                    pt.position
                 FROM playlist_tracks pt
                 JOIN audio_files af ON pt.track_id = af.id
                 LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                 WHERE pt.playlist_id = ?
                 ORDER BY pt.position`,
                [playlistId],
                (err, tracks) => {
                    if (err) {
                        return reject(err);
                    }

                    const analytics = {
                        totalTracks: tracks.length,
                        totalDuration: tracks.reduce((sum, t) => sum + (t.duration || 0), 0),

                        // BPM Analysis
                        avgBPM: this.calculateAverage(tracks, 'AI_BPM'),
                        minBPM: Math.min(...tracks.map(t => t.AI_BPM || 120)),
                        maxBPM: Math.max(...tracks.map(t => t.AI_BPM || 120)),
                        bpmRange: null,

                        // Energy Analysis
                        avgEnergy: this.calculateAverage(tracks, 'AI_ENERGY'),
                        energyFlow: this.calculateEnergyFlow(tracks),
                        energyPeaks: this.findEnergyPeaks(tracks),

                        // Key Analysis
                        keyDistribution: this.getKeyDistribution(tracks),
                        keyCompatibility: this.calculateKeyCompatibility(tracks),

                        // Mood Analysis
                        moodDistribution: this.getMoodDistribution(tracks),
                        dominantMood: null,

                        // Genre Analysis
                        genreDistribution: this.getGenreDistribution(tracks),
                        dominantGenre: null,

                        // Danceability
                        avgDanceability: this.calculateAverage(tracks, 'AI_DANCEABILITY'),

                        // Valence (positivity)
                        avgValence: this.calculateAverage(tracks, 'AI_VALENCE'),

                        // Recommendations
                        recommendations: this.generatePlaylistRecommendations(tracks)
                    };

                    analytics.bpmRange = analytics.maxBPM - analytics.minBPM;
                    analytics.dominantMood = this.findDominant(analytics.moodDistribution);
                    analytics.dominantGenre = this.findDominant(analytics.genreDistribution);

                    resolve({ success: true, analytics });
                }
            );
        });
    }

    calculateAverage(tracks, field) {
        const values = tracks.map(t => parseFloat(t[field]) || 0).filter(v => v > 0);
        if (values.length === 0) {
            return 0;
        }
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    calculateEnergyFlow(tracks) {
        return tracks.map((track, index) => ({
            position: index,
            trackName: track.title || track.file_name,
            energy: parseFloat(track.AI_ENERGY) || 0.5,
            trend:
                index > 0
                    ? (parseFloat(track.AI_ENERGY) || 0.5) -
                      (parseFloat(tracks[index - 1].AI_ENERGY) || 0.5)
                    : 0
        }));
    }

    findEnergyPeaks(tracks) {
        const peaks = [];

        for (let i = 1; i < tracks.length - 1; i++) {
            const prev = parseFloat(tracks[i - 1].AI_ENERGY) || 0.5;
            const curr = parseFloat(tracks[i].AI_ENERGY) || 0.5;
            const next = parseFloat(tracks[i + 1].AI_ENERGY) || 0.5;

            // Peak: higher than neighbors
            if (curr > prev && curr > next && curr > 0.7) {
                peaks.push({
                    position: i,
                    track: tracks[i].title || tracks[i].file_name,
                    energy: curr,
                    type: 'peak'
                });
            }
            // Valley: lower than neighbors
            else if (curr < prev && curr < next && curr < 0.3) {
                peaks.push({
                    position: i,
                    track: tracks[i].title || tracks[i].file_name,
                    energy: curr,
                    type: 'valley'
                });
            }
        }

        return peaks;
    }

    getKeyDistribution(tracks) {
        const keys = {};
        tracks.forEach(track => {
            const key = track.AI_KEY || 'Unknown';
            keys[key] = (keys[key] || 0) + 1;
        });
        return keys;
    }

    calculateKeyCompatibility(tracks) {
        const compatibility = [];

        for (let i = 0; i < tracks.length - 1; i++) {
            const key1 = tracks[i].AI_KEY;
            const key2 = tracks[i + 1].AI_KEY;

            if (key1 && key2) {
                const compatible = this.areKeysCompatible(key1, key2);
                compatibility.push({
                    from: tracks[i].title || tracks[i].file_name,
                    to: tracks[i + 1].title || tracks[i + 1].file_name,
                    fromKey: key1,
                    toKey: key2,
                    compatible: compatible,
                    position: i
                });
            }
        }

        return compatibility;
    }

    areKeysCompatible(key1, key2) {
        // Simplified Camelot Wheel compatibility
        const camelotWheel = {
            '1A': ['12A', '1A', '2A', '1B'],
            '2A': ['1A', '2A', '3A', '2B'],
            '3A': ['2A', '3A', '4A', '3B'],
            '4A': ['3A', '4A', '5A', '4B'],
            '5A': ['4A', '5A', '6A', '5B'],
            '6A': ['5A', '6A', '7A', '6B'],
            '7A': ['6A', '7A', '8A', '7B'],
            '8A': ['7A', '8A', '9A', '8B'],
            '9A': ['8A', '9A', '10A', '9B'],
            '10A': ['9A', '10A', '11A', '10B'],
            '11A': ['10A', '11A', '12A', '11B'],
            '12A': ['11A', '12A', '1A', '12B'],
            '1B': ['12B', '1B', '2B', '1A'],
            '2B': ['1B', '2B', '3B', '2A'],
            '3B': ['2B', '3B', '4B', '3A'],
            '4B': ['3B', '4B', '5B', '4A'],
            '5B': ['4B', '5B', '6B', '5A'],
            '6B': ['5B', '6B', '7B', '6A'],
            '7B': ['6B', '7B', '8B', '7A'],
            '8B': ['7B', '8B', '9B', '8A'],
            '9B': ['8B', '9B', '10B', '9A'],
            '10B': ['9B', '10B', '11B', '10A'],
            '11B': ['10B', '11B', '12B', '11A'],
            '12B': ['11B', '12B', '1B', '12A']
        };

        return camelotWheel[key1]?.includes(key2) || false;
    }

    getMoodDistribution(tracks) {
        const moods = {};
        tracks.forEach(track => {
            const mood = track.AI_MOOD || 'Unknown';
            moods[mood] = (moods[mood] || 0) + 1;
        });
        return moods;
    }

    getGenreDistribution(tracks) {
        const genres = {};
        tracks.forEach(track => {
            const genre = track.LLM_GENRE || track.genre || 'Unknown';
            genres[genre] = (genres[genre] || 0) + 1;
        });
        return genres;
    }

    findDominant(distribution) {
        let max = 0;
        let dominant = null;

        for (const [key, value] of Object.entries(distribution)) {
            if (value > max) {
                max = value;
                dominant = key;
            }
        }

        return dominant;
    }

    generatePlaylistRecommendations(tracks) {
        const recommendations = [];

        // Check energy flow
        const energyFlow = this.calculateEnergyFlow(tracks);
        const avgEnergyChange =
            energyFlow.reduce((sum, t) => sum + Math.abs(t.trend), 0) / energyFlow.length;

        if (avgEnergyChange > 0.3) {
            recommendations.push({
                type: 'energy',
                message: 'High energy variation detected. Consider smoothing transitions.',
                severity: 'warning'
            });
        }

        // Check BPM jumps
        for (let i = 0; i < tracks.length - 1; i++) {
            const bpm1 = tracks[i].AI_BPM || 120;
            const bpm2 = tracks[i + 1].AI_BPM || 120;
            const bpmDiff = Math.abs(bpm2 - bpm1);

            if (bpmDiff > 10) {
                recommendations.push({
                    type: 'bpm`,
                    message: `Large BPM jump at position ${i + 1}: ${bpm1} → ${bpm2} BPM`,
                    severity: 'warning',
                    position: i
                });
            }
        }

        // Check key compatibility
        const keyCompat = this.calculateKeyCompatibility(tracks);
        const incompatible = keyCompat.filter(k => !k.compatible);

        if (incompatible.length > 0) {
            recommendations.push({
                type: 'key`,
                message: `${incompatible.length} key clashes detected`,
                severity: 'info',
                details: incompatible
            });
        }

        return recommendations;
    }

    // Auto-arrange por energía
    async autoArrangeByEnergy(event, playlistId, direction = 'ascending`) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT pt.*, af.*, lm.AI_ENERGY
                 FROM playlist_tracks pt
                 JOIN audio_files af ON pt.track_id = af.id
                 LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                 WHERE pt.playlist_id = ?`,
                [playlistId],
                async (err, tracks) => {
                    if (err) {
                        return reject(err);
                    }

                    // Ordenar por energía
                    tracks.sort((a, b) => {
                        const energyA = parseFloat(a.AI_ENERGY) || 0.5;
                        const energyB = parseFloat(b.AI_ENERGY) || 0.5;
                        return direction === 'ascending` ? energyA - energyB : energyB - energyA;
                    });

                    // Reordenar en la base de datos
                    const trackIds = tracks.map(t => t.track_id);
                    await this.reorderPlaylistTracks(event, playlistId, trackIds);

                    resolve({
                        success: true,
                        message: `Playlist arranged by energy (${direction})`
                    });
                }
            );
        });
    }

    // Auto-arrange por key (Camelot Wheel)
    async autoArrangeByKey(event, playlistId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT pt.*, af.*, lm.AI_KEY
                 FROM playlist_tracks pt
                 JOIN audio_files af ON pt.track_id = af.id
                 LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                 WHERE pt.playlist_id = ?`,
                [playlistId],
                async (err, tracks) => {
                    if (err) {
                        return reject(err);
                    }

                    // Ordenar por compatibilidad de key
                    const arranged = this.arrangeByKeyCompatibility(tracks);

                    // Reordenar en la base de datos
                    const trackIds = arranged.map(t => t.track_id);
                    await this.reorderPlaylistTracks(event, playlistId, trackIds);

                    resolve({
                        success: true,
                        message: 'Playlist arranged by key compatibility`
                    });
                }
            );
        });
    }

    arrangeByKeyCompatibility(tracks) {
        if (tracks.length === 0) {
            return [];
        }

        const arranged = [tracks[0]];
        const remaining = tracks.slice(1);

        while (remaining.length > 0) {
            const lastTrack = arranged[arranged.length - 1];
            const lastKey = lastTrack.AI_KEY;

            // Buscar el track más compatible
            let bestMatch = null;
            let bestIndex = -1;

            remaining.forEach((track, index) => {
                if (this.areKeysCompatible(lastKey, track.AI_KEY)) {
                    bestMatch = track;
                    bestIndex = index;
                }
            });

            if (bestMatch) {
                arranged.push(bestMatch);
                remaining.splice(bestIndex, 1);
            } else {
                // Si no hay match compatible, agregar el siguiente
                arranged.push(remaining.shift());
            }
        }

        return arranged;
    }

    // Sugerir siguiente track
    async suggestNextTrack(event, playlistId, currentTrackId) {
        return new Promise((resolve, reject) => {
            // Obtener track actual
            this.db.get(
                `SELECT af.*, lm.*
                 FROM audio_files af
                 LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                 WHERE af.id = ?`,
                [currentTrackId],
                (err, currentTrack) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!currentTrack) {
                        return reject(new Error('Track not found`));
                    }

                    // Obtener todos los tracks de la playlist
                    this.db.all(
                        `SELECT af.*, lm.*, pt.position
                         FROM playlist_tracks pt
                         JOIN audio_files af ON pt.track_id = af.id
                         LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                         WHERE pt.playlist_id = ?`,
                        [playlistId],
                        (err, tracks) => {
                            if (err) {
                                return reject(err);
                            }

                            // Calcular scores para cada track
                            const suggestions = tracks.map(track => {
                                const score = this.calculateTransitionScore(currentTrack, track);
                                return { ...track, score };
                            });

                            // Ordenar por score
                            suggestions.sort((a, b) => b.score - a.score);

                            // Devolver top 5 sugerencias
                            resolve({
                                success: true,
                                suggestions: suggestions.slice(0, 5).map(s => ({
                                    track: {
                                        id: s.id,
                                        title: s.title || s.file_name,
                                        artist: s.artist
                                    },
                                    score: s.score,
                                    reasons: this.getTransitionReasons(currentTrack, s)
                                }))
                            });
                        }
                    );
                }
            );
        });
    }

    calculateTransitionScore(from, to) {
        let score = 0;

        // BPM compatibility (máx 30 puntos)
        const bpmDiff = Math.abs((from.AI_BPM || 120) - (to.AI_BPM || 120));
        if (bpmDiff <= 2) {
            score += 30;
        } else if (bpmDiff <= 5) {
            score += 20;
        } else if (bpmDiff <= 10) {
            score += 10;
        }

        // Key compatibility (máx 30 puntos)
        if (this.areKeysCompatible(from.AI_KEY, to.AI_KEY)) {
            score += 30;
        }

        // Energy flow (máx 20 puntos)
        const energyDiff = Math.abs(
            (parseFloat(from.AI_ENERGY) || 0.5) - (parseFloat(to.AI_ENERGY) || 0.5)
        );
        if (energyDiff <= 0.2) {
            score += 20;
        } else if (energyDiff <= 0.4) {
            score += 10;
        }

        // Genre compatibility (máx 10 puntos)
        if (from.LLM_GENRE === to.LLM_GENRE || from.genre === to.genre) {
            score += 10;
        }

        // Mood compatibility (máx 10 puntos)
        if (from.AI_MOOD === to.AI_MOOD) {
            score += 10;
        }

        return score;
    }

    getTransitionReasons(from, to) {
        const reasons = [];

        const bpmDiff = Math.abs((from.AI_BPM || 120) - (to.AI_BPM || 120));
        if (bpmDiff <= 5) {
            reasons.push(`BPM match (${bpmDiff} BPM difference)`);
        }

        if (this.areKeysCompatible(from.AI_KEY, to.AI_KEY)) {
            reasons.push(`Key compatible (${from.AI_KEY} → ${to.AI_KEY})`);
        }

        const energyDiff = (parseFloat(to.AI_ENERGY) || 0.5) - (parseFloat(from.AI_ENERGY) || 0.5);
        if (Math.abs(energyDiff) <= 0.2) {
            reasons.push('Smooth energy transition');
        } else if (energyDiff > 0) {
            reasons.push('Energy boost');
        } else {
            reasons.push('Energy cooldown`);
        }

        return reasons;
    }
}

function createAdvancedPlaylistHandlers(db) {
    const handler = new AdvancedPlaylistHandler(db);
    return handler.createHandlers();
}

module.exports = { createAdvancedPlaylistHandlers };
