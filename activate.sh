#!/bin/bash
# Script para activar el ambiente virtual de Python 3.12

echo "🎵 Activando ambiente virtual para Music Analyzer Pro..."
source .venv/bin/activate
echo "✅ Ambiente activado con Python $(python --version)"
echo "📦 Paquetes instalados:"
echo "  - NumPy $(python -c 'import numpy; print(numpy.__version__)')"
echo "  - SciPy $(python -c 'import scipy; print(scipy.__version__)')"
echo "  - Librosa $(python -c 'import librosa; print(librosa.__version__)')"
echo ""
echo "💡 Para desactivar, usa: deactivate"