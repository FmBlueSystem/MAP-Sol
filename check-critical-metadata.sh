#!/bin/bash

# CHECK CRITICAL METADATA
# Verifica que un archivo tenga todos los metadatos críticos para DJs

FILE="$1"

if [ -z "$FILE" ]; then
    echo "Uso: $0 <archivo_audio>"
    exit 1
fi

echo "🔍 Verificando metadatos críticos en: $(basename "$FILE")"
echo "="
echo ""

# Función para verificar FLAC
check_flac() {
    echo "📊 Metadatos Básicos:"
    metaflac --show-tag=TITLE "$FILE" 2>/dev/null || echo "  ❌ TITLE faltante"
    metaflac --show-tag=ARTIST "$FILE" 2>/dev/null || echo "  ❌ ARTIST faltante"
    metaflac --show-tag=ALBUM "$FILE" 2>/dev/null || echo "  ❌ ALBUM faltante"
    metaflac --show-tag=GENRE "$FILE" 2>/dev/null || echo "  ❌ GENRE faltante"
    metaflac --show-tag=DATE "$FILE" 2>/dev/null || echo "  ❌ DATE faltante"
    
    echo ""
    echo "🎧 Metadatos DJ:"
    metaflac --show-tag=BPM "$FILE" 2>/dev/null || echo "  ⚠️ BPM faltante"
    metaflac --show-tag=INITIALKEY "$FILE" 2>/dev/null || echo "  ⚠️ INITIALKEY faltante"
    metaflac --show-tag=COMMENT "$FILE" 2>/dev/null || echo "  ⚠️ COMMENT (MixedInKey) faltante"
    
    echo ""
    echo "🔑 Metadatos Únicos:"
    metaflac --show-tag=ISRC "$FILE" 2>/dev/null || echo "  ℹ️ ISRC faltante"
    
    echo ""
    echo "🎚️ Metadatos de Software DJ:"
    if metaflac --show-tag=CUEPOINTS "$FILE" 2>/dev/null | grep -q "CUEPOINTS"; then
        echo "  ✅ CUEPOINTS (MixedInKey) presente"
    else
        echo "  ℹ️ CUEPOINTS faltante"
    fi
    
    if metaflac --show-tag=SERATO_MARKERS_V2 "$FILE" 2>/dev/null | grep -q "SERATO"; then
        echo "  ✅ SERATO_MARKERS_V2 presente"
    else
        echo "  ℹ️ SERATO_MARKERS_V2 faltante"
    fi
}

# Función para verificar MP3/M4A con ffprobe
check_other() {
    ffprobe -v quiet -print_format json -show_format "$FILE" | jq -r '.format.tags' > /tmp/tags.json
    
    echo "📊 Metadatos Básicos:"
    jq -r '.title // .TITLE // "  ❌ TITLE faltante"' /tmp/tags.json
    jq -r '.artist // .ARTIST // "  ❌ ARTIST faltante"' /tmp/tags.json
    jq -r '.album // .ALBUM // "  ❌ ALBUM faltante"' /tmp/tags.json
    jq -r '.genre // .GENRE // "  ❌ GENRE faltante"' /tmp/tags.json
    jq -r '.date // .DATE // "  ❌ DATE faltante"' /tmp/tags.json
    
    echo ""
    echo "🎧 Metadatos DJ:"
    jq -r '.BPM // .bpm // "  ⚠️ BPM faltante"' /tmp/tags.json
    jq -r '.INITIALKEY // .initialkey // "  ⚠️ INITIALKEY faltante"' /tmp/tags.json
    jq -r '.comment // .COMMENT // "  ⚠️ COMMENT faltante"' /tmp/tags.json
    
    rm /tmp/tags.json
}

# Detectar tipo de archivo
EXT="${FILE##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

case "$EXT_LOWER" in
    flac)
        check_flac
        ;;
    mp3|m4a|mp4)
        check_other
        ;;
    *)
        echo "❌ Formato no soportado: $EXT"
        exit 1
        ;;
esac

echo ""
echo "="
echo "Leyenda:"
echo "  ❌ = Crítico (debe tener)"
echo "  ⚠️ = Importante para DJs"
echo "  ℹ️ = Recomendado"
echo "  ✅ = Presente"