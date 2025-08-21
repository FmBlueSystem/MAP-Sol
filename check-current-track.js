// Script para verificar qué track está sonando y sus datos
console.log('🔍 Verificando track actual...');

// Si SimplePlayer existe
if (window.simplePlayer && window.simplePlayer.currentTrack) {
    const track = window.simplePlayer.currentTrack;
    console.log('📀 Track actual:', {
        id: track.id,
        title: track.title,
        artist: track.artist,
        // Todos los posibles campos de metadata
        AI_BPM: track.AI_BPM,
        AI_KEY: track.AI_KEY,
        AI_ENERGY: track.AI_ENERGY,
        AI_MOOD: track.AI_MOOD,
        bpm: track.bpm,
        key: track.key,
        energy: track.energy,
        mood: track.mood,
        BPM: track.BPM,
    });

    // Ver qué está mostrando en el DOM
    console.log('🖥️ Valores en pantalla:', {
        bpm: document.getElementById('player-bpm')?.textContent,
        key: document.getElementById('player-key')?.textContent,
        energy: document.getElementById('player-energy')?.textContent,
        mood: document.getElementById('player-mood')?.textContent,
    });
} else {
    console.log('❌ No hay track reproduciendo');
}

// Revisar los datos cargados
if (window.audioFiles && window.audioFiles.length > 0) {
    const track3814 = window.audioFiles.find((t) => t.id === 3814);
    if (track3814) {
        console.log('📊 Track 3814 en memoria:', {
            id: track3814.id,
            title: track3814.title,
            bpm: track3814.bpm,
            key: track3814.key,
            energy: track3814.energy,
            mood: track3814.mood,
        });
    }
}
