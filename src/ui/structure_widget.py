"""
Musical structure visualization widget.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout,
    QTableWidget, QTableWidgetItem, QPushButton,
    QLabel, QHeaderView, QMessageBox
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont
import sys
import json
from pathlib import Path
if str(Path(__file__).parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent.parent))
from ai_analysis.structure_detector import StructureDetector
from database import MusicDatabase

try:
    import pyqtgraph as pg
    HAS_PYQTGRAPH = True
except ImportError:
    HAS_PYQTGRAPH = False


class StructureWorker(QThread):
    """Worker thread for structure analysis."""
    
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)
    
    def __init__(self, filepath: str):
        super().__init__()
        self.filepath = filepath
    
    def run(self):
        """Analyze structure in background."""
        try:
            detector = StructureDetector()
            result = detector.analyze(self.filepath)
            self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))


class StructureWidget(QWidget):
    """Widget for displaying musical structure and mix points."""
    
    def __init__(self, parent=None):
        """Initialize the structure widget."""
        super().__init__(parent)
        self.db = MusicDatabase()
        self.current_track_id = None
        self.current_filepath = None
        self.structure_data = None
        self.init_ui()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Header
        header_layout = QHBoxLayout()
        
        title = QLabel("Structure & Mix Points")
        title_font = QFont()
        title_font.setPointSize(12)
        title_font.setBold(True)
        title.setFont(title_font)
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        # Buttons
        self.analyze_btn = QPushButton("Analyze Current")
        self.analyze_btn.clicked.connect(self.analyze_current)
        self.analyze_btn.setEnabled(False)
        header_layout.addWidget(self.analyze_btn)
        
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self.refresh_view)
        header_layout.addWidget(self.refresh_btn)
        
        layout.addLayout(header_layout)
        
        # Timeline view
        if HAS_PYQTGRAPH:
            self.timeline_widget = pg.PlotWidget(title="Energy Timeline")
            self.timeline_widget.setLabel('left', 'Energy')
            self.timeline_widget.setLabel('bottom', 'Time (s)')
            self.timeline_widget.setYRange(0, 1)
            layout.addWidget(self.timeline_widget)
        else:
            no_graph_label = QLabel("Timeline not available (pyqtgraph not installed)")
            no_graph_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            no_graph_label.setStyleSheet("color: #888; padding: 20px;")
            layout.addWidget(no_graph_label)
        
        # Segments table
        segments_label = QLabel("Segments")
        segments_label.setStyleSheet("font-weight: bold; margin-top: 10px;")
        layout.addWidget(segments_label)
        
        self.segments_table = QTableWidget()
        self.segments_table.setColumnCount(4)
        self.segments_table.setHorizontalHeaderLabels(["Label", "Start", "End", "Energy"])
        self.segments_table.horizontalHeader().setStretchLastSection(True)
        self.segments_table.setAlternatingRowColors(True)
        self.segments_table.setMaximumHeight(200)
        layout.addWidget(self.segments_table)
        
        # Mix points info
        self.mix_points_label = QLabel("Mix Points: Not analyzed")
        self.mix_points_label.setStyleSheet("margin-top: 10px;")
        layout.addWidget(self.mix_points_label)
        
        self.setLayout(layout)
    
    def set_track(self, track_id: int, filepath: str):
        """
        Set the current track for analysis.
        
        Args:
            track_id: Database track ID
            filepath: Path to audio file
        """
        self.current_track_id = track_id
        self.current_filepath = filepath
        self.analyze_btn.setEnabled(True)
        
        # Try to load existing structure from DB
        self.load_structure_from_db()
    
    def load_structure_from_db(self):
        """Load structure data from database if available."""
        if not self.current_track_id:
            return
        
        try:
            # Query hamms_advanced for energy_curve and transition_points
            row = self.db.conn.execute('''
                SELECT energy_curve, transition_points
                FROM hamms_advanced
                WHERE file_id = ?
            ''', (self.current_track_id,)).fetchone()
            
            if row and row[0]:  # Has energy_curve
                energy_curve = json.loads(row[0]) if row[0] else []
                transition_points = json.loads(row[1]) if row[1] else []
                
                # Query ai_analysis for structure (segments)
                ai_row = self.db.conn.execute('''
                    SELECT structure
                    FROM ai_analysis
                    WHERE track_id = ?
                ''', (self.current_track_id,)).fetchone()
                
                segments = []
                if ai_row and ai_row[0]:
                    structure_data = json.loads(ai_row[0])
                    segments = structure_data.get('segments', [])
                
                self.structure_data = {
                    'energy_curve': energy_curve,
                    'transition_points': transition_points,
                    'segments': segments
                }
                
                self.display_structure()
            else:
                self.clear_display()
                self.mix_points_label.setText("Mix Points: Not analyzed - click 'Analyze Current'")
                
        except Exception as e:
            print(f"Error loading structure from DB: {e}")
            self.clear_display()
    
    def analyze_current(self):
        """Analyze the current track's structure."""
        if not self.current_filepath:
            QMessageBox.warning(self, "No Track", "No track loaded")
            return
        
        self.analyze_btn.setEnabled(False)
        self.analyze_btn.setText("Analyzing...")
        
        # Create and start worker
        self.worker = StructureWorker(self.current_filepath)
        self.worker.finished.connect(self.on_analysis_complete)
        self.worker.error.connect(self.on_analysis_error)
        self.worker.start()
    
    def on_analysis_complete(self, result):
        """Handle analysis completion."""
        self.structure_data = result
        
        # Save to database
        if self.current_track_id and self.structure_data:
            success = self.db.save_structure(self.current_track_id, self.structure_data)
            if not success:
                QMessageBox.warning(self, "Save Error", "Failed to save structure to database")
        
        # Display results
        self.display_structure()
        
        self.analyze_btn.setEnabled(True)
        self.analyze_btn.setText("Analyze Current")
    
    def on_analysis_error(self, error_msg):
        """Handle analysis error."""
        QMessageBox.critical(self, "Analysis Error", f"Failed to analyze structure:\n{error_msg}")
        self.analyze_btn.setEnabled(True)
        self.analyze_btn.setText("Analyze Current")
    
    def display_structure(self):
        """Display the structure data."""
        if not self.structure_data:
            return
        
        # Update timeline
        if HAS_PYQTGRAPH:
            self.timeline_widget.clear()
            
            # Plot energy curve
            energy_curve = self.structure_data.get('energy_curve', [])
            if energy_curve:
                # Create time axis (assuming 4Hz sampling)
                time_axis = [i * 0.25 for i in range(len(energy_curve))]
                self.timeline_widget.plot(time_axis, energy_curve, pen='w', name='Energy')
            
            # Add segment boundaries
            segments = self.structure_data.get('segments', [])
            for seg in segments:
                # Vertical line at segment start
                line = pg.InfiniteLine(
                    pos=seg['start_sec'],
                    angle=90,
                    pen=pg.mkPen('y', width=1, style=Qt.PenStyle.DashLine)
                )
                self.timeline_widget.addItem(line)
                
                # Add label
                text = pg.TextItem(seg['label'], color='y', anchor=(0, 1))
                text.setPos(seg['start_sec'], 0.95)
                self.timeline_widget.addItem(text)
            
            # Add transition points
            transition_points = self.structure_data.get('transition_points', [])
            for tp in transition_points:
                # Vertical line for mix point
                line = pg.InfiniteLine(
                    pos=tp,
                    angle=90,
                    pen=pg.mkPen('g', width=2)
                )
                self.timeline_widget.addItem(line)
        
        # Update segments table
        segments = self.structure_data.get('segments', [])
        self.segments_table.setRowCount(len(segments))
        
        for i, seg in enumerate(segments):
            self.segments_table.setItem(i, 0, QTableWidgetItem(seg['label']))
            self.segments_table.setItem(i, 1, QTableWidgetItem(f"{seg['start_sec']:.1f}s"))
            self.segments_table.setItem(i, 2, QTableWidgetItem(f"{seg['end_sec']:.1f}s"))
            self.segments_table.setItem(i, 3, QTableWidgetItem(f"{seg['energy_mean']:.2f}"))
        
        # Update mix points label
        transition_points = self.structure_data.get('transition_points', [])
        if transition_points:
            mix_text = "Mix Points: "
            if len(transition_points) > 0:
                mix_text += f"Mix-in: {transition_points[0]:.1f}s"
            if len(transition_points) > 1:
                mix_text += f", Mix-out: {transition_points[-1]:.1f}s"
            if len(transition_points) > 2:
                mix_text += f", Drops: {[f'{p:.1f}s' for p in transition_points[1:-1]]}"
            self.mix_points_label.setText(mix_text)
        else:
            self.mix_points_label.setText("Mix Points: None detected")
    
    def clear_display(self):
        """Clear the display."""
        if HAS_PYQTGRAPH:
            self.timeline_widget.clear()
        self.segments_table.setRowCount(0)
        self.mix_points_label.setText("Mix Points: Not analyzed")
    
    def refresh_view(self):
        """Refresh the view from database."""
        self.load_structure_from_db()
    
    def closeEvent(self, event):
        """Clean up on close."""
        if hasattr(self, 'db'):
            self.db.close()
        super().closeEvent(event)