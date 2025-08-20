// Energy Flow Handler - Backend para visualización de energía
function createEnergyFlowHandlers(db) {
    // Get queue tracks with energy data
    const getQueueTracksHandler = async (event, options = {}) => {
        return new Promise((resolve) => {
            const { playlistId, limit = 50 } = options;
            
            let sql;
            let params = [];
            
            if (playlistId) {
                // Get tracks from specific playlist
                sql = `
                    SELECT 
                        af.id,
                        af.file_path,
                        af.file_name,
                        af.title,
                        af.artist,
                        af.album,
                        af.genre,
                        af.duration,
                        COALESCE(lm.AI_ENERGY, 0.5) as energy,
                        COALESCE(lm.AI_BPM, af.existing_bmp, 120) as bpm,
                        COALESCE(lm.AI_KEY, af.existing_key, '') as key,
                        lm.AI_DANCEABILITY as danceability,
                        lm.AI_VALENCE as valence,
                        af.artwork_path
                    FROM playlist_tracks pt
                    JOIN audio_files af ON pt.track_id = af.id
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    WHERE pt.playlist_id = ?
                    ORDER BY pt.position
                    LIMIT ?
                `;
                params = [playlistId, limit];
            } else {
                // Get recent tracks or sample data
                sql = `
                    SELECT 
                        af.id,
                        af.file_path,
                        af.file_name,
                        af.title,
                        af.artist,
                        af.album,
                        af.genre,
                        af.duration,
                        COALESCE(lm.AI_ENERGY, 0.5) as energy,
                        COALESCE(lm.AI_BPM, af.existing_bmp, 120) as bpm,
                        COALESCE(lm.AI_KEY, af.existing_key, '') as key,
                        lm.AI_DANCEABILITY as danceability,
                        lm.AI_VALENCE as valence,
                        af.artwork_path
                    FROM audio_files af
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    WHERE lm.AI_ENERGY IS NOT NULL
                    ORDER BY RANDOM()
                    LIMIT ?
                `;
                params = [limit];
            }
            
            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error fetching queue tracks:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    // Add artwork URLs
                    rows.forEach(row => {
                        if (row.id) {
                            const artworkPath = `artwork-cache/${row.id}.jpg`;
                            const fs = require('fs');
                            const path = require('path');
                            const fullPath = path.join(__dirname, '..', artworkPath);
                            
                            if (fs.existsSync(fullPath)) {
                                row.artwork_url = artworkPath;
                            } else {
                                row.artwork_url = 'image.png';
                            }
                        }
                        
                        // Ensure energy is a number between 0 and 1
                        if (!row.energy || row.energy < 0) row.energy = 0.5;
                        if (row.energy > 1) row.energy = 1;
                    });
                    
                    resolve({ success: true, tracks: rows });
                }
            });
        });
    };
    
    // Analyze energy flow and provide recommendations
    const analyzeFlowHandler = async (event, tracks) => {
        return new Promise((resolve) => {
            if (!tracks || tracks.length === 0) {
                resolve({ success: false, error: 'No tracks provided' });
                return;
            }
            
            // Calculate energy metrics
            const energies = tracks.map(t => t.energy || 0.5);
            
            // Calculate mean energy
            const meanEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
            
            // Calculate variance
            const variance = energies.reduce((sum, e) => sum + Math.pow(e - meanEnergy, 2), 0) / energies.length;
            
            // Find energy peaks (local maxima above 0.7)
            const peaks = [];
            for (let i = 1; i < energies.length - 1; i++) {
                if (energies[i] > energies[i - 1] && 
                    energies[i] > energies[i + 1] && 
                    energies[i] > 0.7) {
                    peaks.push(i);
                }
            }
            
            // Calculate transition smoothness
            const transitions = [];
            for (let i = 1; i < energies.length; i++) {
                const diff = Math.abs(energies[i] - energies[i - 1]);
                transitions.push({
                    from: i - 1,
                    to: i,
                    difference: diff,
                    quality: diff < 0.15 ? 'smooth' : diff < 0.25 ? 'moderate' : 'harsh'
                });
            }
            
            const smoothTransitions = transitions.filter(t => t.quality === 'smooth').length;
            const harshTransitions = transitions.filter(t => t.quality === 'harsh').length;
            
            // Generate recommendations
            const recommendations = [];
            
            if (variance > 0.15) {
                recommendations.push({
                    type: 'warning',
                    message: 'High energy variance detected',
                    suggestion: 'Consider reordering tracks for smoother energy transitions'
                });
            }
            
            if (harshTransitions > transitions.length * 0.3) {
                recommendations.push({
                    type: 'warning',
                    message: 'Many harsh transitions found',
                    suggestion: 'Add transitional tracks between high and low energy songs'
                });
            }
            
            if (peaks.length === 0) {
                recommendations.push({
                    type: 'info',
                    message: 'No energy peaks detected',
                    suggestion: 'Add some high-energy tracks to create climactic moments'
                });
            } else if (peaks.length > 5) {
                recommendations.push({
                    type: 'warning',
                    message: 'Too many energy peaks',
                    suggestion: 'Space out high-energy tracks for better flow'
                });
            }
            
            // Calculate overall flow score (0-100)
            const flowScore = Math.round(
                ((smoothTransitions / transitions.length) * 40) +  // Smooth transitions weight
                ((1 - Math.min(variance, 0.3) / 0.3) * 30) +      // Low variance weight
                ((Math.min(peaks.length, 3) / 3) * 30)            // Optimal peaks weight
            );
            
            resolve({
                success: true,
                analysis: {
                    meanEnergy,
                    variance,
                    peaks: peaks.length,
                    peakPositions: peaks,
                    smoothTransitions,
                    harshTransitions,
                    totalTransitions: transitions.length,
                    flowScore,
                    recommendations,
                    transitions
                }
            });
        });
    };
    
    // Optimize track order for better energy flow
    const optimizeFlowHandler = async (event, tracks) => {
        return new Promise((resolve) => {
            if (!tracks || tracks.length === 0) {
                resolve({ success: false, error: 'No tracks provided' });
                return;
            }
            
            // Clone tracks array
            const optimized = [...tracks];
            
            // Sort by creating an energy wave pattern
            // Start low, build up to peak in middle, then come down
            const midPoint = Math.floor(optimized.length / 2);
            
            // Sort tracks by energy
            const sortedByEnergy = [...optimized].sort((a, b) => 
                (a.energy || 0.5) - (b.energy || 0.5)
            );
            
            // Create wave pattern
            const wavePattern = [];
            let lowIndex = 0;
            let highIndex = sortedByEnergy.length - 1;
            
            // Build up phase (first third)
            const buildUpEnd = Math.floor(optimized.length / 3);
            for (let i = 0; i < buildUpEnd; i++) {
                const progress = i / buildUpEnd;
                const targetEnergy = 0.3 + (progress * 0.4); // 0.3 to 0.7
                
                // Find track closest to target energy
                const track = sortedByEnergy.find(t => 
                    Math.abs((t.energy || 0.5) - targetEnergy) < 0.15
                ) || sortedByEnergy[lowIndex++];
                
                wavePattern.push(track);
                sortedByEnergy.splice(sortedByEnergy.indexOf(track), 1);
            }
            
            // Peak phase (middle third)
            const peakEnd = Math.floor(optimized.length * 2 / 3);
            for (let i = buildUpEnd; i < peakEnd; i++) {
                if (sortedByEnergy.length > 0) {
                    // Use high energy tracks
                    const track = sortedByEnergy.pop();
                    wavePattern.push(track);
                }
            }
            
            // Cool down phase (last third)
            while (sortedByEnergy.length > 0) {
                const track = sortedByEnergy.shift();
                wavePattern.push(track);
            }
            
            resolve({
                success: true,
                optimizedTracks: wavePattern,
                message: 'Tracks reordered for optimal energy flow'
            });
        });
    };
    
    return {
        getQueueTracksHandler,
        analyzeFlowHandler,
        optimizeFlowHandler
    };
}

module.exports = {
    createEnergyFlowHandlers
};