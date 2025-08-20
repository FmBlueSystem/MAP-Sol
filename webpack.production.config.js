/**
 * Production Webpack Configuration for Music Analyzer Pro
 * Optimized for bundling Electron renderer process
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';
const isAnalyze = process.env.ANALYZE === 'true';

// Get all JS files from js/ directory that should be bundled
const jsModules = [
    'production-logger',
    'virtual-scroller-production',
    'audio-panel',
    'audio-player',
    'error-handler',
    'performance-optimizer',
    'database-optimizer',
    'logger',
    'backup-manager',
    'metadata-inspector',
    'playlist-manager',
    'theme-controller',
    'memory-manager',
    'safe-dom',
];

// Create entry points for each module
const entries = {
    main: './js/app-production.js', // Main app entry (we'll create this)
    // Add each module as a separate entry for code splitting
    ...jsModules.reduce((acc, module) => {
        const modulePath = `./js/${module}.js`;
        if (require('fs').existsSync(path.resolve(__dirname, modulePath))) {
            acc[module] = modulePath;
        }
        return acc;
    }, {}),
};

module.exports = {
    mode: isDevelopment ? 'development' : 'production',

    entry: entries,

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: isDevelopment ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
        chunkFilename: isDevelopment ? 'js/[name].chunk.js' : 'js/[name].[contenthash:8].chunk.js',
        clean: true,
        publicPath: '',
    },

    module: {
        rules: [
            // JavaScript
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            [
                                '@babel/preset-env',
                                {
                                    targets: {
                                        electron: '32.0.0',
                                    },
                                    modules: false,
                                },
                            ],
                        ],
                        plugins: ['@babel/plugin-transform-runtime', '@babel/plugin-syntax-dynamic-import'],
                    },
                },
            },

            // CSS
            {
                test: /\.css$/,
                use: [
                    isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: ['postcss-preset-env', 'autoprefixer', !isDevelopment && 'cssnano'].filter(
                                    Boolean
                                ),
                            },
                        },
                    },
                ],
            },

            // Images
            {
                test: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: 8 * 1024, // 8kb
                    },
                },
                generator: {
                    filename: 'images/[name].[contenthash:8][ext]',
                },
            },

            // Fonts
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'fonts/[name].[contenthash:8][ext]',
                },
            },
        ],
    },

    plugins: [
        // HTML generation for main app
        new HtmlWebpackPlugin({
            template: './index-with-search.html',
            filename: 'index.html',
            chunks: ['runtime', 'vendor', 'common', 'main'],
            inject: 'body',
            minify: !isDevelopment
                ? {
                      collapseWhitespace: true,
                      removeComments: true,
                      removeRedundantAttributes: true,
                      removeScriptTypeAttributes: true,
                      removeStyleLinkTypeAttributes: true,
                      useShortDoctype: true,
                      minifyCSS: true,
                      minifyJS: true,
                  }
                : false,
        }),

        // CSS extraction
        !isDevelopment &&
            new MiniCssExtractPlugin({
                filename: 'css/[name].[contenthash:8].css',
                chunkFilename: 'css/[name].[contenthash:8].chunk.css',
            }),

        // Copy static assets
        new CopyWebpackPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'service-worker.js', to: 'service-worker.js' },
                { from: 'offline.html', to: 'offline.html' },
                {
                    from: 'assets',
                    to: 'assets',
                    globOptions: {
                        ignore: ['**/Thumbs.db', '**/.DS_Store'],
                    },
                },
                {
                    from: 'icons',
                    to: 'icons',
                    noErrorOnMissing: true,
                },
                // Don't copy artwork-cache in production bundle (too large)
                // It should be handled by the Electron app separately
            ],
        }),

        // Compression
        !isDevelopment &&
            new CompressionPlugin({
                algorithm: 'gzip',
                test: /\.(js|css|html|svg)$/,
                threshold: 10240,
                minRatio: 0.8,
                deleteOriginalAssets: false,
            }),

        // Bundle analyzer
        isAnalyze &&
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                reportFilename: 'bundle-report.html',
                openAnalyzer: true,
            }),
    ].filter(Boolean),

    optimization: {
        minimize: !isDevelopment,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    parse: {
                        ecma: 8,
                    },
                    compress: {
                        ecma: 5,
                        warnings: false,
                        comparisons: false,
                        inline: 2,
                        drop_console: !isDevelopment,
                        drop_debugger: !isDevelopment,
                        pure_funcs: !isDevelopment ? ['console.log', 'console.debug'] : [],
                    },
                    mangle: {
                        safari10: true,
                    },
                    output: {
                        ecma: 5,
                        comments: false,
                        ascii_only: true,
                    },
                },
                parallel: true,
                extractComments: false,
            }),
            new CssMinimizerPlugin({
                minimizerOptions: {
                    preset: [
                        'default',
                        {
                            discardComments: { removeAll: true },
                        },
                    ],
                },
            }),
        ],

        splitChunks: {
            chunks: 'all',
            maxInitialRequests: 25,
            minSize: 20000,
            maxSize: 244000,
            cacheGroups: {
                // Vendor libraries
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor',
                    priority: 10,
                    reuseExistingChunk: true,
                },
                // Common modules used across entries
                common: {
                    minChunks: 2,
                    priority: 5,
                    reuseExistingChunk: true,
                    name: 'common',
                },
                // Separate heavy libraries
                howler: {
                    test: /[\\/]node_modules[\\/]howler/,
                    name: 'howler',
                    priority: 20,
                    enforce: true,
                },
                // Our optimization modules
                optimizers: {
                    test: /[\\/]js[\\/](performance-optimizer|database-optimizer|logger)/,
                    name: 'optimizers',
                    priority: 15,
                    enforce: true,
                },
                // Virtual scroller (large module)
                virtualScroller: {
                    test: /[\\/]js[\\/]virtual-scroller/,
                    name: 'virtual-scroller',
                    priority: 15,
                    enforce: true,
                },
                // Audio modules
                audio: {
                    test: /[\\/]js[\\/](audio-player|audio-panel|professional-meter)/,
                    name: 'audio-modules',
                    priority: 15,
                    enforce: true,
                },
                // UI components
                ui: {
                    test: /[\\/]js[\\/](metadata-inspector|playlist-manager|theme-controller)/,
                    name: 'ui-components',
                    priority: 14,
                    enforce: true,
                },
                // Styles
                styles: {
                    test: /\.css$/,
                    name: 'styles',
                    priority: 10,
                    enforce: true,
                },
            },
        },

        runtimeChunk: 'single',

        moduleIds: 'deterministic',
    },

    resolve: {
        extensions: ['.js', '.json'],
        alias: {
            '@js': path.resolve(__dirname, 'js'),
            '@css': path.resolve(__dirname, 'css'),
            '@handlers': path.resolve(__dirname, 'handlers'),
            '@services': path.resolve(__dirname, 'services'),
            '@config': path.resolve(__dirname, 'config'),
            '@assets': path.resolve(__dirname, 'assets'),
        },
    },

    // Development server configuration
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 3000,
        hot: true,
        open: false,
        historyApiFallback: true,
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    },

    devtool: isDevelopment ? 'eval-source-map' : 'source-map',

    performance: {
        hints: !isDevelopment ? 'warning' : false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
        assetFilter: function (assetFilename) {
            return !assetFilename.match(/\.(map|LICENSE)$/);
        },
    },

    stats: {
        colors: true,
        modules: false,
        children: false,
        chunks: false,
        chunkModules: false,
        env: true,
        errorDetails: true,
        errors: true,
        hash: true,
        performance: true,
        timings: true,
        warnings: true,
    },

    // Target Electron renderer process
    target: 'electron-renderer',

    // Externals for native modules
    externals: {
        electron: 'commonjs electron',
        sqlite3: 'commonjs sqlite3',
        'music-metadata': 'commonjs music-metadata',
        sharp: 'commonjs sharp',
    },

    // Node configuration for Electron
    node: {
        __dirname: false,
        __filename: false,
    },
};

// Log configuration
if (!isDevelopment) {
    console.log('🔧 Webpack Production Configuration:');
    console.log('  Mode: Production');
    console.log(`  Analyze: ${isAnalyze ? 'Yes' : 'No'}`);
    console.log(`  Output: ${path.resolve(__dirname, 'dist')}`);
    console.log('  Code splitting: Enabled');
    console.log('  Compression: Gzip');
    console.log('  Minification: Enabled');
    console.log('  Source maps: Enabled');
}
