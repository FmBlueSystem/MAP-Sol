"""
Analytics dashboard widget for library metrics visualization.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QPushButton, QGroupBox, QTabWidget,
    QMessageBox, QScrollArea
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont
import sys
from pathlib import Path
if str(Path(__file__).parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent.parent))
from analytics.metrics import LibraryMetrics
from database import MusicDatabase

try:
    import pyqtgraph as pg
    HAS_PYQTGRAPH = True
except ImportError:
    HAS_PYQTGRAPH = False


class MetricsWorker(QThread):
    """Worker thread for calculating metrics."""
    
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)
    
    def __init__(self, db_path: str):
        super().__init__()
        self.db_path = db_path
    
    def run(self):
        """Calculate all metrics in background."""
        try:
            metrics = LibraryMetrics(self.db_path)
            
            result = {
                'summary': metrics.summary(),
                'bpm': metrics.distribution_bpm(bins=10),
                'camelot': metrics.distribution_camelot(),
                'energy': metrics.distribution_energy(),
                'genre': metrics.distribution_genre(top_n=10),
                'mood': metrics.distribution_mood(top_n=10),
                'clusters': metrics.cluster_sizes()
            }
            
            self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))


class AnalyticsDashboardWidget(QWidget):
    """Analytics dashboard for library metrics."""
    
    def __init__(self, parent=None):
        """Initialize the analytics dashboard."""
        super().__init__(parent)
        self.db = MusicDatabase()
        self.metrics_data = {}
        self.init_ui()
        self.refresh_metrics()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Header with refresh button
        header_layout = QHBoxLayout()
        
        title = QLabel("Library Analytics")
        title_font = QFont()
        title_font.setPointSize(14)
        title_font.setBold(True)
        title.setFont(title_font)
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self.refresh_metrics)
        header_layout.addWidget(self.refresh_btn)
        
        layout.addLayout(header_layout)
        
        # KPIs section
        kpi_group = QGroupBox("Key Metrics")
        kpi_layout = QGridLayout()
        
        # Create KPI labels
        self.kpi_labels = {
            'total': QLabel("Total Tracks: -"),
            'ai_coverage': QLabel("AI Coverage: -"),
            'loudness_coverage': QLabel("Loudness Analysis: -"),
            'playlists': QLabel("Playlists: -"),
            'clusters': QLabel("Clusters: -"),
            'hamms': QLabel("HAMMS Vectors: -")
        }
        
        # Arrange KPIs in grid
        kpi_layout.addWidget(self.kpi_labels['total'], 0, 0)
        kpi_layout.addWidget(self.kpi_labels['ai_coverage'], 0, 1)
        kpi_layout.addWidget(self.kpi_labels['loudness_coverage'], 0, 2)
        kpi_layout.addWidget(self.kpi_labels['playlists'], 1, 0)
        kpi_layout.addWidget(self.kpi_labels['clusters'], 1, 1)
        kpi_layout.addWidget(self.kpi_labels['hamms'], 1, 2)
        
        kpi_group.setLayout(kpi_layout)
        layout.addWidget(kpi_group)
        
        # Charts section
        if HAS_PYQTGRAPH:
            # Create tab widget for charts
            self.tabs = QTabWidget()
            
            # BPM Distribution tab
            self.bpm_widget = pg.PlotWidget(title="BPM Distribution")
            self.bpm_widget.setLabel('left', 'Count')
            self.bpm_widget.setLabel('bottom', 'BPM')
            self.tabs.addTab(self.bpm_widget, "BPM")
            
            # Camelot Keys tab
            self.camelot_widget = pg.PlotWidget(title="Camelot Key Distribution")
            self.camelot_widget.setLabel('left', 'Count')
            self.camelot_widget.setLabel('bottom', 'Key')
            self.tabs.addTab(self.camelot_widget, "Keys")
            
            # Energy Distribution tab
            self.energy_widget = pg.PlotWidget(title="Energy Level Distribution")
            self.energy_widget.setLabel('left', 'Count')
            self.energy_widget.setLabel('bottom', 'Energy Level')
            self.tabs.addTab(self.energy_widget, "Energy")
            
            # Genre Distribution tab
            self.genre_widget = pg.PlotWidget(title="Top Genres")
            self.genre_widget.setLabel('left', 'Count')
            self.tabs.addTab(self.genre_widget, "Genres")
            
            # Mood Distribution tab
            self.mood_widget = pg.PlotWidget(title="Top Moods")
            self.mood_widget.setLabel('left', 'Count')
            self.tabs.addTab(self.mood_widget, "Moods")
            
            # Cluster Sizes tab
            self.cluster_widget = pg.PlotWidget(title="Cluster Sizes")
            self.cluster_widget.setLabel('left', 'Tracks')
            self.cluster_widget.setLabel('bottom', 'Cluster ID')
            self.tabs.addTab(self.cluster_widget, "Clusters")
            
            layout.addWidget(self.tabs)
        else:
            # Fallback if pyqtgraph not available
            no_graph_label = QLabel("Graphs not available (pyqtgraph not installed)")
            no_graph_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            no_graph_label.setStyleSheet("color: #888; padding: 40px;")
            layout.addWidget(no_graph_label)
        
        self.setLayout(layout)
    
    def refresh_metrics(self):
        """Refresh all metrics and update displays."""
        self.refresh_btn.setEnabled(False)
        self.refresh_btn.setText("Calculating...")
        
        # Create and start worker thread
        self.worker = MetricsWorker(str(self.db.db_path))
        self.worker.finished.connect(self.on_metrics_ready)
        self.worker.error.connect(self.on_metrics_error)
        self.worker.start()
    
    def on_metrics_ready(self, data):
        """Handle metrics calculation completion."""
        self.metrics_data = data
        self.update_displays()
        self.refresh_btn.setEnabled(True)
        self.refresh_btn.setText("Refresh")
    
    def on_metrics_error(self, error_msg):
        """Handle metrics calculation error."""
        QMessageBox.critical(self, "Metrics Error", f"Failed to calculate metrics:\n{error_msg}")
        self.refresh_btn.setEnabled(True)
        self.refresh_btn.setText("Refresh")
    
    def update_displays(self):
        """Update all displays with new metrics data."""
        if not self.metrics_data:
            return
        
        # Update KPIs
        summary = self.metrics_data.get('summary', {})
        self.kpi_labels['total'].setText(f"Total Tracks: {summary.get('total_tracks', 0):,}")
        self.kpi_labels['ai_coverage'].setText(f"AI Coverage: {summary.get('percent_ai', 0):.1f}%")
        self.kpi_labels['loudness_coverage'].setText(f"Loudness Analysis: {summary.get('percent_loudness', 0):.1f}%")
        self.kpi_labels['playlists'].setText(f"Playlists: {summary.get('num_playlists', 0)}")
        self.kpi_labels['clusters'].setText(f"Clusters: {summary.get('num_clusters', 0)}")
        self.kpi_labels['hamms'].setText(f"HAMMS Vectors: {summary.get('percent_hamms', 0):.1f}%")
        
        # Update charts if pyqtgraph available
        if HAS_PYQTGRAPH:
            self.update_bpm_chart()
            self.update_camelot_chart()
            self.update_energy_chart()
            self.update_genre_chart()
            self.update_mood_chart()
            self.update_cluster_chart()
    
    def update_bpm_chart(self):
        """Update BPM distribution chart."""
        self.bpm_widget.clear()
        
        edges, counts = self.metrics_data.get('bpm', ([], []))
        if edges and counts:
            # Calculate bin centers
            centers = [(edges[i] + edges[i+1]) / 2 for i in range(len(counts))]
            # Create bar graph
            width = (edges[1] - edges[0]) * 0.8
            bargraph = pg.BarGraphItem(x=centers, height=counts, width=width, brush='b')
            self.bpm_widget.addItem(bargraph)
    
    def update_camelot_chart(self):
        """Update Camelot key distribution chart."""
        self.camelot_widget.clear()
        
        camelot_data = self.metrics_data.get('camelot', {})
        if camelot_data:
            keys = list(camelot_data.keys())
            counts = list(camelot_data.values())
            
            # Create x positions
            x_pos = list(range(len(keys)))
            
            # Create bar graph
            bargraph = pg.BarGraphItem(x=x_pos, height=counts, width=0.8, brush='g')
            self.camelot_widget.addItem(bargraph)
            
            # Set x-axis labels
            ax = self.camelot_widget.getAxis('bottom')
            ax.setTicks([[(i, k) for i, k in enumerate(keys)]])
    
    def update_energy_chart(self):
        """Update energy distribution chart."""
        self.energy_widget.clear()
        
        energy_data = self.metrics_data.get('energy', {})
        if energy_data:
            levels = list(range(1, 11))
            counts = [energy_data.get(i, 0) for i in levels]
            
            # Create bar graph
            bargraph = pg.BarGraphItem(x=levels, height=counts, width=0.8, brush='r')
            self.energy_widget.addItem(bargraph)
    
    def update_genre_chart(self):
        """Update genre distribution chart."""
        self.genre_widget.clear()
        
        genre_data = self.metrics_data.get('genre', [])
        if genre_data:
            genres = [g[0] for g in genre_data]
            counts = [g[1] for g in genre_data]
            
            # Create x positions
            x_pos = list(range(len(genres)))
            
            # Create bar graph
            bargraph = pg.BarGraphItem(x=x_pos, height=counts, width=0.8, brush='y')
            self.genre_widget.addItem(bargraph)
            
            # Set x-axis labels (truncate long names)
            ax = self.genre_widget.getAxis('bottom')
            labels = [(i, g[:15] + '...' if len(g) > 15 else g) for i, g in enumerate(genres)]
            ax.setTicks([labels])
    
    def update_mood_chart(self):
        """Update mood distribution chart."""
        self.mood_widget.clear()
        
        mood_data = self.metrics_data.get('mood', [])
        if mood_data:
            moods = [m[0] for m in mood_data]
            counts = [m[1] for m in mood_data]
            
            # Create x positions
            x_pos = list(range(len(moods)))
            
            # Create bar graph
            bargraph = pg.BarGraphItem(x=x_pos, height=counts, width=0.8, brush='c')
            self.mood_widget.addItem(bargraph)
            
            # Set x-axis labels
            ax = self.mood_widget.getAxis('bottom')
            labels = [(i, m[:15] + '...' if len(m) > 15 else m) for i, m in enumerate(moods)]
            ax.setTicks([labels])
    
    def update_cluster_chart(self):
        """Update cluster sizes chart."""
        self.cluster_widget.clear()
        
        cluster_data = self.metrics_data.get('clusters', {})
        if cluster_data:
            cluster_ids = list(cluster_data.keys())
            sizes = list(cluster_data.values())
            
            # Create bar graph
            bargraph = pg.BarGraphItem(x=cluster_ids, height=sizes, width=0.8, brush='m')
            self.cluster_widget.addItem(bargraph)
    
    def closeEvent(self, event):
        """Clean up on close."""
        if hasattr(self, 'db'):
            self.db.close()
        super().closeEvent(event)