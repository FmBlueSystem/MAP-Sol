#!/usr/bin/env python3
"""
Test simple de procesamiento de metadata
"""

import sys
import json
from pathlib import Path
from datetime import datetime

print("=" * 60)
print("🧪 TEST DE PROCESAMIENTO DE METADATA")
print("=" * 60)

# Importar lector de metadata
try:
    from metadata_reader_complete import CompleteMetadataReader
    reader = CompleteMetadataReader()
    print("✅ Metadata reader cargado")
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# Buscar archivos
folder = Path('/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks')
if not folder.exists():
    print(f"❌ Carpeta no encontrada: {folder}")
    sys.exit(1)

files = list(folder.glob('*.m4a'))[:10]  # Primeros 10 archivos
print(f"\n📁 Encontrados {len(files)} archivos para procesar")

# Procesar cada archivo
results = []
for idx, file in enumerate(files, 1):
    print(f"\n[{idx}/10] Procesando: {file.name[:50]}...")
    
    try:
        # Leer metadata
        metadata = reader.read_all_metadata(str(file))
        
        # Extraer datos clave
        result = {
            'file': file.name,
            'artist': metadata.get('artist', 'Unknown'),
            'title': metadata.get('title', 'Unknown'),
            'album': metadata.get('album', 'Unknown'),
            'year': metadata.get('year'),
            'isrc': metadata.get('isrc'),
            'bpm_mik': metadata.get('existing_bmp'),
            'key_mik': metadata.get('existing_key'),
            'energy_mik': metadata.get('existing_energy')
        }
        
        # Mostrar resumen
        print(f"  • {result['artist']} - {result['title']}")
        print(f"  • ISRC: {result['isrc'] or 'N/A'}")
        print(f"  • MIK: BPM={result['bpm_mik'] or 'N/A'}, Key={result['key_mik'] or 'N/A'}")
        
        results.append(result)
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        continue

# Guardar resultados
output_file = Path('metadata_test_results.json')
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump({
        'timestamp': datetime.now().isoformat(),
        'files_processed': len(results),
        'results': results
    }, f, indent=2, ensure_ascii=False)

print(f"\n=" * 60)
print(f"✅ COMPLETADO")
print(f"  • Archivos procesados: {len(results)}/10")
print(f"  • Resultados guardados en: {output_file}")

# Mostrar estadísticas
with_isrc = sum(1 for r in results if r['isrc'])
with_mik = sum(1 for r in results if r['bpm_mik'])

print(f"\n📊 Estadísticas:")
print(f"  • Con ISRC: {with_isrc}/{len(results)}")
print(f"  • Con Mixed In Key: {with_mik}/{len(results)}")
print("=" * 60)