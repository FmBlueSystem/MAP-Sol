// Playlist Folders UI - Organize playlists in folders with drag & drop
class PlaylistFoldersUI {
    constructor() {
        this.folders = [];
        this.playlists = [];
        this.expandedFolders = new Set();
        this.selectedItem = null;
        this.draggedItem = null;
        this.contextMenu = null;

        this.init();
    }

    async init() {
        await this.loadData();
        this.createUI();
        this.setupEventListeners();
        this.render();
    }

    async loadData() {
        if (!window.electronAPI) {
            return;
        }

        try {
            // Get all playlists including folders
            const result = await window.electronAPI.invoke('get-playlists');

            // Separate folders and playlists
            this.folders = result.filter(p => p.is_folder);
            this.playlists = result.filter(p => !p.is_folder);
        } catch (error) {
            console.error('Failed to load playlists:', error);
        }
    }

    createUI() {
        // Create main container
        const container = document.createElement('div');
        container.id = 'playlist-folders-container';
        container.className = 'playlist-folders-container';
        container.style.cssText = `
            position: fixed;
            left: 20px;
            top: 160px;
            width: 300px;
            height: calc(100vh - 280px);
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            display: none;
            z-index: 500;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        container.innerHTML = `
            <div class="folders-header" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #333; display: flex; align-items: center; justify-content: space-between;">
                    <span>📁 Playlists</span>
                    <button id="folders-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
                </h3>
                <div class="folders-actions" style="display: flex; gap: 8px; margin-bottom: 15px;">
                    <button id="new-folder-btn" style="
                        flex: 1;
                        padding: 8px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 13px;
                        cursor: pointer;
                    ">📁 New Folder</button>
                    <button id="new-playlist-btn" style="
                        flex: 1;
                        padding: 8px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 13px;
                        cursor: pointer;
                    ">➕ New Playlist</button>
                </div>
                <div class="folders-search" style="position: relative;">
                    <input type="text" id="folders-search-input" placeholder="Search playlists..." style="
                        width: 100%;
                        padding: 8px 12px 8px 32px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                    ">
                    <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #999;">🔍</span>
                </div>
            </div>

            <div class="folders-tree" id="folders-tree" style="
                flex: 1;
                overflow-y: auto;
                padding-right: 5px;
            ">
                <!-- Tree will be rendered here -->
            </div>

            <div class="folders-footer" style="
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #e0e0e0;
                font-size: 12px;
                color: #666;
            ">
                <div>Total: <span id="total-playlists">0</span> playlists in <span id="total-folders">0</span> folders</div>
                <div style="margin-top: 5px;">💡 Drag & drop to organize</div>
            </div>
        ";

        document.body.appendChild(container);

        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'folders-toggle-btn';
        toggleBtn.style.cssText = `
            position: fixed;
            left: 70px;
            top: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #FDB813 0%, #FFAA00 100%);
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 999;
            transition: all 0.3s;
        `;
        toggleBtn.innerHTML = '📁';
        toggleBtn.title = 'Playlist Folders';

        document.body.appendChild(toggleBtn);

        // Create context menu
        this.createContextMenu();

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .folders-tree {
                scrollbar-width: thin;
                scrollbar-color: #667eea20 transparent;
            }

            .folders-tree::-webkit-scrollbar {
                width: 6px;
            }

            .folders-tree::-webkit-scrollbar-track {
                background: transparent;
            }

            .folders-tree::-webkit-scrollbar-thumb {
                background: #667eea20;
                border-radius: 3px;
            }

            .folder-item, .playlist-item {
                padding: 8px 12px;
                margin: 2px 0;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                user-select: none;
            }

            .folder-item:hover, .playlist-item:hover {
                background: rgba(102, 126, 234, 0.1);
            }

            .folder-item.selected, .playlist-item.selected {
                background: rgba(102, 126, 234, 0.2);
                border: 1px solid #667eea;
            }

            .folder-item.expanded .folder-icon {
                transform: rotate(90deg);
            }

            .folder-children {
                margin-left: 20px;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .folder-children.collapsed {
                max-height: 0;
            }

            .drag-over {
                background: rgba(102, 126, 234, 0.3) !important;
                border: 2px dashed #667eea !important;
            }

            .dragging {
                opacity: 0.5;
            }

            #folders-toggle-btn:hover {
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }

    createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'playlist-context-menu';
        menu.style.cssText = `
            position: fixed;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            padding: 8px 0;
            display: none;
            z-index: 1000;
            min-width: 180px;
        `;

        menu.innerHTML = `
            <div class="menu-item" data-action="play" style="padding: 8px 16px; cursor: pointer; font-size: 14px;">
                ▶️ Play
            </div>
            <div class="menu-item" data-action="rename" style="padding: 8px 16px; cursor: pointer; font-size: 14px;">
                ✏️ Rename
            </div>
            <div class="menu-item" data-action="duplicate" style="padding: 8px 16px; cursor: pointer; font-size: 14px;">
                📋 Duplicate
            </div>
            <div class="menu-item" data-action="color" style="padding: 8px 16px; cursor: pointer; font-size: 14px;">
                🎨 Change Color
            </div>
            <hr style="margin: 4px 0; border: none; border-top: 1px solid #e0e0e0;">
            <div class="menu-item" data-action="delete" style="padding: 8px 16px; cursor: pointer; font-size: 14px; color: #f44336;">
                🗑️ Delete
            </div>
        ";

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // Menu item hover effect
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f5f5f5';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });
        });
    }

    setupEventListeners() {
        // Toggle visibility
        const toggleBtn = document.getElementById('folders-toggle-btn');
        const container = document.getElementById('playlist-folders-container');
        const closeBtn = document.getElementById('folders-close-btn');

        toggleBtn?.addEventListener('click', () => {
            if (container.style.display === 'none' || !container.style.display) {
                container.style.display = 'flex';
                this.loadData().then(() => this.render());
            } else {
                container.style.display = 'none';
            }
        });

        closeBtn?.addEventListener('click', () => {
            container.style.display = 'none';
        });

        // New folder/playlist buttons
        document.getElementById('new-folder-btn')?.addEventListener('click', () => {
            this.createNewFolder();
        });

        document.getElementById('new-playlist-btn')?.addEventListener('click', () => {
            this.createNewPlaylist();
        });

        // Search
        document.getElementById('folders-search-input')?.addEventListener('input', e => {
            this.filterItems(e.target.value);
        });

        // Context menu actions
        this.contextMenu?.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action && this.selectedItem) {
                this.handleContextAction(action);
            }
            this.hideContextMenu();
        });

        // Hide context menu on click outside
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                container.style.display = container.style.display === 'none' ? 'flex' : 'none';
            }
        });
    }

    render() {
        const tree = document.getElementById('folders-tree');
        if (!tree) {
            return;
        }

        // Build tree structure
        const treeData = this.buildTreeStructure();

        // Render tree
        tree.innerHTML = this.renderTree(treeData);

        // Update stats
        document.getElementById('total-playlists').textContent = this.playlists.length;
        document.getElementById('total-folders').textContent = this.folders.length;

        // Setup tree interactions
        this.setupTreeInteractions();
    }

    buildTreeStructure() {
        // Create a map for quick lookup
        const itemMap = new Map();
        const rootItems = [];

        // Add all items to map
        [...this.folders, ...this.playlists].forEach(item => {
            itemMap.set(item.id, { ...item, children: [] });
        });

        // Build tree
        itemMap.forEach(item => {
            if (item.parent_id) {
                const parent = itemMap.get(item.parent_id);
                if (parent) {
                    parent.children.push(item);
                } else {
                    rootItems.push(item);
                }
            } else {
                rootItems.push(item);
            }
        });

        return rootItems;
    }

    renderTree(items, level = 0) {
        return items
            .map(item => {
                const isFolder = item.is_folder;
                const isExpanded = this.expandedFolders.has(item.id);
                const hasChildren = item.children && item.children.length > 0;

                const icon = isFolder ? (isExpanded ? '📂' : '📁') : '🎵';

                const itemHtml = `
                <div class="${isFolder ? 'folder-item' : 'playlist-item'} ${isExpanded ? 'expanded' : ''}"
                     data-id="${item.id}"
                     data-type="${isFolder ? 'folder' : 'playlist'}"
                     draggable="true"
                     style="margin-left: ${level * 20}px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${isFolder ? '<span class="folder-icon" style="transition: transform 0.2s;">▶</span>' : ''}
                        <span>${icon}</span>
                        <span style="flex: 1; font-size: 14px; color: #333;">${this.escapeHtml(item.name)}</span>
                        ${
                            !isFolder && item.total_tracks
                                ? `<span style="font-size: 11px; color: #999;">${item.total_tracks}</span>`
                                : ''
                        }
                    </div>
                </div>
            ';

                const childrenHtml =
                    hasChildren && isExpanded
                        ? `<div class="folder-children">
                    ${this.renderTree(item.children, level + 1)}
                </div>`
                        : '';

                return itemHtml + childrenHtml;
            })
            .join('');
    }

    setupTreeInteractions() {
        const tree = document.getElementById('folders-tree');
        if (!tree) {
            return;
        }

        // Click to select/expand
        tree.addEventListener('click', e => {
            const item = e.target.closest('.folder-item, .playlist-item');
            if (!item) {
                return;
            }

            // Clear previous selection
            tree.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

            // Select new item
            item.classList.add('selected');
            this.selectedItem = {
                id: parseInt(item.dataset.id),
                type: item.dataset.type
            };

            // Toggle folder expansion
            if (item.dataset.type === 'folder') {
                const id = parseInt(item.dataset.id);
                if (this.expandedFolders.has(id)) {
                    this.expandedFolders.delete(id);
                } else {
                    this.expandedFolders.add(id);
                }
                this.render();
            }
        });

        // Right-click for context menu
        tree.addEventListener('contextmenu', e => {
            e.preventDefault();
            const item = e.target.closest('.folder-item, .playlist-item');
            if (!item) {
                return;
            }

            this.selectedItem = {
                id: parseInt(item.dataset.id),
                type: item.dataset.type
            };

            this.showContextMenu(e.pageX, e.pageY);
        });

        // Drag and drop
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const tree = document.getElementById('folders-tree');
        if (!tree) {
            return;
        }

        tree.addEventListener('dragstart', e => {
            const item = e.target.closest('.folder-item, .playlist-item');
            if (!item) {
                return;
            }

            this.draggedItem = {
                id: parseInt(item.dataset.id),
                type: item.dataset.type
            };

            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        tree.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const item = e.target.closest('.folder-item, .playlist-item');
            if (item && item.dataset.type === 'folder') {
                item.classList.add('drag-over');
            }
        });

        tree.addEventListener('dragleave', e => {
            const item = e.target.closest('.folder-item, .playlist-item');
            if (item) {
                item.classList.remove('drag-over');
            }
        });

        tree.addEventListener('drop', async e => {
            e.preventDefault();

            const targetItem = e.target.closest('.folder-item');
            if (!targetItem || !this.draggedItem) {
                return;
            }

            const targetId = parseInt(targetItem.dataset.id);

            // Don't drop on itself
            if (targetId === this.draggedItem.id) {
                return;
            }

            // Move item to new parent
            await this.moveItem(this.draggedItem.id, targetId);

            // Clean up
            tree.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            tree.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

            this.draggedItem = null;

            // Reload and render
            await this.loadData();
            this.render();
        });

        tree.addEventListener('dragend', () => {
            // Clean up
            tree.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            tree.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
            this.draggedItem = null;
        });
    }

    async moveItem(itemId, newParentId) {
        if (!window.electronAPI) {
            return;
        }

        try {
            await window.electronAPI.invoke('update-playlist', itemId, {
                parent_id: newParentId
            });

            this.showNotification('Item moved successfully', 'success');
        } catch (error) {
            console.error('Failed to move item:', error);
            this.showNotification('Failed to move item', 'error');
        }
    }

    async createNewFolder() {
        const name = prompt('Enter folder name:');
        if (!name) {
            return;
        }

        if (!window.electronAPI) {
            return;
        }

        try {
            await window.electronAPI.invoke('create-playlist', {
                name,
                is_folder: true,
                color: '#FDB813'
            });

            this.showNotification('Folder created', 'success');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Failed to create folder:', error);
            this.showNotification('Failed to create folder', 'error');
        }
    }

    async createNewPlaylist() {
        const name = prompt('Enter playlist name:');
        if (!name) {
            return;
        }

        if (!window.electronAPI) {
            return;
        }

        try {
            const parentId = this.selectedItem?.type === 'folder' ? this.selectedItem.id : null;

            await window.electronAPI.invoke('create-playlist', {
                name,
                parent_id: parentId,
                color: this.generateRandomColor()
            });

            this.showNotification('Playlist created', 'success');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Failed to create playlist:', error);
            this.showNotification('Failed to create playlist', 'error');
        }
    }

    showContextMenu(x, y) {
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.style.display = 'block';
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
    }

    async handleContextAction(action) {
        if (!this.selectedItem || !window.electronAPI) {
            return;
        }

        switch (action) {
            case 'play':
                if (this.selectedItem.type === 'playlist') {
                    await window.electronAPI.invoke('play-playlist', this.selectedItem.id);
                }
                break;

            case 'rename':
                const newName = prompt('Enter new name:');
                if (newName) {
                    await window.electronAPI.invoke('update-playlist', this.selectedItem.id, {
                        name: newName
                    });
                    await this.loadData();
                    this.render();
                }
                break;

            case 'duplicate':
                await window.electronAPI.invoke('duplicate-playlist', this.selectedItem.id);
                await this.loadData();
                this.render();
                break;

            case 'color':
                // Could implement color picker here
                const color = prompt('Enter color (hex):');
                if (color) {
                    await window.electronAPI.invoke('update-playlist', this.selectedItem.id, {
                        color
                    });
                    await this.loadData();
                    this.render();
                }
                break;

            case 'delete':
                if (confirm('Are you sure you want to delete this item?')) {
                    await window.electronAPI.invoke('delete-playlist', this.selectedItem.id);
                    await this.loadData();
                    this.render();
                }
                break;
        }
    }

    filterItems(query) {
        const tree = document.getElementById('folders-tree');
        if (!tree) {
            return;
        }

        const items = tree.querySelectorAll('.folder-item, .playlist-item');

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(query.toLowerCase())) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    generateRandomColor() {
        const colors = [
            '#667eea',
            '#764ba2',
            '#f093fb',
            '#fda085',
            '#84fab0',
            '#8fd3f4',
            '#a8edea',
            '#fed6e3',
            '#ffeaa7',
            '#fd79a8',
            '#fdcb6e',
            '#6c5ce7'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
        }
    }
}

// Initialize playlist folders UI
window.playlistFoldersUI = new PlaylistFoldersUI();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistFoldersUI;
}
