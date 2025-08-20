describe('Database Service', () => {
    test('database file should exist', () => {
        const fs = require('fs');
        const dbExists = fs.existsSync('music_analyzer.db');
        expect(dbExists).toBe(true);
    });
});
