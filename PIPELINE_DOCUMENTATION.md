# 🎵 Music Analysis Pipeline - Documentación Completa

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Instalación y Configuración](#instalación-y-configuración)
4. [Componentes del Pipeline](#componentes-del-pipeline)
5. [Flujo de Datos](#flujo-de-datos)
6. [APIs y Formatos](#apis-y-formatos)
7. [Uso del Sistema](#uso-del-sistema)
8. [Performance y Costos](#performance-y-costos)
9. [Troubleshooting](#troubleshooting)
10. [Resultados de Ejemplo](#resultados-de-ejemplo)

---

## 🎯 Visión General

### Descripción

Pipeline completo de análisis musical que combina:

- **Extracción de metadata** (incluido Mixed In Key)
- **Análisis de audio** con Essentia (7 características acústicas)
- **Procesamiento inteligente** con estrategia Smart60
- **Enriquecimiento con IA** usando GPT-4

### Capacidades

- Procesa archivos FLAC, M4A, MP3
- Detecta datos de Mixed In Key (BPM, Key, Energy)
- Calcula características acústicas profesionales
- Analiza letras y contexto cultural
- Genera metadata enriquecida lista para producción

### Casos de Uso

- DJs profesionales necesitando análisis detallado
- Bibliotecas musicales requiriendo catalogación automática
- Servicios de streaming para recomendaciones
- Investigación musicológica y análisis de tendencias

---

## 🏗️ Arquitectura del Sistema

### Diagrama de Flujo

```
┌─────────────────┐
│  Audio File     │
│ (.flac/.m4a/.mp3)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Metadata Reader │ ◄── Mixed In Key Data
│   (Mutagen)     │     (BPM, Key, Energy)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Essentia Processor│ ◄── MIK Integration
│  (7 Features)    │     (Smart60 Strategy)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Data Validator  │ ◄── Normalization
│  & Normalizer   │     (Types, Ranges, Encoding)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Enhancer    │ ◄── Prompt Formatting
│ (Prompt Builder)│     (JSON Schema)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OpenAI GPT-4   │ ◄── Analysis & Enrichment
│     (API)       │     (Genre, Mood, Context)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  JSON Output    │
│ (Complete Data) │
└─────────────────┘
```

### Stack Tecnológico

- **Python 3.12**: Lenguaje principal
- **Essentia**: Análisis de audio (C++ con Python bindings)
- **Mutagen**: Lectura de metadata
- **NumPy**: Procesamiento de señales
- **OpenAI API**: GPT-4 para enriquecimiento
- **SQLite**: Almacenamiento opcional

---

## 📦 Instalación y Configuración

### Requisitos Previos

- Python 3.12 (no 3.13 por incompatibilidad con NumPy)
- macOS/Linux/Windows
- 4GB RAM mínimo
- Espacio: ~500MB para dependencias

### Instalación Paso a Paso

#### 1. Crear Entorno Virtual

```bash
# Crear entorno con Python 3.12
python3.12 -m venv .venv

# Activar entorno
source .venv/bin/activate  # En macOS/Linux
# o
.venv\Scripts\activate  # En Windows
```

#### 2. Instalar Dependencias

```bash
# Actualizar pip
pip install --upgrade pip

# Instalar paquetes core
pip install essentia numpy mutagen

# Instalar utilidades
pip install openai python-dotenv
```

#### 3. Configurar API Key de OpenAI

```bash
# Crear archivo .env
echo 'OPENAI_API_KEY=sk-tu-api-key-aqui' > .env

# O exportar como variable de entorno
export OPENAI_API_KEY='sk-tu-api-key-aqui'
```

#### 4. Verificar Instalación

```bash
# Test de importación
python -c "import essentia; print('Essentia OK')"
python -c "import mutagen; print('Mutagen OK')"
python -c "from openai import OpenAI; print('OpenAI OK')"
```

---

## 🔧 Componentes del Pipeline

### 1. metadata_reader_complete.py

**Función**: Lee TODA la metadata disponible de archivos de audio

**Características**:

- Soporte para FLAC, M4A, MP3
- Detección de Mixed In Key data
- Decodificación base64 automática
- Extracción de lyrics, ISRC, cover art

**Ejemplo de uso**:

```python
from metadata_reader_complete import CompleteMetadataReader

reader = CompleteMetadataReader()
metadata = reader.read_all_metadata("song.flac")
print(f"BPM: {metadata.get('bpm')}")
print(f"Key: {metadata.get('key')}")
print(f"Energy: {metadata.get('energy')}")
```

### 2. essentia_processor_with_mik.py

**Función**: Calcula 7 características acústicas usando Essentia + MIK

**Características calculadas**:

1. **LUFS** (Loudness Units Full Scale)
2. **Danceability** (0-1)
3. **Acousticness** (0-1)
4. **Instrumentalness** (0-1)
5. **Liveness** (0-1)
6. **Speechiness** (0-1)
7. **Valence** (positividad emocional, 0-1)

**Integración MIK**:

- Usa BPM de MIK si está disponible
- Convierte Energy MIK (1-10) → Essentia (0-1)
- Usa Key para cálculo de valence

**Ejemplo**:

```python
from essentia_processor_with_mik import EssentiaProcessorWithMIK

processor = EssentiaProcessorWithMIK()
result = processor.process_file("song.flac")
print(f"Loudness: {result['essentia_features']['loudness']} dB")
print(f"Danceability: {result['essentia_features']['danceability']}")
```

### 3. essentia_smart60.py

**Función**: Implementa estrategia Smart60 para análisis rápido

**Estrategias disponibles**:

- **full**: Procesa track completo (más lento, más preciso)
- **first60**: Primeros 60 segundos (rápido, puede sesgar)
- **smart60**: 3 ventanas inteligentes (balance velocidad/precisión)
- **hybrid**: Smart60 + validación con full
- **benchmark**: Compara todas las estrategias

**Ventanas Smart60**:

- **start30**: Primeros 30s (intro + verso)
- **chorus30**: 30s del chorus detectado automáticamente
- **end20**: Últimos 20s (outro)

**Agregación por métrica**:

```python
aggregation_strategies = {
    'loudness': 'max',           # Captura pico
    'danceability': 'weighted_mean',  # Chorus 50% peso
    'instrumentalness': 'min',   # Si hay voz en alguna parte
    'valence': 'weighted_mean'   # Balance emocional
}
```

### 4. metadata_validator.py

**Función**: Valida y normaliza todos los datos

**Validaciones**:

- Tipos de datos correctos
- Rangos válidos (ej: 0-1 para probabilidades)
- Encoding UTF-8
- Fechas ISO format
- ISRC válido
- Conversión de escalas (MIK → Essentia)

**Normalizaciones**:

- Capitalización inteligente de títulos
- Fix de caracteres problemáticos (Ñ, tildes)
- Limpieza de lyrics (remove timestamps)
- Parsing de track numbers ("1/12" → current: 1, total: 12)

### 5. ai_enhancer.py

**Función**: Prepara datos y formatea prompt para IA

**Preparación de datos**:

- Combina metadata + Essentia features
- Convierte Camelot ↔ Traditional keys
- Estructura JSON según schema requerido
- Limpia y formatea lyrics

**Prompt engineering**:

- 8,500+ caracteres de instrucciones precisas
- Schema JSON estricto
- Reglas de análisis específicas
- Límites de longitud por campo

### 6. openai_processor.py

**Función**: Envía a GPT-4 y procesa respuesta

**Configuración**:

- Modelo: `gpt-4-turbo-preview`
- Temperature: 0.3 (determinístico)
- Max tokens: 2000
- Response format: JSON

**Análisis GPT-4 incluye**:

- Género principal y subgéneros
- Mood musical
- Era y contexto cultural
- Ocasiones de uso
- Análisis lírico completo
- Emociones detectadas
- Frases clave y hooks

---

## 🔄 Flujo de Datos

### Ejemplo Completo: "France Joli - Come to Me.flac"

#### Paso 1: Extracción de Metadata

```json
{
    "title": "Come to Me",
    "artist": "France Joli",
    "date": "1989-08-01",
    "bpm": 132.0, // Mixed In Key
    "key": "4A", // Mixed In Key (Camelot)
    "energy": 7.0, // Mixed In Key (1-10)
    "isrc": "CAU117900284",
    "lyrics": "[00:07.83] Mm-mm\n[00:15.49] Come to me...",
    "duration_seconds": 592.04
}
```

#### Paso 2: Procesamiento Essentia

```json
{
    "loudness": -15.56, // LUFS
    "danceability": 0.773, // Alta
    "acousticness": 0.876, // Elementos acústicos
    "instrumentalness": 0.308, // Voz detectada
    "liveness": 1.0, // Posible live
    "speechiness": 0.015, // Cantado, no hablado
    "valence": 0.53, // Neutral-positivo
    "energy": 0.7 // MIK 7/10 → 0.7
}
```

#### Paso 3: Validación y Normalización

```json
{
    "year": 1989, // Parseado de date
    "month": 8,
    "day": 1,
    "musical_key": "F minor", // Convertido de 4A
    "camelot_key": "4A", // Original MIK
    "lyrics": "Mm-mm\nCome to me...", // Sin timestamps
    "energy_scale": "MIK" // Indicador de escala
}
```

#### Paso 4: Análisis GPT-4

```json
{
    "genre": "Disco",
    "subgenres": ["Dance", "Euro-Disco"],
    "mood": "Romantic",
    "era": "1980s",
    "occasions": ["after-hours", "dance", "dinner"],
    "description": "A heartfelt plea for companionship...",
    "lyrics_analysis": {
        "language": "English",
        "topic_main": "Love and Loneliness",
        "sentiment": 0.8,
        "emotions": {
            "joy": 0.7,
            "trust": 0.9,
            "sadness": 0.2
        },
        "repeated_phrases": [
            { "phrase": "Come to me", "count": 14, "reason": "hook" },
            { "phrase": "I love you", "count": 12, "reason": "loop" }
        ]
    },
    "confidence": 0.95
}
```

---

## 📐 APIs y Formatos

### Formato de Entrada

**Archivos soportados**:

- FLAC (recomendado, sin pérdida)
- M4A/MP4 (iTunes/Apple)
- MP3 (universal)

**Metadata esperada** (opcional pero recomendada):

- Tags ID3v2 o Vorbis Comments
- Mixed In Key comments
- ISRC en tags estándar
- Lyrics en formato LRC o plano

### Formato de Salida JSON

```json
{
    "file_path": "string",
    "file_name": "string",
    "original_metadata": {
        "title": "string",
        "artist": "string",
        "album": "string",
        "year": "number",
        "isrc": "string"
    },
    "precomputed_features": {
        "loudness_lufs": "number (-60 to 0)",
        "danceability": "number (0-1)",
        "acousticness": "number (0-1)",
        "instrumentalness": "number (0-1)",
        "liveness": "number (0-1)",
        "speechiness": "number (0-1)",
        "valence": "number (0-1)",
        "energy": "number (0-1)",
        "musical_key": "string",
        "camelot_key": "string"
    },
    "gpt4_analysis": {
        "genre": "string",
        "subgenres": ["array of strings"],
        "mood": "enum string",
        "era": "enum string",
        "occasions": ["array of strings"],
        "description": "string (max 280 chars)",
        "lyrics_analysis": {
            "language": "string",
            "topic_main": "string",
            "sentiment": "number (0-1)",
            "emotions": {
                "joy": "number (0-1)",
                "sadness": "number (0-1)",
                "anger": "number (0-1)",
                "fear": "number (0-1)",
                "surprise": "number (0-1)",
                "trust": "number (0-1)"
            },
            "repeated_phrases": [
                {
                    "phrase": "string",
                    "count": "number",
                    "reason": "enum (loop|hook|chant)"
                }
            ]
        },
        "confidence": "number (0-1)"
    },
    "processing_time": "number (seconds)",
    "tokens_used": "number",
    "estimated_cost": "number (USD)",
    "timestamp": "ISO 8601 string"
}
```

### OpenAI API

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Headers**:

```http
Authorization: Bearer sk-your-api-key
Content-Type: application/json
```

**Request Body**:

```json
{
    "model": "gpt-4-turbo-preview",
    "messages": [
        {
            "role": "system",
            "content": "You are a music analysis expert..."
        },
        {
            "role": "user",
            "content": "[formatted prompt with data]"
        }
    ],
    "temperature": 0.3,
    "max_tokens": 2000,
    "response_format": { "type": "json_object" }
}
```

---

## 💻 Uso del Sistema

### Procesamiento Individual

```bash
# Análisis completo con GPT-4
python openai_processor.py "path/to/song.flac"

# Solo Essentia + MIK (sin GPT-4)
python essentia_processor_with_mik.py "path/to/song.flac"

# Benchmark de estrategias
python essentia_smart60.py --strategy benchmark "path/to/song.flac"

# Solo preparación de prompt (sin enviar a GPT-4)
python ai_enhancer.py "path/to/song.flac"
```

### Procesamiento en Lote

```bash
# Procesar carpeta completa (límite 5 archivos)
python openai_processor.py --batch --limit 5 "path/to/folder"

# Procesar con Essentia batch
python essentia_processor_with_mik.py "path/to/folder" --limit 10
```

### Configuración Avanzada

```python
# Cambiar modelo GPT
processor = OpenAIProcessor()
processor.model = "gpt-4"  # Más estable pero más caro

# Ajustar temperature
processor.temperature = 0.7  # Más creativo

# Cambiar estrategia Smart60
analyzer = Smart60Analyzer()
result = analyzer.process_file(file_path, strategy='hybrid')
```

---

## 📊 Performance y Costos

### Tiempos de Procesamiento

| Componente         | Tiempo por Track | Speedup |
| ------------------ | ---------------- | ------- |
| Metadata Reader    | ~0.1s            | -       |
| Essentia Full      | ~10s             | 1x      |
| Essentia First60   | ~0.6s            | 15.8x   |
| Essentia Smart60   | ~12s             | 0.8x    |
| Validación         | ~0.05s           | -       |
| GPT-4 API          | ~15-20s          | -       |
| **Total Pipeline** | ~30-35s          | -       |

### Costos GPT-4

| Modelo      | Costo Prompt    | Costo Completion | Total por Track |
| ----------- | --------------- | ---------------- | --------------- |
| GPT-4 Turbo | $0.01/1K tokens | $0.03/1K tokens  | ~$0.05          |
| GPT-4       | $0.03/1K tokens | $0.06/1K tokens  | ~$0.10          |

**Estimación para bibliotecas**:

- 100 tracks: $5-10
- 1,000 tracks: $50-100
- 10,000 tracks: $500-1,000

### Precisión Smart60 vs Full

| Métrica          | Accuracy | Diferencia Promedio |
| ---------------- | -------- | ------------------- |
| Loudness         | 96.5%    | 0.5 dB              |
| Danceability     | 100%     | 0.000               |
| Acousticness     | 75.2%    | 0.170               |
| Instrumentalness | 39.0%    | 0.488               |
| Valence          | 100%     | 0.000               |
| **Promedio**     | 89.5%    | -                   |

### Recursos del Sistema

**Memoria RAM**:

- Mínimo: 2GB
- Recomendado: 4GB
- Por track en memoria: ~50-100MB

**CPU**:

- Single-thread principalmente
- Boost con múltiples cores para batch

**Almacenamiento**:

- Dependencias: ~500MB
- Cache de resultados: ~1KB por track
- Logs: ~10MB por 1000 tracks

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. ImportError: No module named 'essentia'

**Solución**:

```bash
pip install essentia
# Si falla, probar:
pip install essentia-python
```

#### 2. NumPy compatibility error (Python 3.13)

**Solución**:

```bash
# Usar Python 3.12
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### 3. OpenAI API Key no encontrada

**Solución**:

```bash
# Opción 1: Archivo .env
echo 'OPENAI_API_KEY=sk-...' > .env

# Opción 2: Variable de entorno
export OPENAI_API_KEY='sk-...'
```

#### 4. FFmpeg warnings con archivos FLAC

**Solución**: Ya manejado automáticamente por el sistema

```python
# El código suprime warnings automáticamente
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'
sys.stderr = io.StringIO()
```

#### 5. Rate limiting de OpenAI

**Solución**:

```python
# Agregar delay entre requests
import time
time.sleep(2)  # 2 segundos entre llamadas
```

### Logs y Debugging

**Habilitar logs detallados**:

```python
# En cualquier script
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Ver prompt generado**:

```bash
# Se guarda automáticamente en:
cat ai_prompt_*.txt
```

**Verificar resultados intermedios**:

```bash
# JSONs generados
ls -la *.json
cat essentia_mik_results_*.json
```

---

## 📈 Resultados de Ejemplo

### Track: "France Joli - Come to Me"

**Input**: FLAC, 592 segundos, 1989

**Metadata Original**:

- No genre tag
- No mood information
- Basic artist/title/album

**Después del Pipeline**:

```json
{
    "genre": "Disco",
    "subgenres": ["Dance", "Euro-Disco", "Synth-Pop"],
    "mood": "Romantic",
    "era": "1980s",
    "bpm": 132,
    "key": "4A (F minor)",
    "energy": 0.7,
    "danceability": 0.773,
    "valence": 0.53,
    "occasions": ["after-hours", "dance", "wedding", "dinner"],
    "description": "A heartfelt plea for companionship and love...",
    "main_hooks": ["Come to me", "I love you"],
    "sentiment": 0.8,
    "confidence": 0.95
}
```

**Mejoras obtenidas**:

- ✅ Género y subgéneros identificados
- ✅ Mood romántico detectado
- ✅ Era correcta (1980s)
- ✅ Ocasiones de uso sugeridas
- ✅ Análisis lírico profundo
- ✅ Hooks y frases clave identificadas
- ✅ Alta confianza (95%)

---

## 🚀 Próximos Pasos

### Mejoras Planificadas

1. **Integración con base de datos** para cachear resultados
2. **Procesamiento paralelo** para batches grandes
3. **Web UI** para visualización
4. **Export a formatos** DJ (rekordbox, Serato)
5. **Detección automática** de duplicados
6. **Análisis de stems** (separación de instrumentos)

### Contribuciones

El proyecto está abierto a mejoras. Áreas de interés:

- Optimización de performance
- Soporte para más formatos
- Mejores estrategias de extracción
- Integración con más servicios de IA

---

## 📄 Licencia y Créditos

**Tecnologías utilizadas**:

- Essentia by Music Technology Group (MTG)
- OpenAI GPT-4
- Python y comunidad open source

**Desarrollado por**: [Tu nombre]
**Fecha**: Enero 2025
**Versión**: 1.0.0

---

## 📞 Contacto y Soporte

Para preguntas, issues o sugerencias:

- GitHub: [tu-repo]
- Email: [tu-email]

**¿Necesitas ayuda?** Revisa primero:

1. Esta documentación
2. Sección de Troubleshooting
3. Logs generados (`*.json`, `*.txt`)

---

_Última actualización: 16 de Enero, 2025_
