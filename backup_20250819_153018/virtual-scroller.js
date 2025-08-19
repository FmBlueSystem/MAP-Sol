/**
 * 🚀 VIRTUAL SCROLLER
 * High-performance scrolling for 10,000+ items
 */

class VirtualScroller {
    constructor(config) {
        this.config = {
            container: config.container,
            itemHeight: config.itemHeight || 100,
            bufferSize: config.bufferSize || 5,
            renderItem: config.renderItem,
            loadMore: config.loadMore || null,
            debug: config.debug || false
        };

        this.items = [];
        this.visibleRange = { start: 0, end: 0 };
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        this.rafId = null;
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.renderedItems = new Map();
        this.itemPool = [];
        this.poolSize = 50;

        this.init();
    }

    init() {
        this.setupContainer();
        this.createItemPool();
        this.attachEventListeners();
        this.measure();
        this.render();
    }

    setupContainer() {
        this.container =
            typeof this.config.container === 'string'
                ? document.querySelector(this.config.container)
                : this.config.container;

        if (!this.container) {
            throw new Error('Virtual Scroller: Container not found');
        }

        // Setup scroll container
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-scroll-container';
        this.scrollContainer.style.cssText = `
            position: relative;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
        `;

        // Setup viewport
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.cssText = `
            position: relative;
            width: 100%;
            will-change: transform;
        `;

        // Setup spacer
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroll-spacer';
        this.spacer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 1px;
            pointer-events: none;
            visibility: hidden;
        `;

        // Assemble structure
        this.scrollContainer.appendChild(this.spacer);
        this.scrollContainer.appendChild(this.viewport);
        this.container.appendChild(this.scrollContainer);
    }

    createItemPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const item = document.createElement('div');
            item.className = 'virtual-scroll-item';
            item.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                contain: layout style paint;
            `;
            this.itemPool.push(item);
        }
    }

    attachEventListeners() {
        // Optimized scroll handler
        this.scrollHandler = this.throttle(() => {
            this.handleScroll();
        }, 16); // 60fps

        this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

        // Resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.container);
        } else {
            window.addEventListener(
                'resize',
                this.throttle(() => {
                    this.handleResize();
                }, 200)
            );
        }

        // Intersection observer for lazy loading
        if (window.IntersectionObserver && this.config.loadMore) {
            this.setupIntersectionObserver();
        }
    }

    setupIntersectionObserver() {
        const sentinel = document.createElement('div');
        sentinel.className = 'virtual-scroll-sentinel';
        sentinel.style.height = '1px';
        this.scrollContainer.appendChild(sentinel);

        this.intersectionObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && this.config.loadMore) {
                        this.config.loadMore();
                    }
                });
            },
            { root: this.scrollContainer, rootMargin: '100px' }
        );

        this.intersectionObserver.observe(sentinel);
    }

    measure() {
        const rect = this.scrollContainer.getBoundingClientRect();
        this.containerHeight = rect.height;
        this.updateTotalHeight();
    }

    updateTotalHeight() {
        this.totalHeight = this.items.length * this.config.itemHeight;
        this.spacer.style.height = `${this.totalHeight}px`;
    }

    handleScroll() {
        this.scrollTop = this.scrollContainer.scrollTop;

        if (!this.isScrolling) {
            this.isScrolling = true;
            this.viewport.style.willChange = 'transform';
        }

        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
            this.viewport.style.willChange = 'auto';
        }, 150);

        this.scheduleRender();
    }

    handleResize() {
        this.measure();
        this.render();
    }

    scheduleRender() {
        if (this.rafId) {
            return;
        }

        this.rafId = requestAnimationFrame(() => {
            this.render();
            this.rafId = null;
        });
    }

    calculateVisibleRange() {
        const scrollTop = this.scrollTop;
        const start = Math.floor(scrollTop / this.config.itemHeight);
        const end = Math.ceil((scrollTop + this.containerHeight) / this.config.itemHeight);

        // Add buffer
        const bufferStart = Math.max(0, start - this.config.bufferSize);
        const bufferEnd = Math.min(this.items.length - 1, end + this.config.bufferSize);

        return {
            start: bufferStart,
            end: bufferEnd,
            visibleStart: start,
            visibleEnd: end
        };
    }

    render() {
        const range = this.calculateVisibleRange();

        if (this.config.debug) {
        }

        // Clear items outside range
        this.renderedItems.forEach((element, index) => {
            if (index < range.start || index > range.end) {
                this.recycleItem(element);
                this.renderedItems.delete(index);
            }
        });

        // Render visible items
        for (let i = range.start; i <= range.end && i < this.items.length; i++) {
            if (!this.renderedItems.has(i)) {
                this.renderItemAtIndex(i);
            }
        }

        // Update viewport transform for smooth scrolling
        const offsetY = range.start * this.config.itemHeight;
        this.viewport.style.transform = `translateY(${offsetY}px)`;

        this.visibleRange = range;

        // Emit event
        this.emitEvent('render', {
            start: range.visibleStart,
            end: range.visibleEnd,
            total: this.items.length
        });
    }

    renderItemAtIndex(index) {
        const item = this.items[index];
        if (!item) {
            return;
        }

        const element = this.getItemElement();
        const top =
            index * this.config.itemHeight - this.visibleRange.start * this.config.itemHeight;

        element.style.transform = `translateY(${top}px)`;
        element.style.height = `${this.config.itemHeight}px`;
        element.dataset.index = index;

        // Render content
        if (this.config.renderItem) {
            const content = this.config.renderItem(item, index);
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else if (content instanceof Element) {
                element.innerHTML = '';
                element.appendChild(content);
            }
        }

        this.viewport.appendChild(element);
        this.renderedItems.set(index, element);

        // Animate entrance
        requestAnimationFrame(() => {
            element.classList.add('virtual-item-enter');
        });
    }

    getItemElement() {
        return this.itemPool.pop() || this.createItemElement();
    }

    createItemElement() {
        const item = document.createElement('div');
        item.className = 'virtual-scroll-item';
        item.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            contain: layout style paint;
        `;
        return item;
    }

    recycleItem(element) {
        element.classList.remove('virtual-item-enter');
        element.innerHTML = '';

        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }

        if (this.itemPool.length < this.poolSize) {
            this.itemPool.push(element);
        }
    }

    /**
     * PUBLIC API
     */
    setItems(items) {
        this.items = items;
        this.updateTotalHeight();
        this.render();
    }

    appendItems(items) {
        this.items = this.items.concat(items);
        this.updateTotalHeight();
        this.render();
    }

    updateItem(index, item) {
        if (index >= 0 && index < this.items.length) {
            this.items[index] = item;

            if (this.renderedItems.has(index)) {
                this.renderItemAtIndex(index);
            }
        }
    }

    removeItem(index) {
        if (index >= 0 && index < this.items.length) {
            this.items.splice(index, 1);
            this.updateTotalHeight();
            this.render();
        }
    }

    scrollToIndex(index, behavior = 'smooth') {
        const top = index * this.config.itemHeight;
        this.scrollContainer.scrollTo({
            top,
            behavior
        });
    }

    scrollToTop(behavior = 'smooth') {
        this.scrollToIndex(0, behavior);
    }

    scrollToBottom(behavior = 'smooth') {
        this.scrollToIndex(this.items.length - 1, behavior);
    }

    getVisibleItems() {
        const items = [];
        for (
            let i = this.visibleRange.visibleStart;
            i <= this.visibleRange.visibleEnd && i < this.items.length;
            i++
        ) {
            items.push(this.items[i]);
        }
        return items;
    }

    refresh() {
        this.measure();
        this.render();
    }

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        this.scrollContainer.removeEventListener('scroll', this.scrollHandler);

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }

        this.renderedItems.clear();
        this.itemPool = [];
        this.container.innerHTML = '';
    }

    /**
     * UTILITIES
     */
    throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    emitEvent(name, detail) {
        const event = new CustomEvent(`virtual-scroll-${name}`, { detail });
        this.container.dispatchEvent(event);
    }
}

// Add default styles
const style = document.createElement('style');
style.textContent = `
    .virtual-scroll-container {
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
    }

    .virtual-scroll-container::-webkit-scrollbar {
        width: 8px;
    }

    .virtual-scroll-container::-webkit-scrollbar-track {
        background: transparent;
    }

    .virtual-scroll-container::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
    }

    .virtual-scroll-container::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.5);
    }

    .virtual-scroll-item {
        transition: opacity 0.2s ease;
        opacity: 0;
    }

    .virtual-scroll-item.virtual-item-enter {
        opacity: 1;
    }
`;
document.head.appendChild(style);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualScroller;
}
