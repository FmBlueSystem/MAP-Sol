#!/bin/bash

# UPDATE ALL - Script simple para actualizar todo
# Uso: ./update-all.sh [numero_tracks_para_IA]

echo "🎵 MUSIC ANALYZER PRO - ACTUALIZACIÓN COMPLETA"
echo "=============================================="
echo ""

# Número de tracks para analizar (default: 10)
TRACKS=${1:-10}

# Paso 1: Actualizar biblioteca
echo "[1/4] 📁 Actualizando biblioteca..."
node update-music-library.js
echo "✅ Biblioteca actualizada"
echo ""

# Paso 2: Normalizar campos
echo "[2/4] 🔧 Normalizando campos..."
node normalize-all-fields.js > /dev/null 2>&1
echo "✅ Campos normalizados"
echo ""

# Paso 3: Analizar con IA
echo "[3/4] 🤖 Analizando $TRACKS tracks con GPT-4..."
node handlers/normalized-llm-handler.js $TRACKS
echo "✅ Análisis completado"
echo ""

# Paso 4: Mostrar estadísticas
echo "[4/4] 📊 Estadísticas finales:"
node music-tools.js stats

echo ""
echo "✨ ACTUALIZACIÓN COMPLETA"
echo "Tracks analizados: $TRACKS"
echo "Costo estimado: ~\$$(echo "scale=2; $TRACKS * 0.01" | bc) USD"