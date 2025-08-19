#!/usr/bin/env python3
"""
AI Enhancer - Mejora metadata y análisis con IA
Prepara datos y envía a OpenAI/Claude para enriquecimiento
"""

import json
import os
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path

# Importar módulos previos
from metadata_reader_complete import CompleteMetadataReader
from metadata_validator import MetadataValidator
from essentia_processor_with_mik import EssentiaProcessorWithMIK


class AIEnhancer:
    """
    Prepara y envía datos a IA para enriquecimiento
    """
    
    def __init__(self):
        self.metadata_reader = CompleteMetadataReader()
        self.validator = MetadataValidator()
        self.essentia_processor = EssentiaProcessorWithMIK()
        
    def prepare_for_ai(self, file_path: str) -> Dict[str, Any]:
        """
        Prepara todos los datos de un archivo para enviar a IA
        
        Returns:
            Dict con estructura lista para el prompt
        """
        
        result = {
            'file_path': file_path,
            'track': {},
            'precomputed': {},
            'lyrics': None,
            'prepared_at': datetime.now().isoformat()
        }
        
        # 1. Leer metadata completa
        print(f"\n📖 Leyendo metadata...")
        metadata = self.metadata_reader.read_all_metadata(file_path)
        
        # 2. Procesar con Essentia
        print(f"🎵 Procesando con Essentia...")
        essentia_result = self.essentia_processor.process_file(file_path)
        
        # 3. Combinar y validar
        print(f"✅ Validando datos...")
        combined = {**metadata, **essentia_result.get('essentia_features', {})}
        normalized = self.validator.validate_and_normalize(combined)
        
        # 4. Preparar estructura para IA
        result['track'] = self._prepare_track_info(normalized)
        result['precomputed'] = self._prepare_precomputed(normalized)
        result['lyrics'] = self._prepare_lyrics(normalized)
        
        return result
    
    def _prepare_track_info(self, data: Dict) -> Dict:
        """Prepara información de track para el prompt"""
        
        return {
            'artist': data.get('artist') or 'Unknown',
            'title': data.get('title') or 'Unknown',
            'album': data.get('album') or 'Unknown',
            'genre': data.get('genre') or 'Unknown',
            'file_name': data.get('file_name') or '',
            'year': data.get('year') or '',
            'existing_key': data.get('key') or '',
            'isrc': data.get('isrc') or ''
        }
    
    def _prepare_precomputed(self, data: Dict) -> Dict:
        """Prepara datos precomputados de Essentia/MIK"""
        
        # Detectar si el key es Camelot o tradicional
        key = data.get('key', '')
        camelot_key = None
        musical_key = None
        
        if key:
            # Si es formato Camelot (1A-12B)
            if re.match(r'^\d{1,2}[AB]$', str(key)):
                camelot_key = key
                # Opcionalmente convertir a notación tradicional
                musical_key = self._camelot_to_traditional(key)
            else:
                musical_key = key
                # Opcionalmente convertir a Camelot
                camelot_key = self._traditional_to_camelot(key)
        
        return {
            'loudness_lufs': data.get('loudness'),
            'danceability': data.get('danceability'),
            'acousticness': data.get('acousticness'),
            'instrumentalness': data.get('instrumentalness'),
            'liveness': data.get('liveness'),
            'speechiness': data.get('speechiness'),
            'valence': data.get('valence'),
            'energy': data.get('energy'),
            'musical_key': musical_key,
            'camelot_key': camelot_key,
            'extract_strategy': 'full',  # Siempre procesamos completo
            'windows_used': [],  # No usamos ventanas
            'notes': []  # Notas adicionales si las hay
        }
    
    def _prepare_lyrics(self, data: Dict) -> Optional[str]:
        """Prepara lyrics limpias para el prompt"""
        
        lyrics = data.get('lyrics')
        if not lyrics:
            return None
            
        # Ya deberían estar limpias por el validador
        # pero asegurémonos
        
        # Remover timestamps si quedaron
        lyrics = re.sub(r'\[\d{2}:\d{2}\.\d{2}\]', '', lyrics)
        lyrics = re.sub(r'\[\d{2}:\d{2}\]', '', lyrics)
        
        # Limpiar líneas vacías múltiples
        lyrics = re.sub(r'\n\s*\n', '\n\n', lyrics)
        
        return lyrics.strip()
    
    def _camelot_to_traditional(self, camelot: str) -> str:
        """Convierte notación Camelot a tradicional"""
        
        # Mapeo Camelot → Tradicional
        camelot_map = {
            '1A': 'Ab minor', '1B': 'B major',
            '2A': 'Eb minor', '2B': 'F# major',
            '3A': 'Bb minor', '3B': 'Db major',
            '4A': 'F minor', '4B': 'Ab major',
            '5A': 'C minor', '5B': 'Eb major',
            '6A': 'G minor', '6B': 'Bb major',
            '7A': 'D minor', '7B': 'F major',
            '8A': 'A minor', '8B': 'C major',
            '9A': 'E minor', '9B': 'G major',
            '10A': 'B minor', '10B': 'D major',
            '11A': 'F# minor', '11B': 'A major',
            '12A': 'Db minor', '12B': 'E major',
        }
        
        return camelot_map.get(camelot, camelot)
    
    def _traditional_to_camelot(self, traditional: str) -> str:
        """Convierte notación tradicional a Camelot"""
        
        # Mapeo inverso
        traditional_map = {
            'Ab minor': '1A', 'B major': '1B',
            'Eb minor': '2A', 'F# major': '2B',
            'Bb minor': '3A', 'Db major': '3B',
            'F minor': '4A', 'Ab major': '4B',
            'C minor': '5A', 'Eb major': '5B',
            'G minor': '6A', 'Bb major': '6B',
            'D minor': '7A', 'F major': '7B',
            'A minor': '8A', 'C major': '8B',
            'E minor': '9A', 'G major': '9B',
            'B minor': '10A', 'D major': '10B',
            'F# minor': '11A', 'A major': '11B',
            'Db minor': '12A', 'E major': '12B',
        }
        
        # Normalizar entrada
        traditional = traditional.replace('maj', 'major').replace('min', 'minor')
        
        return traditional_map.get(traditional, traditional)
    
    def format_prompt(self, prepared_data: Dict) -> str:
        """
        Formatea el prompt completo para la IA
        
        Args:
            prepared_data: Datos preparados por prepare_for_ai()
            
        Returns:
            String con el prompt completo
        """
        
        track = prepared_data['track']
        pre = prepared_data['precomputed']
        lyrics = prepared_data['lyrics'] or '(No lyrics available)'
        
        prompt = f"""Usted es un analista musical y de letras. Debe entregar ÚNICAMENTE JSON válido conforme al esquema. Use PRECOMPUTED tal cual (round/clamp). Analice la LETRA si está disponible. No use fuentes externas. No incluya BPM/tempo.

FORMATO JSON ESTRICTO
- Devuelva un ÚNICO objeto JSON con TODAS las claves del esquema; si no hay dato, use null o [].
- Números como números (no strings). Sin NaN/Infinity. Escape JSON correcto.

INPUT
- TRACK: Artist: {track['artist']} | Title: {track['title']} | Album: {track['album']} | Genre(tag): {track['genre']} | File: {track['file_name']} | Year(tag): {track['year']} | Key(tag): {track['existing_key']} | ISRC: {track['isrc']}
- PRECOMPUTED (Essentia/MIK; use null si faltan):
  {{
    "loudness_lufs": {self._format_value(pre['loudness_lufs'])},
    "danceability": {self._format_value(pre['danceability'])},
    "acousticness": {self._format_value(pre['acousticness'])},
    "instrumentalness": {self._format_value(pre['instrumentalness'])},
    "liveness": {self._format_value(pre['liveness'])},
    "speechiness": {self._format_value(pre['speechiness'])},
    "valence": {self._format_value(pre['valence'])},
    "energy": {self._format_value(pre['energy'])},
    "musical_key": {json.dumps(pre['musical_key'])},
    "camelot_key": {json.dumps(pre['camelot_key'])},
    "extract_strategy": {json.dumps(pre['extract_strategy'])},
    "windows_used": {json.dumps(pre['windows_used'])},
    "notes": {json.dumps(pre['notes'])}
  }}
- LYRICS
<<<
{lyrics}
>>>

[RESTO DEL PROMPT CONTINÚA CON LAS REGLAS...]
"""
        
        # Agregar el resto del prompt con las reglas
        prompt += self._get_prompt_rules()
        
        return prompt
    
    def _format_value(self, value):
        """Formatea valores para el prompt"""
        if value is None:
            return 'null'
        if isinstance(value, (int, float)):
            return str(value)
        return json.dumps(value)
    
    def _get_prompt_rules(self) -> str:
        """Retorna las reglas del prompt (la parte larga)"""
        
        return """
ADQUISICIÓN DE LETRA (OBLIGATORIO Y SEGURO)
- lyrics_source = "provided" si LYRICS trae texto; "fetched" si se obtuvo con herramienta; "missing" si no hay.
- Si "fetched": citas ≤10 palabras y máx. 2 por sección; prefiera paráfrasis. Nunca pegue la letra completa.

USO DEL ISRC
- Valide ^[A-Z]{2}-?[A-Z0-9]{3}-?\\d{2}-?\\d{5}$. Si inválido/vacío, anótelo; si válido, YY orienta "era" como pista (no definitiva). No incluya el código.

PRIORIDAD PRECOMPUTED (INMUTABLE)
- Si PRECOMPUTED.<campo> no es null, úselo tal cual (round 2 dec, clamp a rango). No reestime ese campo.

RANGOS Y LÍMITES
- energy,danceability,valence,acousticness,instrumentalness,liveness,speechiness: 0.00–1.00; loudness: -60.00–0.00 dB.
- LÍMITES DE LONGITUD: description ≤ 280 chars; topic_main ≤ 80; topics_secondary ≤ 60 c/u; summary de sección ≤ 140; keywords ≤ 4 palabras.
- LÍMITES DE PROCESAMIENTO LÉXICO: analizar hasta 5,000 tokens; repeated_phrases 3–6 items, cada phrase ≤ 6 palabras; normalizar para conteo (lowercase, sin tildes/puntuación) y devolver la forma más frecuente original.

MOOD (ENUM ESTRICTO, ÁNIMO SONORO)
- "mood" ∈ ["Euphoric","Uplifting","Happy","Groovy","Chill","Dreamy","Nostalgic","Sophisticated","Romantic","Tense","Dark","Aggressive"]; si no encaja → null.
- Respaldo opcional basado en valence/energy; ajustes: Dreamy/Romantic/Nostalgic solo si son claros.

OCASIONES (2–4)
- ["warm-up","peak-time","after-hours","party","dance","workout","driving","study","chill","dinner","sunset","wedding"] (sin duplicados).

ANÁLISIS DE LETRA (si hay texto)
- Idioma: detectar, no traducir. Mantenga "mood" y "occasions" en inglés.
- Coherencia: continuidad temática, persona y tiempo verbal predominantes; anotar cambios bruscos.
- Tema central y 0–5 subtemas.
- Frases repetidas (hooks/chant): n-gramas 2–6 palabras; min 8 caracteres; 3–6 items con {phrase,count,reason}. Fusione variantes triviales.
- Estructura: intro/verse/pre-chorus/chorus/post-chorus/bridge/outro con summary y sample_lines (respetar límites de citas).
- Lyric_mood (ENUM de mood aplicado al texto).
- Sentiment 0..1 y emociones {joy,sadness,anger,fear,surprise,trust}.
- Perspectiva: first/second/third/mixed. Tiempo: present/past/future/mixed.
- Entidades y referencias culturales (0–8).
- Contenido sensible: explicitness_level ("clean"|"mild"|"explicit") y content_warnings [].
- Indicadores DJ: hook_candidates 2–5, singalong_index 0..1, chantability 0..1.
- Justificación lírica: 3–6 viñetas (sin BPM/tempo; ISRC solo "válido/inválido").

REGLAS DE CONSISTENCIA AUDIO↔LETRA
- Si instrumentalness ≥ 0.80 y hay letra: anote posible contradicción en lyrics_analysis.justification.
- Si extract_strategy ≠ "full": indique ventanas usadas y si se aplicó calibración de LUFS.

CONFIDENCE (CÁLCULO)
- confidence = clamp( 0.30 + 0.05 * #(métricas PRECOMPUTED no nulas entre [energy,danceability,valence,acousticness,instrumentalness,liveness,speechiness,loudness]) + (lyrics_source=="provided"?0.20:(lyrics_source=="fetched"?0.10:0)) - (extract_strategy=="first60"?0.10:0) - (windows_used && windows_used.includes("chorus30")?0:0.05), 0, 1 ); round 2 dec.

DEGRADACIÓN
- Si lyrics_source="missing": repeated_phrases=[], hook_candidates=[], sample_lines=[]; sentiment y emotions = null; topic_main/subtemas tentativos; coherence_score ≤ 0.40.

SALIDA (ÚNICO JSON; ESQUEMA EXACTO)
{
  "genre": string | null,
  "subgenres": string[] (0–3),
  "mood": string | null,
  "energy": number | null,
  "danceability": number | null,
  "valence": number | null,
  "acousticness": number | null,
  "instrumentalness": number | null,
  "liveness": number | null,
  "speechiness": number | null,
  "loudness": number | null,
  "era": "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "2020s" | null,
  "cultural_context": string | null,
  "occasions": string[],
  "musical_key": string | null,
  "camelot_key": string | null,
  "description": string | null,
  "lyrics_analysis": {
    "lyrics_source": "provided" | "fetched" | "missing",
    "language": string | null,
    "topic_main": string | null,
    "topics_secondary": string[],
    "coherence_score": number,
    "coherence_notes": string[],
    "lyric_mood": string | null,
    "sentiment": number | null,
    "emotions": { "joy": number, "sadness": number, "anger": number, "fear": number, "surprise": number, "trust": number },
    "narrative_perspective": "first" | "second" | "third" | "mixed" | null,
    "narrative_time": "present" | "past" | "future" | "mixed" | null,
    "structure": [ { "section": "intro|verse|pre-chorus|chorus|post-chorus|bridge|outro", "summary": "string", "sample_lines": ["line1","line2"] } ],
    "repeated_phrases": [ { "phrase": "string", "count": number, "reason": "loop|hook|chant" } ],
    "hook_candidates": ["string","string"],
    "keywords": ["string","..."],
    "named_entities": { "persons": string[], "places": string[], "brands": string[] },
    "cultural_references": string[],
    "call_and_response": boolean,
    "countins_shouts": boolean,
    "explicitness_level": "clean" | "mild" | "explicit",
    "content_warnings": string[],
    "singalong_index": number,
    "chantability": number,
    "justification": string[]
  },
  "confidence": number
}"""
    
    def test_preparation(self, file_path: str):
        """Prueba la preparación de datos para IA"""
        
        print(f"\n{'='*70}")
        print(f"🤖 PREPARACIÓN PARA IA")
        print(f"{'='*70}")
        
        # Preparar datos
        prepared = self.prepare_for_ai(file_path)
        
        # Mostrar resumen
        print(f"\n📊 DATOS PREPARADOS:")
        print(f"  • Track: {prepared['track']['artist']} - {prepared['track']['title']}")
        print(f"  • ISRC: {prepared['track']['isrc']}")
        print(f"  • Year: {prepared['track']['year']}")
        
        print(f"\n🎵 PRECOMPUTED:")
        for key, value in prepared['precomputed'].items():
            if value is not None and key not in ['windows_used', 'notes', 'extract_strategy']:
                print(f"  • {key}: {value}")
                
        print(f"\n📝 LYRICS:")
        if prepared['lyrics']:
            preview = prepared['lyrics'][:100] + '...' if len(prepared['lyrics']) > 100 else prepared['lyrics']
            print(f"  {preview}")
        else:
            print(f"  (No lyrics)")
            
        # Generar prompt
        prompt = self.format_prompt(prepared)
        
        # Guardar prompt para revisión
        output_file = f"ai_prompt_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(output_file, 'w') as f:
            f.write(prompt)
            
        print(f"\n💾 Prompt guardado en: {output_file}")
        print(f"📏 Tamaño del prompt: {len(prompt)} caracteres")
        
        return prepared, prompt


def main():
    """Función principal de prueba"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Enhancer para metadata musical')
    parser.add_argument('file', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas/2 Unlimited - No Limit (Extended Mix).flac",
                       help='Archivo a procesar')
    
    args = parser.parse_args()
    
    # Crear enhancer
    enhancer = AIEnhancer()
    
    # Probar preparación
    prepared, prompt = enhancer.test_preparation(args.file)
    
    print(f"\n✅ Datos listos para enviar a IA")
    print(f"   Siguiente paso: Llamar a OpenAI/Claude API con el prompt")


if __name__ == "__main__":
    main()