#!/usr/bin/env python3
"""
Music Analyzer Pro - Professional Edition
Panel de audio con múltiples vistas: Tarjetas, Compacto, Lista
Réplica completa del diseño original que SÍ funciona
"""

import sqlite3
import tkinter as tk
from tkinter import ttk, Canvas
import pygame
import os
from datetime import datetime
import math

class AudioPanel:
    """Panel de audio profesional con visualización de metadatos"""
    
    def __init__(self, parent, colors):
        self.parent = parent
        self.colors = colors
        self.current_track = None
        self.is_playing = False
        
        # Initialize pygame mixer
        pygame.mixer.init()
        
        self.create_panel()
        
    def create_panel(self):
        """Crear panel estilo profesional"""
        # Main panel container con efecto glassmorphism
        self.panel = tk.Frame(self.parent, bg='#1a1a1a', highlightthickness=2, 
                             highlightbackground='#00ff88')
        self.panel.pack(fill=tk.X, padx=20, pady=10)
        
        # Top section - Now Playing
        top_frame = tk.Frame(self.panel, bg='#1a1a1a')
        top_frame.pack(fill=tk.X, padx=15, pady=(15, 5))
        
        # Track title and artist
        self.title_label = tk.Label(top_frame, text="Select a track", 
                                   font=('SF Pro Display', 18, 'bold'),
                                   bg='#1a1a1a', fg='white')
        self.title_label.pack(anchor='w')
        
        self.artist_label = tk.Label(top_frame, text="No artist", 
                                    font=('SF Pro Display', 14),
                                    bg='#1a1a1a', fg='#888')
        self.artist_label.pack(anchor='w')
        
        # Metadata cards container
        self.metadata_container = tk.Frame(self.panel, bg='#1a1a1a')
        self.metadata_container.pack(fill=tk.X, padx=15, pady=10)
        
        # Create metadata cards
        self.create_metadata_cards()
        
        # Waveform visualization area
        self.waveform_frame = tk.Frame(self.panel, bg='#0a0a0a', height=60)
        self.waveform_frame.pack(fill=tk.X, padx=15, pady=(5, 10))
        
        self.waveform_canvas = Canvas(self.waveform_frame, bg='#0a0a0a', 
                                     height=60, highlightthickness=0)
        self.waveform_canvas.pack(fill=tk.X)
        self.draw_waveform_placeholder()
        
        # Controls
        self.create_controls()
        
    def create_metadata_cards(self):
        """Crear tarjetas de metadatos estilo profesional"""
        # BPM Card
        self.bpm_card = self.create_single_card(
            self.metadata_container, "BPM", "--", "#ff6b6b", "🎵"
        )
        self.bpm_card.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)
        
        # KEY Card
        self.key_card = self.create_single_card(
            self.metadata_container, "KEY", "--", "#4ecdc4", "🎹"
        )
        self.key_card.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)
        
        # ENERGY Card
        self.energy_card = self.create_single_card(
            self.metadata_container, "ENERGY", "--", "#ffe66d", "⚡"
        )
        self.energy_card.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)
        
        # MOOD Card
        self.mood_card = self.create_single_card(
            self.metadata_container, "MOOD", "--", "#a8e6cf", "😊"
        )
        self.mood_card.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)
        
    def create_single_card(self, parent, label, value, color, icon):
        """Crear una tarjeta individual de metadato"""
        card = tk.Frame(parent, bg='#2a2a2a', highlightthickness=1,
                       highlightbackground=color)
        
        # Icon and label
        header = tk.Frame(card, bg='#2a2a2a')
        header.pack(fill=tk.X, padx=10, pady=(8, 2))
        
        icon_label = tk.Label(header, text=icon, font=('Arial', 16),
                            bg='#2a2a2a', fg=color)
        icon_label.pack(side=tk.LEFT)
        
        text_label = tk.Label(header, text=label, font=('SF Pro Display', 10),
                            bg='#2a2a2a', fg='#888')
        text_label.pack(side=tk.LEFT, padx=(5, 0))
        
        # Value
        value_label = tk.Label(card, text=value, font=('SF Pro Display', 20, 'bold'),
                             bg='#2a2a2a', fg=color)
        value_label.pack(padx=10, pady=(0, 8))
        
        # Store reference
        card.value_label = value_label
        return card
        
    def create_controls(self):
        """Crear controles de reproducción profesionales"""
        controls_frame = tk.Frame(self.panel, bg='#1a1a1a')
        controls_frame.pack(pady=(0, 15))
        
        # Previous button
        self.prev_btn = tk.Button(controls_frame, text="⏮", 
                                 font=('Arial', 16), width=3,
                                 bg='#2a2a2a', fg='white', bd=0,
                                 command=self.previous_track)
        self.prev_btn.pack(side=tk.LEFT, padx=2)
        
        # Play/Pause button (larger)
        self.play_btn = tk.Button(controls_frame, text="▶", 
                                 font=('Arial', 20, 'bold'), width=3,
                                 bg='#00ff88', fg='black', bd=0,
                                 command=self.toggle_play)
        self.play_btn.pack(side=tk.LEFT, padx=5)
        
        # Next button
        self.next_btn = tk.Button(controls_frame, text="⏭", 
                                 font=('Arial', 16), width=3,
                                 bg='#2a2a2a', fg='white', bd=0,
                                 command=self.next_track)
        self.next_btn.pack(side=tk.LEFT, padx=2)
        
    def draw_waveform_placeholder(self):
        """Dibujar placeholder de forma de onda"""
        width = 800
        height = 60
        center_y = height // 2
        
        # Draw waveform bars
        for i in range(0, width, 4):
            bar_height = 20 + (10 * math.sin(i * 0.05))
            self.waveform_canvas.create_rectangle(
                i, center_y - bar_height, i + 2, center_y + bar_height,
                fill='#00ff88' if self.is_playing else '#333',
                outline=''
            )
            
    def update_track(self, track_data):
        """Actualizar panel con datos del track"""
        self.current_track = track_data
        
        # Update labels
        self.title_label.config(text=track_data.get('title', 'Unknown'))
        self.artist_label.config(text=track_data.get('artist', 'Unknown Artist'))
        
        # Update metadata cards
        self.bpm_card.value_label.config(text=str(track_data.get('AI_BPM', '--')))
        self.key_card.value_label.config(text=track_data.get('AI_KEY', '--'))
        
        energy = track_data.get('AI_ENERGY', 0)
        energy_text = f"{round(energy * 100)}%" if energy else '--'
        self.energy_card.value_label.config(text=energy_text)
        
        self.mood_card.value_label.config(text=track_data.get('AI_MOOD', '--'))
        
    def toggle_play(self):
        """Toggle play/pause"""
        if self.is_playing:
            pygame.mixer.music.pause()
            self.play_btn.config(text="▶", bg='#00ff88')
            self.is_playing = False
        else:
            if self.current_track:
                # Try to play if file exists
                file_path = self.current_track.get('file_path')
                if file_path and os.path.exists(file_path):
                    try:
                        pygame.mixer.music.load(file_path)
                        pygame.mixer.music.play()
                        self.play_btn.config(text="⏸", bg='#ffaa00')
                        self.is_playing = True
                    except:
                        pass
                        
        self.draw_waveform_placeholder()
        
    def previous_track(self):
        """Go to previous track"""
        pass
        
    def next_track(self):
        """Go to next track"""
        pass


class TrackListViews:
    """Diferentes vistas para la lista de tracks"""
    
    def __init__(self, parent, colors):
        self.parent = parent
        self.colors = colors
        self.current_view = 'cards'  # cards, compact, list
        self.tracks_data = []
        self.selected_callback = None
        
        self.create_view_selector()
        self.create_view_container()
        
    def create_view_selector(self):
        """Crear selector de vistas"""
        selector_frame = tk.Frame(self.parent, bg='#0a0a0a')
        selector_frame.pack(fill=tk.X, padx=20, pady=(10, 5))
        
        tk.Label(selector_frame, text="VIEW:", font=('SF Pro Display', 12),
                bg='#0a0a0a', fg='#888').pack(side=tk.LEFT, padx=(0, 10))
        
        # View buttons
        views = [
            ("📇 Cards", "cards"),
            ("📊 Compact", "compact"),
            ("📝 List", "list")
        ]
        
        self.view_buttons = {}
        for label, view_type in views:
            btn = tk.Button(selector_frame, text=label, 
                          font=('SF Pro Display', 11),
                          bg='#2a2a2a', fg='white', bd=0,
                          padx=15, pady=5,
                          command=lambda v=view_type: self.switch_view(v))
            btn.pack(side=tk.LEFT, padx=2)
            self.view_buttons[view_type] = btn
            
        # Highlight current view
        self.view_buttons['cards'].config(bg='#00ff88', fg='black')
        
    def create_view_container(self):
        """Crear contenedor para las vistas"""
        # Scrollable frame
        self.scroll_frame = tk.Frame(self.parent, bg='#0a0a0a')
        self.scroll_frame.pack(fill=tk.BOTH, expand=True, padx=20)
        
        # Canvas and scrollbar
        self.canvas = Canvas(self.scroll_frame, bg='#0a0a0a', highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.scroll_frame, orient="vertical", 
                                 command=self.canvas.yview)
        self.scrollable_frame = tk.Frame(self.canvas, bg='#0a0a0a')
        
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        
        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)
        
        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
    def switch_view(self, view_type):
        """Cambiar entre vistas"""
        self.current_view = view_type
        
        # Update button highlights
        for vtype, btn in self.view_buttons.items():
            if vtype == view_type:
                btn.config(bg='#00ff88', fg='black')
            else:
                btn.config(bg='#2a2a2a', fg='white')
                
        self.refresh_view()
        
    def load_tracks(self, tracks):
        """Cargar tracks en la vista"""
        self.tracks_data = tracks
        self.refresh_view()
        
    def refresh_view(self):
        """Refrescar la vista actual"""
        # Clear current view
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
            
        # Render based on current view
        if self.current_view == 'cards':
            self.render_cards_view()
        elif self.current_view == 'compact':
            self.render_compact_view()
        else:
            self.render_list_view()
            
    def render_cards_view(self):
        """Renderizar vista de tarjetas"""
        # Create grid of cards
        row_frame = None
        for i, track in enumerate(self.tracks_data):
            if i % 3 == 0:
                row_frame = tk.Frame(self.scrollable_frame, bg='#0a0a0a')
                row_frame.pack(fill=tk.X, pady=5)
                
            # Create card
            card = tk.Frame(row_frame, bg='#1a1a1a', width=250, height=150,
                          highlightthickness=2, highlightbackground='#333')
            card.pack(side=tk.LEFT, padx=5)
            card.pack_propagate(False)
            
            # Card content
            content = tk.Frame(card, bg='#1a1a1a')
            content.pack(expand=True, fill=tk.BOTH, padx=10, pady=10)
            
            # Title
            title = tk.Label(content, text=track.get('title', 'Unknown')[:30],
                           font=('SF Pro Display', 12, 'bold'),
                           bg='#1a1a1a', fg='white', anchor='w')
            title.pack(fill=tk.X)
            
            # Artist
            artist = tk.Label(content, text=track.get('artist', 'Unknown')[:25],
                            font=('SF Pro Display', 10),
                            bg='#1a1a1a', fg='#888', anchor='w')
            artist.pack(fill=tk.X)
            
            # Metadata row
            meta_frame = tk.Frame(content, bg='#1a1a1a')
            meta_frame.pack(fill=tk.X, pady=(10, 0))
            
            # BPM
            bpm_label = tk.Label(meta_frame, 
                               text=f"🎵 {track.get('AI_BPM', '--')}",
                               font=('SF Pro Display', 10, 'bold'),
                               bg='#1a1a1a', fg='#ff6b6b')
            bpm_label.pack(side=tk.LEFT, padx=(0, 10))
            
            # KEY
            key_label = tk.Label(meta_frame,
                               text=f"🎹 {track.get('AI_KEY', '--')}",
                               font=('SF Pro Display', 10, 'bold'),
                               bg='#1a1a1a', fg='#4ecdc4')
            key_label.pack(side=tk.LEFT, padx=(0, 10))
            
            # ENERGY
            energy = track.get('AI_ENERGY', 0)
            energy_text = f"⚡ {round(energy * 100)}%" if energy else "⚡ --"
            energy_label = tk.Label(meta_frame, text=energy_text,
                                  font=('SF Pro Display', 10, 'bold'),
                                  bg='#1a1a1a', fg='#ffe66d')
            energy_label.pack(side=tk.LEFT)
            
            # Click handler
            card.bind("<Button-1>", lambda e, t=track: self.on_track_click(t))
            for child in content.winfo_children():
                child.bind("<Button-1>", lambda e, t=track: self.on_track_click(t))
                
    def render_compact_view(self):
        """Renderizar vista compacta"""
        for track in self.tracks_data:
            # Compact row
            row = tk.Frame(self.scrollable_frame, bg='#1a1a1a', height=50,
                         highlightthickness=1, highlightbackground='#2a2a2a')
            row.pack(fill=tk.X, pady=2, padx=5)
            row.pack_propagate(False)
            
            # Content frame
            content = tk.Frame(row, bg='#1a1a1a')
            content.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
            
            # Left side - Title and artist
            left_frame = tk.Frame(content, bg='#1a1a1a')
            left_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
            
            title_artist = f"{track.get('title', 'Unknown')} - {track.get('artist', 'Unknown')}"
            tk.Label(left_frame, text=title_artist[:50],
                    font=('SF Pro Display', 11),
                    bg='#1a1a1a', fg='white', anchor='w').pack(anchor='w')
            
            # Right side - Metadata
            right_frame = tk.Frame(content, bg='#1a1a1a')
            right_frame.pack(side=tk.RIGHT)
            
            # Metadata items
            meta_items = [
                (f"{track.get('AI_BPM', '--')} BPM", '#ff6b6b'),
                (track.get('AI_KEY', '--'), '#4ecdc4'),
                (f"{round(track.get('AI_ENERGY', 0) * 100)}%", '#ffe66d')
            ]
            
            for text, color in meta_items:
                tk.Label(right_frame, text=text,
                        font=('SF Pro Display', 10, 'bold'),
                        bg='#1a1a1a', fg=color).pack(side=tk.LEFT, padx=5)
                        
            # Click handler
            row.bind("<Button-1>", lambda e, t=track: self.on_track_click(t))
            for child in content.winfo_children():
                child.bind("<Button-1>", lambda e, t=track: self.on_track_click(t))
                
    def render_list_view(self):
        """Renderizar vista de lista detallada"""
        # Header
        header = tk.Frame(self.scrollable_frame, bg='#2a2a2a', height=30)
        header.pack(fill=tk.X, padx=5)
        header.pack_propagate(False)
        
        # Header columns
        columns = [
            ("Title", 300),
            ("Artist", 200),
            ("BPM", 80),
            ("Key", 80),
            ("Energy", 80),
            ("Mood", 150)
        ]
        
        header_content = tk.Frame(header, bg='#2a2a2a')
        header_content.pack(fill=tk.BOTH, padx=10, pady=5)
        
        for col_name, width in columns:
            tk.Label(header_content, text=col_name,
                    font=('SF Pro Display', 10, 'bold'),
                    bg='#2a2a2a', fg='#00ff88', width=width//10,
                    anchor='w').pack(side=tk.LEFT)
                    
        # Rows
        for i, track in enumerate(self.tracks_data):
            bg_color = '#1a1a1a' if i % 2 == 0 else '#151515'
            
            row = tk.Frame(self.scrollable_frame, bg=bg_color, height=35)
            row.pack(fill=tk.X, padx=5)
            row.pack_propagate(False)
            
            row_content = tk.Frame(row, bg=bg_color)
            row_content.pack(fill=tk.BOTH, padx=10, pady=5)
            
            # Data columns
            energy = track.get('AI_ENERGY', 0)
            data = [
                (track.get('title', 'Unknown')[:40], 300, 'white'),
                (track.get('artist', 'Unknown')[:30], 200, '#888'),
                (str(track.get('AI_BPM', '--')), 80, '#ff6b6b'),
                (track.get('AI_KEY', '--'), 80, '#4ecdc4'),
                (f"{round(energy * 100)}%" if energy else '--', 80, '#ffe66d'),
                (track.get('AI_MOOD', '--'), 150, '#a8e6cf')
            ]
            
            for text, width, color in data:
                tk.Label(row_content, text=text,
                        font=('SF Pro Display', 10),
                        bg=bg_color, fg=color, width=width//10,
                        anchor='w').pack(side=tk.LEFT)
                        
            # Click handler
            row.bind("<Button-1>", lambda e, t=track: self.on_track_click(t))
            for child in row_content.winfo_children():
                child.bind("<Button-1>", lambda e, t=track: self.on_track_click(t))
                
    def on_track_click(self, track):
        """Handle track selection"""
        if self.selected_callback:
            self.selected_callback(track)


class MusicAnalyzerProMax:
    """Aplicación principal con panel de audio y vistas múltiples"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("🎵 MAP Pro Max - Python Edition")
        self.root.geometry("1400x900")
        self.root.configure(bg='#0a0a0a')
        
        # Colors
        self.colors = {
            'bg': '#0a0a0a',
            'panel': '#1a1a1a',
            'accent': '#00ff88',
            'text': '#ffffff',
            'text_dim': '#888888'
        }
        
        # Database connection
        self.setup_database()
        
        # Create UI
        self.create_ui()
        
        # Load data
        self.load_tracks()
        
    def setup_database(self):
        """Connect to database"""
        self.conn = sqlite3.connect('music_analyzer.db')
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        
    def create_ui(self):
        """Create main UI"""
        # Title bar
        title_frame = tk.Frame(self.root, bg='#0a0a0a', height=60)
        title_frame.pack(fill=tk.X)
        title_frame.pack_propagate(False)
        
        title = tk.Label(title_frame, text="🎵 Music Analyzer Pro Max",
                        font=('SF Pro Display', 28, 'bold'),
                        bg='#0a0a0a', fg='#00ff88')
        title.pack(pady=15)
        
        # Audio Panel
        self.audio_panel = AudioPanel(self.root, self.colors)
        
        # Track List with Views
        self.track_list = TrackListViews(self.root, self.colors)
        self.track_list.selected_callback = self.on_track_selected
        
    def load_tracks(self):
        """Load tracks from database"""
        self.cursor.execute("""
            SELECT id, file_path, title, artist, AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD
            FROM audio_files
            WHERE AI_BPM IS NOT NULL
            ORDER BY id
        """)
        
        tracks = [dict(row) for row in self.cursor.fetchall()]
        self.track_list.load_tracks(tracks)
        
        # Select first track
        if tracks:
            self.on_track_selected(tracks[0])
            
        print(f"✅ Loaded {len(tracks)} tracks with metadata")
        
    def on_track_selected(self, track):
        """Handle track selection"""
        self.audio_panel.update_track(track)
        print(f"Selected: {track.get('title')} - BPM: {track.get('AI_BPM')}")
        
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
        pygame.mixer.quit()


def main():
    print("\n" + "="*60)
    print("🎵 MUSIC ANALYZER PRO MAX - PYTHON")
    print("Panel de audio con vistas: Tarjetas, Compacto, Lista")
    print("="*60 + "\n")
    
    root = tk.Tk()
    app = MusicAnalyzerProMax(root)
    root.mainloop()

if __name__ == "__main__":
    main()