module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    rules: {
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-empty': ['error', { allowEmptyCatch: true }],
        'prefer-const': 'warn',
        'no-var': 'error',
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        curly: ['error', 'all'],
        'brace-style': ['error', '1tbs'],
        indent: ['error', 4, { SwitchCase: 1 }],
        quotes: ['error', 'single', { avoidEscape: true }],
        semi: ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'arrow-parens': ['error', 'as-needed'],
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'space-before-function-paren': [
            'error',
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
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
    }
};
