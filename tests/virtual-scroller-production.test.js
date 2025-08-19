/**
 * Unit tests for Virtual Scroller Production
 */

describe('VirtualScroller Production', () => {
    let container;
    let scroller;
    let mockItems;
    
    beforeEach(() => {
        // Set up DOM
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.id = 'content';
        container.style.height = '500px';
        container.style.width = '800px';
        document.body.appendChild(container);
        
        // Create mock items
        mockItems = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            title: `Track ${i}`,
            artist: `Artist ${i}`,
            album: `Album ${i}`,
            genre: `Genre ${i % 10}`
        }));
        
        // Mock logging functions
        global.logInfo = jest.fn();
        global.logDebug = jest.fn();
        global.logWarn = jest.fn();
        global.logError = jest.fn();
    });
    
    afterEach(() => {
        if (scroller && typeof scroller.destroy === 'function') {
            scroller.destroy();
        }
        document.body.innerHTML = '';
    });
    
    describe('Initialization', () => {
        test('should create VirtualScroller class', () => {
            require('../js/virtual-scroller-production');
            expect(window.VirtualScroller).toBeDefined();
        });
        
        test('should initialize with default options', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems
            });
            
            expect(scroller.items.length).toBe(1000);
            expect(scroller.itemHeight).toBe(280); // Default card height
            expect(scroller.buffer).toBe(5); // Default buffer
            expect(scroller.viewType).toBe('cards'); // Default view
        });
        
        test('should calculate dimensions correctly', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems,
                itemHeight: 100
            });
            
            expect(scroller.viewportHeight).toBe(500);
            expect(scroller.containerWidth).toBe(800);
        });
    });
    
    describe('Rendering', () => {
        test('should render only visible items', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems,
                itemHeight: 100
            });
            
            // With 500px height and 100px item height, should render ~5 items + buffer
            const renderedCount = container.querySelectorAll('.virtual-item').length;
            expect(renderedCount).toBeLessThan(20); // Much less than 1000
            expect(renderedCount).toBeGreaterThan(0);
        });
        
        test('should update visible range on scroll', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems,
                itemHeight: 100
            });
            
            const initialStart = scroller.visibleStart;
            const initialEnd = scroller.visibleEnd;
            
            // Simulate scroll
            container.scrollTop = 500;
            scroller.calculateVisibleRange();
            
            expect(scroller.visibleStart).toBeGreaterThan(initialStart);
            expect(scroller.visibleEnd).toBeGreaterThan(initialEnd);
        });
    });
    
    describe('View Switching', () => {
        test('should switch between view types', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems,
                viewType: 'cards'
            });
            
            expect(scroller.viewType).toBe('cards');
            
            scroller.changeView('table');
            expect(scroller.viewType).toBe('table');
            expect(scroller.itemHeight).toBe(50); // Table row height
            
            scroller.changeView('compact');
            expect(scroller.viewType).toBe('compact');
            expect(scroller.itemHeight).toBe(35); // Compact row height
        });
    });
    
    describe('Item Management', () => {
        test('should update items', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems
            });
            
            const newItems = mockItems.slice(0, 500);
            scroller.updateItems(newItems);
            
            expect(scroller.items.length).toBe(500);
        });
        
        test('should scroll to specific item', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems,
                itemHeight: 100
            });
            
            const scrollToSpy = jest.spyOn(container, 'scrollTo');
            scroller.scrollToItem(10);
            
            expect(scrollToSpy).toHaveBeenCalled();
        });
    });
    
    describe('Performance', () => {
        test('should handle large datasets efficiently', () => {
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                title: `Track ${i}`
            }));
            
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: largeDataset
            });
            
            // Should render only visible items, not all 10000
            const renderedCount = container.querySelectorAll('.virtual-item').length;
            expect(renderedCount).toBeLessThan(50);
            
            // Check memory reduction calculation
            const memoryReduction = Math.round((1 - renderedCount / 10000) * 100);
            expect(memoryReduction).toBeGreaterThan(99);
        });
        
        test('should emit statistics events', (done) => {
            require('../js/virtual-scroller-production');
            
            container.addEventListener('virtual-scroll-stats', (event) => {
                expect(event.detail).toHaveProperty('totalItems');
                expect(event.detail).toHaveProperty('renderedItems');
                expect(event.detail).toHaveProperty('visibleRange');
                expect(event.detail).toHaveProperty('memoryReduction');
                done();
            });
            
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems
            });
        });
    });
    
    describe('Cleanup', () => {
        test('should clean up properly on destroy', () => {
            require('../js/virtual-scroller-production');
            scroller = new window.VirtualScroller({
                container: container,
                items: mockItems
            });
            
            const initialHTML = container.innerHTML;
            expect(initialHTML).not.toBe('');
            
            scroller.destroy();
            
            expect(container.innerHTML).toBe('');
            expect(scroller.renderedItems.size).toBe(0);
        });
    });
});