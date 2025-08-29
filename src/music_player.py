#!/usr/bin/env python3
"""
Tidal-style Music Player Interface with Qt
"""

import sys
import os
from pathlib import Path
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QSlider, QListWidget, QScrollArea,
    QGridLayout, QFrame, QLineEdit, QStackedWidget, QListWidgetItem,
    QGraphicsDropShadowEffect, QSizePolicy, QSpacerItem, QFileDialog,
    QMessageBox
)
from PyQt6.QtCore import (
    Qt, QTimer, QPropertyAnimation, QEasingCurve,
    QSize, QRect, pyqtSignal, QPoint, QUrl,
    QParallelAnimationGroup, QSequentialAnimationGroup
)
from PyQt6.QtGui import (
    QPixmap, QPalette, QColor, QFont, QPainter,
    QLinearGradient, QBrush, QPen, QFontDatabase,
    QIcon, QCursor, QImage, QPainterPath
)
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
import random
from mutagen import File
from mutagen.id3 import ID3, APIC
from mutagen.mp4 import MP4
from mutagen.flac import FLAC
import base64


class AlbumCard(QFrame):
    """Album/Playlist card widget"""
    
    clicked = pyqtSignal(str)
    play_clicked = pyqtSignal(str)
    
    def __init__(self, title="Album Title", artist="Artist", album_id=None, artwork_pixmap=None):
        super().__init__()
        self.title = title
        self.artist = artist
        self.album_id = album_id or str(random.randint(1000, 9999))
        self.artwork_pixmap = artwork_pixmap
        self.init_ui()
        
    def init_ui(self):
        self.setFixedSize(200, 260)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setStyleSheet("""
            QFrame {
                background: transparent;
                border-radius: 8px;
            }
            QFrame:hover {
                background: rgba(255, 255, 255, 0.05);
            }
        """)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(8)
        
        # Album cover
        self.cover = QLabel()
        self.cover.setFixedSize(180, 180)
        self.cover.setStyleSheet("""
            QLabel {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 #2a2a2a, stop:1 #1a1a1a);
                border-radius: 4px;
            }
        """)
        self.cover.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.cover.setScaledContents(True)
        
        # Use provided artwork or generate default
        if self.artwork_pixmap:
            # Scale the artwork to fit
            scaled_pixmap = self.artwork_pixmap.scaled(
                180, 180, 
                Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                Qt.TransformationMode.SmoothTransformation
            )
            # Crop to square if needed
            if scaled_pixmap.width() > 180 or scaled_pixmap.height() > 180:
                x = (scaled_pixmap.width() - 180) // 2
                y = (scaled_pixmap.height() - 180) // 2
                scaled_pixmap = scaled_pixmap.copy(x, y, 180, 180)
            
            # Add rounded corners
            rounded_pixmap = QPixmap(180, 180)
            rounded_pixmap.fill(Qt.GlobalColor.transparent)
            painter = QPainter(rounded_pixmap)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)
            path = QPainterPath()
            path.addRoundedRect(0, 0, 180, 180, 4, 4)
            painter.setClipPath(path)
            painter.drawPixmap(0, 0, scaled_pixmap)
            painter.end()
            
            self.cover.setPixmap(rounded_pixmap)
        else:
            # Generate default gradient cover
            pixmap = QPixmap(180, 180)
            painter = QPainter(pixmap)
            gradient = QLinearGradient(0, 0, 180, 180)
            color1 = QColor(random.randint(50, 150), random.randint(50, 150), random.randint(50, 150))
            color2 = QColor(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200))
            gradient.setColorAt(0, color1)
            gradient.setColorAt(1, color2)
            painter.fillRect(pixmap.rect(), gradient)
            painter.end()
            self.cover.setPixmap(pixmap)
        
        # Title
        title_label = QLabel(self.title)
        title_label.setStyleSheet("""
            QLabel {
                color: #ffffff;
                font-size: 14px;
                font-weight: 600;
            }
        """)
        title_label.setWordWrap(True)
        title_label.setMaximumHeight(40)
        
        # Artist
        artist_label = QLabel(self.artist)
        artist_label.setStyleSheet("""
            QLabel {
                color: #b3b3b3;
                font-size: 12px;
            }
        """)
        
        layout.addWidget(self.cover)
        layout.addWidget(title_label)
        layout.addWidget(artist_label)
        layout.addStretch()
        
        self.setLayout(layout)
        
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(self.album_id)
            
    def enterEvent(self, event):
        # Add hover effect
        effect = QGraphicsDropShadowEffect()
        effect.setBlurRadius(20)
        effect.setColor(QColor(0, 0, 0, 100))
        effect.setOffset(0, 5)
        self.setGraphicsEffect(effect)
        
    def leaveEvent(self, event):
        self.setGraphicsEffect(None)


class SidebarButton(QPushButton):
    """Custom sidebar navigation button"""
    
    def __init__(self, text, icon=None):
        super().__init__(text)
        self.setCheckable(True)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #b3b3b3;
                border: none;
                padding: 12px 20px;
                text-align: left;
                font-size: 14px;
                font-weight: 500;
            }
            QPushButton:hover {
                color: #ffffff;
                background: rgba(255, 255, 255, 0.05);
            }
            QPushButton:checked {
                color: #ffffff;
                background: rgba(255, 255, 255, 0.1);
                border-left: 3px solid #00d4aa;
            }
        """)


class PlayerBar(QWidget):
    """Bottom player bar like Tidal"""
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        
    def init_ui(self):
        self.setFixedHeight(90)
        self.setStyleSheet("""
            QWidget {
                background: #0a0a0a;
                border-top: 1px solid #282828;
            }
        """)
        
        main_layout = QHBoxLayout()
        main_layout.setContentsMargins(20, 10, 20, 10)
        
        # Left section - Current track info
        left_section = QWidget()
        left_layout = QHBoxLayout()
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        # Album art
        self.album_art = QLabel()
        self.album_art.setFixedSize(70, 70)
        self.album_art.setStyleSheet("""
            QLabel {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 #3a3a3a, stop:1 #2a2a2a);
                border-radius: 4px;
            }
        """)
        
        # Track info
        track_info = QWidget()
        track_layout = QVBoxLayout()
        track_layout.setContentsMargins(10, 0, 0, 0)
        track_layout.setSpacing(2)
        
        self.track_title = QLabel("No track playing")
        self.track_title.setStyleSheet("""
            QLabel {
                color: #ffffff;
                font-size: 14px;
                font-weight: 500;
            }
        """)
        
        self.track_artist = QLabel("")
        self.track_artist.setStyleSheet("""
            QLabel {
                color: #b3b3b3;
                font-size: 12px;
            }
        """)
        
        track_layout.addWidget(self.track_title)
        track_layout.addWidget(self.track_artist)
        track_info.setLayout(track_layout)
        
        # Heart button
        self.heart_btn = QPushButton("♡")
        self.heart_btn.setFixedSize(32, 32)
        self.heart_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.heart_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #b3b3b3;
                border: none;
                font-size: 20px;
            }
            QPushButton:hover {
                color: #ffffff;
            }
        """)
        
        left_layout.addWidget(self.album_art)
        left_layout.addWidget(track_info)
        left_layout.addWidget(self.heart_btn)
        left_layout.addStretch()
        left_section.setLayout(left_layout)
        left_section.setMaximumWidth(400)
        
        # Center section - Player controls
        center_section = QWidget()
        center_layout = QVBoxLayout()
        center_layout.setContentsMargins(0, 0, 0, 0)
        center_layout.setSpacing(8)
        
        # Control buttons
        controls_layout = QHBoxLayout()
        controls_layout.setSpacing(20)
        
        self.shuffle_btn = self.create_control_button("⤨", size=28)
        self.prev_btn = self.create_control_button("⏮", size=32)
        self.play_btn = self.create_control_button("▶", size=40, primary=True)
        self.next_btn = self.create_control_button("⏭", size=32)
        self.repeat_btn = self.create_control_button("🔁", size=28)
        
        controls_layout.addStretch()
        controls_layout.addWidget(self.shuffle_btn)
        controls_layout.addWidget(self.prev_btn)
        controls_layout.addWidget(self.play_btn)
        controls_layout.addWidget(self.next_btn)
        controls_layout.addWidget(self.repeat_btn)
        controls_layout.addStretch()
        
        # Progress bar
        progress_layout = QHBoxLayout()
        progress_layout.setSpacing(10)
        
        self.time_current = QLabel("0:00")
        self.time_current.setStyleSheet("color: #b3b3b3; font-size: 11px;")
        
        self.progress_slider = QSlider(Qt.Orientation.Horizontal)
        self.progress_slider.setStyleSheet("""
            QSlider::groove:horizontal {
                height: 4px;
                background: #404040;
                border-radius: 2px;
            }
            QSlider::handle:horizontal {
                background: #ffffff;
                width: 12px;
                height: 12px;
                border-radius: 6px;
                margin: -4px 0;
            }
            QSlider::sub-page:horizontal {
                background: #00d4aa;
                border-radius: 2px;
            }
        """)
        
        self.time_total = QLabel("0:00")
        self.time_total.setStyleSheet("color: #b3b3b3; font-size: 11px;")
        
        progress_layout.addWidget(self.time_current)
        progress_layout.addWidget(self.progress_slider)
        progress_layout.addWidget(self.time_total)
        
        center_layout.addLayout(controls_layout)
        center_layout.addLayout(progress_layout)
        center_section.setLayout(center_layout)
        
        # Right section - Volume and extras
        right_section = QWidget()
        right_layout = QHBoxLayout()
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(15)
        
        self.queue_btn = self.create_control_button("☰", size=24)
        self.devices_btn = self.create_control_button("🖥", size=24)
        
        # Volume
        volume_layout = QHBoxLayout()
        volume_layout.setSpacing(5)
        
        self.volume_icon = QLabel("🔊")
        self.volume_icon.setStyleSheet("color: #b3b3b3; font-size: 16px;")
        
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setMaximumWidth(100)
        self.volume_slider.setValue(70)
        self.volume_slider.setStyleSheet("""
            QSlider::groove:horizontal {
                height: 4px;
                background: #404040;
                border-radius: 2px;
            }
            QSlider::handle:horizontal {
                background: #ffffff;
                width: 10px;
                height: 10px;
                border-radius: 5px;
                margin: -3px 0;
            }
            QSlider::sub-page:horizontal {
                background: #ffffff;
                border-radius: 2px;
            }
        """)
        
        volume_layout.addWidget(self.volume_icon)
        volume_layout.addWidget(self.volume_slider)
        
        right_layout.addStretch()
        right_layout.addWidget(self.queue_btn)
        right_layout.addWidget(self.devices_btn)
        right_layout.addLayout(volume_layout)
        right_section.setLayout(right_layout)
        right_section.setMaximumWidth(300)
        
        # Add all sections
        main_layout.addWidget(left_section)
        main_layout.addWidget(center_section, 1)
        main_layout.addWidget(right_section)
        
        self.setLayout(main_layout)
        
    def create_control_button(self, text, size=32, primary=False):
        btn = QPushButton(text)
        btn.setFixedSize(size, size)
        btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        
        if primary:
            btn.setStyleSheet(f"""
                QPushButton {{
                    background: #00d4aa;
                    color: #000000;
                    border: none;
                    border-radius: {size//2}px;
                    font-size: {size//2}px;
                }}
                QPushButton:hover {{
                    background: #00e8bb;
                }}
                QPushButton:pressed {{
                    background: #00b899;
                }}
            """)
        else:
            btn.setStyleSheet(f"""
                QPushButton {{
                    background: transparent;
                    color: #b3b3b3;
                    border: none;
                    font-size: {size//2}px;
                }}
                QPushButton:hover {{
                    color: #ffffff;
                }}
            """)
        
        return btn


class MusicPlayerWindow(QMainWindow):
    """Main music player window with modern dark theme"""
    
    def __init__(self):
        super().__init__()
        self.loaded_files = []  # Store loaded audio files
        self.album_cards = []  # Store album card references
        self.init_ui()
        self.apply_dark_theme()
        
    def init_ui(self):
        self.setWindowTitle("Music Player Pro")
        self.setGeometry(100, 100, 1400, 900)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Top section (sidebar + main content)
        top_widget = QWidget()
        top_layout = QHBoxLayout(top_widget)
        top_layout.setContentsMargins(0, 0, 0, 0)
        top_layout.setSpacing(0)
        
        # Sidebar
        sidebar = QWidget()
        sidebar.setFixedWidth(240)
        sidebar.setStyleSheet("""
            QWidget {
                background: #000000;
                border-right: 1px solid #282828;
            }
        """)
        
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(0)
        
        # Logo
        logo = QLabel("MUSIC PRO")
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo.setStyleSheet("""
            QLabel {
                color: #ffffff;
                font-size: 24px;
                font-weight: bold;
                padding: 20px;
                letter-spacing: 2px;
            }
        """)
        sidebar_layout.addWidget(logo)
        
        # Search bar
        search_bar = QLineEdit()
        search_bar.setPlaceholderText("Search")
        search_bar.setStyleSheet("""
            QLineEdit {
                background: #1a1a1a;
                border: 1px solid #333333;
                border-radius: 20px;
                padding: 10px 15px;
                color: #ffffff;
                font-size: 14px;
                margin: 10px 15px;
            }
            QLineEdit:focus {
                border: 1px solid #00d4aa;
            }
        """)
        sidebar_layout.addWidget(search_bar)
        
        # Navigation
        nav_section = QWidget()
        nav_layout = QVBoxLayout(nav_section)
        nav_layout.setContentsMargins(0, 20, 0, 0)
        nav_layout.setSpacing(0)
        
        home_btn = SidebarButton("Home")
        home_btn.setChecked(True)
        explore_btn = SidebarButton("Explore")
        videos_btn = SidebarButton("Videos")
        
        nav_layout.addWidget(home_btn)
        nav_layout.addWidget(explore_btn)
        nav_layout.addWidget(videos_btn)
        
        # My Collection
        collection_label = QLabel("MY COLLECTION")
        collection_label.setStyleSheet("""
            QLabel {
                color: #808080;
                font-size: 11px;
                font-weight: 600;
                padding: 20px 20px 10px 20px;
                letter-spacing: 1px;
            }
        """)
        nav_layout.addWidget(collection_label)
        
        my_mix_btn = SidebarButton("My Mix")
        favorites_btn = SidebarButton("Favorite Tracks")
        playlists_btn = SidebarButton("Playlists")
        albums_btn = SidebarButton("Albums")
        artists_btn = SidebarButton("Artists")
        
        nav_layout.addWidget(my_mix_btn)
        nav_layout.addWidget(favorites_btn)
        nav_layout.addWidget(playlists_btn)
        nav_layout.addWidget(albums_btn)
        nav_layout.addWidget(artists_btn)
        
        sidebar_layout.addWidget(nav_section)
        sidebar_layout.addStretch()
        
        # Main content area
        content_area = QWidget()
        content_area.setStyleSheet("""
            QWidget {
                background: #121212;
            }
        """)
        
        content_layout = QVBoxLayout(content_area)
        content_layout.setContentsMargins(30, 30, 30, 30)
        content_layout.setSpacing(30)
        
        # Header
        header = QWidget()
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 0)
        
        # Page title
        page_title = QLabel("Home")
        page_title.setStyleSheet("""
            QLabel {
                color: #ffffff;
                font-size: 32px;
                font-weight: bold;
            }
        """)
        
        # User profile
        profile_btn = QPushButton("👤")
        profile_btn.setFixedSize(40, 40)
        profile_btn.setStyleSheet("""
            QPushButton {
                background: #282828;
                border-radius: 20px;
                color: #ffffff;
                font-size: 20px;
            }
            QPushButton:hover {
                background: #404040;
            }
        """)
        profile_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        
        # Add files button
        add_files_btn = QPushButton("+ Add Files")
        add_files_btn.setFixedHeight(40)
        add_files_btn.setStyleSheet("""
            QPushButton {
                background: #00d4aa;
                color: #000000;
                border-radius: 20px;
                padding: 0 20px;
                font-size: 14px;
                font-weight: 600;
            }
            QPushButton:hover {
                background: #00e8bb;
            }
            QPushButton:pressed {
                background: #00b899;
            }
        """)
        add_files_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        add_files_btn.clicked.connect(self.add_audio_files)
        
        header_layout.addWidget(page_title)
        header_layout.addStretch()
        header_layout.addWidget(add_files_btn)
        header_layout.addWidget(profile_btn)
        
        content_layout.addWidget(header)
        
        # Scrollable content
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("""
            QScrollArea {
                background: transparent;
                border: none;
            }
            QScrollBar:vertical {
                background: #1a1a1a;
                width: 12px;
                border-radius: 6px;
            }
            QScrollBar::handle:vertical {
                background: #404040;
                border-radius: 6px;
                min-height: 30px;
            }
            QScrollBar::handle:vertical:hover {
                background: #606060;
            }
        """)
        
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        scroll_layout.setSpacing(40)
        
        # My Library section (for loaded files)
        self.library_section = self.create_section("My Library", is_library=True)
        scroll_layout.addWidget(self.library_section)
        
        # Featured section
        featured_section = self.create_section("Featured New Releases")
        scroll_layout.addWidget(featured_section)
        
        # Recommended section
        recommended_section = self.create_section("Recommended For You")
        scroll_layout.addWidget(recommended_section)
        
        # Popular section
        popular_section = self.create_section("Popular Albums")
        scroll_layout.addWidget(popular_section)
        
        # Recently played section
        recent_section = self.create_section("Recently Played")
        scroll_layout.addWidget(recent_section)
        
        scroll_area.setWidget(scroll_content)
        content_layout.addWidget(scroll_area)
        
        # Add sidebar and content to top layout
        top_layout.addWidget(sidebar)
        top_layout.addWidget(content_area, 1)
        
        # Player bar
        player_bar = PlayerBar()
        
        # Add to main layout
        main_layout.addWidget(top_widget, 1)
        main_layout.addWidget(player_bar)
        
    def create_section(self, title, is_library=False):
        """Create a section with album cards"""
        section = QWidget()
        layout = QVBoxLayout(section)
        layout.setSpacing(20)
        
        # Section title
        title_label = QLabel(title)
        title_label.setStyleSheet("""
            QLabel {
                color: #ffffff;
                font-size: 22px;
                font-weight: 600;
            }
        """)
        layout.addWidget(title_label)
        
        # Album grid
        grid_widget = QWidget()
        grid_layout = QHBoxLayout(grid_widget)
        grid_layout.setSpacing(20)
        grid_layout.setAlignment(Qt.AlignmentFlag.AlignLeft)
        
        if is_library:
            # Store reference to library grid for adding loaded files
            self.library_grid = grid_layout
            
            # Show placeholder if no files loaded
            if not self.loaded_files:
                placeholder = QLabel("No audio files loaded. Click '+ Add Files' to import your music.")
                placeholder.setStyleSheet("""
                    QLabel {
                        color: #808080;
                        font-size: 14px;
                        padding: 40px;
                    }
                """)
                grid_layout.addWidget(placeholder)
                self.library_placeholder = placeholder
        else:
            # Add sample albums for other sections
            albums = [
                ("Album " + str(i+1), "Artist " + str(i+1))
                for i in range(6)
            ]
            
            for album_title, artist in albums:
                card = AlbumCard(album_title, artist)
                grid_layout.addWidget(card)
        
        # Add stretch to prevent cards from expanding
        grid_layout.addStretch()
        
        layout.addWidget(grid_widget)
        
        return section
        
    def add_audio_files(self):
        """Open file dialog to add audio files to library"""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Audio Files",
            "",
            "Audio Files (*.mp3 *.wav *.flac *.m4a *.ogg *.aac *.wma *.opus);;All Files (*.*)"
        )
        
        if files:
            # Remove placeholder if it exists
            if hasattr(self, 'library_placeholder'):
                self.library_placeholder.setParent(None)
                self.library_placeholder.deleteLater()
                delattr(self, 'library_placeholder')
            
            for file_path in files:
                if file_path not in self.loaded_files:
                    self.loaded_files.append(file_path)
                    self.add_file_to_library(file_path)
            
            # Show success message
            QMessageBox.information(
                self,
                "Files Added",
                f"Successfully added {len(files)} audio file(s) to your library."
            )
    
    def add_file_to_library(self, file_path):
        """Add a single file to the library display with artwork extraction"""
        # Extract metadata and artwork
        metadata = self.extract_audio_metadata(file_path)
        
        # Create album card with extracted artwork
        card = AlbumCard(
            title=metadata['title'],
            artist=metadata['artist'],
            album_id=file_path,
            artwork_pixmap=metadata.get('artwork_pixmap')
        )
        card.clicked.connect(self.play_file)
        
        # Remove stretch temporarily
        stretch_index = self.library_grid.count() - 1
        stretch_item = self.library_grid.takeAt(stretch_index)
        
        # Add card to library grid
        self.library_grid.addWidget(card)
        self.album_cards.append(card)
        
        # Add stretch back
        if stretch_item:
            self.library_grid.addItem(stretch_item)
    
    def extract_audio_metadata(self, file_path):
        """Extract metadata and artwork from audio file"""
        metadata = {
            'title': Path(file_path).stem,
            'artist': 'Unknown Artist',
            'album': 'Unknown Album',
            'artwork_pixmap': None
        }
        
        try:
            audio_file = File(file_path)
            
            if audio_file is not None:
                # Extract title
                if 'TIT2' in audio_file:
                    metadata['title'] = str(audio_file['TIT2'].text[0])
                elif 'Title' in audio_file:
                    metadata['title'] = str(audio_file['Title'][0])
                elif '\xa9nam' in audio_file:
                    metadata['title'] = str(audio_file['\xa9nam'][0])
                    
                # Extract artist
                if 'TPE1' in audio_file:
                    metadata['artist'] = str(audio_file['TPE1'].text[0])
                elif 'Artist' in audio_file:
                    metadata['artist'] = str(audio_file['Artist'][0])
                elif '\xa9ART' in audio_file:
                    metadata['artist'] = str(audio_file['\xa9ART'][0])
                    
                # Extract album
                if 'TALB' in audio_file:
                    metadata['album'] = str(audio_file['TALB'].text[0])
                elif 'Album' in audio_file:
                    metadata['album'] = str(audio_file['Album'][0])
                elif '\xa9alb' in audio_file:
                    metadata['album'] = str(audio_file['\xa9alb'][0])
                
                # Extract artwork
                artwork_data = None
                
                # Try different methods based on file type
                if file_path.lower().endswith('.mp3'):
                    # MP3 files - check for APIC frames
                    if 'APIC:' in audio_file:
                        artwork_data = bytes(audio_file['APIC:'].data)
                    else:
                        for key in audio_file.keys():
                            if key.startswith('APIC'):
                                artwork_data = bytes(audio_file[key].data)
                                break
                                
                elif file_path.lower().endswith(('.m4a', '.mp4')):
                    # MP4/M4A files
                    if 'covr' in audio_file:
                        covers = audio_file['covr']
                        if covers:
                            artwork_data = bytes(covers[0])
                            
                elif file_path.lower().endswith('.flac'):
                    # FLAC files
                    if hasattr(audio_file, 'pictures') and audio_file.pictures:
                        artwork_data = bytes(audio_file.pictures[0].data)
                        
                elif file_path.lower().endswith('.ogg'):
                    # OGG Vorbis
                    if 'metadata_block_picture' in audio_file:
                        from mutagen.flac import Picture
                        data = base64.b64decode(audio_file['metadata_block_picture'][0])
                        picture = Picture(data)
                        artwork_data = bytes(picture.data)
                
                # Convert artwork to QPixmap if found
                if artwork_data:
                    image = QImage()
                    image.loadFromData(artwork_data)
                    if not image.isNull():
                        metadata['artwork_pixmap'] = QPixmap.fromImage(image)
                        
        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")
        
        # Fallback to filename parsing if no metadata
        if metadata['title'] == Path(file_path).stem:
            filename = Path(file_path).stem
            if ' - ' in filename:
                parts = filename.split(' - ', 1)
                metadata['artist'] = parts[0].strip()
                metadata['title'] = parts[1].strip()
        
        return metadata
    
    def play_file(self, file_path):
        """Play the selected audio file"""
        # This is a placeholder for actual playback functionality
        print(f"Playing: {file_path}")
        # In a real implementation, you would:
        # 1. Initialize QMediaPlayer
        # 2. Set the audio source
        # 3. Update the player bar with track info
        # 4. Start playback
        
    def apply_dark_theme(self):
        """Apply modern dark theme"""
        self.setStyleSheet("""
            QMainWindow {
                background: #121212;
            }
            QWidget {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            QLabel {
                background: transparent;
            }
            QPushButton {
                background: transparent;
                border: none;
            }
        """)


def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    
    # Set application info
    app.setApplicationName("Music Player Pro")
    app.setOrganizationName("MusicApp")
    
    # Create and show main window
    window = MusicPlayerWindow()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()