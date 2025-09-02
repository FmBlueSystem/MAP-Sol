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
    QMessageBox, QDialog, QCheckBox, QSpinBox, QFormLayout
)
from PyQt6.QtCore import (
    Qt, QTimer, QPropertyAnimation, QEasingCurve,
    QSize, QRect, pyqtSignal, QPoint, QUrl, QThread,
    QParallelAnimationGroup, QSequentialAnimationGroup,
    QByteArray, QBuffer, QIODevice
)
from PyQt6.QtGui import (
    QPixmap, QPalette, QColor, QFont, QPainter,
    QLinearGradient, QBrush, QPen, QFontDatabase,
    QIcon, QCursor, QImage, QPainterPath, QShortcut, QKeySequence
)
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
try:
    from PyQt6.QtMultimedia import QAudioProbe, QAudioFormat
    HAS_AUDIO_PROBE = True
except ImportError:
    HAS_AUDIO_PROBE = False
import threading
import random
import math
from mutagen import File
from mutagen.id3 import ID3, APIC
from mutagen.mp4 import MP4
from mutagen.flac import FLAC
import base64
from database import MusicDatabase
from hamms_analyzer import HAMMSAnalyzer
# USE MIXEDINKEY DATA WHEN AVAILABLE - ONLY CALCULATE IF MISSING
from audio_analyzer_unified import UnifiedAudioAnalyzer
from metadata_extractor import MetadataExtractor
from utils.constants import AUDIO_FILE_FILTER, SUPPORTED_AUDIO_EXTS
from utils.db_writer import DBWriteWorker
from utils.config import get_config
import heapq
from ui.styles.theme import apply_global_theme, PALETTE
from utils.logger import setup_logger
from playlist_generation.playlist_exporter import PlaylistExporter
from ui.vu_meter import VUMeterWidget

logger = setup_logger(__name__)
logger.info("Using MixedInKey-aware analyzer - professional data first; AI only when needed")


class ImportAnalysisWorker(QThread):
    finished = pyqtSignal(dict)

    def __init__(self, file_path: str, base_metadata: dict, db_path):
        super().__init__()
        self.file_path = file_path
        self.base_metadata = base_metadata
        self.db_path = db_path
        self._cancel = False

    def request_cancel(self):
        self._cancel = True

    def run(self):
        try:
            analyzer = UnifiedAudioAnalyzer()
            hamms = HAMMSAnalyzer()
            features = analyzer.analyze_file(self.file_path, self.base_metadata)
            if self._cancel:
                self.finished.emit({'file_path': self.file_path, 'features': {}, 'vector': None})
                return
            combined = dict(self.base_metadata)
            combined.update(features)
            vector = hamms.calculate_extended_vector(combined)
            self.finished.emit({'file_path': self.file_path, 'features': features, 'vector': vector.tolist()})
        except Exception as e:
            logger.error(f"Background analysis error: {e}")
            self.finished.emit(self.base_metadata)


class BatchAnalysisWorker(QThread):
    progress = pyqtSignal(int)
    total = pyqtSignal(int)
    finished = pyqtSignal(int, int)  # analyzed, skipped
    item_ready = pyqtSignal(str, dict, list)  # file_path, features, vector12

    def __init__(self, file_paths: list[str], db_path):
        super().__init__()
        self.file_paths = file_paths
        self.db_path = db_path
        self._cancel = False

    def request_cancel(self):
        self._cancel = True

    def run(self):
        analyzed = 0
        skipped = 0
        try:
            hamms = HAMMSAnalyzer()
            analyzer = UnifiedAudioAnalyzer()
            self.total.emit(len(self.file_paths))
            for i, path in enumerate(self.file_paths):
                self.progress.emit(i)
                if self._cancel:
                    break
                try:
                    md = MetadataExtractor.extract_metadata(path, with_pixmap=False)
                    features = analyzer.analyze_file(path, md)
                    vector = hamms.calculate_extended_vector({**md, **features})
                    self.item_ready.emit(path, features, vector.tolist())
                    analyzed += 1
                except Exception:
                    skipped += 1
                    continue
            hamms.close()
        except Exception as e:
            logger.error(f"Batch analysis error: {e}")
        finally:
            self.finished.emit(analyzed, skipped)


class AnalyzeAIWorker(QThread):
    """Analyze audio features (AI/librosa) and update DB (no HAMMS compute)."""
    finished = pyqtSignal(dict)
    progress = pyqtSignal(int)

    def __init__(self, file_path: str, db_path: str):
        super().__init__()
        self.file_path = file_path
        self.db_path = db_path
        self._cancel = False

    def request_cancel(self):
        self._cancel = True

    def run(self):
        try:
            md = MetadataExtractor.extract_metadata(self.file_path, with_pixmap=False)
            if self._cancel:
                return
            analyzer = UnifiedAudioAnalyzer()
            self.progress.emit(50)
            features = analyzer.analyze_file(self.file_path, md)
            if self._cancel:
                return
            from database import MusicDatabase as _DB
            db = _DB(db_path=self.db_path)
            track = db.get_track_by_path(self.file_path)
            if track:
                db.update_track_features(track['id'], features)
            db.close()
            self.progress.emit(100)
            self.finished.emit(features)
        except Exception as e:
            logger.error(f"AnalyzeAIWorker error: {e}")
            self.finished.emit({})


class RecalcHammsWorker(QThread):
    """Recalculate HAMMS vector for a track and save to DB."""
    finished = pyqtSignal(dict)
    progress = pyqtSignal(int)

    def __init__(self, file_path: str, db_path: str):
        super().__init__()
        self.file_path = file_path
        self.db_path = db_path
        self._cancel = False

    def request_cancel(self):
        self._cancel = True

    def run(self):
        try:
            md = MetadataExtractor.extract_metadata(self.file_path, with_pixmap=False)
            if self._cancel:
                return
            analyzer = UnifiedAudioAnalyzer()
            self.progress.emit(40)
            audio_features = analyzer.analyze_file(self.file_path, md)
            combined = dict(md)
            combined.update(audio_features)
            if self._cancel:
                return
            hamms = HAMMSAnalyzer()
            vector = hamms.calculate_extended_vector(combined)
            from database import MusicDatabase as _DB
            db = _DB(db_path=self.db_path)
            track = db.get_track_by_path(self.file_path)
            if track:
                hamms_metadata = {
                    'tempo_stability': audio_features.get('tempo_stability', 0.7),
                    'harmonic_complexity': audio_features.get('harmonic_complexity', 0.5),
                    'dynamic_range': audio_features.get('dynamic_range', 0.5),
                    'energy_curve': audio_features.get('energy_curve', []),
                    'transition_points': audio_features.get('transition_points', []),
                    'genre_cluster': 0,
                    'ml_confidence': 0.95
                }
                hamms.save_hamms_analysis(track['id'], vector, hamms_metadata)
                combined['id'] = track['id']
            db.close()
            self.progress.emit(100)
            self.finished.emit(combined)
        except Exception as e:
            logger.error(f"RecalcHammsWorker error: {e}")
            self.finished.emit({})


class AlbumCard(QFrame):
    """Album/Playlist card widget"""
    
    clicked = pyqtSignal(str)
    play_clicked = pyqtSignal(str)
    
    def __init__(self, title="Album Title", artist="Artist", album_id=None, artwork_pixmap=None, 
                 bpm=None, key=None, energy=None):
        super().__init__()
        self.title = title
        self.artist = artist
        self.album_id = album_id or str(random.randint(1000, 9999))
        self.artwork_pixmap = artwork_pixmap
        self.bpm = bpm
        self.key = key
        self.energy = energy
        self.hamms_label = None
        self._layout = None
        self._update_chip = None
        self._status_chip = None
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
        self._layout = layout
        
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
        
        # HAMMS info (BPM, Key, Energy)
        if self.bpm or self.key or self.energy:
            hamms_info = []
            if self.bpm:
                hamms_info.append(f"{self.bpm:.0f} BPM")
            if self.key:
                hamms_info.append(f"{self.key}")
            if self.energy:
                energy_level = int(self.energy * 10) if isinstance(self.energy, float) else self.energy
                hamms_info.append(f"E{energy_level}")
            
            hamms_label = QLabel(" • ".join(hamms_info))
            hamms_label.setStyleSheet("""
                QLabel {
                    color: #00d4aa;
                    font-size: 10px;
                    font-weight: 500;
                }
            """)
            self.hamms_label = hamms_label
            layout.addWidget(self.cover)
            layout.addWidget(title_label)
            layout.addWidget(artist_label)
            layout.addWidget(hamms_label)
        else:
            layout.addWidget(self.cover)
            layout.addWidget(title_label)
            layout.addWidget(artist_label)
        
        layout.addStretch()
        
        self.setLayout(layout)

    def set_badges(self, bpm=None, key=None, energy=None):
        """Update or create the HAMMS badges for this card."""
        try:
            if bpm is not None:
                self.bpm = float(bpm)
            if key is not None:
                self.key = str(key)
            if energy is not None:
                self.energy = float(energy)
            if not (self.bpm or self.key or self.energy):
                # Nothing to show
                if self.hamms_label:
                    self.hamms_label.hide()
                return
            info = []
            if self.bpm is not None:
                info.append(f"{self.bpm:.0f} BPM")
            if self.key:
                info.append(f"{self.key}")
            if self.energy is not None:
                lvl = int(self.energy * 10) if isinstance(self.energy, float) else int(self.energy)
                info.append(f"E{lvl}")
            text = " • ".join(info)
            if self.hamms_label is None:
                self.hamms_label = QLabel(text)
                self.hamms_label.setStyleSheet("""
                    QLabel { color: #00d4aa; font-size: 10px; font-weight: 500; }
                """)
                if self._layout:
                    self._layout.addWidget(self.hamms_label)
                else:
                    self.layout().addWidget(self.hamms_label)
            else:
                self.hamms_label.setText(text)
                self.hamms_label.show()
        except Exception:
            pass

    def flash_update(self, text: str = "Updated"):
        """Show a small temporary indicator below the badges."""
        try:
            if self._update_chip:
                self._update_chip.hide()
                self._update_chip.deleteLater()
            from PyQt6.QtWidgets import QLabel
            chip = QLabel(f"✓ {text}", self)
            chip.setStyleSheet("""
                QLabel {
                    background: #00d4aa;
                    color: #000000;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: 600;
                }
            """)
            # Place chip near bottom-left inside the card
            chip.adjustSize()
            chip.move(10, self.height() - chip.height() - 10)
            chip.show()
            self._update_chip = chip
            QTimer.singleShot(1400, lambda: (chip.hide(), chip.deleteLater(), setattr(self, '_update_chip', None)))
        except Exception:
            pass

    def set_status(self, status: str | None):
        """Show or hide a small status badge on the top-left (e.g., 'Queued', 'Analyzing…')."""
        try:
            from PyQt6.QtWidgets import QLabel
            if status is None or status == "":
                if self._status_chip:
                    self._status_chip.hide()
                    self._status_chip.deleteLater()
                    self._status_chip = None
                return
            if not self._status_chip:
                self._status_chip = QLabel(self)
                self._status_chip.setStyleSheet("""
                    QLabel { background: rgba(0, 0, 0, 160); color: #ffffff; padding: 2px 6px; border-radius: 8px; font-size: 10px; }
                """)
            self._status_chip.setText(status)
            self._status_chip.adjustSize()
            self._status_chip.move(8, 8)
            self._status_chip.show()
        except Exception:
            pass
        
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(self.album_id)
        elif event.button() == Qt.MouseButton.RightButton:
            self.show_context_menu(event.pos())
            
    def enterEvent(self, event):
        # Add hover effect
        effect = QGraphicsDropShadowEffect()
        effect.setBlurRadius(20)
        effect.setColor(QColor(0, 0, 0, 100))
        effect.setOffset(0, 5)
        self.setGraphicsEffect(effect)
        
    def leaveEvent(self, event):
        self.setGraphicsEffect(None)
    
    def show_context_menu(self, pos):
        """Show context menu on right click"""
        from PyQt6.QtWidgets import QMenu, QApplication
        from PyQt6.QtGui import QAction

        # Find the main window safely (prefer window())
        main_window = self.window() if isinstance(self.window(), QMainWindow) else None
        if not main_window:
            widget = self
            while widget:
                if isinstance(widget, QMainWindow):
                    main_window = widget
                    break
                widget = widget.parent()
        if not main_window:
            for window in QApplication.topLevelWidgets():
                if isinstance(window, QMainWindow):
                    main_window = window
                    break
        if not main_window:
            logger.warning("Could not find main window for context menu")
            return

        # Use global theme (avoid inline QSS duplication)
        menu = QMenu(self)

        # Store references to avoid lambda issues
        file_path = self.album_id

        # Recalculate HAMMS action
        recalc_hamms = QAction("Recalculate HAMMS Vector", self)
        recalc_hamms.triggered.connect(lambda: main_window.recalculate_hamms_async(file_path, source_card=self))
        menu.addAction(recalc_hamms)

        # Analyze with AI action
        analyze_ai = QAction("Analyze with AI (librosa)", self)
        analyze_ai.triggered.connect(lambda: main_window.analyze_with_ai_async(file_path, source_card=self))
        menu.addAction(analyze_ai)

        # Check MixedInKey data action
        check_mik = QAction("Check MixedInKey Data", self)
        check_mik.triggered.connect(lambda: main_window.check_mixedinkey_data(file_path))
        menu.addAction(check_mik)

        menu.addSeparator()

        # Set custom artwork
        set_art = QAction("Set Custom Artwork...", self)
        set_art.triggered.connect(lambda: main_window.set_custom_artwork(file_path))
        menu.addAction(set_art)

        # Extract embedded artwork
        extract_art = QAction("Extract Artwork from Audio", self)
        extract_art.triggered.connect(lambda: main_window.extract_artwork_from_audio(file_path))
        menu.addAction(extract_art)

        # Full reanalysis action
        full_analysis = QAction("Full Reanalysis (All Features)", self)
        full_analysis.triggered.connect(lambda: main_window.full_reanalysis_async(file_path, source_card=self))
        menu.addAction(full_analysis)

        menu.addSeparator()

        # Show metadata action
        show_metadata = QAction("Show All Metadata", self)
        show_metadata.triggered.connect(lambda: main_window.show_track_metadata(file_path))
        menu.addAction(show_metadata)

        menu.exec(self.mapToGlobal(pos))


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
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent_window = parent
        self.init_ui()
        
    def init_ui(self):
        # Increase height a bit so all controls fit comfortably
        self.setFixedHeight(110)
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
        # Keep left section compact to leave room for center controls
        left_section.setMaximumWidth(360)
        
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
        self.mix_btn = self.create_control_button("✨", size=28)
        self.mix_btn.setToolTip("Next Compatible (HAMMS)")
        self.repeat_btn = self.create_control_button("🔁", size=28)
        
        controls_layout.addStretch()
        controls_layout.addWidget(self.shuffle_btn)
        controls_layout.addWidget(self.prev_btn)
        controls_layout.addWidget(self.play_btn)
        controls_layout.addWidget(self.next_btn)
        controls_layout.addWidget(self.mix_btn)
        controls_layout.addWidget(self.repeat_btn)
        controls_layout.addStretch()
        
        # Progress bar
        progress_layout = QHBoxLayout()
        progress_layout.setSpacing(12)
        
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
        
        # VU Meter - auto height based on DPI to show both L and R channels
        self.vu_meter = VUMeterWidget()
        try:
            from PyQt6.QtGui import QGuiApplication
            scr = self.window().windowHandle().screen() if self.windowHandle() else QGuiApplication.primaryScreen()
            dpi = float(getattr(scr, 'logicalDotsPerInch', lambda: 96.0)()) if scr else 96.0
            scale = max(0.9, min(2.0, dpi / 96.0))
        except Exception:
            scale = 1.0
        desired_h = int(60 * scale)
        self.vu_meter.setMinimumHeight(max(54, desired_h))
        self.vu_meter.setMaximumHeight(max(64, desired_h + 8))
        self.vu_meter.setFixedHeight(max(54, desired_h))
        
        center_layout.addLayout(controls_layout)
        center_layout.addLayout(progress_layout)
        center_layout.addWidget(self.vu_meter)
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
        self.volume_slider.setMaximumWidth(90)
        self.volume_slider.setMaximum(100)
        self.volume_slider.setValue(50)  # 50% default volume
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
        right_section.setMaximumWidth(260)
        
        # Add all sections and set stretch so the center grows most
        main_layout.addWidget(left_section)
        main_layout.addWidget(center_section)
        main_layout.addWidget(right_section)
        main_layout.setStretch(0, 2)
        main_layout.setStretch(1, 6)
        main_layout.setStretch(2, 2)
        
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
        cfg = get_config()
        self._cfg = cfg
        self.loaded_files = []  # Store loaded audio files
        self.album_cards = []  # Store album card references
        self.database = MusicDatabase()  # Initialize database
        self.hamms_analyzer = HAMMSAnalyzer()  # Initialize HAMMS v3.0
        self.audio_analyzer = UnifiedAudioAnalyzer()  # Initialize unified analyzer
        self._recent_tracks: list[str] = []  # Recently played paths (for variety)
        self._workers = []  # Keep background workers alive
        self._import_lock = threading.Lock()
        # DB single-writer worker
        self.db_writer = DBWriteWorker(self.database.db_path, busy_timeout_ms=cfg['database']['busy_timeout_ms'])
        self.db_writer.start()
        # Analysis queue control
        self._analysis_max = int(cfg['analysis']['max_concurrent'])
        self._analysis_active = 0
        self._analysis_queue = []  # heap of (priority, worker, progress_dialog)
        # Track status mapping: file_path -> AlbumCard
        self._status_map: dict[str, AlbumCard] = {}
        self._analysis_paused = False
        
        # Initialize media player
        self.player = QMediaPlayer()
        self.audio_output = QAudioOutput()
        self.player.setAudioOutput(self.audio_output)
        self.audio_output.setVolume(0.5)  # Default volume 50%
        
        # Playback state
        self.current_track = None
        self.is_playing = False
        
        # Loudness normalization settings
        self.loudness_normalization_enabled = True
        self.target_lufs = -18.0
        self.current_gain_db = 0.0
        
        # Don't clear database on startup to maintain persistence
        # self.database.clear_database()  # Commented out to keep data
        self.init_ui()
        self.apply_dark_theme()
        self.setup_player_connections()
        self.load_library_from_database()  # Load saved files on startup
        
    def create_menu_bar(self):
        """Create the main menu bar with organized menus"""
        menubar = self.menuBar()
        
        # Connect the macOS application menu Preferences to our function
        # This works on macOS to connect to the native app menu
        try:
            from PyQt6.QtGui import QAction
            app = QApplication.instance()
            if app and hasattr(app, 'applicationName'):
                # On macOS, connect to the standard Preferences menu item
                preferences_action = QAction('Preferences...', self)
                preferences_action.setMenuRole(QAction.MenuRole.PreferencesRole)
                preferences_action.triggered.connect(self.open_preferences)
                menubar.addAction(preferences_action)
        except:
            pass
        menubar.setStyleSheet("""
            QMenuBar {
                background-color: #1a1a1a;
                color: #ffffff;
                border-bottom: 1px solid #282828;
            }
            QMenuBar::item {
                padding: 8px 12px;
                background: transparent;
            }
            QMenuBar::item:selected {
                background: #282828;
            }
            QMenuBar::item:pressed {
                background: #404040;
            }
            QMenu {
                background-color: #282828;
                color: #ffffff;
                border: 1px solid #404040;
            }
            QMenu::item {
                padding: 8px 20px;
            }
            QMenu::item:selected {
                background-color: #404040;
            }
            QMenu::separator {
                height: 1px;
                background: #404040;
                margin: 4px 10px;
            }
        """)
        
        # File Menu
        file_menu = menubar.addMenu('File')
        
        add_files_action = file_menu.addAction('Add Files...')
        add_files_action.setShortcut('Ctrl+O')
        add_files_action.triggered.connect(self.add_audio_files)
        
        add_folder_action = file_menu.addAction('Add Folder...')
        add_folder_action.setShortcut('Ctrl+Shift+O')
        add_folder_action.triggered.connect(self.add_folder)
        
        file_menu.addSeparator()
        
        export_playlist_action = file_menu.addAction('Export Playlist...')
        export_playlist_action.triggered.connect(self.export_playlist)
        
        file_menu.addSeparator()
        
        exit_action = file_menu.addAction('Exit')
        exit_action.setShortcut('Ctrl+Q')
        exit_action.triggered.connect(self.close)
        
        # View Menu
        view_menu = menubar.addMenu('View')
        
        metadata_action = view_menu.addAction('Metadata Viewer')
        metadata_action.setShortcut('Ctrl+M')
        metadata_action.triggered.connect(self.open_metadata_viewer)
        
        view_menu.addSeparator()
        
        fullscreen_action = view_menu.addAction('Fullscreen')
        fullscreen_action.setShortcut('F11')
        fullscreen_action.triggered.connect(self.toggle_fullscreen)
        
        # Analysis Menu
        analysis_menu = menubar.addMenu('Analysis')
        
        analyze_missing_action = analysis_menu.addAction('Analyze Missing Features')
        analyze_missing_action.setShortcut('Ctrl+A')
        analyze_missing_action.triggered.connect(self.analyze_missing_features)
        
        analysis_menu.addSeparator()
        
        queue_status_action = analysis_menu.addAction('Show Queue Status')
        queue_status_action.triggered.connect(self.show_queue_status)
        
        pause_queue_action = analysis_menu.addAction('Pause/Resume Queue')
        pause_queue_action.setShortcut('Ctrl+P')
        pause_queue_action.triggered.connect(self.toggle_queue_pause)
        
        clear_queue_action = analysis_menu.addAction('Clear Queue')
        clear_queue_action.triggered.connect(self.clear_analysis_queue)
        
        # Playback Menu
        playback_menu = menubar.addMenu('Playback')
        
        play_pause_action = playback_menu.addAction('Play/Pause')
        play_pause_action.setShortcut('Space')
        play_pause_action.triggered.connect(self.toggle_play_pause)
        
        next_action = playback_menu.addAction('Next Track')
        next_action.setShortcut('Ctrl+Right')
        next_action.triggered.connect(self.on_next_track)
        
        prev_action = playback_menu.addAction('Previous Track')
        prev_action.setShortcut('Ctrl+Left')
        prev_action.triggered.connect(self.on_previous_track)
        
        playback_menu.addSeparator()
        
        shuffle_action = playback_menu.addAction('Toggle Shuffle')
        shuffle_action.triggered.connect(self.toggle_shuffle)
        
        repeat_action = playback_menu.addAction('Toggle Repeat')
        repeat_action.triggered.connect(self.toggle_repeat)
        
        # Tools Menu
        tools_menu = menubar.addMenu('Tools')
        
        # Loudness normalization toggle
        self.loudness_norm_action = tools_menu.addAction('Playback Loudness Normalization')
        self.loudness_norm_action.setCheckable(True)
        self.loudness_norm_action.setChecked(self.loudness_normalization_enabled)
        self.loudness_norm_action.triggered.connect(self.toggle_loudness_normalization)
        
        # Batch loudness analysis
        analyze_loudness_action = tools_menu.addAction('Analyze Loudness (Library)')
        analyze_loudness_action.triggered.connect(self.batch_analyze_loudness)
        
        tools_menu.addSeparator()
        
        clear_cache_action = tools_menu.addAction('Clear Cache')
        clear_cache_action.triggered.connect(self.clear_cache)
        
        tools_menu.addSeparator()
        
        reset_db_action = tools_menu.addAction('Reset Database')
        reset_db_action.triggered.connect(self.reset_database)
        
        # User Menu
        user_menu = menubar.addMenu('User')
        
        profile_action = user_menu.addAction('Profile')
        profile_action.triggered.connect(self.open_profile)
        
        user_menu.addSeparator()
        
        stats_action = user_menu.addAction('Listening Statistics')
        stats_action.triggered.connect(self.show_statistics)
        
        user_menu.addSeparator()
        
        logout_action = user_menu.addAction('Sign Out')
        logout_action.triggered.connect(self.sign_out)
        
        # Help Menu
        help_menu = menubar.addMenu('Help')
        
        about_action = help_menu.addAction('About Music Pro')
        about_action.triggered.connect(self.show_about)
        
        help_menu.addSeparator()
        
        shortcuts_action = help_menu.addAction('Keyboard Shortcuts')
        shortcuts_action.setShortcut('Ctrl+?')
        shortcuts_action.triggered.connect(self.show_shortcuts)
        
    def init_ui(self):
        self.setWindowTitle("Music Pro")
        self.setGeometry(100, 100, 1400, 900)
        
        # Create menu bar
        self.create_menu_bar()
        
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
        self.search_bar = QLineEdit()
        self.search_bar.setPlaceholderText("Search")
        self.search_bar.setStyleSheet("""
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
        # Debounced search
        self._search_timer = QTimer(self)
        self._search_timer.setSingleShot(True)
        self._search_timer.setInterval(300)
        self.search_bar.textChanged.connect(lambda _: self._search_timer.start())
        self._search_timer.timeout.connect(lambda: self.on_search_text_changed(self.search_bar.text()))
        sidebar_layout.addWidget(self.search_bar)
        
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
        
        # Simplified header - all controls moved to menu bar
        header_layout.addWidget(page_title)
        header_layout.addStretch()
        
        # Queue status display only (no buttons)
        self.queue_status = QLabel("")
        self.queue_status.setStyleSheet("""
            QLabel {
                color: #b3b3b3;
                font-size: 12px;
                padding: 0 20px;
            }
        """)
        header_layout.addWidget(self.queue_status)
        
        content_layout.addWidget(header)
        
        # Scrollable content
        scroll_area = QScrollArea()
        self.scroll_area = scroll_area
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

        # Lazy loading state for library
        self._library_items_pending = []
        self._library_loaded_count = 0
        self._loading_more = False
        # Load-on-scroll handler
        try:
            scroll_area.verticalScrollBar().valueChanged.connect(self._on_scroll)
        except Exception:
            pass

        # Global keyboard shortcuts
        self._setup_shortcuts()
        
        # Add sidebar and content to top layout
        top_layout.addWidget(sidebar)
        top_layout.addWidget(content_area, 1)
        
        # Player bar
        self.player_bar = PlayerBar(self)
        self.bottom_bar = self.player_bar  # Reference for VU meter
        
        # Store references to controls for easy access
        self.play_pause_btn = self.player_bar.play_btn
        self.position_slider = self.player_bar.progress_slider
        self.time_label = self.player_bar.time_current
        self.track_title_label = self.player_bar.track_title
        self.track_artist_label = self.player_bar.track_artist
        self.player_album_art = self.player_bar.album_art
        
        # Connect player bar controls
        self.player_bar.play_btn.clicked.connect(self.toggle_play_pause)
        self.player_bar.prev_btn.clicked.connect(self.on_previous_track)
        self.player_bar.next_btn.clicked.connect(self.on_next_track)
        self.player_bar.mix_btn.clicked.connect(self.on_next_track)
        self.player_bar.progress_slider.sliderMoved.connect(self.on_position_slider_moved)
        self.player_bar.volume_slider.valueChanged.connect(self.on_volume_changed)
        
        # Add to main layout
        main_layout.addWidget(top_widget, 1)
        main_layout.addWidget(self.player_bar)
        
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

    def toggle_analysis_pause(self):
        self._analysis_paused = not self._analysis_paused
        self.pause_btn.setText("Resume" if self._analysis_paused else "Pause")
        if not self._analysis_paused:
            self._maybe_start_next_analysis()
        self._update_queue_status()

    def _update_queue_status(self):
        try:
            q = len(self._analysis_queue)
            a = self._analysis_active
            self.queue_status.setText(f"Queue: {q} | Active: {a}{' (Paused)' if self._analysis_paused else ''}")
        except Exception:
            pass

    def open_preferences(self):
        try:
            dlg = QDialog(self)
            dlg.setWindowTitle("Preferences")
            form = QFormLayout(dlg)
            # Toasts enabled
            cb_toasts = QCheckBox()
            cb_toasts.setChecked(self._cfg.get('ui', {}).get('toasts_enabled', True))
            form.addRow("Show Toasts", cb_toasts)
            # Toast timeout
            sp_toast = QSpinBox()
            sp_toast.setRange(500, 10000)
            sp_toast.setValue(int(self._cfg.get('ui', {}).get('toast_timeout_ms', 2500)))
            sp_toast.setSuffix(" ms")
            form.addRow("Toast Timeout", sp_toast)
            # Grid page size
            sp_grid = QSpinBox()
            sp_grid.setRange(10, 200)
            sp_grid.setValue(int(self._cfg.get('ui', {}).get('grid_page_size', 40)))
            form.addRow("Grid Batch Size", sp_grid)
            # Max concurrent analysis
            sp_workers = QSpinBox()
            sp_workers.setRange(1, 8)
            sp_workers.setValue(int(self._cfg.get('analysis', {}).get('max_concurrent', 2)))
            form.addRow("Max Concurrent Analysis", sp_workers)
            # Buttons
            btns = QHBoxLayout()
            ok = QPushButton("Save")
            cancel = QPushButton("Cancel")
            btns.addStretch()
            btns.addWidget(ok)
            btns.addWidget(cancel)
            form.addRow(btns)

            def _save():
                self._cfg['ui']['toasts_enabled'] = cb_toasts.isChecked()
                self._cfg['ui']['toast_timeout_ms'] = int(sp_toast.value())
                self._cfg['ui']['grid_page_size'] = int(sp_grid.value())
                self._cfg['analysis']['max_concurrent'] = int(sp_workers.value())
                # Apply live
                self._analysis_max = self._cfg['analysis']['max_concurrent']
                self._library_batch_size = self._cfg['ui']['grid_page_size']
                from utils.config import save_config
                save_config(self._cfg)
                dlg.accept()

            ok.clicked.connect(_save)
            cancel.clicked.connect(dlg.reject)
            dlg.exec()
        except Exception as e:
            logger.warning(f"Preferences failed: {e}")

    def _setup_shortcuts(self):
        try:
            # Play/Pause (Space)
            sc_play = QShortcut(QKeySequence(Qt.Key.Key_Space), self)
            sc_play.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_play.activated.connect(self.toggle_play_pause)

            # Next/Previous (Ctrl+Right / Ctrl+Left)
            sc_next = QShortcut(QKeySequence("Ctrl+Right"), self)
            sc_next.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_next.activated.connect(self.on_next_track)

            sc_prev = QShortcut(QKeySequence("Ctrl+Left"), self)
            sc_prev.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_prev.activated.connect(self.on_previous_track)
            
            # Seek forward/backward (Right/Left arrows)
            sc_seek_forward = QShortcut(QKeySequence(Qt.Key.Key_Right), self)
            sc_seek_forward.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_seek_forward.activated.connect(lambda: self.seek_relative(5000))  # +5 seconds
            
            sc_seek_backward = QShortcut(QKeySequence(Qt.Key.Key_Left), self)
            sc_seek_backward.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_seek_backward.activated.connect(lambda: self.seek_relative(-5000))  # -5 seconds

            # Add Files (Ctrl+O)
            sc_open = QShortcut(QKeySequence("Ctrl+O"), self)
            sc_open.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_open.activated.connect(self.add_audio_files)

            # Show Metadata (Ctrl+M) for current track
            def _show_meta():
                if getattr(self, 'current_track', None):
                    self.show_track_metadata(self.current_track)
            sc_meta = QShortcut(QKeySequence("Ctrl+M"), self)
            sc_meta.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_meta.activated.connect(_show_meta)

            # Recalculate HAMMS (Ctrl+R) for current track
            def _recalc():
                if getattr(self, 'current_track', None):
                    self.recalculate_hamms_async(self.current_track)
            sc_recalc = QShortcut(QKeySequence("Ctrl+R"), self)
            sc_recalc.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_recalc.activated.connect(_recalc)

            # Analyze with AI (Ctrl+Shift+A) for current track
            def _analyze():
                if getattr(self, 'current_track', None):
                    self.analyze_with_ai_async(self.current_track)
            sc_ai = QShortcut(QKeySequence("Ctrl+Shift+A"), self)
            sc_ai.setContext(Qt.ShortcutContext.ApplicationShortcut)
            sc_ai.activated.connect(_analyze)
        except Exception:
            pass
        
    def open_metadata_viewer(self):
        """Open the metadata viewer window"""
        try:
            from metadata_viewer import MetadataViewer
            
            # Create and show metadata viewer
            self.metadata_viewer = MetadataViewer(self.database.db_path)
            self.metadata_viewer.show()
            
            logger.info("Opened metadata viewer")
            
        except Exception as e:
            logger.error(f"Error opening metadata viewer: {e}")
            QMessageBox.warning(self, "Error", 
                              f"Could not open metadata viewer: {str(e)}")
    
    def add_audio_files(self):
        """Open file dialog to add audio files to library"""
        try:
            from PyQt6.QtWidgets import QProgressDialog
            files, _ = QFileDialog.getOpenFileNames(
                self,
                "Select Audio Files",
                "",
                AUDIO_FILE_FILTER
            )
            
            if files:
                progress = QProgressDialog("Importing audio files...", "Cancel", 0, len(files), self)
                progress.setWindowModality(Qt.WindowModality.WindowModal)
                progress.setValue(0)
                progress.setMinimumDuration(0)
                try:
                    self._show_toast(f"Queued import of {len(files)} file(s) for analysis")
                except Exception:
                    pass
                # Remove placeholder if it exists
                if hasattr(self, 'library_placeholder'):
                    self.library_placeholder.setParent(None)
                    self.library_placeholder.deleteLater()
                    delattr(self, 'library_placeholder')

                state = {
                    'i': 0,
                    'added': 0,
                    'skipped': 0,
                }

                def _process_next():
                    i = state['i']
                    if i >= len(files) or progress.wasCanceled():
                        progress.setValue(len(files))
                        if i >= len(files):
                            msg = f"Added: {state['added']}"
                            if state['skipped']:
                                msg += f"  • Skipped: {state['skipped']} (already in library)"
                            QMessageBox.information(self, "Import Summary", msg)
                            try:
                                self._show_toast(f"Import complete • Added {state['added']} • Skipped {state['skipped']}")
                            except Exception:
                                pass
                            return
                    file_path = files[i]
                    progress.setValue(i)
                    progress.setLabelText(f"Importing: {Path(file_path).name}")
                    with self._import_lock:
                        if file_path not in self.loaded_files:
                            existing = self.database.get_track_by_path(file_path)
                            if existing:
                                self.loaded_files.append(file_path)
                                self._add_card_from_db_row(existing)
                                state['skipped'] += 1
                            else:
                                self.loaded_files.append(file_path)
                                self.add_file_to_library(file_path)
                                state['added'] += 1
                        else:
                            state['skipped'] += 1
                        state['i'] += 1
                        QTimer.singleShot(0, _process_next)

                QTimer.singleShot(0, _process_next)
        except Exception as e:
            logger.error(f"Error adding audio files: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"Failed to add audio files: {str(e)}"
            )
    
    def add_file_to_library(self, file_path, from_database=False):
        """Add a single file to the library display with artwork extraction and HAMMS analysis"""
        file_name = Path(file_path).name
        
        logger.info(f"Importing: {file_name}")
        
        # Early exit: if exists in DB and not called from DB load, just render card
        existing_row = None if from_database else self.database.get_track_by_path(file_path)
        if existing_row and Path(file_path).exists():
            logger.info("Track already in database — skipping re-analysis")
            self._add_card_from_db_row(existing_row)
            return

        # Step 1: Extract metadata and artwork
        logger.debug("Step 1/5: Extracting metadata")
        metadata = MetadataExtractor.extract_metadata(file_path)
        logger.debug(f"Title: {metadata['title']}")
        logger.debug(f"Artist: {metadata['artist']}")
        logger.debug(f"Album: {metadata['album']}")
        
        # Save to database if not loading from database
        if not from_database:
            # Step 2: Save to database (fast)
            logger.debug("Step 3/5: Saving to database")
            
            # Convert QPixmap to bytes for database storage
            artwork_data = None
            # Ensure we have artwork; bundled fallback → generated default
            if not metadata.get('artwork_pixmap'):
                try:
                    fb = None
                    # Try bundled fallback bytes → pixmap
                    from metadata_extractor import MetadataExtractor as _ME
                    b = _ME._fallback_artwork_bytes()
                    if b:
                        fb = _ME._bytes_to_pixmap(b)
                    if fb is None:
                        fb = MetadataExtractor.generate_default_artwork(
                            metadata.get('title') or Path(file_path).stem,
                            metadata.get('artist') or 'Unknown Artist'
                        )
                    metadata['artwork_pixmap'] = fb
                except Exception:
                    pass
            if metadata.get('artwork_pixmap'):
                # Downscale before saving
                scaled = MetadataExtractor.downscale_pixmap(metadata['artwork_pixmap'], 600)
                ba = QByteArray()
                buffer = QBuffer(ba)
                buffer.open(QIODevice.OpenModeFlag.WriteOnly)
                scaled.save(buffer, "PNG")
                artwork_data = bytes(ba)
                logger.debug("Artwork saved (downscaled)")
            
            # Save to database with HAMMS fields
            db_metadata = metadata.copy()
            db_metadata['file_path'] = file_path
            db_metadata['artwork_data'] = artwork_data
            db_metadata.pop('artwork_pixmap', None)
            track_id = self.database.add_track(db_metadata)
            logger.info(f"Track saved to database (ID: {track_id})")

            # Step 3: Always analyze in background (non‑blocking UI)
            logger.debug("Step 4/5: Scheduling background analysis (MixedInKey-aware)")
            if track_id:
                self._start_analysis_worker(file_path, metadata, track_id)
        
        # Create album card with extracted artwork and HAMMS data
        card = AlbumCard(
            title=metadata['title'],
            artist=metadata['artist'],
            album_id=file_path,
            artwork_pixmap=metadata.get('artwork_pixmap'),
            bpm=metadata.get('bpm'),
            key=metadata.get('key'),
            energy=metadata.get('energy')
        )
        card.clicked.connect(self.play_file)
        # Mark as queued for background analysis
        try:
            card.set_status("Queued")
            self._status_map[file_path] = card
        except Exception:
            pass
        
        # Remove stretch temporarily
        stretch_index = self.library_grid.count() - 1
        stretch_item = self.library_grid.takeAt(stretch_index)
        
        # Add card to library grid
        self.library_grid.addWidget(card)
        self.album_cards.append(card)
        
        # Add stretch back
        if stretch_item:
            self.library_grid.addItem(stretch_item)

    def _add_card_from_db_row(self, track_row: dict):
        """Create and add an AlbumCard using an existing DB row."""
        file_path = track_row['file_path']
        md = {
            'title': track_row.get('title', Path(file_path).stem),
            'artist': track_row.get('artist', 'Unknown Artist'),
            'album': track_row.get('album', 'Unknown Album'),
            'artwork_pixmap': None
        }
        bpm = track_row.get('bpm')
        key = track_row.get('initial_key') or track_row.get('key')
        energy = track_row.get('energy')
        if energy is None and track_row.get('energy_level') is not None:
            try:
                energy = float(track_row.get('energy_level')) / 10.0
            except Exception:
                energy = None
        if track_row.get('artwork_data'):
            image = QImage()
            image.loadFromData(track_row['artwork_data'])
            if not image.isNull():
                md['artwork_pixmap'] = QPixmap.fromImage(image)

        card = AlbumCard(
            title=md['title'],
            artist=md['artist'],
            album_id=file_path,
            artwork_pixmap=md.get('artwork_pixmap'),
            bpm=bpm,
            key=key,
            energy=energy
        )
        card.clicked.connect(self.play_file)
        stretch_index = self.library_grid.count() - 1
        stretch_item = self.library_grid.takeAt(stretch_index)
        self.library_grid.addWidget(card)
        self.album_cards.append(card)
        if stretch_item:
            self.library_grid.addItem(stretch_item)
    
    def extract_audio_metadata(self, file_path):
        """Extract metadata and artwork from audio file INCLUDING MixedInKey fields"""
        return MetadataExtractor.extract_metadata(file_path)
        
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
                
                # Extract MixedInKey data (CRITICAL - DO NOT CALCULATE IF PRESENT!)
                # These fields contain professional DJ analysis from MixedInKey
                for key in audio_file.keys():
                    key_upper = key.upper()
                    # BPM from MixedInKey (precise with decimals)
                    if key_upper == 'BPM':
                        metadata['BPM'] = str(audio_file[key][0])
                        logger.debug(f"Found MixedInKey BPM: {metadata['BPM']}")
                    # Initial Key (Camelot notation)
                    elif key_upper == 'INITIALKEY':
                        metadata['INITIALKEY'] = str(audio_file[key][0])
                        logger.debug(f"Found MixedInKey Key: {metadata['INITIALKEY']}")
                    # Energy Level (1-10 scale)
                    elif key_upper == 'ENERGYLEVEL':
                        metadata['ENERGYLEVEL'] = str(audio_file[key][0])
                        logger.debug(f"Found MixedInKey Energy: {metadata['ENERGYLEVEL']}")
                    # Beat Grid (base64 encoded)
                    elif key_upper == 'BEATGRID':
                        metadata['BEATGRID'] = str(audio_file[key][0])
                        logger.debug("Found MixedInKey BeatGrid")
                    # Cue Points
                    elif key_upper == 'CUEPOINTS':
                        metadata['CUEPOINTS'] = str(audio_file[key][0])
                        logger.debug("Found MixedInKey CuePoints")
                    # Key data (base64)
                    elif key_upper == 'KEY':
                        metadata['KEY'] = str(audio_file[key][0])
                    # Energy data (base64)
                    elif key_upper == 'ENERGY':
                        metadata['ENERGY'] = str(audio_file[key][0])
                    # Comment (often contains key-energy info)
                    elif key_upper == 'COMMENT':
                        metadata['COMMENT'] = str(audio_file[key][0])
                
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
            logger.error(f"Error extracting metadata from {file_path}: {e}")
        
        # Fallback to filename parsing if no metadata
        if metadata['title'] == Path(file_path).stem:
            filename = Path(file_path).stem
            if ' - ' in filename:
                parts = filename.split(' - ', 1)
                metadata['artist'] = parts[0].strip()
                metadata['title'] = parts[1].strip()
        
        return metadata
    
    def _apply_loudness_normalization(self, track_id):
        """Apply loudness normalization based on stored analysis."""
        try:
            if not track_id:
                return
            
            # Get loudness metrics from database
            loudness_data = self.database.get_loudness(track_id)
            
            if loudness_data and loudness_data.get('integrated_loudness'):
                # Import analyzer for gain calculation
                from audio.loudness_analyzer import LoudnessAnalyzer
                analyzer = LoudnessAnalyzer()
                
                # Calculate gain adjustment
                current_lufs = loudness_data['integrated_loudness']
                self.current_gain_db = analyzer.estimate_gain_db(current_lufs, self.target_lufs)
                
                # Apply gain as volume adjustment
                # Convert dB gain to linear multiplier
                gain_linear = 10 ** (self.current_gain_db / 20.0)
                
                # Get base volume from slider
                base_volume = self.player_bar.volume_slider.value() / 100.0
                
                # Apply gain with clamping
                adjusted_volume = max(0.0, min(1.0, base_volume * gain_linear))
                self.audio_output.setVolume(adjusted_volume)
                
                # Show in status bar
                self._show_toast(f"Loudness gain: {self.current_gain_db:+.1f} dB", 2000)
                logger.info(f"Applied loudness normalization: {self.current_gain_db:+.1f} dB")
            else:
                # No loudness data, reset gain
                self.current_gain_db = 0.0
                logger.debug(f"No loudness data for track {track_id}")
                
        except Exception as e:
            logger.warning(f"Failed to apply loudness normalization: {e}")
            self.current_gain_db = 0.0
    
    def batch_analyze_loudness(self):
        """Run batch loudness analysis on library in background."""
        try:
            from PyQt6.QtWidgets import QProgressDialog
            from PyQt6.QtCore import QThread, pyqtSignal
            
            # Create progress dialog
            progress = QProgressDialog("Analyzing loudness for library...", "Cancel", 0, 0, self)
            progress.setWindowTitle("Loudness Analysis")
            progress.setModal(True)
            progress.setMinimumDuration(0)
            
            class LoudnessWorker(QThread):
                finished = pyqtSignal(int)
                
                def __init__(self, db_path):
                    super().__init__()
                    self.db_path = db_path
                    self._cancelled = False
                
                def cancel(self):
                    self._cancelled = True
                
                def run(self):
                    from audio.loudness_batch import LoudnessBatchProcessor
                    processor = LoudnessBatchProcessor(self.db_path, target_lufs=-18.0)
                    processed = processor.process_missing()
                    self.finished.emit(processed)
            
            # Create and start worker
            worker = LoudnessWorker(self.database.db_path)
            
            def on_finished(count):
                progress.close()
                QMessageBox.information(
                    self,
                    "Loudness Analysis Complete",
                    f"Loudness analysis complete: {count} tracks updated"
                )
            
            def on_cancelled():
                worker.cancel()
                worker.quit()
                worker.wait()
            
            worker.finished.connect(on_finished)
            progress.canceled.connect(on_cancelled)
            
            progress.show()
            worker.start()
            
        except Exception as e:
            logger.error(f"Failed to start batch loudness analysis: {e}")
            QMessageBox.critical(
                self,
                "Analysis Error",
                f"Failed to start loudness analysis:\n{str(e)}"
            )
    
    def toggle_loudness_normalization(self):
        """Toggle loudness normalization on/off."""
        self.loudness_normalization_enabled = not self.loudness_normalization_enabled
        
        if self.loudness_normalization_enabled:
            # Re-apply normalization to current track
            if self.current_track:
                track = self.database.get_track_by_path(self.current_track)
                if track:
                    self._apply_loudness_normalization(track.get('id'))
            self._show_toast("Loudness normalization: ON", 1500)
        else:
            # Reset to base volume
            self.current_gain_db = 0.0
            base_volume = self.player_bar.volume_slider.value() / 100.0
            self.audio_output.setVolume(base_volume)
            self._show_toast("Loudness normalization: OFF", 1500)
    
    def play_file(self, file_path):
        """Play the selected audio file"""
        logger.info(f"Playing: {file_path}")
        
        # Set the media source
        self.player.setSource(QUrl.fromLocalFile(file_path))
        self.current_track = file_path
        
        # Get track metadata for display
        track = self.database.get_track_by_path(file_path)
        if track:
            # Update player bar with track info
            if hasattr(self, 'track_title_label'):
                self.track_title_label.setText(track.get('title', 'Unknown'))
            if hasattr(self, 'track_artist_label'):
                self.track_artist_label.setText(track.get('artist', 'Unknown Artist'))
            
            # Apply loudness normalization if enabled
            if self.loudness_normalization_enabled:
                self._apply_loudness_normalization(track.get('id'))
            
            # Update album art in player bar
            if hasattr(self, 'player_album_art') and track.get('artwork_data'):
                image = QImage()
                image.loadFromData(track['artwork_data'])
                if not image.isNull():
                    pixmap = QPixmap.fromImage(image).scaled(
                        60, 60, 
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation
                    )
                    self.player_album_art.setPixmap(pixmap)
        
        # Start playback
        self.player.play()
        self.is_playing = True
        # Track recency (limit 10)
        try:
            if file_path in self._recent_tracks:
                self._recent_tracks.remove(file_path)
            self._recent_tracks.append(file_path)
            if len(self._recent_tracks) > 10:
                self._recent_tracks = self._recent_tracks[-10:]
        except Exception:
            pass
        
        # Update play button
        if hasattr(self, 'play_pause_btn'):
            self.play_pause_btn.setText("⏸")
    
    def _start_analysis_worker(self, file_path, metadata, track_id):
        """Start background analysis to avoid blocking UI."""
        try:
            self._analysis_worker = ImportAnalysisWorker(file_path, metadata, self.database.db_path)
            self._analysis_worker.finished.connect(self._on_background_analysis_finished)
            try:
                # Update status badge to Analyzing… if we have the card
                card = self._status_map.get(file_path)
                if card:
                    card.set_status("Analyzing…")
            except Exception:
                pass
            self._analysis_worker.finished.connect(self._analysis_worker.deleteLater)
            # Clear reference after finish to avoid leaks
            self._analysis_worker.finished.connect(lambda: setattr(self, '_analysis_worker', None))
            self._analysis_worker.start()
        except Exception as e:
            logger.error(f"Failed to start background analysis: {e}")

    def _on_background_analysis_finished(self, result: dict):
        try:
            file_path = result.get('file_path') or result.get('id')
            features = result.get('features') or {}
            vector = result.get('vector')
            if file_path:
                row = self.database.get_track_by_path(file_path)
                if row and features:
                    try:
                        self.db_writer.enqueue('update_track_features', row['id'], features)
                        if vector is not None:
                            self.db_writer.enqueue('save_hamms', row['id'], vector, features)
                    except Exception:
                        self.database.update_track_features(row['id'], features)
                        if vector is not None:
                            self.hamms_analyzer.save_hamms_analysis(row['id'], np.array(vector), features)
                    self.hamms_analyzer.invalidate_track(row['id'])
                # Update card badges if present
                for card in self.album_cards:
                    if card.album_id == file_path:
                        # Clear status and flash update
                        try:
                            card.set_status(None)
                        except Exception:
                            pass
                        self._update_card_badges_from_features(card, features)
                        break
                # Clear status map entry
                try:
                    self._status_map.pop(file_path, None)
                except Exception:
                    pass
                # Trigger AI metadata analysis/persist in background (non-blocking)
                try:
                    if row:
                        from ai_analysis import AIAnalysisProcessor
                        def _ai_job(tid:int, dbp:str):
                            try:
                                AIAnalysisProcessor(db_path=dbp, max_parallel=2).process_one(tid)
                            except Exception as _e:
                                logger.debug(f"AI post-analysis skipped: {_e}")
                        th = threading.Thread(target=_ai_job, args=(row['id'], self.database.db_path), daemon=True)
                        th.start()
                except Exception:
                    pass
            logger.info(f"Background analysis finished for {file_path}")
        except Exception as e:
            logger.warning(f"Background analysis apply failed: {e}")

    def set_custom_artwork(self, file_path: str):
        try:
            from PyQt6.QtWidgets import QFileDialog
            fname, _ = QFileDialog.getOpenFileName(self, "Select Artwork Image", "", "Images (*.png *.jpg *.jpeg)")
            if not fname:
                return
            image = QImage()
            if not image.load(fname):
                QMessageBox.warning(self, "Artwork", "Could not load selected image.")
                return
            pixmap = QPixmap.fromImage(image)
            scaled = MetadataExtractor.downscale_pixmap(pixmap, 600)
            ba = QByteArray()
            buf = QBuffer(ba)
            buf.open(QIODevice.OpenModeFlag.WriteOnly)
            scaled.save(buf, "PNG")
            try:
                self.db_writer.enqueue('update_track_artwork', file_path, bytes(ba), None)
            except Exception:
                self.database.update_track_artwork(file_path, artwork_data=bytes(ba))
            # Update card in UI
            for card in self.album_cards:
                if card.album_id == file_path:
                    card.artwork_pixmap = scaled
                    card.cover.setPixmap(scaled.scaled(180, 180, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation))
                    break
            # Update player bar if current
            if self.current_track == file_path and hasattr(self, 'player_album_art'):
                self.player_album_art.setPixmap(scaled.scaled(60, 60, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
            QMessageBox.information(self, "Artwork", "Artwork updated successfully.")
        except Exception as e:
            logger.error(f"Failed to set custom artwork: {e}")
            QMessageBox.critical(self, "Artwork", f"Failed to set artwork: {e}")

    def extract_artwork_from_audio(self, file_path: str):
        """Extract embedded artwork from the audio file and update DB/UI."""
        try:
            from metadata_extractor import MetadataExtractor as _ME
            data = _ME.extract_embedded_artwork(file_path)
            if not data:
                QMessageBox.information(self, "Artwork", "No embedded artwork found in this file.")
                return
            # Save to DB (route via single-writer)
            try:
                self.db_writer.enqueue('update_track_artwork', file_path, data, None)
            except Exception:
                self.database.update_track_artwork(file_path, artwork_data=data)
            # Update UI
            image = QImage()
            image.loadFromData(data)
            if not image.isNull():
                pixmap = QPixmap.fromImage(image)
                # Update card
                for card in self.album_cards:
                    if card.album_id == file_path:
                        card.artwork_pixmap = pixmap
                        card.cover.setPixmap(pixmap.scaled(180, 180, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation))
                        break
                # Update player bar if current
                if self.current_track == file_path and hasattr(self, 'player_album_art'):
                    self.player_album_art.setPixmap(pixmap.scaled(60, 60, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
            QMessageBox.information(self, "Artwork", "Embedded artwork extracted and saved.")
        except Exception as e:
            logger.error(f"Failed to extract embedded artwork: {e}")
            QMessageBox.critical(self, "Artwork", f"Failed to extract artwork: {e}")

    def analyze_missing_features(self):
        """Batch analyze tracks missing BPM/Key/HAMMS with progress."""
        try:
            # Build list of candidates from DB
            rows = self.database.get_all_tracks()
            candidates = []
            for r in rows:
                need = (r.get('bpm') is None) or (r.get('initial_key') is None)
                has_hamms = self.database.conn.execute('SELECT 1 FROM hamms_advanced WHERE file_id = ?', (r['id'],)).fetchone() is not None
                if need or not has_hamms:
                    candidates.append(r['file_path'])
            if not candidates:
                QMessageBox.information(self, "Analyze Missing", "No tracks require analysis.")
                return
            # Mark UI cards as Queued
            for card in self.album_cards:
                if card.album_id in candidates:
                    try:
                        card.set_status("Queued")
                        self._status_map[card.album_id] = card
                    except Exception:
                        pass
            try:
                self._show_toast(f"Queued analysis for {len(candidates)} track(s)")
            except Exception:
                pass
            from PyQt6.QtWidgets import QProgressDialog
            self._batch_dialog = QProgressDialog("Analyzing missing features...", "Cancel", 0, len(candidates), self)
            self._batch_dialog.setWindowModality(Qt.WindowModality.WindowModal)
            self._batch_dialog.setValue(0)
            self._batch_worker = BatchAnalysisWorker(candidates, self.database.db_path)
            self._batch_worker.total.connect(lambda n: self._batch_dialog.setMaximum(n))
            def _on_progress(i):
                self._batch_dialog.setValue(i)
                if self._batch_dialog.wasCanceled():
                    self._batch_worker.request_cancel()
            self._batch_worker.progress.connect(_on_progress)
            # Route item results to DB writer and UI badges
            def _on_item_ready(file_path: str, features: dict, vector12: list):
                try:
                    row = self.database.get_track_by_path(file_path)
                    if row:
                        try:
                            self.db_writer.enqueue('update_track_features', row['id'], features)
                            self.db_writer.enqueue('save_hamms', row['id'], vector12, features)
                        except Exception:
                            self.database.update_track_features(row['id'], features)
                            self.hamms_analyzer.save_hamms_analysis(row['id'], np.array(vector12), features)
                        self.hamms_analyzer.invalidate_track(row['id'])
                    # Update UI badges if the card exists
                    for card in self.album_cards:
                        if card.album_id == file_path:
                            self._update_card_badges_from_features(card, features)
                            break
                except Exception as e:
                    logger.warning(f"Batch item apply failed: {e}")
            self._batch_worker.item_ready.connect(_on_item_ready)
            def _done(analyzed, skipped):
                self._batch_dialog.setValue(self._batch_dialog.maximum())
                # Refresh badges from DB
                try:
                    self._refresh_badges_from_db()
                except Exception as e:
                    logger.warning(f"Badge refresh failed: {e}")
                QMessageBox.information(self, "Analyze Missing", f"Analyzed: {analyzed} • Skipped: {skipped}")
                try:
                    self._show_toast(f"Batch analyzed {analyzed} • Skipped {skipped}")
                except Exception:
                    pass
            self._batch_worker.finished.connect(_done)
            self._batch_worker.start()
        except Exception as e:
            logger.error(f"Analyze missing failed: {e}")
            QMessageBox.critical(self, "Analyze Missing", f"Failed: {e}")

    def _refresh_badges_from_db(self):
        """Update all AlbumCard badges using DB data."""
        for card in self.album_cards:
            try:
                row = self.database.get_track_by_path(card.album_id)
                if not row:
                    continue
                bpm = row.get('bpm')
                key = row.get('initial_key') or row.get('key')
                energy = row.get('energy')
                if energy is None and row.get('energy_level') is not None:
                    try:
                        energy = float(row.get('energy_level')) / 10.0
                    except Exception:
                        energy = None
                # Detect changes
                def _eq(a, b):
                    if a is None and b is None:
                        return True
                    if a is None or b is None:
                        return False
                    try:
                        return abs(float(a) - float(b)) < 0.01
                    except Exception:
                        return str(a) == str(b)

                changed = not _eq(card.bpm, bpm) or not _eq(card.key, key) or not _eq(card.energy, energy)
                card.set_badges(bpm=bpm, key=key, energy=energy)
                if changed:
                    card.flash_update("Refreshed")
            except Exception as e:
                logger.warning(f"Failed to refresh badge for {card.album_id}: {e}")

    def process_audio_buffer(self, buffer):
        """Process audio buffer for VU meter levels."""
        try:
            # Get format info
            format = buffer.format()
            channel_count = format.channelCount()
            bytes_per_sample = format.bytesPerSample()
            sample_format = None
            try:
                sample_format = format.sampleFormat()
            except Exception:
                sample_format = None
            sample_count = buffer.sampleCount()

            if sample_count == 0 or channel_count == 0 or bytes_per_sample == 0:
                return
            
            # Get raw bytes
            data = bytes(buffer.constData()) if hasattr(buffer, 'constData') else buffer.data()

            # Convert to numpy array by format
            import numpy as np
            dtype = None
            # Robust detection of sample format across bindings
            sf_name = str(sample_format) if sample_format is not None else ''
            if ('UInt8' in sf_name) or (sample_format is not None and sample_format == getattr(QAudioFormat.SampleFormat, 'UInt8', sample_format)):
                dtype = np.uint8
                # Map [0..255] -> [-1..1]
                arr = np.frombuffer(data, dtype=dtype)
                arr = (arr.astype(np.float32) - 128.0) / 128.0
            elif ('Int16' in sf_name) or bytes_per_sample == 2:
                dtype = np.int16
                arr = np.frombuffer(data, dtype=dtype).astype(np.float32) / 32768.0
            elif ('Float' in sf_name):
                dtype = np.float32
                arr = np.frombuffer(data, dtype=dtype)
            elif ('Int32' in sf_name) or bytes_per_sample == 4:
                dtype = np.int32
                arr = np.frombuffer(data, dtype=dtype).astype(np.float32) / 2147483648.0
            else:
                # Unknown format: fall back (do nothing)
                arr = None

            if arr is None or arr.size == 0:
                return

            # Reshape to (frames, channels)
            try:
                frames = arr.size // channel_count
                arr = arr[: frames * channel_count]
                arr = arr.reshape((-1, channel_count))
            except Exception:
                return

            # Compute per-channel RMS on entire buffer
            # Protect against NaNs/Infs
            arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
            rms_per_ch = np.sqrt(np.mean(np.square(arr), axis=0))
            if rms_per_ch.size == 0:
                return
            left_rms = float(rms_per_ch[0])
            right_rms = float(rms_per_ch[1]) if channel_count > 1 else left_rms

            # Convert RMS to dBFS with floor at -120 dB then clamp to [-40, +3]
            def _to_dbfs(x: float) -> float:
                if x <= 0.0:
                    return -120.0
                return 20.0 * math.log10(max(1e-9, x))

            left_db = _to_dbfs(left_rms)
            right_db = _to_dbfs(right_rms)

            # Update VU meter (prefer dB method if available)
            if hasattr(self, 'bottom_bar') and hasattr(self.bottom_bar, 'vu_meter'):
                vu = self.bottom_bar.vu_meter
                if hasattr(vu, 'update_db_levels'):
                    vu.update_db_levels(left_db, right_db)
                else:
                    # Fallback: convert back to linear 0..1 (approx)
                    vu.update_levels(max(0.0, min(1.0, left_rms)), max(0.0, min(1.0, right_rms)))

        except Exception as e:
            logger.debug(f"Audio buffer processing error: {e}")
    
    def simulate_vu_levels(self):
        """Simulate VU meter levels based on volume and playback state."""
        try:
            if self.is_playing and hasattr(self, 'bottom_bar') and hasattr(self.bottom_bar, 'vu_meter'):
                # Base level from volume
                base_level = self.audio_output.volume()
                
                # Add some variation for visual appeal
                import random
                variation = random.uniform(0.7, 1.0)
                modulation = math.sin(self.player.position() / 1000.0) * 0.1 + 0.9
                
                # Calculate simulated levels
                level = base_level * variation * modulation
                # Slightly different levels for L/R
                left_lin = min(1.0, level * random.uniform(0.95, 1.05))
                right_lin = min(1.0, level * random.uniform(0.95, 1.05))

                # Convert to dBFS with floor
                def _db(x: float) -> float:
                    if x <= 0.0:
                        return -120.0
                    return 20.0 * math.log10(max(1e-9, x))

                vu = self.bottom_bar.vu_meter
                if hasattr(vu, 'update_db_levels'):
                    vu.update_db_levels(_db(left_lin), _db(right_lin))
                else:
                    vu.update_levels(left_lin, right_lin)
        except Exception as e:
            logger.debug(f"VU simulation error: {e}")
    
    def setup_player_connections(self):
        """Setup media player signal connections"""
        # Player state changes
        self.player.playbackStateChanged.connect(self.on_playback_state_changed)
        self.player.positionChanged.connect(self.on_position_changed)
        self.player.durationChanged.connect(self.on_duration_changed)
        self.player.errorOccurred.connect(self.on_player_error)
        self.player.mediaStatusChanged.connect(self.on_media_status_changed)
        
        # Setup audio probe for VU meter if available
        self.audio_probe = None
        if HAS_AUDIO_PROBE:
            try:
                self.audio_probe = QAudioProbe()
                self.audio_probe.setSource(self.player)
                self.audio_probe.audioBufferProbed.connect(self.process_audio_buffer)
                logger.info("Audio probe setup successful")
            except Exception as e:
                logger.warning(f"Audio probe setup failed: {e}")
                self.audio_probe = None
        
        # Fallback: Use volume-based simulation for VU meter
        if not self.audio_probe:
            self.vu_timer = QTimer()
            self.vu_timer.timeout.connect(self.simulate_vu_levels)
            self.vu_timer.setInterval(50)  # 20 FPS update
    
    def on_playback_state_changed(self, state):
        """Handle playback state changes"""
        from PyQt6.QtMultimedia import QMediaPlayer
        
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.is_playing = True
            if hasattr(self, 'play_pause_btn'):
                self.play_pause_btn.setText("⏸")
            # Start VU meter simulation if no probe
            if not self.audio_probe and hasattr(self, 'vu_timer'):
                self.vu_timer.start()
        else:
            self.is_playing = False
            if hasattr(self, 'play_pause_btn'):
                self.play_pause_btn.setText("▶")
            # Stop VU meter simulation
            if hasattr(self, 'vu_timer'):
                self.vu_timer.stop()
            # Reset VU meter
            if hasattr(self, 'bottom_bar') and hasattr(self.bottom_bar, 'vu_meter'):
                self.bottom_bar.vu_meter.reset()
    
    def on_position_changed(self, position):
        """Update position slider and time label"""
        if hasattr(self, 'position_slider'):
            self.position_slider.setValue(position)
        
        duration = self.player.duration()
        current_time = self.format_time(position)
        total_time = self.format_time(duration)
        # Update old combined label if present
        if hasattr(self, 'time_label'):
            self.time_label.setText(f"{current_time} / {total_time}")
        # Update PlayerBar labels if available
        try:
            if hasattr(self, 'player_bar') and hasattr(self.player_bar, 'time_current') and hasattr(self.player_bar, 'time_total'):
                self.player_bar.time_current.setText(current_time)
                self.player_bar.time_total.setText(total_time)
        except Exception:
            pass
    
    def on_duration_changed(self, duration):
        """Update duration when media is loaded"""
        if hasattr(self, 'position_slider'):
            self.position_slider.setMaximum(duration)
        # Update total time label at load
        try:
            if hasattr(self, 'player_bar') and hasattr(self.player_bar, 'time_total'):
                self.player_bar.time_total.setText(self.format_time(duration))
        except Exception:
            pass
    
    def on_player_error(self, error):
        """Handle player errors"""
        logger.warning(f"Player error: {error}")
        QMessageBox.warning(self, "Playback Error", 
                           f"Could not play the file: {self.player.errorString()}")
    
    def on_media_status_changed(self, status):
        """Handle media status changes"""
        from PyQt6.QtMultimedia import QMediaPlayer
        
        if status == QMediaPlayer.MediaStatus.EndOfMedia:
            # Track finished, could auto-play next
            logger.info("Track finished")
            self.on_next_track()

    def _show_toast(self, message: str, timeout_ms: int = 2500):
        """Show a small transient toast message centered above the player bar."""
        try:
            # Respect config toggle and default timeout
            cfg = getattr(self, '_cfg', None)
            if cfg and not cfg.get('ui', {}).get('toasts_enabled', True):
                return
            if cfg and (timeout_ms == 2500):
                timeout_ms = int(cfg.get('ui', {}).get('toast_timeout_ms', timeout_ms))
            if hasattr(self, '_toast_widget') and self._toast_widget:
                self._toast_widget.hide()
                self._toast_widget.deleteLater()
            toast = QLabel(message, self)
            toast.setStyleSheet("""
                QLabel {
                    background-color: rgba(0,0,0,180);
                    color: #ffffff;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                }
            """)
            toast.adjustSize()
            # Position: bottom center, above player bar
            geo = self.geometry()
            x = (geo.width() - toast.width()) // 2
            y = geo.height() - toast.height() - 120
            toast.move(max(20, x), max(20, y))
            toast.show()
            self._toast_widget = toast
            QTimer.singleShot(timeout_ms, lambda: (toast.hide(), toast.deleteLater()))
        except Exception as e:
            logger.warning(f"Toast failed: {e}")
    
    def format_time(self, ms):
        """Format milliseconds to MM:SS"""
        if ms is None or ms < 0:
            return "00:00"
        
        seconds = ms // 1000
        minutes = seconds // 60
        seconds = seconds % 60
        return f"{minutes:02d}:{seconds:02d}"
    
    def seek_relative(self, offset_ms):
        """Seek forward or backward by offset milliseconds."""
        try:
            current_pos = self.player.position()
            duration = self.player.duration()
            
            if duration > 0:
                new_pos = max(0, min(duration, current_pos + offset_ms))
                self.player.setPosition(new_pos)
                
                # Show toast notification
                if offset_ms > 0:
                    self._show_toast(f"Seeked forward {offset_ms // 1000}s", 1000)
                else:
                    self._show_toast(f"Seeked backward {abs(offset_ms) // 1000}s", 1000)
        except Exception as e:
            logger.warning(f"Seek failed: {e}")
    
    def toggle_play_pause(self):
        """Toggle between play and pause"""
        from PyQt6.QtMultimedia import QMediaPlayer
        
        if self.player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.player.pause()
        else:
            if self.current_track:
                self.player.play()
            elif self.loaded_files:
                # Play first file if nothing is loaded
                self.play_file(self.loaded_files[0])
    
    def on_stop(self):
        """Stop playback"""
        self.player.stop()
        self.is_playing = False
        if hasattr(self, 'position_slider'):
            self.position_slider.setValue(0)
        if hasattr(self, 'time_label'):
            self.time_label.setText("00:00 / 00:00")
    
    def on_next_track(self):
        """Play next compatible track if possible; fallback to sequential."""
        if not self.loaded_files:
            return
        try:
            current = self.current_track
            if not current:
                self.play_file(self.loaded_files[0])
                return
            candidates = [p for p in self.loaded_files if p != current]
            if candidates:
                current_row = self.database.get_track_by_path(current)
                cur_feat = self._features_for_selection(current, current_row)
                best_path = None
                best_score = -1
                for path in candidates[:200]:
                    row = self.database.get_track_by_path(path)
                    feat = self._features_for_selection(path, row)
                    comp = self.hamms_analyzer.calculate_mix_compatibility(cur_feat, feat)
                    score = comp.get('compatibility_score', 0)
                    # Apply recency penalty for variety
                    if path in self._recent_tracks:
                        # penalty scales with recency (more recent -> higher penalty up to 0.15)
                        idx_from_end = len(self._recent_tracks) - 1 - self._recent_tracks.index(path)
                        k = max(1, min(5, len(self._recent_tracks)))
                        factor = max(0, (k - idx_from_end) / k)
                        score -= 0.15 * factor
                    if score > best_score:
                        best_score = score
                        best_path = path
                if best_path:
                    from pathlib import Path as _P
                    self._show_toast(f"Next compatible: {_P(best_path).name} ({best_score:.0%})")
                    self.play_file(best_path)
                    return
        except Exception as e:
            logger.warning(f"Next compatible selection failed, fallback: {e}")
        # Fallback sequential
        if self.current_track in self.loaded_files:
            current_index = self.loaded_files.index(self.current_track)
            next_index = (current_index + 1) % len(self.loaded_files)
            self.play_file(self.loaded_files[next_index])
        else:
            self.play_file(self.loaded_files[0])

    def _features_for_selection(self, file_path: str, row: dict | None) -> dict:
        """Minimal features for mix compatibility. Prefer DB; fallback to MIK tags."""
        feat = {'file_path': file_path}
        if row:
            bpm = row.get('bpm')
            key = row.get('initial_key') or row.get('key')
            energy = row.get('energy')
            if energy is None and row.get('energy_level') is not None:
                try:
                    energy = float(row.get('energy_level')) / 10.0
                except Exception:
                    energy = None
            if bpm is not None:
                feat['bpm'] = float(bpm)
            if key:
                feat['key'] = str(key)
            if energy is not None:
                feat['energy'] = float(energy)
        if 'bpm' not in feat or 'key' not in feat or 'energy' not in feat:
            try:
                md = MetadataExtractor.extract_metadata(file_path)
                if 'bpm' not in feat and md.get('BPM'):
                    feat['bpm'] = float(md['BPM'])
                if 'key' not in feat and md.get('INITIALKEY'):
                    feat['key'] = str(md['INITIALKEY'])
                if 'energy' not in feat and md.get('ENERGYLEVEL') is not None:
                    feat['energy'] = float(md['ENERGYLEVEL']) / 10.0
            except Exception:
                pass
        feat.setdefault('bpm', 120.0)
        feat.setdefault('key', 'C')
        feat.setdefault('energy', 0.5)
        return feat
    
    def on_previous_track(self):
        """Play previous track in library"""
        if not self.loaded_files:
            return
        
        if self.current_track in self.loaded_files:
            current_index = self.loaded_files.index(self.current_track)
            prev_index = (current_index - 1) % len(self.loaded_files)
            self.play_file(self.loaded_files[prev_index])
        elif self.loaded_files:
            self.play_file(self.loaded_files[-1])
    
    def on_volume_changed(self, value):
        """Update volume with loudness normalization if enabled"""
        base_volume = value / 100.0  # Convert to 0.0-1.0 range
        
        # Apply loudness gain if normalization is enabled
        if self.loudness_normalization_enabled and self.current_gain_db != 0:
            gain_linear = 10 ** (self.current_gain_db / 20.0)
            adjusted_volume = max(0.0, min(1.0, base_volume * gain_linear))
        else:
            adjusted_volume = base_volume
        
        self.audio_output.setVolume(adjusted_volume)
    
    def on_position_slider_moved(self, position):
        """Seek to position when slider is moved by user"""
        self.player.setPosition(position)
    
    def on_search_text_changed(self, text):
        """Filter library based on search text"""
        search_text = text.lower().strip()
        
        # Show/hide album cards based on search
        for card in self.album_cards:
            if not search_text:
                # Show all if search is empty
                card.setVisible(True)
            else:
                # Check if search text matches title or artist
                title_match = search_text in card.title.lower()
                artist_match = search_text in card.artist.lower()
                
                # Also check BPM and key if available
                bpm_match = False
                key_match = False
                if hasattr(card, 'bpm') and card.bpm:
                    bpm_match = search_text in str(card.bpm)
                if hasattr(card, 'key') and card.key:
                    key_match = search_text in card.key.lower()
                
                # Show card if any field matches
                card.setVisible(title_match or artist_match or bpm_match or key_match)
        
    def load_library_from_database(self):
        """Load saved tracks from database on startup"""
        try:
            tracks = self.database.get_all_tracks()
            # Queue and lazy-load
            with self._import_lock:
                self._enqueue_library_items(tracks)
            self._load_more_library_items()
            logger.info(f"Queued {len(tracks)} tracks from database for lazy loading")
            
        except Exception as e:
            logger.error(f"Error loading library from database: {e}")

    def _enqueue_library_items(self, rows: list[dict]):
        try:
            if rows and hasattr(self, 'library_placeholder'):
                self.library_placeholder.setParent(None)
                self.library_placeholder.deleteLater()
                delattr(self, 'library_placeholder')
            for track in rows:
                file_path = track.get('file_path')
                if not file_path or not Path(file_path).exists():
                    continue
                if file_path in self.loaded_files:
                    continue
                self.loaded_files.append(file_path)
                self._library_items_pending.append(track)
        except Exception:
            pass

    def _load_more_library_items(self, batch_size: int | None = None):
        if not hasattr(self, 'library_grid'):
            return
        if getattr(self, '_loading_more', False):
            return
        if not getattr(self, '_library_items_pending', None):
            return
        try:
            self._loading_more = True
            count = batch_size or getattr(self, '_library_batch_size', 40)
            # Remove stretch temporarily
            stretch_index = self.library_grid.count() - 1
            stretch_item = self.library_grid.takeAt(stretch_index) if stretch_index >= 0 else None
            for _ in range(min(count, len(self._library_items_pending))):
                track = self._library_items_pending.pop(0)
                file_path = track['file_path']
                md = {
                    'title': track.get('title', Path(file_path).stem),
                    'artist': track.get('artist', 'Unknown Artist'),
                    'album': track.get('album', 'Unknown Album'),
                    'artwork_pixmap': None
                }
                if track.get('artwork_data'):
                    image = QImage()
                    image.loadFromData(track['artwork_data'])
                    if not image.isNull():
                        md['artwork_pixmap'] = QPixmap.fromImage(image)
                card = AlbumCard(
                    title=md['title'],
                    artist=md['artist'],
                    album_id=file_path,
                    artwork_pixmap=md.get('artwork_pixmap')
                )
                card.clicked.connect(self.play_file)
                self.library_grid.addWidget(card)
                self.album_cards.append(card)
                self._library_loaded_count = getattr(self, '_library_loaded_count', 0) + 1
            if stretch_item:
                self.library_grid.addItem(stretch_item)
        finally:
            self._loading_more = False

    def _on_scroll(self, value: int):
        try:
            sb = self.scroll_area.verticalScrollBar()
            if sb.maximum() - value < 200:
                self._load_more_library_items()
        except Exception:
            pass
    
    def recalculate_hamms(self, file_path):
        """Recalculate HAMMS vector for a track"""
        try:
            logger.info(f"Recalculating HAMMS vector for {Path(file_path).name}")
            
            # Get track metadata from database
            track = self.database.get_track_by_path(file_path)
            if not track:
                logger.warning("Track not found in database")
                return
            
            # Extract current metadata
            metadata = MetadataExtractor.extract_metadata(file_path)
            
            # Get audio features
            logger.debug("Extracting audio features")
            audio_features = self.audio_analyzer.analyze_file(file_path, metadata)
            metadata.update(audio_features)
            
            # Calculate new HAMMS vector
            logger.debug("Calculating 12D HAMMS vector")
            hamms_vector = self.hamms_analyzer.calculate_extended_vector(metadata)
            
            # Display vector
            logger.debug("HAMMS Vector Dimensions:")
            dimension_names = [
                'BPM', 'KEY', 'ENERGY', 'DANCEABILITY', 'VALENCE', 
                'ACOUSTICNESS', 'INSTRUMENTALNESS', 'RHYTHMIC_PATTERN',
                'SPECTRAL_CENTROID', 'TEMPO_STABILITY', 'HARMONIC_COMPLEXITY', 
                'DYNAMIC_RANGE'
            ]
            
            for i, (dim, val) in enumerate(zip(dimension_names, hamms_vector)):
                bar_length = int(val * 20)
                bar = '█' * bar_length + '░' * (20 - bar_length)
                logger.debug(f"{i+1:2}. {dim:20} [{bar}] {val:.4f}")
            
            # Update database
            hamms_metadata = {
                'tempo_stability': audio_features.get('tempo_stability', 0.7),
                'harmonic_complexity': audio_features.get('harmonic_complexity', 0.5),
                'dynamic_range': audio_features.get('dynamic_range', 0.5),
                'energy_curve': audio_features.get('energy_curve', []),
                'transition_points': audio_features.get('transition_points', []),
                'genre_cluster': 0,
                'ml_confidence': 0.95
            }
            try:
                self.db_writer.enqueue('save_hamms', track['id'], hamms_vector.tolist(), hamms_metadata)
            except Exception:
                self.hamms_analyzer.save_hamms_analysis(track['id'], hamms_vector, hamms_metadata)
            # Invalidate caches for this track
            self.hamms_analyzer.invalidate_track(track['id'])
            
            logger.info("HAMMS vector recalculated and saved")
            QMessageBox.information(self, "Success", 
                                  "HAMMS vector recalculated successfully!")
            
        except Exception as e:
            logger.error(f"Error recalculating HAMMS: {e}")
            QMessageBox.critical(self, "Error", f"Failed to recalculate HAMMS: {str(e)}")

    def recalculate_hamms_async(self, file_path: str, source_card: 'AlbumCard' = None):
        from PyQt6.QtWidgets import QProgressDialog
        if not self._validate_audio_path(file_path):
            return
        progress = QProgressDialog("Recalculating HAMMS vector...", "Cancel", 0, 100, self)
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setWindowTitle("HAMMS Recalculation")
        progress.setValue(0)
        try:
            progress.setLabelText(f"Recalculating: {Path(file_path).name}")
        except Exception:
            pass

        worker = RecalcHammsWorker(file_path, self.database.db_path)
        self._workers.append(worker)
        worker.progress.connect(progress.setValue)
        progress.canceled.connect(worker.request_cancel)

        def _finish(combined: dict):
            try:
                row = self.database.get_track_by_path(file_path)
                if row:
                    # Enqueue DB update on single-writer thread
                    try:
                        self.db_writer.enqueue('update_track_features', row['id'], features)
                    except Exception:
                        # Fallback to direct update if enqueue fails
                        self.database.update_track_features(row['id'], features)
                    self.hamms_analyzer.invalidate_track(row['id'])
                self._update_card_badges_from_features(source_card, combined or {})
                QMessageBox.information(self, "Success", "HAMMS vector recalculated successfully!")
            finally:
                progress.close()
                try:
                    self._workers.remove(worker)
                except ValueError:
                    pass
                try:
                    worker.deleteLater()
                except Exception:
                    pass

        worker.finished.connect(_finish)
        self._schedule_analysis_worker(worker, progress, priority=2)
    
    def analyze_with_ai(self, file_path):
        """Analyze audio file with AI (librosa)"""
        try:
            logger.info(f"Analyzing with AI (librosa) - file: {Path(file_path).name}")
            
            # Create progress dialog
            from PyQt6.QtWidgets import QProgressDialog
            progress = QProgressDialog("Analyzing audio with AI...", "Cancel", 0, 100, self)
            progress.setWindowModality(Qt.WindowModality.WindowModal)
            progress.setWindowTitle("AI Analysis")
            progress.show()
            
            # Use unified analyzer
            real_analyzer = self.audio_analyzer
            
            progress.setValue(20)
            logger.debug("Loading audio file for analysis")
            
            # Extract metadata first
            metadata = MetadataExtractor.extract_metadata(file_path)
            
            # Analyze with unified analyzer (respects MixedInKey when available)
            features = real_analyzer.analyze_file(file_path, metadata)
            
            progress.setValue(80)
            logger.info("Analysis results: BPM=%s Key=%s Energy=%s Danceability=%s TempoStability=%s",
                        features.get('bpm', 'N/A'), features.get('key', 'N/A'),
                        features.get('energy', 'N/A'), features.get('danceability', 'N/A'),
                        features.get('tempo_stability', 'N/A'))
            
            # Update database
            track = self.database.get_track_by_path(file_path)
            if track:
                self.database.update_track_features(track['id'], features)
                # Invalidate caches for this track
                self.hamms_analyzer.invalidate_track(track['id'])
                logger.info("Database updated with AI analysis")
            
            progress.setValue(100)
            progress.close()
            
            QMessageBox.information(self, "AI Analysis Complete", 
                                  f"Analysis complete!\nBPM: {features.get('bpm', 'N/A')}\n"
                                  f"Key: {features.get('key', 'N/A')}\n"
                                  f"Energy: {features.get('energy', 'N/A')}")
            
        except Exception as e:
            logger.error(f"Error in AI analysis: {e}")
            QMessageBox.critical(self, "Error", f"AI analysis failed: {str(e)}")

    def _update_card_badges_from_features(self, source_card, features: dict):
        """Refresh an AlbumCard badges and show a small update chip."""
        try:
            if not source_card:
                return
            bpm = features.get('bpm') or features.get('BPM')
            key = features.get('key') or features.get('INITIALKEY') or features.get('initial_key')
            energy = features.get('energy')
            if energy is None:
                energy = features.get('energy_level')
            source_card.set_badges(bpm=bpm, key=key, energy=energy)
            source_card.flash_update("Updated")
        except Exception:
            pass

    def analyze_with_ai_async(self, file_path: str, source_card: 'AlbumCard' = None):
        from PyQt6.QtWidgets import QProgressDialog
        if not self._validate_audio_path(file_path):
            return
        progress = QProgressDialog("Analyzing audio with AI...", "Cancel", 0, 100, self)
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setWindowTitle("AI Analysis")
        progress.setValue(0)
        try:
            progress.setLabelText(f"Analyzing: {Path(file_path).name}")
        except Exception:
            pass

        worker = AnalyzeAIWorker(file_path, self.database.db_path)
        self._workers.append(worker)
        worker.progress.connect(progress.setValue)
        progress.canceled.connect(worker.request_cancel)

        def _finish(features: dict):
            try:
                row = self.database.get_track_by_path(file_path)
                if row:
                    self.hamms_analyzer.invalidate_track(row['id'])
                self._update_card_badges_from_features(source_card, features or {})
                if features:
                    QMessageBox.information(self, "AI Analysis Complete",
                                            f"Analysis complete!\nBPM: {features.get('bpm', 'N/A')}\n"
                                            f"Key: {features.get('key', 'N/A')}\n"
                                            f"Energy: {features.get('energy', features.get('energy_level', 'N/A'))}")
            finally:
                progress.close()
                try:
                    self._workers.remove(worker)
                except ValueError:
                    pass
                try:
                    worker.deleteLater()
                except Exception:
                    pass

        worker.finished.connect(_finish)
        self._schedule_analysis_worker(worker, progress, priority=3)
    
    def check_mixedinkey_data(self, file_path):
        """Check and display MixedInKey data from file"""
        try:
            logger.info(f"Checking MixedInKey data for {Path(file_path).name}")
            
            # Extract metadata
            metadata = MetadataExtractor.extract_metadata(file_path)
            
            # Check for MixedInKey fields
            mik_fields = ['BPM', 'INITIALKEY', 'ENERGYLEVEL', 'BEATGRID', 'CUEPOINTS']
            found_fields = {}
            
            for field in mik_fields:
                if field in metadata:
                    found_fields[field] = metadata[field]
            
            if found_fields:
                logger.info("MixedInKey data found")
                for field, value in found_fields.items():
                    if field == 'BEATGRID' or field == 'CUEPOINTS':
                        logger.debug(f"{field}: Present (base64 encoded)")
                    else:
                        logger.debug(f"{field}: {value}")
                
                msg = "MixedInKey data found:\n"
                for field, value in found_fields.items():
                    if field not in ['BEATGRID', 'CUEPOINTS']:
                        msg += f"• {field}: {value}\n"
                
                QMessageBox.information(self, "MixedInKey Data", msg)
            else:
                logger.info("No MixedInKey data found in this file")
                QMessageBox.warning(self, "No MixedInKey Data", 
                                   "No MixedInKey data found in this file.\n"
                                   "Use 'Analyze with AI' to calculate features.")
            
        except Exception as e:
            logger.error(f"Error checking MixedInKey: {e}")
            QMessageBox.critical(self, "Error", f"Failed to check MixedInKey data: {str(e)}")
    
    def full_reanalysis(self, file_path):
        """Perform complete reanalysis of audio file"""
        try:
            logger.info(f"Full reanalysis for {Path(file_path).name}")
            
            # Step 1: Extract metadata
            logger.debug("Step 1: Extracting metadata")
            metadata = MetadataExtractor.extract_metadata(file_path)
            
            # Step 2: Check for MixedInKey
            logger.debug("Step 2: Checking for MixedInKey data")
            has_mixedinkey = any(k in metadata for k in ['BPM', 'INITIALKEY', 'ENERGYLEVEL'])
            
            if has_mixedinkey:
                logger.info("MixedInKey data found - will use as base")
            else:
                logger.info("No MixedInKey data - will calculate everything")
            
            # Step 3: Analyze audio
            logger.debug("Step 3: Analyzing audio features")
            import time
            start_time = time.time()
            
            # Use MixedInKey-aware analyzer
            audio_features = self.audio_analyzer.analyze_file(file_path, metadata)
            metadata.update(audio_features)
            
            elapsed = time.time() - start_time
            logger.info(f"Analysis complete in {elapsed:.1f} seconds")
            
            # Step 4: Calculate HAMMS
            logger.debug("Step 4: Calculating HAMMS vector")
            hamms_vector = self.hamms_analyzer.calculate_extended_vector(metadata)
            
            # Step 5: Update database
            logger.debug("Step 5: Updating database")
            track = self.database.get_track_by_path(file_path)
            
            if track:
                # Update track features
                self.database.update_track_features(track['id'], metadata)
                
                # Update HAMMS analysis
                hamms_metadata = {
                    'tempo_stability': audio_features.get('tempo_stability', 0.7),
                    'harmonic_complexity': audio_features.get('harmonic_complexity', 0.5),
                    'dynamic_range': audio_features.get('dynamic_range', 0.5),
                    'energy_curve': audio_features.get('energy_curve', []),
                    'transition_points': audio_features.get('transition_points', []),
                    'genre_cluster': 0,
                    'ml_confidence': 0.95
                }
                try:
                    self.db_writer.enqueue('save_hamms', track['id'], hamms_vector.tolist(), hamms_metadata)
                except Exception:
                    self.hamms_analyzer.save_hamms_analysis(track['id'], hamms_vector, hamms_metadata)
                self.hamms_analyzer.invalidate_track(track['id'])
                
                logger.info("Database updated successfully")
            
            # Show results
            logger.info("Full reanalysis complete: source=%s time=%.1fs BPM=%s Key=%s Energy=%s/10",
                        'MixedInKey + AI' if has_mixedinkey else 'AI Only', elapsed,
                        metadata.get('bpm', 'N/A'), metadata.get('key', 'N/A'),
                        metadata.get('energy_level', 'N/A'))
            
            QMessageBox.information(self, "Reanalysis Complete", 
                                  f"Full reanalysis complete!\n\n"
                                  f"Source: {'MixedInKey + AI' if has_mixedinkey else 'AI Only'}\n"
                                  f"Time: {elapsed:.1f} seconds\n"
                                  f"BPM: {metadata.get('bpm', 'N/A')}\n"
                                  f"Key: {metadata.get('key', 'N/A')}\n"
                                  f"Energy: {metadata.get('energy_level', 'N/A')}/10")
            
        except Exception as e:
            logger.error(f"Error in full reanalysis: {e}")
            QMessageBox.critical(self, "Error", f"Full reanalysis failed: {str(e)}")

    def full_reanalysis_async(self, file_path: str, source_card: 'AlbumCard' = None):
        from PyQt6.QtWidgets import QProgressDialog
        if not self._validate_audio_path(file_path):
            return
        progress = QProgressDialog("Running full reanalysis...", "Cancel", 0, 100, self)
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setWindowTitle("Full Reanalysis")
        progress.setValue(0)
        try:
            progress.setLabelText(f"Reanalyzing: {Path(file_path).name}")
        except Exception:
            pass

        base_md = MetadataExtractor.extract_metadata(file_path, with_pixmap=False)
        worker = ImportAnalysisWorker(file_path, base_md, self.database.db_path)
        self._workers.append(worker)

        # Pseudo-progress as ImportAnalysisWorker has no progress hooks
        def _tick():
            val = min(95, progress.value() + 5)
            progress.setValue(val)
        t = QTimer(progress)
        t.timeout.connect(_tick)
        t.start(300)
        progress.canceled.connect(worker.request_cancel)

        def _finish(result: dict):
            try:
                # result may include features/vector; apply via DB writer
                features = result.get('features') or {}
                vector = result.get('vector')
                row = self.database.get_track_by_path(file_path)
                if row and features:
                    try:
                        self.db_writer.enqueue('update_track_features', row['id'], features)
                        if vector:
                            self.db_writer.enqueue('save_hamms', row['id'], vector, features)
                    except Exception:
                        self.database.update_track_features(row['id'], features)
                        if vector:
                            self.hamms_analyzer.save_hamms_analysis(row['id'], np.array(vector), features)
                    self.hamms_analyzer.invalidate_track(row['id'])
                self._update_card_badges_from_features(source_card, features)
                QMessageBox.information(self, "Reanalysis Complete", "Full reanalysis complete. Features and HAMMS updated.")
            finally:
                t.stop()
                progress.close()
                try:
                    self._workers.remove(worker)
                except ValueError:
                    pass
                try:
                    worker.deleteLater()
                except Exception:
                    pass

        worker.finished.connect(_finish)
        self._schedule_analysis_worker(worker, progress, priority=5)

    def _schedule_analysis_worker(self, worker, progress_dialog, priority: int = 5):
        """Start analysis worker if slots available; else enqueue by priority."""
        try:
            # Ensure we'll decrement active count when it finishes
            def _on_finish():
                self._analysis_active = max(0, self._analysis_active - 1)
                self._maybe_start_next_analysis()
                self._update_queue_status()
            worker.finished.connect(_on_finish)
        except Exception:
            pass

        if (self._analysis_active < self._analysis_max) and (not self._analysis_paused):
            self._analysis_active += 1
            worker.start()
        else:
            heapq.heappush(self._analysis_queue, (priority, worker, progress_dialog))
        self._update_queue_status()

    def _maybe_start_next_analysis(self):
        try:
            while (self._analysis_active < self._analysis_max) and (not self._analysis_paused) and self._analysis_queue:
                _, worker, _ = heapq.heappop(self._analysis_queue)
                self._analysis_active += 1
                worker.start()
        except Exception:
            pass
    
    def show_track_metadata(self, file_path):
        """Show all metadata for a specific track"""
        try:
            from metadata_viewer import MetadataViewer
            
            # Create viewer and focus on specific track
            viewer = MetadataViewer(self.database.db_path)
            viewer.setWindowTitle(f"Metadata: {Path(file_path).name}")
            try:
                viewer.select_track_by_path(file_path)
            except Exception:
                pass
            # Keep a reference to avoid premature GC
            if not hasattr(self, '_metadata_viewers'):
                self._metadata_viewers = []
            self._metadata_viewers.append(viewer)
            viewer.destroyed.connect(lambda: self._metadata_viewers.remove(viewer) if viewer in self._metadata_viewers else None)
            viewer.show()
            
            logger.info(f"Opened metadata viewer for: {Path(file_path).name}")
            
        except Exception as e:
            logger.error(f"Error showing metadata: {e}")
            QMessageBox.critical(self, "Error", f"Could not show metadata: {str(e)}")
    
    def apply_dark_theme(self):
        """Apply modern unified dark theme"""
        apply_global_theme(self)
    
    # ============== Menu Action Implementations ==============
    
    def add_folder(self):
        """Add entire folder of audio files"""
        folder = QFileDialog.getExistingDirectory(self, "Select Music Folder")
        if folder:
            from pathlib import Path
            audio_files = []
            for ext in SUPPORTED_AUDIO_EXTS:
                audio_files.extend(Path(folder).rglob(f"*{ext}"))
            if audio_files:
                file_paths = [str(f) for f in audio_files]
                # Use existing add_audio_files logic
                self._process_multiple_files(file_paths)
    
    def export_playlist(self):
        """Export current library as playlist"""
        file_path, selected_filter = QFileDialog.getSaveFileName(
            self, "Export Playlist", "", 
            "M3U Playlist (*.m3u);;CSV (*.csv);;JSON (*.json);;Serato Database (*.crate)"
        )
        if file_path:
            try:
                # Collect tracks to export
                tracks = []
                
                # Try to get tracks from current UI playlist (if available)
                # For now, we'll fallback to database since UI playlist integration is complex
                
                # Fallback: Get all tracks from database
                if not tracks:
                    rows = self.db.conn.execute(
                        "SELECT file_path, duration, artist, title FROM tracks ORDER BY artist, title"
                    ).fetchall()
                    
                    tracks = [
                        {
                            'filepath': row[0],
                            'duration': row[1] if row[1] else -1,
                            'artist': row[2] if row[2] else '',
                            'title': row[3] if row[3] else ''
                        }
                        for row in rows
                    ]
                
                if not tracks:
                    QMessageBox.warning(self, "Export", "No tracks to export")
                    return
                
                # Export using PlaylistExporter
                exporter = PlaylistExporter()
                
                if "CSV" in selected_filter:
                    # Export as CSV
                    result = exporter.export_csv(tracks, file_path)
                    QMessageBox.information(
                        self, "Export Complete",
                        f"CSV exported to:\n{result['path']}\n"
                        f"Tracks: {result['track_count']}"
                    )
                elif "JSON" in selected_filter:
                    # Export as JSON
                    result = exporter.export_json(tracks, file_path)
                    QMessageBox.information(
                        self, "Export Complete",
                        f"JSON exported to:\n{result['path']}\n"
                        f"Tracks: {result['track_count']}"
                    )
                elif "Serato" in selected_filter:
                    # Export to Serato database
                    # Get default Serato root
                    serato_root = exporter.get_default_serato_root()
                    
                    # Extract crate name from file path
                    crate_name = Path(file_path).stem if file_path else "MusicAnalyzerPro"
                    
                    # Export to Serato
                    result = exporter.export_serato_database(tracks, serato_root, crate_name)
                    
                    QMessageBox.information(
                        self, "Export Complete", 
                        f"Serato export complete:\n"
                        f"Database: {result['database_path']}\n"
                        f"Crate: {result['crate_path']}\n"
                        f"Tracks: {result['written']}"
                    )
                else:
                    # Export as M3U
                    exporter.export_m3u(tracks, file_path)
                    
                    QMessageBox.information(self, "Export Complete", 
                                          f"Playlist exported successfully to:\n{file_path}")
                
            except Exception as e:
                logger.error(f"Error exporting playlist: {e}")
                QMessageBox.critical(self, "Export Error", 
                                   f"Failed to export playlist:\n{str(e)}")
    
    def toggle_fullscreen(self):
        """Toggle fullscreen mode"""
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()
    
    def show_queue_status(self):
        """Show detailed queue status"""
        msg = f"Analysis Queue Status:\n\n"
        msg += f"Active workers: {self._analysis_active}/{self._analysis_max}\n"
        msg += f"Queued items: {len(self._analysis_queue)}\n"
        msg += f"Status: {'Paused' if self._analysis_paused else 'Running'}"
        QMessageBox.information(self, "Queue Status", msg)
    
    def toggle_queue_pause(self):
        """Toggle analysis queue pause state"""
        self.toggle_analysis_pause()
    
    def clear_analysis_queue(self):
        """Clear all pending analysis tasks"""
        if QMessageBox.question(self, "Clear Queue", 
                                "Clear all pending analysis tasks?",
                                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                                ) == QMessageBox.StandardButton.Yes:
            self._analysis_queue.clear()
            self._update_queue_status()
            QMessageBox.information(self, "Queue", "Analysis queue cleared")
    
    def toggle_shuffle(self):
        """Toggle shuffle mode"""
        # TODO: Implement shuffle mode
        QMessageBox.information(self, "Shuffle", "Shuffle mode coming soon!")
    
    def toggle_repeat(self):
        """Toggle repeat mode"""
        # TODO: Implement repeat mode
        QMessageBox.information(self, "Repeat", "Repeat mode coming soon!")
    
    def open_preferences(self):
        """Open preferences dialog"""
        from ui.preferences_dialog import PreferencesDialog
        dialog = PreferencesDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            # Apply settings that can take effect immediately
            self.apply_preferences_changes()
    
    def apply_preferences_changes(self):
        """Apply preference changes that can take effect immediately"""
        # Reload configuration
        config = get_config()
        
        # Update grid page size if changed
        new_grid_size = config.get('ui', {}).get('grid_page_size', 100)
        if hasattr(self, 'items_per_page') and self.items_per_page != new_grid_size:
            self.items_per_page = new_grid_size
            # Refresh current view if in grid mode
            if hasattr(self, 'current_view') and self.current_view == 'library':
                self.switch_to_library()
        
        # Update theme if changed
        theme = config.get('ui', {}).get('theme', 'dark')
        if theme == 'light':
            # Apply light theme (future implementation)
            pass
        
        # Update loudness normalization
        loudness_enabled = config.get('playback', {}).get('loudness_normalization', True)
        target_lufs = config.get('playback', {}).get('target_lufs', -18.0)
        # Store for use in playback
        self.loudness_normalization = loudness_enabled
        self.target_lufs = target_lufs
    
    def clear_cache(self):
        """Clear all caches"""
        if QMessageBox.question(self, "Clear Cache",
                                "Clear all cached data?",
                                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                                ) == QMessageBox.StandardButton.Yes:
            self.hamms_analyzer.clear_cache()
            QMessageBox.information(self, "Cache", "Cache cleared successfully")
    
    def reset_database(self):
        """Reset database (dangerous!)"""
        if QMessageBox.warning(self, "Reset Database",
                               "This will DELETE all tracks and analysis data!\nAre you sure?",
                               QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                               ) == QMessageBox.StandardButton.Yes:
            # Double confirmation
            if QMessageBox.critical(self, "Confirm Reset",
                                   "This action cannot be undone!\nReally reset database?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                                   ) == QMessageBox.StandardButton.Yes:
                self.database.clear_database()
                self.loaded_files.clear()
                self.album_cards.clear()
                # Clear grid
                while self.library_grid.count():
                    item = self.library_grid.takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()
                QMessageBox.information(self, "Database", "Database reset complete")
    
    def open_profile(self):
        """Open user profile"""
        # TODO: Implement user profiles
        QMessageBox.information(self, "Profile", "User profiles coming soon!")
    
    def show_statistics(self):
        """Show listening statistics"""
        # TODO: Implement statistics
        QMessageBox.information(self, "Statistics", "Listening statistics coming soon!")
    
    def sign_out(self):
        """Sign out current user"""
        # TODO: Implement user system
        QMessageBox.information(self, "Sign Out", "User system coming soon!")
    
    def show_about(self):
        """Show about dialog"""
        QMessageBox.about(self, "About Music Pro",
                         "<h2>Music Pro</h2>"
                         "<p>Professional Music Player with HAMMS Analysis</p>"
                         "<p>Version 1.0.0</p>"
                         "<p>© 2024 Music Pro Team</p>")
    
    def show_shortcuts(self):
        """Show keyboard shortcuts"""
        shortcuts = """
        <h3>Keyboard Shortcuts</h3>
        <table>
        <tr><td><b>Ctrl+O</b></td><td>Add Files</td></tr>
        <tr><td><b>Ctrl+Shift+O</b></td><td>Add Folder</td></tr>
        <tr><td><b>Ctrl+M</b></td><td>Metadata Viewer</td></tr>
        <tr><td><b>Ctrl+A</b></td><td>Analyze Missing</td></tr>
        <tr><td><b>Space</b></td><td>Play/Pause</td></tr>
        <tr><td><b>Ctrl+→</b></td><td>Next Track</td></tr>
        <tr><td><b>Ctrl+←</b></td><td>Previous Track</td></tr>
        <tr><td><b>F11</b></td><td>Fullscreen</td></tr>
        <tr><td><b>Ctrl+,</b></td><td>Preferences</td></tr>
        <tr><td><b>Ctrl+Q</b></td><td>Exit</td></tr>
        </table>
        """
        msg = QMessageBox(self)
        msg.setWindowTitle("Keyboard Shortcuts")
        msg.setTextFormat(Qt.TextFormat.RichText)
        msg.setText(shortcuts)
        msg.exec()
    
    def _process_multiple_files(self, file_paths):
        """Process multiple files for import"""
        # Reuse existing logic from add_audio_files
        # This is a helper to avoid code duplication
        pass

    def _validate_audio_path(self, file_path: str) -> bool:
        try:
            p = Path(file_path)
            if not p.exists() or not p.is_file():
                QMessageBox.warning(self, "File Not Found", f"Cannot find file:\n{file_path}")
                return False
            from utils.constants import SUPPORTED_AUDIO_EXTS
            if p.suffix.lower() not in SUPPORTED_AUDIO_EXTS:
                QMessageBox.warning(self, "Unsupported Format", f"Unsupported file type: {p.suffix}")
                return False
            return True
        except Exception:
            return False

    def closeEvent(self, event):
        try:
            self.player.stop()
            if hasattr(self, 'hamms_analyzer') and self.hamms_analyzer:
                self.hamms_analyzer.close()
            if hasattr(self, 'database') and self.database:
                self.database.close()
            if hasattr(self, '_analysis_worker') and getattr(self, '_analysis_worker', None):
                self._analysis_worker.wait(1000)
            if hasattr(self, 'db_writer') and self.db_writer:
                try:
                    self.db_writer.stop()
                    self.db_writer.wait(1000)
                except Exception:
                    pass
        finally:
            super().closeEvent(event)


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
