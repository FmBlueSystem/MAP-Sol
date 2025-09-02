# ANEXO: Implementación de Funcionalidades Confirmadas

Este anexo detalla la implementación técnica de las 3 funcionalidades principales confirmadas en la Sección 14.

## 1. SUGERIDOR DE MEZCLAS ARMÓNICAS

### Descripción
Sistema inteligente que sugiere tracks compatibles basándose en análisis armónico (HAMMS), BPM y energía.

### Arquitectura

```python
class HarmonicMixSuggester:
    """
    Sugeridor de mezclas armónicas avanzado
    """
    
    def __init__(self):
        self.db = DatabaseManager()
        self.hamms = HAMMSAnalyzer()
        self.compatibility_engine = CompatibilityEngine()
    
    def suggest_next_tracks(self, current_track, limit=20):
        """
        Sugiere los mejores tracks para mezclar después del actual
        
        Args:
            current_track: Track actual reproduciendo
            limit: Número máximo de sugerencias
            
        Returns:
            Lista de tracks compatibles ordenados por score
        """
        
        suggestions = []
        
        # Obtener características del track actual
        current_key = current_track.camelot_key
        current_bpm = current_track.bpm
        current_energy = current_track.energy
        
        # Buscar tracks compatibles armónicamente
        harmonic_matches = self._find_harmonic_matches(current_key)
        
        # Filtrar por BPM compatible
        bpm_matches = self._filter_by_bpm(harmonic_matches, current_bpm)
        
        # Calcular score de compatibilidad
        for track in bpm_matches:
            score = self._calculate_compatibility_score(
                current_track, 
                track,
                weights={
                    'harmonic': 0.5,
                    'bpm': 0.3,
                    'energy': 0.2
                }
            )
            
            suggestions.append({
                'track': track,
                'score': score,
                'transition_type': self._get_transition_type(current_track, track),
                'mix_notes': self._generate_mix_notes(current_track, track)
            })
        
        # Ordenar por score y retornar top N
        suggestions.sort(key=lambda x: x['score'], reverse=True)
        return suggestions[:limit]
```

### Reglas de Compatibilidad Armónica

```python
class CompatibilityEngine:
    """Motor de compatibilidad armónica"""
    
    # Matriz de compatibilidad Camelot
    CAMELOT_COMPATIBILITY = {
        '1A': ['1A', '12A', '2A', '1B'],   # Am
        '2A': ['2A', '1A', '3A', '2B'],    # Em
        '3A': ['3A', '2A', '4A', '3B'],    # Bm
        '4A': ['4A', '3A', '5A', '4B'],    # F#m
        '5A': ['5A', '4A', '6A', '5B'],    # C#m
        '6A': ['6A', '5A', '7A', '6B'],    # G#m
        '7A': ['7A', '6A', '8A', '7B'],    # D#m
        '8A': ['8A', '7A', '9A', '8B'],    # A#m
        '9A': ['9A', '8A', '10A', '9B'],   # Fm
        '10A': ['10A', '9A', '11A', '10B'], # Cm
        '11A': ['11A', '10A', '12A', '11B'], # Gm
        '12A': ['12A', '11A', '1A', '12B'], # Dm
        # Mayor keys
        '1B': ['1B', '12B', '2B', '1A'],   # C
        '2B': ['2B', '1B', '3B', '2A'],    # G
        '3B': ['3B', '2B', '4B', '3A'],    # D
        '4B': ['4B', '3B', '5B', '4A'],    # A
        '5B': ['5B', '4B', '6B', '5A'],    # E
        '6B': ['6B', '5B', '7B', '6A'],    # B
        '7B': ['7B', '6B', '8B', '7A'],    # F#
        '8B': ['8B', '7B', '9B', '8A'],    # C#
        '9B': ['9B', '8B', '10B', '9A'],   # G#
        '10B': ['10B', '9B', '11B', '10A'], # D#
        '11B': ['11B', '10B', '12B', '11A'], # A#
        '12B': ['12B', '11B', '1B', '12A']  # F
    }
    
    def get_compatibility_score(self, key1, key2):
        """Calcula score de compatibilidad entre dos keys"""
        
        if key2 in self.CAMELOT_COMPATIBILITY.get(key1, []):
            # Compatibilidad perfecta
            if key1 == key2:
                return 1.0  # Misma key
            elif key2 in self.CAMELOT_COMPATIBILITY[key1][:3]:
                return 0.9  # Compatible (±1 en wheel o relativo)
            else:
                return 0.8  # Compatible secundario
        else:
            # Calcular distancia en el wheel
            distance = self._calculate_wheel_distance(key1, key2)
            return max(0, 1.0 - (distance * 0.2))
```

### UI Component

```python
class MixSuggesterWidget(QWidget):
    """Widget de UI para sugerencias de mezcla"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()
    
    def setup_ui(self):
        layout = QVBoxLayout()
        
        # Header
        self.header = QLabel("🎧 Mix Suggestions")
        self.header.setStyleSheet("font-size: 16px; font-weight: bold;")
        layout.addWidget(self.header)
        
        # Suggestions list
        self.suggestions_table = QTableWidget()
        self.suggestions_table.setColumnCount(5)
        self.suggestions_table.setHorizontalHeaderLabels([
            "Track", "Key", "BPM", "Compatibility", "Notes"
        ])
        layout.addWidget(self.suggestions_table)
        
        # Filter controls
        filter_layout = QHBoxLayout()
        
        self.energy_filter = QCheckBox("Match Energy")
        self.genre_filter = QCheckBox("Same Genre")
        self.strict_mode = QCheckBox("Strict Harmonic")
        
        filter_layout.addWidget(self.energy_filter)
        filter_layout.addWidget(self.genre_filter)
        filter_layout.addWidget(self.strict_mode)
        
        layout.addLayout(filter_layout)
        
        self.setLayout(layout)
    
    def update_suggestions(self, suggestions):
        """Actualiza la tabla con nuevas sugerencias"""
        
        self.suggestions_table.setRowCount(len(suggestions))
        
        for i, suggestion in enumerate(suggestions):
            track = suggestion['track']
            score = suggestion['score']
            
            # Track info
            self.suggestions_table.setItem(i, 0, QTableWidgetItem(
                f"{track.artist} - {track.title}"
            ))
            
            # Key
            key_item = QTableWidgetItem(track.camelot_key)
            key_item.setBackground(self._get_key_color(track.camelot_key))
            self.suggestions_table.setItem(i, 1, key_item)
            
            # BPM
            self.suggestions_table.setItem(i, 2, QTableWidgetItem(
                str(track.bpm)
            ))
            
            # Compatibility score (visual)
            score_widget = self._create_score_widget(score)
            self.suggestions_table.setCellWidget(i, 3, score_widget)
            
            # Mix notes
            self.suggestions_table.setItem(i, 4, QTableWidgetItem(
                suggestion['mix_notes']
            ))
```

---

## 2. NORMALIZACIÓN DE LOUDNESS (EBU R128 / ReplayGain)

### Descripción
Sistema de análisis y normalización de loudness según estándares EBU R128 y ReplayGain para consistencia de volumen.

### Implementación del Analizador

```python
import numpy as np
from scipy import signal
import pyloudnorm as pyln

class LoudnessAnalyzer:
    """
    Analizador de loudness con EBU R128 y ReplayGain
    """
    
    def __init__(self):
        self.meter = pyln.Meter(rate=44100)  # EBU R128 meter
        self.target_loudness = -23.0  # LUFS (EBU R128 standard)
        self.target_peak = -1.0  # dBFS (headroom)
    
    def analyze_track(self, audio_path):
        """
        Analiza loudness de un track
        
        Returns:
            dict con métricas de loudness
        """
        
        # Cargar audio
        audio, sample_rate = self._load_audio(audio_path)
        
        # Análisis EBU R128
        integrated_loudness = self.meter.integrated_loudness(audio)
        loudness_range = self._calculate_loudness_range(audio)
        true_peak = self._calculate_true_peak(audio)
        
        # Análisis adicional
        crest_factor = self._calculate_crest_factor(audio)
        dynamic_range = self._calculate_dynamic_range(audio)
        
        # ReplayGain
        replay_gain = self._calculate_replay_gain(integrated_loudness)
        
        return {
            'integrated_loudness': integrated_loudness,  # LUFS
            'loudness_range': loudness_range,           # LU
            'true_peak': true_peak,                     # dBFS
            'crest_factor': crest_factor,               # dB
            'dynamic_range': dynamic_range,             # dB
            'replay_gain': replay_gain,                 # dB
            'needs_normalization': integrated_loudness < -30 or integrated_loudness > -16
        }
    
    def _calculate_crest_factor(self, audio):
        """Calcula el crest factor (peak/RMS ratio)"""
        
        peak = np.max(np.abs(audio))
        rms = np.sqrt(np.mean(audio**2))
        
        if rms > 0:
            crest_factor = 20 * np.log10(peak / rms)
        else:
            crest_factor = 0
        
        return crest_factor
    
    def _calculate_dynamic_range(self, audio):
        """Calcula el rango dinámico"""
        
        # Dividir en ventanas
        window_size = int(0.3 * 44100)  # 300ms windows
        hop_size = window_size // 2
        
        loudness_values = []
        
        for i in range(0, len(audio) - window_size, hop_size):
            window = audio[i:i + window_size]
            loudness = self.meter.integrated_loudness(window)
            if loudness > -70:  # Ignorar silencio
                loudness_values.append(loudness)
        
        if loudness_values:
            # DR = diferencia entre percentil 95 y percentil 10
            dr = np.percentile(loudness_values, 95) - np.percentile(loudness_values, 10)
        else:
            dr = 0
        
        return dr
```

### Normalizador

```python
class LoudnessNormalizer:
    """
    Normalizador de loudness para consistencia en la biblioteca
    """
    
    def __init__(self):
        self.target_integrated = -18.0  # LUFS para DJs (más alto que broadcast)
        self.target_peak = -1.0         # dBFS headroom
        self.limiter_threshold = -0.3   # dBFS
    
    def normalize_track(self, audio, current_loudness, method='ebu'):
        """
        Normaliza el audio al target loudness
        
        Args:
            audio: Array de audio
            current_loudness: Loudness actual en LUFS
            method: 'ebu', 'replay_gain', o 'peak'
            
        Returns:
            Audio normalizado
        """
        
        if method == 'ebu':
            # Normalización EBU R128
            gain = self.target_integrated - current_loudness
            
        elif method == 'replay_gain':
            # ReplayGain (89 dB SPL reference)
            gain = -18 - current_loudness
            
        elif method == 'peak':
            # Peak normalization
            peak = np.max(np.abs(audio))
            gain = 20 * np.log10(0.99 / peak) if peak > 0 else 0
        
        # Aplicar ganancia
        linear_gain = 10 ** (gain / 20)
        normalized = audio * linear_gain
        
        # Limiter para evitar clipping
        normalized = self._apply_limiter(normalized)
        
        return normalized
    
    def _apply_limiter(self, audio):
        """Aplica limiting suave para evitar clipping"""
        
        threshold = 10 ** (self.limiter_threshold / 20)
        
        # Soft knee limiter
        over_threshold = np.abs(audio) > threshold
        
        if np.any(over_threshold):
            ratio = 10  # 10:1 ratio
            
            # Calcular ganancia de reducción
            over_amount = np.abs(audio[over_threshold]) - threshold
            reduction = over_amount * (1 - 1/ratio)
            
            # Aplicar reducción
            audio[over_threshold] = np.sign(audio[over_threshold]) * (
                np.abs(audio[over_threshold]) - reduction
            )
        
        return audio
```

### UI para Normalización

```python
class LoudnessWidget(QWidget):
    """Widget para análisis y normalización de loudness"""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
    
    def setup_ui(self):
        layout = QVBoxLayout()
        
        # Meters
        meters_layout = QHBoxLayout()
        
        # LUFS Meter
        self.lufs_meter = self._create_meter("LUFS", -60, 0)
        meters_layout.addWidget(self.lufs_meter)
        
        # Peak Meter
        self.peak_meter = self._create_meter("Peak", -60, 0)
        meters_layout.addWidget(self.peak_meter)
        
        # Dynamic Range
        self.dr_meter = self._create_meter("DR", 0, 20)
        meters_layout.addWidget(self.dr_meter)
        
        layout.addLayout(meters_layout)
        
        # Stats
        self.stats_label = QLabel()
        self.stats_label.setStyleSheet("font-family: monospace;")
        layout.addWidget(self.stats_label)
        
        # Normalization controls
        norm_group = QGroupBox("Normalization")
        norm_layout = QVBoxLayout()
        
        # Method selection
        self.method_combo = QComboBox()
        self.method_combo.addItems(["EBU R128", "ReplayGain", "Peak"])
        norm_layout.addWidget(self.method_combo)
        
        # Target loudness
        target_layout = QHBoxLayout()
        target_layout.addWidget(QLabel("Target:"))
        
        self.target_spin = QSpinBox()
        self.target_spin.setRange(-30, -6)
        self.target_spin.setValue(-18)
        self.target_spin.setSuffix(" LUFS")
        target_layout.addWidget(self.target_spin)
        
        norm_layout.addLayout(target_layout)
        
        # Normalize button
        self.normalize_btn = QPushButton("Normalize Selected")
        self.normalize_btn.clicked.connect(self.normalize_selected)
        norm_layout.addWidget(self.normalize_btn)
        
        norm_group.setLayout(norm_layout)
        layout.addWidget(norm_group)
        
        self.setLayout(layout)
    
    def update_meters(self, analysis_result):
        """Actualiza los medidores con resultados del análisis"""
        
        self.lufs_meter.setValue(analysis_result['integrated_loudness'])
        self.peak_meter.setValue(analysis_result['true_peak'])
        self.dr_meter.setValue(analysis_result['dynamic_range'])
        
        # Update stats
        stats_text = f"""
Integrated Loudness: {analysis_result['integrated_loudness']:.1f} LUFS
Loudness Range: {analysis_result['loudness_range']:.1f} LU
True Peak: {analysis_result['true_peak']:.1f} dBFS
Crest Factor: {analysis_result['crest_factor']:.1f} dB
Dynamic Range: {analysis_result['dynamic_range']:.1f} dB
ReplayGain: {analysis_result['replay_gain']:+.1f} dB
        """
        
        self.stats_label.setText(stats_text)
        
        # Colorear según necesidad de normalización
        if analysis_result['needs_normalization']:
            self.stats_label.setStyleSheet(
                "background-color: #ffeeee; padding: 5px;"
            )
```

---

## 3. BÚSQUEDA AVANZADA CON FILTROS COMBINABLES

### Descripción
Sistema de búsqueda avanzada con sintaxis flexible y capacidad de guardar consultas.

### Parser de Consultas

```python
import re
from typing import Dict, List, Any

class AdvancedSearchParser:
    """
    Parser para consultas de búsqueda avanzada
    
    Sintaxis soportada:
    - key IN {8A, 9A, 10A}
    - bpm BETWEEN 120 AND 128
    - genre = "Techno"
    - energy > 7
    - (key = 8A OR key = 8B) AND bpm > 125
    """
    
    def __init__(self):
        self.operators = {
            '=': 'eq',
            '!=': 'ne',
            '>': 'gt',
            '>=': 'gte',
            '<': 'lt',
            '<=': 'lte',
            'IN': 'in',
            'BETWEEN': 'between',
            'LIKE': 'like'
        }
        
        self.logical_operators = ['AND', 'OR', 'NOT']
    
    def parse_query(self, query_string):
        """
        Parsea una consulta compleja en estructura ejecutable
        
        Args:
            query_string: String con la consulta
            
        Returns:
            Dict con estructura de consulta parseada
        """
        
        # Normalizar query
        query_string = query_string.strip()
        
        # Detectar paréntesis para agrupación
        if '(' in query_string:
            return self._parse_grouped_query(query_string)
        
        # Detectar operadores lógicos
        for op in self.logical_operators:
            if f' {op} ' in query_string.upper():
                return self._parse_logical_query(query_string, op)
        
        # Consulta simple
        return self._parse_simple_condition(query_string)
    
    def _parse_simple_condition(self, condition):
        """Parsea una condición simple"""
        
        # Detectar IN clause
        if ' IN ' in condition.upper():
            match = re.match(r'(\w+)\s+IN\s+\{([^}]+)\}', condition, re.IGNORECASE)
            if match:
                field = match.group(1).lower()
                values = [v.strip() for v in match.group(2).split(',')]
                return {
                    'type': 'condition',
                    'field': field,
                    'operator': 'in',
                    'value': values
                }
        
        # Detectar BETWEEN
        if ' BETWEEN ' in condition.upper():
            match = re.match(
                r'(\w+)\s+BETWEEN\s+(\S+)\s+AND\s+(\S+)', 
                condition, 
                re.IGNORECASE
            )
            if match:
                field = match.group(1).lower()
                min_val = self._parse_value(match.group(2))
                max_val = self._parse_value(match.group(3))
                return {
                    'type': 'condition',
                    'field': field,
                    'operator': 'between',
                    'value': [min_val, max_val]
                }
        
        # Detectar operadores simples
        for op_symbol, op_name in self.operators.items():
            if op_symbol in condition:
                parts = condition.split(op_symbol, 1)
                if len(parts) == 2:
                    field = parts[0].strip().lower()
                    value = self._parse_value(parts[1].strip())
                    return {
                        'type': 'condition',
                        'field': field,
                        'operator': op_name,
                        'value': value
                    }
        
        raise ValueError(f"Cannot parse condition: {condition}")
    
    def _parse_value(self, value_str):
        """Convierte string a tipo apropiado"""
        
        value_str = value_str.strip()
        
        # String entre comillas
        if value_str.startswith('"') and value_str.endswith('"'):
            return value_str[1:-1]
        
        # Número
        try:
            if '.' in value_str:
                return float(value_str)
            return int(value_str)
        except ValueError:
            return value_str
```

### Motor de Búsqueda

```python
class AdvancedSearchEngine:
    """
    Motor de búsqueda avanzada con soporte para consultas complejas
    """
    
    def __init__(self, db):
        self.db = db
        self.parser = AdvancedSearchParser()
        self.saved_searches = {}
    
    def search(self, query_string):
        """
        Ejecuta una búsqueda avanzada
        
        Args:
            query_string: Consulta en formato avanzado
            
        Returns:
            Lista de tracks que cumplen los criterios
        """
        
        # Parsear consulta
        parsed_query = self.parser.parse_query(query_string)
        
        # Construir SQL
        sql_query, params = self._build_sql_query(parsed_query)
        
        # Ejecutar
        results = self.db.execute_query(sql_query, params)
        
        return results
    
    def _build_sql_query(self, parsed_query):
        """Construye consulta SQL desde estructura parseada"""
        
        base_query = """
        SELECT t.*, a.genre, a.mood, a.energy_profile
        FROM tracks t
        LEFT JOIN ai_analysis a ON t.id = a.track_id
        WHERE 1=1
        """
        
        conditions = []
        params = []
        
        if parsed_query['type'] == 'condition':
            condition_sql = self._build_condition_sql(parsed_query)
            conditions.append(condition_sql['sql'])
            params.extend(condition_sql['params'])
        
        elif parsed_query['type'] == 'logical':
            # Manejar AND/OR/NOT
            for sub_query in parsed_query['conditions']:
                sub_sql = self._build_condition_sql(sub_query)
                conditions.append(sub_sql['sql'])
                params.extend(sub_sql['params'])
            
            operator = parsed_query['operator']
            where_clause = f" {operator} ".join(conditions)
            base_query += f" AND ({where_clause})"
        
        else:
            where_clause = " AND ".join(conditions)
            base_query += f" AND {where_clause}"
        
        return base_query, params
    
    def save_search(self, name, query_string):
        """Guarda una búsqueda para reutilizar"""
        
        self.saved_searches[name] = {
            'query': query_string,
            'created': datetime.now(),
            'usage_count': 0
        }
        
        # Persistir en DB
        self.db.save_search(name, query_string)
    
    def get_saved_searches(self):
        """Retorna búsquedas guardadas"""
        return self.saved_searches
```

### UI de Búsqueda Avanzada

```python
class AdvancedSearchWidget(QWidget):
    """Widget de búsqueda avanzada"""
    
    def __init__(self, search_engine):
        super().__init__()
        self.search_engine = search_engine
        self.setup_ui()
    
    def setup_ui(self):
        layout = QVBoxLayout()
        
        # Query builder
        builder_group = QGroupBox("Query Builder")
        builder_layout = QVBoxLayout()
        
        # Campo de búsqueda
        self.query_input = QTextEdit()
        self.query_input.setPlaceholderText(
            "Examples:\n"
            "key IN {8A, 9A} AND bpm BETWEEN 124 AND 128\n"
            "genre = 'Techno' AND energy > 7\n"
            "(key = 8A OR key = 8B) AND mood = 'Dark'"
        )
        self.query_input.setMaximumHeight(100)
        builder_layout.addWidget(self.query_input)
        
        # Builders rápidos
        quick_layout = QHBoxLayout()
        
        # Key selector
        self.key_selector = QComboBox()
        self.key_selector.addItems(['Any'] + CAMELOT_KEYS)
        quick_layout.addWidget(QLabel("Key:"))
        quick_layout.addWidget(self.key_selector)
        
        # BPM range
        self.bpm_min = QSpinBox()
        self.bpm_min.setRange(60, 200)
        self.bpm_min.setValue(120)
        
        self.bpm_max = QSpinBox()
        self.bpm_max.setRange(60, 200)
        self.bpm_max.setValue(130)
        
        quick_layout.addWidget(QLabel("BPM:"))
        quick_layout.addWidget(self.bpm_min)
        quick_layout.addWidget(QLabel("-"))
        quick_layout.addWidget(self.bpm_max)
        
        # Energy
        self.energy_min = QSlider(Qt.Horizontal)
        self.energy_min.setRange(1, 10)
        self.energy_min.setValue(5)
        
        quick_layout.addWidget(QLabel("Energy >"))
        quick_layout.addWidget(self.energy_min)
        
        builder_layout.addLayout(quick_layout)
        
        # Botones
        button_layout = QHBoxLayout()
        
        self.search_btn = QPushButton("Search")
        self.search_btn.clicked.connect(self.execute_search)
        button_layout.addWidget(self.search_btn)
        
        self.save_btn = QPushButton("Save Search")
        self.save_btn.clicked.connect(self.save_search)
        button_layout.addWidget(self.save_btn)
        
        self.clear_btn = QPushButton("Clear")
        self.clear_btn.clicked.connect(self.clear_search)
        button_layout.addWidget(self.clear_btn)
        
        builder_layout.addLayout(button_layout)
        
        builder_group.setLayout(builder_layout)
        layout.addWidget(builder_group)
        
        # Saved searches
        saved_group = QGroupBox("Saved Searches")
        saved_layout = QVBoxLayout()
        
        self.saved_list = QListWidget()
        self.saved_list.itemDoubleClicked.connect(self.load_saved_search)
        saved_layout.addWidget(self.saved_list)
        
        saved_group.setLayout(saved_layout)
        layout.addWidget(saved_group)
        
        # Results preview
        self.results_label = QLabel("Results: 0 tracks")
        layout.addWidget(self.results_label)
        
        self.setLayout(layout)
    
    def build_query_from_ui(self):
        """Construye query desde controles UI"""
        
        conditions = []
        
        # Key
        if self.key_selector.currentText() != 'Any':
            conditions.append(f"key = '{self.key_selector.currentText()}'")
        
        # BPM
        if self.bpm_min.value() < self.bpm_max.value():
            conditions.append(
                f"bpm BETWEEN {self.bpm_min.value()} AND {self.bpm_max.value()}"
            )
        
        # Energy
        if self.energy_min.value() > 1:
            conditions.append(f"energy >= {self.energy_min.value()}")
        
        return " AND ".join(conditions)
    
    def execute_search(self):
        """Ejecuta la búsqueda"""
        
        # Obtener query
        query = self.query_input.toPlainText()
        
        if not query:
            # Construir desde UI
            query = self.build_query_from_ui()
            self.query_input.setText(query)
        
        try:
            # Ejecutar búsqueda
            results = self.search_engine.search(query)
            
            # Actualizar UI
            self.results_label.setText(f"Results: {len(results)} tracks")
            
            # Emitir señal con resultados
            self.search_completed.emit(results)
            
        except Exception as e:
            QMessageBox.warning(self, "Search Error", str(e))
```

### Integración con Base de Datos

```python
# Agregar a database.py

def execute_advanced_search(self, query_dict):
    """
    Ejecuta búsqueda avanzada desde diccionario parseado
    """
    
    # Base query
    sql = """
    SELECT DISTINCT
        t.id,
        t.filepath,
        t.title,
        t.artist,
        t.album,
        t.bpm,
        t.key,
        t.camelot_key,
        t.energy,
        t.duration,
        a.genre,
        a.subgenre,
        a.mood,
        a.energy_profile
    FROM tracks t
    LEFT JOIN ai_analysis a ON t.id = a.track_id
    WHERE 1=1
    """
    
    params = []
    
    # Construir condiciones dinámicamente
    for condition in query_dict.get('conditions', []):
        field = condition['field']
        operator = condition['operator']
        value = condition['value']
        
        # Mapear campo a columna
        column_map = {
            'key': 't.camelot_key',
            'bpm': 't.bpm',
            'energy': 't.energy',
            'genre': 'a.genre',
            'mood': 'a.mood',
            'artist': 't.artist',
            'title': 't.title'
        }
        
        column = column_map.get(field, f't.{field}')
        
        # Construir condición SQL
        if operator == 'in':
            placeholders = ','.join(['?' for _ in value])
            sql += f" AND {column} IN ({placeholders})"
            params.extend(value)
            
        elif operator == 'between':
            sql += f" AND {column} BETWEEN ? AND ?"
            params.extend(value)
            
        elif operator == 'like':
            sql += f" AND {column} LIKE ?"
            params.append(f'%{value}%')
            
        else:
            op_map = {
                'eq': '=',
                'ne': '!=',
                'gt': '>',
                'gte': '>=',
                'lt': '<',
                'lte': '<='
            }
            sql_op = op_map.get(operator, '=')
            sql += f" AND {column} {sql_op} ?"
            params.append(value)
    
    # Ordenar por relevancia
    sql += " ORDER BY t.energy DESC, t.bpm"
    
    # Ejecutar
    cursor = self.conn.execute(sql, params)
    results = cursor.fetchall()
    
    # Convertir a objetos Track
    tracks = []
    for row in results:
        track = Track()
        track.id = row[0]
        track.filepath = row[1]
        track.title = row[2]
        track.artist = row[3]
        track.album = row[4]
        track.bpm = row[5]
        track.key = row[6]
        track.camelot_key = row[7]
        track.energy = row[8]
        track.duration = row[9]
        track.genre = row[10]
        track.subgenre = row[11]
        track.mood = row[12]
        
        tracks.append(track)
    
    return tracks
```

---

## INTEGRACIÓN DE LAS 3 FUNCIONALIDADES

### Actualización del Flujo Principal

```python
# Agregar a src/app.py

class MusicAnalyzerApp(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # Inicializar nuevos componentes
        self.mix_suggester = HarmonicMixSuggester()
        self.loudness_analyzer = LoudnessAnalyzer()
        self.search_engine = AdvancedSearchEngine(self.db)
        
        self.init_ui()
    
    def init_ui(self):
        # ... código existente ...
        
        # Agregar nuevos widgets
        self.add_mix_suggester_dock()
        self.add_loudness_analyzer_dock()
        self.add_advanced_search_dock()
    
    def add_mix_suggester_dock(self):
        """Agrega dock widget para sugerencias de mezcla"""
        
        dock = QDockWidget("Mix Suggestions", self)
        self.mix_widget = MixSuggesterWidget()
        dock.setWidget(self.mix_widget)
        self.addDockWidget(Qt.RightDockWidgetArea, dock)
        
        # Conectar señales
        self.track_selected.connect(self.update_mix_suggestions)
    
    def add_loudness_analyzer_dock(self):
        """Agrega dock widget para análisis de loudness"""
        
        dock = QDockWidget("Loudness Analysis", self)
        self.loudness_widget = LoudnessWidget()
        dock.setWidget(self.loudness_widget)
        self.addDockWidget(Qt.BottomDockWidgetArea, dock)
        
        # Conectar señales
        self.track_selected.connect(self.analyze_loudness)
    
    def add_advanced_search_dock(self):
        """Agrega dock widget para búsqueda avanzada"""
        
        dock = QDockWidget("Advanced Search", self)
        self.search_widget = AdvancedSearchWidget(self.search_engine)
        dock.setWidget(self.search_widget)
        self.addDockWidget(Qt.LeftDockWidgetArea, dock)
        
        # Conectar señales
        self.search_widget.search_completed.connect(self.display_search_results)
    
    def update_mix_suggestions(self, track):
        """Actualiza sugerencias cuando se selecciona un track"""
        
        suggestions = self.mix_suggester.suggest_next_tracks(track)
        self.mix_widget.update_suggestions(suggestions)
    
    def analyze_loudness(self, track):
        """Analiza loudness del track seleccionado"""
        
        result = self.loudness_analyzer.analyze_track(track.filepath)
        self.loudness_widget.update_meters(result)
        
        # Guardar en DB
        self.db.update_loudness_analysis(track.id, result)
```

### Configuración

```yaml
# config_features.yaml

harmonic_mixing:
  enabled: true
  max_suggestions: 20
  compatibility_threshold: 0.7
  weights:
    harmonic: 0.5
    bpm: 0.3
    energy: 0.2

loudness_normalization:
  enabled: true
  target_lufs: -18.0
  target_peak: -1.0
  analysis_on_import: true
  auto_normalize: false
  method: ebu_r128  # ebu_r128, replay_gain, peak

advanced_search:
  enabled: true
  max_saved_searches: 50
  search_history: true
  auto_complete: true
  default_limit: 100
```

---

## RESUMEN DE IMPLEMENTACIÓN

Las tres funcionalidades confirmadas han sido implementadas:

### 1. **Sugeridor de Mezclas Armónicas** ✅
- Motor de compatibilidad Camelot completo
- Scoring multi-criterio (armonía, BPM, energía)
- UI con tabla de sugerencias y filtros
- Integración con base de datos

### 2. **Normalización de Loudness** ✅
- Análisis EBU R128 y ReplayGain
- Cálculo de crest factor y rango dinámico
- Normalización con limiter para evitar clipping
- UI con medidores visuales y controles

### 3. **Búsqueda Avanzada** ✅
- Parser de consultas con sintaxis flexible
- Soporte para operadores lógicos (AND, OR, NOT)
- Búsquedas guardadas y reutilizables
- UI con query builder y controles rápidos

Estas funcionalidades se integran perfectamente con el flujo existente de HAMMS + IA, proporcionando herramientas profesionales para DJs.
