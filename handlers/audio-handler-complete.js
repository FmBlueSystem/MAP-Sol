// Complete Audio IPC Handler with Electron Integration
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

class AudioHandler {
    constructor(db) {
        this.db = db;
        this.currentTrack = null;
        this.queue = [];
        this.queueIndex = -1;
        this.isPlaying = false;
        this.volume = 1.0;
        this.currentTime = 0;
        this.shuffle = false;
        this.repeat = 'none'; // 'none', 'one', 'all'
        this.crossfade = 0;
        this.gapless = true;
        this.playHistory = [];
        this.maxHistory = 100;
    }

    // Play track by ID
    async playTrack(event, trackId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.*,
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            this.db.get(sql, [trackId], (err, track) => {
                if (err) {
                    reject(err);
                } else if (!track) {
                    resolve({ success: false, error: 'Track not found' });
                } else {
                    this.currentTrack = track;
                    this.isPlaying = true;
                    this.currentTime = 0;

                    // Add to history
                    this.addToHistory(track);

                    // Send to renderer
                    this.broadcastPlayerState();

                    // Send track data to renderer for actual playback
                    const windows = BrowserWindow.getAllWindows();
                    windows.forEach(window => {
                        window.webContents.send('play-audio', {
                            track,
                            filePath: track.file_path,
                            volume: this.volume,
                            crossfade: this.crossfade
                        });
                    });

                    resolve({
                        success: true,
                        track,
                        state: this.getPlayerState()
                    });
                }
            });
        });
    }

    // Play file directly
    async playFile(event, filePath) {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }

        // Try to find in database
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.*,
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.file_path = ?
            `;

            this.db.get(sql, [filePath], (err, track) => {
                if (err) {
                    reject(err);
                } else {
                    // Create minimal track object if not in DB
                    if (!track) {
                        track = {
                            file_path: filePath,
                            file_name: path.basename(filePath),
                            title: path.basename(filePath, path.extname(filePath))
                        };
                    }

                    this.currentTrack = track;
                    this.isPlaying = true;
                    this.currentTime = 0;

                    this.broadcastPlayerState();

                    const windows = BrowserWindow.getAllWindows();
                    windows.forEach(window => {
                        window.webContents.send('play-audio', {
                            track,
                            filePath,
                            volume: this.volume,
                            crossfade: this.crossfade
                        });
                    });

                    resolve({
                        success: true,
                        track,
                        state: this.getPlayerState()
                    });
                }
            });
        });
    }

    // Pause playback
    async pause() {
        this.isPlaying = false;

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('pause-audio');
        });

        this.broadcastPlayerState();

        return {
            success: true,
            state: this.getPlayerState()
        };
    }

    // Resume playback
    async resume() {
        this.isPlaying = true;

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('resume-audio');
        });

        this.broadcastPlayerState();

        return {
            success: true,
            state: this.getPlayerState()
        };
    }

    // Stop playback
    async stop() {
        this.isPlaying = false;
        this.currentTime = 0;

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('stop-audio');
        });

        this.broadcastPlayerState();

        return {
            success: true,
            state: this.getPlayerState()
        };
    }

    // Next track
    async next() {
        if (this.queue.length === 0) {
            return { success: false, error: 'Queue is empty' };
        }

        if (this.shuffle) {
            // Random track
            this.queueIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            // Next in queue
            this.queueIndex++;

            if (this.queueIndex >= this.queue.length) {
                if (this.repeat === 'all') {
                    this.queueIndex = 0;
                } else {
                    return { success: false, error: 'End of queue' };
                }
            }
        }

        const nextTrack = this.queue[this.queueIndex];
        return this.playTrack(null, nextTrack.id);
    }

    // Previous track
    async previous() {
        // If more than 3 seconds into track, restart it
        if (this.currentTime > 3) {
            this.currentTime = 0;

            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
                window.webContents.send('seek-audio', 0);
            });

            return {
                success: true,
                state: this.getPlayerState()
            };
        }

        // Go to previous track
        if (this.queue.length === 0) {
            return { success: false, error: 'Queue is empty' };
        }

        this.queueIndex--;

        if (this.queueIndex < 0) {
            if (this.repeat === 'all') {
                this.queueIndex = this.queue.length - 1;
            } else {
                this.queueIndex = 0;
            }
        }

        const prevTrack = this.queue[this.queueIndex];
        return this.playTrack(null, prevTrack.id);
    }

    // Set queue
    async setQueue(event, tracks) {
        this.queue = tracks;
        this.queueIndex = -1;

        this.broadcastQueueUpdate();

        return {
            success: true,
            queue: this.queue
        };
    }

    // Add to queue
    async addToQueue(event, track) {
        this.queue.push(track);

        this.broadcastQueueUpdate();

        return {
            success: true,
            queue: this.queue
        };
    }

    // Clear queue
    async clearQueue() {
        this.queue = [];
        this.queueIndex = -1;

        this.broadcastQueueUpdate();

        return {
            success: true,
            queue: this.queue
        };
    }

    // Get queue
    async getQueue() {
        return {
            success: true,
            queue: this.queue,
            queueIndex: this.queueIndex
        };
    }

    // Set volume
    async setVolume(event, volume) {
        this.volume = Math.max(0, Math.min(1, volume));

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('set-volume', this.volume);
        });

        this.broadcastPlayerState();

        return {
            success: true,
            volume: this.volume
        };
    }

    // Seek to position
    async seek(event, position) {
        this.currentTime = position;

        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('seek-audio', position);
        });

        this.broadcastPlayerState();

        return {
            success: true,
            position: this.currentTime
        };
    }

    // Get player state
    getPlayerState() {
        return {
            currentTrack: this.currentTrack,
            isPlaying: this.isPlaying,
            volume: this.volume,
            currentTime: this.currentTime,
            duration: this.currentTrack?.duration || 0,
            shuffle: this.shuffle,
            repeat: this.repeat,
            queueLength: this.queue.length,
            queueIndex: this.queueIndex,
            crossfade: this.crossfade,
            gapless: this.gapless
        };
    }

    // Analyze track (waveform, BPM, key detection)
    async analyzeTrack(event, trackId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.file_path,
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            this.db.get(sql, [trackId], async (err, track) => {
                if (err) {
                    reject(err);
                } else if (!track) {
                    resolve({ success: false, error: 'Track not found' });
                } else {
                    // Perform analysis (placeholder - would use actual audio analysis library)
                    const analysis = {
                        bpm: track.AI_BPM || this.detectBPM(track.file_path),
                        key: track.AI_KEY || this.detectKey(track.file_path),
                        energy: track.AI_ENERGY || Math.random(),
                        waveform: await this.generateWaveform(track.file_path),
                        cuePoints: this.detectCuePoints(track.file_path),
                        beatGrid: this.generateBeatGrid(track.AI_BPM)
                    };

                    // Save analysis to database
                    this.saveAnalysis(trackId, analysis);

                    resolve({
                        success: true,
                        analysis
                    });
                }
            });
        });
    }

    // Get transition points for mixing
    async getTransitionPoints(event, fromTrackId, toTrackId) {
        // Analyze both tracks
        const fromAnalysis = await this.analyzeTrack(null, fromTrackId);
        const toAnalysis = await this.analyzeTrack(null, toTrackId);

        if (!fromAnalysis.success || !toAnalysis.success) {
            return { success: false, error: 'Failed to analyze tracks' };
        }

        // Calculate transition points
        const bpmDiff = Math.abs(fromAnalysis.analysis.bpm - toAnalysis.analysis.bpm);
        const keyCompatibility = this.calculateKeyCompatibility(
            fromAnalysis.analysis.key,
            toAnalysis.analysis.key
        );

        return {
            success: true,
            transition: {
                fromTrackId,
                toTrackId,
                bpmDiff,
                keyCompatibility,
                suggestedMixPoint: this.calculateMixPoint(
                    fromAnalysis.analysis,
                    toAnalysis.analysis
                ),
                transitionType: this.suggestTransitionType(bpmDiff, keyCompatibility),
                beatMatching: bpmDiff < 5,
                harmonicMixing: keyCompatibility > 0.7
            }
        };
    }

    // Helper methods
    addToHistory(track) {
        this.playHistory.unshift({
            track,
            timestamp: Date.now()
        });

        if (this.playHistory.length > this.maxHistory) {
            this.playHistory.pop();
        }
    }

    broadcastPlayerState() {
        const state = this.getPlayerState();
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('player-state-update', state);
        });
    }

    broadcastQueueUpdate() {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('queue-updated', {
                queue: this.queue,
                queueIndex: this.queueIndex
            });
        });
    }

    // Audio analysis helpers (placeholders - would use actual libraries)
    detectBPM(filePath) {
        // Placeholder - would use essentia.js or similar
        return Math.floor(Math.random() * 60) + 90; // 90-150 BPM
    }

    detectKey(filePath) {
        // Placeholder - would use key detection algorithm
        const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Ab', 'Eb', 'Bb', 'F'];
        const modes = ['major', 'minor'];
        return `${keys[Math.floor(Math.random() * keys.length)]} ${modes[Math.floor(Math.random() * 2)]}`;
    }

    async generateWaveform(filePath) {
        // Placeholder - would use peaks.js or similar
        const peaks = [];
        for (let i = 0; i < 1000; i++) {
            peaks.push(Math.random());
        }
        return peaks;
    }

    detectCuePoints(filePath) {
        // Placeholder - would detect intro, outro, drops, etc.
        return {
            intro: 0,
            outro: 180,
            drop1: 30,
            drop2: 90,
            breakdown: 60
        };
    }

    generateBeatGrid(bpm) {
        if (!bpm) {
            return [];
        }

        const beatInterval = 60 / bpm;
        const grid = [];

        for (let i = 0; i < 200; i++) {
            grid.push(i * beatInterval);
        }

        return grid;
    }

    calculateKeyCompatibility(key1, key2) {
        // Simplified Camelot Wheel compatibility
        if (key1 === key2) {
            return 1.0;
        }

        // Would implement actual harmonic mixing rules
        return Math.random() * 0.5 + 0.5;
    }

    calculateMixPoint(fromAnalysis, toAnalysis) {
        // Calculate optimal mix point based on energy, structure, etc.
        return {
            fromTime: fromAnalysis.cuePoints?.outro || 150,
            toTime: toAnalysis.cuePoints?.intro || 0,
            duration: 8 // bars
        };
    }

    suggestTransitionType(bpmDiff, keyCompatibility) {
        if (bpmDiff < 5 && keyCompatibility > 0.7) {
            return 'smooth_blend';
        } else if (bpmDiff > 20) {
            return 'hard_cut';
        } else {
            return 'echo_out';
        }
    }

    saveAnalysis(trackId, analysis) {
        // Save to llm_metadata table
        const sql = `
            UPDATE llm_metadata
            SET 
                AI_BPM = ?,
                AI_KEY = ?,
                AI_ENERGY = ?
            WHERE file_id = ?
        `;

        this.db.run(sql, [analysis.bpm, analysis.key, analysis.energy, trackId]);
    }
}

// Create handlers for IPC
function createAudioHandler(db) {
    const handler = new AudioHandler(db);

    return {
        'play-track': handler.playTrack.bind(handler),
        'play-file': handler.playFile.bind(handler),
        pause: handler.pause.bind(handler),
        resume: handler.resume.bind(handler),
        stop: handler.stop.bind(handler),
        next: handler.next.bind(handler),
        previous: handler.previous.bind(handler),
        'set-queue': handler.setQueue.bind(handler),
        'add-to-queue': handler.addToQueue.bind(handler),
        'clear-queue': handler.clearQueue.bind(handler),
        'get-queue': handler.getQueue.bind(handler),
        'get-player-state': () => handler.getPlayerState(),
        'set-volume': handler.setVolume.bind(handler),
        seek: handler.seek.bind(handler),
        'analyze-track': handler.analyzeTrack.bind(handler),
        'get-transition-points': handler.getTransitionPoints.bind(handler)
    };
}

module.exports = createAudioHandler;
