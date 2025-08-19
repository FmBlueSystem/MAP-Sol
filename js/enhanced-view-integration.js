/**
 * ENHANCED VIEW INTEGRATION
 * Integrates the enhanced metadata card with existing views
 */

// Button is now added directly in HTML, no need to create it dynamically

// Show enhanced view
function showEnhancedView() {
    const container = document.getElementById('filesContainer');
    if (!container) {
        return;
    }

    // Get current files data
    const files = window.currentFiles || [];

    if (files.length === 0) {
        container.innerHTML =
            '<div class="no-data">No files loaded. Please analyze some music first.</div>';
        return;
    }

    // Clear container
    container.innerHTML = '';
    container.className = 'enhanced-view-container';

    // Create enhanced cards for each file
    files.forEach(file => {
        const cardHTML = window.metadataCard.createEnhancedCard(file);
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('enhancedViewBtn').classList.add('active');

    // Save preference
    localStorage.setItem('preferredView', 'enhanced');
}

// Override the displayFiles function to support enhanced view
const originalDisplayFiles = window.displayFiles;
window.displayFiles = function (files, viewType) {
    // Store files globally for enhanced view
    window.currentFiles = files;

    // Check if enhanced view is preferred
    const preferredView = localStorage.getItem('preferredView');
    if (preferredView === 'enhanced' && !viewType) {
        showEnhancedView();
        return;
    }

    // Otherwise use original display
    if (originalDisplayFiles) {
        originalDisplayFiles(files, viewType);
    }
};

// Make showEnhancedView globally available
window.showEnhancedView = showEnhancedView;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Setup view button handlers
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        if (btn.dataset.view === 'enhanced') {
            btn.addEventListener('click', e => {
                e.preventDefault();
                showEnhancedView();
            });
        }
    });

    // If we have files and enhanced view is preferred, show it
    setTimeout(() => {
        if (window.currentFiles && window.currentFiles.length > 0) {
            const preferredView = localStorage.getItem('preferredView');
            if (preferredView === 'enhanced') {
                showEnhancedView();
            }
        }
    }, 1000);
});

// Add styles for enhanced view container
const enhancedStyles = `
<style>
.enhanced-view-container {
    padding: 20px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
    gap: 30px;
}

.no-data {
    text-align: center;
    padding: 60px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
}

@media (max-width: 768px) {
    .enhanced-view-container {
        grid-template-columns: 1fr;
    }
}
</style>
`;
document.head.insertAdjacentHTML('beforeend', enhancedStyles);
