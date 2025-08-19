/**
 * 🚀 VIRTUAL SCROLLER INTEGRATION
 * Integrates virtual scrolling with existing views for 6000+ tracks performance
 */

(function () {
    'use strict';

    let virtualScroller = null;
    let currentView = localStorage.getItem('selectedView') || 'cards';
    let allFiles = [];
    let isVirtualScrollingActive = false;
    const VIRTUAL_SCROLL_THRESHOLD = 500; // Activate virtual scrolling above this number

    // Initialize virtual scrolling when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        setupVirtualScrolling();
        interceptRenderFunctions();
    });

    /**
     * Setup virtual scrolling container
     */
    function setupVirtualScrolling() {
        // Check if we need virtual scrolling
        const fileCount = document.querySelectorAll('.file-card').length;

        if (fileCount > VIRTUAL_SCROLL_THRESHOLD) {
            activateVirtualScrolling();
        }
    }

    /**
     * Activate virtual scrolling
     */
    function activateVirtualScrolling() {
        isVirtualScrollingActive = true;

        // Get container based on current view
        const container =
            document.getElementById('files-container') || document.querySelector('.container');

        if (!container) {
            logError('❌ Container not found for virtual scrolling');
            return;
        }

        // Initialize virtual scroller based on view
        const itemHeight = getItemHeightForView(currentView);

        virtualScroller = new VirtualScroller({
            container: container,
            itemHeight: itemHeight,
            bufferSize: 10,
            renderItem: renderFileItem,
            loadMore: loadMoreFiles,
            debug: false
        });

        // Load initial data
        loadFilesData();
    }

    /**
     * Get item height based on view type
     */
    function getItemHeightForView(view) {
        switch (view) {
            case 'cards':
                return 280; // Card height including margin
            case 'table':
                return 50; // Table row height
            case 'compact':
                return 40; // Compact list item height
            default:
                return 100;
        }
    }

    /**
     * Render individual file item based on view
     */
    function renderFileItem(file, index) {
        if (currentView === 'cards') {
            return renderCardItem(file, index);
        } else if (currentView === 'table') {
            return renderTableRow(file, index);
        } else {
            return renderCompactItem(file, index);
        }
    }

    /**
     * Render card item
     */
    function renderCardItem(file, index) {
        const artworkUrl = file.artwork_path
            ? `/artwork-cache/${file.artwork_path}`
            : 'assets/default-album.png';

        return `
            <div class="file-card" data-index="${index}" data-file="${file.file_path}">
                <div class="card-image-container">
                    <img src="${artworkUrl}" 
                         alt="${file.title || file.file_name}"
                         loading="lazy"
                         onerror="this.src='assets/default-album.png'">
                    <button class="play-btn-overlay" onclick="playTrack('${file.file_path}')">
                        <span>▶️</span>
                    </button>
                </div>
                <div class="card-info">
                    <h3 class="track-title">${file.title || file.file_name}</h3>
                    <p class="track-artist">${file.artist || 'Unknown Artist'}</p>
                    <div class="card-footer">
                        <span class="track-genre">${file.LLM_GENRE || file.genre || ''}</span>
                        ${file.AI_BPM ? `<span class="track-bpm">${file.AI_BPM} BPM</span>` : ''}
                    </div>
                </div>
            </div>
        ';
    }

    /**
     * Render table row
     */
    function renderTableRow(file, index) {
        return `
            <tr class="file-row" data-index="${index}" data-file="${file.file_path}">
                <td>${index + 1}</td>
                <td class="clickable" onclick="playTrack('${file.file_path}')">
                    ${file.title || file.file_name}
                </td>
                <td>${file.artist || '-'}</td>
                <td>${file.album || '-'}</td>
                <td>${file.LLM_GENRE || file.genre || '-'}</td>
                <td>${file.AI_BPM || '-'}</td>
                <td>${file.AI_KEY || '-'}</td>
                <td>${file.AI_ENERGY ? (file.AI_ENERGY * 10).toFixed(1) : '-'}</td>
                <td>
                    <button class="action-btn" onclick="showContextMenu(event, '${file.file_path}')">⋮</button>
                </td>
            </tr>
        ";
    }

    /**
     * Render compact item
     */
    function renderCompactItem(file, index) {
        return `
            <div class="compact-item" data-index="${index}" data-file="${file.file_path}">
                <span class="compact-index">${index + 1}</span>
                <span class="compact-title clickable" onclick="playTrack('${file.file_path}')">
                    ${file.title || file.file_name}
                </span>
                <span class="compact-artist">${file.artist || '-'}</span>
                <span class="compact-duration">${file.duration || '0:00'}</span>
                <button class="action-btn" onclick="showContextMenu(event, '${file.file_path}')">⋮</button>
            </div>
        ";
    }

    /**
     * Load files data for virtual scroller
     */
    async function loadFilesData() {
        try {
            // Get files from IPC
            const files = await window.electronAPI.getFilesWithCachedArtwork();
            allFiles = files;

            // Set items in virtual scroller
            if (virtualScroller) {
                virtualScroller.setItems(files);
            }
        } catch (error) {
            logError('❌ Error loading files:', error);
        }
    }

    /**
     * Load more files (for infinite scrolling if needed)
     */
    function loadMoreFiles() {
        // This can be implemented if we want to load files in chunks
    }

    /**
     * Intercept and override render functions
     */
    function interceptRenderFunctions() {
        // Store original render functions
        const originalRenderCards = window.renderCardsView;
        const originalRenderTable = window.renderTableView;
        const originalRenderCompact = window.renderCompactView;

        // Override render functions
        window.renderCardsView = function (files) {
            if (files.length > VIRTUAL_SCROLL_THRESHOLD && !isVirtualScrollingActive) {
                currentView = 'cards';
                allFiles = files;
                activateVirtualScrolling();
            } else if (isVirtualScrollingActive) {
                currentView = 'cards';
                virtualScroller.setItems(files);
            } else {
                // Use original render for small datasets
                originalRenderCards && originalRenderCards(files);
            }
        };

        window.renderTableView = function (files) {
            if (files.length > VIRTUAL_SCROLL_THRESHOLD && !isVirtualScrollingActive) {
                currentView = 'table';
                allFiles = files;
                activateVirtualScrolling();
            } else if (isVirtualScrollingActive) {
                currentView = 'table';
                virtualScroller.config.itemHeight = getItemHeightForView('table');
                virtualScroller.setItems(files);
            } else {
                originalRenderTable && originalRenderTable(files);
            }
        };

        window.renderCompactView = function (files) {
            if (files.length > VIRTUAL_SCROLL_THRESHOLD && !isVirtualScrollingActive) {
                currentView = 'compact';
                allFiles = files;
                activateVirtualScrolling();
            } else if (isVirtualScrollingActive) {
                currentView = 'compact';
                virtualScroller.config.itemHeight = getItemHeightForView('compact');
                virtualScroller.setItems(files);
            } else {
                originalRenderCompact && originalRenderCompact(files);
            }
        };
    }

    /**
     * Handle view changes
     */
    window.addEventListener('view-changed', function (event) {
        const newView = event.detail.view;

        currentView = newView;

        if (isVirtualScrollingActive && virtualScroller) {
            // Update item height and re-render
            virtualScroller.config.itemHeight = getItemHeightForView(newView);
            virtualScroller.refresh();
        }
    });

    /**
     * Handle search/filter updates
     */
    window.addEventListener('files-filtered', function (event) {
        const filteredFiles = event.detail.files;

        if (isVirtualScrollingActive && virtualScroller) {
            virtualScroller.setItems(filteredFiles);
        }
    });

    /**
     * Performance monitoring
     */
    const performanceMonitor = setInterval(function () {
        if (isVirtualScrollingActive && virtualScroller) {
            const visibleItems = virtualScroller.getVisibleItems();
            const memory = performance.memory
                ? (performance.memory.usedJSHeapSize / 1048576).toFixed(2)
                : 'N/A';

            logDebug(`Memory: ${memory}MB`);
        }
    }, 30000); // Log every 30 seconds

    /**
     * Cleanup on page unload
     */
    window.addEventListener('beforeunload', function () {
        if (virtualScroller) {
            virtualScroller.destroy();
        }
        clearInterval(performanceMonitor);
    });
})();
