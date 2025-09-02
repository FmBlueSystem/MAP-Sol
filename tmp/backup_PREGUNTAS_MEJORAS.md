# Cuestionario de Mejora y Nuevas Funcionalidades — Music Analyzer Pro

Este documento reúne preguntas prácticas para entender necesidades, priorizar mejoras y definir nuevas funcionalidades del proyecto (UI en `src/main.py` y `src/app.py`, reproductor en `src/music_player.py`, analizadores en `src/audio_analyzer*.py` y `src/hamms_analyzer.py`, base de datos en `src/database.py`, utilidades bajo `src/utils/`). Úsalo en entrevistas con usuarios, revisiones internas y planificación del roadmap.

## 1) Usuarios y Casos de Uso

### PREGUNTAS:
- ¿Quiénes son los usuarios principales (DJ, productores, curadores, analistas de audio)?
- ¿Cuál es el tamaño típico de su biblioteca (decenas, miles, cientos de miles de pistas)?
- ¿En qué sistemas operativos trabajan principalmente (macOS, Windows, Linux)?
- ¿Qué problema concreto esperan resolver con la app (análisis armónico, organización, pre‑escucha, exportación)?
- ¿Qué otras herramientas usan hoy (Rekordbox, Serato, Traktor, Mixed In Key, iTunes/Music)?

### RESPUESTAS:
- **Usuarios principales**: DJs que necesitan análisis armónico preciso y organización de biblioteca (no para mezclar en vivo)
- **Tamaño de biblioteca**: 5,000-20,000 canciones y creciendo continuamente
- **Sistemas operativos**: macOS (principal), Windows (alternativa)
- **Problemas a resolver**: 
  - Análisis armónico mejorado usando algoritmo HAMMS
  - Verificación y comparación de análisis existentes de Mixed In Key
  - Organización y búsqueda avanzada de biblioteca
  - Pre-escucha y análisis sin necesidad de abrir software de DJ
  - La app NO es para mezclar, es para preparación y análisis
- **Herramientas actuales**: Mixed In Key para pre-análisis (archivos ya vienen con esta info), NO se usa Rekordbox/Serato

## 2) Flujo Actual (UI principal)

### PREGUNTAS:
- ¿Qué pantallas usan más en `src/main.py`/`src/app.py` y para qué tareas?
- ¿Qué pasos del flujo les resultan lentos o confusos (importar, analizar, revisar metadatos, exportar)?
- ¿Qué acciones echan de menos (deshacer/rehacer, arrastrar‑soltar, multiselección, edición en bloque)?
- ¿Qué indicadores de progreso y estados serían más claros (colas, porcentajes, tiempos estimados)?

### RESPUESTAS:
- **Pantalla más usada**: Vista de biblioteca/tabla principal para navegación y organización de tracks
- **Paso faltante en el flujo**: Falta integración del análisis de IA después de la importación HAMMS
- **Indicadores de progreso**: Barra de progreso general para análisis batch (no individual por canción)
- **Flujo mejorado necesario**: Importación → HAMMS → IA → Resultados consolidados

## 3) Reproductor (`src/music_player.py`)

### PREGUNTAS:
- ¿Necesitan reproducción sin cortes (gapless), crossfade, ecualizador, forma de onda, marcadores/cue points?
- ¿Cómo esperan controlar el reproductor (atajos de teclado, MIDI, ratón, gestos)?
- ¿Desean letras sincronizadas (`.lrc` de `AudioTest/`) con estilos karaoke y control de offset?
- ¿Requieren analizar on‑the‑fly (bpm/key) durante la reproducción o solo offline?

### RESPUESTAS:
- **Características del reproductor**: Reproductor básico está OK, pero falta VU meter para visualización de niveles
- **Controles necesarios**: Falta botón/atajo de pausa, navegación hacia adelante y atrás en el track
- **Letras**: NO mostrar letras en UI, pero SÍ importarlas en el workflow para análisis de IA (contexto, mood, contenido)
- **Análisis**: Siempre en segundo plano, no interrumpir reproducción

## 4) Análisis de Audio (HAMMS/MIK/Unificado)

### PREGUNTAS:
- ¿Qué métricas priorizan: clave, BPM, energía, tonalidad camelot, valence, loudness, espectro?
- ¿Cuál es la precisión aceptable y cómo se valida (tests en `test_*hamms*`, escuchas A/B, datasets de referencia)?
- ¿Prefieren un analizador por defecto (`audio_analyzer_unified.py` vs `audio_analyzer_mixedinkey.py` vs `audio_analyzer_real.py`)?
- ¿Desean reanálisis incremental ante cambios de versión/algoritmo con tolerancias configurables?
- ¿Necesitan procesamiento en lote con paralelismo y throttling por I/O/CPU? ¿Uso de GPU es deseable?
- ¿Qué formatos/bitrates deben soportarse prioritariamente (MP3, FLAC, AAC/MP4, ALAC, WAV, AIFF, OGG)?

### RESPUESTAS:
- **Métricas prioritarias**: Key/Camelot y BPM son críticas, seguidas de energía (pendiente definir orden completo)
- **Precisión**: (Pendiente definir tolerancias aceptables)
- **Analizador por defecto**: HAMMS analyzer como principal
- **Reanálisis**: Reanalizar todo automáticamente cuando se actualice el algoritmo
- **Procesamiento paralelo**: Usar 2 cores para análisis paralelo (balance entre velocidad y recursos)
- **Formatos soportados prioritarios**:
  - MP3 (320kbps, V0)
  - FLAC/ALAC (lossless)
  - WAV/AIFF (sin comprimir)
  - M4A/AAC

## 5) Base de Datos y Rendimiento (`src/database.py`, `src/utils/db_writer.py`)

### PREGUNTAS:
- ¿Qué volumen de pistas y metadatos debemos soportar sin degradación perceptible?
- ¿Qué consultas deben ser instantáneas (buscar por artista, BPM, key, energía, género)?
- ¿Requieren historial/auditoría de cambios de metadatos y posibilidad de revertir?
- ¿Cómo manejar migraciones y backups (scripts como `scripts/migrate_db.py` cubren casos reales)?
- ¿Se necesita caché de resultados de análisis con invalidación controlada?

### RESPUESTAS:
- **Volumen mínimo**: 5,000 tracks con respuesta instantánea, escalable a 20,000+
- **Consultas instantáneas prioritarias**: Búsquedas combinadas (ej: Género + Key + BPM range + análisis HAMMS)
- **Historial de cambios**: No es necesario auditoría ni revertir cambios
- **Migraciones**: Automáticas al actualizar la app, transparente para el usuario
- **Caché**: Sí para resultados de análisis HAMMS (evitar recálculos innecesarios)

## 6) Importación y Metadatos (`src/metadata_extractor.py`, `src/metadata_viewer.py`)

### PREGUNTAS:
- ¿De dónde importan: carpetas locales, iTunes/Music.app, Rekordbox, Serato, Traktor, Spotify export, CSV/JSON?
- ¿Debemos escribir tags de vuelta al archivo (ID3, MP4, VorbisComments) o mantener solo DB interna?
- ¿Cómo tratar artwork: reglas de actualización, tamaño mínimo, fallback (`resources/images/default-album.png`)?
- ¿Desean normalizar campos (feat., remixes, compilaciones) y resolver duplicados/colisiones?
- ¿Qué estrategias de deduplicación (hash de audio, ruta, duración, ISRC) debemos ofrecer?

### RESPUESTAS:
- **Origen principal**: Carpetas locales en disco
- **Tags de archivo**: Mantener solo en DB interna (no modificar archivos originales)
- **Artwork**: Importar automáticamente del archivo si existe
- **Normalización**: Detectar y marcar duplicados para revisión
- **Deduplicación**: Detectar y marcar duplicados (estrategia por artista + título + duración)

## 7) UI/UX y Accesibilidad (`src/ui/styles/theme.py`)

### PREGUNTAS:
- ¿Necesitan selector de tema (claro/oscuro/sistema) y alto contraste? ¿Soporte HiDPI/Retina?
- ¿Qué atajos de teclado son imprescindibles (navegación, reproducir/pausa, marcar, filtrar)?
- ¿Qué componentes requieren mejor feedback (errores, vacíos, estados intermedios, tooltips)?
- ¿Se requiere i18n/l10n? ¿Idiomas objetivo y prioridades?

### RESPUESTAS:
- **Temas**: Selector de tema claro/oscuro
- **Atajos**: (Por definir según uso)
- **Feedback UI**: (Por definir)
- **Idiomas**: (Por definir)

## 8) Integraciones y Herramientas Externas

### PREGUNTAS:
- ¿Podemos asumir `ffmpeg/ffprobe` instalados? Si no, ¿descarga/auto‑detección o empaquetado opcional?
- ¿Se requiere integración con Mixed In Key (licencia/clave) u otras APIs de terceros?
- ¿Desean exportar a formatos de playlists (M3U, Rekordbox XML, Serato Crates) y reportes (CSV/JSON)?
- ¿Sincronización con nube (Drive/Dropbox) o bibliotecas externas? ¿Cómo resolver conflictos?

### RESPUESTAS:
- **ffmpeg**: Incluir/empaquetar con la app (no asumir instalación previa)
- **Mixed In Key**: (Por definir si necesita integración API)
- **Exportación**: (Por definir formatos necesarios)
- **Sincronización nube**: (Por definir)

## 9) Seguridad y Privacidad

### PREGUNTAS:
- ¿Qué datos personales o sensibles manejamos? ¿Necesitamos ofuscar/anonymizar al reportar fallos?
- ¿Telemetría y métricas de uso deben ser opt‑in con transparencia y borrado bajo demanda?
- ¿Variables de entorno `.env` y `config.yaml`: qué parámetros deben exponerse en UI de forma segura?

### RESPUESTAS:
- **Datos personales**: (Por definir)
- **Telemetría**: Opt-in con transparencia total
- **Configuración**: (Por definir parámetros seguros)

## 10) Pruebas y Calidad (`test_*.py`)

### PREGUNTAS:
- ¿Qué escenarios críticos faltan en tests (importación masiva, análisis batch, corrupción de archivos)?
- ¿Necesitamos datasets de prueba bajo `resources/` para casos borde (silencio, ruido, live, mixtapes)?
- ¿Queremos pruebas de rendimiento/benchmark y límites de tiempo aceptables por operación?
- ¿Cómo manejar no determinismo en análisis (semillas, tolerancias, flujos de verificación tipo `HAMMS_VERIFICATION.md`)?

### RESPUESTAS:
- (Pendiente definir estrategia de testing)

## 11) Distribución y Soporte

### PREGUNTAS:
- ¿Objetivo de empaquetado con PyInstaller (`pyinstaller --noconsole --name MusicAnalyzerPro src/main.py`)?
- ¿Tamaño final y tiempo de arranque aceptables? ¿Necesizan auto‑update y firma/notarización (macOS/Windows)?
- ¿Versiones mínimas de SO y dependencias (PyQt6, ffmpeg)?

### RESPUESTAS:
- **Empaquetado**: Sí, usar PyInstaller para crear .app (macOS) y .exe (Windows)
- **Auto-update**: (Por definir)
- **Versiones mínimas**: (Por definir)

## 12) Roadmap y Prioridades

### PREGUNTAS:
- ¿Cuáles son los "quick wins" que más valor aportan con bajo esfuerzo?
- ¿Qué iniciativas mayores justifican inversión (rearquitectura de analizadores, motor de búsqueda, nueva UI)?
- ¿Qué métricas de éxito usaremos (tiempo de análisis, precisión, NPS, uso de features)?
- ¿Riesgos principales y planes de mitigación?

### RESPUESTAS:
- **Prioridades principales**:
  1. Integración de IA en el flujo de análisis
  2. Generación inteligente de playlists (HAMMS + IA)
- **Quick wins**: Sistema de IA y playlists aportan máximo valor
- **Métricas de éxito**: (Por definir)
- **Riesgos**: (Por definir)

## 13) Extensibilidad y API

### PREGUNTAS:
- ¿Desean un sistema de plugins (hooks de importación/análisis/post‑proceso) o scripting en Python?
- ¿Se requiere una API embebida (local HTTP/IPC) para integraciones con otras apps?
- ¿Qué puntos de extensión priorizar (parsers, clasificadores, exportadores)?

### RESPUESTAS:
- **Sistema de plugins**: No necesario
- **API embebida**: No necesaria
- **Extensibilidad**: Mantener código simple y directo

## 14) Ideas de Nuevas Funcionalidades (para validar)

### PREGUNTAS:
- ¿Sugeridor de mezclas armónicas basado en key/BPM/energía con listas "compatibles"?
- ¿Generación de cue points automática (intros/outros, breakdowns) y marcadores en UI/reproductor?
- ¿Normalización de loudness por EBU R128/ReplayGain y análisis de picos/crest factor?
- ¿Visualizadores (espectrograma, tonal pitch class profile) y comparador A/B?
- ¿Clustering y recomendación por similitud/`src/genre_clustering.py` integrado en la UI?
- ¿Búsqueda avanzada con consultas guardadas y filtros combinables (por ejemplo: key ∈ {8A, 9A} y BPM 120–128)?
- ¿Descarga automática y sincronización de letras `.lrc`, con edición manual y offset por pista?
- ¿Exportación a Rekordbox XML/Serato/Traktor incluyendo grids, key, BPM y comentarios?

### RESPUESTAS - FUNCIONALIDADES CONFIRMADAS:
✅ **Funcionalidades a implementar**:
1. **Sugeridor de mezclas armónicas**: Basado en key/BPM/energía con listas de tracks compatibles
2. **Normalización de loudness**: EBU R128/ReplayGain con análisis de picos/crest factor
3. **Búsqueda avanzada**: Consultas guardadas y filtros combinables (ej: key ∈ {8A, 9A} AND BPM 120-128)

❌ **Funcionalidades NO requeridas**:
- Generación automática de cue points
- Visualizadores avanzados (espectrograma)
- Clustering automático en UI
- Descarga de letras .lrc
- Exportación a Rekordbox/Serato (solo M3U por ahora)

## 15) Observabilidad y Registros (`src/utils/logger.py`)

### PREGUNTAS:
- ¿Niveles de log configurables por módulo y rotación de archivos de log?
- ¿Reporte de errores con adjuntos (logs, versiones, SO) y botón "Enviar informe" opcional?
- ¿Panel interno de diagnósticos (estado de colas, workers, ffmpeg, DB)?

### RESPUESTAS:
- (Pendiente definir)

## 16) Configuración (`src/utils/config.py`, `config.yaml`)

### PREGUNTAS:
- ¿Editor de configuración en la UI con validaciones y perfiles (dev/test/prod)?
- ¿Soporte para overrides por proyecto/biblioteca y export/import de perfiles?

### RESPUESTAS:
- (Pendiente definir)

## 17) Compatibilidad y Formatos

### PREGUNTAS:
- ¿Formatos prioritarios (FLAC/ALAC/AAC/MP3/WAV/AIFF/OGG) y metadatos específicos por contenedor?
- ¿Soporte de CBR/VBR, sample rates poco comunes y archivos corruptos/incompletos?

### RESPUESTAS:
- **Formatos confirmados**: MP3, FLAC, ALAC, WAV, AIFF, M4A/AAC
- **Bitrate/Sample**: (Pendiente definir manejo de VBR y sample rates)

## 18) Cumplimiento y Legal

### PREGUNTAS:
- ¿Restricciones de licencias de códecs, patentes, uso de letras/arte?
- ¿Avisos o consentimientos necesarios dentro de la app?

### RESPUESTAS:
- (Pendiente definir)

## 19) Integración de IA en el Flujo de Importación

### PROPUESTA DE ANÁLISIS CON IA POST-IMPORTACIÓN:

#### **1. Clasificación Musical Avanzada**
- **Género/Subgénero**: Detección precisa (House→Deep House, Tech House, Progressive House, etc.)
- **Era/Década**: Clasificación temporal (90s House, Modern Techno, Classic Trance)
- **Estilo regional**: (Detroit Techno, UK Garage, Berlin Minimal, Ibiza House)
- **Influencias cruzadas**: Detectar fusiones (Afro-House, Latin-Tech, Melodic Techno)

#### **2. Análisis de Contenido Lírico**
- **Tema principal**: De qué trata la canción (amor, fiesta, social, instrumental)
- **Idioma detectado**: Español, inglés, instrumental, múltiple
- **Palabras clave**: Tags relevantes sin reproducir letra completa
- **Clasificación de contenido**: Explícito, limpio, radio-friendly
- **Hooks identificados**: Momentos clave vocales sin transcribir letra completa
- **Frases repetitivas**: Identificación de estribillo/hook principal

#### **3. Análisis de Mood/Energía Contextual**
- **Curva de energía**: Intro(bars)→Build→Drop→Breakdown→Outro con tiempos
- **Momento ideal de set**: Opening (warm-up), Peak Time, Closing, After-hours
- **Atmósfera**: Dark, Uplifting, Melodic, Aggressive, Chill, Hypnotic, Euphoric
- **Emoción dominante**: Clasificación emocional para matching de vibe
- **Intensidad dinámica**: Cambios de energía a lo largo del track

#### **4. Análisis Estructural para DJ**
- **Estructura detectada**: Intro(32 bars)→Verse→Chorus→Break con conteo exacto
- **Puntos de mezcla óptimos**: Mejores momentos para entrada/salida con timestamps
- **Elementos dominantes**: Vocal-driven, Bass-heavy, Percussion-focused, Melodic
- **Complejidad armónica**: Simple/Compleja para decisiones de layering
- **Densidad de elementos**: Minimal/Full para evaluar compatibilidad en mezclas
- **Presencia de breaks/drops**: Ubicación y duración para transiciones

#### **5. Similitud y Recomendaciones**
- **Tracks similares en biblioteca**: Por características sonoras, no solo BPM/Key
- **Combina bien con**: Sugerencias de siguiente track basadas en IA
- **Evitar mezclar con**: Incompatibilidades sonoras detectadas
- **Cluster automático**: Agrupar por "vibe" similar para sets coherentes
- **Distancia armónica**: Qué tan compatible es con otros tracks

#### **6. Análisis Técnico Avanzado**
- **Calidad de masterización**: Loudness war detection, headroom disponible
- **Rango dinámico**: LUFS integrado, para saber si necesita ganancia
- **Frecuencias dominantes**: Perfil de EQ para decisiones de mezcla
- **Presencia de sub-bass**: Crítico para sistemas de sonido grandes
- **Detección de problemas**: Clipping, problemas de fase, distorsión
- **Calidad del archivo**: Bitrate real vs declarado, compresión artifacts

#### **7. Metadata Inteligente**
- **Artistas similares**: Para discovery y búsqueda expandida
- **Sello discográfico**: Detectado o inferido del audio/metadata
- **Año de producción estimado**: Por características sonoras del mastering
- **Remixer/Version**: Detectar si es remix, edit, bootleg, original mix
- **Duplicados inteligentes**: Mismo track, diferente versión/calidad
- **Colaboraciones**: Detección de featuring no etiquetado

#### **8. Tags Contextuales para DJ Sets**
- **Situación ideal**: Club, Festival, Bar, Radio, Pool Party, Warm-up
- **Hora del día**: Daytime, Sunset, Peak Night, After-hours, Morning
- **Estación/Clima**: Summer anthem, Winter deep, Rainy mood, Spring vibes
- **Público objetivo**: Underground, Commercial, Mixed, Techno heads
- **Nivel de energía**: 1-10 para construcción de sets progresivos

### **IMPLEMENTACIÓN TÉCNICA PROPUESTA:**

```python
class AIAnalysisProcessor:
    """Procesador principal de análisis con IA post-importación"""
    
    def __init__(self):
        self.genre_classifier = GenreAIModel()
        self.mood_analyzer = MoodAIModel()
        self.structure_detector = StructureAIModel()
        self.similarity_engine = SimilarityAIModel()
        self.lyrics_analyzer = LyricsContextAIModel()
        self.quality_checker = AudioQualityAIModel()
        
    async def process_track(self, audio_file, existing_metadata):
        """Proceso completo de análisis con IA"""
        
        # Análisis paralelo para optimizar tiempo
        results = await asyncio.gather(
            self.analyze_genre(audio_file),
            self.analyze_mood(audio_file),
            self.detect_structure(audio_file),
            self.analyze_lyrics_context(audio_file),
            self.check_audio_quality(audio_file),
            self.generate_dj_recommendations(audio_file, existing_metadata)
        )
        
        # Consolidar resultados
        ai_analysis = {
            'genre_analysis': results[0],
            'mood_profile': results[1],
            'structure': results[2],
            'lyrics_context': results[3],
            'quality_metrics': results[4],
            'dj_recommendations': results[5],
            'timestamp': datetime.now(),
            'ai_version': self.get_version()
        }
        
        # Encontrar similitudes después del análisis básico
        ai_analysis['similar_tracks'] = await self.find_similar(
            audio_file, 
            ai_analysis, 
            existing_metadata
        )
        
        return ai_analysis
    
    async def analyze_genre(self, audio_file):
        """Clasificación detallada de género y subgénero"""
        # Implementación específica
        pass
    
    async def analyze_mood(self, audio_file):
        """Análisis de mood y energía contextual"""
        # Implementación específica
        pass
    
    async def detect_structure(self, audio_file):
        """Detección de estructura musical para DJs"""
        # Implementación específica
        pass
```

### **FASES DE IMPLEMENTACIÓN:**

#### **FASE 1 - MVP (1-2 semanas)**
- Género/subgénero básico
- Mood y energía general
- BPM/Key validation con IA
- Integración básica con flujo existente

#### **FASE 2 - Funcionalidad Core (3-4 semanas)**
- Análisis de estructura musical
- Similitud y clustering básico
- Tags contextuales para DJ sets
- UI para visualizar resultados de IA

#### **FASE 3 - Avanzado (5-6 semanas)**
- Análisis lírico contextual
- Recomendaciones de mezcla inteligentes
- Análisis de calidad técnica
- Puntos de mezcla automáticos

#### **FASE 4 - Optimización (continua)**
- Fine-tuning de modelos con feedback
- Optimización de performance
- Expansión de géneros soportados
- Integración con hardware DJ

### **MÉTRICAS DE ÉXITO:**
- Precisión de género: >90% en géneros principales
- Tiempo de análisis: <30 segundos por track
- Satisfacción de recomendaciones: >80% útiles
- Reducción de tiempo preparando sets: 40%

### **CONSIDERACIONES TÉCNICAS:**
- Modelos locales vs API cloud (privacidad vs performance)
- Caché de resultados para tracks analizados
- Actualización incremental cuando mejoren los modelos
- Fallback si el análisis de IA falla

## 20) Sistema Inteligente de Generación de Playlists

### GENERACIÓN DE PLAYLISTS COMBINANDO ANÁLISIS HAMMS + IA

#### **1. Tipos de Playlists Automáticas**

##### **A. Playlists Armónicas (Basadas en HAMMS)**
- **Viaje Armónico Progresivo**: Playlist que sigue el círculo de quintas
  - Ejemplo: 8A → 9A → 4A → 11A → 6A (movimientos de +1 o -1 en Camelot)
- **Energía Ascendente**: Mantiene compatibilidad armónica mientras sube BPM
  - Ejemplo: 122 BPM/5A → 124 BPM/5A → 126 BPM/12A → 128 BPM/12A
- **Mismo Key Journey**: Todas las canciones en la misma tonalidad, variando energía
- **Parallel Mix**: Alterna entre mayor/menor de la misma nota (8A ↔ 8B)
- **Energy Waves**: Sube y baja energía manteniendo coherencia armónica

##### **B. Playlists por Mood/Contexto (Basadas en IA)**
- **Opening Set**: Tracks con energía 1-4, mood: warm, atmospheric
- **Peak Time Journey**: Energía 7-10, mood: euphoric, driving
- **Sunset Session**: Mood: melodic, emotional, golden hour vibes
- **After Hours**: Dark, hypnotic, minimal, underground
- **Radio Show**: Clean versions, varied energy, vocal highlights

##### **C. Playlists Híbridas (HAMMS + IA)**
- **Smart Harmonic Journey**: Combina compatibilidad armónica con coherencia de género
- **Emotional Arc**: Sigue una narrativa emocional respetando armonía
- **Genre Evolution**: Transición entre géneros manteniendo key/BPM compatible
- **Crowd Reading**: Adapta energía según hora del día y tipo de venue

#### **2. Algoritmo de Generación de Playlists**

```python
class SmartPlaylistGenerator:
    """Generador inteligente de playlists combinando HAMMS + IA"""
    
    def __init__(self):
        self.hamms_analyzer = HAMMSAnalyzer()
        self.ai_analyzer = AIAnalyzer()
        self.graph_builder = HarmonicGraphBuilder()
        
    def generate_playlist(self, 
                         start_track=None,
                         duration_minutes=60,
                         playlist_type='smart_harmonic',
                         constraints=None):
        """
        Genera playlist inteligente basada en parámetros
        
        Args:
            start_track: Track inicial (opcional)
            duration_minutes: Duración objetivo de la playlist
            playlist_type: Tipo de playlist a generar
            constraints: Restricciones adicionales (BPM range, genres, etc)
        """
        
        if playlist_type == 'smart_harmonic':
            return self._generate_harmonic_journey(start_track, duration_minutes, constraints)
        elif playlist_type == 'mood_based':
            return self._generate_mood_playlist(constraints)
        elif playlist_type == 'energy_progression':
            return self._generate_energy_arc(start_track, duration_minutes)
        elif playlist_type == 'genre_journey':
            return self._generate_genre_evolution(start_track, constraints)
            
    def _generate_harmonic_journey(self, start_track, duration, constraints):
        """Genera playlist con viaje armónico inteligente"""
        
        playlist = []
        current_track = start_track or self._select_opener(constraints)
        total_duration = 0
        
        while total_duration < duration * 60:
            playlist.append(current_track)
            total_duration += current_track.duration
            
            # Encontrar siguiente track compatible
            candidates = self._find_compatible_tracks(
                current_track,
                method='harmonic_ai_hybrid'
            )
            
            # Aplicar filtros de IA
            candidates = self._filter_by_ai_compatibility(
                candidates,
                current_track,
                playlist_context=playlist[-3:]  # Últimos 3 tracks
            )
            
            # Scoring multi-criterio
            scores = self._calculate_transition_scores(
                current_track,
                candidates,
                factors={
                    'harmonic': 0.4,    # Compatibilidad HAMMS
                    'energy': 0.2,      # Progresión de energía
                    'genre': 0.2,       # Coherencia de género
                    'mood': 0.1,        # Continuidad de mood
                    'surprise': 0.1     # Factor sorpresa/variedad
                }
            )
            
            current_track = self._select_best_candidate(candidates, scores)
            
            if not current_track:
                break
                
        return self._optimize_playlist_flow(playlist)
    
    def _find_compatible_tracks(self, track, method='harmonic_ai_hybrid'):
        """Encuentra tracks compatibles usando HAMMS + IA"""
        
        compatible = []
        
        # Compatibilidad armónica (HAMMS)
        harmonic_matches = self._get_harmonic_compatible(track)
        
        # Compatibilidad por IA (género, mood, energía)
        ai_matches = self._get_ai_compatible(track)
        
        if method == 'harmonic_ai_hybrid':
            # Intersección ponderada de ambos métodos
            compatible = self._weighted_merge(
                harmonic_matches,
                ai_matches,
                weights={'harmonic': 0.6, 'ai': 0.4}
            )
        
        return compatible
    
    def _get_harmonic_compatible(self, track):
        """Obtiene tracks armónicamente compatibles"""
        
        camelot_key = track.camelot_key
        bpm = track.bpm
        
        # Reglas de compatibilidad Camelot
        compatible_keys = [
            camelot_key,                    # Misma key
            self._shift_camelot(camelot_key, +1),  # +1 en el círculo
            self._shift_camelot(camelot_key, -1),  # -1 en el círculo
            self._toggle_major_minor(camelot_key)  # Mayor/menor
        ]
        
        # BPM compatible (±6% o pitch adjust)
        bpm_range = (bpm * 0.94, bpm * 1.06)
        
        return self.db.query_tracks(
            camelot_keys=compatible_keys,
            bpm_range=bpm_range
        )
```

#### **3. Parámetros de Configuración de Playlists**

##### **Parámetros HAMMS (Armónicos)**
- **Compatibilidad de Key**: Estricta, Flexible, Experimental
- **Rango BPM**: ±3%, ±6%, ±10%, Sin límite
- **Transiciones**: Suaves (±1 Camelot), Moderadas (±2), Agresivas (±3+)
- **Modo de mezcla**: In-key, Cross-key, Energy-based

##### **Parámetros IA (Contextuales)**
- **Coherencia de género**: Alta, Media, Baja, Ecléctica
- **Progresión de energía**: Linear, Waves, Random, Custom curve
- **Mood consistency**: Mantener mood, Evolución gradual, Contraste
- **Diversidad**: Repetir artistas (Sí/No), Variedad de años, Estilos

##### **Parámetros Híbridos**
- **Balance HAMMS/IA**: 80/20, 60/40, 50/50, 40/60, 20/80
- **Factor sorpresa**: 0-10% tracks "wildcards" que rompen reglas
- **Inteligencia adaptativa**: Aprender de playlists editadas manualmente

#### **4. Templates de Playlists Predefinidos**

```python
PLAYLIST_TEMPLATES = {
    'warm_up_set': {
        'duration': 90,
        'energy_range': (1, 5),
        'bpm_progression': 'ascending_slow',
        'mood': ['deep', 'atmospheric', 'groovy'],
        'harmonic_strictness': 'flexible'
    },
    
    'peak_time_set': {
        'duration': 60,
        'energy_range': (7, 10),
        'bpm_range': (126, 132),
        'mood': ['driving', 'euphoric', 'powerful'],
        'harmonic_strictness': 'strict'
    },
    
    'closing_set': {
        'duration': 120,
        'energy_progression': 'descending_waves',
        'bpm_range': (120, 128),
        'mood': ['emotional', 'melodic', 'nostalgic'],
        'allow_vocals': True
    },
    
    'radio_show': {
        'duration': 60,
        'segments': [
            {'duration': 15, 'energy': 'medium', 'vocal_focus': True},
            {'duration': 20, 'energy': 'high', 'genre': 'consistent'},
            {'duration': 20, 'energy': 'peak', 'crowd_pleasers': True},
            {'duration': 5, 'energy': 'cool_down', 'memorable': True}
        ]
    },
    
    'discovery_journey': {
        'duration': 120,
        'diversity': 'maximum',
        'include_new': True,
        'genre_evolution': 'gradual',
        'surprise_factor': 0.15
    }
}
```

#### **5. UI/UX para Generación de Playlists**

##### **Wizard de Creación**
1. **Selección de tipo**: Visual cards con descripción
2. **Punto de inicio**: 
   - Track semilla
   - Mood/género
   - Evento/contexto
3. **Ajustes finos**:
   - Sliders para balance HAMMS/IA
   - Duración objetivo
   - Restricciones (excluir géneros, artistas)
4. **Preview**: Vista previa del journey armónico/energético
5. **Edición post-generación**: Drag & drop para reordenar

##### **Visualización de Playlist**
- **Gráfico de energía**: Curva de energía a lo largo del tiempo
- **Mapa armónico**: Visualización del viaje en círculo de Camelot
- **Timeline de moods**: Cambios de atmósfera durante el set
- **Compatibilidad visual**: Colores indicando qué tan bien fluye cada transición

#### **6. Machine Learning para Mejora Continua**

```python
class PlaylistLearner:
    """Aprende de las preferencias del usuario"""
    
    def learn_from_edits(self, original_playlist, edited_playlist):
        """Aprende cuando el usuario edita una playlist generada"""
        
        # Analizar qué cambió
        changes = self._analyze_changes(original_playlist, edited_playlist)
        
        # Actualizar pesos de preferencias
        self._update_preference_weights(changes)
        
        # Entrenar modelo de transiciones preferidas
        self._train_transition_model(edited_playlist)
    
    def learn_from_playback(self, playlist, skip_data):
        """Aprende de qué tracks se saltan o repiten"""
        
        for skip in skip_data:
            self._negative_feedback(
                track=skip.track,
                context=skip.previous_tracks,
                reason=self._infer_skip_reason(skip)
            )
    
    def suggest_improvements(self, playlist):
        """Sugiere mejoras basadas en aprendizaje"""
        
        suggestions = []
        
        for i, track in enumerate(playlist):
            if i > 0:
                transition_score = self._evaluate_transition(
                    playlist[i-1], 
                    track
                )
                
                if transition_score < 0.7:
                    alternatives = self._find_better_alternatives(
                        playlist[i-1],
                        track,
                        context=playlist
                    )
                    suggestions.append({
                        'position': i,
                        'current': track,
                        'alternatives': alternatives,
                        'reason': self._explain_suggestion()
                    })
        
        return suggestions
```

#### **7. Exportación y Compartir**

##### **Formatos de Exportación**
- **M3U/M3U8**: Compatible con la mayoría de reproductores
- **Rekordbox XML**: Con cue points y metadata completa
- **Serato Crate**: Para importar directo a Serato
- **Traktor NML**: Playlist nativa de Traktor
- **Spotify/Apple Music**: Crear playlist en streaming (si están disponibles)
- **PDF Setlist**: Para imprimir con notas de transición
- **JSON**: Para backup y compartir con otros usuarios

##### **Compartir y Colaborar**
- **URL compartible**: Link público de la playlist
- **QR Code**: Para compartir en eventos
- **Colaboración**: Permitir edición colaborativa
- **Versiones**: Historial de cambios en playlists
- **Comentarios**: Notas en transiciones específicas

#### **8. Métricas y Analytics**

```python
class PlaylistAnalytics:
    """Análisis de calidad de playlists"""
    
    def analyze_playlist(self, playlist):
        return {
            'harmonic_flow_score': self._calculate_harmonic_flow(playlist),
            'energy_coherence': self._analyze_energy_progression(playlist),
            'genre_diversity': self._calculate_genre_distribution(playlist),
            'mood_consistency': self._evaluate_mood_flow(playlist),
            'transition_quality': self._rate_all_transitions(playlist),
            'predicted_crowd_response': self._predict_audience_engagement(playlist),
            'weak_points': self._identify_problem_transitions(playlist),
            'highlights': self._find_peak_moments(playlist),
            'overall_score': self._calculate_overall_quality(playlist)
        }
```

### **CASOS DE USO ESPECÍFICOS PARA DJs**

1. **Pre-evento**: Generar múltiples playlists para diferentes momentos de la noche
2. **B2B Sets**: Playlists que funcionan bien para mezclar con otro DJ
3. **Residencias**: Evitar repetición excesiva entre semanas
4. **Festivales**: Alta energía, crowd-pleasers, momentos memorables
5. **Streaming**: Sets para grabar con transiciones perfectas
6. **Practice**: Playlists para practicar técnicas específicas

### **MÉTRICAS DE ÉXITO**
- Playlists usadas sin modificación: >60%
- Promedio de ediciones por playlist: <3 tracks
- Tiempo ahorrado preparando sets: 70%
- Satisfacción con transiciones: >85%
- Descubrimiento de nuevas combinaciones: >5 por playlist

---

### Guía de Uso en Entrevistas
- Selecciona 3–5 áreas prioritarias y limita la sesión a 30–45 minutos.
- Para cada respuesta, pide ejemplos concretos, archivos de muestra y métricas deseadas.
- Anota bloqueadores y dependencias; convierte acuerdos en tickets accionables con criterios de aceptación.

### Checklist de Salida
- Metas claras por release (1–2 semanas) con dueños.
- Métricas y umbrales definidos (p. ej., "analizar 10k pistas < 2h").
- Datos y assets de prueba adjuntos en `resources/`.
- Riesgos y decisiones documentadas (archivo `AUDIO_FLOW.md`/`HAMMS_VERIFICATION.md`).
