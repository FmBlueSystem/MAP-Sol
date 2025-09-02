"""
Advanced search UI widget for music library.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QLineEdit, QComboBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QMessageBox, QInputDialog
)
from PyQt6.QtCore import Qt, pyqtSignal
from typing import List, Dict


class AdvancedSearchWidget(QWidget):
    """Widget for advanced search functionality."""
    
    # Signal emitted when a track is requested to play
    playRequested = pyqtSignal(str)  # filepath
    
    def __init__(self, parent=None):
        """Initialize the advanced search widget."""
        super().__init__(parent)
        self.search_engine = None  # Will be set by parent
        self.current_results = []
        self.saved_searches = {}
        self.init_ui()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Search controls
        search_layout = QHBoxLayout()
        
        # Query input
        self.query_input = QLineEdit()
        self.query_input.setPlaceholderText('e.g., bpm BETWEEN 120 AND 128 AND mood = "driving"')
        self.query_input.returnPressed.connect(self.on_search)
        search_layout.addWidget(self.query_input)
        
        # Search button
        self.search_btn = QPushButton("Search")
        self.search_btn.clicked.connect(self.on_search)
        search_layout.addWidget(self.search_btn)
        
        layout.addLayout(search_layout)
        
        # Saved searches controls
        saved_layout = QHBoxLayout()
        
        # Saved searches combo
        self.saved_combo = QComboBox()
        self.saved_combo.setEditable(False)
        self.saved_combo.addItem("-- Saved Searches --")
        self.saved_combo.currentTextChanged.connect(self.on_saved_selected)
        saved_layout.addWidget(self.saved_combo)
        
        # Save button
        self.save_btn = QPushButton("Save Search")
        self.save_btn.clicked.connect(self.on_save_search)
        saved_layout.addWidget(self.save_btn)
        
        # Load saved button
        self.load_saved_btn = QPushButton("Refresh Saved")
        self.load_saved_btn.clicked.connect(self.load_saved_searches)
        saved_layout.addWidget(self.load_saved_btn)
        
        saved_layout.addStretch()
        layout.addLayout(saved_layout)
        
        # Results table
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(6)
        self.results_table.setHorizontalHeaderLabels([
            "Title", "Artist", "BPM", "Key", "Energy", "Mood"
        ])
        
        # Configure table
        self.results_table.setAlternatingRowColors(True)
        self.results_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.results_table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.results_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        
        # Connect double-click signal
        self.results_table.itemDoubleClicked.connect(self.on_item_double_clicked)
        
        # Adjust column widths
        header = self.results_table.horizontalHeader()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)  # Title
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)  # Artist
        
        layout.addWidget(self.results_table)
        self.setLayout(layout)
    
    def set_search_engine(self, engine):
        """Set the search engine instance."""
        self.search_engine = engine
        self.load_saved_searches()
    
    def on_search(self):
        """Handle search button click."""
        if not self.search_engine:
            QMessageBox.warning(self, "Error", "Search engine not initialized")
            return
        
        query = self.query_input.text().strip()
        if not query:
            QMessageBox.warning(self, "Error", "Please enter a search query")
            return
        
        try:
            # Execute search
            results = self.search_engine.search(query)
            self.display_results(results)
            
            # Show result count
            if results:
                self.parent().window().statusBar().showMessage(
                    f"Found {len(results)} tracks"
                )
            else:
                QMessageBox.information(self, "No Results", 
                                      "No tracks found matching the query")
                
        except Exception as e:
            QMessageBox.critical(self, "Search Error", 
                               f"Error executing search:\n{str(e)}")
    
    def display_results(self, results: List[Dict]):
        """Display search results in the table."""
        self.current_results = results
        self.results_table.setRowCount(len(results))
        
        for row, track in enumerate(results):
            # Title
            title_item = QTableWidgetItem(track.get('title', 'Unknown'))
            self.results_table.setItem(row, 0, title_item)
            
            # Artist  
            artist_item = QTableWidgetItem(track.get('artist', 'Unknown'))
            self.results_table.setItem(row, 1, artist_item)
            
            # BPM
            bpm = track.get('bpm', 0)
            if bpm:
                bpm_item = QTableWidgetItem(f"{bpm:.1f}")
            else:
                bpm_item = QTableWidgetItem("-")
            bpm_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.results_table.setItem(row, 2, bpm_item)
            
            # Key
            key = track.get('camelot_key') or track.get('initial_key', '-')
            key_item = QTableWidgetItem(key)
            key_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.results_table.setItem(row, 3, key_item)
            
            # Energy
            energy = track.get('energy_level', 5)
            energy_item = QTableWidgetItem(str(energy))
            energy_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.results_table.setItem(row, 4, energy_item)
            
            # Mood
            mood = track.get('mood', '-')
            mood_item = QTableWidgetItem(mood if mood else '-')
            self.results_table.setItem(row, 5, mood_item)
        
        # Resize columns to content
        self.results_table.resizeColumnsToContents()
    
    def on_item_double_clicked(self, item):
        """Handle double click on a table item."""
        row = item.row()
        if row >= 0 and row < len(self.current_results):
            track = self.current_results[row]
            filepath = track.get('file_path')
            if filepath:
                self.playRequested.emit(filepath)
    
    def on_save_search(self):
        """Handle save search button click."""
        if not self.search_engine:
            return
        
        query = self.query_input.text().strip()
        if not query:
            QMessageBox.warning(self, "Error", "No query to save")
            return
        
        # Get name from user
        name, ok = QInputDialog.getText(
            self, "Save Search", "Enter name for this search:"
        )
        
        if ok and name:
            try:
                self.search_engine.save_search(name, query)
                QMessageBox.information(self, "Saved", 
                                      f"Search saved as '{name}'")
                self.load_saved_searches()
            except Exception as e:
                QMessageBox.critical(self, "Error", 
                                   f"Failed to save search:\n{str(e)}")
    
    def load_saved_searches(self):
        """Load saved searches into combo box."""
        if not self.search_engine:
            return
        
        try:
            saved = self.search_engine.list_saved()
            
            # Clear and repopulate combo
            self.saved_combo.clear()
            self.saved_combo.addItem("-- Saved Searches --")
            self.saved_searches = {}
            
            for search in saved:
                self.saved_combo.addItem(search['name'])
                self.saved_searches[search['name']] = search['query']
                
        except Exception as e:
            print(f"Error loading saved searches: {e}")
    
    def on_saved_selected(self, text):
        """Handle saved search selection."""
        if text in self.saved_searches:
            self.query_input.setText(self.saved_searches[text])
            self.on_search()