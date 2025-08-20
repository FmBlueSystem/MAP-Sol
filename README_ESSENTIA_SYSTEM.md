# 🎵 Sistema de Análisis Musical con Essentia

## Descripción

Sistema completo de análisis de características musicales usando Essentia, integrado con base de datos SQLite para el proyecto Music Analyzer Pro.

## 🚀 Inicio Rápido

### Opción 1: Menú Interactivo (Recomendado)

```bash
./start_analysis.sh
```

### Opción 2: Procesar Todos los Archivos Restantes

```bash
./process_remaining.sh
```

### Opción 3: Procesar Número Específico

```bash
./run_essentia_safe.sh -n 100 --strategy smart60
```

## 📊 Monitoreo en Tiempo Real

Abrir en una terminal separada:

```bash
./monitor_analysis.sh
```

## 🔧 Scripts Disponibles

### 1. `start_analysis.sh`

**Menú principal interactivo**

- Analizar todos los archivos restantes
- Analizar cantidad específica
- Monitorear progreso
- Ver estadísticas
- Exportar a JSON

### 2. `process_remaining.sh`

**Procesamiento batch automático**

- Procesa TODOS los archivos pendientes
- Lotes de 100 archivos
- Logging detallado
- Resumen JSON al finalizar
- Estimación de tiempo restante

### 3. `run_essentia_safe.sh`

**Procesamiento con opciones**

```bash
./run_essentia_safe.sh [OPCIONES]

OPCIONES:
    -n, --num NUM        Número de archivos a procesar (default: 10)
    -s, --strategy STRAT Estrategia: smart60|first60|full (default: smart60)
    -d, --dir DIR        Directorio de música
    -j, --json FILE      Exportar resultados a JSON
    --no-db              No guardar en base de datos
    --no-cache           Desactivar cache
    -v, --verbose        Salida detallada
```

### 4. `monitor_analysis.sh`

**Monitor en tiempo real**

- Progreso general con barra visual
- Estadísticas de features
- Top tonalidades
- Últimos 5 procesados
- Actualización cada 5 segundos

## 📈 Features Analizadas

| Feature              | Descripción           | Rango         |
| -------------------- | --------------------- | ------------- |
| **Loudness**         | Volumen en LUFS       | -60 a 0 dB    |
| **BPM**              | Beats por minuto      | 40-200        |
| **Key**              | Tonalidad musical     | Ej: "C major" |
| **Energy**           | Intensidad percibida  | 0.0-1.0       |
| **Danceability**     | Qué tan bailable es   | 0.0-1.0       |
| **Valence**          | Positividad emocional | 0.0-1.0       |
| **Acousticness**     | Contenido acústico    | 0.0-1.0       |
| **Instrumentalness** | Ausencia de voz       | 0.0-1.0       |
| **Liveness**         | Grabación en vivo     | 0.0-0.5       |
| **Speechiness**      | Contenido hablado     | 0.0-1.0       |

## 🗄️ Base de Datos

### Verificar Estado

```bash
sqlite3 music_analyzer.db "SELECT COUNT(*) as total, COUNT(CASE WHEN AI_BPM > 0 THEN 1 END) as analizados FROM llm_metadata"
```

### Top 10 Más Energéticos

```bash
sqlite3 music_analyzer.db "SELECT af.file_name, lm.AI_ENERGY FROM audio_files af JOIN llm_metadata lm ON af.id = lm.file_id ORDER BY lm.AI_ENERGY DESC LIMIT 10"
```

### Distribución de BPM

```bash
sqlite3 music_analyzer.db "SELECT CASE WHEN AI_BPM < 90 THEN 'Lento' WHEN AI_BPM < 120 THEN 'Medio' WHEN AI_BPM < 140 THEN 'Rápido' ELSE 'Muy Rápido' END as rango, COUNT(*) FROM llm_metadata WHERE AI_BPM > 0 GROUP BY rango"
```

## 📁 Estructura de Archivos

```
music-app-clean/
├── essentia_enhanced_v2.py    # Analizador principal
├── start_analysis.sh           # Menú interactivo
├── process_remaining.sh        # Procesamiento batch
├── run_essentia_safe.sh        # Procesamiento con opciones
├── monitor_analysis.sh         # Monitor tiempo real
├── music_analyzer.db           # Base de datos SQLite
└── essentia_logs/             # Directorio de logs
    ├── process_remaining_*.log # Logs de procesamiento
    └── summary_*.json          # Resúmenes JSON
```

## ⚙️ Configuración

### Estrategias de Extracción

- **smart60**: Extrae 60s del centro, evitando intro/outro (default)
- **first60**: Primeros 60 segundos
- **full**: Archivo completo

### Tamaño de Lote

Por defecto: 100 archivos
Modificar en `process_remaining.sh`:

```bash
BATCH_SIZE=100  # Cambiar a valor deseado
```

## 🐛 Solución de Problemas

### Error: "Essentia no disponible"

```bash
# Reinstalar en entorno virtual
source .venv/bin/activate
pip install --upgrade essentia
```

### Error: "too many values to unpack"

Ya corregido en `essentia_enhanced_v2.py` línea 137

### Base de datos no actualiza

```bash
# Verificar rutas
sqlite3 music_analyzer.db "SELECT file_path FROM audio_files LIMIT 1"

# Actualizar rutas si es necesario
sqlite3 music_analyzer.db "UPDATE audio_files SET file_path = REPLACE(file_path, 'ruta_vieja', 'ruta_nueva')"
```

## 📊 Estado Actual

- **Total archivos**: 1,479
- **Analizados**: 204 (13.8%)
- **Pendientes**: 1,275
- **Tasa de éxito**: 100%

## 🚦 Tiempo Estimado

Con un promedio de 2-3 segundos por archivo:

- 100 archivos: ~5 minutos
- 500 archivos: ~25 minutos
- 1000 archivos: ~50 minutos
- Todos (1275): ~1 hora

## 💡 Tips

1. **Procesamiento nocturno**: Dejar corriendo `./process_remaining.sh` durante la noche
2. **Monitor remoto**: Usar `screen` o `tmux` para sesiones persistentes
3. **Exportar regularmente**: Hacer backups con opción 5 del menú
4. **Verificar espacio**: El script se detiene si el disco supera 95% de uso

## 📝 Notas

- Los archivos se procesan en lotes para evitar saturación
- El cache en memoria acelera reprocesamiento
- Los logs se guardan automáticamente
- Notificación sonora al completar (macOS)

---

**Última actualización**: 2025-08-17
**Versión**: 2.0 Enhanced
**Archivos procesados**: 204/1479
