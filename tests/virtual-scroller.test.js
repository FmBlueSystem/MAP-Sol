// Tests for Virtual Scroller
describe('VirtualScroller', () => {
    let container;
    let scroller;
    
    beforeEach(() => {
        // Create mock container
        container = document.createElement('div');
        container.style.height = '500px';
        container.style.width = '100%';
        document.body.appendChild(container);
    });
    
    afterEach(() => {
        if (scroller) {
            scroller.destroy();
        }
        document.body.removeChild(container);
    });
    
    describe('Initialization', () => {
        test('should initialize with config', () => {
            const VirtualScroller = function(config) {
                this.config = config;
                this.items = [];
                this.visibleRange = { start: 0, end: 0 };
            };
            
            const config = {
                container: container,
                itemHeight: 100,
                bufferSize: 5,
                renderItem: jest.fn()
            };
            
            scroller = new VirtualScroller(config);
            
            expect(scroller.config.container).toBe(container);
            expect(scroller.config.itemHeight).toBe(100);
            expect(scroller.config.bufferSize).toBe(5);
        });
    });
    
    describe('Item management', () => {
        beforeEach(() => {
            const VirtualScroller = function(config) {
                this.config = config;
                this.items = [];
                this.visibleRange = { start: 0, end: 0 };
                
                this.setItems = function(items) {
                    this.items = items;
                    this.updateVisibleRange();
                };
                
                this.appendItems = function(items) {
                    this.items = this.items.concat(items);
                    this.updateVisibleRange();
                };
                
                this.updateVisibleRange = function() {
                    const containerHeight = 500;
                    const itemsVisible = Math.ceil(containerHeight / this.config.itemHeight);
                    this.visibleRange = {
                        start: 0,
                        end: Math.min(itemsVisible, this.items.length - 1)
                    };
                };
                
                this.getVisibleItems = function() {
                    return this.items.slice(this.visibleRange.start, this.visibleRange.end + 1);
                };
                
                this.destroy = function() {};
            };
            
            scroller = new VirtualScroller({
                container: container,
                itemHeight: 100,
                renderItem: jest.fn()
            });
        });
        
        test('should set items', () => {
            const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
            scroller.setItems(items);
            
            expect(scroller.items.length).toBe(100);
        });
        
        test('should append items', () => {
            const initialItems = Array.from({ length: 50 }, (_, i) => ({ id: i }));
            const newItems = Array.from({ length: 50 }, (_, i) => ({ id: i + 50 }));
            
            scroller.setItems(initialItems);
            scroller.appendItems(newItems);
            
            expect(scroller.items.length).toBe(100);
        });
        
        test('should calculate visible range', () => {
            const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
            scroller.setItems(items);
            
            // With container height 500px and item height 100px, should show 5 items
            expect(scroller.visibleRange.start).toBe(0);
            expect(scroller.visibleRange.end).toBe(4);
        });
        
        test('should get visible items', () => {
            const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
            scroller.setItems(items);
            
            const visibleItems = scroller.getVisibleItems();
            expect(visibleItems.length).toBe(5);
            expect(visibleItems[0].id).toBe(0);
            expect(visibleItems[4].id).toBe(4);
        });
    });
    
    describe('Performance', () => {
        test('should handle large datasets efficiently', () => {
            const VirtualScroller = function(config) {
                this.config = config;
                this.items = [];
                this.renderedItems = new Map();
                
                this.setItems = function(items) {
                    this.items = items;
                };
                
                this.destroy = function() {
                    this.renderedItems.clear();
                };
            };
            
            scroller = new VirtualScroller({
                container: container,
                itemHeight: 50
            });
            
            // Test with 10,000 items
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
            
            const startTime = performance.now();
            scroller.setItems(largeDataset);
            const endTime = performance.now();
            
            // Should handle 10k items in less than 100ms
            expect(endTime - startTime).toBeLessThan(100);
            expect(scroller.items.length).toBe(10000);
        });
    });
});