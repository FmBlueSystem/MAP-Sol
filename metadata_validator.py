#!/usr/bin/env python3
"""
Validador y Normalizador de Metadata
Asegura que todos los datos tengan el tipo y formato correcto
"""

import re
import json
import base64
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import unicodedata


class MetadataValidator:
    """
    Valida y normaliza todos los campos de metadata
    para asegurar consistencia antes de enviar a IA
    """
    
    def __init__(self):
        # Definir tipos esperados para cada campo
        self.field_types = {
            # Strings básicos
            'title': str,
            'artist': str,
            'album': str,
            'album_artist': str,
            'genre': str,
            'composer': str,
            'publisher': str,
            'copyright': str,
            'comment': str,
            'isrc': str,
            
            # Números
            'bpm': float,
            'energy': float,
            'loudness': float,
            'danceability': float,
            'acousticness': float,
            'instrumentalness': float,
            'liveness': float,
            'speechiness': float,
            'valence': float,
            
            # Enteros
            'track_number': int,
            'disc_number': int,
            'year': int,
            'duration_seconds': float,
            'bitrate': int,
            'sample_rate': int,
            'channels': int,
            
            # Especiales
            'key': str,  # Formato: "3A", "C major", etc.
            'date': str,  # ISO format YYYY-MM-DD
            'lyrics': str,  # Sin timestamps
            'cover_art': str,  # Base64
        }
        
    def validate_and_normalize(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Valida y normaliza todos los campos de metadata
        
        Returns:
            Dict con metadata normalizada y validada
        """
        
        normalized = {}
        validation_report = {
            'valid_fields': [],
            'invalid_fields': [],
            'normalized_fields': [],
            'missing_fields': []
        }
        
        # Procesar cada campo
        for field, expected_type in self.field_types.items():
            value = metadata.get(field)
            
            if value is None:
                validation_report['missing_fields'].append(field)
                normalized[field] = None
                continue
                
            # Normalizar según tipo
            try:
                if expected_type == str:
                    normalized_value = self._normalize_string(value, field)
                elif expected_type == float:
                    normalized_value = self._normalize_float(value, field)
                elif expected_type == int:
                    normalized_value = self._normalize_int(value, field)
                else:
                    normalized_value = value
                    
                normalized[field] = normalized_value
                
                if normalized_value != value:
                    validation_report['normalized_fields'].append({
                        'field': field,
                        'original': value,
                        'normalized': normalized_value
                    })
                    
                validation_report['valid_fields'].append(field)
                
            except Exception as e:
                validation_report['invalid_fields'].append({
                    'field': field,
                    'value': value,
                    'error': str(e)
                })
                normalized[field] = None
                
        # Procesar campos especiales
        normalized = self._process_special_fields(normalized, metadata)
        
        # Agregar reporte de validación
        normalized['_validation_report'] = validation_report
        
        return normalized
    
    def _normalize_string(self, value: Any, field: str) -> Optional[str]:
        """Normaliza campos de tipo string"""
        
        if value is None:
            return None
            
        # Convertir a string
        text = str(value).strip()
        
        # Si está vacío, retornar None
        if not text or text.lower() in ['unknown', 'none', 'null', '']:
            return None
            
        # Normalizar encoding (remover caracteres raros)
        text = self._fix_encoding(text)
        
        # Casos especiales por campo
        if field == 'title' or field == 'artist' or field == 'album':
            # Capitalización correcta
            text = self._smart_title_case(text)
            
        elif field == 'genre':
            # Normalizar géneros comunes
            text = self._normalize_genre(text)
            
        elif field == 'isrc':
            # ISRC debe ser mayúsculas sin espacios
            text = text.upper().replace(' ', '').replace('-', '')
            
        elif field == 'key':
            # Normalizar notación de tonalidad
            text = self._normalize_key(text)
            
        elif field == 'lyrics':
            # Limpiar lyrics de timestamps
            text = self._clean_lyrics(text)
            
        return text
    
    def _normalize_float(self, value: Any, field: str) -> Optional[float]:
        """Normaliza campos de tipo float"""
        
        if value is None:
            return None
            
        try:
            num = float(value)
            
            # Validar rangos según campo
            if field in ['danceability', 'acousticness', 'instrumentalness', 
                        'liveness', 'speechiness', 'valence']:
                # Estos deben estar entre 0 y 1
                num = max(0.0, min(1.0, num))
                
            elif field == 'energy':
                # Si es > 1, es escala MIK (1-10)
                if num > 1:
                    num = num / 10.0
                num = max(0.0, min(1.0, num))
                
            elif field == 'bpm':
                # BPM típico entre 60-200
                num = max(60.0, min(200.0, num))
                
            elif field == 'loudness':
                # LUFS típico entre -60 y 0
                num = max(-60.0, min(0.0, num))
                
            return round(num, 3)
            
        except (ValueError, TypeError):
            return None
    
    def _normalize_int(self, value: Any, field: str) -> Optional[int]:
        """Normaliza campos de tipo entero"""
        
        if value is None:
            return None
            
        try:
            # Manejar formato "1/12" para track_number
            if field == 'track_number' and isinstance(value, str) and '/' in value:
                value = value.split('/')[0]
                
            num = int(float(value))  # float primero por si viene "1.0"
            
            # Validar rangos
            if field == 'year':
                # Año entre 1900 y año actual
                current_year = datetime.now().year
                num = max(1900, min(current_year, num))
                
            elif field in ['track_number', 'disc_number']:
                # No puede ser negativo
                num = max(1, num)
                
            return num
            
        except (ValueError, TypeError):
            return None
    
    def _process_special_fields(self, normalized: Dict, original: Dict) -> Dict:
        """Procesa campos especiales que requieren lógica adicional"""
        
        # 1. FECHA - Extraer año, mes, día
        if 'date' in original and original['date']:
            date_parts = self._parse_date(original['date'])
            normalized.update(date_parts)
        else:
            normalized['year'] = normalized.get('year')
            normalized['month'] = None
            normalized['day'] = None
            
        # 2. TRACK NUMBER - Separar current/total
        if 'track_number' in original and original['track_number']:
            track_parts = self._parse_track_number(original['track_number'])
            normalized.update(track_parts)
            
        # 3. DURACIÓN - Agregar formato legible
        if normalized.get('duration_seconds'):
            normalized['duration_formatted'] = self._format_duration(normalized['duration_seconds'])
            
        # 4. COVER ART - Extraer y codificar
        if 'has_cover' in original and original['has_cover']:
            normalized['has_cover'] = True
            normalized['cover_format'] = original.get('cover_format')
            normalized['cover_size_kb'] = original.get('cover_size_kb')
            # TODO: Extraer y codificar en base64 si es necesario
        else:
            normalized['has_cover'] = False
            
        # 5. FILE INFO
        normalized['file_name'] = original.get('file_name')
        normalized['file_size_mb'] = original.get('file_size_mb')
        normalized['format'] = original.get('format')
        normalized['codec'] = original.get('codec')
        
        return normalized
    
    def _fix_encoding(self, text: str) -> str:
        """Arregla problemas de encoding comunes"""
        
        # Normalizar Unicode
        text = unicodedata.normalize('NFKD', text)
        
        # Reemplazar caracteres problemáticos comunes
        replacements = {
            ''': "'",
            ''': "'",
            '"': '"',
            '"': '"',
            '–': '-',
            '—': '-',
            '…': '...',
            'Ã¡': 'á',
            'Ã©': 'é',
            'Ã­': 'í',
            'Ã³': 'ó',
            'Ãº': 'ú',
            'Ã±': 'ñ',
            'Ã': 'Á',
            'Ã‰': 'É',
            'Ã': 'Í',
            'Ã"': 'Ó',
            'Ãš': 'Ú',
            # 'Ã'': 'Ñ',  # Comentado por carácter problemático
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
            
        # Remover caracteres no imprimibles
        text = ''.join(char for char in text if char.isprintable() or char in '\n\r\t')
        
        return text
    
    def _smart_title_case(self, text: str) -> str:
        """Capitalización inteligente para títulos"""
        
        # Palabras que no se capitalizan (excepto al inicio)
        minor_words = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 
                      'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 
                      'up', 'yet', 'la', 'el', 'los', 'las', 'de', 'del'}
        
        words = text.split()
        result = []
        
        for i, word in enumerate(words):
            # Primera palabra siempre capitalizada
            if i == 0:
                result.append(word.capitalize())
            # Acrónimos y siglas en mayúsculas
            elif word.isupper() and len(word) <= 4:
                result.append(word)
            # Palabras menores en minúsculas
            elif word.lower() in minor_words:
                result.append(word.lower())
            # El resto capitalizado
            else:
                result.append(word.capitalize())
                
        return ' '.join(result)
    
    def _normalize_genre(self, genre: str) -> str:
        """Normaliza nombres de géneros"""
        
        # Mapeo de variaciones comunes
        genre_map = {
            'hip hop': 'Hip-Hop',
            'hip_hop': 'Hip-Hop',
            'hiphop': 'Hip-Hop',
            'r&b': 'R&B',
            'rnb': 'R&B',
            'rock n roll': "Rock 'n' Roll",
            'rock & roll': "Rock 'n' Roll",
            'drum n bass': 'Drum & Bass',
            'dnb': 'Drum & Bass',
            'edm': 'Electronic',
            'electronica': 'Electronic',
            'idm': 'Electronic',
        }
        
        genre_lower = genre.lower().strip()
        
        if genre_lower in genre_map:
            return genre_map[genre_lower]
            
        # Capitalizar primera letra de cada palabra
        return ' '.join(word.capitalize() for word in genre.split())
    
    def _normalize_key(self, key: str) -> str:
        """Normaliza notación de tonalidad"""
        
        if not key:
            return None
            
        key = key.strip()
        
        # Si ya está en formato Camelot (1A-12B), mantenerlo
        if re.match(r'^\d{1,2}[AB]$', key):
            return key
            
        # Convertir notación tradicional
        # C, D, E, F, G, A, B con # o b
        # major, minor, maj, min
        
        # Simplificar
        key = key.replace('major', 'maj').replace('minor', 'min')
        key = key.replace('Major', 'maj').replace('Minor', 'min')
        
        # Formato estándar: "C maj" o "A min"
        parts = key.split()
        if len(parts) >= 2:
            note = parts[0].upper()
            scale = parts[1].lower()
            return f"{note} {scale}"
            
        return key
    
    def _clean_lyrics(self, lyrics: str) -> str:
        """Limpia lyrics removiendo timestamps y formato LRC"""
        
        if not lyrics:
            return None
            
        # Remover timestamps [00:00.00]
        lyrics = re.sub(r'\[\d{2}:\d{2}\.\d{2}\]', '', lyrics)
        
        # Remover timestamps [00:00]
        lyrics = re.sub(r'\[\d{2}:\d{2}\]', '', lyrics)
        
        # Remover líneas vacías múltiples
        lyrics = re.sub(r'\n\s*\n', '\n\n', lyrics)
        
        # Trim
        lyrics = lyrics.strip()
        
        return lyrics if lyrics else None
    
    def _parse_date(self, date_str: str) -> Dict[str, Optional[int]]:
        """Parsea fecha en formato ISO o similar"""
        
        result = {'year': None, 'month': None, 'day': None}
        
        if not date_str:
            return result
            
        # Intentar parsear ISO format (YYYY-MM-DD)
        try:
            if '-' in date_str:
                parts = date_str.split('-')
                if len(parts) >= 1:
                    result['year'] = int(parts[0])
                if len(parts) >= 2:
                    result['month'] = int(parts[1])
                if len(parts) >= 3:
                    result['day'] = int(parts[2].split('T')[0])  # Por si viene con hora
            # Solo año
            elif len(date_str) == 4 and date_str.isdigit():
                result['year'] = int(date_str)
                
        except (ValueError, IndexError):
            pass
            
        return result
    
    def _parse_track_number(self, track_str: Any) -> Dict[str, Optional[int]]:
        """Parsea track number que puede venir como '1/12' o '1'"""
        
        result = {'track_current': None, 'track_total': None}
        
        if not track_str:
            return result
            
        track_str = str(track_str)
        
        if '/' in track_str:
            parts = track_str.split('/')
            try:
                result['track_current'] = int(parts[0])
                if len(parts) > 1:
                    result['track_total'] = int(parts[1])
            except ValueError:
                pass
        else:
            try:
                result['track_current'] = int(float(track_str))
            except ValueError:
                pass
                
        return result
    
    def _format_duration(self, seconds: float) -> str:
        """Formatea duración en formato legible MM:SS"""
        
        if not seconds:
            return "0:00"
            
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        
        return f"{minutes}:{secs:02d}"
    
    def print_validation_report(self, normalized_data: Dict):
        """Imprime reporte de validación"""
        
        report = normalized_data.get('_validation_report', {})
        
        print("\n" + "="*60)
        print("📋 REPORTE DE VALIDACIÓN")
        print("="*60)
        
        print(f"\n✅ Campos válidos: {len(report.get('valid_fields', []))}")
        print(f"❌ Campos inválidos: {len(report.get('invalid_fields', []))}")
        print(f"🔄 Campos normalizados: {len(report.get('normalized_fields', []))}")
        print(f"⚠️ Campos faltantes: {len(report.get('missing_fields', []))}")
        
        if report.get('normalized_fields'):
            print(f"\n🔄 CAMPOS NORMALIZADOS:")
            for item in report['normalized_fields'][:5]:  # Mostrar solo 5
                print(f"  • {item['field']}: '{item['original']}' → '{item['normalized']}'")
                
        if report.get('invalid_fields'):
            print(f"\n❌ CAMPOS INVÁLIDOS:")
            for item in report['invalid_fields']:
                print(f"  • {item['field']}: {item['error']}")
                
        if report.get('missing_fields'):
            print(f"\n⚠️ CAMPOS FALTANTES:")
            print(f"  {', '.join(report['missing_fields'][:10])}")


def test_validator():
    """Prueba el validador con datos reales"""
    
    # Datos de ejemplo con problemas típicos
    test_data = {
        'title': 'NO LIMIT (extended mix)',
        'artist': '2 UNLIMITED',
        'album': 'summer hitz: throwback 4',
        'date': '2020-03-03',
        'bpm': '141.0',  # String en vez de float
        'energy': 8,  # Escala MIK (1-10)
        'key': '3A',
        'track_number': '12/20',  # Formato complejo
        'lyrics': '[00:06.96] Let me hear you say yeah (yeah)\n[00:10.38] Let me hear you say yeah',
        'duration_seconds': 355.01,
        'loudness': -12.38,
        'danceability': 0.773,
        'speechiness': 0.062,
        'valence': 0.46,
    }
    
    # Crear validador
    validator = MetadataValidator()
    
    # Validar y normalizar
    normalized = validator.validate_and_normalize(test_data)
    
    # Mostrar reporte
    validator.print_validation_report(normalized)
    
    # Mostrar algunos campos normalizados
    print(f"\n📊 DATOS NORMALIZADOS (muestra):")
    for key in ['title', 'artist', 'year', 'month', 'energy', 'track_current', 'lyrics']:
        if key in normalized:
            value = normalized[key]
            if key == 'lyrics' and value:
                value = value[:50] + '...' if len(value) > 50 else value
            print(f"  • {key}: {value}")
    
    return normalized


if __name__ == "__main__":
    test_validator()