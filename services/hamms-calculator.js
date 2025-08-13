// TASK_025: Sistema HAMMS de similitud musical 7D
class HAMMSCalculator {
    constructor() {
        // Pesos para cada dimensión (ajustables)
        this.weights = {
            bpm: 1.0,
            energy: 1.2,
            danceability: 0.9,
            valence: 0.8,
            acousticness: 0.7,
            instrumentalness: 0.6,
            key: 1.1
        };
    }
    
    // Normalizar BPM a escala 0-1
    normalizeBPM(bpm) {
        const min = 60, max = 200;
        return Math.max(0, Math.min(1, (bpm - min) / (max - min)));
    }
    
    // Convertir key musical a número
    keyToNumber(key) {
        const keyMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        if (!key) return 0.5;
        
        // Extraer nota principal (ignorar mayor/menor por ahora)
        const note = key.replace(/m|maj|min|Major|Minor/gi, '').trim();
        return (keyMap[note] || 0) / 11; // Normalizar a 0-1
    }
    
    // Calcular vector HAMMS de 7 dimensiones
    calculateVector(track) {
        return {
            bpm: this.normalizeBPM(track.AI_BPM || track.existing_bmp || 120),
            energy: parseFloat(track.AI_ENERGY) || 0.5,
            danceability: parseFloat(track.AI_DANCEABILITY) || 0.5,
            valence: parseFloat(track.AI_VALENCE) || 0.5,
            acousticness: parseFloat(track.AI_ACOUSTICNESS) || 0.5,
            instrumentalness: parseFloat(track.AI_INSTRUMENTALNESS) || 0.5,
            key: this.keyToNumber(track.AI_KEY || track.key)
        };
    }
    
    // Calcular similitud entre dos vectores (0-1, 1 = idéntico)
    calculateSimilarity(vector1, vector2) {
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let dim in vector1) {
            const weight = this.weights[dim] || 1.0;
            const diff = Math.abs(vector1[dim] - vector2[dim]);
            weightedSum += weight * (1 - diff); // Invertir para que 1 = similar
            totalWeight += weight;
        }
        
        return weightedSum / totalWeight;
    }
    
    // Encontrar tracks similares
    findSimilar(targetTrack, allTracks, limit = 20) {
        const targetVector = this.calculateVector(targetTrack);
        const targetId = targetTrack.id;
        
        const similarities = allTracks
            .filter(track => track.id !== targetId) // Excluir el mismo track
            .map(track => ({
                track,
                vector: this.calculateVector(track),
                similarity: 0
            }));
        
        // Calcular similitudes
        similarities.forEach(item => {
            item.similarity = this.calculateSimilarity(targetVector, item.vector);
        });
        
        // Ordenar por similitud y retornar top N
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(item => ({
                track: item.track,
                similarity: Math.round(item.similarity * 100) // Porcentaje
            }));
    }
    
    // Calcular y cachear todos los vectores (para performance)
    precalculateVectors(tracks) {
        const vectors = new Map();
        
        tracks.forEach(track => {
            vectors.set(track.id, this.calculateVector(track));
        });
        
        return vectors;
    }
    
    // Buscar similares usando vectores pre-calculados
    findSimilarFast(targetId, vectorCache, limit = 20) {
        const targetVector = vectorCache.get(targetId);
        if (!targetVector) return [];
        
        const similarities = [];
        
        vectorCache.forEach((vector, id) => {
            if (id !== targetId) {
                similarities.push({
                    id,
                    similarity: this.calculateSimilarity(targetVector, vector)
                });
            }
        });
        
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
}

module.exports = { HAMMSCalculator };