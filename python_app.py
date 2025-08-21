#!/usr/bin/env python3
"""
Music Analyzer Pro - Python Version
Simple, funcional, sin complicaciones
"""

import sqlite3
import tkinter as tk
from tkinter import ttk
import json

class MusicAnalyzerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🎵 MAP - Music Analyzer (Python)")
        self.root.geometry("900x600")
        self.root.configure(bg='#111111')
        
        # Connect to database
        self.conn = sqlite3.connect('music_analyzer.db')
        self.cursor = self.conn.cursor()
        
        # Style
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('Title.TLabel', background='#111111', foreground='#00ff88', font=('Arial', 24, 'bold'))
        style.configure('Track.TFrame', background='#222222')
        style.configure('Metadata.TLabel', background='#222222', foreground='#00ff88', font=('Arial', 14, 'bold'))
        style.configure('TrackName.TLabel', background='#222222', foreground='white', font=('Arial', 12))
        
        # Title
        title = ttk.Label(root, text="🎵 Music Metadata Display", style='Title.TLabel')
        title.pack(pady=20)
        
        # Tracks frame
        self.tracks_frame = tk.Frame(root, bg='#111111')
        self.tracks_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # Load and display tracks
        self.load_tracks()
        
    def load_tracks(self):
        # Query database for tracks with metadata
        query = """
        SELECT id, title, artist, AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD 
        FROM audio_files 
        WHERE AI_BPM IS NOT NULL 
        LIMIT 10
        """
        
        self.cursor.execute(query)
        tracks = self.cursor.fetchall()
        
        print(f"✅ Loaded {len(tracks)} tracks from database")
        
        # Display each track
        for track in tracks:
            self.display_track(track)
            
    def display_track(self, track):
        # Unpack track data
        track_id, title, artist, bpm, key, energy, mood = track
        
        # Create track frame
        track_frame = tk.Frame(self.tracks_frame, bg='#222222', highlightbackground='#00ff88', highlightthickness=2)
        track_frame.pack(fill=tk.X, pady=5, padx=5)
        
        # Track info
        info_text = f"{title or 'Unknown'} - {artist or 'Unknown Artist'}"
        track_label = tk.Label(track_frame, text=info_text, bg='#222222', fg='white', font=('Arial', 12))
        track_label.pack(anchor='w', padx=10, pady=(10, 5))
        
        # Metadata
        energy_percent = round(energy * 100) if energy else 0
        metadata_text = f"BPM: {bpm or '--'}  |  KEY: {key or '--'}  |  ENERGY: {energy_percent}%  |  MOOD: {mood or '--'}"
        metadata_label = tk.Label(track_frame, text=metadata_text, bg='#222222', fg='#00ff88', font=('Arial', 14, 'bold'))
        metadata_label.pack(anchor='w', padx=10, pady=(0, 10))
        
        # Print to console for verification
        print(f"📊 Track {track_id}: BPM={bpm}, KEY={key}, ENERGY={energy_percent}%, MOOD={mood}")
        
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()

def main():
    # First, let's verify the database has data
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # Check if we have tracks with metadata
    cursor.execute("SELECT COUNT(*) FROM audio_files WHERE AI_BPM IS NOT NULL")
    count = cursor.fetchone()[0]
    print(f"\n📊 Database check: {count} tracks with metadata")
    
    # Show sample data
    cursor.execute("SELECT id, title, AI_BPM, AI_KEY, AI_ENERGY FROM audio_files WHERE AI_BPM IS NOT NULL LIMIT 3")
    samples = cursor.fetchall()
    print("\n🎵 Sample tracks:")
    for sample in samples:
        print(f"  ID {sample[0]}: {sample[1]}")
        print(f"    BPM: {sample[2]}, KEY: {sample[3]}, ENERGY: {sample[4]}")
    
    conn.close()
    
    # Create GUI
    root = tk.Tk()
    app = MusicAnalyzerApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()