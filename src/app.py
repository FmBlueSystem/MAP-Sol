#!/usr/bin/env python3
"""
Music Analyzer Pro - Main Application
Professional music analysis and visualization tool
"""

import sys
import os
from pathlib import Path
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QStackedWidget, QLabel, QPushButton,
    QSlider, QListWidget, QTreeWidget, QTreeWidgetItem,
    QTabWidget, QToolBar, QStatusBar, QMenuBar,
    QMenu, QFileDialog, QMessageBox, QProgressBar,
    QGroupBox, QGridLayout, QSpinBox, QComboBox,
    QLineEdit, QTextEdit, QListWidgetItem, QHeaderView,
    QTableWidget, QTableWidgetItem, QDockWidget,
    QToolButton, QButtonGroup, QRadioButton
)
from PyQt6.QtCore import (
    Qt, QTimer, QThread, pyqtSignal, QSize,
    QPoint, QRect, QPropertyAnimation, QEasingCurve,
    QUrl, QMimeData, QEvent, QObject, pyqtSlot
)
from PyQt6.QtGui import (
    QIcon, QPixmap, QPalette, QColor, QFont,
    QAction, QKeySequence, QPainter, QBrush,
    QLinearGradient, QRadialGradient, QPen,
    QFontDatabase, QDragEnterEvent, QDropEvent
)
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
from PyQt6.QtMultimediaWidgets import QVideoWidget
import pyqtgraph as pg
import numpy as np
from utils.logger import setup_logger

logger = setup_logger(__name__)


class WaveformWidget(pg.PlotWidget):
    """Custom waveform visualization widget"""
    
    def __init__(self):
        super().__init__()
        self.setBackground('#0a0a0a')
        self.showGrid(x=True, y=True, alpha=0.3)
        self.setLabel('left', 'Amplitude')
        self.setLabel('bottom', 'Time', units='s')
        self.getPlotItem().setMenuEnabled(False)
        
        # Style the plot
        self.getAxis('left').setPen('#00ffff')
        self.getAxis('bottom').setPen('#00ffff')
        self.getAxis('left').setTextPen('#00ffff')
        self.getAxis('bottom').setTextPen('#00ffff')
        
        # Initialize waveform curve
        self.curve = self.plot(pen=pg.mkPen('#00ffff', width=1))
        self.position_line = pg.InfiniteLine(
            pos=0, 
            angle=90, 
            pen=pg.mkPen('#ff00ff', width=2)
        )
        self.addItem(self.position_line)
        
    def update_waveform(self, data, sample_rate=44100):
        """Update waveform display with audio data"""
        if data is not None and len(data) > 0:
            time = np.arange(len(data)) / sample_rate
            self.curve.setData(time, data)
            
    def update_position(self, position):
        """Update playback position indicator"""
        self.position_line.setPos(position)


class SpectrumWidget(pg.PlotWidget):
    """Real-time spectrum analyzer widget"""
    
    def __init__(self):
        super().__init__()
        self.setBackground('#0a0a0a')
        self.showGrid(x=True, y=True, alpha=0.3)
        self.setLabel('left', 'Magnitude', units='dB')
        self.setLabel('bottom', 'Frequency', units='Hz')
        self.setLogMode(x=True, y=False)
        self.getPlotItem().setMenuEnabled(False)
        
        # Style the plot
        self.getAxis('left').setPen('#00ff00')
        self.getAxis('bottom').setPen('#00ff00')
        self.getAxis('left').setTextPen('#00ff00')
        self.getAxis('bottom').setTextPen('#00ff00')
        
        # Initialize spectrum bars
        self.bars = pg.BarGraphItem(
            x=np.logspace(1, 4, 64),
            height=np.zeros(64),
            width=0.3,
            brush='#00ff00'
        )
        self.addItem(self.bars)
        
    def update_spectrum(self, frequencies, magnitudes):
        """Update spectrum display"""
        if frequencies is not None and magnitudes is not None:
            self.bars.setOpts(x=frequencies, height=magnitudes)


class SpectrogramWidget(pg.ImageView):
    """Spectrogram visualization widget"""
    
    def __init__(self):
        super().__init__()
        self.view.setBackgroundColor('#0a0a0a')
        self.ui.histogram.hide()
        self.ui.roiBtn.hide()
        self.ui.menuBtn.hide()
        
        # Set colormap
        self.setColorMap(pg.colormap.get('viridis'))
        
    def update_spectrogram(self, data):
        """Update spectrogram display"""
        if data is not None:
            self.setImage(data.T, autoRange=True, autoLevels=True)


class PlayerControls(QWidget):
    """Audio player control panel"""
    
    play_clicked = pyqtSignal()
    pause_clicked = pyqtSignal()
    stop_clicked = pyqtSignal()
    seek_changed = pyqtSignal(int)
    volume_changed = pyqtSignal(int)
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        
    def init_ui(self):
        layout = QHBoxLayout()
        layout.setSpacing(10)
        
        # Play/Pause button
        self.play_btn = QPushButton()
        self.play_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_MediaPlay))
        self.play_btn.clicked.connect(self.play_clicked.emit)
        
        # Stop button
        self.stop_btn = QPushButton()
        self.stop_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_MediaStop))
        self.stop_btn.clicked.connect(self.stop_clicked.emit)
        
        # Previous button
        self.prev_btn = QPushButton()
        self.prev_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_MediaSkipBackward))
        
        # Next button
        self.next_btn = QPushButton()
        self.next_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_MediaSkipForward))
        
        # Time labels
        self.time_label = QLabel("00:00 / 00:00")
        self.time_label.setStyleSheet("color: #ffffff; font-family: monospace;")
        
        # Seek slider
        self.seek_slider = QSlider(Qt.Orientation.Horizontal)
        self.seek_slider.setRange(0, 100)
        self.seek_slider.sliderMoved.connect(self.seek_changed.emit)
        
        # Volume slider
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(70)
        self.volume_slider.setMaximumWidth(100)
        self.volume_slider.valueChanged.connect(self.volume_changed.emit)
        
        # Volume label
        self.volume_label = QLabel("🔊")
        
        # Add widgets to layout
        layout.addWidget(self.prev_btn)
        layout.addWidget(self.play_btn)
        layout.addWidget(self.stop_btn)
        layout.addWidget(self.next_btn)
        layout.addWidget(self.time_label)
        layout.addWidget(self.seek_slider, 1)
        layout.addWidget(self.volume_label)
        layout.addWidget(self.volume_slider)
        
        self.setLayout(layout)
        
    def set_playing(self, playing):
        """Update play/pause button state"""
        if playing:
            self.play_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_MediaPause))
        else:
            self.play_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_MediaPlay))
            
    def update_time(self, current, total):
        """Update time display"""
        current_str = f"{int(current//60):02d}:{int(current%60):02d}"
        total_str = f"{int(total//60):02d}:{int(total%60):02d}"
        self.time_label.setText(f"{current_str} / {total_str}")
        
    def update_position(self, position):
        """Update seek slider position"""
        self.seek_slider.blockSignals(True)
        self.seek_slider.setValue(position)
        self.seek_slider.blockSignals(False)


class LibraryPanel(QWidget):
    """Music library sidebar panel"""
    
    file_selected = pyqtSignal(str)
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Search bar
        self.search_bar = QLineEdit()
        self.search_bar.setPlaceholderText("Search library...")
        self.search_bar.setStyleSheet("""
            QLineEdit {
                background: #1a1a2e;
                border: 1px solid #00ffff;
                border-radius: 15px;
                padding: 8px 15px;
                color: #ffffff;
                font-size: 14px;
            }
        """)
        
        # Tab widget for different views
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet("""
            QTabWidget::pane {
                background: #0a0a0a;
                border: none;
            }
            QTabBar::tab {
                background: #1a1a2e;
                color: #808080;
                padding: 8px 15px;
                margin-right: 2px;
            }
            QTabBar::tab:selected {
                background: #00ffff;
                color: #0a0a0a;
            }
        """)
        
        # Playlist view
        self.playlist = QListWidget()
        self.playlist.setStyleSheet("""
            QListWidget {
                background: #0a0a0a;
                border: none;
                color: #ffffff;
            }
            QListWidget::item {
                padding: 10px;
                border-bottom: 1px solid #1a1a2e;
            }
            QListWidget::item:hover {
                background: #1a1a2e;
            }
            QListWidget::item:selected {
                background: #00ffff;
                color: #0a0a0a;
            }
        """)
        
        # File tree view
        self.file_tree = QTreeWidget()
        self.file_tree.setHeaderLabel("Files")
        self.file_tree.setStyleSheet("""
            QTreeWidget {
                background: #0a0a0a;
                border: none;
                color: #ffffff;
            }
            QTreeWidget::item {
                padding: 5px;
            }
            QTreeWidget::item:hover {
                background: #1a1a2e;
            }
            QTreeWidget::item:selected {
                background: #00ffff;
                color: #0a0a0a;
            }
        """)
        
        # Add tabs
        self.tabs.addTab(self.playlist, "Playlist")
        self.tabs.addTab(self.file_tree, "Files")
        
        # Add widgets to layout
        layout.addWidget(self.search_bar)
        layout.addWidget(self.tabs)
        
        self.setLayout(layout)
        
        # Connect signals
        self.playlist.itemDoubleClicked.connect(self.on_item_double_clicked)
        
    def on_item_double_clicked(self, item):
        """Handle double-click on playlist item"""
        if item.data(Qt.ItemDataRole.UserRole):
            self.file_selected.emit(item.data(Qt.ItemDataRole.UserRole))
            
    def add_file(self, file_path):
        """Add file to playlist"""
        item = QListWidgetItem(Path(file_path).name)
        item.setData(Qt.ItemDataRole.UserRole, file_path)
        self.playlist.addItem(item)


class AnalysisPanel(QWidget):
    """Audio analysis results panel"""
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Title
        title = QLabel("Audio Analysis")
        title.setStyleSheet("""
            QLabel {
                color: #00ffff;
                font-size: 18px;
                font-weight: bold;
                padding: 10px;
            }
        """)
        
        # Analysis results grid
        grid = QGridLayout()
        grid.setSpacing(15)
        
        # BPM
        self.bpm_label = self.create_stat_widget("BPM", "---")
        grid.addWidget(self.bpm_label, 0, 0)
        
        # Key
        self.key_label = self.create_stat_widget("Key", "---")
        grid.addWidget(self.key_label, 0, 1)
        
        # Energy
        self.energy_label = self.create_stat_widget("Energy", "---")
        grid.addWidget(self.energy_label, 1, 0)
        
        # Danceability
        self.dance_label = self.create_stat_widget("Danceability", "---")
        grid.addWidget(self.dance_label, 1, 1)
        
        # RMS
        self.rms_label = self.create_stat_widget("RMS", "---")
        grid.addWidget(self.rms_label, 2, 0)
        
        # Peak
        self.peak_label = self.create_stat_widget("Peak", "---")
        grid.addWidget(self.peak_label, 2, 1)
        
        # Add to main layout
        layout.addWidget(title)
        layout.addLayout(grid)
        layout.addStretch()
        
        self.setLayout(layout)
        
    def create_stat_widget(self, label, value):
        """Create a statistics display widget"""
        widget = QGroupBox(label)
        widget.setStyleSheet("""
            QGroupBox {
                color: #808080;
                border: 1px solid #1a1a2e;
                border-radius: 5px;
                margin-top: 10px;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)
        
        layout = QVBoxLayout()
        value_label = QLabel(value)
        value_label.setStyleSheet("""
            QLabel {
                color: #ffffff;
                font-size: 24px;
                font-weight: bold;
            }
        """)
        value_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(value_label)
        widget.setLayout(layout)
        
        return widget
        
    def update_analysis(self, results):
        """Update analysis display with results"""
        if 'bpm' in results:
            self.bpm_label.findChild(QLabel).setText(f"{results['bpm']:.1f}")
        if 'key' in results:
            self.key_label.findChild(QLabel).setText(results['key'])
        if 'energy' in results:
            self.energy_label.findChild(QLabel).setText(f"{results['energy']:.2f}")
        if 'danceability' in results:
            self.dance_label.findChild(QLabel).setText(f"{results['danceability']:.2f}")
        if 'rms' in results:
            self.rms_label.findChild(QLabel).setText(f"{results['rms']:.3f}")
        if 'peak' in results:
            self.peak_label.findChild(QLabel).setText(f"{results['peak']:.3f}")


class MusicAnalyzerApp(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.media_player = QMediaPlayer()
        self.audio_output = QAudioOutput()
        self.media_player.setAudioOutput(self.audio_output)
        self.current_file = None
        self.init_ui()
        self.apply_dark_theme()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("Music Analyzer Pro - Qt Edition")
        self.setGeometry(100, 100, 1400, 900)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Create splitter for resizable panels
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Left panel - Library
        self.library_panel = LibraryPanel()
        self.library_panel.setMinimumWidth(250)
        self.library_panel.setMaximumWidth(400)
        splitter.addWidget(self.library_panel)
        
        # Center panel - Visualizations
        center_widget = QWidget()
        center_layout = QVBoxLayout(center_widget)
        center_layout.setContentsMargins(10, 10, 10, 10)
        
        # Visualization tabs
        viz_tabs = QTabWidget()
        viz_tabs.setStyleSheet("""
            QTabWidget::pane {
                background: #0a0a0a;
                border: 1px solid #1a1a2e;
            }
        """)
        
        # Waveform tab
        self.waveform = WaveformWidget()
        viz_tabs.addTab(self.waveform, "Waveform")
        
        # Spectrum tab
        self.spectrum = SpectrumWidget()
        viz_tabs.addTab(self.spectrum, "Spectrum")
        
        # Spectrogram tab
        self.spectrogram = SpectrogramWidget()
        viz_tabs.addTab(self.spectrogram, "Spectrogram")
        
        # Player controls
        self.controls = PlayerControls()
        
        # Add to center layout
        center_layout.addWidget(viz_tabs, 1)
        center_layout.addWidget(self.controls)
        
        splitter.addWidget(center_widget)
        
        # Right panel - Analysis
        self.analysis_panel = AnalysisPanel()
        self.analysis_panel.setMinimumWidth(250)
        self.analysis_panel.setMaximumWidth(400)
        splitter.addWidget(self.analysis_panel)
        
        # Set splitter sizes
        splitter.setSizes([300, 800, 300])
        
        # Add splitter to main layout
        main_layout.addWidget(splitter)
        
        # Create menus
        self.create_menus()
        
        # Create toolbar
        self.create_toolbar()
        
        # Create status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready")
        
        # Connect signals
        self.connect_signals()
        
        # Enable drag and drop
        self.setAcceptDrops(True)
        
    def create_menus(self):
        """Create application menus"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu("File")
        
        open_action = QAction("Open File...", self)
        open_action.setShortcut(QKeySequence.StandardKey.Open)
        open_action.triggered.connect(self.open_file)
        file_menu.addAction(open_action)
        
        open_folder_action = QAction("Open Folder...", self)
        open_folder_action.setShortcut("Ctrl+Shift+O")
        open_folder_action.triggered.connect(self.open_folder)
        file_menu.addAction(open_folder_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("Exit", self)
        exit_action.setShortcut(QKeySequence.StandardKey.Quit)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # Edit menu
        edit_menu = menubar.addMenu("Edit")
        
        clear_action = QAction("Clear Playlist", self)
        clear_action.triggered.connect(self.clear_playlist)
        edit_menu.addAction(clear_action)
        
        # View menu
        view_menu = menubar.addMenu("View")
        
        fullscreen_action = QAction("Fullscreen", self)
        fullscreen_action.setShortcut("F11")
        fullscreen_action.setCheckable(True)
        fullscreen_action.triggered.connect(self.toggle_fullscreen)
        view_menu.addAction(fullscreen_action)
        
        # Tools menu
        tools_menu = menubar.addMenu("Tools")
        
        analyze_action = QAction("Analyze Current", self)
        analyze_action.setShortcut("Ctrl+A")
        analyze_action.triggered.connect(self.analyze_current)
        tools_menu.addAction(analyze_action)
        
        batch_action = QAction("Batch Analysis...", self)
        batch_action.triggered.connect(self.batch_analysis)
        tools_menu.addAction(batch_action)
        
        # Help menu
        help_menu = menubar.addMenu("Help")
        
        about_action = QAction("About", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
        
    def create_toolbar(self):
        """Create application toolbar"""
        toolbar = QToolBar()
        toolbar.setMovable(False)
        toolbar.setStyleSheet("""
            QToolBar {
                background: #1a1a2e;
                border: none;
                padding: 5px;
            }
        """)
        self.addToolBar(toolbar)
        
        # Open file button
        open_btn = QToolButton()
        open_btn.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_DirOpenIcon))
        open_btn.clicked.connect(self.open_file)
        toolbar.addWidget(open_btn)
        
        toolbar.addSeparator()
        
        # Analysis button
        analyze_btn = QToolButton()
        analyze_btn.setText("Analyze")
        analyze_btn.clicked.connect(self.analyze_current)
        toolbar.addWidget(analyze_btn)
        
    def connect_signals(self):
        """Connect widget signals"""
        # Library signals
        self.library_panel.file_selected.connect(self.load_file)
        
        # Control signals
        self.controls.play_clicked.connect(self.toggle_playback)
        self.controls.stop_clicked.connect(self.stop_playback)
        self.controls.seek_changed.connect(self.seek_position)
        self.controls.volume_changed.connect(self.set_volume)
        
        # Media player signals
        self.media_player.positionChanged.connect(self.update_position)
        self.media_player.durationChanged.connect(self.update_duration)
        
    def apply_dark_theme(self):
        """Apply dark theme to application"""
        self.setStyleSheet("""
            QMainWindow {
                background: #030712;
            }
            QWidget {
                background: #030712;
                color: #ffffff;
            }
            QMenuBar {
                background: #0a0a0a;
                color: #ffffff;
            }
            QMenuBar::item:selected {
                background: #1a1a2e;
            }
            QMenu {
                background: #0a0a0a;
                color: #ffffff;
                border: 1px solid #1a1a2e;
            }
            QMenu::item:selected {
                background: #00ffff;
                color: #0a0a0a;
            }
            QStatusBar {
                background: #0a0a0a;
                color: #808080;
            }
            QPushButton {
                background: #1a1a2e;
                border: 1px solid #00ffff;
                border-radius: 5px;
                padding: 8px;
                color: #ffffff;
            }
            QPushButton:hover {
                background: #00ffff;
                color: #0a0a0a;
            }
            QSlider::groove:horizontal {
                height: 4px;
                background: #1a1a2e;
                border-radius: 2px;
            }
            QSlider::handle:horizontal {
                background: #00ffff;
                width: 12px;
                height: 12px;
                border-radius: 6px;
                margin: -4px 0;
            }
            QSlider::sub-page:horizontal {
                background: #00ffff;
                border-radius: 2px;
            }
        """)
        
    def dragEnterEvent(self, event: QDragEnterEvent):
        """Handle drag enter event"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            
    def dropEvent(self, event: QDropEvent):
        """Handle drop event"""
        files = [url.toLocalFile() for url in event.mimeData().urls()]
        for file_path in files:
            if file_path.endswith(('.mp3', '.wav', '.flac', '.m4a', '.ogg')):
                self.library_panel.add_file(file_path)
                if not self.current_file:
                    self.load_file(file_path)
                    
    def open_file(self):
        """Open file dialog to select audio file"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Open Audio File",
            "",
            "Audio Files (*.mp3 *.wav *.flac *.m4a *.ogg);;All Files (*.*)"
        )
        if file_path:
            self.library_panel.add_file(file_path)
            self.load_file(file_path)
            
    def open_folder(self):
        """Open folder dialog to select music folder"""
        folder_path = QFileDialog.getExistingDirectory(
            self,
            "Select Music Folder"
        )
        if folder_path:
            self.load_folder(folder_path)
            
    def load_folder(self, folder_path):
        """Load all audio files from folder"""
        folder = Path(folder_path)
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg']
        
        for file_path in folder.rglob('*'):
            if file_path.suffix.lower() in audio_extensions:
                self.library_panel.add_file(str(file_path))
                
        self.status_bar.showMessage(f"Loaded folder: {folder_path}")
        
    def load_file(self, file_path):
        """Load audio file for playback"""
        try:
            self.current_file = file_path
            self.media_player.setSource(QUrl.fromLocalFile(file_path))
            self.status_bar.showMessage(f"Loaded: {Path(file_path).name}")
            
            # Load waveform (simplified for now)
            self.load_waveform(file_path)
            
        except Exception as e:
            logger.error(f"Error loading file: {e}")
            QMessageBox.critical(self, "Error", f"Failed to load file: {e}")
            
    def load_waveform(self, file_path):
        """Load and display waveform"""
        # This is a placeholder - actual implementation would use librosa
        # to load and process the audio file
        dummy_data = np.random.randn(44100 * 30)  # 30 seconds of dummy data
        self.waveform.update_waveform(dummy_data)
        
    def toggle_playback(self):
        """Toggle play/pause"""
        if self.media_player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.media_player.pause()
            self.controls.set_playing(False)
        else:
            self.media_player.play()
            self.controls.set_playing(True)
            
    def stop_playback(self):
        """Stop playback"""
        self.media_player.stop()
        self.controls.set_playing(False)
        
    def seek_position(self, position):
        """Seek to position"""
        if self.media_player.duration() > 0:
            seek_pos = int((position / 100) * self.media_player.duration())
            self.media_player.setPosition(seek_pos)
            
    def set_volume(self, volume):
        """Set playback volume"""
        self.audio_output.setVolume(volume / 100)
        
    def update_position(self, position):
        """Update position display"""
        if self.media_player.duration() > 0:
            progress = int((position / self.media_player.duration()) * 100)
            self.controls.update_position(progress)
            self.controls.update_time(position / 1000, self.media_player.duration() / 1000)
            self.waveform.update_position(position / 1000)
            
    def update_duration(self, duration):
        """Update duration display"""
        self.controls.update_time(0, duration / 1000)
        
    def analyze_current(self):
        """Analyze current audio file"""
        if self.current_file:
            self.status_bar.showMessage("Analyzing audio...")
            # Placeholder for actual analysis
            results = {
                'bpm': 128.5,
                'key': 'C Major',
                'energy': 0.75,
                'danceability': 0.82,
                'rms': 0.234,
                'peak': 0.987
            }
            self.analysis_panel.update_analysis(results)
            self.status_bar.showMessage("Analysis complete")
            
    def batch_analysis(self):
        """Open batch analysis dialog"""
        QMessageBox.information(self, "Batch Analysis", "Batch analysis feature coming soon!")
        
    def clear_playlist(self):
        """Clear the playlist"""
        self.library_panel.playlist.clear()
        
    def toggle_fullscreen(self, checked):
        """Toggle fullscreen mode"""
        if checked:
            self.showFullScreen()
        else:
            self.showNormal()
            
    def show_about(self):
        """Show about dialog"""
        QMessageBox.about(
            self,
            "About Music Analyzer Pro",
            "<h2>Music Analyzer Pro</h2>"
            "<p>Version 1.0.0 - Qt Edition</p>"
            "<p>Professional music analysis and visualization tool</p>"
            "<p>© 2024 BlueSystemIO</p>"
        )
        
    def closeEvent(self, event):
        """Handle close event"""
        self.media_player.stop()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MusicAnalyzerApp()
    window.show()
    sys.exit(app.exec())