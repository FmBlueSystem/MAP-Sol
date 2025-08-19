#!/usr/bin/env python3
"""
Wrapper seguro para essentia_enhanced_v2.py
Maneja segmentation faults y otros crashes de manera elegante
"""

import os
import sys
import json
import subprocess
import signal
import sqlite3
from pathlib import Path
from typing import Dict, Any, Optional
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)

class SafeEssentiaWrapper:
    """Wrapper seguro que ejecuta el análisis en un subproceso aislado"""
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.problem_extensions = []
        
    def analyze_file(self, file_path: str, strategy: str = "smart60") -> Dict[str, Any]:
        """
        Analiza un archivo de manera segura usando un subproceso
        """
        file_path = str(Path(file_path).resolve())
        file_name = Path(file_path).name
        file_ext = Path(file_path).suffix.lower()
        
        result = {
            'file_path': file_path,
            'file_name': file_name,
            'status': 'processing',
            'timestamp': datetime.now().isoformat()
        }
        
        # Verificar si el archivo existe
        if not Path(file_path).exists():
            result['status'] = 'error'
            result['error'] = 'File not found'
            return result
        
        # Verificar extensión problemática conocida
        if file_ext in self.problem_extensions:
            logger.warning(f"Skipping known problematic extension: {file_ext}")
            result['status'] = 'skipped'
            result['error'] = f'Known problematic extension: {file_ext}'
            return result
        
        # Construir comando
        cmd = [
            sys.executable,
            'essentia_enhanced_v2.py',
            file_path,
            '--strategy', strategy,
            '--json', '-'  # Output to stdout
        ]
        
        try:
            # Ejecutar en subproceso con timeout
            logger.debug(f"Analyzing: {file_name}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=os.setsid  # Crear nuevo grupo de procesos
            )
            
            try:
                stdout, stderr = process.communicate(timeout=self.timeout)
                
                if process.returncode == 0:
                    # Análisis exitoso
                    try:
                        # Parsear resultado JSON del stdout
                        if stdout and stdout.strip():
                            # Buscar JSON en la salida
                            lines = stdout.strip().split('\n')
                            for line in reversed(lines):
                                if line.strip().startswith('{'):
                                    data = json.loads(line)
                                    if 'features' in data:
                                        result.update(data)
                                        result['status'] = 'success'
                                        break
                            else:
                                # No se encontró JSON válido, usar valores por defecto
                                result['status'] = 'success'
                                result['features'] = self._extract_features_from_output(stdout)
                        else:
                            result['status'] = 'error'
                            result['error'] = 'No output from analyzer'
                    except json.JSONDecodeError:
                        # Intentar extraer features del texto
                        result['status'] = 'success'
                        result['features'] = self._extract_features_from_output(stdout)
                        
                elif process.returncode == -signal.SIGSEGV:
                    # Segmentation fault
                    logger.error(f"Segmentation fault analyzing: {file_name}")
                    result['status'] = 'error'
                    result['error'] = 'Segmentation fault'
                    
                    # Agregar extensión a lista problemática si ocurre múltiples veces
                    if file_ext not in self.problem_extensions:
                        self.problem_extensions.append(file_ext)
                        
                else:
                    # Otro error
                    result['status'] = 'error'
                    result['error'] = f'Process exited with code {process.returncode}'
                    if stderr:
                        result['error'] += f': {stderr[:200]}'
                        
            except subprocess.TimeoutExpired:
                # Timeout - matar proceso
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                result['status'] = 'error'
                result['error'] = f'Timeout after {self.timeout} seconds'
                
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            
        return result
    
    def _extract_features_from_output(self, output: str) -> Dict[str, Any]:
        """
        Intenta extraer features del output de texto
        """
        features = {}
        
        # Buscar patrones en el output
        import re
        
        patterns = {
            'bpm': r'BPM[=:]\s*([\d.]+)',
            'key': r'Key[=:]\s*([A-G#b]+\s*(?:major|minor)?)',
            'energy': r'energy[=:]\s*([\d.]+)',
            'loudness': r'loudness[=:]\s*([-\d.]+)'
        }
        
        for feature, pattern in patterns.items():
            match = re.search(pattern, output, re.IGNORECASE)
            if match:
                value = match.group(1)
                if feature in ['bpm', 'energy', 'loudness']:
                    try:
                        features[feature] = float(value)
                    except:
                        pass
                else:
                    features[feature] = value
                    
        return features
    
    def save_to_db(self, result: Dict[str, Any], db_path: str = 'music_analyzer.db') -> bool:
        """
        Guarda el resultado en la base de datos
        """
        if result.get('status') != 'success':
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
            features = result.get('features', {})
            
            # Verificar si ya existe
            cursor.execute('SELECT file_id FROM llm_metadata WHERE file_id = ?', (file_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Actualizar
                cursor.execute('''
                    UPDATE llm_metadata
                    SET AI_LOUDNESS = ?, AI_BPM = ?, AI_KEY = ?,
                        AI_ENERGY = ?, AI_DANCEABILITY = ?, AI_ACOUSTICNESS = ?,
                        AI_INSTRUMENTALNESS = ?, AI_LIVENESS = ?, AI_SPEECHINESS = ?,
                        AI_VALENCE = ?, AI_TEMPO_CONFIDENCE = ?, AI_KEY_CONFIDENCE = ?
                    WHERE file_id = ?
                ''', (
                    features.get('loudness', 0),
                    features.get('bpm', 0),
                    features.get('key', ''),
                    features.get('energy', 0),
                    features.get('danceability', 0),
                    features.get('acousticness', 0),
                    features.get('instrumentalness', 0),
                    features.get('liveness', 0),
                    features.get('speechiness', 0),
                    features.get('valence', 0),
                    features.get('bpm_confidence', 0),
                    features.get('key_confidence', 0),
                    file_id
                ))
            else:
                # Insertar
                cursor.execute('''
                    INSERT INTO llm_metadata (
                        file_id, AI_LOUDNESS, AI_BPM, AI_KEY,
                        AI_ENERGY, AI_DANCEABILITY, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                        AI_VALENCE, AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_id,
                    features.get('loudness', 0),
                    features.get('bpm', 0),
                    features.get('key', ''),
                    features.get('energy', 0),
                    features.get('danceability', 0),
                    features.get('acousticness', 0),
                    features.get('instrumentalness', 0),
                    features.get('liveness', 0),
                    features.get('speechiness', 0),
                    features.get('valence', 0),
                    features.get('bpm_confidence', 0),
                    features.get('key_confidence', 0)
                ))
                
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            logger.error(f"Error saving to DB: {e}")
            return False


def process_file_safely(file_path: str, strategy: str = "smart60", save_db: bool = True) -> Dict[str, Any]:
    """
    Función helper para procesar un archivo de manera segura
    """
    wrapper = SafeEssentiaWrapper(timeout=30)
    result = wrapper.analyze_file(file_path, strategy)
    
    if save_db and result.get('status') == 'success':
        wrapper.save_to_db(result)
        
    return result


def main():
    """Función principal para pruebas"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Safe Essentia Wrapper')
    parser.add_argument('file', help='Audio file to analyze')
    parser.add_argument('--strategy', default='smart60', help='Analysis strategy')
    parser.add_argument('--save-db', action='store_true', help='Save to database')
    parser.add_argument('--json', help='Export to JSON file')
    
    args = parser.parse_args()
    
    # Procesar archivo
    print(f"🎵 Processing: {Path(args.file).name}")
    result = process_file_safely(args.file, args.strategy, args.save_db)
    
    # Mostrar resultado
    if result['status'] == 'success':
        print(f"✅ Success!")
        if 'features' in result:
            features = result['features']
            print(f"  BPM: {features.get('bpm', 'N/A')}")
            print(f"  Key: {features.get('key', 'N/A')}")
            print(f"  Energy: {features.get('energy', 'N/A')}")
    elif result['status'] == 'skipped':
        print(f"⏭️ Skipped: {result.get('error')}")
    else:
        print(f"❌ Error: {result.get('error')}")
        
    # Exportar JSON si se solicita
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"📄 Exported to: {args.json}")
        

if __name__ == '__main__':
    main()