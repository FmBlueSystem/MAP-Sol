#!/usr/bin/env python3
"""
Music Analyzer Pro - Desktop Application
Con reproductor de audio real y acceso a archivos locales
"""

import sqlite3
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import pygame
from pathlib import Path

class MusicPlayer:
    def __init__(self):
        pygame.mixer.init()
        self.current_file = None
        self.is_playing = False
        
    def load(self, file_path):
        """Load audio file"""
        try:
            if os.path.exists(file_path):
                pygame.mixer.music.load(file_path)
                self.current_file = file_path
                return True
            return False
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
            return False
    
    def play(self):
        pygame.mixer.music.play()
        self.is_playing = True
    
    def pause(self):
        pygame.mixer.music.pause()
        self.is_playing = False
    
    def resume(self):
        pygame.mixer.music.unpause()
        self.is_playing = True
    
    def stop(self):
        pygame.mixer.music.stop()
        self.is_playing = False

class MusicAnalyzerDesktop:
    def __init__(self, root):
        self.root = root
        self.root.title("🎵 MAP - Music Analyzer Desktop")
        self.root.geometry("1200x700")
        self.root.configure(bg='#0a0a0a')
        
        # Database connection
        self.conn = sqlite3.connect('music_analyzer.db')
        self.cursor = self.conn.cursor()
        
        # Music player
        self.player = MusicPlayer()
        self.current_track = None
        
        # Setup UI
        self.setup_ui()
        
        # Load tracks
        self.load_tracks()
        
    def setup_ui(self):
        # Main container
        main_frame = tk.Frame(self.root, bg='#0a0a0a')
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Title
        title_label = tk.Label(main_frame, text="🎵 Music Analyzer Pro - Desktop", 
                              font=('Arial', 28, 'bold'), bg='#0a0a0a', fg='#00ff88')
        title_label.pack(pady=(0, 20))
        
        # Player Panel
        self.setup_player_panel(main_frame)
        
        # Tracks List
        self.setup_tracks_list(main_frame)
        
    def setup_player_panel(self, parent):
        # Player frame
        player_frame = tk.Frame(parent, bg='#1a1a1a', highlightbackground='#00ff88', 
                                highlightthickness=2)
        player_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Current track info
        self.current_track_label = tk.Label(player_frame, text="No track selected", 
                                           font=('Arial', 16, 'bold'), 
                                           bg='#1a1a1a', fg='white')
        self.current_track_label.pack(pady=10)
        
        # Metadata display
        self.metadata_frame = tk.Frame(player_frame, bg='#1a1a1a')
        self.metadata_frame.pack(pady=10)
        
        # Control buttons
        controls_frame = tk.Frame(player_frame, bg='#1a1a1a')
        controls_frame.pack(pady=10)
        
        self.play_btn = tk.Button(controls_frame, text="▶ PLAY", command=self.play_track,
                                  bg='#00ff88', fg='black', font=('Arial', 12, 'bold'),
                                  padx=20, pady=5)
        self.play_btn.pack(side=tk.LEFT, padx=5)
        
        self.pause_btn = tk.Button(controls_frame, text="⏸ PAUSE", command=self.pause_track,
                                   bg='#ffaa00', fg='black', font=('Arial', 12, 'bold'),
                                   padx=20, pady=5)
        self.pause_btn.pack(side=tk.LEFT, padx=5)
        
        self.stop_btn = tk.Button(controls_frame, text="⏹ STOP", command=self.stop_track,
                                  bg='#ff4444', fg='white', font=('Arial', 12, 'bold'),
                                  padx=20, pady=5)
        self.stop_btn.pack(side=tk.LEFT, padx=5)
        
        # File browser button
        browse_btn = tk.Button(controls_frame, text="📁 Browse Files", 
                              command=self.browse_files,
                              bg='#4444ff', fg='white', font=('Arial', 12, 'bold'),
                              padx=20, pady=5)
        browse_btn.pack(side=tk.LEFT, padx=20)
        
    def setup_tracks_list(self, parent):
        # Tracks frame with scrollbar
        list_frame = tk.Frame(parent, bg='#0a0a0a')
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        # Scrollbar
        scrollbar = tk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Listbox with tracks
        self.tracks_listbox = tk.Listbox(list_frame, bg='#1a1a1a', fg='white',
                                         font=('Arial', 11), selectmode=tk.SINGLE,
                                         yscrollcommand=scrollbar.set,
                                         selectbackground='#00ff88',
                                         selectforeground='black')
        self.tracks_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.tracks_listbox.bind('<<ListboxSelect>>', self.on_track_select)
        
        scrollbar.config(command=self.tracks_listbox.yview)
        
    def load_tracks(self):
        """Load tracks from database"""
        self.cursor.execute("""
            SELECT id, file_path, title, artist, AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD
            FROM audio_files 
            WHERE AI_BPM IS NOT NULL
            ORDER BY artist, title
        """)
        
        self.tracks = self.cursor.fetchall()
        
        # Populate listbox
        for track in self.tracks:
            track_id, file_path, title, artist, bpm, key, energy, mood = track
            display_text = f"{title or 'Unknown'} - {artist or 'Unknown'} | BPM: {bpm} | KEY: {key}"
            self.tracks_listbox.insert(tk.END, display_text)
            
        print(f"✅ Loaded {len(self.tracks)} tracks with metadata")
        
    def on_track_select(self, event):
        """Handle track selection"""
        selection = self.tracks_listbox.curselection()
        if selection:
            index = selection[0]
            self.current_track = self.tracks[index]
            self.display_track_info()
            
    def display_track_info(self):
        """Display current track metadata"""
        if not self.current_track:
            return
            
        track_id, file_path, title, artist, bpm, key, energy, mood = self.current_track
        
        # Update current track label
        self.current_track_label.config(text=f"{title or 'Unknown'} - {artist or 'Unknown'}")
        
        # Clear metadata frame
        for widget in self.metadata_frame.winfo_children():
            widget.destroy()
            
        # Display metadata
        energy_percent = round(energy * 100) if energy else 0
        
        metadata_text = f"BPM: {bpm or '--'}  |  KEY: {key or '--'}  |  ENERGY: {energy_percent}%  |  MOOD: {mood or '--'}"
        metadata_label = tk.Label(self.metadata_frame, text=metadata_text,
                                 font=('Arial', 18, 'bold'), bg='#1a1a1a', fg='#00ff88')
        metadata_label.pack()
        
        # File path
        path_label = tk.Label(self.metadata_frame, text=f"File: {file_path}",
                             font=('Arial', 10), bg='#1a1a1a', fg='#666666')
        path_label.pack(pady=(5, 0))
        
    def play_track(self):
        """Play selected track"""
        if not self.current_track:
            messagebox.showwarning("No Track", "Please select a track first")
            return
            
        file_path = self.current_track[1]
        
        if not os.path.exists(file_path):
            messagebox.showerror("File Not Found", f"Audio file not found:\n{file_path}")
            return
            
        if self.player.load(file_path):
            self.player.play()
            self.play_btn.config(text="▶ PLAYING", bg='#00ff44')
            print(f"🎵 Playing: {self.current_track[2]}")
        else:
            messagebox.showerror("Playback Error", "Could not play this file")
            
    def pause_track(self):
        """Pause playback"""
        if self.player.is_playing:
            self.player.pause()
            self.play_btn.config(text="▶ RESUME", bg='#00ff88')
        else:
            self.player.resume()
            self.play_btn.config(text="▶ PLAYING", bg='#00ff44')
            
    def stop_track(self):
        """Stop playback"""
        self.player.stop()
        self.play_btn.config(text="▶ PLAY", bg='#00ff88')
        
    def browse_files(self):
        """Open file browser to select music files"""
        file_path = filedialog.askopenfilename(
            title="Select Music File",
            filetypes=[("Audio Files", "*.mp3 *.flac *.wav *.m4a"), 
                      ("All Files", "*.*")]
        )
        
        if file_path:
            # Check if file is in database
            self.cursor.execute("SELECT * FROM audio_files WHERE file_path = ?", (file_path,))
            result = self.cursor.fetchone()
            
            if result:
                messagebox.showinfo("File Info", f"File found in database:\n{result[3]} - {result[4]}")
            else:
                messagebox.showinfo("New File", f"File not in database:\n{file_path}")
                
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
        pygame.mixer.quit()

def main():
    # Check dependencies
    try:
        import pygame
    except ImportError:
        print("Installing pygame...")
        os.system("pip install pygame")
        import pygame
    
    root = tk.Tk()
    app = MusicAnalyzerDesktop(root)
    root.mainloop()

if __name__ == "__main__":
    main()