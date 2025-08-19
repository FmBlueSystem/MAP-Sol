#!/bin/bash
# Script para activar el entorno virtual y configurar el PATH correctamente

echo "🔧 Activando entorno virtual..."

# Desactivar cualquier entorno previo
deactivate 2>/dev/null || true

# Activar el entorno virtual
source .venv/bin/activate

# Verificar que estamos usando el Python correcto
PYTHON_PATH=$(which python3)
if [[ "$PYTHON_PATH" == *".venv"* ]]; then
    echo "✅ Entorno virtual activo"
    echo "📍 Python: $PYTHON_PATH"
    echo "📦 Versión: $(python3 --version)"
else
    echo "❌ Error: No se pudo activar el entorno virtual"
    exit 1
fi

# Exportar variables para evitar usar Python del sistema
export PATH="$PWD/.venv/bin:$PATH"
export PYTHONPATH="$PWD:$PYTHONPATH"

echo "✅ Entorno configurado correctamente"
echo ""
echo "Puedes ejecutar ahora:"
echo "  python3 essentia_smart60.py archivo.flac"
echo "  python3 run_essentia_batch.py"