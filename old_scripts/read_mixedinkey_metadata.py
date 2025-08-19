#!/usr/bin/env python3
"""
Script para leer y usar los metadatos existentes de MixedInKey
en lugar de recalcularlos con Essentia
"""

import os
import sys
import json
import base64
import sqlite3
from pathlib import Path
from typing import Dict, Any, Optional
from mutagen import File as MutagenFile
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger(__name__)

class MixedInKeyReader:
    """Lee metadatos de MixedInKey desde archivos de audio"""
    
    def __init__(self):
        self.stats = {
            'total': 0,
            'with_mik': 0,
            'without_mik': 0,
            'errors': 0
        }
    
    def decode_mik_field(self, encoded_data: str) -> Dict[str, Any]:
        """Decodifica campos base64 de MixedInKey"""
        try:
            decoded = base64.b64decode(encoded_data)
            # Intentar parsear como JSON
            json_str = decoded.decode('utf-8', errors='ignore')
            return json.loads(json_str)
        except:
            return None
    
    def read_file(self, file_path: str) -> Dict[str, Any]:
        """Lee metadatos de MixedInKey de un archivo"""
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'has_mik_data': False,
            'metadata': {}
        }
        
        try:
            audio = MutagenFile(file_path)
            if not audio:
                result['error'] = 'Could not read file'
                return result
            
            # Metadatos básicos
            for key in ['artist', 'title', 'album', 'genre', 'date']:
                if key in audio:
                    value = audio[key]
                    if isinstance(value, list) and value:
                        value = str(value[0])
                    result['metadata'][key] = str(value) if value else None
            
            # Metadatos de MixedInKey
            mik_data = {}
            
            # BPM directo
            if 'bpm' in audio:
                bpm_value = str(audio['bpm'][0]) if isinstance(audio['bpm'], list) else str(audio['bpm'])
                try:
                    mik_data['bpm'] = float(bpm_value)
                except:
                    mik_data['bpm'] = None
            
            # Key/InitialKey
            for key_field in ['key', 'initialkey']:
                if key_field in audio:
                    key_value = audio[key_field]
                    if isinstance(key_value, list) and key_value:
                        key_value = key_value[0]
                    
                    # Si es base64, decodificar
                    if key_field == 'key' and isinstance(key_value, str) and '==' in key_value:
                        decoded = self.decode_mik_field(key_value)
                        if decoded and 'key' in decoded:
                            mik_data['key'] = decoded['key']
                    else:
                        mik_data['key'] = str(key_value)
                    break
            
            # Energy
            if 'energy' in audio:
                energy_value = audio['energy']
                if isinstance(energy_value, list) and energy_value:
                    energy_value = energy_value[0]
                
                # Si es base64, decodificar
                if isinstance(energy_value, str) and len(energy_value) > 10:
                    decoded = self.decode_mik_field(energy_value)
                    if decoded and 'energyLevel' in decoded:
                        mik_data['energy_level'] = decoded['energyLevel']
                        # Normalizar a 0-1
                        mik_data['energy'] = decoded['energyLevel'] / 10.0
            
            # EnergyLevel directo
            if 'energylevel' in audio:
                level = audio['energylevel']
                if isinstance(level, list) and level:
                    level = level[0]
                try:
                    mik_data['energy_level'] = int(level)
                    mik_data['energy'] = int(level) / 10.0
                except:
                    pass
            
            # Comment (puede tener info adicional)
            if 'comment' in audio:
                comment = str(audio['comment'][0]) if isinstance(audio['comment'], list) else str(audio['comment'])
                mik_data['comment'] = comment
                # Algunos archivos tienen el key en el comment
                if ' - ' in comment and 'Energy' in comment:
                    parts = comment.split(' - ')
                    if len(parts) >= 2:
                        # Extraer key del formato "2A - Energy 7"
                        possible_key = parts[0].strip()
                        if len(possible_key) <= 3:
                            mik_data['key'] = possible_key
                        # Extraer energy
                        if 'Energy' in parts[1]:
                            try:
                                energy_num = int(parts[1].replace('Energy', '').strip())
                                mik_data['energy_level'] = energy_num
                                mik_data['energy'] = energy_num / 10.0
                            except:
                                pass
            
            # BeatGrid (contiene tempo preciso)
            if 'beatgrid' in audio:
                beatgrid = audio['beatgrid']
                if isinstance(beatgrid, list) and beatgrid:
                    beatgrid = beatgrid[0]
                decoded = self.decode_mik_field(beatgrid)
                if decoded and 'tempo' in decoded:
                    mik_data['bpm_precise'] = decoded['tempo']
                    if 'bpm' not in mik_data:
                        mik_data['bpm'] = round(decoded['tempo'])
            
            # CuePoints (pueden tener info de energía)
            if 'cuepoints' in audio:
                cuepoints = audio['cuepoints']
                if isinstance(cuepoints, list) and cuepoints:
                    cuepoints = cuepoints[0]
                decoded = self.decode_mik_field(cuepoints)
                if decoded and 'cues' in decoded:
                    mik_data['cue_points'] = len(decoded['cues'])
                    # Extraer niveles de energía de los cues
                    energy_levels = []
                    for cue in decoded['cues']:
                        if 'name' in cue and 'Energy' in cue['name']:
                            try:
                                level = int(cue['name'].replace('Energy', '').strip())
                                energy_levels.append(level)
                            except:
                                pass
                    if energy_levels:
                        mik_data['energy_variations'] = energy_levels
                        if 'energy' not in mik_data:
                            # Usar el promedio de energías
                            mik_data['energy'] = sum(energy_levels) / len(energy_levels) / 10.0
            
            result['mik_data'] = mik_data
            result['has_mik_data'] = bool(mik_data.get('bpm') or mik_data.get('key') or mik_data.get('energy'))
            
            if result['has_mik_data']:
                self.stats['with_mik'] += 1
                logger.info(f"✅ MIK data found: {Path(file_path).name} | BPM={mik_data.get('bpm')} | Key={mik_data.get('key')} | Energy={mik_data.get('energy')}")
            else:
                self.stats['without_mik'] += 1
                logger.warning(f"⚠️  No MIK data: {Path(file_path).name}")
            
        except Exception as e:
            result['error'] = str(e)
            self.stats['errors'] += 1
            logger.error(f"❌ Error reading {Path(file_path).name}: {e}")
        
        self.stats['total'] += 1
        return result
    
    def save_to_db(self, result: Dict[str, Any], db_path: str = 'music_analyzer.db') -> bool:
        """Guarda los metadatos de MixedInKey en la BD"""
        if not result.get('has_mik_data'):
            return False
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Buscar file_id
            file_path = result['file_path']
            cursor.execute('SELECT id FROM audio_files WHERE file_path = ?', (file_path,))
            row = cursor.fetchone()
            
            if not row:
                logger.warning(f"File not found in DB: {result['file_name']}")
                return False
            
            file_id = row[0]
            mik = result.get('mik_data', {})
            
            # Verificar si ya existe
            cursor.execute('SELECT file_id FROM llm_metadata WHERE file_id = ?', (file_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Actualizar solo campos de MixedInKey
                cursor.execute('''
                    UPDATE llm_metadata
                    SET AI_BPM = COALESCE(?, AI_BPM),
                        AI_KEY = COALESCE(?, AI_KEY),
                        AI_ENERGY = COALESCE(?, AI_ENERGY),
                        AI_TEMPO_CONFIDENCE = CASE WHEN ? IS NOT NULL THEN 1.0 ELSE AI_TEMPO_CONFIDENCE END,
                        AI_KEY_CONFIDENCE = CASE WHEN ? IS NOT NULL THEN 1.0 ELSE AI_KEY_CONFIDENCE END
                    WHERE file_id = ?
                ''', (
                    mik.get('bpm'),
                    mik.get('key'),
                    mik.get('energy'),
                    mik.get('bpm'),  # Para confidence
                    mik.get('key'),   # Para confidence
                    file_id
                ))
            else:
                # Insertar nuevo con datos de MixedInKey
                cursor.execute('''
                    INSERT INTO llm_metadata (
                        file_id, AI_BPM, AI_KEY, AI_ENERGY,
                        AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    file_id,
                    mik.get('bpm', 0),
                    mik.get('key', ''),
                    mik.get('energy', 0),
                    1.0 if mik.get('bpm') else 0,
                    1.0 if mik.get('key') else 0
                ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            logger.error(f"Error saving to DB: {e}")
            return False

def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Read MixedInKey metadata from audio files')
    parser.add_argument('path', help='File or directory to process')
    parser.add_argument('--save-db', action='store_true', help='Save to database')
    parser.add_argument('--limit', type=int, help='Limit number of files')
    
    args = parser.parse_args()
    
    reader = MixedInKeyReader()
    files_to_process = []
    
    path = Path(args.path)
    if path.is_file():
        files_to_process = [path]
    elif path.is_dir():
        audio_exts = ('.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aiff', '.aif')
        files_to_process = [p for p in path.rglob('*') if p.suffix.lower() in audio_exts]
        if args.limit:
            files_to_process = files_to_process[:args.limit]
    
    print(f"📊 Processing {len(files_to_process)} files...")
    print("=" * 60)
    
    saved_count = 0
    for i, file_path in enumerate(files_to_process, 1):
        print(f"[{i}/{len(files_to_process)}] Processing: {file_path.name}")
        
        result = reader.read_file(str(file_path))
        
        if args.save_db and result.get('has_mik_data'):
            if reader.save_to_db(result):
                saved_count += 1
    
    # Estadísticas finales
    print("\n" + "=" * 60)
    print("📊 FINAL STATISTICS:")
    print(f"  • Total processed: {reader.stats['total']}")
    print(f"  • With MIK data: {reader.stats['with_mik']} ({reader.stats['with_mik']*100//max(reader.stats['total'],1)}%)")
    print(f"  • Without MIK data: {reader.stats['without_mik']}")
    print(f"  • Errors: {reader.stats['errors']}")
    
    if args.save_db:
        print(f"  • Saved to DB: {saved_count}")

if __name__ == '__main__':
    main()