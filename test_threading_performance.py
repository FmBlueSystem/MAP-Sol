#!/usr/bin/env python3
"""
Test suite para verificar que la UI no se bloquea durante operaciones pesadas.
Simula importación masiva y análisis para medir responsividad.
"""

import sys
import time
import threading
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from PyQt6.QtWidgets import QApplication, QMainWindow, QPushButton, QVBoxLayout, QWidget, QLabel, QTextEdit, QProgressBar
from PyQt6.QtCore import QTimer, QThread, pyqtSignal, QElapsedTimer
from PyQt6.QtGui import QFont

from utils.logger import setup_logger
logger = setup_logger(__name__)


class UIResponsivenessTest(QMainWindow):
    """Test window to verify UI responsiveness during heavy operations."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("🧪 Threading & UI Performance Test")
        self.setGeometry(100, 100, 800, 600)
        
        # Track UI responsiveness
        self.ui_frozen = False
        self.response_times = []
        self.test_timer = QTimer()
        self.test_timer.timeout.connect(self.check_ui_response)
        self.elapsed_timer = QElapsedTimer()
        
        self.setup_ui()
        
    def setup_ui(self):
        """Create test UI."""
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        
        # Title
        title = QLabel("🔬 UI Responsiveness & Threading Test")
        title.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        layout.addWidget(title)
        
        # Status label
        self.status_label = QLabel("Ready to test. Click buttons below to simulate operations.")
        layout.addWidget(self.status_label)
        
        # Progress bar
        self.progress = QProgressBar()
        layout.addWidget(self.progress)
        
        # Response time indicator
        self.response_indicator = QLabel("UI Response: ✅ Responsive (0ms)")
        self.response_indicator.setStyleSheet("QLabel { color: green; font-weight: bold; }")
        layout.addWidget(self.response_indicator)
        
        # Test buttons
        layout.addWidget(QLabel("\n📊 TESTS:"))
        
        # Test 1: Blocking operation (BAD)
        btn1 = QPushButton("❌ Test 1: Blocking Operation (BAD - Freezes UI)")
        btn1.clicked.connect(self.test_blocking_operation)
        btn1.setStyleSheet("QPushButton { background-color: #ffcccc; }")
        layout.addWidget(btn1)
        
        # Test 2: QTimer operation (GOOD)
        btn2 = QPushButton("✅ Test 2: QTimer Operation (GOOD - UI Responsive)")
        btn2.clicked.connect(self.test_qtimer_operation)
        btn2.setStyleSheet("QPushButton { background-color: #ccffcc; }")
        layout.addWidget(btn2)
        
        # Test 3: QThread operation (GOOD)
        btn3 = QPushButton("✅ Test 3: QThread Operation (GOOD - Background Thread)")
        btn3.clicked.connect(self.test_qthread_operation)
        btn3.setStyleSheet("QPushButton { background-color: #ccffcc; }")
        layout.addWidget(btn3)
        
        # Test 4: Threading.Thread operation (GOOD)
        btn4 = QPushButton("✅ Test 4: Python Thread Operation (GOOD - Daemon Thread)")
        btn4.clicked.connect(self.test_python_thread_operation)
        btn4.setStyleSheet("QPushButton { background-color: #ccffcc; }")
        layout.addWidget(btn4)
        
        # Test 5: Simulate real import flow
        btn5 = QPushButton("🎵 Test 5: Simulate Real Import Flow (Multiple Threads)")
        btn5.clicked.connect(self.test_real_import_flow)
        btn5.setStyleSheet("QPushButton { background-color: #cce6ff; }")
        layout.addWidget(btn5)
        
        # Log output
        layout.addWidget(QLabel("\n📝 LOG:"))
        self.log_output = QTextEdit()
        self.log_output.setMaximumHeight(200)
        self.log_output.setReadOnly(True)
        layout.addWidget(self.log_output)
        
        # Start UI response monitoring
        self.test_timer.start(100)  # Check every 100ms
        self.elapsed_timer.start()
        
    def log(self, message):
        """Add message to log."""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        self.log_output.append(f"[{timestamp}] {message}")
        
    def check_ui_response(self):
        """Monitor UI responsiveness."""
        # This runs every 100ms to check if UI is responsive
        elapsed = self.elapsed_timer.elapsed()
        self.elapsed_timer.restart()
        
        # If elapsed > 150ms, UI was frozen
        if elapsed > 150:
            self.ui_frozen = True
            self.response_indicator.setText(f"UI Response: ❌ FROZEN ({elapsed}ms)")
            self.response_indicator.setStyleSheet("QLabel { color: red; font-weight: bold; }")
            self.log(f"⚠️ UI FROZEN for {elapsed}ms!")
        else:
            self.response_indicator.setText(f"UI Response: ✅ Responsive ({elapsed}ms)")
            self.response_indicator.setStyleSheet("QLabel { color: green; font-weight: bold; }")
            
        self.response_times.append(elapsed)
        
    def test_blocking_operation(self):
        """Test a blocking operation (BAD - freezes UI)."""
        self.log("Starting BLOCKING operation (BAD)...")
        self.status_label.setText("❌ Running blocking operation - UI will freeze!")
        
        # This is BAD - blocks the UI thread
        for i in range(5):
            time.sleep(1)  # Simulates heavy processing
            self.progress.setValue((i + 1) * 20)
            # UI won't update until this completes!
        
        self.status_label.setText("Blocking operation complete - UI was frozen!")
        self.log("❌ Blocking operation finished - UI was frozen during execution")
        
    def test_qtimer_operation(self):
        """Test QTimer-based operation (GOOD - UI responsive)."""
        self.log("Starting QTimer operation (GOOD)...")
        self.status_label.setText("✅ Running QTimer operation - UI remains responsive")
        self.progress.setValue(0)
        
        self.timer_count = 0
        
        def process_next():
            if self.timer_count >= 5:
                self.status_label.setText("QTimer operation complete - UI was responsive!")
                self.log("✅ QTimer operation finished - UI remained responsive")
                return
                
            # Simulate some work
            time.sleep(0.1)  # Small work chunk
            self.timer_count += 1
            self.progress.setValue(self.timer_count * 20)
            self.log(f"  Processing chunk {self.timer_count}/5")
            
            # Schedule next chunk
            QTimer.singleShot(100, process_next)
        
        QTimer.singleShot(0, process_next)
        
    def test_qthread_operation(self):
        """Test QThread operation (GOOD - background thread)."""
        self.log("Starting QThread operation (GOOD)...")
        self.status_label.setText("✅ Running QThread operation - UI remains responsive")
        self.progress.setValue(0)
        
        class Worker(QThread):
            progress = pyqtSignal(int)
            finished = pyqtSignal(str)
            log_signal = pyqtSignal(str)
            
            def run(self):
                for i in range(5):
                    time.sleep(1)  # Heavy work in background thread
                    self.progress.emit((i + 1) * 20)
                    self.log_signal.emit(f"  QThread processing {i+1}/5")
                self.finished.emit("QThread operation complete!")
        
        self.worker = Worker()
        self.worker.progress.connect(self.progress.setValue)
        self.worker.finished.connect(lambda msg: self.status_label.setText(f"{msg} - UI was responsive!"))
        self.worker.finished.connect(lambda: self.log("✅ QThread finished - UI remained responsive"))
        self.worker.log_signal.connect(self.log)
        self.worker.start()
        
    def test_python_thread_operation(self):
        """Test Python threading.Thread (GOOD - daemon thread)."""
        self.log("Starting Python thread operation (GOOD)...")
        self.status_label.setText("✅ Running Python thread - UI remains responsive")
        self.progress.setValue(0)
        
        def background_work():
            for i in range(5):
                time.sleep(1)  # Heavy work
                # Use Qt's thread-safe signal mechanism
                progress_val = (i + 1) * 20
                QTimer.singleShot(0, lambda v=progress_val: self.progress.setValue(v))
                QTimer.singleShot(0, lambda i=i: self.log(f"  Python thread processing {i+1}/5"))
            
            QTimer.singleShot(0, lambda: self.status_label.setText("Python thread complete - UI was responsive!"))
            QTimer.singleShot(0, lambda: self.log("✅ Python thread finished - UI remained responsive"))
        
        thread = threading.Thread(target=background_work, daemon=True)
        thread.start()
        
    def test_real_import_flow(self):
        """Simulate the real import flow with multiple threads."""
        self.log("Starting REAL IMPORT FLOW simulation...")
        self.status_label.setText("🎵 Simulating real import flow...")
        self.progress.setValue(0)
        
        # Simulate the actual import flow from music_player.py
        files_to_import = ["track1.mp3", "track2.mp3", "track3.mp3"]
        
        class ImportWorker(QThread):
            """Simulates ImportAnalysisWorker"""
            progress = pyqtSignal(str)
            finished = pyqtSignal()
            
            def __init__(self, files):
                super().__init__()
                self.files = files
                
            def run(self):
                for file in self.files:
                    # Simulate HAMMS analysis
                    self.progress.emit(f"Analyzing HAMMS for {file}")
                    time.sleep(1)  # Simulate analysis time
                    
                    # Simulate OpenAI enrichment in separate thread
                    def enrich():
                        time.sleep(0.5)  # Simulate API call
                        QTimer.singleShot(0, lambda f=file: self.progress.emit(f"AI enrichment for {f}"))
                    
                    thread = threading.Thread(target=enrich, daemon=True)
                    thread.start()
                    
                self.finished.emit()
        
        self.import_worker = ImportWorker(files_to_import)
        self.import_worker.progress.connect(self.log)
        self.import_worker.finished.connect(lambda: self.status_label.setText("Real import flow complete!"))
        self.import_worker.finished.connect(lambda: self.log("✅ Real import simulation finished"))
        self.import_worker.finished.connect(lambda: self.progress.setValue(100))
        
        # Start with QTimer (like real import)
        def start_import():
            self.log("  Starting import with QTimer...")
            self.progress.setValue(10)
            self.import_worker.start()
        
        QTimer.singleShot(100, start_import)
        
    def closeEvent(self, event):
        """Show statistics on close."""
        if self.response_times:
            avg_response = sum(self.response_times) / len(self.response_times)
            max_response = max(self.response_times)
            
            print("\n" + "="*60)
            print("📊 UI RESPONSIVENESS STATISTICS:")
            print("="*60)
            print(f"Average response time: {avg_response:.1f}ms")
            print(f"Max response time: {max_response:.1f}ms")
            print(f"UI was frozen: {'YES ❌' if max_response > 200 else 'NO ✅'}")
            print("="*60)


def main():
    """Run the threading test."""
    app = QApplication(sys.argv)
    
    print("\n" + "="*60)
    print("🧪 THREADING & UI PERFORMANCE TEST")
    print("="*60)
    print("\nThis test verifies that heavy operations don't block the UI.")
    print("Watch the UI Response indicator while running tests.")
    print("\nTests:")
    print("1. ❌ Blocking (BAD) - Freezes UI")
    print("2. ✅ QTimer (GOOD) - UI responsive")
    print("3. ✅ QThread (GOOD) - Background thread")
    print("4. ✅ Python Thread (GOOD) - Daemon thread")
    print("5. 🎵 Real Import Flow - Multiple threads")
    print("="*60 + "\n")
    
    window = UIResponsivenessTest()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()