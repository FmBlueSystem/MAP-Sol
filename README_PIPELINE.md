# 🎵 Music Analysis Pipeline - Quick Start

Pipeline completo de análisis musical con Essentia + GPT-4

## 🚀 Instalación Rápida

```bash
# 1. Crear entorno virtual (Python 3.12)
python3.12 -m venv .venv
source .venv/bin/activate

# 2. Instalar dependencias
pip install essentia numpy mutagen openai python-dotenv

# 3. Configurar OpenAI API Key
echo 'OPENAI_API_KEY=sk-tu-key-aqui' > .env
```

## 📊 Uso Básico

### Análisis Completo (con GPT-4)

```bash
python openai_processor.py "song.flac"
```

### Solo Essentia (sin GPT-4)

```bash
python essentia_processor_with_mik.py "song.flac"
```

### Comparar Estrategias

```bash
python essentia_smart60.py --strategy benchmark "song.flac"
```

## 🔄 Pipeline Completo

```
Audio File → Metadata (MIK) → Essentia (7 features) → GPT-4 → JSON
```

## 📁 Archivos Principales

| Archivo                          | Función                     | Tiempo |
| -------------------------------- | --------------------------- | ------ |
| `metadata_reader_complete.py`    | Lee metadata + Mixed In Key | ~0.1s  |
| `essentia_processor_with_mik.py` | Calcula 7 características   | ~10s   |
| `essentia_smart60.py`            | Estrategia optimizada       | ~12s   |
| `metadata_validator.py`          | Normaliza datos             | ~0.05s |
| `ai_enhancer.py`                 | Prepara prompt              | ~0.1s  |
| `openai_processor.py`            | Llama a GPT-4               | ~20s   |

## 📈 Características Calculadas

1. **LUFS** - Loudness integrado (-60 a 0 dB)
2. **Danceability** - Qué tan bailable (0-1)
3. **Acousticness** - Elementos acústicos (0-1)
4. **Instrumentalness** - Ausencia de voz (0-1)
5. **Liveness** - Grabación en vivo (0-1)
6. **Speechiness** - Contenido hablado (0-1)
7. **Valence** - Positividad emocional (0-1)

## 💰 Costos GPT-4

- **Por canción**: ~$0.05
- **100 canciones**: ~$5
- **1,000 canciones**: ~$50

## 📊 Ejemplo de Resultado

```json
{
    "file_name": "France Joli - Come to Me.flac",
    "precomputed_features": {
        "loudness_lufs": -15.56,
        "danceability": 0.773,
        "energy": 0.7,
        "key": "4A"
    },
    "gpt4_analysis": {
        "genre": "Disco",
        "mood": "Romantic",
        "era": "1980s",
        "occasions": ["dance", "dinner"],
        "sentiment": 0.8,
        "confidence": 0.95
    }
}
```

## 🔧 Troubleshooting

| Problema             | Solución                         |
| -------------------- | -------------------------------- |
| No module 'essentia' | `pip install essentia`           |
| API key not found    | `export OPENAI_API_KEY='sk-...'` |
| NumPy error          | Usar Python 3.12, no 3.13        |
| FFmpeg warnings      | Ya manejado automáticamente      |

## 📚 Documentación Completa

Ver [PIPELINE_DOCUMENTATION.md](PIPELINE_DOCUMENTATION.md) para detalles completos.

---

_Pipeline v1.0.0 - Enero 2025_
