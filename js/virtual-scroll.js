// TASK_020: Virtual Scrolling - Quick & Dirty pero funcional
class VirtualScroll {
    constructor(container, itemHeight = 120, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.items = [];
        this.visibleStart = 0;
        this.visibleEnd = 50;
        this.scrollTop = 0;
        
        this.init();
    }
    
    init() {
        // Crear estructura
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.style.height = '100%';
        this.scrollContainer.style.overflow = 'auto';
        this.scrollContainer.style.position = 'relative';
        
        this.contentContainer = document.createElement('div');
        this.contentContainer.style.position = 'relative';
        
        this.scrollContainer.appendChild(this.contentContainer);
        this.container.innerHTML = '';
        this.container.appendChild(this.scrollContainer);
        
        // Event listener
        this.scrollContainer.addEventListener('scroll', () => this.handleScroll());
    }
    
    setItems(items) {
        this.items = items;
        this.contentContainer.style.height = `${items.length * this.itemHeight}px`;
        this.render();
    }
    
    handleScroll() {
        this.scrollTop = this.scrollContainer.scrollTop;
        const newStart = Math.floor(this.scrollTop / this.itemHeight);
        const newEnd = Math.min(newStart + Math.ceil(this.scrollContainer.clientHeight / this.itemHeight) + 10, this.items.length);
        
        if (newStart !== this.visibleStart || newEnd !== this.visibleEnd) {
            this.visibleStart = Math.max(0, newStart - 5); // Buffer
            this.visibleEnd = Math.min(newEnd + 5, this.items.length);
            this.render();
        }
    }
    
    render() {
        // Clear and render only visible
        this.contentContainer.innerHTML = '';
        
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const item = this.items[i];
            const element = this.renderItem(item, i);
            element.style.position = 'absolute';
            element.style.top = `${i * this.itemHeight}px`;
            element.style.width = '100%';
            element.style.height = `${this.itemHeight}px`;
            this.contentContainer.appendChild(element);
        }
    }
    
    scrollToIndex(index) {
        this.scrollContainer.scrollTop = index * this.itemHeight;
    }
    
    refresh() {
        this.render();
    }
}

// Export para uso global
window.VirtualScroll = VirtualScroll;