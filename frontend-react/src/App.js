import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
    const [tracks, setTracks] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTracks();
    }, []);

    const loadTracks = async () => {
        try {
            console.log('🔄 Loading tracks...');
            console.log('🔍 window.electronAPI exists?', !!window.electronAPI);

            // Para desarrollo sin Electron, usar datos de prueba
            if (!window.electronAPI || !window.electronAPI.getTracks) {
                console.log('📊 Using test data (no Electron API)');
                setTracks([
                    { id: 3811, title: 'Body Work', AI_BPM: 128, AI_KEY: '8A', AI_ENERGY: 0.85, AI_MOOD: 'Energetic' },
                    {
                        id: 3812,
                        title: 'Savage Lover',
                        AI_BPM: 140,
                        AI_KEY: '11A',
                        AI_ENERGY: 0.92,
                        AI_MOOD: 'Intense',
                    },
                    {
                        id: 3813,
                        title: 'Dance (Disco Heat)',
                        AI_BPM: 95,
                        AI_KEY: '2B',
                        AI_ENERGY: 0.45,
                        AI_MOOD: 'Chill',
                    },
                    {
                        id: 3814,
                        title: 'Turn The Music Up!',
                        AI_BPM: 168,
                        AI_KEY: '12A',
                        AI_ENERGY: 0.72,
                        AI_MOOD: 'Intense',
                    },
                ]);
                setLoading(false);
                return;
            }

            // Obtener datos reales
            console.log('📡 Calling electronAPI.getTracks()...');
            const result = await window.electronAPI.getTracks();
            console.log('✅ Raw data received:', result);

            const trackList = result.files || result || [];
            console.log(`📊 Total tracks received: ${trackList.length}`);

            // Log first track with metadata
            if (trackList.length > 0) {
                const firstTrack = trackList[0];
                console.log('🎵 First track data:', {
                    id: firstTrack.id,
                    title: firstTrack.title,
                    AI_BPM: firstTrack.AI_BPM,
                    AI_KEY: firstTrack.AI_KEY,
                    AI_ENERGY: firstTrack.AI_ENERGY,
                    bpm: firstTrack.bpm,
                    key: firstTrack.key,
                    energy: firstTrack.energy,
                });
            }

            // Solo tracks con metadata
            const withData = trackList.filter((t) => t.AI_BPM || t.bpm);
            console.log(`🎵 ${withData.length} tracks with metadata out of ${trackList.length} total`);

            // Find track 3814 specifically
            const track3814 = withData.find((t) => t.id === 3814);
            if (track3814) {
                console.log('🎯 TRACK 3814 FOUND IN REACT:', {
                    BPM: track3814.AI_BPM || track3814.bpm,
                    Key: track3814.AI_KEY || track3814.key,
                    Energy: track3814.AI_ENERGY || track3814.energy,
                    Mood: track3814.AI_MOOD || track3814.mood,
                });
            }

            setTracks(withData);
            setLoading(false);
        } catch (err) {
            console.error('❌ Error loading tracks:', err);
            console.error('Stack:', err.stack);
            setLoading(false);
        }
    };

    const getBPM = (track) => track?.AI_BPM || track?.bpm || '--';
    const getKey = (track) => track?.AI_KEY || track?.key || '--';
    const getEnergy = (track) => {
        const val = track?.AI_ENERGY || track?.energy;
        return val ? `${Math.round(val * 100)}%` : '--';
    };
    const getMood = (track) => track?.AI_MOOD || track?.mood || '--';

    if (loading) return <div>⏳ Loading...</div>;

    return (
        <div className="app">
            <h1>🎵 Music Analyzer - React</h1>

            {currentTrack && (
                <div style={{ background: '#333', padding: '20px', margin: '20px', borderRadius: '10px' }}>
                    <h2>NOW PLAYING: {currentTrack.title}</h2>
                    <div style={{ fontSize: '20px', color: '#00ff88' }}>
                        <div>BPM: {getBPM(currentTrack)}</div>
                        <div>KEY: {getKey(currentTrack)}</div>
                        <div>ENERGY: {getEnergy(currentTrack)}</div>
                        <div>MOOD: {getMood(currentTrack)}</div>
                    </div>
                </div>
            )}

            <div>
                <h2>Tracks ({tracks.length})</h2>
                {tracks.map((track) => (
                    <div
                        key={track.id}
                        onClick={() => setCurrentTrack(track)}
                        style={{
                            padding: '10px',
                            margin: '5px',
                            background: '#222',
                            cursor: 'pointer',
                            borderRadius: '5px',
                        }}
                    >
                        <div>{track.title}</div>
                        <small>
                            BPM: {getBPM(track)} | Key: {getKey(track)} | Energy: {getEnergy(track)}
                        </small>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default App;
