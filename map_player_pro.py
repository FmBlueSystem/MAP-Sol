#!/usr/bin/env python3
"""
Music Analyzer Pro - Professional Player
Réplica exacta del player profesional con VU meter y diseño oscuro
"""

import tkinter as tk
from tkinter import Canvas, Frame, Label, Scale
import pygame
import math
import random
import threading
import time
import sqlite3
from PIL import Image, ImageTk, ImageDraw, ImageFilter
import os

class ProfessionalAudioPlayer:
    """Player profesional estilo DJ con VU meter"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("🎵 The Ring - Professional Player")
        self.root.geometry("1600x200")
        self.root.configure(bg='#0a0c10')
        self.root.resizable(False, False)
        
        # Initialize pygame
        pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
        
        # State
        self.is_playing = False
        self.is_paused = False
        self.current_track = None
        self.current_position = 0
        self.track_length = 360  # 6:00 default
        
        # Database
        self.setup_database()
        
        # Create UI
        self.create_player_ui()
        
        # Start update thread
        self.update_thread_running = True
        self.update_thread = threading.Thread(target=self.update_loop, daemon=True)
        self.update_thread.start()
        
    def setup_database(self):
        """Connect to database"""
        self.conn = sqlite3.connect('music_analyzer.db')
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        
        # Load first track
        self.cursor.execute("""
            SELECT * FROM audio_files 
            WHERE AI_BPM IS NOT NULL 
            LIMIT 1
        """)
        track = self.cursor.fetchone()
        if track:
            self.current_track = dict(track)
            
    def create_player_ui(self):
        """Create the professional player UI"""
        # Main container
        main_frame = Frame(self.root, bg='#0a0c10')
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left section - Album art and info
        self.create_left_section(main_frame)
        
        # Center section - VU Meter and waveform
        self.create_center_section(main_frame)
        
        # Right section - Controls
        self.create_right_section(main_frame)
        
    def create_left_section(self, parent):
        """Create left section with album art and track info"""
        left_frame = Frame(parent, bg='#0a0c10', width=400)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 20))
        left_frame.pack_propagate(False)
        
        # Top info container
        info_container = Frame(left_frame, bg='#1a1f2e')
        info_container.pack(fill=tk.X)
        
        # Album art placeholder
        art_frame = Frame(info_container, bg='#2a2f3e', width=80, height=80)
        art_frame.pack(side=tk.LEFT, padx=10, pady=10)
        art_frame.pack_propagate(False)
        
        # Create gradient album art
        self.album_canvas = Canvas(art_frame, width=80, height=80, 
                                  bg='#2a2f3e', highlightthickness=0)
        self.album_canvas.pack()
        
        # Draw logo/art
        self.album_canvas.create_rectangle(20, 20, 60, 60, 
                                          fill='#00ff88', outline='')
        self.album_canvas.create_text(40, 40, text="🎵", 
                                     font=('Arial', 24), fill='#0a0c10')
        
        # Track info
        info_frame = Frame(info_container, bg='#1a1f2e')
        info_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=10)
        
        # Title - smaller text
        self.title_label = Label(info_frame, 
                                text="FOR DISCOS ONLY: INDIE DANCE",
                                font=('SF Pro Display', 11, 'bold'),
                                bg='#1a1f2e', fg='#00ff88')
        self.title_label.pack(anchor='w')
        
        # Subtitle
        self.subtitle_label = Label(info_frame,
                                   text="MUSIC FROM FANTASY & VANGUARD",
                                   font=('SF Pro Display', 10),
                                   bg='#1a1f2e', fg='#888')
        self.subtitle_label.pack(anchor='w')
        
        # Label
        self.label_label = Label(info_frame,
                               text="RECORDS (1976-1981)",
                               font=('SF Pro Display', 9),
                               bg='#1a1f2e', fg='#666')
        self.label_label.pack(anchor='w')
        
        # Metadata buttons row
        meta_frame = Frame(left_frame, bg='#0a0c10')
        meta_frame.pack(fill=tk.X, pady=(10, 0))
        
        # BPM button
        self.bpm_btn = self.create_meta_button(meta_frame, "-- BPM", '#00ff88')
        self.bpm_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        # Key button (inactive style)
        self.key_btn = self.create_meta_button(meta_frame, "--", '#444')
        self.key_btn.pack(side=tk.LEFT, padx=5)
        
        # Energy button (inactive style)
        self.energy_btn = self.create_meta_button(meta_frame, "⟷", '#444')
        self.energy_btn.pack(side=tk.LEFT, padx=5)
        
        # Update with track data if available
        if self.current_track:
            bpm = self.current_track.get('AI_BPM', '--')
            key = self.current_track.get('AI_KEY', '--')
            self.bpm_btn.config(text=f"{bpm} BPM")
            self.key_btn.config(text=key)
            
    def create_meta_button(self, parent, text, color):
        """Create metadata button"""
        btn = Label(parent, text=text, font=('SF Pro Display', 10, 'bold'),
                   bg='#1a1f2e', fg=color, padx=15, pady=5,
                   relief=tk.FLAT, borderwidth=1)
        btn.config(highlightbackground=color, highlightthickness=1)
        return btn
        
    def create_center_section(self, parent):
        """Create center section with VU meter"""
        center_frame = Frame(parent, bg='#0a0c10')
        center_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # AUDIO LEVELS header
        header_frame = Frame(center_frame, bg='#0a0c10')
        header_frame.pack(fill=tk.X)
        
        Label(header_frame, text="AUDIO LEVELS",
              font=('SF Pro Display', 10, 'bold'),
              bg='#0a0c10', fg='#00ff88').pack(anchor='center')
        
        # VU Meter container
        vu_container = Frame(center_frame, bg='#1a1f2e', height=80)
        vu_container.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        # VU Meter canvas
        self.vu_canvas = Canvas(vu_container, bg='#0a0c10', 
                               height=60, highlightthickness=0)
        self.vu_canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Draw VU meter background
        self.draw_vu_meter()
        
        # dB scale on right
        scale_frame = Frame(vu_container, bg='#1a1f2e')
        scale_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(0, 10))
        
        # dB labels
        for db in ['0', '-3', '-6', '-12', '-20']:
            Label(scale_frame, text=db, font=('SF Pro Display', 8),
                  bg='#1a1f2e', fg='#666').pack(anchor='e')
                  
        # Time display
        time_frame = Frame(center_frame, bg='#0a0c10')
        time_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.time_elapsed = Label(time_frame, text="0:43",
                                 font=('SF Pro Display', 10),
                                 bg='#0a0c10', fg='#666')
        self.time_elapsed.pack(side=tk.LEFT)
        
        # Progress bar
        self.progress_canvas = Canvas(time_frame, height=20, bg='#0a0c10',
                                     highlightthickness=0)
        self.progress_canvas.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=10)
        
        self.time_remaining = Label(time_frame, text="6:41",
                                   font=('SF Pro Display', 10),
                                   bg='#0a0c10', fg='#666')
        self.time_remaining.pack(side=tk.RIGHT)
        
        # Draw progress bar
        self.draw_progress_bar()
        
    def draw_vu_meter(self):
        """Draw VU meter visualization"""
        self.vu_canvas.delete("all")
        width = 600
        height = 60
        
        # Background gradient
        for i in range(width):
            if i < width * 0.6:
                # Blue section (-inf to -6dB)
                color = self.interpolate_color('#003366', '#0066cc', i / (width * 0.6))
            elif i < width * 0.8:
                # Cyan section (-6 to -3dB)
                color = self.interpolate_color('#0066cc', '#00ccff', 
                                             (i - width * 0.6) / (width * 0.2))
            else:
                # Green to yellow section (-3 to 0dB)
                color = self.interpolate_color('#00ff88', '#ffff00',
                                             (i - width * 0.8) / (width * 0.2))
                
            self.vu_canvas.create_line(i, 0, i, height, fill=color, width=1)
            
        # Draw level bars
        self.draw_level_bars()
        
        # Draw dB text
        self.vu_canvas.create_text(width//2 - 50, height//2, 
                                  text="-1 dB",
                                  font=('SF Pro Display', 14, 'bold'),
                                  fill='white')
                                  
    def draw_level_bars(self):
        """Draw animated level bars"""
        if not hasattr(self, 'level_bars'):
            self.level_bars = []
            
        width = 600
        height = 60
        bar_width = 3
        spacing = 1
        
        # Simulate audio levels
        if self.is_playing and not self.is_paused:
            level = random.uniform(0.5, 0.9)
        else:
            level = 0.1
            
        num_bars = int((width * level) / (bar_width + spacing))
        
        for i in range(num_bars):
            x = i * (bar_width + spacing)
            
            # Determine color based on position
            if x < width * 0.6:
                color = '#0066cc'
            elif x < width * 0.8:
                color = '#00ccff'
            else:
                color = '#00ff88'
                
            bar_height = height - 10 - random.randint(0, 10)
            y_start = (height - bar_height) // 2
            
            bar_id = self.vu_canvas.create_rectangle(
                x, y_start, x + bar_width, y_start + bar_height,
                fill=color, outline=''
            )
            self.level_bars.append(bar_id)
            
    def draw_progress_bar(self):
        """Draw progress bar"""
        self.progress_canvas.delete("all")
        width = self.progress_canvas.winfo_width() or 400
        height = 20
        
        # Background
        self.progress_canvas.create_rectangle(0, 8, width, 12,
                                             fill='#1a1f2e', outline='')
        
        # Progress
        if self.track_length > 0:
            progress = self.current_position / self.track_length
            self.progress_canvas.create_rectangle(0, 8, width * progress, 12,
                                                 fill='#00ff88', outline='')
            
        # Position indicator
        pos_x = width * (self.current_position / self.track_length)
        self.progress_canvas.create_oval(pos_x - 6, 4, pos_x + 6, 16,
                                        fill='white', outline='')
                                        
    def create_right_section(self, parent):
        """Create right section with controls"""
        right_frame = Frame(parent, bg='#0a0c10', width=200)
        right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(20, 0))
        right_frame.pack_propagate(False)
        
        # Control buttons container
        controls_frame = Frame(right_frame, bg='#0a0c10')
        controls_frame.pack(expand=True)
        
        # Previous button
        self.prev_btn = self.create_control_button(controls_frame, "⏮", 
                                                  self.previous_track)
        self.prev_btn.grid(row=0, column=0, padx=5, pady=5)
        
        # Play/Pause button (larger)
        self.play_btn = self.create_control_button(controls_frame, "⏸", 
                                                  self.toggle_play, 
                                                  size=60, active=True)
        self.play_btn.grid(row=0, column=1, padx=5, pady=5)
        
        # Next button
        self.next_btn = self.create_control_button(controls_frame, "⏭",
                                                  self.next_track)
        self.next_btn.grid(row=0, column=2, padx=5, pady=5)
        
    def create_control_button(self, parent, text, command, size=40, active=False):
        """Create circular control button"""
        btn_frame = Frame(parent, bg='#0a0c10')
        
        canvas = Canvas(btn_frame, width=size, height=size,
                       bg='#0a0c10', highlightthickness=0)
        canvas.pack()
        
        # Draw circle
        color = '#00ff88' if active else '#2a2f3e'
        text_color = '#0a0c10' if active else '#888'
        
        canvas.create_oval(2, 2, size-2, size-2, 
                          fill=color, outline='#00ff88' if active else '#444',
                          width=2)
        
        # Draw symbol
        canvas.create_text(size//2, size//2, text=text,
                          font=('Arial', size//3, 'bold'),
                          fill=text_color)
        
        # Bind click
        canvas.bind("<Button-1>", lambda e: command())
        
        return canvas
        
    def toggle_play(self):
        """Toggle play/pause"""
        if self.is_playing:
            if self.is_paused:
                pygame.mixer.music.unpause()
                self.is_paused = False
                self.update_play_button("⏸")
            else:
                pygame.mixer.music.pause()
                self.is_paused = True
                self.update_play_button("▶")
        else:
            # Start playing
            if self.current_track:
                file_path = self.current_track.get('file_path')
                if file_path and os.path.exists(file_path):
                    try:
                        pygame.mixer.music.load(file_path)
                        pygame.mixer.music.play()
                        self.is_playing = True
                        self.is_paused = False
                        self.update_play_button("⏸")
                    except:
                        # Simulate playing even if file doesn't exist
                        self.is_playing = True
                        self.is_paused = False
                        self.update_play_button("⏸")
                else:
                    # Simulate playing
                    self.is_playing = True
                    self.is_paused = False
                    self.update_play_button("⏸")
                    
    def update_play_button(self, symbol):
        """Update play button symbol"""
        self.play_btn.delete("all")
        size = 60
        self.play_btn.create_oval(2, 2, size-2, size-2,
                                 fill='#00ff88', outline='#00ff88', width=2)
        self.play_btn.create_text(size//2, size//2, text=symbol,
                                font=('Arial', size//3, 'bold'),
                                fill='#0a0c10')
                                
    def previous_track(self):
        """Go to previous track"""
        self.current_position = 0
        self.draw_progress_bar()
        
    def next_track(self):
        """Go to next track"""
        # Load next track from database
        if self.current_track:
            current_id = self.current_track.get('id', 0)
            self.cursor.execute("""
                SELECT * FROM audio_files 
                WHERE AI_BPM IS NOT NULL AND id > ?
                LIMIT 1
            """, (current_id,))
            
            track = self.cursor.fetchone()
            if track:
                self.current_track = dict(track)
                self.update_track_info()
                self.current_position = 0
                
    def update_track_info(self):
        """Update track information display"""
        if self.current_track:
            # Update title
            title = self.current_track.get('title', 'Unknown Track')
            self.title_label.config(text=title[:40])
            
            # Update metadata
            bpm = self.current_track.get('AI_BPM', '--')
            key = self.current_track.get('AI_KEY', '--')
            self.bpm_btn.config(text=f"{bpm} BPM")
            self.key_btn.config(text=key, fg='#00ff88')
            
    def interpolate_color(self, color1, color2, factor):
        """Interpolate between two colors"""
        # Convert hex to RGB
        c1 = tuple(int(color1[i:i+2], 16) for i in (1, 3, 5))
        c2 = tuple(int(color2[i:i+2], 16) for i in (1, 3, 5))
        
        # Interpolate
        r = int(c1[0] + (c2[0] - c1[0]) * factor)
        g = int(c1[1] + (c2[1] - c1[1]) * factor)
        b = int(c1[2] + (c2[2] - c1[2]) * factor)
        
        return f'#{r:02x}{g:02x}{b:02x}'
        
    def update_loop(self):
        """Update thread for animations"""
        while self.update_thread_running:
            if self.is_playing and not self.is_paused:
                # Update position
                self.current_position += 0.1
                if self.current_position > self.track_length:
                    self.current_position = 0
                    
                # Update time displays
                self.root.after(0, self.update_time_display)
                
                # Update VU meter
                self.root.after(0, self.draw_level_bars)
                
                # Update progress bar
                self.root.after(0, self.draw_progress_bar)
                
            time.sleep(0.1)
            
    def update_time_display(self):
        """Update time labels"""
        # Format current position
        mins = int(self.current_position // 60)
        secs = int(self.current_position % 60)
        self.time_elapsed.config(text=f"{mins}:{secs:02d}")
        
        # Format remaining time
        remaining = self.track_length - self.current_position
        mins = int(remaining // 60)
        secs = int(remaining % 60)
        self.time_remaining.config(text=f"{mins}:{secs:02d}")
        
    def __del__(self):
        self.update_thread_running = False
        if hasattr(self, 'conn'):
            self.conn.close()
        pygame.mixer.quit()


def main():
    # Check for PIL
    try:
        from PIL import Image
    except ImportError:
        os.system("pip install pillow")
        
    print("\n" + "="*60)
    print("🎵 THE RING - Professional Audio Player")
    print("VU Meter + Professional Design")
    print("="*60 + "\n")
    
    root = tk.Tk()
    app = ProfessionalAudioPlayer(root)
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        app.update_thread_running = False
        
if __name__ == "__main__":
    main()