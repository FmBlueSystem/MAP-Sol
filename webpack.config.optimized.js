// Optimized Webpack Configuration with Tree-Shaking
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const WorkboxPlugin = require('workbox-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const shouldAnalyze = process.env.ANALYZE === 'true';

    return {
        mode: isProduction ? 'production' : 'development',

        entry: {
            // Code splitting entry points
            main: './src/index.js',
            vendor: ['howler', 'chart.js', 'date-fns'],
            audio: './js/audio-player.js',
            playlist: './js/playlist-manager.js',
            optimization: [
                './js/performance-optimizer.js',
                './js/database-optimizer.js',
                './js/virtual-scroller-enhanced.js'
            ]
        },

        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
            chunkFilename: isProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
            clean: true,
            publicPath: '/'
        },

        optimization: {
            // Enable tree shaking
            usedExports: true,
            sideEffects: false,

            // Code splitting
            splitChunks: {
                chunks: 'all',
                maxInitialRequests: 25,
                minSize: 20000,
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        priority: 10,
                        reuseExistingChunk: true
                    },
                    audio: {
                        test: /[\\/]js[\\/]audio/,
                        name: 'audio',
                        priority: 5
                    },
                    ui: {
                        test: /[\\/]js[\\/](.*modal|.*view|.*component)/,
                        name: 'ui',
                        priority: 5
                    },
                    common: {
                        minChunks: 2,
                        priority: -10,
                        reuseExistingChunk: true
                    }
                }
            },

            runtimeChunk: 'single',

            // Module concatenation
            concatenateModules: true,

            // Minification
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        parse: {
                            ecma: 8
                        },
                        compress: {
                            ecma: 5,
                            warnings: false,
                            comparisons: false,
                            inline: 2,
                            drop_console: isProduction,
                            drop_debugger: isProduction,
                            pure_funcs: isProduction ? ['console.log', 'console.info'] : []
                        },
                        mangle: {
                            safari10: true
                        },
                        output: {
                            ecma: 5,
                            comments: false,
                            ascii_only: true
                        }
                    },
                    parallel: true,
                    extractComments: false
                }),
                new CssMinimizerPlugin()
            ]
        },

        module: {
            rules: [
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
                                        modules: false, // Important for tree shaking
                                        targets: {
                                            electron: '32'
                                        }
                                    }
                                ]
                            ],
                            plugins: [
                                '@babel/plugin-syntax-dynamic-import',
                                '@babel/plugin-proposal-class-properties',
                                '@babel/plugin-proposal-optional-chaining',
                                '@babel/plugin-proposal-nullish-coalescing-operator'
                            ]
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: [
                        'style-loader',
                        {
                            loader: 'css-loader',
                            options: {
                                modules: false
                            }
                        },
                        'postcss-loader'
                    ]
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'images/[name].[hash:8][ext]'
                    }
                },
                {
                    test: /\.(woff|woff2|eot|ttf|otf)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'fonts/[name].[hash:8][ext]'
                    }
                }
            ]
        },

        plugins: [
            new HtmlWebpackPlugin({
                template: './index-with-search.html',
                filename: 'index.html',
                chunks: ['main', 'vendor'],
                minify: isProduction
                    ? {
                        removeComments: true,
                        collapseWhitespace: true,
                        removeRedundantAttributes: true,
                        useShortDoctype: true,
                        removeEmptyAttributes: true,
                        removeStyleLinkTypeAttributes: true,
                        keepClosingSlash: true,
                        minifyJS: true,
                        minifyCSS: true,
                        minifyURLs: true
                    }
                    : false
            }),

            // Compression for production
            ...(isProduction
                ? [
                    new CompressionPlugin({
                        algorithm: 'gzip',
                        test: /\.(js|css|html|svg)$/,
                        threshold: 8192,
                        minRatio: 0.8
                    }),
                    new CompressionPlugin({
                        algorithm: 'brotliCompress',
                        test: /\.(js|css|html|svg)$/,
                        compressionOptions: {
                            level: 11
                        },
                        threshold: 8192,
                        minRatio: 0.8,
                        filename: '[path][base].br'
                    })
                ]
                : []),

            // PWA Support
            ...(isProduction
                ? [
                    new WorkboxPlugin.GenerateSW({
                        clientsClaim: true,
                        skipWaiting: true,
                        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                        runtimeCaching: [
                            {
                                urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
                                handler: 'CacheFirst',
                                options: {
                                    cacheName: 'images',
                                    expiration: {
                                        maxEntries: 100,
                                        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                                    }
                                }
                            },
                            {
                                urlPattern: /\.(?:js|css)$/,
                                handler: 'StaleWhileRevalidate',
                                options: {
                                    cacheName: 'static-resources'
                                }
                            }
                        ]
                    })
                ]
                : []),

            // Bundle analyzer
            ...(shouldAnalyze
                ? [
                    new BundleAnalyzerPlugin({
                        analyzerMode: 'static',
                        reportFilename: 'bundle-report.html',
                        openAnalyzer: true,
                        generateStatsFile: true,
                        statsFilename: 'bundle-stats.json'
                    })
                ]
                : [])
        ],

        resolve: {
            extensions: ['.js', '.json'],
            alias: {
                '@': path.resolve(__dirname, 'js'),
                '@handlers': path.resolve(__dirname, 'handlers'),
                '@services': path.resolve(__dirname, 'services'),
                '@config': path.resolve(__dirname, 'config')
            },
            // For tree shaking
            mainFields: ['module', 'main']
        },

        // Performance hints
        performance: {
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 512000,
            maxAssetSize: 512000
        },

        // Development server
        devServer: {
            static: {
                directory: path.join(__dirname, 'dist')
            },
            compress: true,
            port: 9000,
            hot: true,
            open: true,
            historyApiFallback: true
        },

        // Source maps
        devtool: isProduction ? 'source-map' : 'eval-source-map',

        // Stats
        stats: {
            colors: true,
            hash: false,
            version: false,
            timings: true,
            assets: true,
            chunks: false,
            modules: false,
            reasons: false,
            children: false,
            source: false,
            errors: true,
            errorDetails: true,
            warnings: true,
            publicPath: false
        }
    };
};
