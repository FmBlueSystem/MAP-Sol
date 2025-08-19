#!/usr/bin/env python3
"""
OpenAI GPT-4 Processor Ultimate - Versión con todas las correcciones
Incluye validación de ISRC, coherencia temporal y reglas mejoradas
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

# Cargar variables de entorno desde .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Importar módulos previos
from ai_enhancer import AIEnhancer
from known_tracks_database import validate_year, lookup_track

# OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️ Instalar OpenAI: pip install openai")


class UltimateOpenAIProcessor:
    """
    Procesador definitivo con todas las validaciones y correcciones
    """
    
    def __init__(self, api_key: Optional[str] = None):
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI no está instalado")
        
        # Obtener API key
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("No se encontró OPENAI_API_KEY")
        
        # Inicializar cliente
        self.client = OpenAI(api_key=self.api_key)
        self.ai_enhancer = AIEnhancer()
        
        # Configuración optimizada
        self.model = "gpt-4-turbo-preview"
        self.temperature = 0.5
        self.max_tokens = 2500
        
        # Mapeos mejorados con coherencia temporal
        self.genre_rules = self._init_enhanced_genre_rules()
        self.subgenre_by_era = self._init_subgenre_by_era()
        self.context_by_year = self._init_context_by_year()
        
    def parse_isrc(self, isrc: str) -> Dict[str, Any]:
        """
        Parsea un código ISRC para extraer información
        
        ISRC format: CC-XXX-YY-NNNNN
        CC = Country code (2 chars)
        XXX = Registrant code (3 chars)
        YY = Year (2 digits)
        NNNNN = Unique recording ID (5 digits)
        """
        
        if not isrc:
            return {}
        
        # Limpiar ISRC (remover guiones si existen)
        isrc_clean = isrc.replace('-', '').upper()
        
        # Validar formato
        if not re.match(r'^[A-Z]{2}[A-Z0-9]{3}\d{7}$', isrc_clean):
            return {"valid": False, "error": "Invalid ISRC format"}
        
        try:
            country = isrc_clean[0:2]
            registrant = isrc_clean[2:5]
            year_code = isrc_clean[5:7]
            recording_id = isrc_clean[7:12]
            
            # Interpretar año (00-39 = 2000-2039, 40-99 = 1940-1999)
            year_int = int(year_code)
            if year_int <= 39:
                year = 2000 + year_int
            else:
                year = 1900 + year_int
            
            return {
                "valid": True,
                "country": country,
                "registrant": registrant,
                "year": year,
                "recording_id": recording_id,
                "original": isrc
            }
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def determine_real_year(self, metadata: Dict) -> Tuple[int, str]:
        """
        Determina el año real de grabación vs el año de lanzamiento/compilación
        
        Returns:
            Tuple de (año_real, explicación)
        """
        
        # 0. Primero verificar en base de datos conocida
        artist = metadata.get('artist', '')
        title = metadata.get('title', '')
        
        # Obtener años desde ISRC y metadata
        isrc_year = None
        metadata_year = metadata.get('year')
        
        isrc = metadata.get('isrc')
        if isrc:
            isrc_data = self.parse_isrc(isrc)
            if isrc_data.get('valid'):
                isrc_year = isrc_data.get('year')
        
        # Validar con base de datos
        if artist and title:
            known_year, explanation = validate_year(
                artist, title, 
                isrc_year or 0, 
                metadata_year or 0
            )
            
            if known_year:
                return known_year, explanation
        
        # 1. Si no está en la base de datos, usar ISRC
        if isrc_year:
            # Comparar con año en metadata
            if metadata_year and abs(metadata_year - isrc_year) > 2:
                # Diferencia significativa, verificar si es compilación
                album = metadata.get('album', '').lower()
                compilation_keywords = ['greatest hits', 'best of', 'collection', 'anthology', 
                                      'essential', 'ultimate', 'gold', 'classics', 'retrospective',
                                      'throwback', 'hitz', 'hits']
                
                is_compilation = any(keyword in album for keyword in compilation_keywords)
                
                if is_compilation:
                    # Si el metadata es más reciente, probablemente ISRC sea el original
                    if metadata_year > isrc_year:
                        explanation = f"Original recording from {isrc_year} (ISRC), metadata shows {metadata_year} (compilation album: {metadata.get('album', 'Unknown')})"
                        return isrc_year, explanation
                    else:
                        # El ISRC podría ser de una reedición
                        explanation = f"Possible reissue ISRC {isrc_year}, compilation from {metadata_year}"
                        return min(isrc_year, metadata_year), explanation
                else:
                    explanation = f"Original recording from {isrc_year} (ISRC), metadata shows {metadata_year}"
                    return isrc_year, explanation
            else:
                return isrc_year, f"Recording year {isrc_year} confirmed by ISRC"
        
        # 2. Analizar el álbum para detectar compilaciones
        album = metadata.get('album', '').lower()
        compilation_keywords = ['greatest hits', 'best of', 'collection', 'anthology', 
                              'essential', 'ultimate', 'gold', 'classics', 'retrospective']
        
        is_compilation = any(keyword in album for keyword in compilation_keywords)
        
        if is_compilation and metadata.get('year'):
            # Es compilación, el año real es probablemente anterior
            explanation = f"Compilation album from {metadata.get('year')}, original likely earlier"
            # Buscar información adicional del artista/título
            known_info = lookup_track(artist, title)
            if known_info:
                return known_info['year'], f"Known track from {known_info['year']} (found in compilation)"
            # Estimar año original (muy aproximado)
            estimated_year = metadata.get('year', 1980) - 10  # Aproximación
            return estimated_year, explanation
        
        # 3. Usar año de metadata si existe
        if metadata.get('year'):
            return metadata.get('year'), "Year from metadata"
        
        # 4. Default
        return 1980, "Year unknown, defaulting to 1980"
    
    def _init_enhanced_genre_rules(self) -> List[Dict]:
        """Reglas mejoradas con validación temporal"""
        return [
            # DISCO ERA (1975-1985)
            {"conditions": {"bpm": (110, 140), "danceability": (0.6, 1.0), "year": (1975, 1985)}, 
             "genre": "Disco", "confidence": 0.90},
            
            # POST-DISCO (1980-1987)
            {"conditions": {"bpm": (115, 135), "danceability": (0.65, 1.0), "year": (1980, 1987)}, 
             "genre": "Post-Disco", "confidence": 0.85},
            
            # HI-NRG (1977-1990)
            {"conditions": {"bpm": (120, 140), "energy": (0.7, 1.0), "year": (1977, 1990)}, 
             "genre": "Hi-NRG", "confidence": 0.80},
            
            # EARLY HOUSE (1985-1995)
            {"conditions": {"bpm": (115, 130), "danceability": (0.7, 1.0), "year": (1985, 1995)}, 
             "genre": "House", "confidence": 0.75},
            
            # EURODANCE (1990-2000)
            {"conditions": {"bpm": (125, 150), "energy": (0.7, 1.0), "year": (1990, 2000)}, 
             "genre": "Eurodance", "confidence": 0.80},
            
            # FUNK/SOUL (1965-1985)
            {"conditions": {"bpm": (90, 120), "danceability": (0.6, 0.9), "year": (1965, 1985)}, 
             "genre": "Funk/Soul", "confidence": 0.70},
            
            # NEW WAVE (1978-1988)
            {"conditions": {"bpm": (120, 140), "year": (1978, 1988), "energy": (0.5, 0.8)}, 
             "genre": "New Wave", "confidence": 0.65},
            
            # LATIN GENRES (All eras)
            # SALSA (1960-present)
            {"conditions": {"bpm": (90, 110), "danceability": (0.5, 0.8), "acousticness": (0.7, 1.0)}, 
             "genre": "Salsa", "confidence": 0.75},
            
            # MERENGUE (1970-present)
            {"conditions": {"bpm": (120, 140), "danceability": (0.6, 0.9), "valence": (0.6, 1.0), "acousticness": (0.5, 1.0)}, 
             "genre": "Merengue", "confidence": 0.70},
            
            # BACHATA (1980-present)
            {"conditions": {"bpm": (110, 130), "valence": (0.3, 0.7), "acousticness": (0.6, 1.0)}, 
             "genre": "Bachata", "confidence": 0.70},
            
            # REGGAETON (1995-present)
            {"conditions": {"bpm": (85, 105), "danceability": (0.7, 1.0), "energy": (0.6, 1.0), "year": (1995, 2030)}, 
             "genre": "Reggaeton", "confidence": 0.75},
            
            # CUMBIA (1960-present)
            {"conditions": {"bpm": (85, 110), "danceability": (0.6, 0.9), "acousticness": (0.5, 1.0)}, 
             "genre": "Cumbia", "confidence": 0.65},
            
            # POP/ROCK GENRES
            # POP (All eras)
            {"conditions": {"bpm": (100, 130), "valence": (0.5, 1.0), "speechiness": (0.0, 0.1)}, 
             "genre": "Pop", "confidence": 0.60},
            
            # ROCK (1950-present)
            {"conditions": {"energy": (0.6, 1.0), "loudness": (-20, 0), "acousticness": (0.0, 0.4)}, 
             "genre": "Rock", "confidence": 0.60},
            
            # BALLAD (All eras)
            {"conditions": {"bpm": (60, 90), "energy": (0.0, 0.4), "acousticness": (0.5, 1.0)}, 
             "genre": "Ballad", "confidence": 0.55},
            
            # R&B/SOUL (1950-present)
            {"conditions": {"bpm": (60, 100), "valence": (0.3, 0.7), "acousticness": (0.3, 0.8)}, 
             "genre": "R&B/Soul", "confidence": 0.60},
            
            # HIP-HOP (1975-present)
            {"conditions": {"bpm": (70, 110), "speechiness": (0.1, 1.0), "year": (1975, 2030)}, 
             "genre": "Hip-Hop", "confidence": 0.65},
            
            # JAZZ (All eras)
            {"conditions": {"acousticness": (0.7, 1.0), "instrumentalness": (0.5, 1.0), "liveness": (0.3, 1.0)}, 
             "genre": "Jazz", "confidence": 0.60},
        ]
    
    def _init_subgenre_by_era(self) -> Dict:
        """Subgéneros apropiados por época"""
        return {
            # 1970s
            (1970, 1979): {
                "Disco": ["Classic Disco", "Euro-Disco", "Funk", "Philadelphia Soul", "String Disco"],
                "Funk": ["P-Funk", "Disco-Funk", "Jazz-Funk"],
                "Soul": ["Philly Soul", "Motown", "Northern Soul"],
            },
            # 1980s
            (1980, 1989): {
                "Disco": ["Euro-Disco", "Italo Disco", "Hi-NRG", "Post-Disco", "Boogie"],
                "Post-Disco": ["Boogie", "Dance-Pop", "Electro-Funk"],
                "Hi-NRG": ["Euro Hi-NRG", "Italo Disco", "Synthpop"],
                "New Wave": ["Synthpop", "New Romantic", "Dance-Rock"],
            },
            # 1990s
            (1990, 1999): {
                "House": ["Deep House", "Acid House", "Progressive House", "Garage"],
                "Eurodance": ["Euro House", "Italo Dance", "Hi-NRG", "Bubblegum Dance"],
                "Dance": ["Dance-Pop", "Freestyle", "Club/Dance"],
                "Salsa": ["Salsa Romántica", "Salsa Dura", "Timba"],
                "Merengue": ["Merengue House", "Merengue Hip Hop", "Merengue Típico"],
                "Hip-Hop": ["East Coast", "West Coast", "Gangsta Rap", "Underground"],
            },
            # 2000s+
            (2000, 2030): {
                "House": ["Electro House", "Progressive House", "Tech House", "Deep House"],
                "Electronic": ["EDM", "Electropop", "Dance-Pop", "Future House"],
                "Dance": ["Commercial Dance", "Dance-Pop", "Eurodance Revival"],
                "Reggaeton": ["Reggaeton Romántico", "Perreo", "Latin Trap", "Dembow"],
                "Salsa": ["Salsa Moderna", "Salsa Urbana", "Salsa Fusión"],
                "Bachata": ["Bachata Moderna", "Bachata Sensual", "Bachata Urbana"],
                "Pop": ["Latin Pop", "Pop Rock", "Indie Pop", "Electropop"],
            }
        }
    
    def _init_context_by_year(self) -> Dict:
        """Contexto cultural específico por año"""
        return {
            1979: "Peak disco era, Studio 54 culture, Saturday Night Fever influence, pre-'Disco Demolition Night'",
            1980: "Post-disco transition, emergence of new wave and electronic sounds",
            1981: "MTV launch year, visual music culture begins, synthpop rises",
            1982: "Electronic music breakthrough, drum machines become prominent",
            1983: "MIDI introduced, Michael Jackson's Thriller era, dance-pop evolution",
            1984: "Purple Rain era, synthesizers dominate, Hi-NRG peak",
            1985: "Live Aid, house music emerges in Chicago, Madonna's dance influence",
            1986: "Detroit techno birth, UK acid house begins, Janet Jackson's Control",
            1987: "Second Summer of Love preparation, house goes mainstream",
            1988: "Acid house explosion, rave culture begins in UK",
            1989: "Berlin Wall falls, techno spreads to Europe, house music global",
            1990: "Eurodance emerges, rave culture explosion, Vogue era",
        }
    
    def get_era_appropriate_subgenres(self, genre: str, year: int) -> List[str]:
        """Obtiene subgéneros apropiados para el género y año"""
        
        for year_range, genres_dict in self.subgenre_by_era.items():
            if year_range[0] <= year <= year_range[1]:
                return genres_dict.get(genre, [])[:3]  # Máximo 3 subgéneros
        
        return []
    
    def enhance_prompt_with_year_context(self, original_prompt: str, prepared_data: Dict, real_year: int, year_explanation: str) -> str:
        """Mejora el prompt con contexto temporal preciso"""
        
        # Obtener características y metadata
        pre = prepared_data['precomputed']
        metadata = prepared_data['track']
        
        # Determinar era correcta
        if real_year < 1980:
            era = "1970s"
        elif real_year < 1990:
            era = "1980s"
        elif real_year < 2000:
            era = "1990s"
        elif real_year < 2010:
            era = "2000s"
        elif real_year < 2020:
            era = "2010s"
        else:
            era = "2020s"
        
        # Contexto específico del año
        year_context = self.context_by_year.get(real_year, f"Music from {real_year}")
        
        enhanced_instructions = f"""
INFORMACIÓN TEMPORAL CRÍTICA:
- Año REAL de grabación: {real_year} ({year_explanation})
- Era: {era}
- Contexto histórico: {year_context}

⚠️ TODOS LOS CAMPOS SON OBLIGATORIOS - NO DEVOLVER NULL O VACÍO ⚠️

INSTRUCCIONES ESTRICTAS DE CLASIFICACIÓN:

1. ANÁLISIS DE LETRAS (OBLIGATORIO):
   - Si NO hay letras proporcionadas: BUSCA las letras de "{metadata.get('artist', '')} - {metadata.get('title', '')}"
   - Analiza: tema principal, emociones, narrativa, contexto cultural
   - Marca lyrics_source = "fetched" si las buscaste, "missing" si no encontraste
   - NO incluyas texto completo, solo citas breves (máx 10 palabras)
   - Si encuentras letras en español/otro idioma, traduce el significado

2. COHERENCIA TEMPORAL OBLIGATORIA:
   - SOLO usa géneros que existían en {real_year}
   - NO uses géneros anacrónicos (ej: NO "House" antes de 1985, NO "Eurodance" antes de 1990)
   - Géneros válidos para {real_year}: {self._get_valid_genres_for_year(real_year)}

3. GÉNERO PRINCIPAL (OBLIGATORIO - NUNCA NULL):
   - Con BPM {pre.get('bpm') or 120:.0f} y año {real_year}, considera:
   {self._get_genre_suggestion(pre, real_year)}
   - Si no puedes determinar, usa: "Pop" o "Unknown"

4. SUBGÉNEROS (MÍNIMO 2, MÁXIMO 3 - NUNCA LISTA VACÍA):
   - Deben ser históricamente precisos para {real_year}
   - Ejemplos válidos: {self._get_era_examples(real_year)}
   - Si no puedes determinar, usa géneros generales de la época

5. CONTEXTO CULTURAL (MÍNIMO 80 CARACTERES - NUNCA VACÍO):
   - Describe específicamente la escena musical de {real_year}
   - Menciona artistas, lugares, movimientos de ESE año
   - Si no conoces el contexto específico, describe la era general

6. MOOD (OBLIGATORIO - NUNCA NULL):
   - Opciones: Energetic, Melancholic, Uplifting, Dark, Chill, Aggressive, Romantic, Playful, Mysterious, Euphoric
   - Si no puedes determinar, usa "Neutral"

7. VALIDACIÓN DE DATOS:
   - Si el álbum es "Greatest Hits" o compilación, menciona que es una RECOPILACIÓN
   - El año original de grabación es {real_year}, NO el año del álbum compilatorio

8. CAMPOS NUMÉRICOS (USAR VALORES PROPORCIONADOS O ESTIMAR):
   - energy, danceability, valence, acousticness, instrumentalness, liveness, speechiness: 0.0 a 1.0
   - loudness: -60 a 0 (en dB)
   - confidence: 0.0 a 1.0 (basado en tu certeza)

9. ARRAYS Y OBJETOS (NUNCA VACÍOS):
   - occasions: mínimo 2 ocasiones (ej: ["party", "workout"])
   - keywords: mínimo 3 palabras clave
   - emotions: objeto con todas las emociones (joy, sadness, anger, fear, surprise, trust) con valores 0.0-1.0

{original_prompt}"""
        
        return enhanced_instructions
    
    def _get_valid_genres_for_year(self, year: int) -> str:
        """Retorna géneros válidos para un año específico"""
        
        valid_genres = []
        
        for rule in self.genre_rules:
            conditions = rule['conditions']
            # Verificar si hay restricción de año
            if 'year' in conditions:
                year_range = conditions['year']
                if year_range[0] <= year <= year_range[1]:
                    valid_genres.append(rule['genre'])
            else:
                # Si no hay restricción de año, el género es válido para cualquier época
                valid_genres.append(rule['genre'])
        
        # Eliminar duplicados y ordenar
        valid_genres = sorted(list(set(valid_genres)))
        
        return ", ".join(valid_genres) if valid_genres else "Pop, Rock, Jazz, Soul"
    
    def _get_genre_suggestion(self, features: Dict, year: int) -> str:
        """Sugiere género basado en características y año"""
        
        bpm = features.get('bpm', 120)
        danceability = features.get('danceability', 0.5)
        energy = features.get('energy', 0.5)
        acousticness = features.get('acousticness', 0.5)
        valence = features.get('valence', 0.5)
        
        # Detectar música latina primero (independiente del año)
        if acousticness > 0.7:
            if 90 <= bpm <= 110 and danceability > 0.5:
                return "Probablemente SALSA o música latina tropical"
            elif 110 <= bpm <= 130 and valence < 0.7:
                return "Probablemente BACHATA o balada latina"
            elif 120 <= bpm <= 140 and valence > 0.6:
                return "Probablemente MERENGUE"
        
        # Para música con alta acousticness pero no latina
        if acousticness > 0.8 and energy < 0.4:
            return "Probablemente BALLAD o música acústica"
        
        # Reggaeton (post-1995)
        if year >= 1995 and 85 <= bpm <= 105 and danceability > 0.7:
            return "Probablemente REGGAETON o música urbana latina"
        
        # Música electrónica/dance por época
        if year < 1985:
            if 110 <= bpm <= 140 and danceability > 0.6:
                return "Probablemente DISCO o POST-DISCO"
            elif 90 <= bpm <= 120:
                return "Probablemente FUNK o SOUL"
        elif 1985 <= year < 1990:
            if 115 <= bpm <= 135:
                return "Probablemente HI-NRG o EARLY HOUSE"
        else:
            if 120 <= bpm <= 140 and acousticness < 0.5:
                return "Probablemente HOUSE o DANCE"
        
        return "Analiza según contexto de la época y características"
    
    def _get_era_examples(self, year: int) -> str:
        """Obtiene ejemplos de subgéneros para el año"""
        
        if year < 1980:
            return "Classic Disco, Euro-Disco, Funk, Philadelphia Soul"
        elif year < 1985:
            return "Post-Disco, Hi-NRG, Boogie, Italo Disco"
        elif year < 1990:
            return "Hi-NRG, Freestyle, Early House, Synthpop"
        elif year < 1995:
            return "House, Eurodance, Techno, Rave"
        else:
            return "Progressive House, Trance, EDM, Electro House"
    
    def ensure_all_required_fields(self, analysis: Dict) -> Dict:
        """Asegura que todos los campos obligatorios tengan valores válidos"""
        
        # Definir valores por defecto que indiquen claramente que no se pudo determinar
        defaults = {
            'genre': 'Desconocido',
            'subgenres': ['No Determinado', 'Sin Clasificar'],
            'mood': 'No Determinado',
            'energy': -1.0,  # Valor imposible indica no determinado
            'danceability': -1.0,
            'valence': -1.0,
            'acousticness': -1.0,
            'instrumentalness': -1.0,
            'liveness': -1.0,
            'speechiness': -1.0,
            'loudness': -999.0,  # Valor imposible
            'era': 'Desconocida',
            'cultural_context': 'No se pudo determinar el contexto cultural para esta pista',
            'occasions': ['no_determinado'],
            'musical_key': 'Desconocido',
            'camelot_key': 'Desconocido',
            'description': 'No se pudo generar una descripción para esta pista',
            'confidence': 0.0  # 0 indica falla total
        }
        
        # Validar y completar campos principales
        for field, default_value in defaults.items():
            if field not in analysis or analysis[field] is None or analysis[field] == '':
                print(f"⚠️ Campo '{field}' faltante o vacío, usando valor por defecto: {default_value}")
                analysis[field] = default_value
        
        # Validar subgenres (debe ser lista con al menos 2 elementos)
        if not isinstance(analysis.get('subgenres'), list) or len(analysis['subgenres']) < 2:
            analysis['subgenres'] = ['No Determinado', 'Sin Clasificar', 'Desconocido'][:3]
            print(f"⚠️ Subgéneros insuficientes, marcando como no determinados")
        
        # Validar occasions (debe ser lista con al menos 2 elementos)
        if not isinstance(analysis.get('occasions'), list) or len(analysis['occasions']) < 2:
            analysis['occasions'] = ['no_determinado', 'sin_contexto']
            print(f"⚠️ Ocasiones insuficientes, marcando como no determinadas")
        
        # Validar lyrics_analysis
        if 'lyrics_analysis' not in analysis or not isinstance(analysis['lyrics_analysis'], dict):
            analysis['lyrics_analysis'] = {}
        
        lyrics_defaults = {
            'lyrics_source': 'no_analizado',
            'language': 'Desconocido',
            'topic_main': 'No Determinado',
            'topics_secondary': ['No Analizado'],
            'coherence_score': -1.0,  # -1 indica no analizado
            'coherence_notes': ['No se pudo analizar - datos faltantes'],
            'lyric_mood': 'No Determinado',
            'sentiment': -999.0,  # Valor imposible indica no analizado
            'emotions': {
                'joy': -1.0,
                'sadness': -1.0,
                'anger': -1.0,
                'fear': -1.0,
                'surprise': -1.0,
                'trust': -1.0
            },
            'narrative_perspective': 'desconocido',
            'narrative_time': 'desconocido',
            'structure': [{'section': 'no_analizado', 'summary': 'Estructura no analizada'}],
            'repeated_phrases': [],
            'hook_candidates': [],
            'keywords': ['no_determinado'],
            'named_entities': {},
            'cultural_references': [],
            'call_and_response': False,
            'contains_shouts': False,
            'explicitness_level': 'desconocido',
            'content_warnings': [],
            'singalong_index': -1.0,
            'chantability': -1.0,
            'justification': ['Análisis no completado - verificar datos de entrada']
        }
        
        # Completar campos de lyrics_analysis
        for field, default_value in lyrics_defaults.items():
            if field not in analysis['lyrics_analysis'] or analysis['lyrics_analysis'][field] is None:
                analysis['lyrics_analysis'][field] = default_value
        
        # Asegurar que emotions tenga todas las emociones
        if 'emotions' not in analysis['lyrics_analysis'] or not isinstance(analysis['lyrics_analysis']['emotions'], dict):
            analysis['lyrics_analysis']['emotions'] = lyrics_defaults['emotions']
        else:
            for emotion in ['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust']:
                if emotion not in analysis['lyrics_analysis']['emotions']:
                    analysis['lyrics_analysis']['emotions'][emotion] = -1.0  # -1 indica no determinado
        
        # Validar arrays para que no estén vacíos
        array_fields = {
            'keywords': ['no_determinado'],
            'topics_secondary': ['No Analizado'],
            'hook_candidates': [],  # OK vacío si no hay
            'repeated_phrases': [],  # OK vacío si no hay
            'cultural_references': [],  # OK vacío si no hay
            'coherence_notes': ['No se pudo analizar'],
            'content_warnings': []  # OK vacío si no hay warnings
        }
        
        for field, default in array_fields.items():
            if field in analysis['lyrics_analysis']:
                if not isinstance(analysis['lyrics_analysis'][field], list):
                    analysis['lyrics_analysis'][field] = default
                elif len(analysis['lyrics_analysis'][field]) == 0 and len(default) > 0:
                    analysis['lyrics_analysis'][field] = default
        
        # Validar valores numéricos estén en rango (o sean -1 para no determinado)
        numeric_ranges = {
            'energy': (0.0, 1.0),
            'danceability': (0.0, 1.0),
            'valence': (0.0, 1.0),
            'acousticness': (0.0, 1.0),
            'instrumentalness': (0.0, 1.0),
            'liveness': (0.0, 1.0),
            'speechiness': (0.0, 1.0),
            'confidence': (0.0, 1.0),
            'loudness': (-60.0, 0.0)
        }
        
        for field, (min_val, max_val) in numeric_ranges.items():
            if field in analysis:
                try:
                    val = float(analysis[field])
                    # Permitir -1 como valor especial para "no determinado"
                    if val != -1.0 and val != -999.0 and not (min_val <= val <= max_val):
                        analysis[field] = -1.0  # Marcar como no determinado
                        print(f"⚠️ {field} fuera de rango ({val}), marcando como no determinado: -1")
                except (TypeError, ValueError):
                    analysis[field] = -1.0  # Marcar como no determinado
                    print(f"⚠️ {field} no numérico, marcando como no determinado: -1")
        
        return analysis
    
    def validate_and_fix_temporal_coherence(self, analysis: Dict, real_year: int) -> Dict:
        """Valida y corrige incoherencias temporales en el análisis"""
        
        print(f"\n🕐 Validando coherencia temporal para año {real_year}...")
        corrections = []
        
        # 1. Validar género principal
        genre = analysis.get('genre')
        if genre:
            # Verificar si el género es anacrónico
            genre_invalid = False
            
            if "House" in genre and real_year < 1985:
                genre_invalid = True
                corrections.append(f"Genre 'House' imposible en {real_year} (House emerge ~1985)")
            elif "Eurodance" in genre and real_year < 1990:
                genre_invalid = True
                corrections.append(f"Genre 'Eurodance' imposible en {real_year} (Eurodance emerge ~1990)")
            elif "Techno" in genre and real_year < 1987:
                genre_invalid = True
                corrections.append(f"Genre 'Techno' imposible en {real_year} (Techno emerge ~1987)")
            
            if genre_invalid:
                # Corregir a género apropiado
                if real_year < 1985:
                    analysis['genre'] = "Disco"
                elif real_year < 1990:
                    analysis['genre'] = "Post-Disco/Hi-NRG"
                else:
                    analysis['genre'] = "Dance"
        
        # 2. Validar y corregir subgéneros
        subgenres = analysis.get('subgenres', [])
        valid_subgenres = []
        
        for subgenre in subgenres:
            # Verificar anacronismos
            if "House" in subgenre and real_year < 1985:
                corrections.append(f"Removido '{subgenre}' (anacrónico para {real_year})")
                continue
            elif "Eurodance" in subgenre and real_year < 1990:
                corrections.append(f"Removido '{subgenre}' (anacrónico para {real_year})")
                continue
            elif "EDM" in subgenre and real_year < 2000:
                corrections.append(f"Removido '{subgenre}' (anacrónico para {real_year})")
                continue
            else:
                valid_subgenres.append(subgenre)
        
        # Si quedaron pocos subgéneros válidos, agregar apropiados
        if len(valid_subgenres) < 2:
            genre = analysis.get('genre', 'Disco')
            era_subgenres = self.get_era_appropriate_subgenres(genre, real_year)
            for sub in era_subgenres:
                if sub not in valid_subgenres:
                    valid_subgenres.append(sub)
                    corrections.append(f"Agregado '{sub}' (apropiado para {real_year})")
        
        analysis['subgenres'] = valid_subgenres[:3]
        
        # 3. Ajustar era si es incorrecta
        current_era = analysis.get('era')
        correct_era = f"{(real_year // 10) * 10}s"
        
        if current_era != correct_era:
            corrections.append(f"Era corregida: {current_era} → {correct_era}")
            analysis['era'] = correct_era
        
        # 4. Actualizar contexto cultural
        if real_year in self.context_by_year:
            analysis['cultural_context'] = self.context_by_year[real_year]
            corrections.append(f"Contexto actualizado para {real_year}")
        
        # 5. Agregar nota sobre el año real vs compilación
        if 'validation_notes' not in analysis:
            analysis['validation_notes'] = []
        
        analysis['validation_notes'].append(f"Real recording year: {real_year}")
        analysis['validation_notes'].extend(corrections)
        
        # 6. Ajustar confidence basado en correcciones
        if corrections:
            original_confidence = analysis.get('confidence', 0.8)
            penalty = len(corrections) * 0.03
            analysis['confidence'] = max(0.5, original_confidence - penalty)
            
            print(f"✅ {len(corrections)} correcciones temporales aplicadas:")
            for correction in corrections[:5]:  # Mostrar máximo 5
                print(f"   • {correction}")
            print(f"   • Confidence ajustada: {original_confidence:.2f} → {analysis['confidence']:.2f}")
        else:
            print(f"✅ Coherencia temporal correcta para {real_year}")
        
        return analysis
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """Procesa archivo con todas las validaciones mejoradas"""
        
        print(f"\n{'='*70}")
        print(f"🚀 PROCESAMIENTO ULTIMATE CON GPT-4")
        print(f"{'='*70}")
        
        # Preparar datos
        print(f"📊 Preparando datos y validando año...")
        prepared_data, original_prompt = self.ai_enhancer.test_preparation(file_path)
        
        # NUEVO: Determinar año real desde ISRC
        metadata = prepared_data['track']
        real_year, year_explanation = self.determine_real_year(metadata)
        
        print(f"\n📅 ANÁLISIS TEMPORAL:")
        print(f"  • ISRC: {metadata.get('isrc', 'N/A')}")
        if metadata.get('isrc'):
            isrc_data = self.parse_isrc(metadata['isrc'])
            if isrc_data.get('valid'):
                print(f"  • País: {isrc_data['country']}")
                print(f"  • Año ISRC: {isrc_data['year']}")
        print(f"  • Año metadata: {metadata.get('year', 'N/A')}")
        print(f"  • Álbum: {metadata.get('album', 'N/A')}")
        print(f"  • ⭐ Año REAL determinado: {real_year}")
        print(f"  • Explicación: {year_explanation}")
        
        # Mejorar prompt con contexto temporal
        enhanced_prompt = self.enhance_prompt_with_year_context(
            original_prompt, prepared_data, real_year, year_explanation
        )
        
        # Enviar a GPT-4
        print(f"\n🤖 Enviando a GPT-4 con contexto temporal preciso...")
        print(f"  • Modelo: {self.model}")
        print(f"  • Año para análisis: {real_year}")
        
        try:
            start_time = time.time()
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are a music historian expert specializing in {real_year} music. You have deep knowledge of what genres, styles, and artists existed in that specific year. 

CRITICAL RULES:
1. NEVER use anachronistic genres (genres that didn't exist in {real_year})
2. ALL FIELDS ARE MANDATORY - Never return null, empty strings, or empty arrays
3. When lyrics are not provided, ALWAYS search for them online to provide complete analysis
4. Use lyrics to determine themes, mood, and cultural context (only brief quotes, max 10 words)
5. If you cannot determine a value, provide your best educated guess based on the audio features
6. For any field you're unsure about, use reasonable defaults:
   - Genre: "Pop" or "Unknown" 
   - Subgenres: At least 2 general styles from the era
   - Mood: "Neutral" if unclear
   - Era: Decade of {real_year}
   - Cultural context: General description of {real_year} music scene
   - Occasions: ["general", "background"] if unclear
   - Confidence: Reflect your uncertainty (0.3-0.5 for guesses)

NEVER leave any field empty or null. Every field in the schema MUST have a valid value.

Example: If analyzing 'Frankie Ruiz - Deseándote', search for lyrics to confirm it's romantic salsa about desire and longing."""
                    },
                    {
                        "role": "user",
                        "content": enhanced_prompt
                    }
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
            )
            
            elapsed = time.time() - start_time
            
            # Parsear respuesta
            gpt_response = response.choices[0].message.content
            analysis = json.loads(gpt_response)
            print(f"✅ Respuesta recibida en {elapsed:.2f}s")
            
            # VALIDAR Y COMPLETAR CAMPOS FALTANTES
            analysis = self.ensure_all_required_fields(analysis)
            
            # VALIDAR COHERENCIA TEMPORAL
            analysis = self.validate_and_fix_temporal_coherence(analysis, real_year)
            
            # Agregar información del año real
            analysis['real_year'] = real_year
            analysis['year_source'] = year_explanation
            
            # Calcular costos
            usage = response.usage
            cost = (usage.prompt_tokens * 0.01 + usage.completion_tokens * 0.03) / 1000
            
            print(f"\n📊 Tokens: {usage.total_tokens} | 💰 Costo: ${cost:.4f}")
            
            # Resultado final
            result = {
                "file_path": file_path,
                "file_name": Path(file_path).name,
                "original_metadata": prepared_data['track'],
                "precomputed_features": prepared_data['precomputed'],
                "temporal_analysis": {
                    "real_year": real_year,
                    "metadata_year": metadata.get('year'),
                    "isrc_parsed": self.parse_isrc(metadata.get('isrc', '')),
                    "year_explanation": year_explanation
                },
                "gpt4_analysis": analysis,
                "processing_time": round(elapsed, 2),
                "tokens_used": usage.total_tokens,
                "estimated_cost": round(cost, 4),
                "timestamp": datetime.now().isoformat(),
                "version": "ultimate_v3"
            }
            
            # Mostrar análisis
            self.print_ultimate_analysis(analysis, real_year)
            
            # Guardar
            output_file = f"gpt4_ultimate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Análisis guardado en: {output_file}")
            
            return result
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return {"error": str(e)}
    
    def print_ultimate_analysis(self, analysis: Dict, real_year: int):
        """Imprime el análisis con validaciones temporales"""
        
        print(f"\n{'='*70}")
        print(f"🎵 ANÁLISIS ULTIMATE (Año {real_year})")
        print(f"{'='*70}")
        
        # Clasificación
        print(f"\n📊 CLASIFICACIÓN TEMPORAL VALIDADA:")
        print(f"  • Año real: {real_year} ⭐")
        print(f"  • Género: {analysis.get('genre', 'N/A')}")
        print(f"  • Subgéneros: {', '.join(analysis.get('subgenres', []))}")
        print(f"  • Era: {analysis.get('era', 'N/A')}")
        print(f"  • Mood: {analysis.get('mood', 'N/A')}")
        
        # Contexto
        print(f"\n🌍 CONTEXTO HISTÓRICO {real_year}:")
        context = analysis.get('cultural_context', 'N/A')
        if context:
            import textwrap
            for line in textwrap.wrap(context, width=65):
                print(f"  {line}")
        
        # Validaciones temporales
        if 'validation_notes' in analysis:
            print(f"\n⚠️ CORRECCIONES TEMPORALES:")
            for note in analysis['validation_notes'][:8]:
                print(f"  • {note}")
        
        # Confidence
        confidence = analysis.get('confidence', 0)
        emoji = '🟢' if confidence >= 0.8 else '🟡' if confidence >= 0.6 else '🔴'
        print(f"\n🎯 CONFIANZA: {confidence:.2f} {emoji}")


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='OpenAI GPT-4 Ultimate Processor')
    parser.add_argument('file', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas/France Joli - Come to Me.flac",
                       help='Archivo a procesar')
    
    args = parser.parse_args()
    
    try:
        processor = UltimateOpenAIProcessor()
        result = processor.process_file(args.file)
        
        # Comparar versiones si existen
        if Path('gpt4_enhanced_20250816_200434.json').exists():
            print(f"\n{'='*70}")
            print(f"📊 COMPARACIÓN: Enhanced vs Ultimate")
            print(f"{'='*70}")
            
            with open('gpt4_enhanced_20250816_200434.json', 'r') as f:
                old = json.load(f)
            
            print(f"\n📅 Año usado:")
            print(f"  • Enhanced: 1989 (metadata)")
            print(f"  • Ultimate: {result.get('temporal_analysis', {}).get('real_year')} (ISRC)")
            
            print(f"\n🎵 Género:")
            print(f"  • Enhanced: {old['gpt4_analysis'].get('genre')}")
            print(f"  • Ultimate: {result['gpt4_analysis'].get('genre')}")
            
            print(f"\n📝 Subgéneros:")
            print(f"  • Enhanced: {', '.join(old['gpt4_analysis'].get('subgenres', []))}")
            print(f"  • Ultimate: {', '.join(result['gpt4_analysis'].get('subgenres', []))}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()