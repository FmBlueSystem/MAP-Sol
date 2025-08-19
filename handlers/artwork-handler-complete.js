// Complete Artwork handler - Returns ALL 143 fields
const fs = require('fs');
const path = require('path');

function createCompleteArtworkHandler(db) {
    return async () => {
        return new Promise(resolve => {
            // SQL query to get ALL fields from both tables
            const sql = `
                SELECT 
                    -- ========== AUDIO_FILES TABLE (89 fields) ==========
                    af.id,
                    af.file_path,
                    af.file_name,
                    af.file_size,
                    af.file_extension,
                    af.date_modified,
                    af.date_added,
                    af.folder_path,
                    af.title,
                    af.artist,
                    af.album,
                    af.genre,
                    af.year,
                    af.mixed_in_key_detected,
                    af.existing_bmp,
                    af.existing_key,
                    af.preservation_source,
                    af.should_preserve,
                    af.analysis_status,
                    af.last_analyzed,
                    af.file_hash,
                    af.bmp,
                    af.isrc,
                    af.artwork_path,
                    af.cached,
                    af.analyzed,
                    af.analysis_version,
                    af.duration,
                    af.bitrate,
                    af.needs_analysis,
                    af.AI_KEY,
                    af.AI_BPM,
                    af.AI_ENERGY,
                    af.AI_DANCEABILITY,
                    af.AI_VALENCE,
                    af.AI_ACOUSTICNESS,
                    af.AI_INSTRUMENTALNESS,
                    af.AI_LIVENESS,
                    af.AI_SPEECHINESS,
                    af.AI_LOUDNESS,
                    af.AI_MODE,
                    af.AI_TIME_SIGNATURE,
                    af.AI_MOOD,
                    af.AI_GENRE,
                    af.AI_SUBGENRES,
                    af.AI_OCCASION,
                    af.AI_ERA,
                    af.AI_CULTURAL_CONTEXT,
                    af.AI_ANALYZED,
                    af.album_artist,
                    af.track_number,
                    af.disc_number,
                    af.comment,
                    af.energy_level,
                    af.beatgrid,
                    af.cuepoints,
                    af.serato_markers,
                    af.lyrics_analyzed,
                    af.lyrics_analyzed_date,
                    af.lyrics_language,
                    af.lyrics_language_secondary,
                    af.lyrics_theme_primary,
                    af.lyrics_theme_secondary,
                    af.lyrics_mood,
                    af.lyrics_perspective,
                    af.lyrics_temporality,
                    af.lyrics_intensity,
                    af.lyrics_complexity,
                    af.lyrics_explicit,
                    af.lyrics_storytelling,
                    af.lyrics_call_to_action,
                    af.lyrics_target_audience,
                    af.lyrics_cultural_context,
                    af.lyrics_use_context,
                    af.lyrics_key_phrases,
                    af.lyrics_emotional_journey,
                    af.lyrics_rhyme_scheme,
                    af.lyrics_vocal_delivery,
                    af.lyrics_confidence,
                    af.lyrics_has_content,
                    af.lyrics_is_instrumental,
                    af.lyrics_vocal_type,
                    af.lyrics_analysis_note,
                    af.genre_correction_applied,
                    af.genre_correction_date,
                    af.genre_correction_type,
                    af.normalization_analyzed,
                    af.updated_at,
                    af.created_at,

                    -- ========== LLM_METADATA TABLE (54 fields) ==========
                    lm.AI_ANALYZED as LLM_AI_ANALYZED,
                    lm.LLM_ANALYZED,
                    lm.AI_ANALYZED_DATE,
                    lm.LLM_ANALYSIS_DATE,
                    lm.AI_BPM as LLM_AI_BPM,
                    lm.AI_ENERGY as LLM_AI_ENERGY,
                    lm.AI_KEY as LLM_AI_KEY,
                    lm.AI_MODE as LLM_AI_MODE,
                    lm.AI_TIME_SIGNATURE as LLM_AI_TIME_SIGNATURE,
                    lm.AI_DANCEABILITY as LLM_AI_DANCEABILITY,
                    lm.AI_VALENCE as LLM_AI_VALENCE,
                    lm.AI_ACOUSTICNESS as LLM_AI_ACOUSTICNESS,
                    lm.AI_INSTRUMENTALNESS as LLM_AI_INSTRUMENTALNESS,
                    lm.AI_LIVENESS as LLM_AI_LIVENESS,
                    lm.AI_SPEECHINESS as LLM_AI_SPEECHINESS,
                    lm.AI_LOUDNESS as LLM_AI_LOUDNESS,
                    lm.AI_MOOD as LLM_AI_MOOD,
                    lm.AI_CONFIDENCE,
                    lm.LLM_GENRE,
                    lm.LLM_SUBGENRES,
                    lm.LLM_ERA,
                    lm.LLM_STYLE_PERIOD,
                    lm.LLM_DESCRIPTION,
                    lm.LLM_CONTEXT,
                    lm.LLM_ENERGY_LEVEL,
                    lm.LLM_OCCASIONS,
                    lm.LLM_LYRICS_ANALYSIS,
                    lm.LLM_LYRICS_THEME,
                    lm.LLM_LYRICS_MOOD,
                    lm.LLM_LYRICS_LANGUAGE,
                    lm.LLM_EXPLICIT_CONTENT,
                    lm.LLM_STORYTELLING,
                    lm.LLM_DJ_NOTES,
                    lm.LLM_MIXING_NOTES,
                    lm.LLM_MIXING_KEYS,
                    lm.LLM_COMPATIBLE_GENRES,
                    lm.LLM_PRODUCTION_STYLE,
                    lm.LLM_INSTRUMENTS,
                    lm.LLM_VOCAL_STYLE,
                    lm.LLM_ENERGY_DESCRIPTION,
                    lm.LLM_SIMILAR_ARTISTS,
                    lm.LLM_RECOMMENDATIONS,
                    lm.LLM_MUSICAL_INFLUENCE,
                    lm.LLM_IS_COMPILATION,
                    lm.LLM_IS_REMIX,
                    lm.LLM_IS_COVER,
                    lm.LLM_IS_LIVE,
                    lm.LLM_CONFIDENCE_SCORE,
                    lm.LLM_VALIDATION_NOTES,
                    lm.LLM_WARNINGS,
                    lm.llm_version,
                    lm.analysis_timestamp,

                    -- Computed/Combined fields
                    COALESCE(af.bmp, af.existing_bmp, lm.AI_BPM, af.AI_BPM) as BPM,
                    COALESCE(lm.AI_MOOD, af.AI_MOOD) as MOOD,
                    COALESCE(lm.LLM_GENRE, af.AI_GENRE, af.genre) as DISPLAY_GENRE

                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                ORDER BY af.artist, af.title
            `;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error fetching complete metadata:', err);
                    resolve([]);
                } else {
                    // Process artwork paths
                    const artworkDir = path.join(__dirname, '..', 'artwork-cache');
                    let withArtwork = 0;
                    let totalFields = 0;

                    rows.forEach(file => {
                        // Count non-null fields
                        const fieldCount = Object.keys(file).filter(
                            key => file[key] !== null && file[key] !== undefined
                        ).length;
                        totalFields = Math.max(totalFields, fieldCount);

                        // Process artwork
                        const artworkPath = path.join(artworkDir, `${file.id}.jpg');
                        const defaultImagePath = path.join(__dirname, '..', 'image.png');

                        if (fs.existsSync(artworkPath)) {
                            file.artwork_url = `artwork-cache/${file.id}.jpg`;
                            file.artwork_path = artworkPath;
                            file.artwork_full = `file://${artworkPath}`;
                            file.has_artwork = true;
                            withArtwork++;
                        } else {
                            if (fs.existsSync(defaultImagePath)) {
                                file.artwork_url = 'image.png';
                                file.artwork_path = defaultImagePath;
                                file.artwork_full = `file://${defaultImagePath}`;
                                file.has_artwork = false;
                            } else {
                                file.artwork_url = null;
                                file.artwork_path = null;
                                file.artwork_full = null;
                                file.has_artwork = false;
                            }
                        }
                    });

                    resolve(rows);
                }
            });
        });
    };
}

module.exports = { createCompleteArtworkHandler };
