"""
Cluster explorer widget for browsing library clusters.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QSplitter,
    QListWidget, QListWidgetItem, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QProgressDialog, QHeaderView
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont
from database import MusicDatabase
from ai_analysis.cluster_batch import ClusterBatch


class ClusterWorker(QThread):
    """Worker thread for clustering operations."""
    
    finished = pyqtSignal(dict)
    
    def __init__(self, db_path: str, n_clusters: int = 12):
        super().__init__()
        self.db_path = db_path
        self.n_clusters = n_clusters
    
    def run(self):
        """Run clustering in background."""
        batch = ClusterBatch(self.db_path, self.n_clusters)
        result = batch.process_all()
        self.finished.emit(result)


class ClusterExplorerWidget(QWidget):
    """Widget for exploring track clusters."""
    
    track_selected = pyqtSignal(str)  # Emit filepath when track double-clicked
    
    def __init__(self, parent=None):
        """Initialize the cluster explorer widget."""
        super().__init__(parent)
        self.db = MusicDatabase()
        self.current_cluster = None
        self.init_ui()
        self.load_clusters()
    
    def init_ui(self):
        """Initialize the user interface."""
        layout = QVBoxLayout()
        
        # Header with recompute button
        header_layout = QHBoxLayout()
        
        title = QLabel("Cluster Explorer")
        title_font = QFont()
        title_font.setPointSize(14)
        title_font.setBold(True)
        title.setFont(title_font)
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        self.recompute_btn = QPushButton("Recompute Clusters")
        self.recompute_btn.clicked.connect(self.recompute_clusters)
        header_layout.addWidget(self.recompute_btn)
        
        layout.addLayout(header_layout)
        
        # Main content splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Left panel - Cluster list
        left_widget = QWidget()
        left_layout = QVBoxLayout()
        
        cluster_label = QLabel("Clusters")
        cluster_label.setStyleSheet("font-weight: bold;")
        left_layout.addWidget(cluster_label)
        
        self.cluster_list = QListWidget()
        self.cluster_list.currentItemChanged.connect(self.on_cluster_selected)
        left_layout.addWidget(self.cluster_list)
        
        left_widget.setLayout(left_layout)
        left_widget.setMaximumWidth(250)
        
        # Right panel - Track table
        right_widget = QWidget()
        right_layout = QVBoxLayout()
        
        self.tracks_label = QLabel("Tracks in Cluster")
        self.tracks_label.setStyleSheet("font-weight: bold;")
        right_layout.addWidget(self.tracks_label)
        
        self.tracks_table = QTableWidget()
        self.tracks_table.setColumnCount(6)
        self.tracks_table.setHorizontalHeaderLabels([
            "Title", "Artist", "BPM", "Key", "Energy", "Mood"
        ])
        self.tracks_table.setAlternatingRowColors(True)
        self.tracks_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.tracks_table.horizontalHeader().setStretchLastSection(True)
        self.tracks_table.itemDoubleClicked.connect(self.on_track_double_clicked)
        right_layout.addWidget(self.tracks_table)
        
        right_widget.setLayout(right_layout)
        
        # Add to splitter
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(1, 2)  # Give more space to track table
        
        layout.addWidget(splitter)
        self.setLayout(layout)
    
    def load_clusters(self):
        """Load cluster list from database."""
        self.cluster_list.clear()
        
        try:
            clusters = self.db.list_clusters()
            
            if not clusters:
                item = QListWidgetItem("No clusters found")
                item.setData(Qt.ItemDataRole.UserRole, None)
                self.cluster_list.addItem(item)
                return
            
            for cluster_info in clusters:
                cluster_id = cluster_info['cluster_id']
                track_count = cluster_info['track_count']
                
                item_text = f"Cluster {cluster_id} ({track_count} tracks)"
                item = QListWidgetItem(item_text)
                item.setData(Qt.ItemDataRole.UserRole, cluster_id)
                self.cluster_list.addItem(item)
            
            # Select first cluster
            if self.cluster_list.count() > 0:
                self.cluster_list.setCurrentRow(0)
                
        except Exception as e:
            print(f"Error loading clusters: {e}")
    
    def on_cluster_selected(self, current, previous):
        """Handle cluster selection."""
        if not current:
            return
        
        cluster_id = current.data(Qt.ItemDataRole.UserRole)
        if cluster_id is None:
            self.tracks_table.setRowCount(0)
            return
        
        self.current_cluster = cluster_id
        self.load_cluster_tracks(cluster_id)
    
    def load_cluster_tracks(self, cluster_id: int):
        """Load tracks for the selected cluster."""
        self.tracks_label.setText(f"Tracks in Cluster {cluster_id}")
        
        try:
            tracks = self.db.get_cluster_tracks(cluster_id)
            
            self.tracks_table.setRowCount(len(tracks))
            
            for row, track in enumerate(tracks):
                # Store filepath in first column's data
                title_item = QTableWidgetItem(track['title'])
                title_item.setData(Qt.ItemDataRole.UserRole, track['filepath'])
                self.tracks_table.setItem(row, 0, title_item)
                
                self.tracks_table.setItem(row, 1, QTableWidgetItem(track['artist']))
                
                if track['bpm']:
                    self.tracks_table.setItem(row, 2, QTableWidgetItem(f"{track['bpm']:.1f}"))
                else:
                    self.tracks_table.setItem(row, 2, QTableWidgetItem("-"))
                
                self.tracks_table.setItem(row, 3, QTableWidgetItem(track['camelot_key'] or "-"))
                self.tracks_table.setItem(row, 4, QTableWidgetItem(str(track['energy_level'])))
                self.tracks_table.setItem(row, 5, QTableWidgetItem(track['mood'] or "-"))
            
            # Resize columns to content
            self.tracks_table.resizeColumnsToContents()
            
        except Exception as e:
            print(f"Error loading cluster tracks: {e}")
            self.tracks_table.setRowCount(0)
    
    def on_track_double_clicked(self, item):
        """Handle track double-click."""
        if item.column() == 0:  # Title column
            filepath = item.data(Qt.ItemDataRole.UserRole)
            if filepath:
                self.track_selected.emit(filepath)
    
    def recompute_clusters(self):
        """Recompute clusters in background."""
        # Create progress dialog
        progress = QProgressDialog(
            "Computing clusters...", 
            "Cancel", 
            0, 0, 
            self
        )
        progress.setWindowTitle("Clustering")
        progress.setModal(True)
        progress.setMinimumDuration(0)
        progress.show()
        
        # Create and start worker
        worker = ClusterWorker(self.db.db_path)
        
        def on_finished(result):
            progress.close()
            
            if result.get('success'):
                # Reload clusters
                self.load_clusters()
                
                # Show summary
                from PyQt6.QtWidgets import QMessageBox
                QMessageBox.information(
                    self,
                    "Clustering Complete",
                    f"Created {result.get('n_clusters', 0)} clusters with "
                    f"{result.get('total_tracks', 0)} tracks"
                )
            else:
                from PyQt6.QtWidgets import QMessageBox
                QMessageBox.warning(
                    self,
                    "Clustering Failed",
                    f"Error: {result.get('error', 'Unknown error')}"
                )
        
        def on_cancelled():
            worker.quit()
            worker.wait()
        
        worker.finished.connect(on_finished)
        progress.canceled.connect(on_cancelled)
        
        worker.start()
    
    def closeEvent(self, event):
        """Clean up on close."""
        if hasattr(self, 'db'):
            self.db.close()
        super().closeEvent(event)