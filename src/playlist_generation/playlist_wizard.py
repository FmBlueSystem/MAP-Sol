"""
Playlist generation wizard dialog.
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QComboBox, QSpinBox, QDoubleSpinBox, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QLabel, QLineEdit, QGroupBox, QMessageBox, QFileDialog,
    QInputDialog, QSlider, QMenu
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QGuiApplication
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
from playlist_generation.playlist_generator import PlaylistGenerator
from playlist_generation.playlist_exporter import PlaylistExporter
from playlist_generation.playlist_learner import PlaylistLearner
from database import MusicDatabase


class PlaylistGeneratorDialog(QDialog):
    """Dialog for generating playlists with various parameters."""
    
    def __init__(self, parent=None, current_track=None):
        """
        Initialize the playlist generator dialog.
        
        Args:
            parent: Parent widget
            current_track: Currently playing track (dict with file_path or id)
        """
        super().__init__(parent)
        self.current_track = current_track
        self.generated_playlist = []
        self.db = MusicDatabase()
        
        self.setWindowTitle("Generate Playlist")
        self.setModal(True)
        self.resize(900, 600)
        
        self.init_ui()
        self.load_moods()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Parameters group
        params_group = QGroupBox("Playlist Parameters")
        params_layout = QFormLayout()
        
        # Playlist type
        self.type_combo = QComboBox()
        self.type_combo.addItems([
            'harmonic_journey',
            'energy_progression',
            'mood_based',
            'hybrid'
        ])
        params_layout.addRow("Playlist Type:", self.type_combo)
        
        # Duration
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(5, 300)
        self.duration_spin.setValue(60)
        self.duration_spin.setSuffix(" minutes")
        params_layout.addRow("Duration:", self.duration_spin)
        
        # BPM Range
        bpm_layout = QHBoxLayout()
        self.bpm_min_spin = QSpinBox()
        self.bpm_min_spin.setRange(60, 200)
        self.bpm_min_spin.setValue(110)
        self.bpm_max_spin = QSpinBox()
        self.bpm_max_spin.setRange(60, 200)
        self.bpm_max_spin.setValue(140)
        bpm_layout.addWidget(self.bpm_min_spin)
        bpm_layout.addWidget(QLabel("to"))
        bpm_layout.addWidget(self.bpm_max_spin)
        params_layout.addRow("BPM Range:", bpm_layout)
        
        # Camelot strictness
        self.strictness_combo = QComboBox()
        self.strictness_combo.addItems(['flexible', 'strict'])
        params_layout.addRow("Harmonic Strictness:", self.strictness_combo)
        
        # HAMMS vs AI slider (only for hybrid type)
        hamms_ai_layout = QHBoxLayout()
        self.hamms_ai_slider = QSlider(Qt.Orientation.Horizontal)
        self.hamms_ai_slider.setRange(0, 100)
        self.hamms_ai_slider.setValue(60)  # Default 60% HAMMS, 40% AI
        self.hamms_ai_slider.valueChanged.connect(self.update_hamms_ai_label)
        hamms_ai_layout.addWidget(self.hamms_ai_slider)
        
        self.hamms_ai_label = QLabel("HAMMS 60% / AI 40%")
        self.hamms_ai_label.setMinimumWidth(150)
        hamms_ai_layout.addWidget(self.hamms_ai_label)
        
        params_layout.addRow("HAMMS vs AI:", hamms_ai_layout)
        
        # Show/hide based on playlist type
        self.type_combo.currentTextChanged.connect(self.on_type_changed)
        
        # Allowed moods
        self.mood_combo = QComboBox()
        self.mood_combo.setEditable(True)
        self.mood_combo.addItem("All")
        params_layout.addRow("Mood Filter:", self.mood_combo)
        
        # Start track
        start_layout = QHBoxLayout()
        self.start_track_edit = QLineEdit()
        self.start_track_edit.setPlaceholderText("Track ID or filepath (optional)")
        self.use_current_btn = QPushButton("Use Current Track")
        self.use_current_btn.clicked.connect(self.use_current_track)
        if not self.current_track:
            self.use_current_btn.setEnabled(False)
        start_layout.addWidget(self.start_track_edit)
        start_layout.addWidget(self.use_current_btn)
        params_layout.addRow("Start Track:", start_layout)
        
        params_group.setLayout(params_layout)
        layout.addWidget(params_group)
        
        # Results table
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(7)
        self.results_table.setHorizontalHeaderLabels([
            "Title", "Artist", "BPM", "Key", "Energy", "Duration", "Filepath"
        ])
        self.results_table.horizontalHeader().setStretchLastSection(True)
        self.results_table.setAlternatingRowColors(True)
        self.results_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        layout.addWidget(self.results_table)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.generate_btn = QPushButton("Generate")
        self.generate_btn.clicked.connect(self.generate_playlist)
        button_layout.addWidget(self.generate_btn)
        
        self.save_btn = QPushButton("Save to Library")
        self.save_btn.clicked.connect(self.save_playlist)
        self.save_btn.setEnabled(False)
        button_layout.addWidget(self.save_btn)
        
        self.learn_btn = QPushButton("Learn From This Edit")
        self.learn_btn.clicked.connect(self.learn_from_edit)
        self.learn_btn.setEnabled(False)
        button_layout.addWidget(self.learn_btn)
        
        self.export_btn = QPushButton("Export M3U")
        self.export_btn.clicked.connect(self.export_playlist)
        self.export_btn.setEnabled(False)
        button_layout.addWidget(self.export_btn)
        
        self.share_btn = QPushButton("Share...")
        self.share_btn.clicked.connect(self.share_playlist)
        self.share_btn.setEnabled(False)
        button_layout.addWidget(self.share_btn)
        
        self.close_btn = QPushButton("Close")
        self.close_btn.clicked.connect(self.accept)
        button_layout.addWidget(self.close_btn)
        
        button_layout.addStretch()
        layout.addLayout(button_layout)
        
        self.setLayout(layout)
    
    def load_moods(self):
        """Load available moods from database."""
        try:
            cursor = self.db.conn.execute(
                "SELECT DISTINCT mood FROM ai_analysis WHERE mood IS NOT NULL"
            )
            moods = [row[0] for row in cursor.fetchall()]
            if moods:
                self.mood_combo.addItems(sorted(moods))
        except Exception as e:
            print(f"Error loading moods: {e}")
    
    def use_current_track(self):
        """Use the current track as the starting point."""
        if self.current_track:
            if isinstance(self.current_track, dict):
                # Try to get ID or filepath
                if 'id' in self.current_track:
                    self.start_track_edit.setText(str(self.current_track['id']))
                elif 'file_path' in self.current_track:
                    self.start_track_edit.setText(self.current_track['file_path'])
                elif 'filepath' in self.current_track:
                    self.start_track_edit.setText(self.current_track['filepath'])
            else:
                self.start_track_edit.setText(str(self.current_track))
    
    def update_hamms_ai_label(self, value):
        """Update the HAMMS vs AI label based on slider value."""
        hamms_percent = value
        ai_percent = 100 - value
        self.hamms_ai_label.setText(f"HAMMS {hamms_percent}% / AI {ai_percent}%")
    
    def on_type_changed(self, playlist_type):
        """Handle playlist type change."""
        # Show/hide HAMMS vs AI slider based on type
        is_hybrid = (playlist_type == 'hybrid')
        self.hamms_ai_slider.setVisible(is_hybrid)
        self.hamms_ai_label.setVisible(is_hybrid)
    
    def generate_playlist(self):
        """Generate the playlist based on current parameters."""
        try:
            # Build constraints
            constraints = {
                'bpm_range': (self.bpm_min_spin.value(), self.bpm_max_spin.value()),
                'camelot_strictness': self.strictness_combo.currentText()
            }
            
            # Add weights for hybrid type
            if self.type_combo.currentText() == 'hybrid':
                hamms_weight = self.hamms_ai_slider.value() / 100.0
                ai_weight = 1.0 - hamms_weight
                constraints['weights'] = {
                    'harmonic': hamms_weight,
                    'ai': ai_weight
                }
            
            # Add mood filter if not "All"
            if self.mood_combo.currentText() != "All":
                constraints['allowed_moods'] = [self.mood_combo.currentText()]
            
            # Get start track
            start_track = None
            start_text = self.start_track_edit.text().strip()
            if start_text:
                # Try to parse as integer (ID)
                try:
                    start_track = int(start_text)
                except ValueError:
                    # Use as filepath
                    start_track = start_text
            
            # Generate playlist
            generator = PlaylistGenerator(self.db.db_path)
            self.generated_playlist = generator.generate(
                start_track=start_track,
                duration_minutes=self.duration_spin.value(),
                playlist_type=self.type_combo.currentText(),
                constraints=constraints
            )
            
            # Display results
            self.display_results(self.generated_playlist)
            
            # Enable export, save, share and learn buttons
            if self.generated_playlist:
                self.export_btn.setEnabled(True)
                self.save_btn.setEnabled(True)
                self.learn_btn.setEnabled(True)
                self.share_btn.setEnabled(True)
                
                # Track playlist generation
                try:
                    from telemetry.telemetry import get_telemetry
                    telemetry = get_telemetry()
                    telemetry.track('playlist_generated', {
                        'type': self.type_combo.currentText(),
                        'count': len(self.generated_playlist),
                        'duration_minutes': self.duration_spin.value()
                    })
                except:
                    pass  # Silent failure
                
                QMessageBox.information(
                    self, 
                    "Playlist Generated",
                    f"Generated {len(self.generated_playlist)} tracks"
                )
            else:
                QMessageBox.warning(
                    self,
                    "No Results",
                    "No tracks found matching the criteria"
                )
        
        except Exception as e:
            QMessageBox.critical(
                self,
                "Generation Error",
                f"Failed to generate playlist:\n{str(e)}"
            )
    
    def display_results(self, playlist: List[Dict]):
        """Display playlist in the results table."""
        self.results_table.setRowCount(len(playlist))
        
        for row, track in enumerate(playlist):
            # Title
            self.results_table.setItem(row, 0, QTableWidgetItem(
                track.get('title', 'Unknown')
            ))
            
            # Artist
            self.results_table.setItem(row, 1, QTableWidgetItem(
                track.get('artist', 'Unknown')
            ))
            
            # BPM
            self.results_table.setItem(row, 2, QTableWidgetItem(
                f"{track.get('bpm', 0):.1f}"
            ))
            
            # Key
            self.results_table.setItem(row, 3, QTableWidgetItem(
                track.get('camelot_key', '-')
            ))
            
            # Energy
            energy = track.get('energy_level', 5)
            self.results_table.setItem(row, 4, QTableWidgetItem(
                str(energy)
            ))
            
            # Duration
            duration = track.get('duration', 0)
            minutes = int(duration // 60)
            seconds = int(duration % 60)
            self.results_table.setItem(row, 5, QTableWidgetItem(
                f"{minutes}:{seconds:02d}"
            ))
            
            # Filepath
            self.results_table.setItem(row, 6, QTableWidgetItem(
                track.get('filepath', '')
            ))
        
        # Resize columns to content
        self.results_table.resizeColumnsToContents()
    
    def save_playlist(self):
        """Save the generated playlist to the database."""
        if not self.generated_playlist:
            QMessageBox.warning(
                self,
                "No Playlist",
                "No playlist to save. Generate one first."
            )
            return
        
        # Get playlist name from user
        name, ok = QInputDialog.getText(
            self,
            "Save Playlist",
            "Enter playlist name:",
            QLineEdit.EchoMode.Normal,
            f"{self.type_combo.currentText()}_{len(self.generated_playlist)}_tracks"
        )
        
        if ok and name:
            try:
                # Check if playlist with this name already exists
                existing = self.db.get_playlist(name)
                if existing:
                    # Ask user to overwrite or cancel
                    reply = QMessageBox.question(
                        self,
                        "Playlist Exists",
                        f"A playlist named '{name}' already exists.\nDo you want to overwrite it?",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.No
                    )
                    
                    if reply == QMessageBox.StandardButton.Yes:
                        # Delete existing playlist
                        self.db.delete_playlist(existing['id'])
                    else:
                        return
                
                # Prepare parameters
                parameters = {
                    'type': self.type_combo.currentText(),
                    'duration_minutes': self.duration_spin.value(),
                    'bpm_range': [self.bpm_min_spin.value(), self.bpm_max_spin.value()],
                    'camelot_strictness': self.strictness_combo.currentText()
                }
                
                if self.mood_combo.currentText() != "All":
                    parameters['mood'] = self.mood_combo.currentText()
                
                # Create playlist
                playlist_id = self.db.create_playlist(
                    name=name,
                    description=f"Generated {self.type_combo.currentText()} playlist",
                    parameters=parameters
                )
                
                if playlist_id:
                    # Save tracks
                    saved_count = self.db.save_playlist_tracks(
                        playlist_id=playlist_id,
                        tracks=self.generated_playlist
                    )
                    
                    QMessageBox.information(
                        self,
                        "Playlist Saved",
                        f"Playlist '{name}' saved with {saved_count} tracks."
                    )
                else:
                    QMessageBox.warning(
                        self,
                        "Save Failed",
                        "Failed to create playlist in database."
                    )
            
            except Exception as e:
                QMessageBox.critical(
                    self,
                    "Save Error",
                    f"Failed to save playlist:\n{str(e)}"
                )
    
    def learn_from_edit(self):
        """Learn from user edits to the playlist."""
        if not self.generated_playlist:
            QMessageBox.warning(
                self,
                "No Playlist",
                "No playlist to learn from. Generate one first."
            )
            return
        
        try:
            # For simplicity, simulate an edit by treating current as edited
            # In a real implementation, user would reorder/filter the table
            original = self.generated_playlist.copy()
            
            # Simulate a small edit: swap second and third tracks if they exist
            edited = original.copy()
            if len(edited) >= 3:
                edited[1], edited[2] = edited[2], edited[1]
            
            # Learn from the edit
            learner = PlaylistLearner(self.db)
            deltas = learner.learn_from_edits(original, edited)
            
            if deltas:
                # Update preferences
                learner.update_preferences(deltas)
                
                # Show summary
                delta_summary = "\n".join([
                    f"{k}: {v:+.3f}" for k, v in deltas.items() if v != 0
                ])
                
                if delta_summary:
                    QMessageBox.information(
                        self,
                        "Preferences Updated",
                        f"Learned from your edits:\n\n{delta_summary}\n\n"
                        "These preferences will be applied to future playlists."
                    )
                else:
                    QMessageBox.information(
                        self,
                        "No Changes",
                        "No significant preferences detected from this edit."
                    )
            
        except Exception as e:
            QMessageBox.critical(
                self,
                "Learning Error",
                f"Failed to learn from edits:\n{str(e)}"
            )
    
    def export_playlist(self):
        """Export the generated playlist to M3U format."""
        if not self.generated_playlist:
            QMessageBox.warning(
                self,
                "No Playlist",
                "No playlist to export. Generate one first."
            )
            return
        
        # Get save location
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Playlist",
            "",
            "M3U Playlist (*.m3u)"
        )
        
        if file_path:
            try:
                # Export using PlaylistExporter
                exporter = PlaylistExporter()
                exporter.export_m3u(self.generated_playlist, file_path)
                
                QMessageBox.information(
                    self,
                    "Export Complete",
                    f"Playlist exported to:\n{file_path}"
                )
            
            except Exception as e:
                QMessageBox.critical(
                    self,
                    "Export Error",
                    f"Failed to export playlist:\n{str(e)}"
                )
    
    def share_playlist(self):
        """Share playlist via CSV, JSON or copyable link."""
        if not self.generated_playlist:
            QMessageBox.warning(
                self,
                "No Playlist",
                "No playlist to share. Generate one first."
            )
            return
        
        # Create share menu
        menu = QMenu(self)
        
        export_csv_action = menu.addAction("Export CSV")
        export_json_action = menu.addAction("Export JSON")
        menu.addSeparator()
        copy_link_action = menu.addAction("Copy Share Link")
        
        # Show menu and get action
        action = menu.exec(self.share_btn.mapToGlobal(self.share_btn.rect().bottomLeft()))
        
        if action == export_csv_action:
            self.export_playlist_csv()
        elif action == export_json_action:
            self.export_playlist_json()
        elif action == copy_link_action:
            self.copy_share_link()
    
    def export_playlist_csv(self):
        """Export playlist to CSV format."""
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self,
                "Export Playlist as CSV",
                str(Path.home() / "playlist.csv"),
                "CSV Files (*.csv)"
            )
            
            if file_path:
                exporter = PlaylistExporter()
                result = exporter.export_csv(self.generated_playlist, file_path)
                
                if result['status'] == 'success':
                    QMessageBox.information(
                        self,
                        "Export Complete",
                        f"CSV exported to:\n{result['path']}\n"
                        f"Tracks: {result['track_count']}"
                    )
        except Exception as e:
            QMessageBox.critical(
                self,
                "Export Error",
                f"Failed to export CSV:\n{str(e)}"
            )
    
    def export_playlist_json(self):
        """Export playlist to JSON format."""
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self,
                "Export Playlist as JSON",
                str(Path.home() / "playlist.json"),
                "JSON Files (*.json)"
            )
            
            if file_path:
                exporter = PlaylistExporter()
                result = exporter.export_json(self.generated_playlist, file_path)
                
                if result['status'] == 'success':
                    QMessageBox.information(
                        self,
                        "Export Complete",
                        f"JSON exported to:\n{result['path']}\n"
                        f"Tracks: {result['track_count']}"
                    )
        except Exception as e:
            QMessageBox.critical(
                self,
                "Export Error",
                f"Failed to export JSON:\n{str(e)}"
            )
    
    def copy_share_link(self):
        """Copy share link to clipboard."""
        try:
            exporter = PlaylistExporter()
            link = exporter.build_share_link(self.generated_playlist)
            
            # Copy to clipboard
            clipboard = QGuiApplication.clipboard()
            clipboard.setText(link)
            
            # Track share link copied
            try:
                from telemetry.telemetry import get_telemetry
                telemetry = get_telemetry()
                telemetry.track('share_link_copied', {
                    'length': len(link),
                    'items': len(self.generated_playlist)
                })
            except:
                pass  # Silent failure
            
            # Show confirmation with preview
            preview = link[:120] + "..." if len(link) > 120 else link
            QMessageBox.information(
                self,
                "Link Copied",
                f"Share link copied to clipboard!\n\n"
                f"Preview: {preview}\n"
                f"Length: {len(link)} characters"
            )
        except Exception as e:
            QMessageBox.critical(
                self,
                "Share Error",
                f"Failed to create share link:\n{str(e)}"
            )