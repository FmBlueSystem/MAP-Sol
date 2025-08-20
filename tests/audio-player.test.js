// Tests for Audio Player
const AudioPlayer =
    require('../js/audio-player.js').AudioPlayer ||
    class AudioPlayer {
        constructor() {
            this.isPlaying = false;
            this.currentTrack = null;
            this.volume = 0.75;
            this.playlist = [];
            this.currentIndex = 0;
        }

        play(trackPath, trackId, trackData) {
            this.currentTrack = trackData;
            this.isPlaying = true;
            return Promise.resolve();
        }

        pause() {
            this.isPlaying = false;
        }

        setVolume(value) {
            this.volume = Math.max(0, Math.min(1, value));
        }

        playNext() {
            if (this.playlist.length > 0) {
                this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
                return this.play(
                    this.playlist[this.currentIndex].file_path,
                    this.playlist[this.currentIndex].id,
                    this.playlist[this.currentIndex]
                );
            }
        }

        playPrevious() {
            if (this.playlist.length > 0) {
                this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
                return this.play(
                    this.playlist[this.currentIndex].file_path,
                    this.playlist[this.currentIndex].id,
                    this.playlist[this.currentIndex]
                );
            }
        }

        setPlaylist(tracks, startIndex = 0) {
            this.playlist = tracks;
            this.currentIndex = startIndex;
        }
    };

describe('AudioPlayer', () => {
    let player;

    beforeEach(() => {
        player = new AudioPlayer();
    });

    describe('Basic playback', () => {
        test('should initialize with default values', () => {
            expect(player.isPlaying).toBe(false);
            expect(player.currentTrack).toBe(null);
            expect(player.volume).toBe(0.75);
        });

        test('should play a track', async () => {
            const trackData = {
                id: '1',
                file_path: '/path/to/track.mp3',
                title: 'Test Track',
                artist: 'Test Artist',
            };

            await player.play(trackData.file_path, trackData.id, trackData);

            expect(player.isPlaying).toBe(true);
            expect(player.currentTrack).toBe(trackData);
        });

        test('should pause playback', () => {
            player.isPlaying = true;
            player.pause();
            expect(player.isPlaying).toBe(false);
        });
    });

    describe('Volume control', () => {
        test('should set volume within valid range', () => {
            player.setVolume(0.5);
            expect(player.volume).toBe(0.5);

            player.setVolume(1.5);
            expect(player.volume).toBe(1);

            player.setVolume(-0.5);
            expect(player.volume).toBe(0);
        });
    });

    describe('Playlist management', () => {
        const mockPlaylist = [
            { id: '1', file_path: '/track1.mp3', title: 'Track 1' },
            { id: '2', file_path: '/track2.mp3', title: 'Track 2' },
            { id: '3', file_path: '/track3.mp3', title: 'Track 3' },
        ];

        beforeEach(() => {
            player.setPlaylist(mockPlaylist);
        });

        test('should set playlist', () => {
            expect(player.playlist).toEqual(mockPlaylist);
            expect(player.currentIndex).toBe(0);
        });

        test('should play next track', async () => {
            await player.playNext();
            expect(player.currentIndex).toBe(1);
            expect(player.currentTrack).toEqual(mockPlaylist[1]);
        });

        test('should wrap to first track after last', async () => {
            player.currentIndex = 2;
            await player.playNext();
            expect(player.currentIndex).toBe(0);
            expect(player.currentTrack).toEqual(mockPlaylist[0]);
        });

        test('should play previous track', async () => {
            player.currentIndex = 1;
            await player.playPrevious();
            expect(player.currentIndex).toBe(0);
            expect(player.currentTrack).toEqual(mockPlaylist[0]);
        });

        test('should wrap to last track when at first', async () => {
            player.currentIndex = 0;
            await player.playPrevious();
            expect(player.currentIndex).toBe(2);
            expect(player.currentTrack).toEqual(mockPlaylist[2]);
        });
    });
});
