#!/usr/bin/env python3
"""
Music Analyzer Pro - Flask Web Version
Simple, directo, funcional
"""

from flask import Flask, render_template_string
import sqlite3
import json

app = Flask(__name__)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>MAP - Python Version</title>
    <style>
        body {
            background: #111;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
        }
        h1 {
            color: #00ff88;
            font-size: 48px;
            text-align: center;
            margin-bottom: 40px;
        }
        .stats {
            background: #1a1a1a;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
            font-size: 20px;
            color: #00ff88;
        }
        .track {
            background: #222;
            padding: 20px;
            margin: 15px 0;
            border-radius: 10px;
            border: 2px solid #333;
            transition: all 0.3s;
        }
        .track:hover {
            border-color: #00ff88;
            transform: translateX(10px);
        }
        .track-title {
            font-size: 20px;
            margin-bottom: 10px;
            color: white;
        }
        .track-artist {
            color: #888;
            margin-bottom: 15px;
        }
        .metadata {
            display: flex;
            gap: 30px;
            font-size: 18px;
            font-weight: bold;
        }
        .metadata-item {
            color: #00ff88;
        }
        .metadata-label {
            color: #666;
            font-weight: normal;
        }
        .energy-bar {
            width: 100px;
            height: 20px;
            background: #333;
            border-radius: 10px;
            overflow: hidden;
            display: inline-block;
            vertical-align: middle;
        }
        .energy-fill {
            height: 100%;
            background: linear-gradient(90deg, #00ff88, #00cc66);
            transition: width 0.3s;
        }
    </style>
</head>
<body>
    <h1>🎵 Music Analyzer Pro - Python Edition</h1>
    
    <div class="stats">
        ✅ {{ total_tracks }} tracks with metadata | 
        📊 Database: music_analyzer.db | 
        🐍 Python + Flask + SQLite
    </div>
    
    <div id="tracks">
        {% for track in tracks %}
        <div class="track">
            <div class="track-title">{{ track.title or 'Unknown Track' }}</div>
            <div class="track-artist">{{ track.artist or 'Unknown Artist' }}</div>
            <div class="metadata">
                <div class="metadata-item">
                    <span class="metadata-label">BPM:</span> {{ track.bpm or '--' }}
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">KEY:</span> {{ track.key or '--' }}
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">ENERGY:</span> 
                    {{ track.energy_percent }}%
                    <div class="energy-bar">
                        <div class="energy-fill" style="width: {{ track.energy_percent }}%"></div>
                    </div>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">MOOD:</span> {{ track.mood or '--' }}
                </div>
            </div>
        </div>
        {% endfor %}
    </div>
    
    <script>
        console.log('✅ Python Flask app loaded successfully');
        console.log('📊 Displaying {{ total_tracks }} tracks with metadata');
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    conn = sqlite3.connect('music_analyzer.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get tracks with metadata
    cursor.execute("""
        SELECT id, title, artist, AI_BPM as bpm, AI_KEY as key, 
               AI_ENERGY as energy, AI_MOOD as mood
        FROM audio_files 
        WHERE AI_BPM IS NOT NULL
        ORDER BY id
        LIMIT 20
    """)
    
    tracks = []
    for row in cursor.fetchall():
        track = dict(row)
        # Calculate energy percentage
        energy = track.get('energy', 0)
        track['energy_percent'] = round(energy * 100) if energy else 0
        tracks.append(track)
    
    # Get total count
    cursor.execute("SELECT COUNT(*) FROM audio_files WHERE AI_BPM IS NOT NULL")
    total = cursor.fetchone()[0]
    
    conn.close()
    
    return render_template_string(HTML_TEMPLATE, tracks=tracks, total_tracks=total)

@app.route('/api/tracks')
def api_tracks():
    """API endpoint that returns JSON data"""
    conn = sqlite3.connect('music_analyzer.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, title, artist, AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD
        FROM audio_files 
        WHERE AI_BPM IS NOT NULL
        LIMIT 100
    """)
    
    tracks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return json.dumps(tracks, indent=2)

if __name__ == '__main__':
    # Verify database first
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM audio_files WHERE AI_BPM IS NOT NULL")
    count = cursor.fetchone()[0]
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"🎵 MUSIC ANALYZER PRO - PYTHON VERSION")
    print(f"{'='*60}")
    print(f"✅ Database connected: music_analyzer.db")
    print(f"📊 Tracks with metadata: {count}")
    print(f"🐍 Technology: Python + Flask + SQLite")
    print(f"🚀 Starting server...")
    print(f"{'='*60}\n")
    
    app.run(debug=True, port=5000)