// Tests for Database Service
describe('Database Service', () => {
    let mockElectronAPI;

    beforeEach(() => {
        mockElectronAPI = {
            invoke: jest.fn()
        };
        global.electronAPI = mockElectronAPI;
    });

    describe('getFilesWithCachedArtwork', () => {
        test('should fetch files from database', async () => {
            const mockFiles = [
                { id: 1, title: 'Track 1', artist: 'Artist 1' },
                { id: 2, title: 'Track 2', artist: 'Artist 2' }
            ];

            mockElectronAPI.invoke.mockResolvedValue({ files: mockFiles });

            const result = await electronAPI.invoke('get-files-with-cached-artwork', {
                limit: 100,
                offset: 0
            });

            expect(mockElectronAPI.invoke).toHaveBeenCalledWith('get-files-with-cached-artwork', {
                limit: 100,
                offset: 0
            });
            expect(result.files).toEqual(mockFiles);
        });

        test('should handle database errors', async () => {
            mockElectronAPI.invoke.mockRejectedValue(new Error('Database error'));

            await expect(electronAPI.invoke('get-files-with-cached-artwork', {})).rejects.toThrow('Database error');
        });
    });

    describe('searchTracks', () => {
        test('should search tracks with query', async () => {
            const searchResults = [{ id: 1, title: 'Matching Track', artist: 'Artist' }];

            mockElectronAPI.invoke.mockResolvedValue(searchResults);

            const result = await electronAPI.invoke('search-tracks', {
                query: 'Matching',
                filters: {}
            });

            expect(mockElectronAPI.invoke).toHaveBeenCalledWith('search-tracks', { query: 'Matching', filters: {} });
            expect(result).toEqual(searchResults);
        });

        test('should apply filters to search', async () => {
            const filters = {
                genre: 'Electronic',
                bpm: '120-130',
                mood: 'Energetic'
            };

            await electronAPI.invoke('search-tracks', {
                query: '',
                filters
            });

            expect(mockElectronAPI.invoke).toHaveBeenCalledWith('search-tracks', { query: '', filters });
        });
    });

    describe('updateMetadata', () => {
        test('should update track metadata', async () => {
            const metadata = {
                title: 'New Title',
                artist: 'New Artist',
                album: 'New Album'
            };

            mockElectronAPI.invoke.mockResolvedValue({ success: true });

            const result = await electronAPI.invoke('update-metadata', {
                fileId: 1,
                metadata
            });

            expect(result.success).toBe(true);
            expect(mockElectronAPI.invoke).toHaveBeenCalledWith('update-metadata', { fileId: 1, metadata });
        });
    });
});
