-- Create llm_metadata table if it doesn't exist
-- This table stores HAMMS vectors and AI-enhanced metadata

CREATE TABLE IF NOT EXISTS llm_metadata (
    file_id INTEGER PRIMARY KEY,
    
    -- HAMMS 7D Vector Components
    hamms_bpm REAL,
    hamms_energy REAL,
    hamms_danceability REAL,
    hamms_valence REAL,
    hamms_acousticness REAL,
    hamms_instrumentalness REAL,
    hamms_key REAL,
    hamms_calculated_at TIMESTAMP,
    
    -- Mixed In Key Data
    AI_BPM INTEGER,
    AI_KEY TEXT,
    AI_ENERGY REAL,
    
    -- Essentia/Librosa Features
    AI_DANCEABILITY REAL,
    AI_VALENCE REAL,
    AI_ACOUSTICNESS REAL,
    AI_INSTRUMENTALNESS REAL,
    AI_LOUDNESS REAL,
    AI_SPEECHINESS REAL,
    AI_LIVENESS REAL,
    AI_TEMPO_CONFIDENCE REAL,
    essentia_analyzed_at TIMESTAMP,
    
    -- GPT-4 AI Enrichment
    ai_genre TEXT,
    ai_subgenres TEXT, -- JSON array
    ai_mood TEXT,
    ai_era TEXT,
    ai_occasions TEXT, -- JSON array
    ai_description TEXT,
    ai_analyzed_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE
);

-- Create indexes for fast similarity searches
CREATE INDEX IF NOT EXISTS idx_hamms_bpm ON llm_metadata(hamms_bpm);
CREATE INDEX IF NOT EXISTS idx_hamms_energy ON llm_metadata(hamms_energy);
CREATE INDEX IF NOT EXISTS idx_hamms_danceability ON llm_metadata(hamms_danceability);
CREATE INDEX IF NOT EXISTS idx_hamms_valence ON llm_metadata(hamms_valence);
CREATE INDEX IF NOT EXISTS idx_ai_genre ON llm_metadata(ai_genre);
CREATE INDEX IF NOT EXISTS idx_ai_mood ON llm_metadata(ai_mood);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_llm_metadata_timestamp 
AFTER UPDATE ON llm_metadata
BEGIN
    UPDATE llm_metadata SET updated_at = CURRENT_TIMESTAMP WHERE file_id = NEW.file_id;
END;