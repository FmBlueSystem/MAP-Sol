#!/usr/bin/env python3
"""
Essentia Hybrid - Usa metadatos de MixedInKey cuando están disponibles
y solo calcula con Essentia cuando faltan
"""

import os
import sys
import json
import base64
import sqlite3
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import warnings

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)
warnings.filterwarnings("ignore")

# Importar módulos necesarios
try:
    from mutagen import File as MutagenFile
    MUTAGEN_AVAILABLE = True
except:
    MUTAGEN_AVAILABLE = False
    logger.warning("Mutagen no disponible")

try:
    import essentia
    import essentia.standard as es
    essentia.log.warningActive = False
    essentia.log.infoActive = False
    essentia.log.errorActive = False
    ESSENTIA_AVAILABLE = True
except:
    ESSENTIA_AVAILABLE = False
    logger.warning("Essentia no disponible")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except:
    NUMPY_AVAILABLE = False

class EssentiaHybrid:
    """
    Analizador híbrido que usa MixedInKey cuando está disponible
    y Essentia como fallback
    """
    
    def __init__(self, prefer_mik: bool = True):
        self.prefer_mik = prefer_mik
        self.stats = {
            'total': 0,
            'from_mik': 0,
            'from_essentia': 0,
            'from_both': 0,
            'errors': 0
        }
    
    def decode_mik_field(self, encoded_data: str) -> Dict[str, Any]:
        """Decodifica campos base64 de MixedInKey"""
        try:
            decoded = base64.b64decode(encoded_data)
            json_str = decoded.decode('utf-8', errors='ignore')
            return json.loads(json_str)
        except:
            return None
    
    def read_mik_metadata(self, file_path: str) -> Dict[str, Any]:
        """Lee metadatos de MixedInKey del archivo"""
        mik_data = {}
        
        if not MUTAGEN_AVAILABLE:
            return mik_data
        
        try:
            audio = MutagenFile(file_path)
            if not audio:
                return mik_data
            
            # BPM directo
            if 'bpm' in audio:
                bpm_value = str(audio['bpm'][0]) if isinstance(audio['bpm'], list) else str(audio['bpm'])
                try:
                    mik_data['bpm'] = float(bpm_value)
                    mik_data['bpm_confidence'] = 1.0  # MIK es confiable
                except:
                    pass
            
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
                            mik_data['key_confidence'] = 1.0
                    else:
                        mik_data['key'] = str(key_value)
                        mik_data['key_confidence'] = 1.0
                    break
            
            # Energy
            if 'energylevel' in audio:
                level = audio['energylevel']
                if isinstance(level, list) and level:
                    level = level[0]
                try:
                    mik_data['energy_level'] = int(level)
                    mik_data['energy'] = int(level) / 10.0  # Normalizar 0-1
                except:
                    pass
            elif 'energy' in audio:
                energy_value = audio['energy']
                if isinstance(energy_value, list) and energy_value:
                    energy_value = energy_value[0]
                
                # Si es base64, decodificar
                if isinstance(energy_value, str) and len(energy_value) > 10:
                    decoded = self.decode_mik_field(energy_value)
                    if decoded and 'energyLevel' in decoded:
                        mik_data['energy_level'] = decoded['energyLevel']
                        mik_data['energy'] = decoded['energyLevel'] / 10.0
            
            # Comment (puede tener key y energy)
            if 'comment' in audio:
                comment = str(audio['comment'][0]) if isinstance(audio['comment'], list) else str(audio['comment'])
                # Formato típico: "2A - Energy 7"
                if ' - ' in comment and 'Energy' in comment:
                    parts = comment.split(' - ')
                    if len(parts) >= 2:
                        # Extraer key
                        possible_key = parts[0].strip()
                        if len(possible_key) <= 3 and 'key' not in mik_data:
                            mik_data['key'] = possible_key
                            mik_data['key_confidence'] = 1.0
                        # Extraer energy
                        if 'Energy' in parts[1] and 'energy' not in mik_data:
                            try:
                                energy_num = int(parts[1].replace('Energy', '').strip())
                                mik_data['energy_level'] = energy_num
                                mik_data['energy'] = energy_num / 10.0
                            except:
                                pass
            
            # BeatGrid (tempo preciso)
            if 'beatgrid' in audio:
                beatgrid = audio['beatgrid']
                if isinstance(beatgrid, list) and beatgrid:
                    beatgrid = beatgrid[0]
                decoded = self.decode_mik_field(beatgrid)
                if decoded and 'tempo' in decoded:
                    mik_data['bpm_precise'] = decoded['tempo']
                    if 'bpm' not in mik_data:
                        mik_data['bpm'] = round(decoded['tempo'])
                        mik_data['bpm_confidence'] = 1.0
            
            # Metadatos básicos
            for key in ['artist', 'title', 'album', 'genre', 'date']:
                if key in audio:
                    value = audio[key]
                    if isinstance(value, list) and value:
                        value = str(value[0])
                    mik_data[key] = str(value) if value else None
            
        except Exception as e:
            logger.debug(f"Error leyendo MIK metadata: {e}")
        
        return mik_data
    
    def calculate_with_essentia(self, file_path: str, duration: int = 60) -> Dict[str, Any]:
        """Calcula features con Essentia cuando no hay datos de MIK"""
        features = {}
        
        # Para archivos m4a, intentar con Librosa primero
        if file_path.lower().endswith('.m4a'):
            logger.info(f"Archivo m4a detectado, intentando con Librosa primero: {Path(file_path).name}")
            features = self.calculate_with_librosa(file_path, duration)
            if features:
                return features
        
        if not ESSENTIA_AVAILABLE:
            # Si no hay Essentia, intentar con Librosa
            return self.calculate_with_librosa(file_path, duration)
        
        try:
            # Cargar audio
            loader = es.EasyLoader(filename=file_path, sampleRate=44100)
            audio = loader()
            
            # Si es stereo, convertir a mono
            if audio.ndim > 1:
                audio = np.mean(audio, axis=0)
            
            # Limitar duración
            if len(audio) > 44100 * duration:
                # Tomar del centro
                center = len(audio) // 2
                half_duration = (44100 * duration) // 2
                audio = audio[center - half_duration:center + half_duration]
            
            # BPM y ritmo
            try:
                rhythm_extractor = es.RhythmExtractor2013(method='degara')
                bpm, beats, beats_confidence, _, _ = rhythm_extractor(audio)
                features['bpm'] = float(bpm)
                features['bpm_confidence'] = float(beats_confidence)
            except:
                features['bpm'] = 120.0
                features['bpm_confidence'] = 0.5
            
            # Tonalidad
            try:
                key_extractor = es.KeyExtractor()
                key, scale, strength = key_extractor(audio)
                features['key'] = f"{key} {scale}".strip()
                features['key_confidence'] = float(strength)
            except:
                features['key'] = 'C major'
                features['key_confidence'] = 0.5
            
            # Energía (basada en RMS)
            try:
                rms = float(es.RMS()(audio))
                # Normalizar a 0-1
                energy = np.clip((20 * np.log10(max(rms, 1e-10)) + 60) / 60, 0, 1)
                features['energy'] = float(energy)
            except:
                features['energy'] = 0.5
            
            # Loudness
            try:
                # Duplicar para stereo (requerido por LoudnessEBUR128)
                audio_stereo = np.vstack([audio, audio])
                loudness_calc = es.LoudnessEBUR128(startAtZero=True)
                _, _, integrated, _ = loudness_calc(audio_stereo)
                features['loudness'] = float(np.clip(integrated, -60, 0))
            except:
                features['loudness'] = -23.0
            
            # Danceability (heurística basada en BPM)
            bpm_val = features.get('bpm', 120)
            if 115 <= bpm_val <= 135:  # Rango óptimo para bailar
                features['danceability'] = 0.8
            elif 100 <= bpm_val <= 150:
                features['danceability'] = 0.6
            else:
                features['danceability'] = 0.4
            
            # Features espectrales simples
            features['acousticness'] = 0.5
            features['instrumentalness'] = 0.8
            features['liveness'] = 0.1
            features['speechiness'] = 0.1
            features['valence'] = features.get('energy', 0.5)
            
        except Exception as e:
            logger.error(f"Error con Essentia: {e}")
        
        return features
    
    def calculate_with_librosa(self, file_path: str, duration: int = 60) -> Dict[str, Any]:
        """Calcula features con Librosa (más compatible con m4a)"""
        features = {}
        
        try:
            import librosa
            import librosa.feature
            
            # Cargar audio
            logger.info(f"Cargando con Librosa: {Path(file_path).name}")
            y, sr = librosa.load(file_path, sr=22050, duration=duration, mono=True)
            
            if len(y) == 0:
                return features
            
            # BPM
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            features['bpm'] = float(tempo)
            features['bpm_confidence'] = 0.8
            
            # Energy (basado en RMS)
            rms = librosa.feature.rms(y=y)
            energy = np.mean(rms) * 5  # Escalar a 0-1
            features['energy'] = float(np.clip(energy, 0, 1))
            
            # Key (estimación simple)
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)
            pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            key_idx = np.argmax(chroma_mean)
            features['key'] = pitch_classes[key_idx]
            features['key_confidence'] = float(chroma_mean[key_idx])
            
            # Loudness
            db = librosa.amplitude_to_db(rms.mean())
            features['loudness'] = float(np.clip(db, -60, 0))
            
            # Danceability (basado en tempo y energía)
            tempo_score = np.clip((features['bpm'] - 60) / 80, 0, 1)
            features['danceability'] = float((tempo_score + features['energy']) / 2)
            
            # Otros features
            features['acousticness'] = 0.5
            features['instrumentalness'] = 0.8
            features['liveness'] = 0.1
            features['speechiness'] = 0.1
            features['valence'] = features['energy']
            
            logger.info(f"✅ Librosa: {Path(file_path).name} | BPM={features['bpm']:.0f}")
            
        except ImportError:
            logger.warning("Librosa no disponible")
        except Exception as e:
            logger.error(f"Error con Librosa: {e}")
        
        return features
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """Procesa un archivo usando MIK primero, Essentia como fallback"""
        self.stats['total'] += 1
        
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'status': 'processing',
            'timestamp': datetime.now().isoformat(),
            'source': 'hybrid'
        }
        
        # 1. Intentar leer metadatos de MixedInKey
        mik_data = self.read_mik_metadata(file_path)
        has_mik = bool(mik_data.get('bpm') or mik_data.get('key') or mik_data.get('energy'))
        
        # 2. Decidir qué hacer basado en preferencias y disponibilidad
        features = {}
        
        if self.prefer_mik and has_mik:
            # Usar datos de MIK
            features['bpm'] = mik_data.get('bpm', 0)
            features['key'] = mik_data.get('key', '')
            features['energy'] = mik_data.get('energy', 0)
            features['bpm_confidence'] = mik_data.get('bpm_confidence', 1.0)
            features['key_confidence'] = mik_data.get('key_confidence', 1.0)
            
            # Estimar otros features basados en energy
            energy_val = features.get('energy', 0.5)
            features['danceability'] = min(energy_val * 1.2, 1.0)
            features['valence'] = energy_val
            features['loudness'] = -30 + (energy_val * 20)  # Estimar loudness
            
            # Valores por defecto para features no disponibles en MIK
            features['acousticness'] = 0.5
            features['instrumentalness'] = 0.8
            features['liveness'] = 0.1
            features['speechiness'] = 0.1
            
            result['data_source'] = 'mixedinkey'
            self.stats['from_mik'] += 1
            logger.info(f"✅ MIK: {Path(file_path).name} | BPM={features['bpm']:.0f} | Key={features['key']} | Energy={features['energy']:.2f}")
            
        elif not has_mik and ESSENTIA_AVAILABLE:
            # No hay datos MIK, usar Essentia
            features = self.calculate_with_essentia(file_path)
            if features:
                result['data_source'] = 'essentia'
                self.stats['from_essentia'] += 1
                logger.info(f"🔧 Essentia: {Path(file_path).name} | BPM={features.get('bpm', 0):.0f}")
            else:
                result['status'] = 'error'
                result['error'] = 'No analysis available'
                self.stats['errors'] += 1
                
        elif has_mik and not self.prefer_mik and ESSENTIA_AVAILABLE:
            # Combinar ambos (MIK + Essentia para features adicionales)
            features = self.calculate_with_essentia(file_path)
            # Sobrescribir con datos más confiables de MIK
            if mik_data.get('bpm'):
                features['bpm'] = mik_data['bpm']
                features['bpm_confidence'] = 1.0
            if mik_data.get('key'):
                features['key'] = mik_data['key']
                features['key_confidence'] = 1.0
            if mik_data.get('energy'):
                features['energy'] = mik_data['energy']
            
            result['data_source'] = 'combined'
            self.stats['from_both'] += 1
            logger.info(f"🔀 Combined: {Path(file_path).name}")
            
        else:
            # No hay análisis disponible
            result['status'] = 'error'
            result['error'] = 'No analysis method available'
            self.stats['errors'] += 1
            return result
        
        # Agregar metadatos básicos
        result['metadata'] = {
            'artist': mik_data.get('artist'),
            'title': mik_data.get('title'),
            'album': mik_data.get('album'),
            'genre': mik_data.get('genre'),
            'year': mik_data.get('date')
        }
        
        result['features'] = features
        result['status'] = 'success'
        
        return result
    
    def save_to_db(self, result: Dict[str, Any], db_path: str = 'music_analyzer.db') -> bool:
        """Guarda el resultado en la base de datos"""
        if result.get('status') != 'success':
            return False
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Buscar o crear entrada en audio_files
            file_path = result['file_path']
            metadata = result.get('metadata', {})
            
            # Verificar si existe
            cursor.execute('SELECT id FROM audio_files WHERE file_path = ?', (file_path,))
            row = cursor.fetchone()
            
            if row:
                file_id = row[0]
                # Actualizar metadatos si hay nuevos
                if any(metadata.values()):
                    cursor.execute('''
                        UPDATE audio_files 
                        SET artist = COALESCE(?, artist),
                            title = COALESCE(?, title),
                            album = COALESCE(?, album),
                            genre = COALESCE(?, genre)
                        WHERE id = ?
                    ''', (
                        metadata.get('artist'),
                        metadata.get('title'),
                        metadata.get('album'),
                        metadata.get('genre'),
                        file_id
                    ))
            else:
                # Insertar nuevo
                cursor.execute('''
                    INSERT INTO audio_files (file_path, file_name, artist, title, album, genre, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_path,
                    result['file_name'],
                    metadata.get('artist'),
                    metadata.get('title'),
                    metadata.get('album'),
                    metadata.get('genre'),
                    datetime.now().isoformat()
                ))
                file_id = cursor.lastrowid
            
            # Guardar features
            features = result['features']
            
            # Verificar si ya existe en llm_metadata
            cursor.execute('SELECT file_id FROM llm_metadata WHERE file_id = ?', (file_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Actualizar
                cursor.execute('''
                    UPDATE llm_metadata
                    SET AI_BPM = ?, AI_KEY = ?, AI_ENERGY = ?,
                        AI_DANCEABILITY = ?, AI_VALENCE = ?,
                        AI_ACOUSTICNESS = ?, AI_INSTRUMENTALNESS = ?,
                        AI_LIVENESS = ?, AI_SPEECHINESS = ?,
                        AI_LOUDNESS = ?, AI_TEMPO_CONFIDENCE = ?,
                        AI_KEY_CONFIDENCE = ?
                    WHERE file_id = ?
                ''', (
                    features.get('bpm', 0),
                    features.get('key', ''),
                    features.get('energy', 0),
                    features.get('danceability', 0),
                    features.get('valence', 0),
                    features.get('acousticness', 0),
                    features.get('instrumentalness', 0),
                    features.get('liveness', 0),
                    features.get('speechiness', 0),
                    features.get('loudness', 0),
                    features.get('bpm_confidence', 0),
                    features.get('key_confidence', 0),
                    file_id
                ))
            else:
                # Insertar
                cursor.execute('''
                    INSERT INTO llm_metadata (
                        file_id, AI_BPM, AI_KEY, AI_ENERGY,
                        AI_DANCEABILITY, AI_VALENCE, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                        AI_LOUDNESS, AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_id,
                    features.get('bpm', 0),
                    features.get('key', ''),
                    features.get('energy', 0),
                    features.get('danceability', 0),
                    features.get('valence', 0),
                    features.get('acousticness', 0),
                    features.get('instrumentalness', 0),
                    features.get('liveness', 0),
                    features.get('speechiness', 0),
                    features.get('loudness', 0),
                    features.get('bpm_confidence', 0),
                    features.get('key_confidence', 0)
                ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            logger.error(f"Error guardando en BD: {e}")
            return False

def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Hybrid analyzer: MixedInKey + Essentia')
    parser.add_argument('path', help='File or directory to process')
    parser.add_argument('--save-db', action='store_true', help='Save to database')
    parser.add_argument('--prefer-essentia', action='store_true', help='Prefer Essentia over MIK')
    parser.add_argument('--limit', type=int, help='Limit number of files')
    
    args = parser.parse_args()
    
    # Crear analizador
    analyzer = EssentiaHybrid(prefer_mik=not args.prefer_essentia)
    
    # Obtener archivos a procesar
    path = Path(args.path)
    files_to_process = []
    
    if path.is_file():
        files_to_process = [path]
    elif path.is_dir():
        audio_exts = ('.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aiff', '.aif')
        files_to_process = [p for p in path.rglob('*') if p.suffix.lower() in audio_exts]
        if args.limit:
            files_to_process = files_to_process[:args.limit]
    
    print(f"🎵 Processing {len(files_to_process)} files...")
    print(f"   Mode: {'Prefer MixedInKey' if analyzer.prefer_mik else 'Prefer Essentia'}")
    print("=" * 60)
    
    saved_count = 0
    for i, file_path in enumerate(files_to_process, 1):
        print(f"[{i}/{len(files_to_process)}] {file_path.name}")
        
        result = analyzer.process_file(str(file_path))
        
        if args.save_db and result.get('status') == 'success':
            if analyzer.save_to_db(result):
                saved_count += 1
    
    # Estadísticas finales
    print("\n" + "=" * 60)
    print("📊 ESTADÍSTICAS FINALES:")
    print(f"  • Total procesados: {analyzer.stats['total']}")
    print(f"  • Desde MixedInKey: {analyzer.stats['from_mik']} ({analyzer.stats['from_mik']*100//max(analyzer.stats['total'],1)}%)")
    print(f"  • Desde Essentia: {analyzer.stats['from_essentia']}")
    print(f"  • Combinados: {analyzer.stats['from_both']}")
    print(f"  • Errores: {analyzer.stats['errors']}")
    
    if args.save_db:
        print(f"  • Guardados en BD: {saved_count}")

if __name__ == '__main__':
    main()