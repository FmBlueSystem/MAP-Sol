"""
Loudness analysis widget for displaying audio loudness metrics.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QProgressBar, QGroupBox, QGridLayout
)
from PyQt6.QtCore import Qt, pyqtSignal
from typing import Dict, Optional


class LoudnessWidget(QWidget):
    """Widget for displaying loudness analysis results."""
    
    # Signal emitted when analysis is requested
    analyzeRequested = pyqtSignal()
    
    def __init__(self, parent=None):
        """Initialize the loudness widget."""
        super().__init__(parent)
        self.current_result = None
        self.init_ui()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Title and analyze button
        header_layout = QHBoxLayout()
        
        title = QLabel("Loudness Analysis")
        title.setStyleSheet("font-size: 14px; font-weight: bold;")
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        self.analyze_btn = QPushButton("Analyze Current")
        self.analyze_btn.clicked.connect(self.analyzeRequested.emit)
        self.analyze_btn.setEnabled(False)
        header_layout.addWidget(self.analyze_btn)
        
        layout.addLayout(header_layout)
        
        # Metrics group
        metrics_group = QGroupBox("Loudness Metrics")
        metrics_layout = QGridLayout()
        
        # Integrated Loudness (LUFS)
        metrics_layout.addWidget(QLabel("Integrated:"), 0, 0)
        self.lufs_label = QLabel("-- LUFS")
        self.lufs_label.setStyleSheet("font-weight: bold;")
        metrics_layout.addWidget(self.lufs_label, 0, 1)
        
        self.lufs_bar = QProgressBar()
        self.lufs_bar.setRange(-40, -6)
        self.lufs_bar.setTextVisible(False)
        metrics_layout.addWidget(self.lufs_bar, 0, 2)
        
        # True Peak
        metrics_layout.addWidget(QLabel("True Peak:"), 1, 0)
        self.peak_label = QLabel("-- dBFS")
        self.peak_label.setStyleSheet("font-weight: bold;")
        metrics_layout.addWidget(self.peak_label, 1, 1)
        
        self.peak_bar = QProgressBar()
        self.peak_bar.setRange(-40, 0)
        self.peak_bar.setTextVisible(False)
        metrics_layout.addWidget(self.peak_bar, 1, 2)
        
        # Crest Factor
        metrics_layout.addWidget(QLabel("Crest Factor:"), 2, 0)
        self.crest_label = QLabel("-- dB")
        self.crest_label.setStyleSheet("font-weight: bold;")
        metrics_layout.addWidget(self.crest_label, 2, 1)
        
        self.crest_bar = QProgressBar()
        self.crest_bar.setRange(0, 30)
        self.crest_bar.setTextVisible(False)
        metrics_layout.addWidget(self.crest_bar, 2, 2)
        
        # Dynamic Range
        metrics_layout.addWidget(QLabel("Dynamic Range:"), 3, 0)
        self.dr_label = QLabel("-- dB")
        self.dr_label.setStyleSheet("font-weight: bold;")
        metrics_layout.addWidget(self.dr_label, 3, 1)
        
        self.dr_bar = QProgressBar()
        self.dr_bar.setRange(0, 30)
        self.dr_bar.setTextVisible(False)
        metrics_layout.addWidget(self.dr_bar, 3, 2)
        
        # Duration
        metrics_layout.addWidget(QLabel("Duration:"), 4, 0)
        self.duration_label = QLabel("--:--")
        metrics_layout.addWidget(self.duration_label, 4, 1)
        
        # Set column stretch
        metrics_layout.setColumnStretch(2, 1)
        
        metrics_group.setLayout(metrics_layout)
        layout.addWidget(metrics_group)
        
        # Target settings group
        target_group = QGroupBox("Normalization Target")
        target_layout = QHBoxLayout()
        
        target_layout.addWidget(QLabel("Target LUFS:"))
        self.target_label = QLabel("-18.0")
        self.target_label.setStyleSheet("font-weight: bold;")
        target_layout.addWidget(self.target_label)
        
        target_layout.addWidget(QLabel("Gain Required:"))
        self.gain_label = QLabel("-- dB")
        self.gain_label.setStyleSheet("font-weight: bold; color: #4CAF50;")
        target_layout.addWidget(self.gain_label)
        
        target_layout.addStretch()
        
        target_group.setLayout(target_layout)
        layout.addWidget(target_group)
        
        layout.addStretch()
        self.setLayout(layout)
    
    def update_meters(self, result: Dict):
        """
        Update the loudness meters with analysis results.
        
        Args:
            result: Dict with loudness analysis results
        """
        self.current_result = result
        
        # Update LUFS
        lufs = result.get('integrated_loudness_est', 0)
        self.lufs_label.setText(f"{lufs:.1f} LUFS")
        self.lufs_bar.setValue(int(lufs))
        
        # Color code LUFS
        if lufs < -24:
            self.lufs_label.setStyleSheet("font-weight: bold; color: #2196F3;")  # Too quiet
        elif lufs > -14:
            self.lufs_label.setStyleSheet("font-weight: bold; color: #FF9800;")  # Too loud
        else:
            self.lufs_label.setStyleSheet("font-weight: bold; color: #4CAF50;")  # Good range
        
        # Update True Peak
        peak = result.get('true_peak_est', 0)
        self.peak_label.setText(f"{peak:.1f} dBFS")
        self.peak_bar.setValue(int(peak))
        
        # Color code peak
        if peak > -1:
            self.peak_label.setStyleSheet("font-weight: bold; color: #F44336;")  # Clipping risk
        elif peak > -3:
            self.peak_label.setStyleSheet("font-weight: bold; color: #FF9800;")  # Warning
        else:
            self.peak_label.setStyleSheet("font-weight: bold; color: #4CAF50;")  # Safe
        
        # Update Crest Factor
        crest = result.get('crest_factor', 0)
        self.crest_label.setText(f"{crest:.1f} dB")
        self.crest_bar.setValue(int(crest))
        
        # Update Dynamic Range
        dr = result.get('dynamic_range_est', 0)
        self.dr_label.setText(f"{dr:.1f} dB")
        self.dr_bar.setValue(int(dr))
        
        # Update Duration
        duration = result.get('duration_sec', 0)
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        self.duration_label.setText(f"{minutes:02d}:{seconds:02d}")
        
        # Calculate gain for normalization
        target_lufs = -18.0
        gain_required = target_lufs - lufs
        self.gain_label.setText(f"{gain_required:+.1f} dB")
        
        # Color code gain
        if abs(gain_required) < 1:
            self.gain_label.setStyleSheet("font-weight: bold; color: #4CAF50;")  # Already normalized
        elif gain_required > 0:
            self.gain_label.setStyleSheet("font-weight: bold; color: #2196F3;")  # Needs boost
        else:
            self.gain_label.setStyleSheet("font-weight: bold; color: #FF9800;")  # Needs reduction
    
    def clear_meters(self):
        """Clear all meter displays."""
        self.current_result = None
        self.lufs_label.setText("-- LUFS")
        self.lufs_bar.setValue(-40)
        self.peak_label.setText("-- dBFS")
        self.peak_bar.setValue(-40)
        self.crest_label.setText("-- dB")
        self.crest_bar.setValue(0)
        self.dr_label.setText("-- dB")
        self.dr_bar.setValue(0)
        self.duration_label.setText("--:--")
        self.gain_label.setText("-- dB")
        
        # Reset styles
        self.lufs_label.setStyleSheet("font-weight: bold;")
        self.peak_label.setStyleSheet("font-weight: bold;")
        self.gain_label.setStyleSheet("font-weight: bold; color: #4CAF50;")
    
    def set_analyze_enabled(self, enabled: bool):
        """Enable or disable the analyze button."""
        self.analyze_btn.setEnabled(enabled)