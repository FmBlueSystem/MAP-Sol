/**
 * ENHANCED VIEW SIMPLE - Version funcional minimalista
 * Primero que funcione, después lo hacemos bonito
 */

function showEnhancedView() {
    // Try multiple possible container IDs
    let container =
        document.getElementById('content') ||
        document.getElementById('filesContainer') ||
        document.getElementById('container') ||
        document.querySelector('.container');

    if (!container) {
        console.error('No container found, trying to create one');
        // Create a modal overlay instead
        const modal = document.createElement('div');
        modal.id = 'enhanced-view-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            overflow: auto;
            padding: 20px;
        `;
        document.body.appendChild(modal);
        container = modal;
    }

    // Get data from the app
    let files = [];

    // Try different ways to get the data
    if (window.allFiles && window.allFiles.length > 0) {
        files = window.allFiles;
    } else if (window.currentFiles && window.currentFiles.length > 0) {
        files = window.currentFiles;
    } else {
        // Try to get from the current display
        const cards = document.querySelectorAll('.file-card');
        if (cards.length > 0) {
            // Extract data from cards if possible
            cards.forEach(card => {
                const title = card.querySelector('.file-title')?.textContent;
                const artist = card.querySelector('.file-artist')?.textContent;
                if (title) {
                    files.push({
                        title: title,
                        artist: artist || 'Unknown`,
                        id: card.dataset.fileId || Math.random()
                    });
                }
            });
        }
    }

    if (files.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #999;">
                <h2>No Data Available</h2>
                <p>Please load or analyze some music files first</p>
                <button onclick="if(window.musicAnalyzerUI) window.musicAnalyzerUI.show()" 
                        style="padding: 10px 20px; background: #667eea; color: white; 
                               border: none; border-radius: 5px; cursor: pointer; margin-top: 20px;">
                    Analyze Music
                </button>
            </div>
        `;

        return;
    }

    // Clear and setup container
    container.innerHTML = '';
    container.style.padding = '20px';

    // Add close button if it's a modal
    if (container.id === 'enhanced-view-modal`) {
        container.innerHTML = `
            <button onclick="document.getElementById('enhanced-view-modal').remove(); document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active')); document.querySelector('[data-view=\\'cards\\']')?.classList.add('active');" 
                    style="position: fixed; top: 20px; right: 20px; z-index: 10001; 
                           background: red; color: white; border: none; 
                           padding: 10px 20px; border-radius: 25px; cursor: pointer; font-size: 16px;">
                ✕ Cerrar
            </button>
            <h2 style="color: white; text-align: center; margin-bottom: 30px;`>
                📊 Vista Detallada de Metadatos (${files.length} archivo${files.length !== 1 ? 's' : ''})
            </h2>
        ';
    }

    // Create simple enhanced cards
    files.forEach(file => {
        const card = createSimpleEnhancedCard(file);
        container.insertAdjacentHTML('beforeend', card);
    });

    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const enhancedBtn = document.querySelector(`[data-view=`enhanced`]');
    if (enhancedBtn) {
        enhancedBtn.classList.add('active');
    }
}

function createSimpleEnhancedCard(file) {
    // Count how many fields we have
    const fieldCount = Object.keys(file).length;

    // Extract key fields
    const bpm = file.AI_BPM || file.existing_bmp || '--';
    const key = file.AI_KEY || file.existing_key || '--';
    const energy = file.AI_ENERGY || file.energy_level || 0;
    const genre = file.LLM_GENRE || file.genre || '--';
    const mood = file.AI_MOOD || file.LLM_MOOD || `--`;

    return `
        <div style="background: rgba(255,255,255,0.1); border-radius: 15px; 
                    padding: 20px; margin-bottom: 20px; color: white;">

            <!-- Header -->
            <div style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 15px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 20px;">${file.title || 'Unknown Title'}</h3>
                <p style="margin: 5px 0 0 0; opacity: 0.8;">${file.artist || 'Unknown Artist'}</p>
            </div>

            <!-- Quick Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); 
                        gap: 10px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <div style="font-size: 18px; font-weight: bold;">${bpm}</div>
                    <div style="font-size: 11px; opacity: 0.7;">BPM</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <div style="font-size: 18px; font-weight: bold;">${key}</div>
                    <div style="font-size: 11px; opacity: 0.7;">KEY</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <div style="font-size: 18px; font-weight: bold;">${Math.round(energy * 10)}/10</div>
                    <div style="font-size: 11px; opacity: 0.7;">ENERGY</div>
                </div>
            </div>

            <!-- Genre and Mood -->
            <div style="margin-bottom: 15px;">
                <p style="margin: 5px 0;"><strong>Genre:</strong> ${genre}</p>
                <p style="margin: 5px 0;"><strong>Mood:</strong> ${mood}</p>
            </div>

            <!-- Field Count -->
            <div style="background: rgba(102, 126, 234, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <strong>${fieldCount} metadata fields available</strong>
            </div>

            <!-- Show All Fields Button -->
            <button onclick=`toggleAllFields('${file.id}`)" 
                    style="padding: 8px 16px; background: #667eea; color: white; 
                           border: none; border-radius: 5px; cursor: pointer;">
                Show All ${fieldCount} Fields
            </button>

            <!-- All Fields Container (hidden by default) -->
            <div id="fields-${file.id}" style=`display: none; margin-top: 15px; 
                                                padding: 15px; background: rgba(0,0,0,0.3); 
                                                border-radius: 8px; max-height: 300px; overflow-y: auto;`>
                ${Object.entries(file)
                    .map(
                        ([key, value]) => `
                    <div style="margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                        <strong style="color: #667eea;`>${key}:</strong> 
                        <span>${value || '--'}</span>
                    </div>
                ')
                    .join('`)}
            </div>
        </div>
    `;
}

function toggleAllFields(fileId) {
    const fieldsDiv = document.getElementById(`fields-${fileId}`);
    if (fieldsDiv) {
        fieldsDiv.style.display = fieldsDiv.style.display === 'none' ? 'block' : 'none`;
    }
}

// Make functions globally available
window.showEnhancedView = showEnhancedView;
window.toggleAllFields = toggleAllFields;
