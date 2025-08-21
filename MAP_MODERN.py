#!/usr/bin/env python3
"""
MUSIC ANALYZER PRO - MODERN UI
Diseño profesional moderno con CustomTkinter
UI elegante estilo Spotify/Apple Music
"""

import customtkinter as ctk
import tkinter as tk
from PIL import Image, ImageDraw, ImageFilter
import pygame
import sqlite3
import threading
import time
import random
import os
from typing import Dict, List, Optional

# Configure CustomTkinter
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class ModernMusicPlayer:
    """Modern Music Player with Professional UI"""
    
    def __init__(self):
        self.root = ctk.CTk()
        self.root.title("Music Analyzer Pro")
        self.root.geometry("1600x950")
        
        # Custom colors for professional look
        self.colors = {
            'bg_primary': '#0a0a0a',
            'bg_secondary': '#141414',
            'bg_tertiary': '#1f1f1f',
            'accent': '#1db954',  # Spotify green
            'accent_hover': '#1ed760',
            'text_primary': '#ffffff',
            'text_secondary': '#b3b3b3',
            'text_tertiary': '#7a7a7a',
            'danger': '#e22134',
            'warning': '#ffa500',
            'info': '#4169e1',
            'card_bg': '#181818',
            'card_hover': '#282828'
        }
        
        # Configure window
        self.root.configure(fg_color=self.colors['bg_primary'])
        
        # Initialize pygame
        pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
        
        # State
        self.current_track = None
        self.is_playing = False
        self.is_paused = False
        self.current_position = 0
        self.track_length = 240
        self.tracks_data = []
        self.current_view = 'grid'
        
        # Database
        self.setup_database()
        
        # Create UI
        self.create_ui()
        
        # Load data
        self.load_tracks()
        
        # Start update thread
        self.running = True
        self.update_thread = threading.Thread(target=self.update_loop, daemon=True)
        self.update_thread.start()
        
    def setup_database(self):
        """Setup database connection"""
        self.conn = sqlite3.connect('music_analyzer.db')
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        
    def create_ui(self):
        """Create modern UI layout"""
        # Main container with grid layout
        self.root.grid_columnconfigure(0, weight=0)  # Sidebar
        self.root.grid_columnconfigure(1, weight=1)  # Main content
        self.root.grid_rowconfigure(0, weight=1)     # Content area
        self.root.grid_rowconfigure(1, weight=0)     # Player bar
        
        # Create components
        self.create_sidebar()
        self.create_main_content()
        self.create_player_bar()
        
    def create_sidebar(self):
        """Create modern sidebar"""
        sidebar = ctk.CTkFrame(self.root, width=250, corner_radius=0,
                              fg_color=self.colors['bg_secondary'])
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.grid_propagate(False)
        
        # Logo and title
        logo_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        logo_frame.pack(fill="x", padx=20, pady=20)
        
        ctk.CTkLabel(logo_frame, text="🎵", font=("SF Pro Display", 32)).pack(side="left")
        ctk.CTkLabel(logo_frame, text="Music Analyzer\nPro", 
                    font=("SF Pro Display", 16, "bold"),
                    text_color=self.colors['text_primary']).pack(side="left", padx=10)
        
        # Navigation menu
        nav_items = [
            ("🏠", "Home", self.show_home),
            ("🔍", "Search", self.show_search),
            ("📚", "Library", self.show_library),
            ("❤️", "Favorites", self.show_favorites),
            ("📊", "Analytics", self.show_analytics)
        ]
        
        for icon, text, command in nav_items:
            btn = ctk.CTkButton(sidebar, text=f"{icon}  {text}",
                              font=("SF Pro Display", 14),
                              height=45,
                              corner_radius=10,
                              fg_color="transparent",
                              hover_color=self.colors['bg_tertiary'],
                              anchor="w",
                              command=command)
            btn.pack(fill="x", padx=15, pady=3)
            
        # Separator
        ctk.CTkFrame(sidebar, height=1, fg_color=self.colors['bg_tertiary']).pack(fill="x", padx=20, pady=20)
        
        # Playlists section
        ctk.CTkLabel(sidebar, text="PLAYLISTS", 
                    font=("SF Pro Display", 11),
                    text_color=self.colors['text_tertiary']).pack(anchor="w", padx=20, pady=(0, 10))
        
        playlists = ["Energetic Mix", "Chill Vibes", "Focus Mode", "Party Time"]
        for playlist in playlists:
            btn = ctk.CTkButton(sidebar, text=f"🎵 {playlist}",
                              font=("SF Pro Display", 13),
                              height=35,
                              corner_radius=8,
                              fg_color="transparent",
                              hover_color=self.colors['bg_tertiary'],
                              anchor="w")
            btn.pack(fill="x", padx=15, pady=2)
            
    def create_main_content(self):
        """Create main content area"""
        self.main_frame = ctk.CTkScrollableFrame(self.root, corner_radius=0,
                                                fg_color=self.colors['bg_primary'])
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=(0, 0), pady=(0, 0))
        
        # Header with gradient effect
        self.create_header()
        
        # View controls
        self.create_view_controls()
        
        # Track grid container
        self.tracks_container = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.tracks_container.pack(fill="both", expand=True, padx=20, pady=10)
        
    def create_header(self):
        """Create header with gradient background"""
        header = ctk.CTkFrame(self.main_frame, height=200, corner_radius=0,
                            fg_color=self.colors['bg_secondary'])
        header.pack(fill="x", padx=0, pady=(0, 20))
        header.pack_propagate(False)
        
        # Gradient overlay (simulated)
        gradient_frame = ctk.CTkFrame(header, fg_color=self.colors['accent'])
        gradient_frame.place(relwidth=1, relheight=1)
        gradient_frame.configure(fg_color=("#1db954", "#0a0a0a"))
        
        # Content
        content = ctk.CTkFrame(header, fg_color="transparent")
        content.pack(expand=True)
        
        ctk.CTkLabel(content, text="Your Music Library",
                    font=("SF Pro Display", 42, "bold"),
                    text_color=self.colors['text_primary']).pack(pady=(20, 5))
                    
        self.stats_label = ctk.CTkLabel(content, text="Loading tracks...",
                                       font=("SF Pro Display", 16),
                                       text_color=self.colors['text_secondary'])
        self.stats_label.pack()
        
    def create_view_controls(self):
        """Create view control buttons"""
        controls_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        controls_frame.pack(fill="x", padx=20, pady=(0, 10))
        
        # Title
        ctk.CTkLabel(controls_frame, text="Tracks",
                    font=("SF Pro Display", 24, "bold"),
                    text_color=self.colors['text_primary']).pack(side="left", padx=(0, 20))
        
        # View buttons
        view_frame = ctk.CTkFrame(controls_frame, fg_color="transparent")
        view_frame.pack(side="right")
        
        self.view_buttons = {}
        views = [
            ("Grid", "grid", "⊞"),
            ("List", "list", "☰"),
            ("Compact", "compact", "≡")
        ]
        
        for name, view_id, icon in views:
            btn = ctk.CTkButton(view_frame, text=f"{icon} {name}",
                              width=100, height=35,
                              corner_radius=20,
                              font=("SF Pro Display", 13),
                              fg_color=self.colors['bg_tertiary'],
                              hover_color=self.colors['accent'],
                              command=lambda v=view_id: self.switch_view(v))
            btn.pack(side="left", padx=3)
            self.view_buttons[view_id] = btn
            
        # Highlight default view
        self.view_buttons['grid'].configure(fg_color=self.colors['accent'])
        
    def create_player_bar(self):
        """Create bottom player bar"""
        player_bar = ctk.CTkFrame(self.root, height=100, corner_radius=0,
                                 fg_color=self.colors['bg_secondary'])
        player_bar.grid(row=1, column=0, columnspan=2, sticky="ew")
        player_bar.grid_propagate(False)
        
        # Configure grid
        player_bar.grid_columnconfigure(0, weight=1)  # Track info
        player_bar.grid_columnconfigure(1, weight=2)  # Controls
        player_bar.grid_columnconfigure(2, weight=1)  # Extra controls
        
        # Track info section
        self.create_track_info(player_bar)
        
        # Player controls section
        self.create_player_controls(player_bar)
        
        # Extra controls section
        self.create_extra_controls(player_bar)
        
    def create_track_info(self, parent):
        """Create track info section"""
        info_frame = ctk.CTkFrame(parent, fg_color="transparent")
        info_frame.grid(row=0, column=0, sticky="ew", padx=20)
        
        # Album art placeholder
        art_frame = ctk.CTkFrame(info_frame, width=70, height=70,
                                corner_radius=10, fg_color=self.colors['bg_tertiary'])
        art_frame.pack(side="left", padx=(0, 15))
        art_frame.pack_propagate(False)
        
        ctk.CTkLabel(art_frame, text="🎵", font=("Arial", 24)).pack(expand=True)
        
        # Track details
        details_frame = ctk.CTkFrame(info_frame, fg_color="transparent")
        details_frame.pack(side="left", fill="both", expand=True)
        
        self.track_title = ctk.CTkLabel(details_frame, text="No track selected",
                                       font=("SF Pro Display", 14, "bold"),
                                       text_color=self.colors['text_primary'],
                                       anchor="w")
        self.track_title.pack(fill="x", pady=(10, 2))
        
        self.track_artist = ctk.CTkLabel(details_frame, text="Select a track to play",
                                        font=("SF Pro Display", 12),
                                        text_color=self.colors['text_secondary'],
                                        anchor="w")
        self.track_artist.pack(fill="x")
        
        # Metadata badges
        self.meta_frame = ctk.CTkFrame(details_frame, fg_color="transparent")
        self.meta_frame.pack(fill="x", pady=(5, 0))
        
    def create_player_controls(self, parent):
        """Create player control buttons"""
        controls_frame = ctk.CTkFrame(parent, fg_color="transparent")
        controls_frame.grid(row=0, column=1, sticky="ew")
        
        # Control buttons container
        btn_container = ctk.CTkFrame(controls_frame, fg_color="transparent")
        btn_container.pack(expand=True)
        
        # Previous button
        self.prev_btn = ctk.CTkButton(btn_container, text="⏮", width=40, height=40,
                                     corner_radius=20,
                                     font=("Arial", 16),
                                     fg_color=self.colors['bg_tertiary'],
                                     hover_color=self.colors['card_hover'],
                                     command=self.previous_track)
        self.prev_btn.pack(side="left", padx=5)
        
        # Play/Pause button
        self.play_btn = ctk.CTkButton(btn_container, text="▶", width=50, height=50,
                                     corner_radius=25,
                                     font=("Arial", 20),
                                     fg_color=self.colors['accent'],
                                     hover_color=self.colors['accent_hover'],
                                     command=self.toggle_play)
        self.play_btn.pack(side="left", padx=10)
        
        # Next button
        self.next_btn = ctk.CTkButton(btn_container, text="⏭", width=40, height=40,
                                     corner_radius=20,
                                     font=("Arial", 16),
                                     fg_color=self.colors['bg_tertiary'],
                                     hover_color=self.colors['card_hover'],
                                     command=self.next_track)
        self.next_btn.pack(side="left", padx=5)
        
        # Progress bar
        progress_frame = ctk.CTkFrame(controls_frame, fg_color="transparent")
        progress_frame.pack(fill="x", padx=30, pady=(10, 0))
        
        self.time_label = ctk.CTkLabel(progress_frame, text="0:00",
                                      font=("SF Pro Display", 10),
                                      text_color=self.colors['text_tertiary'])
        self.time_label.pack(side="left", padx=(0, 10))
        
        self.progress_bar = ctk.CTkProgressBar(progress_frame, height=6,
                                              corner_radius=3,
                                              fg_color=self.colors['bg_tertiary'],
                                              progress_color=self.colors['accent'])
        self.progress_bar.pack(side="left", fill="x", expand=True)
        self.progress_bar.set(0)
        
        self.duration_label = ctk.CTkLabel(progress_frame, text="0:00",
                                          font=("SF Pro Display", 10),
                                          text_color=self.colors['text_tertiary'])
        self.duration_label.pack(side="left", padx=(10, 0))
        
    def create_extra_controls(self, parent):
        """Create extra controls section"""
        extra_frame = ctk.CTkFrame(parent, fg_color="transparent")
        extra_frame.grid(row=0, column=2, sticky="ew", padx=20)
        
        # Volume control
        vol_frame = ctk.CTkFrame(extra_frame, fg_color="transparent")
        vol_frame.pack(side="right")
        
        ctk.CTkLabel(vol_frame, text="🔊", font=("Arial", 14)).pack(side="left", padx=(0, 5))
        
        self.volume_slider = ctk.CTkSlider(vol_frame, from_=0, to=100,
                                          width=100, height=15,
                                          fg_color=self.colors['bg_tertiary'],
                                          progress_color=self.colors['accent'],
                                          button_color=self.colors['text_primary'],
                                          command=self.change_volume)
        self.volume_slider.pack(side="left")
        self.volume_slider.set(70)
        
    def load_tracks(self):
        """Load tracks from database"""
        self.cursor.execute("""
            SELECT id, file_path, title, artist, album,
                   AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD
            FROM audio_files
            WHERE AI_BPM IS NOT NULL
            ORDER BY artist, title
        """)
        
        self.tracks_data = [dict(row) for row in self.cursor.fetchall()]
        
        # Update stats
        self.stats_label.configure(text=f"{len(self.tracks_data)} tracks • Ready to play")
        
        # Display tracks
        self.display_tracks()
        
        # Select first track
        if self.tracks_data:
            self.select_track(self.tracks_data[0])
            
    def display_tracks(self):
        """Display tracks based on current view"""
        # Clear current tracks
        for widget in self.tracks_container.winfo_children():
            widget.destroy()
            
        if self.current_view == 'grid':
            self.display_grid_view()
        elif self.current_view == 'list':
            self.display_list_view()
        else:
            self.display_compact_view()
            
    def display_grid_view(self):
        """Display tracks in grid view"""
        # Create grid
        columns = 4
        for i, track in enumerate(self.tracks_data):
            row = i // columns
            col = i % columns
            
            # Track card
            card = ctk.CTkFrame(self.tracks_container, width=280, height=320,
                              corner_radius=15, fg_color=self.colors['card_bg'])
            card.grid(row=row, column=col, padx=10, pady=10, sticky="nsew")
            
            # Album art placeholder
            art_frame = ctk.CTkFrame(card, width=260, height=180,
                                   corner_radius=10, fg_color=self.colors['bg_tertiary'])
            art_frame.pack(padx=10, pady=(10, 5))
            art_frame.pack_propagate(False)
            
            # Gradient effect
            ctk.CTkLabel(art_frame, text="🎵", font=("Arial", 48),
                        text_color=self.colors['accent']).pack(expand=True)
            
            # Track info
            info_frame = ctk.CTkFrame(card, fg_color="transparent")
            info_frame.pack(fill="x", padx=15, pady=(5, 10))
            
            ctk.CTkLabel(info_frame, text=track['title'][:30],
                        font=("SF Pro Display", 14, "bold"),
                        text_color=self.colors['text_primary'],
                        anchor="w").pack(fill="x")
                        
            ctk.CTkLabel(info_frame, text=track.get('artist', 'Unknown')[:25],
                        font=("SF Pro Display", 12),
                        text_color=self.colors['text_secondary'],
                        anchor="w").pack(fill="x", pady=(2, 5))
            
            # Metadata badges
            meta_frame = ctk.CTkFrame(info_frame, fg_color="transparent")
            meta_frame.pack(fill="x")
            
            # BPM badge
            bpm_badge = ctk.CTkFrame(meta_frame, corner_radius=12,
                                    fg_color=self.colors['bg_tertiary'])
            bpm_badge.pack(side="left", padx=(0, 5))
            ctk.CTkLabel(bpm_badge, text=f"♫ {track['AI_BPM']}",
                        font=("SF Pro Display", 10, "bold"),
                        text_color=self.colors['accent']).pack(padx=8, pady=3)
            
            # Key badge
            key_badge = ctk.CTkFrame(meta_frame, corner_radius=12,
                                   fg_color=self.colors['bg_tertiary'])
            key_badge.pack(side="left", padx=(0, 5))
            ctk.CTkLabel(key_badge, text=f"♪ {track['AI_KEY']}",
                        font=("SF Pro Display", 10, "bold"),
                        text_color="#4169e1").pack(padx=8, pady=3)
            
            # Energy badge
            energy = track['AI_ENERGY']
            energy_text = f"⚡ {round(energy * 100)}%" if energy else "⚡ --"
            energy_badge = ctk.CTkFrame(meta_frame, corner_radius=12,
                                      fg_color=self.colors['bg_tertiary'])
            energy_badge.pack(side="left")
            ctk.CTkLabel(energy_badge, text=energy_text,
                        font=("SF Pro Display", 10, "bold"),
                        text_color="#ffa500").pack(padx=8, pady=3)
            
            # Play button overlay
            play_btn = ctk.CTkButton(card, text="▶", width=50, height=50,
                                    corner_radius=25,
                                    font=("Arial", 20),
                                    fg_color=self.colors['accent'],
                                    hover_color=self.colors['accent_hover'],
                                    command=lambda t=track: self.play_track(t))
            play_btn.place(relx=0.5, rely=0.35, anchor="center")
            
            # Click handler
            card.bind("<Button-1>", lambda e, t=track: self.select_track(t))
            
    def display_list_view(self):
        """Display tracks in list view"""
        # Create header
        header = ctk.CTkFrame(self.tracks_container, height=40,
                            fg_color=self.colors['bg_tertiary'])
        header.pack(fill="x", pady=(0, 5))
        
        # Header labels
        headers = [("#", 50), ("Title", 300), ("Artist", 200), 
                  ("Album", 200), ("BPM", 80), ("Key", 80), ("Energy", 100), ("Mood", 150)]
        
        for text, width in headers:
            ctk.CTkLabel(header, text=text, width=width,
                        font=("SF Pro Display", 11, "bold"),
                        text_color=self.colors['text_secondary']).pack(side="left", padx=10)
        
        # Track rows
        for i, track in enumerate(self.tracks_data):
            row = ctk.CTkFrame(self.tracks_container, height=50,
                             fg_color=self.colors['card_bg'] if i % 2 == 0 else "transparent")
            row.pack(fill="x", pady=1)
            
            # Track number
            ctk.CTkLabel(row, text=str(i + 1), width=50,
                        font=("SF Pro Display", 12),
                        text_color=self.colors['text_tertiary']).pack(side="left", padx=10)
            
            # Track info
            ctk.CTkLabel(row, text=track['title'][:40], width=300,
                        font=("SF Pro Display", 12),
                        text_color=self.colors['text_primary'],
                        anchor="w").pack(side="left", padx=10)
            
            ctk.CTkLabel(row, text=track.get('artist', 'Unknown')[:30], width=200,
                        font=("SF Pro Display", 12),
                        text_color=self.colors['text_secondary'],
                        anchor="w").pack(side="left", padx=10)
            
            ctk.CTkLabel(row, text=track.get('album', '--')[:30], width=200,
                        font=("SF Pro Display", 12),
                        text_color=self.colors['text_tertiary'],
                        anchor="w").pack(side="left", padx=10)
            
            # Metadata
            ctk.CTkLabel(row, text=str(track['AI_BPM']), width=80,
                        font=("SF Pro Display", 11, "bold"),
                        text_color=self.colors['accent']).pack(side="left", padx=10)
            
            ctk.CTkLabel(row, text=track['AI_KEY'], width=80,
                        font=("SF Pro Display", 11, "bold"),
                        text_color="#4169e1").pack(side="left", padx=10)
            
            energy = track['AI_ENERGY']
            energy_text = f"{round(energy * 100)}%" if energy else "--"
            ctk.CTkLabel(row, text=energy_text, width=100,
                        font=("SF Pro Display", 11, "bold"),
                        text_color="#ffa500").pack(side="left", padx=10)
            
            ctk.CTkLabel(row, text=track.get('AI_MOOD', '--'), width=150,
                        font=("SF Pro Display", 11),
                        text_color=self.colors['text_secondary']).pack(side="left", padx=10)
            
            # Click handler
            row.bind("<Button-1>", lambda e, t=track: self.select_track(t))
            
    def display_compact_view(self):
        """Display tracks in compact view"""
        for i, track in enumerate(self.tracks_data):
            # Compact row
            row = ctk.CTkFrame(self.tracks_container, height=70,
                             corner_radius=10,
                             fg_color=self.colors['card_bg'])
            row.pack(fill="x", pady=3)
            
            # Album art mini
            art_frame = ctk.CTkFrame(row, width=50, height=50,
                                   corner_radius=8,
                                   fg_color=self.colors['bg_tertiary'])
            art_frame.pack(side="left", padx=10, pady=10)
            art_frame.pack_propagate(False)
            
            ctk.CTkLabel(art_frame, text="🎵", font=("Arial", 16)).pack(expand=True)
            
            # Track info
            info_frame = ctk.CTkFrame(row, fg_color="transparent")
            info_frame.pack(side="left", fill="x", expand=True, padx=10)
            
            ctk.CTkLabel(info_frame, 
                        text=f"{track['title'][:40]} • {track.get('artist', 'Unknown')[:30]}",
                        font=("SF Pro Display", 13, "bold"),
                        text_color=self.colors['text_primary'],
                        anchor="w").pack(fill="x", pady=(15, 2))
            
            # Metadata line
            meta_text = f"{track['AI_BPM']} BPM • {track['AI_KEY']} • "
            energy = track['AI_ENERGY']
            meta_text += f"{round(energy * 100)}%" if energy else "--"
            meta_text += f" • {track.get('AI_MOOD', '--')}"
            
            ctk.CTkLabel(info_frame, text=meta_text,
                        font=("SF Pro Display", 11),
                        text_color=self.colors['text_secondary'],
                        anchor="w").pack(fill="x")
            
            # Play button
            play_btn = ctk.CTkButton(row, text="▶", width=40, height=40,
                                    corner_radius=20,
                                    font=("Arial", 14),
                                    fg_color=self.colors['accent'],
                                    hover_color=self.colors['accent_hover'],
                                    command=lambda t=track: self.play_track(t))
            play_btn.pack(side="right", padx=15)
            
            # Click handler
            row.bind("<Button-1>", lambda e, t=track: self.select_track(t))
            
    def select_track(self, track):
        """Select a track"""
        self.current_track = track
        
        # Update player info
        self.track_title.configure(text=track['title'][:50])
        self.track_artist.configure(text=track.get('artist', 'Unknown'))
        
        # Clear and update metadata badges
        for widget in self.meta_frame.winfo_children():
            widget.destroy()
            
        # Create new badges
        badges = [
            (f"{track['AI_BPM']} BPM", self.colors['accent']),
            (track['AI_KEY'], "#4169e1"),
            (f"{round(track.get('AI_ENERGY', 0) * 100)}%", "#ffa500"),
            (track.get('AI_MOOD', '--'), self.colors['text_tertiary'])
        ]
        
        for text, color in badges:
            badge = ctk.CTkFrame(self.meta_frame, corner_radius=10,
                               fg_color=self.colors['bg_tertiary'])
            badge.pack(side="left", padx=(0, 5))
            ctk.CTkLabel(badge, text=text,
                        font=("SF Pro Display", 10),
                        text_color=color).pack(padx=6, pady=2)
                        
    def play_track(self, track):
        """Play a specific track"""
        self.select_track(track)
        self.toggle_play()
        
    def toggle_play(self):
        """Toggle play/pause"""
        if self.is_playing:
            if self.is_paused:
                pygame.mixer.music.unpause()
                self.is_paused = False
                self.play_btn.configure(text="⏸")
            else:
                pygame.mixer.music.pause()
                self.is_paused = True
                self.play_btn.configure(text="▶")
        else:
            if self.current_track:
                # Try to play file
                file_path = self.current_track.get('file_path')
                if file_path and os.path.exists(file_path):
                    try:
                        pygame.mixer.music.load(file_path)
                        pygame.mixer.music.play()
                    except:
                        pass
                        
                self.is_playing = True
                self.play_btn.configure(text="⏸")
                
    def previous_track(self):
        """Go to previous track"""
        if self.tracks_data and self.current_track:
            try:
                idx = self.tracks_data.index(self.current_track)
                if idx > 0:
                    self.select_track(self.tracks_data[idx - 1])
            except:
                pass
                
    def next_track(self):
        """Go to next track"""
        if self.tracks_data and self.current_track:
            try:
                idx = self.tracks_data.index(self.current_track)
                if idx < len(self.tracks_data) - 1:
                    self.select_track(self.tracks_data[idx + 1])
            except:
                pass
                
    def switch_view(self, view_type):
        """Switch between views"""
        self.current_view = view_type
        
        # Update button colors
        for vid, btn in self.view_buttons.items():
            if vid == view_type:
                btn.configure(fg_color=self.colors['accent'])
            else:
                btn.configure(fg_color=self.colors['bg_tertiary'])
                
        self.display_tracks()
        
    def change_volume(self, value):
        """Change volume"""
        pygame.mixer.music.set_volume(value / 100)
        
    def update_loop(self):
        """Update thread"""
        while self.running:
            if self.is_playing and not self.is_paused:
                self.current_position += 0.1
                if self.current_position > self.track_length:
                    self.current_position = 0
                    
                # Update UI
                progress = self.current_position / self.track_length
                self.root.after(0, lambda: self.progress_bar.set(progress))
                
                # Update time
                mins = int(self.current_position // 60)
                secs = int(self.current_position % 60)
                self.root.after(0, lambda: self.time_label.configure(text=f"{mins}:{secs:02d}"))
                
                mins = int(self.track_length // 60)
                secs = int(self.track_length % 60)
                self.root.after(0, lambda: self.duration_label.configure(text=f"{mins}:{secs:02d}"))
                
            time.sleep(0.1)
            
    def show_home(self):
        print("Home clicked")
        
    def show_search(self):
        print("Search clicked")
        
    def show_library(self):
        print("Library clicked")
        
    def show_favorites(self):
        print("Favorites clicked")
        
    def show_analytics(self):
        print("Analytics clicked")
        
    def run(self):
        """Run the application"""
        try:
            self.root.mainloop()
        finally:
            self.running = False
            if hasattr(self, 'conn'):
                self.conn.close()
            pygame.mixer.quit()


def main():
    print("\n" + "="*70)
    print("🎵 MUSIC ANALYZER PRO - MODERN UI")
    print("Professional Design with CustomTkinter")
    print("="*70 + "\n")
    
    app = ModernMusicPlayer()
    app.run()

if __name__ == "__main__":
    main()