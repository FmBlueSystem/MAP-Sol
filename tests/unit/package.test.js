describe('Package.json', () => {
    const pkg = require('../package.json');

    test('should have required fields', () => {
        expect(pkg.name).toBeDefined();
        expect(pkg.version).toBeDefined();
        expect(pkg.main).toBeDefined();
    });

    test('should have test script', () => {
        expect(pkg.scripts.test).toBeDefined();
    });
});
