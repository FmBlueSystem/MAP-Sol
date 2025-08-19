#!/usr/bin/env python3
"""
Lector Completo de Metadata - Music Analyzer Pro
Lee TODOS los campos de metadata necesarios para Essentia
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional
import base64
import re

# Para leer metadata
try:
    from mutagen import File as MutagenFile
    from mutagen.flac import FLAC
    from mutagen.mp4 import MP4
    from mutagen.mp3 import MP3
    from mutagen.id3 import ID3, APIC
    from mutagen.mp4 import MP4Cover
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    print("⚠️ Instalar mutagen: pip install mutagen")

# Importar parser de nombres de archivo
try:
    from filename_parser import parse_filename, extract_year_from_filename, detect_genre_from_filename
    PARSER_AVAILABLE = True
except ImportError:
    PARSER_AVAILABLE = False


class CompleteMetadataReader:
    """Lee TODA la metadata disponible de archivos de audio"""
    
    def __init__(self):
        self.supported_formats = {'.flac', '.m4a', '.mp3', '.mp4'}
        
    def _decode_mixed_in_key_data(self, data: str) -> Dict[str, Any]:
        """
        Decodifica datos de Mixed In Key que pueden estar en base64
        
        Returns:
            Dict con los datos decodificados o None si no se puede decodificar
        """
        if not data:
            return None
            
        try:
            # Intentar decodificar base64
            if self._is_base64(data):
                decoded_bytes = base64.b64decode(data)
                decoded_str = decoded_bytes.decode('utf-8')
                
                # Intentar parsear como JSON
                if decoded_str.startswith('{'):
                    return json.loads(decoded_str)
                else:
                    # Puede ser un valor simple
                    return {'value': decoded_str}
            else:
                # No es base64, retornar como está
                return {'value': data}
        except Exception:
            return None
            
    def _is_base64(self, s: str) -> bool:
        """Verifica si un string es base64 válido"""
        try:
            # Patrón base64
            if re.match(r'^[A-Za-z0-9+/]*={0,2}$', s):
                # Intentar decodificar
                base64.b64decode(s)
                return True
        except:
            pass
        return False
        
    def _extract_mik_from_comments(self, comments: str) -> Dict[str, Any]:
        """
        Extrae datos de Mixed In Key de comentarios
        
        Mixed In Key puede guardar datos como:
        - "MIK_BPM:123"
        - "MIK_KEY:10A"
        - "MIK_ENERGY:8"
        - O en formato JSON codificado
        """
        mik_data = {}
        
        if not comments:
            return mik_data
            
        # Buscar patrones MIK
        patterns = {
            'bpm': r'(?:MIK_)?BPM[:\s]+(\d+(?:\.\d+)?)',
            'key': r'(?:MIK_)?KEY[:\s]+([A-G]#?\d+[AB]?|[A-G]#?\s*(?:maj|min|major|minor)?)',
            'energy': r'(?:MIK_)?ENERGY[:\s]+(\d+(?:\.\d+)?)',
        }
        
        for field, pattern in patterns.items():
            match = re.search(pattern, comments, re.IGNORECASE)
            if match:
                value = match.group(1)
                if field == 'bpm' or field == 'energy':
                    try:
                        mik_data[field] = float(value)
                    except:
                        mik_data[field] = value
                else:
                    mik_data[field] = value
                    
        return mik_data
        
    def read_all_metadata(self, file_path: str) -> Dict[str, Any]:
        """
        Lee TODOS los campos de metadata disponibles
        
        Returns:
            Dict con todos los campos encontrados
        """
        
        if not MUTAGEN_AVAILABLE:
            return {'error': 'Mutagen no disponible'}
            
        path = Path(file_path)
        if not path.exists():
            return {'error': 'Archivo no existe'}
            
        # Resultado base
        metadata = {
            # Campos básicos
            'file_path': str(path),
            'file_name': path.name,
            'file_size_mb': round(path.stat().st_size / (1024*1024), 2),
            'format': path.suffix.lower(),
            
            # Metadata musical básica
            'title': None,
            'artist': None,
            'album': None,
            'date': None,
            'genre': None,
            'track_number': None,
            'album_artist': None,
            
            # Metadata avanzada para Essentia
            'bpm': None,           # Beats por minuto (si existe)
            'key': None,           # Tonalidad (si existe)
            'energy': None,        # Energía (si existe)
            
            # Metadata adicional
            'isrc': None,          # International Standard Recording Code
            'lyrics': None,        # Letra de la canción
            'composer': None,      # Compositor
            'publisher': None,     # Sello/Editorial
            'copyright': None,     # Copyright
            'comment': None,       # Comentarios
            
            # Cover art
            'has_cover': False,
            'cover_format': None,
            'cover_size_kb': 0,
            
            # Información técnica
            'duration_seconds': 0,
            'bitrate': 0,
            'sample_rate': 0,
            'channels': 0,
            'codec': None,
        }
        
        try:
            # Cargar archivo con mutagen
            audio_file = MutagenFile(file_path)
            
            if audio_file is None:
                metadata['error'] = 'No se pudo leer el archivo'
                # Intentar parsear desde nombre aunque no se pueda leer el archivo
                if PARSER_AVAILABLE:
                    filename = os.path.basename(file_path)
                    parsed = parse_filename(filename)
                    metadata['artist'] = parsed.get('artist', 'Unknown')
                    metadata['title'] = parsed.get('title', 'Unknown')
                    metadata['from_filename'] = True
                    year = extract_year_from_filename(filename)
                    if year:
                        metadata['date'] = year
                        metadata['year'] = year
                return metadata
                
            # Detectar formato y leer según tipo
            if isinstance(audio_file, FLAC):
                self._read_flac_metadata(audio_file, metadata)
            elif isinstance(audio_file, MP4):
                self._read_m4a_metadata(audio_file, metadata)
            elif isinstance(audio_file, MP3):
                self._read_mp3_metadata(audio_file, metadata)
            else:
                self._read_generic_metadata(audio_file, metadata)
                
            # Leer información técnica (común a todos)
            if hasattr(audio_file, 'info'):
                info = audio_file.info
                metadata['duration_seconds'] = round(info.length, 2) if hasattr(info, 'length') else 0
                metadata['bitrate'] = info.bitrate if hasattr(info, 'bitrate') else 0
                metadata['sample_rate'] = info.sample_rate if hasattr(info, 'sample_rate') else 0
                metadata['channels'] = info.channels if hasattr(info, 'channels') else 0
                
                # Codec específico
                if hasattr(info, 'codec'):
                    metadata['codec'] = info.codec
            
            # Si no hay metadata básica, intentar parsear desde el nombre del archivo
            if PARSER_AVAILABLE and (not metadata.get('artist') or metadata['artist'] == 'Unknown'):
                filename = os.path.basename(file_path)
                parsed = parse_filename(filename)
                
                # Solo usar si el parser encontró algo útil
                if parsed.get('artist') and parsed['artist'] != 'Unknown Artist':
                    metadata['artist'] = parsed['artist']
                    metadata['title'] = parsed.get('title', metadata.get('title'))
                    metadata['from_filename'] = True
                    
                    # Intentar extraer año
                    year = extract_year_from_filename(filename)
                    if year and not metadata.get('date'):
                        metadata['date'] = year
                        metadata['year'] = year
                    
                    # Sugerir género
                    genre_hint = detect_genre_from_filename(filename)
                    if genre_hint and not metadata.get('genre'):
                        metadata['genre'] = f"{genre_hint} (detected)"
                elif isinstance(audio_file, FLAC):
                    metadata['codec'] = 'FLAC'
                elif isinstance(audio_file, MP4):
                    metadata['codec'] = 'AAC'
                elif isinstance(audio_file, MP3):
                    metadata['codec'] = 'MP3'
                    
        except Exception as e:
            metadata['error'] = str(e)
            
        return metadata
    
    def _read_flac_metadata(self, audio_file: FLAC, metadata: Dict):
        """Lee metadata específica de FLAC (Vorbis Comments)"""
        
        tags = audio_file.tags
        if not tags:
            return
            
        # Mapeo de tags FLAC
        tag_map = {
            'TITLE': 'title',
            'ARTIST': 'artist',
            'ALBUM': 'album',
            'DATE': 'date',
            'GENRE': 'genre',
            'TRACKNUMBER': 'track_number',
            'ALBUMARTIST': 'album_artist',
            'COMPOSER': 'composer',
            'PUBLISHER': 'publisher',
            'COPYRIGHT': 'copyright',
            'ISRC': 'isrc',
            'COMMENT': 'comment',
            'LYRICS': 'lyrics',
            'BPM': 'bpm',
            'KEY': 'key',
            'ENERGY': 'energy',
            'INITIALKEY': 'key',  # Alternativa para key
            'TBPM': 'bpm',        # Alternativa para BPM
            'MIXEDINKEY': 'mixedinkey_data',  # Datos MIK codificados
            'MIK_DATA': 'mixedinkey_data',    # Alternativa
        }
        
        # Leer tags
        for flac_tag, field in tag_map.items():
            if flac_tag in tags:
                value = tags[flac_tag]
                if isinstance(value, list) and value:
                    value = value[0]
                metadata[field] = str(value) if value else None
                
                # Convertir BPM y energy a números
                if field == 'bpm' and metadata[field]:
                    try:
                        metadata['bpm'] = float(metadata['bpm'])
                    except:
                        metadata['bpm'] = None
                        
                if field == 'energy' and metadata[field]:
                    try:
                        # Mixed In Key usa escala 1-10
                        energy_value = float(metadata['energy'])
                        metadata['energy'] = energy_value
                        metadata['energy_scale'] = 'MIK' if energy_value > 1 else 'normalized'
                    except:
                        metadata['energy'] = None
                        
        # Procesar datos Mixed In Key codificados
        if metadata.get('mixedinkey_data'):
            mik_decoded = self._decode_mixed_in_key_data(metadata['mixedinkey_data'])
            if mik_decoded:
                # Extraer valores de MIK
                if isinstance(mik_decoded, dict):
                    if 'bpm' in mik_decoded and not metadata.get('bpm'):
                        metadata['bpm'] = float(mik_decoded['bpm'])
                    if 'key' in mik_decoded and not metadata.get('key'):
                        metadata['key'] = mik_decoded['key']
                    if 'energy' in mik_decoded and not metadata.get('energy'):
                        metadata['energy'] = float(mik_decoded['energy'])
                        metadata['energy_scale'] = 'MIK' if metadata['energy'] > 1 else 'normalized'
                        
        # También buscar en comentarios
        if metadata.get('comment'):
            mik_from_comments = self._extract_mik_from_comments(metadata['comment'])
            if mik_from_comments:
                for field in ['bpm', 'key', 'energy']:
                    if field in mik_from_comments and not metadata.get(field):
                        metadata[field] = mik_from_comments[field]
                        if field == 'energy' and metadata['energy'] > 1:
                            metadata['energy_scale'] = 'MIK'
                        
        # Cover art en FLAC
        if audio_file.pictures:
            pic = audio_file.pictures[0]
            metadata['has_cover'] = True
            metadata['cover_format'] = pic.mime
            metadata['cover_size_kb'] = round(len(pic.data) / 1024, 2)
    
    def _read_m4a_metadata(self, audio_file: MP4, metadata: Dict):
        """Lee metadata específica de M4A/MP4 (iTunes tags)"""
        
        tags = audio_file.tags
        if not tags:
            return
            
        # Mapeo de tags M4A
        tag_map = {
            '\xa9nam': 'title',
            '\xa9ART': 'artist',
            '\xa9alb': 'album',
            '\xa9day': 'date',
            '\xa9gen': 'genre',
            'trkn': 'track_number',
            'aART': 'album_artist',
            '\xa9wrt': 'composer',
            '\xa9pub': 'publisher',
            'cprt': 'copyright',
            '\xa9cmt': 'comment',
            '\xa9lyr': 'lyrics',
            'tmpo': 'bpm',
            '\xa9key': 'key',
            '----:com.apple.iTunes:ISRC': 'isrc',
            '----:com.apple.iTunes:BPM': 'bpm',
            '----:com.apple.iTunes:KEY': 'key',
            '----:com.apple.iTunes:ENERGY': 'energy',
            '----:com.apple.iTunes:ENERGYLEVEL': 'energy',  # Mixed In Key tag alternativo
        }
        
        # Leer tags
        for m4a_tag, field in tag_map.items():
            if m4a_tag in tags:
                value = tags[m4a_tag]
                if isinstance(value, list) and value:
                    value = value[0]
                    
                # Track number especial en M4A
                if field == 'track_number' and isinstance(value, tuple):
                    metadata['track_number'] = f"{value[0]}/{value[1]}" if len(value) > 1 else str(value[0])
                elif field == 'bpm' and value:
                    try:
                        # BPM en M4A puede venir como entero
                        metadata['bpm'] = float(value)
                    except:
                        metadata['bpm'] = None
                else:
                    metadata[field] = str(value) if value else None
                    
        # Cover art en M4A
        if 'covr' in tags:
            covers = tags['covr']
            if covers:
                metadata['has_cover'] = True
                metadata['cover_format'] = 'image/jpeg' if covers[0].imageformat == MP4Cover.FORMAT_JPEG else 'image/png'
                metadata['cover_size_kb'] = round(len(covers[0]) / 1024, 2)
    
    def _read_mp3_metadata(self, audio_file: MP3, metadata: Dict):
        """Lee metadata específica de MP3 (ID3v2)"""
        
        tags = audio_file.tags
        if not tags:
            return
            
        # Mapeo de tags ID3
        tag_map = {
            'TIT2': 'title',
            'TPE1': 'artist',
            'TALB': 'album',
            'TDRC': 'date',
            'TCON': 'genre',
            'TRCK': 'track_number',
            'TPE2': 'album_artist',
            'TCOM': 'composer',
            'TPUB': 'publisher',
            'TCOP': 'copyright',
            'COMM': 'comment',
            'USLT': 'lyrics',
            'TBPM': 'bpm',
            'TKEY': 'key',
            'TSRC': 'isrc',
            'TXXX:ENERGY': 'energy',  # Mixed In Key en MP3
            'TXXX:ENERGYLEVEL': 'energy',  # Alternativa MIK
        }
        
        # Leer tags
        for id3_tag, field in tag_map.items():
            if id3_tag in tags:
                frame = tags[id3_tag]
                if hasattr(frame, 'text'):
                    value = str(frame.text[0]) if frame.text else None
                else:
                    value = str(frame) if frame else None
                    
                metadata[field] = value
                
                # Convertir BPM a número
                if field == 'bpm' and metadata['bpm']:
                    try:
                        metadata['bpm'] = float(metadata['bpm'])
                    except:
                        metadata['bpm'] = None
                        
        # Lyrics especial
        if 'USLT' in tags:
            lyrics_frame = tags['USLT']
            if hasattr(lyrics_frame, 'text'):
                metadata['lyrics'] = lyrics_frame.text
                
        # Cover art en MP3
        for tag in tags.values():
            if isinstance(tag, APIC):
                metadata['has_cover'] = True
                metadata['cover_format'] = tag.mime
                metadata['cover_size_kb'] = round(len(tag.data) / 1024, 2)
                break
    
    def _read_generic_metadata(self, audio_file, metadata: Dict):
        """Lee metadata genérica para formatos no específicos"""
        
        if not hasattr(audio_file, 'tags') or not audio_file.tags:
            return
            
        tags = audio_file.tags
        
        # Intentar campos comunes
        common_fields = {
            'title': ['TIT2', 'TITLE', '\xa9nam'],
            'artist': ['TPE1', 'ARTIST', '\xa9ART'],
            'album': ['TALB', 'ALBUM', '\xa9alb'],
            'date': ['TDRC', 'DATE', '\xa9day'],
            'genre': ['TCON', 'GENRE', '\xa9gen'],
        }
        
        for field, possible_tags in common_fields.items():
            for tag in possible_tags:
                if tag in tags:
                    value = tags[tag]
                    if isinstance(value, list) and value:
                        value = value[0]
                    metadata[field] = str(value) if value else None
                    break
    
    def get_essentia_compatible_data(self, metadata: Dict) -> Dict:
        """
        Prepara los datos en formato compatible con Essentia
        
        Returns:
            Dict con tipos correctos para Essentia
        """
        
        essentia_data = {
            'file_path': metadata.get('file_path'),
            'duration': float(metadata.get('duration_seconds', 0)),
            'sample_rate': int(metadata.get('sample_rate', 44100)),
            
            # Datos que Essentia puede usar como entrada
            'bpm': None,
            'key': None,
            'energy': None,
        }
        
        # BPM: debe ser float entre 60-200
        if metadata.get('bpm'):
            try:
                bpm = float(metadata['bpm'])
                if 60 <= bpm <= 200:
                    essentia_data['bpm'] = bpm
            except:
                pass
                
        # Key: debe ser string con formato "X major/minor"
        if metadata.get('key'):
            key = str(metadata['key'])
            # Normalizar formato de key
            if key and not ('major' in key.lower() or 'minor' in key.lower()):
                # Intentar detectar si es mayor o menor
                if key in ['C', 'D', 'E', 'F', 'G', 'A', 'B']:
                    key = f"{key} major"
                elif key in ['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm']:
                    key = f"{key[0]} minor"
            essentia_data['key'] = key
            
        # Energy: convertir de Mixed In Key (1-10) a Essentia (0-1)
        if metadata.get('energy'):
            try:
                energy = float(metadata['energy'])
                
                # Detectar escala y convertir
                if energy > 1:  # Escala Mixed In Key (1-10)
                    # Validar rango MIK
                    if 1 <= energy <= 10:
                        essentia_data['energy'] = energy / 10.0
                        essentia_data['energy_original'] = energy
                        essentia_data['energy_scale'] = 'MIK'
                else:  # Ya está normalizado (0-1)
                    if 0 <= energy <= 1:
                        essentia_data['energy'] = energy
                        essentia_data['energy_scale'] = 'normalized'
            except:
                pass
                
        return essentia_data
    
    def print_metadata_report(self, metadata: Dict):
        """Imprime un reporte legible de la metadata"""
        
        print("\n" + "="*60)
        print("📊 METADATA COMPLETA")
        print("="*60)
        
        # Información básica
        print(f"\n📁 ARCHIVO:")
        print(f"  • Nombre: {metadata.get('file_name')}")
        print(f"  • Formato: {metadata.get('format')}")
        print(f"  • Tamaño: {metadata.get('file_size_mb')} MB")
        print(f"  • Duración: {metadata.get('duration_seconds')} segundos")
        
        # Metadata musical básica
        print(f"\n🎵 INFORMACIÓN MUSICAL:")
        print(f"  • Título: {metadata.get('title') or '(vacío)'}")
        print(f"  • Artista: {metadata.get('artist') or '(vacío)'}")
        print(f"  • Álbum: {metadata.get('album') or '(vacío)'}")
        print(f"  • Género: {metadata.get('genre') or '(vacío)'}")
        print(f"  • Año: {metadata.get('date') or '(vacío)'}")
        
        # Metadata para Essentia
        print(f"\n🎛️ DATOS PARA ESSENTIA:")
        print(f"  • BPM: {metadata.get('bpm') or '(no disponible)'}")
        print(f"  • Key: {metadata.get('key') or '(no disponible)'}")
        energy_str = '(no disponible)'
        if metadata.get('energy'):
            energy_val = metadata.get('energy')
            if metadata.get('energy_scale') == 'MIK':
                energy_str = f"{energy_val}/10 (Mixed In Key)"
            else:
                energy_str = f"{energy_val} (normalizado)"
        print(f"  • Energy: {energy_str}")
        
        # Metadata adicional
        print(f"\n📝 INFORMACIÓN ADICIONAL:")
        print(f"  • ISRC: {metadata.get('isrc') or '(no disponible)'}")
        print(f"  • Compositor: {metadata.get('composer') or '(no disponible)'}")
        print(f"  • Publisher: {metadata.get('publisher') or '(no disponible)'}")
        print(f"  • Lyrics: {'Sí' if metadata.get('lyrics') else 'No'}")
        print(f"  • Cover: {'Sí' if metadata.get('has_cover') else 'No'}")
        if metadata.get('has_cover'):
            print(f"    - Formato: {metadata.get('cover_format')}")
            print(f"    - Tamaño: {metadata.get('cover_size_kb')} KB")
        
        # Información técnica
        print(f"\n⚙️ INFORMACIÓN TÉCNICA:")
        print(f"  • Codec: {metadata.get('codec')}")
        print(f"  • Bitrate: {metadata.get('bitrate')} bps")
        print(f"  • Sample rate: {metadata.get('sample_rate')} Hz")
        print(f"  • Canales: {metadata.get('channels')}")
        
        # Resumen de completitud
        print(f"\n📈 COMPLETITUD:")
        basic_fields = ['title', 'artist', 'album', 'genre', 'date']
        essentia_fields = ['bpm', 'key', 'energy']
        extra_fields = ['isrc', 'composer', 'publisher', 'lyrics']
        
        basic_complete = sum(1 for f in basic_fields if metadata.get(f))
        essentia_complete = sum(1 for f in essentia_fields if metadata.get(f))
        extra_complete = sum(1 for f in extra_fields if metadata.get(f))
        
        print(f"  • Básicos: {basic_complete}/{len(basic_fields)}")
        print(f"  • Essentia: {essentia_complete}/{len(essentia_fields)}")
        print(f"  • Extras: {extra_complete}/{len(extra_fields)}")
        
        total = basic_complete + essentia_complete + extra_complete
        total_fields = len(basic_fields) + len(essentia_fields) + len(extra_fields)
        percentage = (total / total_fields) * 100
        print(f"  • TOTAL: {total}/{total_fields} ({percentage:.0f}%)")


def main():
    """Función principal de prueba"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Lector completo de metadata')
    parser.add_argument('file', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/ABBA - Dancing Queen.flac",
                       help='Archivo a analizar')
    parser.add_argument('--json', action='store_true',
                       help='Salida en JSON')
    
    args = parser.parse_args()
    
    # Crear lector
    reader = CompleteMetadataReader()
    
    # Leer metadata
    print(f"\n🔍 Leyendo: {Path(args.file).name}")
    metadata = reader.read_all_metadata(args.file)
    
    if args.json:
        # Salida JSON
        print(json.dumps(metadata, indent=2, default=str))
    else:
        # Reporte legible
        reader.print_metadata_report(metadata)
        
        # Mostrar datos para Essentia
        essentia_data = reader.get_essentia_compatible_data(metadata)
        print(f"\n✅ DATOS LISTOS PARA ESSENTIA:")
        for key, value in essentia_data.items():
            if value is not None:
                print(f"  • {key}: {value}")


if __name__ == "__main__":
    main()