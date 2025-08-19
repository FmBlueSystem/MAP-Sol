// Complete Metadata Handler - Handles ALL 143 fields from both tables
const createCompleteMetadataHandler = db => {
    return async (event, updates) => {
        try {
            if (!updates || !updates.id) {
                throw new Error('Invalid track ID');
            }

            const trackId = updates.id;

            // ========== AUDIO_FILES TABLE FIELDS (89 fields) ==========
            const audioFields = {
                // Basic Info
                title: updates.title,
                artist: updates.artist,
                album: updates.album,
                album_artist: updates.album_artist,
                genre: updates.genre,
                year: updates.year,
                track_number: updates.track_number,
                disc_number: updates.disc_number,
                comment: updates.comment,
                isrc: updates.isrc,

                // Technical
                bmp: updates.bmp,
                duration: updates.duration,
                bitrate: updates.bitrate,
                file_extension: updates.file_extension,
                file_size: updates.file_size,
                file_path: updates.file_path,
                file_name: updates.file_name,
                folder_path: updates.folder_path,
                file_hash: updates.file_hash,
                artwork_path: updates.artwork_path,

                // MixedInKey
                existing_bmp: updates.existing_bmp,
                existing_key: updates.existing_key,
                energy_level: updates.energy_level,
                mixed_in_key_detected: updates.mixed_in_key_detected,
                preservation_source: updates.preservation_source,
                should_preserve: updates.should_preserve,
                beatgrid: updates.beatgrid,
                cuepoints: updates.cuepoints,
                serato_markers: updates.serato_markers,

                // AI Fields in audio_files
                AI_KEY: updates.AI_KEY,
                AI_BPM: updates.AI_BPM,
                AI_ENERGY: updates.AI_ENERGY,
                AI_DANCEABILITY: updates.AI_DANCEABILITY,
                AI_VALENCE: updates.AI_VALENCE,
                AI_ACOUSTICNESS: updates.AI_ACOUSTICNESS,
                AI_INSTRUMENTALNESS: updates.AI_INSTRUMENTALNESS,
                AI_LIVENESS: updates.AI_LIVENESS,
                AI_SPEECHINESS: updates.AI_SPEECHINESS,
                AI_LOUDNESS: updates.AI_LOUDNESS,
                AI_MODE: updates.AI_MODE,
                AI_TIME_SIGNATURE: updates.AI_TIME_SIGNATURE,
                AI_MOOD: updates.AI_MOOD,
                AI_GENRE: updates.AI_GENRE,
                AI_SUBGENRES: updates.AI_SUBGENRES,
                AI_OCCASION: updates.AI_OCCASION,
                AI_ERA: updates.AI_ERA,
                AI_CULTURAL_CONTEXT: updates.AI_CULTURAL_CONTEXT,
                AI_ANALYZED: updates.AI_ANALYZED,

                // Lyrics fields in audio_files
                lyrics_analyzed: updates.lyrics_analyzed,
                lyrics_analyzed_date: updates.lyrics_analyzed_date,
                lyrics_language: updates.lyrics_language,
                lyrics_language_secondary: updates.lyrics_language_secondary,
                lyrics_theme_primary: updates.lyrics_theme_primary,
                lyrics_theme_secondary: updates.lyrics_theme_secondary,
                lyrics_mood: updates.lyrics_mood,
                lyrics_perspective: updates.lyrics_perspective,
                lyrics_temporality: updates.lyrics_temporality,
                lyrics_intensity: updates.lyrics_intensity,
                lyrics_complexity: updates.lyrics_complexity,
                lyrics_explicit: updates.lyrics_explicit,
                lyrics_storytelling: updates.lyrics_storytelling,
                lyrics_call_to_action: updates.lyrics_call_to_action,
                lyrics_target_audience: updates.lyrics_target_audience,
                lyrics_cultural_context: updates.lyrics_cultural_context,
                lyrics_use_context: updates.lyrics_use_context,
                lyrics_key_phrases: updates.lyrics_key_phrases,
                lyrics_emotional_journey: updates.lyrics_emotional_journey,
                lyrics_rhyme_scheme: updates.lyrics_rhyme_scheme,
                lyrics_vocal_delivery: updates.lyrics_vocal_delivery,
                lyrics_vocal_type: updates.lyrics_vocal_type,
                lyrics_confidence: updates.lyrics_confidence,
                lyrics_has_content: updates.lyrics_has_content,
                lyrics_is_instrumental: updates.lyrics_is_instrumental,
                lyrics_analysis_note: updates.lyrics_analysis_note,

                // System fields
                analysis_status: updates.analysis_status,
                last_analyzed: updates.last_analyzed,
                analysis_version: updates.analysis_version,
                analyzed: updates.analyzed,
                needs_analysis: updates.needs_analysis,
                cached: updates.cached,
                date_modified: updates.date_modified,
                date_added: updates.date_added,
                genre_correction_applied: updates.genre_correction_applied,
                genre_correction_date: updates.genre_correction_date,
                genre_correction_type: updates.genre_correction_type,
                normalization_analyzed: updates.normalization_analyzed
            };

            // ========== LLM_METADATA TABLE FIELDS (54 fields) ==========
            const llmFields = {
                AI_ANALYZED: updates.AI_ANALYZED,
                LLM_ANALYZED: updates.LLM_ANALYZED,
                AI_ANALYZED_DATE: updates.AI_ANALYZED_DATE,
                LLM_ANALYSIS_DATE: updates.LLM_ANALYSIS_DATE,
                AI_BPM: updates.AI_BPM_LLM || updates.AI_BPM,
                AI_ENERGY: updates.AI_ENERGY_LLM || updates.AI_ENERGY,
                AI_KEY: updates.AI_KEY_LLM || updates.AI_KEY,
                AI_MODE: updates.AI_MODE_LLM || updates.AI_MODE,
                AI_TIME_SIGNATURE: updates.AI_TIME_SIGNATURE_LLM || updates.AI_TIME_SIGNATURE,
                AI_DANCEABILITY: updates.AI_DANCEABILITY_LLM || updates.AI_DANCEABILITY,
                AI_VALENCE: updates.AI_VALENCE_LLM || updates.AI_VALENCE,
                AI_ACOUSTICNESS: updates.AI_ACOUSTICNESS_LLM || updates.AI_ACOUSTICNESS,
                AI_INSTRUMENTALNESS: updates.AI_INSTRUMENTALNESS_LLM || updates.AI_INSTRUMENTALNESS,
                AI_LIVENESS: updates.AI_LIVENESS_LLM || updates.AI_LIVENESS,
                AI_SPEECHINESS: updates.AI_SPEECHINESS_LLM || updates.AI_SPEECHINESS,
                AI_LOUDNESS: updates.AI_LOUDNESS_LLM || updates.AI_LOUDNESS,
                AI_MOOD: updates.AI_MOOD_LLM || updates.AI_MOOD,
                AI_CONFIDENCE: updates.AI_CONFIDENCE,
                LLM_GENRE: updates.LLM_GENRE,
                LLM_SUBGENRES: updates.LLM_SUBGENRES,
                LLM_ERA: updates.LLM_ERA,
                LLM_STYLE_PERIOD: updates.LLM_STYLE_PERIOD,
                LLM_DESCRIPTION: updates.LLM_DESCRIPTION,
                LLM_CONTEXT: updates.LLM_CONTEXT,
                LLM_ENERGY_LEVEL: updates.LLM_ENERGY_LEVEL,
                LLM_OCCASIONS: updates.LLM_OCCASIONS,
                LLM_LYRICS_ANALYSIS: updates.LLM_LYRICS_ANALYSIS,
                LLM_LYRICS_THEME: updates.LLM_LYRICS_THEME,
                LLM_LYRICS_MOOD: updates.LLM_LYRICS_MOOD,
                LLM_LYRICS_LANGUAGE: updates.LLM_LYRICS_LANGUAGE,
                LLM_EXPLICIT_CONTENT: updates.LLM_EXPLICIT_CONTENT,
                LLM_STORYTELLING: updates.LLM_STORYTELLING,
                LLM_DJ_NOTES: updates.LLM_DJ_NOTES || updates.dj_notes,
                LLM_MIXING_NOTES: updates.LLM_MIXING_NOTES || updates.mixing_notes,
                LLM_MIXING_KEYS: updates.LLM_MIXING_KEYS || updates.mixing_keys,
                LLM_COMPATIBLE_GENRES: updates.LLM_COMPATIBLE_GENRES || updates.compatible_genres,
                LLM_PRODUCTION_STYLE: updates.LLM_PRODUCTION_STYLE,
                LLM_INSTRUMENTS: updates.LLM_INSTRUMENTS,
                LLM_VOCAL_STYLE: updates.LLM_VOCAL_STYLE,
                LLM_ENERGY_DESCRIPTION: updates.LLM_ENERGY_DESCRIPTION,
                LLM_SIMILAR_ARTISTS: updates.LLM_SIMILAR_ARTISTS,
                LLM_RECOMMENDATIONS: updates.LLM_RECOMMENDATIONS,
                LLM_MUSICAL_INFLUENCE: updates.LLM_MUSICAL_INFLUENCE,
                LLM_IS_COMPILATION: updates.LLM_IS_COMPILATION,
                LLM_IS_REMIX: updates.LLM_IS_REMIX,
                LLM_IS_COVER: updates.LLM_IS_COVER,
                LLM_IS_LIVE: updates.LLM_IS_LIVE,
                LLM_CONFIDENCE_SCORE: updates.LLM_CONFIDENCE_SCORE,
                LLM_VALIDATION_NOTES: updates.LLM_VALIDATION_NOTES,
                LLM_WARNINGS: updates.LLM_WARNINGS,
                llm_version: updates.llm_version
            };

            // Build UPDATE query for audio_files
            const audioUpdates = [];
            const audioParams = [];

            for (const [field, value] of Object.entries(audioFields)) {
                if (value !== undefined && value !== null && value !== '') {
                    audioUpdates.push(`${field} = ?`);
                    audioParams.push(value);
                }
            }

            // Update audio_files if there are changes
            if (audioUpdates.length > 0) {
                audioParams.push(trackId);
                const audioSql = `
                    UPDATE audio_files 
                    SET ${audioUpdates.join(`, ')}, 
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ';

                await new Promise((resolve, reject) => {
                    db.run(audioSql, audioParams, function (err) {
                        if (err) {
                            console.error('Error updating audio_files:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }

            // Build UPDATE/INSERT query for llm_metadata
            const llmUpdates = [];
            const llmParams = [];

            for (const [field, value] of Object.entries(llmFields)) {
                if (value !== undefined && value !== null && value !== '') {
                    llmUpdates.push(`${field} = ?`);
                    llmParams.push(value);
                }
            }

            // Check if llm_metadata record exists
            const checkLlm = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT file_id FROM llm_metadata WHERE file_id = ?',
                    [trackId],
                    (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    }
                );
            });

            if (llmUpdates.length > 0) {
                if (checkLlm) {
                    // Update existing record
                    llmParams.push(trackId);
                    const llmSql = `
                        UPDATE llm_metadata 
                        SET ${llmUpdates.join(`, ')},
                            analysis_timestamp = CURRENT_TIMESTAMP
                        WHERE file_id = ?
                    ';

                    await new Promise((resolve, reject) => {
                        db.run(llmSql, llmParams, function (err) {
                            if (err) {
                                console.error('Error updating llm_metadata:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    // Insert new record
                    const insertFields = ['file_id'];
                    const insertValues = [trackId];

                    for (const [field, value] of Object.entries(llmFields)) {
                        if (value !== undefined && value !== null && value !== '') {
                            insertFields.push(field);
                            insertValues.push(value);
                        }
                    }

                    const placeholders = insertValues.map(() => '?').join(', ');
                    const insertSql = `
                        INSERT INTO llm_metadata (${insertFields.join(`, ')}) 
                        VALUES (${placeholders})
                    ';

                    await new Promise((resolve, reject) => {
                        db.run(insertSql, insertValues, function (err) {
                            if (err) {
                                console.error('Error inserting llm_metadata:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                }
            }

            const totalUpdated = audioUpdates.length + llmUpdates.length;

            return {
                success: true,
                message: `Updated ${totalUpdated} metadata fields`,
                audioFieldsUpdated: audioUpdates.length,
                llmFieldsUpdated: llmUpdates.length
            };
        } catch (error) {
            console.error('Error in complete metadata update:', error);
            return {
                success: false,
                error: error.message
            };
        }
    };
};

module.exports = { createCompleteMetadataHandler };
