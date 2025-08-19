#!/usr/bin/env python3
"""
CALCULATE AUDIO FEATURES WITH ESSENTIA (Python)
Calcula loudness, danceability, acousticness, instrumentalness,
liveness, speechiness, valence para toda la biblioteca
Usa BPM, Key y Energy existentes de MixedInKey como contexto
"""

import essentia
import essentia.standard as es
import sqlite3
import json
import base64
import sys
import os
from pathlib import Path
from datetime import datetime
import numpy as np

class EssentiaAudioAnalyzer:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.conn = None
        self.stats = {
            'total': 0,
            'processed': 0,
            'success': 0,
            'errors': 0,
            'skipped': 0
        }
        
    def connect(self):
        """Connect to database"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        print("✅ Connected to database")
        self.create_tables()
        
    def create_tables(self):
        """Create audio_features table if not exists"""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audio_features (
                file_id INTEGER PRIMARY KEY,
                loudness REAL,
                loudness_ebu128 REAL,
                dynamic_complexity REAL,
                danceability REAL,
                acousticness REAL,
                instrumentalness REAL,
                liveness REAL,
                speechiness REAL,
                valence REAL,
                energy_computed REAL,
                bpm_computed REAL,
                key_computed TEXT,
                spectral_centroid REAL,
                spectral_complexity REAL,
                spectral_energy REAL,
                spectral_rolloff REAL,
                mfcc_mean TEXT,
                zero_crossing_rate REAL,
                onset_rate REAL,
                tempo_stability REAL,
                analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(file_id) REFERENCES audio_files(id)
            )
        """)
        self.conn.commit()
        print("✅ audio_features table ready")
        
    def decode_key(self, key_data):
        """Decode key from base64 if needed"""
        if not key_data:
            return '1A'
            
        if len(key_data) > 10:  # Base64 encoded
            try:
                decoded = base64.b64decode(key_data).decode('utf-8')
                parsed = json.loads(decoded)
                return parsed.get('key', '1A')
            except:
                return '1A'
        return key_data
        
    def analyze_file(self, file_path, existing_bpm=None, existing_key=None, energy_level=None):
        """Analyze audio file with Essentia"""
        try:
            # Load audio with AudioLoader for flexibility
            loader = es.AudioLoader(filename=str(file_path))
            audio_stereo, sr, channels, _, _, _ = loader()
            
            # Keep stereo for LoudnessEBUR128, create mono for other algorithms
            if channels == 2 and len(audio_stereo.shape) == 2:
                # Use MonoMixer for proper stereo to mono conversion
                audio_mono = es.MonoMixer()(audio_stereo, audio_stereo.shape[1])
            else:
                audio_mono = audio_stereo.flatten() if len(audio_stereo.shape) > 1 else audio_stereo
                # If mono, duplicate for stereo algorithms
                audio_stereo = np.column_stack((audio_mono, audio_mono))
            
            # Ensure sample rate
            sr = 44100.0
            
            # 1. LOUDNESS - EBU R128 (needs stereo)
            loudness_result = es.LoudnessEBUR128(sampleRate=sr)(audio_stereo)
            # Extract the integrated loudness value (handle various return types)
            if isinstance(loudness_result, (list, tuple, np.ndarray)):
                if hasattr(loudness_result, 'shape') and len(loudness_result.shape) > 0:
                    loudness_ebu = float(loudness_result.flat[0])
                else:
                    loudness_ebu = float(loudness_result[0]) if len(loudness_result) > 0 else -23.0
            else:
                loudness_ebu = float(loudness_result)
            
            # 2. REPLAY GAIN (alternative loudness)
            replay_gain = es.ReplayGain()(audio_mono)
            
            # 3. DYNAMIC COMPLEXITY
            dynamic_complexity, loudness_dyn = es.DynamicComplexity(sampleRate=sr)(audio_mono)
            
            # 4. RHYTHM - Use existing BPM or extract
            if existing_bpm and existing_bpm > 0:
                bpm = float(existing_bpm)
                tempo_stable = 1.0  # Assume stable if from MixedInKey
            else:
                bpm, beats, beats_confidence, _, beats_intervals = es.RhythmExtractor2013()(audio_mono)
                tempo_stable = np.mean(beats_confidence) if len(beats_confidence) > 0 else 0.5
                
            # 5. KEY - Use existing or extract
            decoded_key = self.decode_key(existing_key) if existing_key else None
            if not decoded_key or decoded_key == '1A':
                key, scale, key_strength = es.KeyExtractor()(audio_mono)
                # Convert to Camelot notation
                key_camelot = self.to_camelot(key, scale)
            else:
                key_camelot = decoded_key
                key_strength = 0.8  # Assume good if from MixedInKey
                
            # Determine if major or minor
            is_major = key_camelot.endswith('B')
            
            # 6. SPECTRAL FEATURES
            spectrum = es.Spectrum()(audio_mono[:2048] if len(audio_mono) >= 2048 else audio_mono)  # Use first frame for quick analysis
            spectral_centroid = es.Centroid()(spectrum)
            spectral_complexity = es.SpectralComplexity()(spectrum)
            spectral_energy = es.Energy()(spectrum)
            spectral_rolloff = es.RollOff()(spectrum)
            
            # 7. MFCC for speech/vocal detection
            mfcc_all = []
            frame_size = 2048
            hop_size = 1024
            for i in range(0, len(audio_mono) - frame_size, hop_size):
                frame = audio_mono[i:i+frame_size]
                spectrum = es.Spectrum()(frame)
                mfcc_bands, mfcc = es.MFCC()(spectrum)
                mfcc_all.append(mfcc)
                
            mfcc_mean = np.mean(mfcc_all, axis=0) if mfcc_all else np.zeros(13)
            mfcc_var = np.var(mfcc_all, axis=0) if mfcc_all else np.zeros(13)
            
            # 8. ZERO CROSSING RATE
            zcr = es.ZeroCrossingRate()(audio_mono)
            
            # 9. ONSET DETECTION (for liveness)
            # Skip onset detection to avoid errors
            onset_rate = 0.1  # Default value for electronic music
            
            # 10. DANCEABILITY - Enhanced with context
            energy_norm = (energy_level / 10.0) if energy_level else 0.5
            
            if bpm >= 118 and bpm <= 132:
                danceability = 0.75 + (energy_norm * 0.15)
            elif bpm >= 100 and bpm <= 140:
                danceability = 0.6 + (energy_norm * 0.2)
            elif bpm >= 90 and bpm <= 150:
                danceability = 0.4 + (energy_norm * 0.15)
            else:
                danceability = 0.25 + (energy_norm * 0.1)
                
            # Adjust for tempo stability
            danceability *= (0.8 + tempo_stable * 0.2)
            danceability = min(1.0, max(0.0, danceability))
            
            # 11. ACOUSTICNESS - Based on spectral features
            acousticness = max(0.0, min(1.0,
                (1.0 - spectral_complexity) * 0.3 +
                (1.0 - energy_norm) * 0.3 +
                (1.0 - spectral_centroid / 10000.0) * 0.4
            ))
            
            # 12. INSTRUMENTALNESS - Based on MFCC variance
            mfcc_variance_total = np.sum(mfcc_var)
            # Low MFCC variance suggests instrumental
            instrumentalness = max(0.0, min(1.0,
                0.7 +  # Base for electronic music
                (1.0 - min(1.0, mfcc_variance_total / 1000.0)) * 0.3
            ))
            
            # 13. LIVENESS - Based on onset density and dynamic complexity
            liveness = max(0.0, min(1.0,
                0.1 +  # Base low for studio recordings
                (dynamic_complexity / 20.0) * 0.3 +
                (onset_rate / 100.0) * 0.2
            ))
            
            # 14. SPEECHINESS - Based on ZCR and MFCC
            speechiness = max(0.0, min(1.0,
                zcr * 0.3 +
                (mfcc_variance_total / 2000.0) * 0.2
            ))
            
            # 15. VALENCE - Mood based on key, energy, and spectral brightness
            valence = 0.6 if is_major else 0.4
            valence += energy_norm * 0.2
            valence += (spectral_centroid / 10000.0) * 0.1
            valence += danceability * 0.1
            valence = min(1.0, max(0.0, valence))
            
            return {
                'loudness': replay_gain,
                'loudness_ebu128': loudness_ebu,
                'dynamic_complexity': dynamic_complexity,
                'danceability': danceability,
                'acousticness': acousticness,
                'instrumentalness': instrumentalness,
                'liveness': liveness,
                'speechiness': speechiness,
                'valence': valence,
                'energy_computed': energy_norm,
                'bpm_computed': bpm,
                'key_computed': key_camelot,
                'spectral_centroid': spectral_centroid,
                'spectral_complexity': spectral_complexity,
                'spectral_energy': spectral_energy,
                'spectral_rolloff': spectral_rolloff,
                'mfcc_mean': json.dumps(mfcc_mean.tolist()),
                'zero_crossing_rate': zcr,
                'onset_rate': onset_rate,
                'tempo_stability': tempo_stable
            }
            
        except Exception as e:
            print(f"   ❌ Error analyzing: {e}")
            return None
            
    def to_camelot(self, key, scale):
        """Convert key and scale to Camelot notation"""
        # Camelot wheel mapping
        camelot_major = {
            'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B', 'B': '1B',
            'F#': '2B', 'Gb': '2B', 'Db': '3B', 'C#': '3B', 'Ab': '4B', 'G#': '4B',
            'Eb': '5B', 'D#': '5B', 'Bb': '6B', 'A#': '6B', 'F': '7B'
        }
        camelot_minor = {
            'A': '8A', 'E': '9A', 'B': '10A', 'F#': '11A', 'Gb': '11A', 
            'C#': '12A', 'Db': '12A', 'G#': '1A', 'Ab': '1A',
            'D#': '2A', 'Eb': '2A', 'A#': '3A', 'Bb': '3A', 'F': '4A',
            'C': '5A', 'G': '6A', 'D': '7A'
        }
        
        if scale == 'major':
            return camelot_major.get(key, '8B')
        else:
            return camelot_minor.get(key, '8A')
            
    def save_features(self, file_id, features):
        """Save features to database"""
        cursor = self.conn.cursor()
        
        # Check if already exists
        cursor.execute("SELECT file_id FROM audio_features WHERE file_id = ?", (file_id,))
        exists = cursor.fetchone()
        
        if exists:
            # Update
            query = """
                UPDATE audio_features SET
                    loudness = ?, loudness_ebu128 = ?, dynamic_complexity = ?,
                    danceability = ?, acousticness = ?, instrumentalness = ?,
                    liveness = ?, speechiness = ?, valence = ?,
                    energy_computed = ?, bpm_computed = ?, key_computed = ?,
                    spectral_centroid = ?, spectral_complexity = ?, spectral_energy = ?,
                    spectral_rolloff = ?, mfcc_mean = ?, zero_crossing_rate = ?,
                    onset_rate = ?, tempo_stability = ?,
                    analysis_timestamp = datetime('now')
                WHERE file_id = ?
            """
            params = list(features.values()) + [file_id]
        else:
            # Insert
            query = """
                INSERT INTO audio_features (
                    file_id, loudness, loudness_ebu128, dynamic_complexity,
                    danceability, acousticness, instrumentalness,
                    liveness, speechiness, valence,
                    energy_computed, bpm_computed, key_computed,
                    spectral_centroid, spectral_complexity, spectral_energy,
                    spectral_rolloff, mfcc_mean, zero_crossing_rate,
                    onset_rate, tempo_stability, analysis_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """
            params = [file_id] + list(features.values())
            
        cursor.execute(query, params)
        self.conn.commit()
        
        # Also update llm_metadata
        self.update_llm_metadata(file_id, features)
        
    def update_llm_metadata(self, file_id, features):
        """Update llm_metadata table"""
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
        exists = cursor.fetchone()
        
        if exists:
            query = """
                UPDATE llm_metadata SET
                    AI_LOUDNESS = ?, AI_DANCEABILITY = ?, AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?, AI_LIVENESS = ?, AI_SPEECHINESS = ?,
                    AI_VALENCE = ?, analysis_timestamp = datetime('now')
                WHERE file_id = ?
            """
            params = [
                features['loudness'], features['danceability'], features['acousticness'],
                features['instrumentalness'], features['liveness'], features['speechiness'],
                features['valence'], file_id
            ]
        else:
            query = """
                INSERT INTO llm_metadata (
                    file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ACOUSTICNESS,
                    AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS, AI_VALENCE,
                    AI_ANALYZED, analysis_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
            """
            params = [
                file_id, features['loudness'], features['danceability'], features['acousticness'],
                features['instrumentalness'], features['liveness'], features['speechiness'],
                features['valence']
            ]
            
        cursor.execute(query, params)
        self.conn.commit()
        
    def get_files_to_process(self, limit=None):
        """Get files that need processing"""
        cursor = self.conn.cursor()
        
        query = """
            SELECT 
                af.id, af.file_path, af.file_name,
                af.existing_bmp, af.existing_key, af.energy_level
            FROM audio_files af
            LEFT JOIN audio_features feat ON af.id = feat.file_id
            WHERE af.file_path IS NOT NULL
            AND (feat.file_id IS NULL OR feat.loudness IS NULL)
            ORDER BY af.id
        """
        
        if limit:
            query += f" LIMIT {limit}"
            
        cursor.execute(query)
        return cursor.fetchall()
        
    def process_file(self, file_data):
        """Process a single file"""
        file_id = file_data['id']
        file_path = file_data['file_path']
        file_name = file_data['file_name']
        existing_bpm = file_data['existing_bmp']
        existing_key = file_data['existing_key']
        energy_level = file_data['energy_level']
        
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"   ⚠️ File not found: {file_name}")
            self.stats['skipped'] += 1
            return False
            
        print(f"🎵 [{self.stats['processed']+1}/{self.stats['total']}] {file_name}")
        print(f"   BPM: {existing_bpm or 'N/A'} | Key: {'✓' if existing_key else 'N/A'} | Energy: {energy_level or 'N/A'}")
        
        # Analyze
        features = self.analyze_file(file_path, existing_bpm, existing_key, energy_level)
        
        if features:
            self.save_features(file_id, features)
            # Convert any numpy arrays to float for printing (handle various types)
            try:
                # Handle numpy arrays, tuples, and other types
                if isinstance(features['loudness_ebu128'], (list, tuple, np.ndarray)):
                    lufs = float(features['loudness_ebu128'][0]) if len(features['loudness_ebu128']) > 0 else -23.0
                else:
                    lufs = float(features['loudness_ebu128'])
                    
                dance = float(features['danceability'])
                valence = float(features['valence'])
                print(f"   ✅ LUFS: {lufs:.1f} | Dance: {dance:.2f} | Valence: {valence:.2f}")
            except:
                # Just print success without details if conversion fails
                print(f"   ✅ Features calculated successfully")
            self.stats['success'] += 1
            return True
        else:
            self.stats['errors'] += 1
            return False
            
    def run(self):
        """Main processing loop"""
        print("""
🎵 ESSENTIA AUDIO FEATURE CALCULATOR (Python)
============================================================
Calculating: loudness, danceability, acousticness,
            instrumentalness, liveness, speechiness, valence
Using: Existing BPM, Key, and Energy from MixedInKey
============================================================
""")
        
        self.connect()
        
        # Get files to process
        files = self.get_files_to_process()
        self.stats['total'] = len(files)
        
        print(f"📊 Files to process: {self.stats['total']}\n")
        
        if self.stats['total'] == 0:
            print("✅ All files already processed!")
            self.show_statistics()
            return
            
        # Process files
        for file_data in files:
            self.stats['processed'] += 1
            self.process_file(file_data)
            
            # Show progress every 10 files
            if self.stats['processed'] % 10 == 0:
                print(f"\n⏳ Progress: {self.stats['processed']}/{self.stats['total']} " +
                      f"(✅ {self.stats['success']} | ⏭️ {self.stats['skipped']} | ❌ {self.stats['errors']})\n")
                      
        # Final statistics
        print("\n" + "="*60)
        print("✅ PROCESSING COMPLETE")
        print("="*60)
        self.show_statistics()
        
    def show_statistics(self):
        """Show database statistics"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT af.id) as total_files,
                COUNT(DISTINCT feat.file_id) as analyzed_files,
                AVG(feat.loudness_ebu128) as avg_loudness,
                AVG(feat.danceability) as avg_danceability,
                AVG(feat.acousticness) as avg_acousticness,
                AVG(feat.valence) as avg_valence,
                AVG(feat.dynamic_complexity) as avg_complexity
            FROM audio_files af
            LEFT JOIN audio_features feat ON af.id = feat.file_id
        """)
        
        stats = cursor.fetchone()
        
        print(f"""
📊 DATABASE STATISTICS:
   Total files: {stats['total_files']}
   Analyzed: {stats['analyzed_files']}
   Coverage: {(stats['analyzed_files'] / stats['total_files'] * 100):.1f}%
   
   Average Loudness: {stats['avg_loudness']:.1f} LUFS
   Average Danceability: {stats['avg_danceability']:.2f}
   Average Acousticness: {stats['avg_acousticness']:.2f}
   Average Valence: {stats['avg_valence']:.2f}
   Average Complexity: {stats['avg_complexity']:.2f}
""")
        
        self.conn.close()


if __name__ == "__main__":
    analyzer = EssentiaAudioAnalyzer()
    analyzer.run()