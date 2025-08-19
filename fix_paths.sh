#!/bin/bash
# FIX_PATHS.SH - Actualiza las rutas de archivos cuando el disco cambia de nombre

echo "🔧 Actualizando rutas de archivos..."

# Hacer backup primero
cp music_analyzer.db music_analyzer_backup_$(date +%Y%m%d_%H%M%S).db

# Actualizar las rutas de "My Passport" a "My Passport 1"
sqlite3 music_analyzer.db "
UPDATE audio_files 
SET file_path = REPLACE(file_path, '/Volumes/My Passport/', '/Volumes/My Passport 1/')
WHERE file_path LIKE '/Volumes/My Passport/%';
"

# Verificar cuántos se actualizaron
UPDATED=$(sqlite3 music_analyzer.db "
SELECT COUNT(*) 
FROM audio_files 
WHERE file_path LIKE '/Volumes/My Passport 1/%'
")

echo "✅ Actualizadas $UPDATED rutas"

# Verificar que los archivos existen
FIRST_FILE=$(sqlite3 music_analyzer.db "SELECT file_path FROM audio_files LIMIT 1")
if [ -f "$FIRST_FILE" ]; then
    echo "✅ Archivos accesibles"
else
    echo "❌ Error: Los archivos no son accesibles en la nueva ruta"
fi

echo ""
echo "🎵 Ahora puedes reiniciar la aplicación y la reproducción debería funcionar"