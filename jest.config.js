module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverage: true,
    collectCoverageFrom: [
        'js/**/*.js',
        'handlers/**/*.js',
        '!js/**/*.test.js',
        '!handlers/**/*.test.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 20,
            functions: 25,
            lines: 30,
            statements: 30
        }
    }
};
