-- Sistema de Playlists Profesional para MAP
-- Basado en las mejores características de Rekordbox, Serato, Traktor y VirtualDJ

-- 1. Tabla principal de playlists
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'manual', -- 'manual', 'smart', 'folder', 'history', 'preparation'
    parent_id INTEGER, -- Para playlists jerárquicas (carpetas)
    icon TEXT, -- Emoji o icono personalizado
    color TEXT, -- Color hex para identificación visual
    is_public BOOLEAN DEFAULT 0,
    is_locked BOOLEAN DEFAULT 0, -- Prevenir cambios accidentales
    sort_order INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- 2. Tracks en playlists
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL, -- Orden en la playlist
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    played_at TIMESTAMP, -- Última vez reproducido en esta playlist
    play_count INTEGER DEFAULT 0,
    rating INTEGER, -- Rating específico para esta playlist
    notes TEXT, -- Notas del DJ para este track en esta playlist
    cue_in REAL, -- Punto de entrada personalizado
    cue_out REAL, -- Punto de salida personalizado
    gain_adjustment REAL DEFAULT 0, -- Ajuste de ganancia específico
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id, position)
);

-- 3. Smart Playlists (Listas inteligentes con filtros dinámicos)
CREATE TABLE IF NOT EXISTS smart_playlist_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    field TEXT NOT NULL, -- 'genre', 'bpm', 'key', 'energy', 'year', 'added_date', etc.
    operator TEXT NOT NULL, -- 'equals', 'contains', 'greater_than', 'less_than', 'between', 'not'
    value TEXT NOT NULL,
    value2 TEXT, -- Para operador 'between'
    logic_operator TEXT DEFAULT 'AND', -- 'AND' o 'OR' con la siguiente regla
    rule_order INTEGER DEFAULT 0,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- 4. Tags personalizados (como My Tag de Rekordbox)
CREATE TABLE IF NOT EXISTS custom_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    category TEXT, -- 'mood', 'venue', 'style', 'custom'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Relación tracks-tags
CREATE TABLE IF NOT EXISTS track_tags (
    track_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id, tag_id),
    FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES custom_tags(id) ON DELETE CASCADE
);

-- 6. Historial de reproducción (para análisis y recomendaciones)
CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    playlist_id INTEGER,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_played REAL, -- Segundos reproducidos
    completed BOOLEAN DEFAULT 0, -- Si se reprodujo completa
    transition_rating INTEGER, -- Calidad de la transición (1-5)
    crowd_rating INTEGER, -- Respuesta del público (1-5)
    notes TEXT,
    previous_track_id INTEGER, -- Track anterior (para análisis de transiciones)
    next_track_id INTEGER, -- Track siguiente
    session_id TEXT, -- Para agrupar sets
    FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (previous_track_id) REFERENCES audio_files(id) ON DELETE SET NULL,
    FOREIGN KEY (next_track_id) REFERENCES audio_files(id) ON DELETE SET NULL
);

-- 7. Análisis armónico y compatibilidad (Camelot Wheel)
CREATE TABLE IF NOT EXISTS harmonic_analysis (
    track_id INTEGER PRIMARY KEY,
    camelot_key TEXT, -- '1A', '1B', '2A', etc.
    open_key TEXT, -- Notación Open Key
    musical_key TEXT, -- 'C major', 'A minor', etc.
    key_confidence REAL, -- 0.0 a 1.0
    compatible_keys TEXT, -- JSON array de keys compatibles
    energy_level INTEGER, -- 1-10
    mood_category TEXT, -- 'dark', 'euphoric', 'melancholic', etc.
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE
);

-- 8. Preparación de sets (como Preparation list de Rekordbox)
CREATE TABLE IF NOT EXISTS set_preparations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_date DATE,
    venue TEXT,
    duration_minutes INTEGER,
    target_energy_curve TEXT, -- JSON con curva de energía deseada
    notes TEXT,
    is_template BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tracks en preparación de set
CREATE TABLE IF NOT EXISTS set_preparation_tracks (
    preparation_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER,
    segment TEXT, -- 'opening', 'warmup', 'peak', 'cooldown', 'closing'
    notes TEXT,
    is_must_play BOOLEAN DEFAULT 0,
    FOREIGN KEY (preparation_id) REFERENCES set_preparations(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_playlist_type ON playlists(type);
CREATE INDEX IF NOT EXISTS idx_playlist_parent ON playlists(parent_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_track_tags_track ON track_tags(track_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag ON track_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_play_history_date ON play_history(played_at);
CREATE INDEX IF NOT EXISTS idx_play_history_session ON play_history(session_id);
CREATE INDEX IF NOT EXISTS idx_harmonic_camelot ON harmonic_analysis(camelot_key);
CREATE INDEX IF NOT EXISTS idx_smart_rules_playlist ON smart_playlist_rules(playlist_id);

-- Vistas útiles
CREATE VIEW IF NOT EXISTS v_playlist_summary AS
SELECT 
    p.id,
    p.name,
    p.type,
    p.color,
    COUNT(pt.track_id) as track_count,
    SUM(CASE WHEN pt.played_at IS NOT NULL THEN 1 ELSE 0 END) as played_count,
    MAX(pt.played_at) as last_played_track,
    p.created_at,
    p.updated_at
FROM playlists p
LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
GROUP BY p.id;

-- Vista para tracks relacionados (para recomendaciones)
CREATE VIEW IF NOT EXISTS v_related_tracks AS
SELECT 
    a.track_id as source_track,
    b.track_id as related_track,
    COUNT(*) as play_together_count,
    AVG(b.transition_rating) as avg_transition_rating
FROM play_history a
JOIN play_history b ON a.next_track_id = b.track_id 
    OR (a.session_id = b.session_id AND ABS(julianday(a.played_at) - julianday(b.played_at)) < 0.05)
WHERE a.track_id != b.track_id
GROUP BY a.track_id, b.track_id
HAVING COUNT(*) > 2;

-- Triggers para actualizar timestamps
CREATE TRIGGER IF NOT EXISTS update_playlist_timestamp 
AFTER UPDATE ON playlists
BEGIN
    UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_preparation_timestamp 
AFTER UPDATE ON set_preparations
BEGIN
    UPDATE set_preparations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;