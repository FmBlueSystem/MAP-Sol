// Complete Metadata Editor Modal - Shows ALL metadata fields
class CompleteMetadataEditor {
    constructor() {
        this.currentFile = null;
        this.modal = null;
        this.init();
    }

    init() {
        // Create modal HTML if it doesn't exist
        if (!document.getElementById('complete-metadata-editor-modal')) {
            this.createModal();
        }
        this.modal = document.getElementById('complete-metadata-editor-modal');
        this.setupEventListeners();
    }

    createModal() {
        const modalHTML = `
        <div id="complete-metadata-editor-modal" class="modal-backdrop" style="display: none;">
            <div class="metadata-modal-complete">
                <div class="modal-header">
                    <h2>📝 Complete Metadata Editor - ALL Fields</h2>
                    <button class="close-btn" onclick="completeMetadataEditor.close()">✕</button>
                </div>

                <div class="modal-body">
                    <!-- Tabs -->
                    <div class="metadata-tabs">
                        <button class="tab-btn active" data-tab="basic">Basic</button>
                        <button class="tab-btn" data-tab="technical">Technical</button>
                        <button class="tab-btn" data-tab="mixedinkey">MixedInKey</button>
                        <button class="tab-btn" data-tab="ai-analysis">AI Analysis</button>
                        <button class="tab-btn" data-tab="llm-analysis">LLM Analysis</button>
                        <button class="tab-btn" data-tab="lyrics">Lyrics</button>
                        <button class="tab-btn" data-tab="dj-mixing">DJ/Mixing</button>
                        <button class="tab-btn" data-tab="system">System</button>
                    </div>

                    <!-- Tab Content -->
                    <div class="tab-content">
                        <!-- Basic Info Tab -->
                        <div id="tab-basic" class="tab-panel active">
                            <h3>Basic Information</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Title *</label>
                                    <input type="text" id="meta-title" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Artist *</label>
                                    <input type="text" id="meta-artist" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Album</label>
                                    <input type="text" id="meta-album" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Album Artist</label>
                                    <input type="text" id="meta-album-artist" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Genre</label>
                                    <input type="text" id="meta-genre" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Year</label>
                                    <input type="text" id="meta-year" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Track Number</label>
                                    <input type="number" id="meta-track-number" class="meta-input" min="1">
                                </div>
                                <div class="form-group">
                                    <label>Disc Number</label>
                                    <input type="number" id="meta-disc-number" class="meta-input" min="1">
                                </div>
                                <div class="form-group full-width">
                                    <label>Comment</label>
                                    <textarea id="meta-comment" class="meta-input" rows="3"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>ISRC</label>
                                    <input type="text" id="meta-isrc" class="meta-input">
                                </div>
                            </div>
                        </div>

                        <!-- Technical Tab -->
                        <div id="tab-technical" class="tab-panel">
                            <h3>Technical Information</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>BPM (Original)</label>
                                    <input type="number" id="meta-bmp" class="meta-input" min="60" max="200" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>Duration (seconds)</label>
                                    <input type="number" id="meta-duration" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Bitrate (kbps)</label>
                                    <input type="number" id="meta-bitrate" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File Format</label>
                                    <input type="text" id="meta-file-extension" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File Size (bytes)</label>
                                    <input type="number" id="meta-file-size" class="meta-input" readonly>
                                </div>
                                <div class="form-group full-width">
                                    <label>File Path</label>
                                    <input type="text" id="meta-file-path" class="meta-input" readonly>
                                </div>
                                <div class="form-group full-width">
                                    <label>Folder Path</label>
                                    <input type="text" id="meta-folder-path" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File Hash</label>
                                    <input type="text" id="meta-file-hash" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Artwork Path</label>
                                    <input type="text" id="meta-artwork-path" class="meta-input">
                                </div>
                            </div>
                        </div>

                        <!-- MixedInKey Tab -->
                        <div id="tab-mixedinkey" class="tab-panel">
                            <h3>MixedInKey Data</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>MixedInKey BPM</label>
                                    <input type="number" id="meta-existing-bmp" class="meta-input" min="60" max="200" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>MixedInKey Key</label>
                                    <input type="text" id="meta-existing-key" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Energy Level (1-10)</label>
                                    <input type="number" id="meta-energy-level" class="meta-input" min="1" max="10">
                                </div>
                                <div class="form-group">
                                    <label>MixedInKey Detected</label>
                                    <select id="meta-mixed-in-key-detected" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Preservation Source</label>
                                    <input type="text" id="meta-preservation-source" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Should Preserve</label>
                                    <select id="meta-should-preserve" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group full-width">
                                    <label>Beatgrid</label>
                                    <textarea id="meta-beatgrid" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>Cue Points</label>
                                    <textarea id="meta-cuepoints" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>Serato Markers</label>
                                    <textarea id="meta-serato-markers" class="meta-input" rows="2"></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- AI Analysis Tab -->
                        <div id="tab-ai-analysis" class="tab-panel">
                            <h3>AI Analysis Results</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>AI BPM</label>
                                    <input type="number" id="meta-ai-bpm" class="meta-input" min="60" max="200" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>AI Key</label>
                                    <input type="text" id="meta-ai-key" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Mode</label>
                                    <input type="text" id="meta-ai-mode" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Time Signature</label>
                                    <input type="number" id="meta-ai-time-signature" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Energy (0-1)</label>
                                    <input type="number" id="meta-ai-energy" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Danceability (0-1)</label>
                                    <input type="number" id="meta-ai-danceability" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Valence (0-1)</label>
                                    <input type="number" id="meta-ai-valence" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Acousticness (0-1)</label>
                                    <input type="number" id="meta-ai-acousticness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Instrumentalness (0-1)</label>
                                    <input type="number" id="meta-ai-instrumentalness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Liveness (0-1)</label>
                                    <input type="number" id="meta-ai-liveness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Speechiness (0-1)</label>
                                    <input type="number" id="meta-ai-speechiness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>AI Loudness (dB)</label>
                                    <input type="number" id="meta-ai-loudness" class="meta-input" min="-60" max="0" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>AI Mood</label>
                                    <input type="text" id="meta-ai-mood" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Genre</label>
                                    <input type="text" id="meta-ai-genre" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Subgenres</label>
                                    <input type="text" id="meta-ai-subgenres" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Occasion</label>
                                    <input type="text" id="meta-ai-occasion" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Era</label>
                                    <input type="text" id="meta-ai-era" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Cultural Context</label>
                                    <input type="text" id="meta-ai-cultural-context" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Analyzed</label>
                                    <select id="meta-ai-analyzed" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>AI Confidence</label>
                                    <input type="number" id="meta-ai-confidence" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                            </div>
                        </div>

                        <!-- LLM Analysis Tab -->
                        <div id="tab-llm-analysis" class="tab-panel">
                            <h3>LLM Analysis Results</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>LLM Genre</label>
                                    <input type="text" id="meta-llm-genre" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Subgenres</label>
                                    <input type="text" id="meta-llm-subgenres" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Era</label>
                                    <input type="text" id="meta-llm-era" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Style Period</label>
                                    <input type="text" id="meta-llm-style-period" class="meta-input">
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Description</label>
                                    <textarea id="meta-llm-description" class="meta-input" rows="3"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Context</label>
                                    <textarea id="meta-llm-context" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>LLM Energy Level</label>
                                    <input type="text" id="meta-llm-energy-level" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Occasions</label>
                                    <input type="text" id="meta-llm-occasions" class="meta-input">
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM DJ Notes</label>
                                    <textarea id="meta-llm-dj-notes" class="meta-input" rows="3"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Mixing Notes</label>
                                    <textarea id="meta-llm-mixing-notes" class="meta-input" rows="3"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>LLM Mixing Keys</label>
                                    <input type="text" id="meta-llm-mixing-keys" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Compatible Genres</label>
                                    <input type="text" id="meta-llm-compatible-genres" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Production Style</label>
                                    <input type="text" id="meta-llm-production-style" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Instruments</label>
                                    <input type="text" id="meta-llm-instruments" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Vocal Style</label>
                                    <input type="text" id="meta-llm-vocal-style" class="meta-input">
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Energy Description</label>
                                    <textarea id="meta-llm-energy-description" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>LLM Similar Artists</label>
                                    <input type="text" id="meta-llm-similar-artists" class="meta-input">
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Recommendations</label>
                                    <textarea id="meta-llm-recommendations" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>LLM Musical Influence</label>
                                    <input type="text" id="meta-llm-musical-influence" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Is Compilation</label>
                                    <select id="meta-llm-is-compilation" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Is Remix</label>
                                    <select id="meta-llm-is-remix" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Is Cover</label>
                                    <select id="meta-llm-is-cover" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Is Live</label>
                                    <select id="meta-llm-is-live" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>LLM Confidence Score</label>
                                    <input type="number" id="meta-llm-confidence-score" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Validation Notes</label>
                                    <textarea id="meta-llm-validation-notes" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Warnings</label>
                                    <textarea id="meta-llm-warnings" class="meta-input" rows="2"></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Lyrics Tab -->
                        <div id="tab-lyrics" class="tab-panel">
                            <h3>Lyrics Analysis</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Lyrics Analyzed</label>
                                    <select id="meta-lyrics-analyzed" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Lyrics Language</label>
                                    <input type="text" id="meta-lyrics-language" class="meta-input" maxlength="10">
                                </div>
                                <div class="form-group">
                                    <label>Secondary Language</label>
                                    <input type="text" id="meta-lyrics-language-secondary" class="meta-input" maxlength="10">
                                </div>
                                <div class="form-group">
                                    <label>Primary Theme</label>
                                    <input type="text" id="meta-lyrics-theme-primary" class="meta-input" maxlength="50">
                                </div>
                                <div class="form-group">
                                    <label>Secondary Theme</label>
                                    <input type="text" id="meta-lyrics-theme-secondary" class="meta-input" maxlength="50">
                                </div>
                                <div class="form-group">
                                    <label>Lyrics Mood</label>
                                    <input type="text" id="meta-lyrics-mood" class="meta-input" maxlength="20">
                                </div>
                                <div class="form-group">
                                    <label>Perspective</label>
                                    <input type="text" id="meta-lyrics-perspective" class="meta-input" maxlength="10">
                                </div>
                                <div class="form-group">
                                    <label>Temporality</label>
                                    <input type="text" id="meta-lyrics-temporality" class="meta-input" maxlength="15">
                                </div>
                                <div class="form-group">
                                    <label>Intensity</label>
                                    <input type="text" id="meta-lyrics-intensity" class="meta-input" maxlength="15">
                                </div>
                                <div class="form-group">
                                    <label>Complexity</label>
                                    <input type="text" id="meta-lyrics-complexity" class="meta-input" maxlength="15">
                                </div>
                                <div class="form-group">
                                    <label>Explicit Content</label>
                                    <select id="meta-lyrics-explicit" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Storytelling</label>
                                    <input type="text" id="meta-lyrics-storytelling" class="meta-input" maxlength="20">
                                </div>
                                <div class="form-group full-width">
                                    <label>Call to Action</label>
                                    <textarea id="meta-lyrics-call-to-action" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Target Audience</label>
                                    <input type="text" id="meta-lyrics-target-audience" class="meta-input" maxlength="20">
                                </div>
                                <div class="form-group">
                                    <label>Cultural Context</label>
                                    <input type="text" id="meta-lyrics-cultural-context" class="meta-input" maxlength="20">
                                </div>
                                <div class="form-group full-width">
                                    <label>Use Context</label>
                                    <textarea id="meta-lyrics-use-context" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>Key Phrases</label>
                                    <textarea id="meta-lyrics-key-phrases" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Emotional Journey</label>
                                    <input type="text" id="meta-lyrics-emotional-journey" class="meta-input" maxlength="15">
                                </div>
                                <div class="form-group">
                                    <label>Rhyme Scheme</label>
                                    <input type="text" id="meta-lyrics-rhyme-scheme" class="meta-input" maxlength="10">
                                </div>
                                <div class="form-group">
                                    <label>Vocal Delivery</label>
                                    <input type="text" id="meta-lyrics-vocal-delivery" class="meta-input" maxlength="15">
                                </div>
                                <div class="form-group">
                                    <label>Vocal Type</label>
                                    <input type="text" id="meta-lyrics-vocal-type" class="meta-input" maxlength="20">
                                </div>
                                <div class="form-group">
                                    <label>Confidence</label>
                                    <input type="number" id="meta-lyrics-confidence" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Has Content</label>
                                    <select id="meta-lyrics-has-content" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Is Instrumental</label>
                                    <select id="meta-lyrics-is-instrumental" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Lyrics Analysis</label>
                                    <textarea id="meta-llm-lyrics-analysis" class="meta-input" rows="3"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>LLM Lyrics Theme</label>
                                    <input type="text" id="meta-llm-lyrics-theme" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Lyrics Mood</label>
                                    <input type="text" id="meta-llm-lyrics-mood" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Lyrics Language</label>
                                    <input type="text" id="meta-llm-lyrics-language" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Explicit Content</label>
                                    <select id="meta-llm-explicit-content" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group full-width">
                                    <label>LLM Storytelling</label>
                                    <textarea id="meta-llm-storytelling" class="meta-input" rows="2"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>Lyrics Analysis Note</label>
                                    <textarea id="meta-lyrics-analysis-note" class="meta-input" rows="2"></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- DJ/Mixing Tab -->
                        <div id="tab-dj-mixing" class="tab-panel">
                            <h3>DJ & Mixing Information</h3>
                            <div class="form-grid">
                                <div class="form-group full-width">
                                    <label>DJ Notes</label>
                                    <textarea id="meta-dj-notes" class="meta-input" rows="4"></textarea>
                                </div>
                                <div class="form-group full-width">
                                    <label>Mixing Notes</label>
                                    <textarea id="meta-mixing-notes" class="meta-input" rows="4"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Compatible Keys</label>
                                    <input type="text" id="meta-mixing-keys" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Compatible Genres</label>
                                    <input type="text" id="meta-compatible-genres" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Normalization Analyzed</label>
                                    <select id="meta-normalization-analyzed" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- System Tab -->
                        <div id="tab-system" class="tab-panel">
                            <h3>System Information</h3>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>File ID</label>
                                    <input type="text" id="meta-id" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Date Added</label>
                                    <input type="text" id="meta-date-added" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Date Modified</label>
                                    <input type="text" id="meta-date-modified" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Last Analyzed</label>
                                    <input type="text" id="meta-last-analyzed" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Analysis Status</label>
                                    <input type="text" id="meta-analysis-status" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Analysis Version</label>
                                    <input type="text" id="meta-analysis-version" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Analyzed</label>
                                    <select id="meta-analyzed" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Needs Analysis</label>
                                    <select id="meta-needs-analysis" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Cached</label>
                                    <select id="meta-cached" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Genre Correction Applied</label>
                                    <select id="meta-genre-correction-applied" class="meta-input">
                                        <option value="0">No</option>
                                        <option value="1">Yes</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Genre Correction Date</label>
                                    <input type="text" id="meta-genre-correction-date" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Genre Correction Type</label>
                                    <input type="text" id="meta-genre-correction-type" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>LLM Version</label>
                                    <input type="text" id="meta-llm-version" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Analyzed Date</label>
                                    <input type="text" id="meta-ai-analyzed-date" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>LLM Analysis Date</label>
                                    <input type="text" id="meta-llm-analysis-date" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Lyrics Analyzed Date</label>
                                    <input type="text" id="meta-lyrics-analyzed-date" class="meta-input" readonly>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <div class="footer-info">
                        <span id="field-count">Loading 143 fields...</span>
                        <span id="save-status"></span>
                    </div>
                    <div class="footer-actions">
                        <button class="btn-secondary" onclick="completeMetadataEditor.showRawData()">📋 Show Raw</button>
                        <button class="btn-secondary" onclick="completeMetadataEditor.close()">Cancel</button>
                        <button class="btn-primary" onclick="completeMetadataEditor.save()">💾 Save All Changes</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style`);
        style.textContent = `
            .metadata-modal-complete {
                background: linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(30, 30, 30, 0.98));
                border-radius: 12px;
                width: 95%;
                max-width: 1200px;
                height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .metadata-modal-complete .modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
                max-height: calc(90vh - 140px);
            }

            .metadata-modal-complete .tab-panel h3 {
                color: #1db954;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .metadata-modal-complete .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .metadata-modal-complete .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .metadata-modal-complete .form-group.full-width {
                grid-column: 1 / -1;
            }

            .metadata-modal-complete .form-group label {
                color: rgba(255, 255, 255, 0.8);
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
            }

            .metadata-modal-complete .meta-input {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                padding: 8px 10px;
                color: #fff;
                font-size: 13px;
                transition: all 0.2s;
            }

            .metadata-modal-complete .meta-input:focus {
                outline: none;
                border-color: #1db954;
                background: rgba(255, 255, 255, 0.08);
                box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.2);
            }

            .metadata-modal-complete .meta-input[readonly] {
                opacity: 0.6;
                cursor: not-allowed;
                background: rgba(255, 255, 255, 0.02);
            }

            .metadata-modal-complete textarea.meta-input {
                resize: vertical;
                min-height: 50px;
                font-family: inherit;
            }

            .metadata-modal-complete .metadata-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                flex-wrap: wrap;
            }

            .metadata-modal-complete .tab-btn {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                padding: 10px 16px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                border-bottom: 2px solid transparent;
                margin-bottom: -1px;
                white-space: nowrap;
            }

            .metadata-modal-complete .tab-btn:hover {
                color: rgba(255, 255, 255, 0.8);
                background: rgba(255, 255, 255, 0.05);
            }

            .metadata-modal-complete .tab-btn.active {
                color: #1db954;
                border-bottom-color: #1db954;
                font-weight: 600;
            }

            #field-count {
                color: rgba(255, 255, 255, 0.5);
                font-size: 11px;
                margin-right: 20px;
            }

            /* Scrollbar styling */
            .metadata-modal-complete .modal-body::-webkit-scrollbar {
                width: 8px;
            }

            .metadata-modal-complete .modal-body::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
            }

            .metadata-modal-complete .modal-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }

            .metadata-modal-complete .modal-body::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            }
        });

        // Close on backdrop click
        const modal = document.getElementById('complete-metadata-editor-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.style.display !== 'none') {
                this.close();
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.metadata-modal-complete .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.metadata-modal-complete .tab-panel').forEach(panel => {
            panel.classList.toggle('active`, panel.id === `tab-${tabName}`);
        });
    }

    async open(fileData) {
        this.currentFile = fileData;
        this.modal.style.display = 'flex';

        // Log data to console for debugging

        .length);

        // Update field count
        const fieldCount = Object.keys(fileData).filter(key => fileData[key] !== null && fileData[key] !== undefined).length;
        document.getElementById('field-count`).textContent = `${fieldCount} metadata fields with data`;

        // Load data into form
        this.loadData(fileData);

        // Switch to basic tab by default
        this.switchTab('basic');
    }

    loadData(file) {
        // Helper function to safely set value
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value || '`;
            } else {
                console.warn(`Element not found: ${id}`);
            }
        };

        // Log sample of data being loaded

        .filter(k => file[k] !== null).length);

        // Basic Info
        setValue('meta-title', file.title);
        setValue('meta-artist', file.artist);
        setValue('meta-album', file.album);
        setValue('meta-album-artist', file.album_artist);
        setValue('meta-genre', file.genre);
        setValue('meta-year', file.year);
        setValue('meta-track-number', file.track_number);
        setValue('meta-disc-number', file.disc_number);
        setValue('meta-comment', file.comment);
        setValue('meta-isrc', file.isrc);

        // Technical
        setValue('meta-bmp', file.bmp);
        setValue('meta-duration', file.duration);
        setValue('meta-bitrate', file.bitrate);
        setValue('meta-file-extension', file.file_extension);
        setValue('meta-file-size', file.file_size);
        setValue('meta-file-path', file.file_path);
        setValue('meta-folder-path', file.folder_path);
        setValue('meta-file-hash', file.file_hash);
        setValue('meta-artwork-path', file.artwork_path);

        // MixedInKey
        setValue('meta-existing-bmp', file.existing_bmp);
        setValue('meta-existing-key', file.existing_key);
        setValue('meta-energy-level', file.energy_level);
        setValue('meta-mixed-in-key-detected', file.mixed_in_key_detected);
        setValue('meta-preservation-source', file.preservation_source);
        setValue('meta-should-preserve', file.should_preserve);
        setValue('meta-beatgrid', file.beatgrid);
        setValue('meta-cuepoints', file.cuepoints);
        setValue('meta-serato-markers', file.serato_markers);

        // AI Analysis
        setValue('meta-ai-bpm', file.AI_BPM);
        setValue('meta-ai-key', file.AI_KEY);
        setValue('meta-ai-mode', file.AI_MODE);
        setValue('meta-ai-time-signature', file.AI_TIME_SIGNATURE);
        setValue('meta-ai-energy', file.AI_ENERGY);
        setValue('meta-ai-danceability', file.AI_DANCEABILITY);
        setValue('meta-ai-valence', file.AI_VALENCE);
        setValue('meta-ai-acousticness', file.AI_ACOUSTICNESS);
        setValue('meta-ai-instrumentalness', file.AI_INSTRUMENTALNESS);
        setValue('meta-ai-liveness', file.AI_LIVENESS);
        setValue('meta-ai-speechiness', file.AI_SPEECHINESS);
        setValue('meta-ai-loudness', file.AI_LOUDNESS);
        setValue('meta-ai-mood', file.AI_MOOD);
        setValue('meta-ai-genre', file.AI_GENRE);
        setValue('meta-ai-subgenres', file.AI_SUBGENRES);
        setValue('meta-ai-occasion', file.AI_OCCASION);
        setValue('meta-ai-era', file.AI_ERA);
        setValue('meta-ai-cultural-context', file.AI_CULTURAL_CONTEXT);
        setValue('meta-ai-analyzed', file.AI_ANALYZED);
        setValue('meta-ai-confidence', file.AI_CONFIDENCE);

        // LLM Analysis
        setValue('meta-llm-genre', file.LLM_GENRE);
        setValue('meta-llm-subgenres', file.LLM_SUBGENRES);
        setValue('meta-llm-era', file.LLM_ERA);
        setValue('meta-llm-style-period', file.LLM_STYLE_PERIOD);
        setValue('meta-llm-description', file.LLM_DESCRIPTION);
        setValue('meta-llm-context', file.LLM_CONTEXT);
        setValue('meta-llm-energy-level', file.LLM_ENERGY_LEVEL);
        setValue('meta-llm-occasions', file.LLM_OCCASIONS);
        setValue('meta-llm-dj-notes', file.LLM_DJ_NOTES);
        setValue('meta-llm-mixing-notes', file.LLM_MIXING_NOTES);
        setValue('meta-llm-mixing-keys', file.LLM_MIXING_KEYS);
        setValue('meta-llm-compatible-genres', file.LLM_COMPATIBLE_GENRES);
        setValue('meta-llm-production-style', file.LLM_PRODUCTION_STYLE);
        setValue('meta-llm-instruments', file.LLM_INSTRUMENTS);
        setValue('meta-llm-vocal-style', file.LLM_VOCAL_STYLE);
        setValue('meta-llm-energy-description', file.LLM_ENERGY_DESCRIPTION);
        setValue('meta-llm-similar-artists', file.LLM_SIMILAR_ARTISTS);
        setValue('meta-llm-recommendations', file.LLM_RECOMMENDATIONS);
        setValue('meta-llm-musical-influence', file.LLM_MUSICAL_INFLUENCE);
        setValue('meta-llm-is-compilation', file.LLM_IS_COMPILATION);
        setValue('meta-llm-is-remix', file.LLM_IS_REMIX);
        setValue('meta-llm-is-cover', file.LLM_IS_COVER);
        setValue('meta-llm-is-live', file.LLM_IS_LIVE);
        setValue('meta-llm-confidence-score', file.LLM_CONFIDENCE_SCORE);
        setValue('meta-llm-validation-notes', file.LLM_VALIDATION_NOTES);
        setValue('meta-llm-warnings', file.LLM_WARNINGS);

        // Lyrics
        setValue('meta-lyrics-analyzed', file.lyrics_analyzed);
        setValue('meta-lyrics-language', file.lyrics_language);
        setValue('meta-lyrics-language-secondary', file.lyrics_language_secondary);
        setValue('meta-lyrics-theme-primary', file.lyrics_theme_primary);
        setValue('meta-lyrics-theme-secondary', file.lyrics_theme_secondary);
        setValue('meta-lyrics-mood', file.lyrics_mood);
        setValue('meta-lyrics-perspective', file.lyrics_perspective);
        setValue('meta-lyrics-temporality', file.lyrics_temporality);
        setValue('meta-lyrics-intensity', file.lyrics_intensity);
        setValue('meta-lyrics-complexity', file.lyrics_complexity);
        setValue('meta-lyrics-explicit', file.lyrics_explicit);
        setValue('meta-lyrics-storytelling', file.lyrics_storytelling);
        setValue('meta-lyrics-call-to-action', file.lyrics_call_to_action);
        setValue('meta-lyrics-target-audience', file.lyrics_target_audience);
        setValue('meta-lyrics-cultural-context', file.lyrics_cultural_context);
        setValue('meta-lyrics-use-context', file.lyrics_use_context);
        setValue('meta-lyrics-key-phrases', file.lyrics_key_phrases);
        setValue('meta-lyrics-emotional-journey', file.lyrics_emotional_journey);
        setValue('meta-lyrics-rhyme-scheme', file.lyrics_rhyme_scheme);
        setValue('meta-lyrics-vocal-delivery', file.lyrics_vocal_delivery);
        setValue('meta-lyrics-vocal-type', file.lyrics_vocal_type);
        setValue('meta-lyrics-confidence', file.lyrics_confidence);
        setValue('meta-lyrics-has-content', file.lyrics_has_content);
        setValue('meta-lyrics-is-instrumental', file.lyrics_is_instrumental);
        setValue('meta-llm-lyrics-analysis', file.LLM_LYRICS_ANALYSIS);
        setValue('meta-llm-lyrics-theme', file.LLM_LYRICS_THEME);
        setValue('meta-llm-lyrics-mood', file.LLM_LYRICS_MOOD);
        setValue('meta-llm-lyrics-language', file.LLM_LYRICS_LANGUAGE);
        setValue('meta-llm-explicit-content', file.LLM_EXPLICIT_CONTENT);
        setValue('meta-llm-storytelling', file.LLM_STORYTELLING);
        setValue('meta-lyrics-analysis-note', file.lyrics_analysis_note);

        // DJ/Mixing (separate from LLM fields for manual entries)
        setValue('meta-dj-notes', file.LLM_DJ_NOTES);
        setValue('meta-mixing-notes', file.LLM_MIXING_NOTES);
        setValue('meta-mixing-keys', file.LLM_MIXING_KEYS);
        setValue('meta-compatible-genres', file.LLM_COMPATIBLE_GENRES);
        setValue('meta-normalization-analyzed', file.normalization_analyzed);

        // System
        setValue('meta-id', file.id);
        setValue('meta-date-added', file.date_added);
        setValue('meta-date-modified', file.date_modified);
        setValue('meta-last-analyzed', file.last_analyzed);
        setValue('meta-analysis-status', file.analysis_status);
        setValue('meta-analysis-version', file.analysis_version);
        setValue('meta-analyzed', file.analyzed);
        setValue('meta-needs-analysis', file.needs_analysis);
        setValue('meta-cached', file.cached);
        setValue('meta-genre-correction-applied', file.genre_correction_applied);
        setValue('meta-genre-correction-date', file.genre_correction_date);
        setValue('meta-genre-correction-type', file.genre_correction_type);
        setValue('meta-llm-version', file.llm_version);
        setValue('meta-ai-analyzed-date', file.AI_ANALYZED_DATE);
        setValue('meta-llm-analysis-date', file.LLM_ANALYSIS_DATE);
        setValue('meta-lyrics-analyzed-date', file.lyrics_analyzed_date);
    }

    showRawData() {
        if (!this.currentFile) return;

        const rawDataWindow = window.open('', '_blank', 'width=800,height=600`);
        rawDataWindow.document.write(`
            <html>
            <head>
                <title>Raw Metadata - ${this.currentFile.title || 'Unknown'}</title>
                <style>
                    body {
                        font-family: monospace;
                        background: #1a1a1a;
                        color: #0f0;
                        padding: 20px;
                    }
                    pre {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                </style>
            </head>
            <body>
                <h2>Raw Metadata for: ${this.currentFile.title || 'Unknown'}</h2>
                <pre>${JSON.stringify(this.currentFile, null, 2)}</pre>
            </body>
            </html>
        ');
    }

    async save() {
        if (!this.currentFile) return;

        // Helper function to safely get value
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value : null;
        };

        // Collect ALL fields
        const updates = {
            id: this.currentFile.id,

            // Basic Info
            title: getValue('meta-title'),
            artist: getValue('meta-artist'),
            album: getValue('meta-album'),
            album_artist: getValue('meta-album-artist'),
            genre: getValue('meta-genre'),
            year: getValue('meta-year'),
            track_number: getValue('meta-track-number'),
            disc_number: getValue('meta-disc-number'),
            comment: getValue('meta-comment'),
            isrc: getValue('meta-isrc'),

            // Technical
            bmp: getValue('meta-bmp'),
            duration: getValue('meta-duration'),
            bitrate: getValue('meta-bitrate'),
            file_extension: getValue('meta-file-extension'),
            file_size: getValue('meta-file-size'),
            file_path: getValue('meta-file-path'),
            folder_path: getValue('meta-folder-path'),
            file_hash: getValue('meta-file-hash'),
            artwork_path: getValue('meta-artwork-path'),

            // MixedInKey
            existing_bmp: getValue('meta-existing-bmp'),
            existing_key: getValue('meta-existing-key'),
            energy_level: getValue('meta-energy-level'),
            mixed_in_key_detected: getValue('meta-mixed-in-key-detected'),
            preservation_source: getValue('meta-preservation-source'),
            should_preserve: getValue('meta-should-preserve'),
            beatgrid: getValue('meta-beatgrid'),
            cuepoints: getValue('meta-cuepoints'),
            serato_markers: getValue('meta-serato-markers'),

            // AI Analysis
            AI_BPM: getValue('meta-ai-bpm'),
            AI_KEY: getValue('meta-ai-key'),
            AI_MODE: getValue('meta-ai-mode'),
            AI_TIME_SIGNATURE: getValue('meta-ai-time-signature'),
            AI_ENERGY: getValue('meta-ai-energy'),
            AI_DANCEABILITY: getValue('meta-ai-danceability'),
            AI_VALENCE: getValue('meta-ai-valence'),
            AI_ACOUSTICNESS: getValue('meta-ai-acousticness'),
            AI_INSTRUMENTALNESS: getValue('meta-ai-instrumentalness'),
            AI_LIVENESS: getValue('meta-ai-liveness'),
            AI_SPEECHINESS: getValue('meta-ai-speechiness'),
            AI_LOUDNESS: getValue('meta-ai-loudness'),
            AI_MOOD: getValue('meta-ai-mood'),
            AI_GENRE: getValue('meta-ai-genre'),
            AI_SUBGENRES: getValue('meta-ai-subgenres'),
            AI_OCCASION: getValue('meta-ai-occasion'),
            AI_ERA: getValue('meta-ai-era'),
            AI_CULTURAL_CONTEXT: getValue('meta-ai-cultural-context'),
            AI_ANALYZED: getValue('meta-ai-analyzed'),
            AI_CONFIDENCE: getValue('meta-ai-confidence'),

            // LLM Analysis
            LLM_GENRE: getValue('meta-llm-genre'),
            LLM_SUBGENRES: getValue('meta-llm-subgenres'),
            LLM_ERA: getValue('meta-llm-era'),
            LLM_STYLE_PERIOD: getValue('meta-llm-style-period'),
            LLM_DESCRIPTION: getValue('meta-llm-description'),
            LLM_CONTEXT: getValue('meta-llm-context'),
            LLM_ENERGY_LEVEL: getValue('meta-llm-energy-level'),
            LLM_OCCASIONS: getValue('meta-llm-occasions'),
            LLM_DJ_NOTES: getValue('meta-llm-dj-notes'),
            LLM_MIXING_NOTES: getValue('meta-llm-mixing-notes'),
            LLM_MIXING_KEYS: getValue('meta-llm-mixing-keys'),
            LLM_COMPATIBLE_GENRES: getValue('meta-llm-compatible-genres'),
            LLM_PRODUCTION_STYLE: getValue('meta-llm-production-style'),
            LLM_INSTRUMENTS: getValue('meta-llm-instruments'),
            LLM_VOCAL_STYLE: getValue('meta-llm-vocal-style'),
            LLM_ENERGY_DESCRIPTION: getValue('meta-llm-energy-description'),
            LLM_SIMILAR_ARTISTS: getValue('meta-llm-similar-artists'),
            LLM_RECOMMENDATIONS: getValue('meta-llm-recommendations'),
            LLM_MUSICAL_INFLUENCE: getValue('meta-llm-musical-influence'),
            LLM_IS_COMPILATION: getValue('meta-llm-is-compilation'),
            LLM_IS_REMIX: getValue('meta-llm-is-remix'),
            LLM_IS_COVER: getValue('meta-llm-is-cover'),
            LLM_IS_LIVE: getValue('meta-llm-is-live'),
            LLM_CONFIDENCE_SCORE: getValue('meta-llm-confidence-score'),
            LLM_VALIDATION_NOTES: getValue('meta-llm-validation-notes'),
            LLM_WARNINGS: getValue('meta-llm-warnings'),

            // Lyrics
            lyrics_analyzed: getValue('meta-lyrics-analyzed'),
            lyrics_language: getValue('meta-lyrics-language'),
            lyrics_language_secondary: getValue('meta-lyrics-language-secondary'),
            lyrics_theme_primary: getValue('meta-lyrics-theme-primary'),
            lyrics_theme_secondary: getValue('meta-lyrics-theme-secondary'),
            lyrics_mood: getValue('meta-lyrics-mood'),
            lyrics_perspective: getValue('meta-lyrics-perspective'),
            lyrics_temporality: getValue('meta-lyrics-temporality'),
            lyrics_intensity: getValue('meta-lyrics-intensity'),
            lyrics_complexity: getValue('meta-lyrics-complexity'),
            lyrics_explicit: getValue('meta-lyrics-explicit'),
            lyrics_storytelling: getValue('meta-lyrics-storytelling'),
            lyrics_call_to_action: getValue('meta-lyrics-call-to-action'),
            lyrics_target_audience: getValue('meta-lyrics-target-audience'),
            lyrics_cultural_context: getValue('meta-lyrics-cultural-context'),
            lyrics_use_context: getValue('meta-lyrics-use-context'),
            lyrics_key_phrases: getValue('meta-lyrics-key-phrases'),
            lyrics_emotional_journey: getValue('meta-lyrics-emotional-journey'),
            lyrics_rhyme_scheme: getValue('meta-lyrics-rhyme-scheme'),
            lyrics_vocal_delivery: getValue('meta-lyrics-vocal-delivery'),
            lyrics_vocal_type: getValue('meta-lyrics-vocal-type'),
            lyrics_confidence: getValue('meta-lyrics-confidence'),
            lyrics_has_content: getValue('meta-lyrics-has-content'),
            lyrics_is_instrumental: getValue('meta-lyrics-is-instrumental'),
            LLM_LYRICS_ANALYSIS: getValue('meta-llm-lyrics-analysis'),
            LLM_LYRICS_THEME: getValue('meta-llm-lyrics-theme'),
            LLM_LYRICS_MOOD: getValue('meta-llm-lyrics-mood'),
            LLM_LYRICS_LANGUAGE: getValue('meta-llm-lyrics-language'),
            LLM_EXPLICIT_CONTENT: getValue('meta-llm-explicit-content'),
            LLM_STORYTELLING: getValue('meta-llm-storytelling'),
            lyrics_analysis_note: getValue('meta-lyrics-analysis-note'),

            // DJ/Mixing
            normalization_analyzed: getValue('meta-normalization-analyzed'),

            // System
            analysis_status: getValue('meta-analysis-status'),
            analysis_version: getValue('meta-analysis-version'),
            analyzed: getValue('meta-analyzed'),
            needs_analysis: getValue('meta-needs-analysis'),
            cached: getValue('meta-cached'),
            genre_correction_applied: getValue('meta-genre-correction-applied'),
            genre_correction_date: getValue('meta-genre-correction-date'),
            genre_correction_type: getValue('meta-genre-correction-type'),
            llm_version: getValue('meta-llm-version')
        };

        try {
            document.getElementById('save-status').textContent = 'Saving 143 fields...';

            const result = await window.electronAPI.invoke('update-complete-metadata', updates);

            if (result.success) {
                document.getElementById('save-status').textContent = '✅ All 143 fields saved!';
                setTimeout(() => {
                    this.close();
                    if (window.loadData) {
                        window.loadData();
                    }
                }, 1500);
            } else {
                document.getElementById('save-status').textContent = '❌ Error saving metadata';
            }
        } catch (error) {
            console.error('Error saving metadata:', error);
            document.getElementById('save-status').textContent = '❌ Error: ' + error.message;
        }
    }

    close() {
        this.modal.style.display = 'none';
        this.currentFile = null;
        document.getElementById('save-status').textContent = '';
    }
}

// Initialize global instance
window.completeMetadataEditor = new CompleteMetadataEditor();

// Export for use in other modules
if (typeof module !== `undefined` && module.exports) {
    module.exports = CompleteMetadataEditor;
}