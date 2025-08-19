#!/usr/bin/env python3
"""
Test del flujo de metadata: Verificar → Tipo → Leer → Mejorar con IA
Music Analyzer Pro - Prueba paso a paso
"""

import os
import sys
import json
import mimetypes
import hashlib
from pathlib import Path
from datetime import datetime

# Para leer metadata
try:
    from mutagen import File as MutagenFile
    from mutagen.flac import FLAC
    from mutagen.mp4 import MP4
    from mutagen.mp3 import MP3
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    print("⚠️ Mutagen no instalado. Instalar con: pip install mutagen")


class MetadataFlowTester:
    """Prueba el flujo de metadata paso a paso"""
    
    def __init__(self):
        self.results = {}
        
    def step1_verify_existence(self, file_path):
        """Paso 1: Verificar que el archivo existe y tiene contenido"""
        print("\n" + "="*60)
        print("PASO 1: VERIFICAR EXISTENCIA")
        print("="*60)
        
        path = Path(file_path)
        results = {
            'path': str(path),
            'exists': False,
            'has_content': False,
            'size_bytes': 0,
            'size_mb': 0,
            'readable': False
        }
        
        # ¿Existe?
        if path.exists():
            results['exists'] = True
            print(f"✅ Archivo existe: {path.name}")
            
            # ¿Tiene contenido?
            size = path.stat().st_size
            results['size_bytes'] = size
            results['size_mb'] = round(size / (1024*1024), 2)
            
            if size > 0:
                results['has_content'] = True
                print(f"✅ Tiene contenido: {results['size_mb']} MB")
            else:
                print(f"❌ Archivo vacío (0 bytes)")
                
            # ¿Es legible?
            if os.access(path, os.R_OK):
                results['readable'] = True
                print(f"✅ Archivo legible")
            else:
                print(f"❌ Sin permisos de lectura")
        else:
            print(f"❌ Archivo NO existe")
            
        self.results['step1'] = results
        return results['exists'] and results['has_content'] and results['readable']
    
    def step2_determine_type(self, file_path):
        """Paso 2: Determinar tipo de archivo"""
        print("\n" + "="*60)
        print("PASO 2: DETERMINAR TIPO")
        print("="*60)
        
        path = Path(file_path)
        results = {
            'extension': '',
            'mime_type': '',
            'format_valid': False,
            'audio_codec': '',
            'magic_bytes': ''
        }
        
        # Extensión
        results['extension'] = path.suffix.lower()
        print(f"📄 Extensión: {results['extension']}")
        
        # MIME type
        mime_type, _ = mimetypes.guess_type(str(path))
        results['mime_type'] = mime_type or 'unknown'
        print(f"📄 MIME type: {results['mime_type']}")
        
        # Magic bytes (primeros bytes del archivo)
        try:
            with open(path, 'rb') as f:
                magic = f.read(12)
                results['magic_bytes'] = magic.hex()[:20]
                
                # Verificar formato por magic bytes
                if magic.startswith(b'fLaC'):
                    results['audio_codec'] = 'FLAC'
                    results['format_valid'] = True
                    print(f"✅ Formato FLAC válido")
                elif magic[4:8] == b'ftyp':
                    results['audio_codec'] = 'M4A/MP4'
                    results['format_valid'] = True
                    print(f"✅ Formato M4A/MP4 válido")
                elif magic.startswith(b'ID3') or magic.startswith(b'\xff\xfb'):
                    results['audio_codec'] = 'MP3'
                    results['format_valid'] = True
                    print(f"✅ Formato MP3 válido")
                else:
                    print(f"⚠️ Formato no reconocido por magic bytes")
                    
        except Exception as e:
            print(f"❌ Error leyendo magic bytes: {e}")
            
        # Verificar si es formato soportado
        supported_formats = ['.flac', '.m4a', '.mp3', '.wav', '.ogg']
        if results['extension'] in supported_formats:
            print(f"✅ Formato soportado: {results['extension']}")
        else:
            print(f"❌ Formato no soportado: {results['extension']}")
            
        self.results['step2'] = results
        return results['format_valid']
    
    def step3_read_metadata(self, file_path):
        """Paso 3: Leer metadata del archivo"""
        print("\n" + "="*60)
        print("PASO 3: LEER METADATA")
        print("="*60)
        
        results = {
            'title': '',
            'artist': '',
            'album': '',
            'date': '',
            'genre': '',
            'track_number': '',
            'duration_seconds': 0,
            'bitrate': 0,
            'sample_rate': 0,
            'channels': 0,
            'metadata_found': False
        }
        
        if not MUTAGEN_AVAILABLE:
            print("❌ Mutagen no disponible para leer metadata")
            self.results['step3'] = results
            return False
            
        try:
            # Cargar archivo con mutagen
            audio_file = MutagenFile(file_path)
            
            if audio_file is None:
                print("❌ No se pudo leer el archivo")
                self.results['step3'] = results
                return False
                
            # Leer tags comunes
            if hasattr(audio_file, 'tags') and audio_file.tags:
                results['metadata_found'] = True
                
                # Título
                for key in ['TIT2', 'TITLE', '\xa9nam']:
                    if key in audio_file.tags:
                        results['title'] = str(audio_file.tags[key][0])
                        break
                        
                # Artista
                for key in ['TPE1', 'ARTIST', '\xa9ART']:
                    if key in audio_file.tags:
                        results['artist'] = str(audio_file.tags[key][0])
                        break
                        
                # Álbum
                for key in ['TALB', 'ALBUM', '\xa9alb']:
                    if key in audio_file.tags:
                        results['album'] = str(audio_file.tags[key][0])
                        break
                        
                # Género
                for key in ['TCON', 'GENRE', '\xa9gen']:
                    if key in audio_file.tags:
                        results['genre'] = str(audio_file.tags[key][0])
                        break
                        
                # Año
                for key in ['TDRC', 'DATE', '\xa9day']:
                    if key in audio_file.tags:
                        results['date'] = str(audio_file.tags[key][0])[:4]
                        break
            
            # Información técnica
            if hasattr(audio_file.info, 'length'):
                results['duration_seconds'] = round(audio_file.info.length, 2)
                
            if hasattr(audio_file.info, 'bitrate'):
                results['bitrate'] = audio_file.info.bitrate
                
            if hasattr(audio_file.info, 'sample_rate'):
                results['sample_rate'] = audio_file.info.sample_rate
                
            if hasattr(audio_file.info, 'channels'):
                results['channels'] = audio_file.info.channels
                
            # Mostrar resultados
            print(f"📝 Metadata encontrada:")
            print(f"  • Título: {results['title'] or '(vacío)'}")
            print(f"  • Artista: {results['artist'] or '(vacío)'}")
            print(f"  • Álbum: {results['album'] or '(vacío)'}")
            print(f"  • Género: {results['genre'] or '(vacío)'}")
            print(f"  • Año: {results['date'] or '(vacío)'}")
            print(f"\n📊 Información técnica:")
            print(f"  • Duración: {results['duration_seconds']} segundos")
            print(f"  • Bitrate: {results['bitrate']} bps")
            print(f"  • Sample rate: {results['sample_rate']} Hz")
            print(f"  • Canales: {results['channels']}")
            
        except Exception as e:
            print(f"❌ Error leyendo metadata: {e}")
            
        self.results['step3'] = results
        return results['metadata_found']
    
    def step4_process_with_essentia(self, file_path):
        """Paso 4: Procesar con Essentia (7 características)"""
        print("\n" + "="*60)
        print("PASO 4: PROCESAR CON ESSENTIA")
        print("="*60)
        
        original = metadata.copy()
        enhanced = metadata.copy()
        
        print("🤖 Análisis de IA (simulado):")
        
        # Simular mejoras de IA
        improvements = []
        
        # 1. Limpiar espacios y caracteres
        if enhanced['title']:
            clean_title = enhanced['title'].strip().title()
            if clean_title != enhanced['title']:
                enhanced['title'] = clean_title
                improvements.append(f"Título normalizado: {clean_title}")
                
        # 2. Completar información faltante
        if not enhanced['genre'] and enhanced['artist']:
            # Simular detección de género por artista
            artist_lower = enhanced['artist'].lower()
            if 'beethoven' in artist_lower or 'mozart' in artist_lower:
                enhanced['genre'] = 'Classical'
                improvements.append("Género detectado: Classical")
            elif 'metallica' in artist_lower or 'iron maiden' in artist_lower:
                enhanced['genre'] = 'Metal'
                improvements.append("Género detectado: Metal")
            else:
                enhanced['genre'] = 'Pop'
                improvements.append("Género asignado: Pop (default)")
                
        # 3. Detectar año si falta
        if not enhanced['date'] and enhanced['album']:
            # Simular detección de año
            enhanced['date'] = '2020'
            improvements.append("Año estimado: 2020")
            
        # 4. Agregar campos de IA
        enhanced['ai_mood'] = 'Energetic' if enhanced.get('genre') == 'Metal' else 'Relaxed'
        enhanced['ai_energy'] = 0.8 if 'dance' in str(enhanced.get('genre', '')).lower() else 0.5
        enhanced['ai_confidence'] = 0.75
        
        improvements.append(f"Mood detectado: {enhanced['ai_mood']}")
        improvements.append(f"Energía estimada: {enhanced['ai_energy']}")
        
        # Mostrar mejoras
        if improvements:
            print("✅ Mejoras aplicadas:")
            for improvement in improvements:
                print(f"  • {improvement}")
        else:
            print("ℹ️ No se requieren mejoras")
            
        # Comparación
        print("\n📊 Comparación:")
        for key in ['title', 'artist', 'album', 'genre', 'date']:
            if original.get(key) != enhanced.get(key):
                print(f"  • {key}: '{original.get(key)}' → '{enhanced.get(key)}'")
                
        self.results['step4'] = {
            'original': original,
            'enhanced': enhanced,
            'improvements': improvements
        }
        
        return enhanced
    
    def run_complete_test(self, file_path):
        """Ejecuta la prueba completa"""
        print("\n" + "="*70)
        print("🎵 PRUEBA DE FLUJO DE METADATA")
        print("="*70)
        print(f"Archivo: {Path(file_path).name}")
        print("="*70)
        
        # Paso 1: Verificar existencia
        if not self.step1_verify_existence(file_path):
            print("\n❌ Fallo en Paso 1: Archivo no válido")
            return False
            
        # Paso 2: Determinar tipo
        if not self.step2_determine_type(file_path):
            print("\n⚠️ Advertencia en Paso 2: Formato no reconocido")
            # Continuar de todos modos
            
        # Paso 3: Leer metadata
        if not self.step3_read_metadata(file_path):
            print("\n⚠️ Advertencia en Paso 3: Sin metadata")
            
        # Paso 4: Mejorar con IA
        if 'step3' in self.results:
            enhanced = self.step4_enhance_with_ai(self.results['step3'])
            
        # Resumen final
        print("\n" + "="*70)
        print("📊 RESUMEN FINAL")
        print("="*70)
        
        success_count = 0
        if self.results.get('step1', {}).get('has_content'):
            print("✅ Paso 1: Archivo válido")
            success_count += 1
        else:
            print("❌ Paso 1: Archivo no válido")
            
        if self.results.get('step2', {}).get('format_valid'):
            print("✅ Paso 2: Formato reconocido")
            success_count += 1
        else:
            print("⚠️ Paso 2: Formato no reconocido")
            
        if self.results.get('step3', {}).get('metadata_found'):
            print("✅ Paso 3: Metadata leída")
            success_count += 1
        else:
            print("⚠️ Paso 3: Sin metadata")
            
        if self.results.get('step4', {}).get('improvements'):
            print("✅ Paso 4: Metadata mejorada con IA")
            success_count += 1
        else:
            print("ℹ️ Paso 4: Sin mejoras necesarias")
            
        print(f"\n🎯 Resultado: {success_count}/4 pasos completados")
        
        # Guardar resultados
        output_file = f"metadata_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\n💾 Resultados guardados en: {output_file}")
        
        return True


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test de flujo de metadata')
    parser.add_argument('file', nargs='?', 
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/ABBA - Dancing Queen.flac",
                       help='Archivo a probar')
    
    args = parser.parse_args()
    
    # Ejecutar prueba
    tester = MetadataFlowTester()
    tester.run_complete_test(args.file)


if __name__ == "__main__":
    main()