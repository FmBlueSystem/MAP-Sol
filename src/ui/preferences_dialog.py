"""
Preferences dialog for application settings.
"""

from PyQt6.QtWidgets import (
    QDialog, QDialogButtonBox, QVBoxLayout, QHBoxLayout,
    QTabWidget, QWidget, QFormLayout, QComboBox,
    QSpinBox, QCheckBox, QSlider, QLabel, QLineEdit,
    QPushButton, QFileDialog, QDoubleSpinBox, QTextEdit
)
from PyQt6.QtCore import Qt
from pathlib import Path
import sys
from pathlib import Path
# Add src to path if needed
if str(Path(__file__).parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.config import get_config, save_config, get_ai_config, save_ai_config


class PreferencesDialog(QDialog):
    """Dialog for editing application preferences."""
    
    def __init__(self, parent=None):
        """Initialize the preferences dialog."""
        super().__init__(parent)
        
        self.setWindowTitle("Preferences")
        self.setModal(True)
        self.resize(600, 500)
        
        # Load current configs
        self.general_config = get_config()
        self.ai_config = get_ai_config()
        
        self.init_ui()
        self.load_values()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Create tab widget
        self.tabs = QTabWidget()
        
        # Add tabs
        self.tabs.addTab(self.create_general_tab(), "General")
        self.tabs.addTab(self.create_ai_tab(), "AI Analysis")
        self.tabs.addTab(self.create_playlists_tab(), "Playlists")
        self.tabs.addTab(self.create_serato_tab(), "Serato Export")
        self.tabs.addTab(self.create_playback_tab(), "Playback")
        self.tabs.addTab(self.create_privacy_tab(), "Privacy")
        
        layout.addWidget(self.tabs)
        
        # Buttons
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save |
            QDialogButtonBox.StandardButton.Cancel |
            QDialogButtonBox.StandardButton.RestoreDefaults
        )
        
        button_box.accepted.connect(self.save_settings)
        button_box.rejected.connect(self.reject)
        button_box.button(QDialogButtonBox.StandardButton.RestoreDefaults).clicked.connect(
            self.restore_defaults
        )
        
        layout.addWidget(button_box)
        self.setLayout(layout)
    
    def create_general_tab(self):
        """Create the General settings tab."""
        widget = QWidget()
        layout = QFormLayout()
        
        # Theme selection
        self.theme_combo = QComboBox()
        self.theme_combo.addItems(["Dark", "Light"])
        layout.addRow("Theme:", self.theme_combo)
        
        # Grid page size
        self.grid_size_spin = QSpinBox()
        self.grid_size_spin.setRange(10, 200)
        self.grid_size_spin.setSingleStep(10)
        layout.addRow("Grid Page Size:", self.grid_size_spin)
        
        widget.setLayout(layout)
        return widget
    
    def create_ai_tab(self):
        """Create the AI Analysis settings tab."""
        widget = QWidget()
        layout = QFormLayout()
        
        # AI enabled
        self.ai_enabled_check = QCheckBox("Enable AI Analysis")
        layout.addRow(self.ai_enabled_check)
        
        # Max parallel
        self.ai_max_parallel_spin = QSpinBox()
        self.ai_max_parallel_spin.setRange(1, 10)
        layout.addRow("Max Parallel Analysis:", self.ai_max_parallel_spin)
        
        # Lyrics analysis
        self.lyrics_enabled_check = QCheckBox("Enable Lyrics Analysis")
        layout.addRow(self.lyrics_enabled_check)
        
        widget.setLayout(layout)
        return widget
    
    def create_playlists_tab(self):
        """Create the Playlists settings tab."""
        widget = QWidget()
        layout = QFormLayout()
        
        # Default type
        self.playlist_type_combo = QComboBox()
        self.playlist_type_combo.addItems([
            "harmonic_journey",
            "energy_progression",
            "mood_based",
            "hybrid"
        ])
        layout.addRow("Default Type:", self.playlist_type_combo)
        
        # Default duration
        self.playlist_duration_spin = QSpinBox()
        self.playlist_duration_spin.setRange(5, 300)
        self.playlist_duration_spin.setSuffix(" minutes")
        layout.addRow("Default Duration:", self.playlist_duration_spin)
        
        # HAMMS vs AI weight
        hamms_layout = QHBoxLayout()
        self.hamms_weight_slider = QSlider(Qt.Orientation.Horizontal)
        self.hamms_weight_slider.setRange(0, 100)
        self.hamms_weight_slider.valueChanged.connect(self.update_weight_label)
        hamms_layout.addWidget(self.hamms_weight_slider)
        
        self.weight_label = QLabel("HAMMS 60% / AI 40%")
        self.weight_label.setMinimumWidth(150)
        hamms_layout.addWidget(self.weight_label)
        
        layout.addRow("HAMMS vs AI Weight:", hamms_layout)
        
        widget.setLayout(layout)
        return widget
    
    def create_serato_tab(self):
        """Create the Serato Export settings tab."""
        widget = QWidget()
        layout = QFormLayout()
        
        # Root path
        path_layout = QHBoxLayout()
        self.serato_path_edit = QLineEdit()
        path_layout.addWidget(self.serato_path_edit)
        
        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self.browse_serato_path)
        path_layout.addWidget(browse_btn)
        
        layout.addRow("Serato Root Path:", path_layout)
        
        # Crate name
        self.crate_name_edit = QLineEdit()
        layout.addRow("Default Crate Name:", self.crate_name_edit)
        
        widget.setLayout(layout)
        return widget
    
    def create_playback_tab(self):
        """Create the Playback settings tab."""
        widget = QWidget()
        layout = QFormLayout()
        
        # Loudness normalization
        self.loudness_norm_check = QCheckBox("Enable Loudness Normalization")
        layout.addRow(self.loudness_norm_check)
        
        # Target LUFS
        self.target_lufs_spin = QDoubleSpinBox()
        self.target_lufs_spin.setRange(-30, -6)
        self.target_lufs_spin.setSingleStep(0.5)
        self.target_lufs_spin.setSuffix(" LUFS")
        layout.addRow("Target Loudness:", self.target_lufs_spin)
        
        widget.setLayout(layout)
        return widget
    
    def create_privacy_tab(self):
        """Create the Privacy settings tab."""
        widget = QWidget()
        layout = QVBoxLayout()
        
        # Telemetry section
        telemetry_group = QWidget()
        telemetry_layout = QVBoxLayout()
        
        # Title and description
        title_label = QLabel("Telemetry (Opt-in)")
        title_label.setStyleSheet("font-weight: bold; font-size: 14px;")
        telemetry_layout.addWidget(title_label)
        
        desc_label = QLabel(
            "Help improve the app by sharing anonymous usage data.\n"
            "• Data is stored locally only (never sent over network)\n"
            "• No personal information or file paths are collected\n"
            "• You can export or delete your data at any time"
        )
        desc_label.setWordWrap(True)
        desc_label.setStyleSheet("color: #888; margin: 10px 0;")
        telemetry_layout.addWidget(desc_label)
        
        # Enable checkbox
        self.telemetry_enabled_check = QCheckBox("Enable anonymous telemetry")
        telemetry_layout.addWidget(self.telemetry_enabled_check)
        
        # Export button
        export_layout = QHBoxLayout()
        export_layout.addStretch()
        
        self.export_telemetry_btn = QPushButton("Export Telemetry Data...")
        self.export_telemetry_btn.clicked.connect(self.export_telemetry)
        export_layout.addWidget(self.export_telemetry_btn)
        
        self.clear_telemetry_btn = QPushButton("Clear Telemetry Data")
        self.clear_telemetry_btn.clicked.connect(self.clear_telemetry)
        export_layout.addWidget(self.clear_telemetry_btn)
        
        telemetry_layout.addLayout(export_layout)
        
        telemetry_group.setLayout(telemetry_layout)
        layout.addWidget(telemetry_group)
        
        # Events tracked info
        events_label = QLabel("Events tracked when enabled:")
        events_label.setStyleSheet("font-weight: bold; margin-top: 20px;")
        layout.addWidget(events_label)
        
        events_text = QTextEdit()
        events_text.setReadOnly(True)
        events_text.setMaximumHeight(150)
        events_text.setPlainText(
            "• App start/quit\n"
            "• Analysis completion (count, duration)\n"
            "• Playlist generation (type, track count)\n"
            "• Playlist saved (anonymized name)\n"
            "• Share link copied (size only)\n"
            "• No file paths or personal data"
        )
        layout.addWidget(events_text)
        
        layout.addStretch()
        widget.setLayout(layout)
        return widget
    
    def export_telemetry(self):
        """Export telemetry data to JSON."""
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Telemetry Data",
            str(Path.home() / "telemetry_export.json"),
            "JSON Files (*.json)"
        )
        
        if file_path:
            try:
                from telemetry.telemetry import get_telemetry
                telemetry = get_telemetry()
                telemetry.export(Path(file_path))
                
                from PyQt6.QtWidgets import QMessageBox
                QMessageBox.information(
                    self,
                    "Export Complete",
                    f"Telemetry data exported to:\n{file_path}"
                )
            except Exception as e:
                from PyQt6.QtWidgets import QMessageBox
                QMessageBox.critical(
                    self,
                    "Export Error",
                    f"Failed to export telemetry:\n{str(e)}"
                )
    
    def clear_telemetry(self):
        """Clear telemetry data after confirmation."""
        from PyQt6.QtWidgets import QMessageBox
        
        reply = QMessageBox.question(
            self,
            "Clear Telemetry",
            "Are you sure you want to clear all telemetry data?\n"
            "This action cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            try:
                from telemetry.telemetry import get_telemetry
                telemetry = get_telemetry()
                telemetry.clear()
                
                QMessageBox.information(
                    self,
                    "Data Cleared",
                    "Telemetry data has been cleared."
                )
            except Exception as e:
                QMessageBox.critical(
                    self,
                    "Clear Error",
                    f"Failed to clear telemetry:\n{str(e)}"
                )
    
    def update_weight_label(self, value):
        """Update the HAMMS vs AI weight label."""
        hamms_percent = value
        ai_percent = 100 - value
        self.weight_label.setText(f"HAMMS {hamms_percent}% / AI {ai_percent}%")
    
    def browse_serato_path(self):
        """Browse for Serato root directory."""
        path = QFileDialog.getExistingDirectory(
            self,
            "Select Serato Root Directory",
            str(Path.home() / "Music")
        )
        if path:
            self.serato_path_edit.setText(path)
    
    def load_values(self):
        """Load current configuration values into UI."""
        # General
        theme = self.general_config.get('ui', {}).get('theme', 'dark')
        self.theme_combo.setCurrentText(theme.capitalize())
        
        grid_size = self.general_config.get('ui', {}).get('grid_page_size', 100)
        self.grid_size_spin.setValue(grid_size)
        
        # AI Analysis
        ai_enabled = self.ai_config.get('ai_analysis', {}).get('enabled', True)
        self.ai_enabled_check.setChecked(ai_enabled)
        
        max_parallel = self.ai_config.get('ai_analysis', {}).get('max_parallel', 2)
        self.ai_max_parallel_spin.setValue(max_parallel)
        
        lyrics_enabled = self.ai_config.get('lyrics_analysis', {}).get('enabled', False)
        self.lyrics_enabled_check.setChecked(lyrics_enabled)
        
        # Playlists
        default_type = self.ai_config.get('playlist_generation', {}).get('default_type', 'harmonic_journey')
        index = self.playlist_type_combo.findText(default_type)
        if index >= 0:
            self.playlist_type_combo.setCurrentIndex(index)
        
        default_duration = self.ai_config.get('playlist_generation', {}).get('default_duration', 60)
        self.playlist_duration_spin.setValue(default_duration)
        
        # HAMMS weight (default 60%)
        hamms_weight = int(self.ai_config.get('playlist_generation', {}).get('hamms_weight', 0.6) * 100)
        self.hamms_weight_slider.setValue(hamms_weight)
        
        # Serato
        serato_path = self.general_config.get('serato', {}).get('root_path', str(Path.home() / "Music" / "_Serato_"))
        self.serato_path_edit.setText(serato_path)
        
        crate_name = self.general_config.get('serato', {}).get('crate_name', 'MusicAnalyzerPro')
        self.crate_name_edit.setText(crate_name)
        
        # Playback
        loudness_enabled = self.general_config.get('playback', {}).get('loudness_normalization', True)
        self.loudness_norm_check.setChecked(loudness_enabled)
        
        target_lufs = self.general_config.get('playback', {}).get('target_lufs', -18.0)
        self.target_lufs_spin.setValue(target_lufs)
        
        # Telemetry
        telemetry_enabled = self.general_config.get('telemetry', {}).get('enabled', False)
        self.telemetry_enabled_check.setChecked(telemetry_enabled)
    
    def save_settings(self):
        """Save settings to configuration files."""
        # Update general config
        if 'ui' not in self.general_config:
            self.general_config['ui'] = {}
        self.general_config['ui']['theme'] = self.theme_combo.currentText().lower()
        self.general_config['ui']['grid_page_size'] = self.grid_size_spin.value()
        
        if 'serato' not in self.general_config:
            self.general_config['serato'] = {}
        self.general_config['serato']['root_path'] = self.serato_path_edit.text()
        self.general_config['serato']['crate_name'] = self.crate_name_edit.text()
        
        if 'playback' not in self.general_config:
            self.general_config['playback'] = {}
        self.general_config['playback']['loudness_normalization'] = self.loudness_norm_check.isChecked()
        self.general_config['playback']['target_lufs'] = self.target_lufs_spin.value()
        
        if 'telemetry' not in self.general_config:
            self.general_config['telemetry'] = {}
        self.general_config['telemetry']['enabled'] = self.telemetry_enabled_check.isChecked()
        
        # Update AI config
        if 'ai_analysis' not in self.ai_config:
            self.ai_config['ai_analysis'] = {}
        self.ai_config['ai_analysis']['enabled'] = self.ai_enabled_check.isChecked()
        self.ai_config['ai_analysis']['max_parallel'] = self.ai_max_parallel_spin.value()
        
        if 'lyrics_analysis' not in self.ai_config:
            self.ai_config['lyrics_analysis'] = {}
        self.ai_config['lyrics_analysis']['enabled'] = self.lyrics_enabled_check.isChecked()
        
        if 'playlist_generation' not in self.ai_config:
            self.ai_config['playlist_generation'] = {}
        self.ai_config['playlist_generation']['default_type'] = self.playlist_type_combo.currentText()
        self.ai_config['playlist_generation']['default_duration'] = self.playlist_duration_spin.value()
        self.ai_config['playlist_generation']['hamms_weight'] = self.hamms_weight_slider.value() / 100.0
        
        # Save configs
        save_config(self.general_config)
        save_ai_config(self.ai_config)
        
        self.accept()
    
    def restore_defaults(self):
        """Restore default settings."""
        # Set defaults
        self.theme_combo.setCurrentText("Dark")
        self.grid_size_spin.setValue(100)
        
        self.ai_enabled_check.setChecked(True)
        self.ai_max_parallel_spin.setValue(2)
        self.lyrics_enabled_check.setChecked(False)
        
        self.playlist_type_combo.setCurrentText("harmonic_journey")
        self.playlist_duration_spin.setValue(60)
        self.hamms_weight_slider.setValue(60)
        
        self.serato_path_edit.setText(str(Path.home() / "Music" / "_Serato_"))
        self.crate_name_edit.setText("MusicAnalyzerPro")
        
        self.loudness_norm_check.setChecked(True)
        self.target_lufs_spin.setValue(-18.0)