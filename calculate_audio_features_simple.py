#!/usr/bin/env python3
"""
CALCULATE AUDIO FEATURES WITH ESSENTIA (Simplified)
Version simplificada que funciona correctamente
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
                spectral_energy REAL,
                zero_crossing_rate REAL,
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
        """Analyze audio file with Essentia (simplified)"""
        try:
            # Load audio
            loader = es.MonoLoader(filename=str(file_path), sampleRate=44100)
            audio = loader()
            
            # Sample rate
            sr = 44100.0
            
            # 1. LOUDNESS - Replay Gain (simpler than EBU R128)
            replay_gain = es.ReplayGain(sampleRate=sr)(audio)
            
            # 2. DYNAMIC COMPLEXITY
            dynamic_complexity, loudness_dyn = es.DynamicComplexity(sampleRate=sr)(audio)
            
            # 3. RHYTHM - Use existing BPM or extract
            if existing_bpm and existing_bpm > 0:
                bpm = float(existing_bpm)
            else:
                # Simple BPM extraction
                rhythm = es.RhythmExtractor2013()(audio)
                bpm = rhythm[0]  # First element is BPM
                
            # 4. KEY - Use existing or extract
            decoded_key = self.decode_key(existing_key) if existing_key else None
            if not decoded_key or decoded_key == '1A':
                key_extractor = es.KeyExtractor()
                key, scale, strength = key_extractor(audio)
                # Convert to Camelot notation
                key_camelot = self.to_camelot(key, scale)
            else:
                key_camelot = decoded_key
                
            # Determine if major or minor from Camelot
            is_major = key_camelot.endswith('B')
            
            # 5. SPECTRAL FEATURES (simplified)
            # Calculate spectral centroid for entire audio
            spectral_centroids = []
            spectral_energies = []
            frame_size = 2048
            hop_size = 1024
            
            for frame_start in range(0, len(audio) - frame_size, hop_size):
                frame = audio[frame_start:frame_start+frame_size]
                windowed = es.Windowing(type='hann')(frame)
                spectrum = es.Spectrum()(windowed)
                
                if len(spectrum) > 0 and np.sum(spectrum) > 0:
                    centroid = es.Centroid()(spectrum)
                    energy = es.Energy()(spectrum)
                    spectral_centroids.append(centroid)
                    spectral_energies.append(energy)
                    
            spectral_centroid = np.mean(spectral_centroids) if spectral_centroids else 1000.0
            spectral_energy = np.mean(spectral_energies) if spectral_energies else 0.5
            
            # 6. ZERO CROSSING RATE
            zcr = es.ZeroCrossingRate()(audio)
            
            # 7. Calculate derived features based on context
            energy_norm = (energy_level / 10.0) if energy_level else 0.5
            
            # DANCEABILITY - Based on BPM and energy
            if bpm >= 118 and bpm <= 132:
                danceability = 0.75 + (energy_norm * 0.15)
            elif bpm >= 100 and bpm <= 140:
                danceability = 0.6 + (energy_norm * 0.2)
            elif bpm >= 90 and bpm <= 150:
                danceability = 0.4 + (energy_norm * 0.15)
            else:
                danceability = 0.25 + (energy_norm * 0.1)
            danceability = min(1.0, max(0.0, danceability))
            
            # ACOUSTICNESS - Based on spectral features and energy
            acousticness = max(0.0, min(1.0,
                (1.0 - energy_norm) * 0.4 +
                (1.0 - min(1.0, spectral_centroid / 5000.0)) * 0.6
            ))
            
            # INSTRUMENTALNESS - High for electronic music
            instrumentalness = 0.7 + (1.0 - zcr) * 0.1 + energy_norm * 0.1
            instrumentalness = min(1.0, max(0.0, instrumentalness))
            
            # LIVENESS - Low for studio recordings
            liveness = 0.1 + (dynamic_complexity / 20.0) * 0.2
            liveness = min(0.3, max(0.0, liveness))
            
            # SPEECHINESS - Low for music
            speechiness = zcr * 0.2
            speechiness = min(0.2, max(0.0, speechiness))
            
            # VALENCE - Mood based on key and energy
            valence = 0.6 if is_major else 0.4
            valence += energy_norm * 0.2
            valence += danceability * 0.1
            valence = min(1.0, max(0.0, valence))
            
            # Convert loudness to LUFS approximation
            loudness_lufs = -23.0 + (replay_gain * 10.0)  # Rough approximation
            
            return {
                'loudness': replay_gain,
                'loudness_ebu128': loudness_lufs,
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
                'spectral_energy': spectral_energy,
                'zero_crossing_rate': zcr
            }
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)[:100]}")
            return None
            
    def to_camelot(self, key, scale):
        """Convert key and scale to Camelot notation"""
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
                    spectral_centroid = ?, spectral_energy = ?, zero_crossing_rate = ?,
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
                    spectral_centroid, spectral_energy, zero_crossing_rate,
                    analysis_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
            print(f"   ⚠️ File not found")
            self.stats['skipped'] += 1
            return False
            
        # Analyze
        features = self.analyze_file(file_path, existing_bpm, existing_key, energy_level)
        
        if features:
            self.save_features(file_id, features)
            print(f"   ✅ LUFS: {features['loudness_ebu128']:.1f} | Dance: {features['danceability']:.2f} | Valence: {features['valence']:.2f}")
            self.stats['success'] += 1
            return True
        else:
            self.stats['errors'] += 1
            return False
            
    def run(self, batch_size=100):
        """Main processing loop"""
        print("""
🎵 ESSENTIA AUDIO FEATURE CALCULATOR (Python - Simplified)
============================================================
Calculating audio features using Essentia
Using existing BPM, Key, and Energy from MixedInKey
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
            
        # Process files in batches
        for i in range(0, len(files), batch_size):
            batch = files[i:i+batch_size]
            print(f"\n📦 Processing batch {i+1}-{min(i+batch_size, len(files))} of {len(files)}")
            print("-" * 60)
            
            for file_data in batch:
                self.stats['processed'] += 1
                
                # Show concise progress
                file_name = file_data['file_name'][:50]
                print(f"[{self.stats['processed']}/{self.stats['total']}] {file_name}", end=" ")
                
                # Show metadata info
                if file_data['existing_bmp']:
                    print(f"BPM:{file_data['existing_bmp']}", end=" ")
                if file_data['existing_key']:
                    print("Key:✓", end=" ")
                if file_data['energy_level']:
                    print(f"E:{file_data['energy_level']}", end=" ")
                print()
                
                self.process_file(file_data)
                
            # Progress summary
            print(f"\nBatch complete: ✅ {self.stats['success']} | ⏭️ {self.stats['skipped']} | ❌ {self.stats['errors']}")
                      
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
        
        if stats['analyzed_files'] and stats['analyzed_files'] > 0:
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
        else:
            print(f"""
📊 DATABASE STATISTICS:
   Total files: {stats['total_files']}
   Analyzed: 0
   Coverage: 0%
""")
        
        print(f"""
📊 SESSION STATISTICS:
   Processed: {self.stats['processed']}
   Successful: {self.stats['success']}
   Skipped: {self.stats['skipped']}
   Errors: {self.stats['errors']}
""")
        
        self.conn.close()


if __name__ == "__main__":
    analyzer = EssentiaAudioAnalyzer()
    # Process in batches of 100 files
    analyzer.run(batch_size=100)