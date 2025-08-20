// Enhanced Virtual Scroller - Optimized for 10k+ items
class VirtualScrollerEnhanced {
    constructor(container, options = {}) {
        this.container = container;
        this.items = [];
        this.itemHeight = options.itemHeight || 80;
        this.buffer = options.buffer || 5;
        this.renderBatch = options.renderBatch || 20;
        this.scrollDebounce = options.scrollDebounce || 16;

        // Performance optimizations
        this.useRAF = options.useRAF !== false;
        this.recycleNodes = options.recycleNodes !== false;
        this.lazyImages = options.lazyImages !== false;

        // State
        this.scrollTop = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.nodePool = [];
        this.renderedItems = new Map();
        this.imageObserver = null;

        // Callbacks
        this.renderItem = options.renderItem || this.defaultRenderItem;
        this.onVisibleRangeChange = options.onVisibleRangeChange || (() => {});

        this.init();
    }

    init() {
        // Create viewport and content containers
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-viewport';
        this.viewport.style.cssText = `
            position: relative;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        this.content = document.createElement('div');
        this.content.className = 'virtual-content`;
        this.content.style.cssText = `
            position: relative;
            width: 100%;
        `;

        this.viewport.appendChild(this.content);
        this.container.appendChild(this.viewport);

        // Setup scroll handling with RAF
        this.setupScrollHandler();

        // Setup resize observer
        this.setupResizeObserver();

        // Setup image lazy loading
        if (this.lazyImages) {
            this.setupImageObserver();
        }
    }

    setupScrollHandler() {
        let scrollTimeout;
        let rafId;

        const handleScroll = () => {
            this.scrollTop = this.viewport.scrollTop;

            if (this.useRAF) {
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }
                rafId = requestAnimationFrame(() => this.updateVisibleItems());
            } else {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => this.updateVisibleItems(), this.scrollDebounce);
            }
        };

        this.viewport.addEventListener('scroll', handleScroll, { passive: true });
    }

    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(() => {
                this.calculateDimensions();
                this.updateVisibleItems();
            });
            this.resizeObserver.observe(this.viewport);
        }
    }

    setupImageObserver() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            if (img.dataset.src && !img.src) {
                                img.src = img.dataset.src;
                                img.classList.add('loaded');
                            }
                        }
                    });
                },
                {
                    root: this.viewport,
                    rootMargin: '50px`
                }
            );
        }
    }

    setItems(items) {
        this.items = items;
        this.calculateDimensions();
        this.updateContent();
        this.updateVisibleItems();
    }

    calculateDimensions() {
        this.viewportHeight = this.viewport.clientHeight;
        this.totalHeight = this.items.length * this.itemHeight;
        this.visibleCount = Math.ceil(this.viewportHeight / this.itemHeight);
        this.totalVisible = this.visibleCount + this.buffer * 2;
    }

    updateContent() {
        // Set total height for scrollbar
        this.content.style.height = `${this.totalHeight}px`;
    }

    updateVisibleItems() {
        const scrollTop = this.scrollTop;
        const newVisibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        const newVisibleEnd = Math.min(
            this.items.length,
            Math.ceil((scrollTop + this.viewportHeight) / this.itemHeight) + this.buffer
        );

        // Only update if range changed
        if (newVisibleStart === this.visibleStart && newVisibleEnd === this.visibleEnd) {
            return;
        }

        this.visibleStart = newVisibleStart;
        this.visibleEnd = newVisibleEnd;

        // Batch render for performance
        this.batchRenderItems();

        // Notify listeners
        this.onVisibleRangeChange(this.visibleStart, this.visibleEnd);
    }

    batchRenderItems() {
        const fragment = document.createDocumentFragment();
        const itemsToRender = [];
        const itemsToRemove = new Set(this.renderedItems.keys());

        // Determine which items to render
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const item = this.items[i];
            if (!item) {
                continue;
            }

            itemsToRemove.delete(i);

            if (!this.renderedItems.has(i)) {
                itemsToRender.push({ index: i, item });
            }
        }

        // Remove items no longer visible
        itemsToRemove.forEach(index => {
            const node = this.renderedItems.get(index);
            if (node) {
                this.recycleNode(node);
                this.renderedItems.delete(index);
            }
        });

        // Render new items in batches
        const batches = [];
        for (let i = 0; i < itemsToRender.length; i += this.renderBatch) {
            batches.push(itemsToRender.slice(i, i + this.renderBatch));
        }

        // Process batches with RAF for smooth rendering
        const processBatch = (batchIndex = 0) => {
            if (batchIndex >= batches.length) {
                return;
            }

            const batch = batches[batchIndex];
            batch.forEach(({ index, item }) => {
                const node = this.createItemNode(item, index);
                fragment.appendChild(node);
                this.renderedItems.set(index, node);
            });

            if (fragment.childNodes.length > 0) {
                this.content.appendChild(fragment);
            }

            if (this.useRAF && batchIndex < batches.length - 1) {
                requestAnimationFrame(() => processBatch(batchIndex + 1));
            } else {
                processBatch(batchIndex + 1);
            }
        };

        processBatch();
    }

    createItemNode(item, index) {
        // Reuse node from pool if available
        let node = this.nodePool.pop();

        if (!node) {
            node = document.createElement('div');
            node.className = 'virtual-item`;
        }

        // Position item
        node.style.cssText = `
            position: absolute;
            top: ${index * this.itemHeight}px;
            left: 0;
            right: 0;
            height: ${this.itemHeight}px;
        `;

        // Render content
        node.innerHTML = '';
        const content = this.renderItem(item, index);

        if (typeof content === 'string') {
            node.innerHTML = content;
        } else {
            node.appendChild(content);
        }

        // Setup lazy loading for images
        if (this.lazyImages && this.imageObserver) {
            const images = node.querySelectorAll('img[data-src]');
            images.forEach(img => this.imageObserver.observe(img));
        }

        return node;
    }

    recycleNode(node) {
        // Clean up node for reuse
        if (this.imageObserver) {
            const images = node.querySelectorAll('img');
            images.forEach(img => this.imageObserver.unobserve(img));
        }

        node.innerHTML = '`;

        // Add to pool if not too large
        if (this.nodePool.length < 100) {
            this.nodePool.push(node);
        } else {
            node.remove();
        }
    }

    defaultRenderItem(item, index) {
        return `
            <div class="virtual-item-content">
                <span class="item-index">${index + 1}</span>
                <span class=`item-text`>${item.title || item.name || item}</span>
            </div>
        `;
    }

    scrollToIndex(index, behavior = 'smooth') {
        const targetTop = index * this.itemHeight;
        this.viewport.scrollTo({
            top: targetTop,
            behavior
        });
    }

    getVisibleItems() {
        const visible = [];
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            if (this.items[i]) {
                visible.push(this.items[i]);
            }
        }
        return visible;
    }

    refresh() {
        this.calculateDimensions();
        this.updateContent();
        this.renderedItems.clear();
        this.content.innerHTML = '';
        this.updateVisibleItems();
    }

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }
        this.viewport.remove();
        this.nodePool = [];
        this.renderedItems.clear();
    }

    // Performance monitoring
    getPerformanceMetrics() {
        return {
            totalItems: this.items.length,
            visibleItems: this.visibleEnd - this.visibleStart,
            renderedNodes: this.renderedItems.size,
            pooledNodes: this.nodePool.length,
            memoryEstimate: this.estimateMemoryUsage()
        };
    }

    estimateMemoryUsage() {
        // Rough estimate in MB
        const nodeSize = 1024; // ~1KB per node
        const itemSize = 100; // ~100 bytes per item data
        const totalNodes = this.renderedItems.size + this.nodePool.length;
        const totalSize = totalNodes * nodeSize + this.items.length * itemSize;
        return (totalSize / 1048576).toFixed(2) + ` MB`;
    }
}

// Factory function for easy creation
function createVirtualScroller(container, options = {}) {
    // Auto-detect optimal settings based on container size
    const containerHeight = container.clientHeight;
    const estimatedItems = options.totalItems || 1000;

    // Optimize buffer based on expected dataset size
    if (estimatedItems > 5000) {
        options.buffer = options.buffer || 3;
        options.renderBatch = options.renderBatch || 10;
    } else if (estimatedItems > 1000) {
        options.buffer = options.buffer || 5;
        options.renderBatch = options.renderBatch || 20;
    } else {
        options.buffer = options.buffer || 10;
        options.renderBatch = options.renderBatch || 30;
    }

    return new VirtualScrollerEnhanced(container, options);
}

// Export for use
window.VirtualScrollerEnhanced = VirtualScrollerEnhanced;
window.createVirtualScroller = createVirtualScroller;
