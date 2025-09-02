"""
Mix suggester widget for displaying compatible tracks.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QMessageBox
)
from PyQt6.QtCore import Qt, pyqtSignal
from typing import List, Dict


class MixSuggesterWidget(QWidget):
    """Widget for displaying mix suggestions."""
    
    # Signal emitted when a track is requested to play
    playRequested = pyqtSignal(str)  # filepath
    refreshRequested = pyqtSignal()
    
    def __init__(self, parent=None):
        """Initialize the mix suggester widget."""
        super().__init__(parent)
        self.current_suggestions = []
        self.init_ui()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self.on_refresh)
        button_layout.addWidget(self.refresh_btn)
        
        self.play_btn = QPushButton("Play Selected")
        self.play_btn.clicked.connect(self.on_play_selected)
        self.play_btn.setEnabled(False)
        button_layout.addWidget(self.play_btn)
        
        button_layout.addStretch()
        layout.addLayout(button_layout)
        
        # Table
        self.suggestions_table = QTableWidget()
        self.suggestions_table.setColumnCount(6)
        self.suggestions_table.setHorizontalHeaderLabels([
            "Title", "Artist", "BPM", "Key", "Energy", "Score"
        ])
        
        # Configure table
        self.suggestions_table.setAlternatingRowColors(True)
        self.suggestions_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.suggestions_table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.suggestions_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        
        # Connect signals
        self.suggestions_table.itemDoubleClicked.connect(self.on_item_double_clicked)
        self.suggestions_table.itemSelectionChanged.connect(self.on_selection_changed)
        
        # Adjust column widths
        header = self.suggestions_table.horizontalHeader()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)  # Title
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)  # Artist
        
        layout.addWidget(self.suggestions_table)
        self.setLayout(layout)
    
    def update_suggestions(self, items: List[Dict]):
        """
        Update the suggestions table with new items.
        
        Args:
            items: List of track dicts with score
        """
        self.current_suggestions = items
        self.suggestions_table.setRowCount(len(items))
        
        for row, item in enumerate(items):
            # Title
            title_item = QTableWidgetItem(item.get('title', 'Unknown'))
            self.suggestions_table.setItem(row, 0, title_item)
            
            # Artist
            artist_item = QTableWidgetItem(item.get('artist', 'Unknown'))
            self.suggestions_table.setItem(row, 1, artist_item)
            
            # BPM
            bpm = item.get('bpm', 0)
            bpm_item = QTableWidgetItem(f"{bpm:.1f}")
            bpm_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.suggestions_table.setItem(row, 2, bpm_item)
            
            # Key
            key_item = QTableWidgetItem(item.get('camelot_key', '-'))
            key_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.suggestions_table.setItem(row, 3, key_item)
            
            # Energy
            energy = item.get('energy_level', 5)
            energy_item = QTableWidgetItem(str(energy))
            energy_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.suggestions_table.setItem(row, 4, energy_item)
            
            # Score
            score = item.get('score', 0)
            score_item = QTableWidgetItem(f"{score:.3f}")
            score_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.suggestions_table.setItem(row, 5, score_item)
        
        # Resize columns to content
        self.suggestions_table.resizeColumnsToContents()
        
        # Clear selection
        self.suggestions_table.clearSelection()
        self.play_btn.setEnabled(False)
    
    def on_refresh(self):
        """Handle refresh button click."""
        self.refreshRequested.emit()
    
    def on_play_selected(self):
        """Handle play selected button click."""
        current_row = self.suggestions_table.currentRow()
        if current_row >= 0 and current_row < len(self.current_suggestions):
            track = self.current_suggestions[current_row]
            filepath = track.get('filepath')
            if filepath:
                self.playRequested.emit(filepath)
    
    def on_item_double_clicked(self, item):
        """Handle double click on a table item."""
        row = item.row()
        if row >= 0 and row < len(self.current_suggestions):
            track = self.current_suggestions[row]
            filepath = track.get('filepath')
            if filepath:
                self.playRequested.emit(filepath)
    
    def on_selection_changed(self):
        """Handle selection change in the table."""
        self.play_btn.setEnabled(self.suggestions_table.currentRow() >= 0)
    
    def clear_suggestions(self):
        """Clear all suggestions from the table."""
        self.current_suggestions = []
        self.suggestions_table.setRowCount(0)
        self.play_btn.setEnabled(False)