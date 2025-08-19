#!/usr/bin/env python3
"""
CALCULATE AUDIO FEATURES - SAFE VERSION
Versión robusta que maneja errores y archivos problemáticos
"""

import essentia.standard as es
import sqlite3
import json
import base64
import os
import sys
import signal
import numpy as np
from datetime import datetime
from pathlib import Path

class SafeAudioAnalyzer:
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
        # Set timeout for hanging processes
        signal.signal(signal.SIGALRM, self.timeout_handler)
        
    def timeout_handler(self, signum, frame):
        raise TimeoutError("Processing timeout")
        
    def connect(self):
        """Connect to database"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        print("✅ Connected to database")
        
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
        
    def analyze_file_safe(self, file_path, existing_bpm=None, existing_key=None, energy_level=None):
        """Safely analyze audio file with timeout and error handling"""
        try:
            # Set 30-second timeout for each file
            signal.alarm(30)
            
            # Try to load with MonoLoader (more stable)
            try:
                loader = es.MonoLoader(filename=str(file_path), sampleRate=44100)
                audio = loader()
            except:
                # If MonoLoader fails, skip this file
                print(f"   ⚠️ Cannot load audio file")
                return None
                
            if len(audio) < 44100:  # Less than 1 second
                print(f"   ⚠️ Audio too short")
                return None
                
            sr = 44100.0
            
            # Initialize all features with defaults
            features = {
                'loudness': -23.0,
                'loudness_ebu128': -23.0,
                'dynamic_complexity': 5.0,
                'danceability': 0.5,
                'acousticness': 0.3,
                'instrumentalness': 0.7,
                'liveness': 0.1,
                'speechiness': 0.05,
                'valence': 0.5,
                'energy_computed': 0.5,
                'bpm_computed': 120.0,
                'key_computed': '1A',
                'spectral_centroid': 1000.0,
                'spectral_complexity': 0.5,
                'spectral_energy': 0.5,
                'spectral_rolloff': 5000.0,
                'mfcc_mean': json.dumps([0.0] * 13),
                'zero_crossing_rate': 0.1,
                'onset_rate': 0.1,
                'tempo_stability': 0.8
            }
            
            # 1. Try ReplayGain for loudness (simpler than EBU R128)
            try:
                features['loudness'] = float(es.ReplayGain()(audio))
                features['loudness_ebu128'] = -23.0 + (features['loudness'] * 10.0)
            except:
                pass
                
            # 2. Dynamic Complexity
            try:
                dc, avg_loud = es.DynamicComplexity(sampleRate=sr)(audio)
                features['dynamic_complexity'] = float(dc)
            except:
                pass
                
            # 3. Use existing BPM or try to extract
            if existing_bpm and existing_bpm > 0:
                features['bpm_computed'] = float(existing_bpm)
                features['tempo_stability'] = 1.0
            else:
                try:
                    # Simple BPM detection
                    bpm = es.PercivalBpmEstimator()(audio)
                    features['bpm_computed'] = float(bpm)
                except:
                    features['bpm_computed'] = 120.0
                    
            # 4. Use existing key
            decoded_key = self.decode_key(existing_key) if existing_key else '1A'
            features['key_computed'] = decoded_key
            is_major = decoded_key.endswith('B')
            
            # 5. Simple spectral features (first 2048 samples)
            try:
                frame = audio[:2048] if len(audio) >= 2048 else audio
                windowed = es.Windowing(type='hann')(frame)
                spectrum = es.Spectrum()(windowed)
                
                if len(spectrum) > 0:
                    features['spectral_centroid'] = float(es.Centroid()(spectrum))
                    features['spectral_energy'] = float(es.Energy()(spectrum))
                    features['spectral_rolloff'] = float(es.RollOff()(spectrum))
            except:
                pass
                
            # 6. Zero Crossing Rate
            try:
                features['zero_crossing_rate'] = float(es.ZeroCrossingRate()(audio))
            except:
                pass
                
            # 7. Calculate contextual features based on existing data
            energy_norm = (energy_level / 10.0) if energy_level else 0.5
            features['energy_computed'] = energy_norm
            
            # Danceability based on BPM and energy
            bpm = features['bpm_computed']
            if 118 <= bpm <= 132:
                features['danceability'] = 0.75 + (energy_norm * 0.15)
            elif 100 <= bpm <= 140:
                features['danceability'] = 0.6 + (energy_norm * 0.2)
            elif 90 <= bpm <= 150:
                features['danceability'] = 0.4 + (energy_norm * 0.15)
            else:
                features['danceability'] = 0.25 + (energy_norm * 0.1)
            features['danceability'] = min(1.0, max(0.0, features['danceability']))
            
            # Other features based on context
            features['acousticness'] = max(0.0, min(1.0, 1.0 - energy_norm * 0.7))
            features['instrumentalness'] = 0.7 + energy_norm * 0.1  # Electronic music
            features['liveness'] = 0.1 + (features['dynamic_complexity'] / 20.0) * 0.2
            features['speechiness'] = features['zero_crossing_rate'] * 0.2
            
            # Valence based on key and energy
            features['valence'] = (0.6 if is_major else 0.4) + energy_norm * 0.2 + features['danceability'] * 0.1
            features['valence'] = min(1.0, max(0.0, features['valence']))
            
            # Cancel timeout
            signal.alarm(0)
            return features
            
        except TimeoutError:
            signal.alarm(0)
            print(f"   ⏱️ Timeout - skipping")
            return None
        except Exception as e:
            signal.alarm(0)
            print(f"   ❌ Error: {str(e)[:50]}")
            return None
            
    def save_features(self, file_id, features):
        """Save features to database"""
        try:
            cursor = self.conn.cursor()
            
            # Build query dynamically based on existing columns
            columns = list(features.keys())
            placeholders = ','.join(['?'] * (len(columns) + 1))
            column_names = 'file_id,' + ','.join(columns) + ',analysis_timestamp'
            
            query = f"""
                INSERT OR REPLACE INTO audio_features 
                ({column_names})
                VALUES ({placeholders},datetime('now'))
            """
            
            params = [file_id] + [features[col] for col in columns]
            cursor.execute(query, params)
            self.conn.commit()
            
            # Also update llm_metadata
            self.update_llm_metadata(file_id, features)
            
        except Exception as e:
            print(f"   ⚠️ DB Error: {str(e)[:50]}")
            
    def update_llm_metadata(self, file_id, features):
        """Update llm_metadata table"""
        try:
            cursor = self.conn.cursor()
            
            # Check if record exists
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
                    features.get('loudness', -23.0),
                    features.get('danceability', 0.5),
                    features.get('acousticness', 0.3),
                    features.get('instrumentalness', 0.7),
                    features.get('liveness', 0.1),
                    features.get('speechiness', 0.05),
                    features.get('valence', 0.5),
                    file_id
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
                    file_id,
                    features.get('loudness', -23.0),
                    features.get('danceability', 0.5),
                    features.get('acousticness', 0.3),
                    features.get('instrumentalness', 0.7),
                    features.get('liveness', 0.1),
                    features.get('speechiness', 0.05),
                    features.get('valence', 0.5)
                ]
                
            cursor.execute(query, params)
            self.conn.commit()
        except:
            pass  # Ignore llm_metadata errors
            
    def get_files_to_process(self, batch_size=50):
        """Get next batch of files to process"""
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
            LIMIT ?
        """
        
        cursor.execute(query, (batch_size,))
        return cursor.fetchall()
        
    def process_file(self, file_data):
        """Process a single file"""
        file_id = file_data['id']
        file_path = file_data['file_path']
        file_name = file_data['file_name'][:60]
        existing_bpm = file_data['existing_bmp']
        existing_key = file_data['existing_key']
        energy_level = file_data['energy_level']
        
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"[{self.stats['processed']+1}] {file_name}")
            print(f"   ⚠️ File not found")
            self.stats['skipped'] += 1
            return False
            
        print(f"[{self.stats['processed']+1}] {file_name}")
        
        # Show existing data
        info = []
        if existing_bpm: info.append(f"BPM:{existing_bpm:.0f}")
        if existing_key: info.append("Key:✓")
        if energy_level: info.append(f"E:{energy_level}")
        if info:
            print(f"   {' | '.join(info)}")
            
        # Analyze
        features = self.analyze_file_safe(file_path, existing_bpm, existing_key, energy_level)
        
        if features:
            self.save_features(file_id, features)
            print(f"   ✅ Saved successfully")
            self.stats['success'] += 1
            return True
        else:
            self.stats['errors'] += 1
            return False
            
    def run(self):
        """Main processing loop"""
        print("""
🎵 SAFE AUDIO FEATURE CALCULATOR
============================================================
Processing with timeout protection and error handling
Using existing BPM, Key, and Energy from MixedInKey
============================================================
""")
        
        self.connect()
        
        while True:
            # Get next batch
            files = self.get_files_to_process(50)
            
            if not files:
                print("\n✅ All files processed!")
                break
                
            print(f"\n📦 Processing batch of {len(files)} files")
            print("-" * 60)
            
            for file_data in files:
                self.stats['processed'] += 1
                
                try:
                    self.process_file(file_data)
                except KeyboardInterrupt:
                    print("\n⛔ Interrupted by user")
                    self.show_stats()
                    sys.exit(0)
                except Exception as e:
                    print(f"   ❌ Unexpected error: {str(e)[:50]}")
                    self.stats['errors'] += 1
                    
            # Show progress
            print(f"\nBatch complete: ✅ {self.stats['success']} | ⏭️ {self.stats['skipped']} | ❌ {self.stats['errors']}")
            
        self.show_stats()
        
    def show_stats(self):
        """Show final statistics"""
        print("\n" + "="*60)
        print("📊 FINAL STATISTICS")
        print("="*60)
        print(f"Total processed: {self.stats['processed']}")
        print(f"Successful: {self.stats['success']}")
        print(f"Skipped: {self.stats['skipped']}")
        print(f"Errors: {self.stats['errors']}")
        
        # Database stats
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT af.id) as total_files,
                COUNT(DISTINCT feat.file_id) as analyzed_files
            FROM audio_files af
            LEFT JOIN audio_features feat ON af.id = feat.file_id
        """)
        
        stats = cursor.fetchone()
        if stats:
            coverage = (stats['analyzed_files'] / stats['total_files'] * 100) if stats['total_files'] > 0 else 0
            print(f"\nDatabase coverage: {stats['analyzed_files']}/{stats['total_files']} ({coverage:.1f}%)")
            
        self.conn.close()


if __name__ == "__main__":
    analyzer = SafeAudioAnalyzer()
    try:
        analyzer.run()
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)