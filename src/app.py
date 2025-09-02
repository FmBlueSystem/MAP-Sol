"""
Main application entry point for Music Analyzer Pro.
"""

import sys
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QMainWindow, QDockWidget
from PyQt6.QtCore import Qt
from music_player import MusicPlayerWindow
from ui.cluster_explorer import ClusterExplorerWidget
from ui.analytics_dashboard import AnalyticsDashboardWidget
from ui.structure_widget import StructureWidget
from telemetry.telemetry import init_telemetry, get_telemetry
from utils.config import get_config


class MusicAnalyzerApp(MusicPlayerWindow):
    """Extended music player with analysis features."""
    
    def __init__(self):
        """Initialize the application."""
        super().__init__()
        self.setWindowTitle("Music Analyzer Pro")
        self.cluster_dock = None
        self.analytics_dock = None
        self.structure_dock = None
        self.add_analyzer_menus()
        
        # Initialize telemetry
        self.setup_telemetry()
        
        # Track app start
        telemetry = get_telemetry()
        telemetry.track('app_start', {'version': '1.0.0'})
    
    def add_analyzer_menus(self):
        """Add analyzer-specific menu items."""
        menubar = self.menuBar()
        
        # Find or create Tools menu
        tools_menu = None
        for action in menubar.actions():
            if action.text() == "Tools":
                tools_menu = action.menu()
                break
        
        if not tools_menu:
            tools_menu = menubar.addMenu("Tools")
        
        # Add separator before analyzer items
        tools_menu.addSeparator()
        
        # Add cluster explorer action
        open_cluster_action = tools_menu.addAction("Open Cluster Explorer")
        open_cluster_action.triggered.connect(self.open_cluster_explorer)
        
        # Add analytics dashboard action
        open_analytics_action = tools_menu.addAction("Open Analytics Dashboard")
        open_analytics_action.triggered.connect(self.open_analytics_dashboard)
        
        # Add structure analysis action
        open_structure_action = tools_menu.addAction("Open Structure & Mix Points")
        open_structure_action.triggered.connect(self.open_structure_dock)
        
        # Find or create Help menu
        help_menu = None
        for action in menubar.actions():
            if action.text() == "Help":
                help_menu = action.menu()
                break
        
        if not help_menu:
            help_menu = menubar.addMenu("Help")
        
        # Add Quick Start action
        quick_start_action = help_menu.addAction("Quick Start")
        quick_start_action.triggered.connect(self.open_quick_start)
    
    def open_cluster_explorer(self):
        """Open the cluster explorer dock."""
        if self.cluster_dock is None:
            # Create cluster explorer widget
            cluster_widget = ClusterExplorerWidget()
            
            # Connect to play track
            cluster_widget.track_selected.connect(self.play_file)
            
            # Create dock
            self.cluster_dock = QDockWidget("Cluster Explorer", self)
            self.cluster_dock.setWidget(cluster_widget)
            self.cluster_dock.setAllowedAreas(
                Qt.DockWidgetArea.LeftDockWidgetArea | 
                Qt.DockWidgetArea.RightDockWidgetArea
            )
            
            # Add to main window
            self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, self.cluster_dock)
        
        # Show the dock
        self.cluster_dock.show()
        self.cluster_dock.raise_()
    
    def open_analytics_dashboard(self):
        """Open the analytics dashboard dock."""
        if self.analytics_dock is None:
            # Create analytics dashboard widget
            analytics_widget = AnalyticsDashboardWidget()
            
            # Create dock
            self.analytics_dock = QDockWidget("Analytics Dashboard", self)
            self.analytics_dock.setWidget(analytics_widget)
            self.analytics_dock.setAllowedAreas(
                Qt.DockWidgetArea.LeftDockWidgetArea | 
                Qt.DockWidgetArea.RightDockWidgetArea |
                Qt.DockWidgetArea.BottomDockWidgetArea
            )
            
            # Add to main window
            self.addDockWidget(Qt.DockWidgetArea.BottomDockWidgetArea, self.analytics_dock)
        
        # Show the dock
        self.analytics_dock.show()
        self.analytics_dock.raise_()
    
    def open_structure_dock(self):
        """Open the structure analysis dock."""
        if self.structure_dock is None:
            # Create structure widget
            structure_widget = StructureWidget()
            
            # Create dock
            self.structure_dock = QDockWidget("Structure & Mix Points", self)
            self.structure_dock.setWidget(structure_widget)
            self.structure_dock.setAllowedAreas(
                Qt.DockWidgetArea.LeftDockWidgetArea | 
                Qt.DockWidgetArea.RightDockWidgetArea |
                Qt.DockWidgetArea.BottomDockWidgetArea
            )
            
            # Add to main window
            self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, self.structure_dock)
            
            # Connect to current track if available
            # Note: In a real implementation, we'd connect to track change signals
            # For now, user needs to manually set track in the widget
        
        # Show the dock
        self.structure_dock.show()
        self.structure_dock.raise_()
    
    def open_quick_start(self):
        """Open the Quick Start guide dialog."""
        from ui.quick_start import QuickStartDialog
        
        dialog = QuickStartDialog(self)
        dialog.exec()
    
    def setup_telemetry(self):
        """Setup telemetry based on config."""
        config = get_config()
        telemetry_config = config.get('telemetry', {})
        enabled = telemetry_config.get('enabled', False)
        log_path = telemetry_config.get('log_path', '~/.music_player_qt/telemetry.jsonl')
        
        # Expand user path
        log_path = Path(log_path).expanduser()
        
        # Initialize telemetry
        init_telemetry(enabled=enabled, log_path=log_path, app_version='1.0.0')
    
    def closeEvent(self, event):
        """Handle application close."""
        # Track app quit
        telemetry = get_telemetry()
        telemetry.track('app_quit')
        
        # Call parent closeEvent
        super().closeEvent(event)


def main():
    """Main application entry point."""
    app = QApplication(sys.argv)
    app.setApplicationName("Music Analyzer Pro")
    app.setOrganizationName("MusicTech")
    
    # Create and show main window
    window = MusicAnalyzerApp()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()