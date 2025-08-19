#!/usr/bin/env python3
"""
Analizador rápido para identificar problemas en archivos de música
"""

import os
import json
from pathlib import Path
from typing import Dict, List
from metadata_reader_complete import CompleteMetadataReader
from known_tracks_database import lookup_track

def analyze_test_folder(folder_path: str, limit: int = None):
    """Analiza rápidamente archivos para identificar problemas"""
    
    reader = CompleteMetadataReader()
    
    # Estadísticas
    stats = {
        'total': 0,
        'with_metadata': 0,
        'without_metadata': 0,
        'with_lyrics': 0,
        'without_lyrics': 0,
        'with_isrc': 0,
        'without_isrc': 0,
        'with_year': 0,
        'without_year': 0,
        'with_bpm': 0,
        'without_bpm': 0,
        'compilations': 0,
        'known_tracks': 0,
        'file_types': {},
        'problematic_files': []
    }
    
    # Obtener archivos
    audio_extensions = ['.flac', '.m4a', '.mp3']
    files = []
    
    for ext in audio_extensions:
        files.extend(Path(folder_path).glob(f'*{ext}'))
    
    if limit:
        files = files[:limit]
    
    print(f"📂 ANÁLISIS RÁPIDO DE {len(files)} ARCHIVOS")
    print("=" * 60)
    
    for file_path in files:
        stats['total'] += 1
        
        # Contar por tipo
        ext = file_path.suffix
        stats['file_types'][ext] = stats['file_types'].get(ext, 0) + 1
        
        try:
            # Leer metadata
            metadata = reader.read_all_metadata(str(file_path))
            
            # Verificar metadatos básicos
            has_basic = bool(metadata.get('artist') and metadata.get('title'))
            if has_basic:
                stats['with_metadata'] += 1
            else:
                stats['without_metadata'] += 1
                stats['problematic_files'].append({
                    'file': file_path.name,
                    'issue': 'Sin metadata básica'
                })
            
            # Verificar letras
            if metadata.get('lyrics'):
                stats['with_lyrics'] += 1
            else:
                stats['without_lyrics'] += 1
            
            # Verificar ISRC
            if metadata.get('isrc'):
                stats['with_isrc'] += 1
            else:
                stats['without_isrc'] += 1
            
            # Verificar año
            if metadata.get('year') or metadata.get('date'):
                stats['with_year'] += 1
            else:
                stats['without_year'] += 1
            
            # Verificar BPM
            if metadata.get('bpm'):
                stats['with_bpm'] += 1
            else:
                stats['without_bpm'] += 1
            
            # Detectar compilaciones
            album = (metadata.get('album') or '').lower()
            compilation_keywords = ['greatest hits', 'best of', 'collection', 
                                  'throwback', 'hitz', 'compilation']
            if any(kw in album for kw in compilation_keywords):
                stats['compilations'] += 1
            
            # Verificar si está en base de datos conocida
            if metadata.get('artist') and metadata.get('title'):
                known = lookup_track(metadata['artist'], metadata['title'])
                if known:
                    stats['known_tracks'] += 1
            
            # Imprimir resumen por archivo
            status = "✅" if has_basic else "❌"
            lyrics = "L" if metadata.get('lyrics') else "-"
            isrc = "I" if metadata.get('isrc') else "-"
            year = "Y" if (metadata.get('year') or metadata.get('date')) else "-"
            bpm = "B" if metadata.get('bpm') else "-"
            
            print(f"{status} [{lyrics}{isrc}{year}{bpm}] {file_path.name[:50]}")
            
            if metadata.get('artist'):
                print(f"   → {metadata['artist']} - {metadata.get('title', 'Unknown')}")
            
        except Exception as e:
            stats['problematic_files'].append({
                'file': file_path.name,
                'issue': str(e)
            })
            print(f"❌ [----] {file_path.name[:50]} - Error: {str(e)[:30]}")
    
    # Imprimir reporte
    print("\n" + "=" * 60)
    print("📊 REPORTE DE ANÁLISIS")
    print("=" * 60)
    
    print(f"\n📁 TIPOS DE ARCHIVO:")
    for ext, count in stats['file_types'].items():
        print(f"  • {ext}: {count} archivos")
    
    print(f"\n📈 ESTADÍSTICAS DE METADATA:")
    print(f"  • Con metadata básica: {stats['with_metadata']}/{stats['total']} ({stats['with_metadata']*100//stats['total']}%)")
    print(f"  • Sin metadata básica: {stats['without_metadata']}/{stats['total']} ({stats['without_metadata']*100//stats['total']}%)")
    
    print(f"\n📝 INFORMACIÓN ADICIONAL:")
    print(f"  • Con letras: {stats['with_lyrics']}/{stats['total']} ({stats['with_lyrics']*100//stats['total']}%)")
    print(f"  • Con ISRC: {stats['with_isrc']}/{stats['total']} ({stats['with_isrc']*100//stats['total']}%)")
    print(f"  • Con año: {stats['with_year']}/{stats['total']} ({stats['with_year']*100//stats['total']}%)")
    print(f"  • Con BPM: {stats['with_bpm']}/{stats['total']} ({stats['with_bpm']*100//stats['total']}%)")
    
    print(f"\n🎯 DETECCIONES:")
    print(f"  • Compilaciones: {stats['compilations']}")
    print(f"  • Tracks conocidos: {stats['known_tracks']}")
    
    if stats['problematic_files']:
        print(f"\n⚠️ ARCHIVOS PROBLEMÁTICOS ({len(stats['problematic_files'])}):")
        for problem in stats['problematic_files'][:10]:
            print(f"  • {problem['file'][:40]}: {problem['issue'][:40]}")
    
    # Guardar reporte
    report_file = f"quick_analysis_{Path(folder_path).name}.json"
    with open(report_file, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\n💾 Reporte guardado en: {report_file}")
    
    return stats


if __name__ == "__main__":
    import sys
    
    folder = sys.argv[1] if len(sys.argv) > 1 else '/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/pruebas'
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    analyze_test_folder(folder, limit)