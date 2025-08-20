module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-empty': ['error', { allowEmptyCatch: true }],
        'prefer-const': 'warn',
        'no-var': 'error',
        'no-useless-escape': 'warn',
        'no-constant-condition': 'warn',
        'no-inner-declarations': 'warn',
        'no-undef': 'warn',
        eqeqeq: ['warn', 'always', { null: 'ignore' }],
        curly: ['error', 'all'],
        'brace-style': ['warn', '1tbs'],
        indent: ['warn', 4, { SwitchCase: 1 }],
        quotes: ['error', 'single', { avoidEscape: true }],
        semi: ['error', 'always'],
        'comma-dangle': ['warn', 'never'],
        'arrow-parens': ['warn', 'as-needed'],
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'space-before-function-paren': [
            'error',
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always'
            }
        ]
    },
    globals: {
        APP_CONFIG: 'readonly',
        logger: 'readonly',
        errorTracker: 'readonly',
        performanceMonitor: 'readonly',
        perfOptimizer: 'readonly',
        dbOptimizer: 'readonly',
        themeController: 'readonly',
        logInfo: 'readonly',
        logError: 'readonly',
        logDebug: 'readonly',
        logWarn: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        backupDir: 'readonly',
        movedCount: 'readonly',
        clients: 'readonly'
    }
};
