#!/usr/bin/env python3
"""
Test simple de procesamiento directo con GPT-4
"""

import sys
import json
from pathlib import Path

print("Iniciando test...")

try:
    from metadata_reader_complete import CompleteMetadataReader
    print("✓ Metadata reader importado")
except Exception as e:
    print(f"✗ Error importando metadata reader: {e}")
    sys.exit(1)

try:
    from openai_processor_ultimate import UltimateOpenAIProcessor
    print("✓ OpenAI processor importado")
except Exception as e:
    print(f"✗ Error importando OpenAI processor: {e}")
    sys.exit(1)

try:
    from save_gpt4_complete import CompleteGPT4Saver
    print("✓ Database saver importado")
except Exception as e:
    print(f"✗ Error importando database saver: {e}")
    sys.exit(1)

print("\n✅ Todos los módulos importados correctamente")

# Buscar un archivo de prueba
folder = Path('/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks')
if not folder.exists():
    print(f"❌ Carpeta no encontrada: {folder}")
    sys.exit(1)

# Tomar el primer archivo
test_files = list(folder.glob('*.m4a'))[:1]
if not test_files:
    print("❌ No se encontraron archivos")
    sys.exit(1)

test_file = test_files[0]
print(f"\n📁 Archivo de prueba: {test_file.name}")

# Procesar
try:
    reader = CompleteMetadataReader()
    metadata = reader.read_all_metadata(str(test_file))
    print(f"\n📖 Metadata leída:")
    print(f"  • Artista: {metadata.get('artist', 'Unknown')}")
    print(f"  • Título: {metadata.get('title', 'Unknown')}")
    print(f"  • Album: {metadata.get('album', 'Unknown')}")
    print(f"  • Year: {metadata.get('year', 'Unknown')}")
    print(f"  • ISRC: {metadata.get('isrc', 'Unknown')}")
    print(f"  • BPM (MIK): {metadata.get('existing_bmp', 'N/A')}")
    print(f"  • Key (MIK): {metadata.get('existing_key', 'N/A')}")
    print(f"  • Energy (MIK): {metadata.get('existing_energy', 'N/A')}")
    
    print("\n🤖 Procesando con GPT-4...")
    processor = UltimateOpenAIProcessor()
    
    # El processor necesita el archivo completo
    result = processor.process_file(str(test_file))
    
    if result:
        print("\n✅ Análisis GPT-4 completado:")
        print(f"  • Género: {result.get('genre', 'Unknown')}")
        print(f"  • Subgéneros: {', '.join(result.get('subgenres', [])[:3])}")
        print(f"  • Mood: {result.get('mood', 'Unknown')}")
        print(f"  • Era: {result.get('era', 'Unknown')}")
        print(f"  • Instrumentos: {', '.join(result.get('instruments', [])[:3])}")
        
        # Guardar resultado
        output_file = Path('test_gpt4_result.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Resultado guardado en: {output_file}")
        
        # Intentar guardar en BD
        print("\n💾 Guardando en base de datos...")
        saver = CompleteGPT4Saver('music_analyzer.db')
        try:
            # Extraer audio_features del resultado si existe
            audio_features = result.get('audio_features', {})
            file_id = saver.ensure_file_exists(str(test_file), metadata)
            if file_id and saver.save_complete_gpt4_results(file_id, result, audio_features):
                print("✅ Guardado en BD exitosamente")
                saver.conn.commit()
            else:
                print("❌ Error al guardar en BD")
        finally:
            saver.conn.close()
    else:
        print("❌ GPT-4 no retornó resultado")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n✅ Test completado")