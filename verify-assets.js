#!/usr/bin/env node

// Asset Verification Script
// Ensures all required assets are in place for the application

const fs = require('fs');
const path = require('path');

logDebug('🔍 Verificando assets de la aplicación...\n');

// Configuration
const REQUIRED_ASSETS = {
    'assets/images/default-album.png': {
        description: 'Imagen por defecto para álbumes',
        required: true,
        minSize: 1000, // Minimum 1KB
        maxSize: 5000000 // Maximum 5MB
    }
};

const OPTIONAL_ASSETS = {
    'assets/icons/app-icon.png': {
        description: 'Icono de la aplicación (PNG)',
        required: false
    },
    'assets/icons/icon.icns': {
        description: 'Icono para macOS',
        required: false
    },
    'assets/icons/icon.ico': {
        description: 'Icono para Windows',
        required: false
    }
};

// Statistics
const stats = {
    verified: 0,
    missing: 0,
    optional: 0,
    errors: []
};

// Helper functions
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch {
        return 0;
    }
}

function formatSize(bytes) {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Create directories if they don't exist
function ensureDirectories() {
    const dirs = ['assets', 'assets/images', 'assets/icons'];

    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            logDebug(`📁 Creado directorio: ${dir}`);
        }
    });
}

// Verify a single asset
function verifyAsset(assetPath, config, isRequired = true) {
    const fullPath = path.join(__dirname, assetPath);
    const exists = fileExists(fullPath);

    if (!exists) {
        if (isRequired) {
            logError('❌ FALTA: ${assetPath}');
            logDebug(`   ${config.description}`);
            stats.missing++;
            stats.errors.push(`Archivo requerido no encontrado: ${assetPath}`);
        } else {
            logWarn('⚠️  Opcional no encontrado: ${assetPath}');
            stats.optional++;
        }
        return false;
    }

    const size = getFileSize(fullPath);

    // Check size constraints
    if (config.minSize && size < config.minSize) {
        logWarn('⚠️  ${assetPath} es muy pequeño (${formatSize(size)})');
        stats.errors.push(`${assetPath} es menor al tamaño mínimo esperado`);
        return false;
    }

    if (config.maxSize && size > config.maxSize) {
        logWarn('⚠️  ${assetPath} es muy grande (${formatSize(size)})');
        stats.errors.push(`${assetPath} excede el tamaño máximo permitido`);
        return false;
    }

    logInfo('✅ ${assetPath} (${formatSize(size)})');
    logDebug(`   ${config.description}`);
    stats.verified++;
    return true;
}

// Copy default image if missing
function copyDefaultImageIfNeeded() {
    const defaultImagePath = path.join(__dirname, 'assets/images/default-album.png');
    const sourcePath = path.join(__dirname, 'image.png');

    if (!fileExists(defaultImagePath)) {
        if (fileExists(sourcePath)) {
            logDebug('\n📋 Copiando image.png a assets/images/default-album.png...');
            try {
                fs.copyFileSync(sourcePath, defaultImagePath);
                logInfo('✅ Imagen por defecto copiada exitosamente');
                return true;
            } catch (error) {
                logError('❌ Error copiando imagen:', error.message);
                return false;
            }
        } else {
            logDebug('\n⚠️  No se encontró image.png para copiar como default-album.png');
            return false;
        }
    }
    return true;
}

// Check artwork cache
function checkArtworkCache() {
    const cacheDir = path.join(__dirname, 'artwork-cache');

    if (!fs.existsSync(cacheDir)) {
        logDebug('\n⚠️  No existe directorio artwork-cache');
        return 0;
    }

    try {
        const files = fs.readdirSync(cacheDir);
        const jpgFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
        logDebug(`\n📸 Artwork cache: ${jpgFiles.length} imágenes encontradas`);
        return jpgFiles.length;
    } catch (error) {
        logError('❌ Error leyendo artwork-cache:', error.message);
        return 0;
    }
}

// Main verification process
function main() {
    logDebug('='.repeat(50));
    logDebug('VERIFICACIÓN DE ASSETS - Music Analyzer Pro');
    logDebug('='.repeat(50));

    // Step 1: Ensure directories exist
    logDebug('\n1️⃣ Verificando estructura de directorios...');
    ensureDirectories();

    // Step 2: Copy default image if needed
    logDebug('\n2️⃣ Verificando imagen por defecto...');
    copyDefaultImageIfNeeded();

    // Step 3: Verify required assets
    logDebug('\n3️⃣ Verificando assets requeridos...');
    Object.entries(REQUIRED_ASSETS).forEach(([path, config]) => {
        verifyAsset(path, config, true);
    });

    // Step 4: Verify optional assets
    logDebug('\n4️⃣ Verificando assets opcionales...');
    Object.entries(OPTIONAL_ASSETS).forEach(([path, config]) => {
        verifyAsset(path, config, false);
    });

    // Step 5: Check artwork cache
    const artworkCount = checkArtworkCache();

    // Final report
    logDebug('\n' + '='.repeat(50));
    logDebug('📊 RESUMEN DE VERIFICACIÓN');
    logDebug('='.repeat(50));
    logInfo('✅ Assets verificados: ${stats.verified}');
    logError('❌ Assets faltantes: ${stats.missing}');
    logWarn('⚠️  Assets opcionales no encontrados: ${stats.optional}');
    logDebug(`📸 Imágenes en cache: ${artworkCount}`);

    if (stats.errors.length > 0) {
        logDebug('\n❗ ERRORES ENCONTRADOS:');
        stats.errors.forEach(error => {
            logDebug(`   - ${error}`);
        });
    }

    // Exit code
    if (stats.missing > 0) {
        logDebug('\n❌ Verificación FALLIDA - Faltan assets requeridos');
        process.exit(1);
    } else {
        logDebug('\n✅ Verificación EXITOSA - Todos los assets requeridos están presentes');

        // Recommendations
        if (stats.optional > 0) {
            logDebug('\n💡 Recomendaciones:');
            logDebug('   - Considera agregar iconos de aplicación para mejor presentación');
        }

        if (artworkCount < 100) {
            logDebug(
                '   - Pocas imágenes en cache. Ejecuta "npm run extract-artwork" para extraer más'
            );
        }

        process.exit(0);
    }
}

// Run verification
if (require.main === module) {
    main();
}
