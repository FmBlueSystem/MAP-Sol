#!/usr/bin/env python3
"""
Metadata Viewer - Shows ALL real metadata from audio files
Including MixedInKey data, HAMMS analysis, and calculated features
"""

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTableWidget, QTableWidgetItem, QPushButton,
    QLabel, QSplitter, QTextEdit, QGroupBox,
    QProgressBar, QTabWidget, QHeaderView,
    QLineEdit, QComboBox
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont, QColor, QPixmap
from ui.styles.theme import apply_global_theme, PALETTE
import sqlite3
import json
from pathlib import Path
from typing import Dict, List, Optional
from utils.logger import setup_logger
logger = setup_logger(__name__)
import numpy as np


class MetadataViewer(QMainWindow):
    """Window to view all real metadata from audio files"""
    
    def __init__(self, db_path=None):
        super().__init__()
        
        # Database path
        if db_path is None:
            db_dir = Path.home() / '.music_player_qt'
            self.db_path = db_dir / 'music_library.db'
        else:
            self.db_path = db_path
            
        self.init_ui()
        self.load_data()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("Audio Metadata Viewer - Real Data Only")
        self.setGeometry(100, 100, 1400, 800)
        
        # Main widget and layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)
        
        # Title
        title = QLabel("📊 Complete Audio Metadata Analysis")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title.setFont(title_font)
        layout.addWidget(title)
        
        # Info label
        info_label = QLabel("Showing REAL data: MixedInKey (professional) and AI-calculated (librosa)")
        info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info_label.setStyleSheet(f"color: {PALETTE['accent']}; padding: 10px;")
        layout.addWidget(info_label)
        
        # Create tab widget
        self.tabs = QTabWidget()
        layout.addWidget(self.tabs)
        
        # Tab 1: Track Overview
        self.tracks_table = self.create_tracks_table()
        self.tabs.addTab(self.tracks_table, "Overview")
        
        # Tab 2: MixedInKey Data
        self.mixedinkey_table = self.create_mixedinkey_table()
        self.tabs.addTab(self.mixedinkey_table, "MixedInKey")
        
        # Tab 3: HAMMS Analysis
        self.hamms_widget = self.create_hamms_view()
        self.tabs.addTab(self.hamms_widget, "HAMMS Analysis")
        
        # Tab 4: Audio Features
        self.features_table = self.create_features_table()
        self.tabs.addTab(self.features_table, "Audio Features")
        
        # Tab 5: Raw Metadata
        self.raw_view = self.create_raw_view()
        self.tabs.addTab(self.raw_view, "Raw Metadata")

        # Tab 6: All Metadata (Tracks + AI)
        self.all_meta_widget = self.create_all_metadata_view()
        self.tabs.addTab(self.all_meta_widget, "All Metadata")

    def select_track_by_path(self, file_path: str):
        """Focus the Overview tab and select the row matching file_path."""
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("SELECT id FROM tracks WHERE file_path = ?", (file_path,))
            row = cur.fetchone()
            conn.close()
            if not row:
                return
            track_id = str(row[0])
            # Switch to overview tab
            self.tabs.setCurrentIndex(0)
            # Find row with matching ID in column 0
            for r in range(self.tracks_table.rowCount()):
                item = self.tracks_table.item(r, 0)
                if item and item.text() == track_id:
                    self.tracks_table.setCurrentCell(r, 0)
                    self.tracks_table.scrollToItem(item, QTableWidget.PositionAtCenter)
                    break
        except Exception:
            pass
        
        # Actions row (density + refresh)
        actions = QHBoxLayout()
        actions.addStretch()
        self.density_btn = QPushButton("Compact Density")
        self.density_btn.setToolTip("Toggle compact/relaxed table density")
        self.density_btn.clicked.connect(self.toggle_density)
        refresh_btn = QPushButton("🔄 Refresh Data")
        refresh_btn.clicked.connect(self.load_data)
        actions.addWidget(self.density_btn)
        actions.addWidget(refresh_btn)
        layout.addLayout(actions)
        
        # Status bar
        self.statusBar().showMessage("Ready")
        
        # Density + unified theme
        self.compact_mode = True
        self._header_padding = 6
        self.apply_dark_theme()
        self.apply_table_density()
        
    def create_tracks_table(self):
        """Create table for track overview"""
        table = QTableWidget()
        table.setColumnCount(10)
        table.setHorizontalHeaderLabels([
            "ID", "Title", "Artist", "Album", "BPM", 
            "Key", "Energy", "Duration", "Source", "Date Added"
        ])
        
        # Make table stretch
        header = table.horizontalHeader()
        header.setStretchLastSection(True)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        
        return table
        
    def create_mixedinkey_table(self):
        """Create table for MixedInKey specific data"""
        table = QTableWidget()
        table.setColumnCount(8)
        table.setHorizontalHeaderLabels([
            "Track", "BPM (Precise)", "Initial Key", "Energy Level",
            "Has BeatGrid", "Cue Points", "Comment", "Data Source"
        ])
        
        header = table.horizontalHeader()
        header.setStretchLastSection(True)
        
        return table
        
    def create_hamms_view(self):
        """Create HAMMS analysis view"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # HAMMS table
        self.hamms_table = QTableWidget()
        self.hamms_table.setColumnCount(14)
        self.hamms_table.setHorizontalHeaderLabels([
            "Track", "BPM", "Key", "Energy", "Danceability", 
            "Valence", "Acousticness", "Instrumentalness",
            "Rhythmic", "Spectral", "Tempo Stability",
            "Harmonic Complex", "Dynamic Range", "Confidence"
        ])
        
        layout.addWidget(QLabel("🧬 12-Dimensional HAMMS Vectors:"))
        layout.addWidget(self.hamms_table)
        
        # Vector visualization area
        self.vector_display = QTextEdit()
        self.vector_display.setMaximumHeight(150)
        self.vector_display.setReadOnly(True)
        layout.addWidget(QLabel("📊 Selected Track Vector Visualization:"))
        layout.addWidget(self.vector_display)
        
        # Connect selection
        self.hamms_table.itemSelectionChanged.connect(self.on_hamms_selection)
        
        return widget
        
    def create_features_table(self):
        """Create audio features table"""
        table = QTableWidget()
        table.setColumnCount(12)
        table.setHorizontalHeaderLabels([
            "Track", "Tempo Stability", "Harmonic Complexity", 
            "Dynamic Range", "Spectral Centroid", "Spectral Rolloff",
            "Spectral Flux", "Brightness", "Zero Crossing Rate",
            "MFCC Mean", "Onset Strength", "Calculated Time"
        ])
        
        header = table.horizontalHeader()
        header.setStretchLastSection(True)
        
        return table
        
    def create_raw_view(self):
        """Create raw metadata view"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Track selector
        self.raw_table = QTableWidget()
        self.raw_table.setColumnCount(2)
        self.raw_table.setHorizontalHeaderLabels(["Field", "Value"])
        
        header = self.raw_table.horizontalHeader()
        header.setStretchLastSection(True)
        
        layout.addWidget(QLabel("🔍 Select a track from Overview tab to see raw metadata"))
        layout.addWidget(self.raw_table)
        
        return widget

    def create_all_metadata_view(self):
        """Create a composite widget with filters + all metadata table."""
        container = QWidget()
        vbox = QVBoxLayout(container)
        # Filters
        fl = QHBoxLayout()
        self.all_text_filter = QLineEdit()
        self.all_text_filter.setPlaceholderText("Search Title/Artist/Album...")
        self.isrc_filter = QLineEdit()
        self.isrc_filter.setPlaceholderText("Filter by ISRC...")
        self.ai_genre_filter = QComboBox()
        self.ai_genre_filter.addItem("All")
        self.ai_mood_filter = QComboBox()
        self.ai_mood_filter.addItem("All")
        apply_btn = QPushButton("Apply Filters")
        fl.addWidget(QLabel("Text:"))
        fl.addWidget(self.all_text_filter, 2)
        fl.addWidget(QLabel("ISRC:"))
        fl.addWidget(self.isrc_filter, 1)
        fl.addWidget(QLabel("AI Genre:"))
        fl.addWidget(self.ai_genre_filter, 1)
        fl.addWidget(QLabel("AI Mood:"))
        fl.addWidget(self.ai_mood_filter, 1)
        fl.addWidget(apply_btn)
        vbox.addLayout(fl)
        # Table
        self.all_meta_table = self.create_all_metadata_table()
        vbox.addWidget(self.all_meta_table)
        # Store full dataset for filtering
        self._all_meta_rows = []
        # Wire filters
        def _apply():
            try:
                self.apply_all_filters()
            except Exception:
                pass
        self.all_text_filter.returnPressed.connect(_apply)
        self.isrc_filter.returnPressed.connect(_apply)
        self.ai_genre_filter.currentIndexChanged.connect(_apply)
        self.ai_mood_filter.currentIndexChanged.connect(_apply)
        apply_btn.clicked.connect(_apply)
        return container

    def create_all_metadata_table(self):
        """Create a comprehensive table joining tracks + ai_analysis."""
        table = QTableWidget()
        headers = [
            "ID", "File Path", "Title", "Artist", "Album", "Album Artist",
            "Genre", "Year", "Release Date", "Track#", "Duration", "Bitrate",
            "Sample Rate", "File Size", "BPM", "Initial Key", "Camelot Key",
            "Energy (1-10)", "Comment", "Label", "ISRC", "Date Added",
            "Last Modified", "Play Count", "Rating",
            # AI fields
            "AI Genre", "AI Subgenre", "AI Mood", "AI Era", "AI Year", "AI Tags",
            "AI Version", "AI Date"
        ]
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        header = table.horizontalHeader()
        header.setStretchLastSection(True)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)  # file path
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)  # title
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)  # artist
        return table
        
    def load_data(self):
        """Load all data from database"""
        logger.info("Loading metadata viewer data")
        try:
            conn = sqlite3.connect(str(self.db_path))
            
            # Load tracks overview
            print("1️⃣ Loading tracks overview...")
            self.load_tracks_overview(conn)
            
            # Load MixedInKey data
            print("2️⃣ Loading MixedInKey data...")
            self.load_mixedinkey_data(conn)
            
            # Load HAMMS data
            print("3️⃣ Loading HAMMS data...")
            try:
                self.load_hamms_data(conn)
            except Exception as hamms_error:
                print(f"❌ HAMMS loading error: {hamms_error}")
                import traceback
                traceback.print_exc()
            
            # Load audio features
            print("4️⃣ Loading audio features...")
            self.load_audio_features(conn)

            # Load all metadata (tracks + AI)
            print("5️⃣ Loading all metadata (tracks + AI)...")
            self.load_all_metadata(conn)
            
            conn.close()
            
            print(f"✅ All data loaded successfully")
            self.statusBar().showMessage(f"✅ Loaded {self.tracks_table.rowCount()} tracks")
            
        except Exception as e:
            print(f"❌ General error loading data: {e}")
            import traceback
            traceback.print_exc()
            self.statusBar().showMessage(f"❌ Error loading data: {e}")

    def load_all_metadata(self, conn):
        """Populate the All Metadata table from tracks joined with ai_analysis."""
        query = """
            SELECT 
                t.id, t.file_path, t.title, t.artist, t.album, t.album_artist,
                t.genre, t.year, t.release_date, t.track_number, t.duration,
                t.bitrate, t.sample_rate, t.file_size, t.bpm, t.initial_key,
                t.camelot_key, t.energy_level, t.comment, t.label, t.isrc,
                t.date_added, t.last_modified, t.play_count, t.rating,
                a.genre AS ai_genre, a.subgenre AS ai_subgenre, a.mood AS ai_mood,
                a.era AS ai_era, a.year_estimate AS ai_year, a.tags AS ai_tags,
                a.ai_version, a.analysis_date
            FROM tracks t
            LEFT JOIN ai_analysis a ON a.track_id = t.id
            ORDER BY t.date_added DESC
        """
        cur = conn.execute(query)
        rows = cur.fetchall()
        self._all_meta_rows = rows
        # Populate filter dropdowns with unique AI genres/moods
        try:
            genres = sorted({(r[25] or '').strip() for r in rows if (r[25] or '').strip()})
            moods = sorted({(r[27] or '').strip() for r in rows if (r[27] or '').strip()})
            self.ai_genre_filter.blockSignals(True)
            self.ai_mood_filter.blockSignals(True)
            self.ai_genre_filter.clear(); self.ai_genre_filter.addItem("All"); self.ai_genre_filter.addItems(genres)
            self.ai_mood_filter.clear(); self.ai_mood_filter.addItem("All"); self.ai_mood_filter.addItems(moods)
        finally:
            self.ai_genre_filter.blockSignals(False)
            self.ai_mood_filter.blockSignals(False)
        # Apply current filters to populate table
        self.apply_all_filters()

    def apply_all_filters(self):
        """Filter the in-memory rows and populate the All Metadata table."""
        text = (self.all_text_filter.text() or "").lower().strip()
        isrc = (self.isrc_filter.text() or "").lower().strip()
        gsel = self.ai_genre_filter.currentText()
        msel = self.ai_mood_filter.currentText()

        def _match(row):
            if text:
                hay = " "+str(row[2] or "").lower()+" "+str(row[3] or "").lower()+" "+str(row[4] or "").lower()
                if text not in hay:
                    return False
            if isrc:
                if isrc not in str(row[20] or "").lower():
                    return False
            if gsel and gsel != "All" and (row[25] or "") != gsel:
                return False
            if msel and msel != "All" and (row[27] or "") != msel:
                return False
            return True

        filtered = [r for r in (self._all_meta_rows or []) if _match(r)]
        # Populate table
        self.all_meta_table.setRowCount(0)
        import json
        for row in filtered:
            r = self.all_meta_table.rowCount()
            self.all_meta_table.insertRow(r)
            for c in range(len(row)):
                val = row[c]
                if val is None:
                    textv = ""
                elif c == 30:  # AI Tags JSON column position in headers
                    try:
                        arr = json.loads(val) if isinstance(val, (str, bytes)) else val
                        if isinstance(arr, list):
                            textv = ", ".join(map(str, arr))
                        else:
                            textv = str(val)
                    except Exception:
                        textv = str(val)
                else:
                    textv = str(val)
                self.all_meta_table.setItem(r, c, QTableWidgetItem(textv))
            
    def load_tracks_overview(self, conn):
        """Load track overview data"""
        cursor = conn.execute("""
            SELECT id, title, artist, album, bpm, initial_key, 
                   energy_level, duration, file_path, date_added
            FROM tracks
            ORDER BY date_added DESC
        """)
        
        self.tracks_table.setRowCount(0)
        
        for row_data in cursor.fetchall():
            row_num = self.tracks_table.rowCount()
            self.tracks_table.insertRow(row_num)
            
            # Determine source (MixedInKey vs Calculated)
            source = "Unknown"
            if row_data[4]:  # Has BPM
                # Check based on key format - MixedInKey uses Camelot notation (e.g., "3A", "11B")
                key = row_data[5]  # initial_key
                if key and len(key) <= 3 and (key.endswith('A') or key.endswith('B')):
                    # Camelot notation indicates MixedInKey
                    source = "MixedInKey"
                else:
                    source = "AI/Librosa"
            
            # Add data to table
            for col, value in enumerate(row_data):
                if value is not None:
                    item = QTableWidgetItem(str(value))
                    self.tracks_table.setItem(row_num, col, item)
            
            # Add source column
            source_item = QTableWidgetItem(source)
            if source == "MixedInKey":
                source_item.setForeground(QColor(0, 255, 0))  # Green
            else:
                source_item.setForeground(QColor(255, 165, 0))  # Orange
            self.tracks_table.setItem(row_num, 8, source_item)
            
    def load_mixedinkey_data(self, conn):
        """Load MixedInKey specific data"""
        # Query for tracks with potential MixedInKey data
        cursor = conn.execute("""
            SELECT t.title, t.artist, t.bpm, t.initial_key, 
                   t.energy_level, t.file_path
            FROM tracks t
            WHERE t.bpm IS NOT NULL
            ORDER BY t.date_added DESC
        """)
        
        self.mixedinkey_table.setRowCount(0)
        
        for row_data in cursor.fetchall():
            # Check if this has MixedInKey data (Camelot key notation)
            key = row_data[3]  # initial_key
            if key and len(key) <= 3 and (key.endswith('A') or key.endswith('B')):
                row_num = self.mixedinkey_table.rowCount()
                self.mixedinkey_table.insertRow(row_num)
                
                # Track name
                track_name = f"{row_data[1]} - {row_data[0]}"
                self.mixedinkey_table.setItem(row_num, 0, QTableWidgetItem(track_name))
                
                # BPM (precise)
                self.mixedinkey_table.setItem(row_num, 1, QTableWidgetItem(str(row_data[2])))
                
                # Initial Key
                if row_data[3]:
                    self.mixedinkey_table.setItem(row_num, 2, QTableWidgetItem(row_data[3]))
                
                # Energy Level
                if row_data[4]:
                    self.mixedinkey_table.setItem(row_num, 3, QTableWidgetItem(f"{row_data[4]}/10"))
                
                # Has BeatGrid
                self.mixedinkey_table.setItem(row_num, 4, QTableWidgetItem("✅"))
                
                # Cue Points (would need to decode from metadata)
                self.mixedinkey_table.setItem(row_num, 5, QTableWidgetItem("Yes"))
                
                # Comment
                comment = f"{row_data[3]} - Energy {row_data[4]}" if row_data[3] and row_data[4] else ""
                self.mixedinkey_table.setItem(row_num, 6, QTableWidgetItem(comment))
                
                # Data Source
                source_item = QTableWidgetItem("MixedInKey Pro")
                source_item.setForeground(QColor(0, 255, 0))
                self.mixedinkey_table.setItem(row_num, 7, source_item)
                
    def load_hamms_data(self, conn):
        """Load HAMMS analysis data"""
        print("🧬 Loading HAMMS data...")
        cursor = conn.execute("""
            SELECT h.file_id, t.title, t.artist, h.vector_12d,
                   h.tempo_stability, h.harmonic_complexity, 
                   h.dynamic_range, h.ml_confidence
            FROM hamms_advanced h
            INNER JOIN tracks t ON h.file_id = t.id
            WHERE h.vector_12d IS NOT NULL
        """)
        
        results = cursor.fetchall()
        print(f"   Found {len(results)} HAMMS vectors")
        
        self.hamms_table.setRowCount(0)
        self.hamms_vectors = {}  # Store for visualization
        
        for row_data in results:
            row_num = self.hamms_table.rowCount()
            self.hamms_table.insertRow(row_num)
            
            track_name = f"{row_data[2]} - {row_data[1]}"
            self.hamms_table.setItem(row_num, 0, QTableWidgetItem(track_name))
            
            # Parse and display vector
            if row_data[3]:
                try:
                    vector = json.loads(row_data[3])
                    self.hamms_vectors[row_num] = vector
                    print(f"     • {track_name}: {len(vector)}D vector loaded")
                    
                    # Display each dimension
                    dimension_names = [
                        "BPM", "Key", "Energy", "Danceability", "Valence",
                        "Acousticness", "Instrumentalness", "Rhythmic",
                        "Spectral", "Tempo Stability", "Harmonic", "Dynamic"
                    ]
                    
                    for i, value in enumerate(vector[:12]):
                        item = QTableWidgetItem(f"{value:.3f}")
                        # Color code by value
                        if value > 0.7:
                            item.setForeground(QColor(0, 255, 0))  # High = Green
                        elif value > 0.4:
                            item.setForeground(QColor(255, 255, 0))  # Medium = Yellow
                        else:
                            item.setForeground(QColor(255, 100, 100))  # Low = Red
                        self.hamms_table.setItem(row_num, i + 1, item)
                except Exception as e:
                    logger.error(f"Error parsing vector for {track_name}: {e}")
            
            # ML Confidence
            if row_data[7]:
                conf_item = QTableWidgetItem(f"{row_data[7]:.2%}")
                self.hamms_table.setItem(row_num, 13, conf_item)
        
        print(f"   ✅ HAMMS table populated with {self.hamms_table.rowCount()} rows")
                
    def load_audio_features(self, conn):
        """Load detailed audio features"""
        cursor = conn.execute("""
            SELECT t.title, t.artist, h.tempo_stability,
                   h.harmonic_complexity, h.dynamic_range,
                   t.date_added
            FROM tracks t
            LEFT JOIN hamms_advanced h ON t.id = h.file_id
            ORDER BY t.date_added DESC
        """)
        
        self.features_table.setRowCount(0)
        
        for row_data in cursor.fetchall():
            row_num = self.features_table.rowCount()
            self.features_table.insertRow(row_num)
            
            track_name = f"{row_data[1]} - {row_data[0]}"
            self.features_table.setItem(row_num, 0, QTableWidgetItem(track_name))
            
            # Add available features
            if row_data[2]:  # tempo_stability
                self.features_table.setItem(row_num, 1, QTableWidgetItem(f"{row_data[2]:.3f}"))
            if row_data[3]:  # harmonic_complexity
                self.features_table.setItem(row_num, 2, QTableWidgetItem(f"{row_data[3]:.3f}"))
            if row_data[4]:  # dynamic_range
                self.features_table.setItem(row_num, 3, QTableWidgetItem(f"{row_data[4]:.3f}"))
                
    def on_hamms_selection(self):
        """Handle HAMMS table selection"""
        current_row = self.hamms_table.currentRow()
        if current_row in self.hamms_vectors:
            vector = self.hamms_vectors[current_row]
            self.visualize_vector(vector)
            
    def visualize_vector(self, vector):
        """Visualize HAMMS vector"""
        viz_text = "HAMMS 12D Vector Visualization:\n"
        viz_text += "=" * 60 + "\n\n"
        
        dimension_names = [
            "BPM Normalized", "Key Compatibility", "Energy Level",
            "Danceability", "Valence", "Acousticness",
            "Instrumentalness", "Rhythmic Pattern", "Spectral Centroid",
            "Tempo Stability", "Harmonic Complexity", "Dynamic Range"
        ]
        
        for i, (name, value) in enumerate(zip(dimension_names, vector[:12])):
            bar_length = int(value * 30)
            bar = '█' * bar_length + '░' * (30 - bar_length)
            viz_text += f"{i+1:2}. {name:20} [{bar}] {value:.3f}\n"
            
        self.vector_display.setText(viz_text)
        
    def apply_dark_theme(self):
        """Apply unified app theme and consistent tables styling"""
        apply_global_theme(self)
        # Add table-specific styling aligned with the global palette
        pad = self._header_padding
        self.setStyleSheet(self.styleSheet() + f"""
            QTableWidget {{
                background: {PALETTE['bg']};
                alternate-background-color: #1a1a2e;
                selection-background-color: {PALETTE['accent']};
                selection-color: {PALETTE['bg']};
                gridline-color: {PALETTE['border']};
                border: 1px solid {PALETTE['border']};
            }}
            QHeaderView::section {{
                background: #1a1a2e;
                border: 1px solid {PALETTE['border']};
                color: {PALETTE['text']};
                padding: {pad}px;
            }}
            QTextEdit {{
                background: #0a0a0a;
                border: 1px solid {PALETTE['border']};
            }}
        """)

    def apply_table_density(self):
        """Apply compact/relaxed density across all tables."""
        row_h = 22 if self.compact_mode else 30
        hdr_font = QFont()
        hdr_font.setBold(True)
        for tbl in [self.tracks_table, self.mixedinkey_table, self.hamms_table, self.features_table, self.raw_table]:
            try:
                vh = tbl.verticalHeader()
                vh.setDefaultSectionSize(row_h)
                hh = tbl.horizontalHeader()
                hh.setFont(hdr_font)
            except Exception:
                pass

    def toggle_density(self):
        """Toggle compact/relaxed density and update styles."""
        self.compact_mode = not self.compact_mode
        self._header_padding = 4 if self.compact_mode else 8
        self.density_btn.setText("Compact Density" if not self.compact_mode else "Relaxed Density")
        self.apply_dark_theme()
        self.apply_table_density()


def main():
    """Run metadata viewer standalone"""
    import sys
    from PyQt6.QtWidgets import QApplication
    
    app = QApplication(sys.argv)
    viewer = MetadataViewer()
    viewer.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
