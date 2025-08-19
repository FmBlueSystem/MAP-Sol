/**
 * 📦 WEBPACK CONFIGURATION
 * Build system for Music Analyzer Pro
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';
const isAnalyze = process.env.ANALYZE === 'true';

module.exports = {
    mode: isDevelopment ? 'development' : 'production',

    entry: {
        main: './src/index.js',
        vendor: ['sqlite3', 'music-metadata']
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: isDevelopment ? '[name].js' : '[name].[contenthash:8].js',
        chunkFilename: isDevelopment ? '[name].chunk.js' : '[name].[contenthash:8].chunk.js',
        clean: true,
        publicPath: '/'
    },

    module: {
        rules: [
            // JavaScript/TypeScript
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            [
                                '@babel/preset-env',
                                {
                                    targets: {
                                        electron: '32.0.0'
                                    },
                                    modules: false
                                }
                            ],
                            '@babel/preset-typescript'
                        ],
                        plugins: [
                            '@babel/plugin-transform-runtime',
                            '@babel/plugin-syntax-dynamic-import',
                            '@babel/plugin-proposal-class-properties',
                            '@babel/plugin-proposal-optional-chaining',
                            '@babel/plugin-proposal-nullish-coalescing-operator'
                        ]
                    }
                }
            },

            // CSS
            {
                test: /\.css$/,
                use: [
                    isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: isDevelopment,
                            modules: {
                                auto: true,
                                localIdentName: isDevelopment
                                    ? '[path][name]__[local]'
                                    : '[hash:base64:5]'
                            }
                        }
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: ['postcss-preset-env', 'autoprefixer', 'cssnano']
                            }
                        }
                    }
                ]
            },

            // Images
            {
                test: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: 8 * 1024 // 8kb
                    }
                },
                generator: {
                    filename: 'images/[name].[contenthash:8][ext]'
                }
            },

            // Fonts
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'fonts/[name].[contenthash:8][ext]'
                }
            },

            // Audio files
            {
                test: /\.(mp3|wav|flac|m4a|ogg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'audio/[name].[contenthash:8][ext]'
                }
            }
        ]
    },

    plugins: [
        // HTML generation
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html',
            chunks: ['vendor', 'main'],
            minify: !isDevelopment
                ? {
                      collapseWhitespace: true,
                      removeComments: true,
                      removeRedundantAttributes: true,
                      removeScriptTypeAttributes: true,
                      removeStyleLinkTypeAttributes: true,
                      useShortDoctype: true,
                      minifyCSS: true,
                      minifyJS: true
                  }
                : false
        }),

        // CSS extraction
        !isDevelopment &&
            new MiniCssExtractPlugin({
                filename: 'css/[name].[contenthash:8].css',
                chunkFilename: 'css/[name].[contenthash:8].chunk.css'
            }),

        // Copy static assets
        new CopyWebpackPlugin({
            patterns: [
                { from: 'public', to: '' },
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'service-worker.js', to: 'service-worker.js' },
                { from: 'offline.html', to: 'offline.html' },
                { from: 'artwork-cache', to: 'artwork-cache' },
                { from: 'icons', to: 'icons' }
            ]
        }),

        // Compression
        !isDevelopment &&
            new CompressionPlugin({
                algorithm: 'gzip',
                test: /\.(js|css|html|svg)$/,
                threshold: 10240,
                minRatio: 0.8,
                deleteOriginalAssets: false
            }),

        // Service Worker with Workbox
        !isDevelopment &&
            new WorkboxPlugin.InjectManifest({
                swSrc: './service-worker.js',
                swDest: 'service-worker.js',
                exclude: [/\.map$/, /^manifest.*\.js$/]
            }),

        // Bundle analyzer
        isAnalyze &&
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                reportFilename: 'bundle-report.html',
                openAnalyzer: true
            })
    ].filter(Boolean),

    optimization: {
        minimize: !isDevelopment,
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
                        drop_console: !isDevelopment,
                        drop_debugger: !isDevelopment,
                        pure_funcs: !isDevelopment ? ['console.log'] : []
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
            new CssMinimizerPlugin({
                minimizerOptions: {
                    preset: [
                        'default',
                        {
                            discardComments: { removeAll: true }
                        }
                    ]
                }
            })
        ],

        splitChunks: {
            chunks: 'all',
            maxInitialRequests: 25,
            minSize: 20000,
            maxSize: 244000,
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    priority: 10,
                    reuseExistingChunk: true
                },
                common: {
                    minChunks: 2,
                    priority: 5,
                    reuseExistingChunk: true
                },
                default: {
                    minChunks: 2,
                    priority: -20,
                    reuseExistingChunk: true
                },
                // Separate heavy libraries
                sqlite: {
                    test: /[\\/]node_modules[\\/]sqlite3/,
                    name: 'sqlite',
                    priority: 20,
                    enforce: true
                },
                musicMetadata: {
                    test: /[\\/]node_modules[\\/]music-metadata/,
                    name: 'music-metadata',
                    priority: 20,
                    enforce: true
                },
                // Separate our modules
                optimizers: {
                    test: /[\\/]js[\\/](performance-optimizer|database-optimizer|logger)/,
                    name: 'optimizers',
                    priority: 15,
                    enforce: true
                },
                virtualScroller: {
                    test: /[\\/]js[\\/]virtual-scroller/,
                    name: 'virtual-scroller',
                    priority: 15,
                    enforce: true
                }
            }
        },

        runtimeChunk: 'single',

        moduleIds: 'deterministic'
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@config': path.resolve(__dirname, 'config'),
            '@js': path.resolve(__dirname, 'js'),
            '@css': path.resolve(__dirname, 'css'),
            '@types': path.resolve(__dirname, 'types')
        },
        fallback: {
            path: require.resolve('path-browserify'),
            fs: false,
            crypto: false
        }
    },

    devServer: {
        static: {
            directory: path.join(__dirname, 'public')
        },
        compress: true,
        port: 3000,
        hot: true,
        open: false,
        historyApiFallback: true,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true
            }
        },
        client: {
            overlay: {
                errors: true,
                warnings: false
            },
            progress: true
        }
    },

    devtool: isDevelopment ? 'eval-source-map' : 'source-map',

    performance: {
        hints: !isDevelopment ? 'warning' : false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
        assetFilter: function (assetFilename) {
            return !assetFilename.match(/\.(map|LICENSE)$/);
        }
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
        warnings: true
    },

    target: 'electron-renderer',

    externals: {
        electron: 'commonjs electron',
        sqlite3: 'commonjs sqlite3',
        'music-metadata': 'commonjs music-metadata'
    }
};

// Log configuration
logDebug('🔧 Webpack Configuration:');
logDebug(`  Mode: ${isDevelopment ? 'Development' : 'Production'}');
logDebug(`  Analyze: ${isAnalyze ? 'Yes' : 'No'}');
logDebug(`  Output: ${path.resolve(__dirname, 'dist')}');
logDebug('  Entry points: main, vendor');
logDebug('  Code splitting: Enabled');
logDebug('  Compression: ' + (!isDevelopment ? 'Gzip' : 'Disabled'));
logDebug('  Service Worker: ' + (!isDevelopment ? 'Enabled' : 'Disabled'));
