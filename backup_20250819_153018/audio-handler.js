// Audio Handler for Electron Main Process
// Manages audio playback through IPC

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
    }

    // Create handler functions for IPC
    createHandlers() {
        return {
            // Playback Control
            'play-track': async (event, trackId) => {
                return this.playTrack(event, trackId);
            },

            'play-file': async (event, filePath) => {
                return this.playFile(event, filePath);
            },

            pause: async event => {
                return this.pause(event);
            },

            resume: async event => {
                return this.resume(event);
            },

            stop: async event => {
                return this.stop(event);
            },

            next: async event => {
                return this.playNext(event);
            },

            previous: async event => {
                return this.playPrevious(event);
            },

            // Queue Management
            'set-queue': async (event, tracks) => {
                return this.setQueue(event, tracks);
            },

            'add-to-queue': async (event, track) => {
                return this.addToQueue(event, track);
            },

            'clear-queue': async event => {
                return this.clearQueue(event);
            },

            'get-queue': async event => {
                return this.getQueue();
            },

            // Player State
            'get-player-state': async event => {
                return this.getPlayerState();
            },

            'set-volume': async (event, volume) => {
                return this.setVolume(event, volume);
            },

            seek: async (event, position) => {
                return this.seek(event, position);
            },

            // Track Analysis for Transition AI
            'analyze-track': async (event, trackId) => {
                return this.analyzeTrack(trackId);
            },

            'get-transition-points': async (event, trackId) => {
                return this.getTransitionPoints(trackId);
            }
        };
    }

    // Play track by ID
    async playTrack(event, trackId) {
        try {
            // Get track from database
            const track = await this.getTrackById(trackId);
            if (!track) {
                throw new Error('Track not found');
            }

            // Check if file exists
            if (!fs.existsSync(track.file_path)) {
                throw new Error('Audio file not found: ' + track.file_path);
            }

            this.currentTrack = track;
            this.isPlaying = true;

            // Send track info to renderer
            event.sender.send('track-loaded', {
                track: track,
                filePath: track.file_path,
                metadata: {
                    title: track.title || track.file_name,
                    artist: track.artist,
                    album: track.album,
                    duration: track.duration,
                    artwork: track.artwork_path
                }
            });

            // Send play command to renderer
            event.sender.send('play-audio', {
                filePath: track.file_path,
                trackId: trackId
            });

            // Record in history
            this.recordPlayHistory(trackId);

            return { success: true, track: track };
        } catch (error) {
            console.error('Error playing track:', error);
            return { success: false, error: error.message };
        }
    }

    // Play audio file directly
    async playFile(event, filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found: ' + filePath);
            }

            this.isPlaying = true;

            event.sender.send('play-audio-file', {
                filePath: filePath
            });

            return { success: true, filePath: filePath };
        } catch (error) {
            console.error('Error playing file:', error);
            return { success: false, error: error.message };
        }
    }

    // Pause playback
    pause(event) {
        this.isPlaying = false;
        event.sender.send('pause-audio');
        return { success: true };
    }

    // Resume playback
    resume(event) {
        this.isPlaying = true;
        event.sender.send('resume-audio');
        return { success: true };
    }

    // Stop playback
    stop(event) {
        this.isPlaying = false;
        this.currentTrack = null;
        event.sender.send('stop-audio');
        return { success: true };
    }

    // Play next track in queue
    async playNext(event) {
        if (this.queue.length === 0) {
            return { success: false, error: 'Queue is empty' };
        }

        this.queueIndex++;

        // Loop back to start if at end
        if (this.queueIndex >= this.queue.length) {
            this.queueIndex = 0;
        }

        const nextTrack = this.queue[this.queueIndex];
        return await this.playTrack(event, nextTrack.id);
    }

    // Play previous track
    async playPrevious(event) {
        if (this.queue.length === 0) {
            return { success: false, error: 'Queue is empty' };
        }

        this.queueIndex--;

        // Loop to end if at beginning
        if (this.queueIndex < 0) {
            this.queueIndex = this.queue.length - 1;
        }

        const prevTrack = this.queue[this.queueIndex];
        return await this.playTrack(event, prevTrack.id);
    }

    // Queue Management
    setQueue(event, tracks) {
        this.queue = tracks;
        this.queueIndex = -1;

        // Broadcast queue update
        this.broadcastQueueUpdate(event);

        return { success: true, queue: this.queue };
    }

    addToQueue(event, track) {
        this.queue.push(track);

        // Broadcast queue update
        this.broadcastQueueUpdate(event);

        return { success: true, queue: this.queue };
    }

    clearQueue(event) {
        this.queue = [];
        this.queueIndex = -1;

        // Broadcast queue update
        this.broadcastQueueUpdate(event);

        return { success: true };
    }

    getQueue() {
        return {
            queue: this.queue,
            currentIndex: this.queueIndex,
            currentTrack: this.currentTrack
        };
    }

    // Player State
    getPlayerState() {
        return {
            isPlaying: this.isPlaying,
            currentTrack: this.currentTrack,
            queue: this.queue,
            queueIndex: this.queueIndex,
            volume: this.volume || 0.7
        };
    }

    setVolume(event, volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        event.sender.send('set-volume', this.volume);
        return { success: true, volume: this.volume };
    }

    seek(event, position) {
        event.sender.send('seek-audio', position);
        return { success: true, position: position };
    }

    // Track Analysis for Transition AI
    async analyzeTrack(trackId) {
        try {
            const track = await this.getTrackById(trackId);
            if (!track) {
                throw new Error('Track not found');
            }

            // Get audio analysis data
            const analysis = {
                bpm: track.AI_BPM || track.existing_bmp || 120,
                key: track.AI_KEY || 'Unknown',
                energy: parseFloat(track.AI_ENERGY) || 0.5,
                danceability: parseFloat(track.AI_DANCEABILITY) || 0.5,
                valence: parseFloat(track.AI_VALENCE) || 0.5,
                loudness: parseFloat(track.AI_LOUDNESS) || -14,
                duration: track.duration || 0,

                // Structure detection (placeholder - would need real analysis)
                structure: {
                    intro: { start: 0, end: 16 }, // bars
                    verse1: { start: 16, end: 48 },
                    chorus1: { start: 48, end: 80 },
                    breakdown: { start: 80, end: 112 },
                    drop: { start: 112, end: 144 },
                    outro: { start: 144, end: 160 }
                },

                // Beat grid
                beatGrid: {
                    firstBeat: 0.5, // seconds
                    bpm: track.AI_BPM || 120,
                    confidence: track.AI_TEMPO_CONFIDENCE || 0.8
                }
            };

            return { success: true, analysis: analysis };
        } catch (error) {
            console.error('Error analyzing track:', error);
            return { success: false, error: error.message };
        }
    }

    // Get transition points for mixing
    async getTransitionPoints(trackId) {
        try {
            const analysis = await this.analyzeTrack(trackId);
            if (!analysis.success) {
                throw new Error('Could not analyze track');
            }

            const bpm = analysis.analysis.bpm;
            const barDuration = (60 / bpm) * 4; // Duration of one bar in seconds

            // Calculate ideal transition points
            const transitionPoints = {
                // Mix-in points (where to start mixing this track)
                mixIn: [
                    {
                        name: 'Intro Start',
                        position: 0,
                        type: 'intro',
                        energy: 'low',
                        recommendation: 'Good for long blends'
                    },
                    {
                        name: 'Intro End',
                        position: 16 * barDuration,
                        type: 'intro_end',
                        energy: 'medium',
                        recommendation: 'Standard mix-in point'
                    },
                    {
                        name: 'First Drop',
                        position: 112 * barDuration,
                        type: 'drop',
                        energy: 'high',
                        recommendation: 'For quick cuts and energy boosts'
                    }
                ],

                // Mix-out points (where to start mixing out of this track)
                mixOut: [
                    {
                        name: 'Breakdown Start',
                        position: 80 * barDuration,
                        type: 'breakdown',
                        energy: 'medium',
                        recommendation: 'Good for smooth transitions'
                    },
                    {
                        name: 'Outro Start',
                        position: 144 * barDuration,
                        type: 'outro',
                        energy: 'low',
                        recommendation: 'Standard mix-out point'
                    }
                ],

                // Loop points
                loops: [
                    {
                        name: '4-bar loop',
                        start: 48 * barDuration,
                        length: 4 * barDuration,
                        type: 'chorus'
                    },
                    {
                        name: '8-bar loop',
                        start: 112 * barDuration,
                        length: 8 * barDuration,
                        type: 'drop'
                    }
                ],

                // Cue points
                cues: [
                    { name: 'Cue 1', position: 0, color: '#FF0000' },
                    { name: 'Cue 2', position: 16 * barDuration, color: '#00FF00' },
                    { name: 'Cue 3', position: 48 * barDuration, color: '#0000FF' },
                    { name: 'Cue 4', position: 112 * barDuration, color: '#FFFF00' }
                ]
            };

            return { success: true, transitionPoints: transitionPoints };
        } catch (error) {
            console.error('Error getting transition points:', error);
            return { success: false, error: error.message };
        }
    }

    // Database helpers
    getTrackById(trackId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    af.*,
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            this.db.get(query, [trackId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    recordPlayHistory(trackId) {
        const query = `
            INSERT INTO play_history (track_id, played_at, context)
            VALUES (?, datetime('now'), 'manual')
        ';

        this.db.run(query, [trackId], err => {
            if (err) {
                console.error('Error recording play history:', err);
            }
        });
    }

    // Broadcast queue updates to all windows
    broadcastQueueUpdate(event) {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('queue-updated', {
                queue: this.queue,
                currentIndex: this.queueIndex
            });
        });
    }
}

function createAudioHandler(db) {
    const handler = new AudioHandler(db);
    return handler.createHandlers();
}

module.exports = { createAudioHandler };
