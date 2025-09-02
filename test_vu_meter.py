#!/usr/bin/env python3
"""Test script for VU Meter widget"""

import sys
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QPushButton, QHBoxLayout
from PyQt6.QtCore import QTimer
import random
import math

# Add src to path
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from ui.vu_meter import VUMeterWidget


class TestWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("VU Meter Test")
        self.setStyleSheet("background-color: #1a1a1a;")
        
        # Main widget
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        
        # Layout
        layout = QVBoxLayout()
        main_widget.setLayout(layout)
        
        # VU Meter
        self.vu_meter = VUMeterWidget()
        self.vu_meter.setMinimumHeight(60)
        self.vu_meter.setMaximumHeight(80)
        layout.addWidget(self.vu_meter)
        
        # Control buttons
        button_layout = QHBoxLayout()
        
        # Test pattern button
        self.test_btn = QPushButton("Start Test Pattern")
        self.test_btn.clicked.connect(self.toggle_test)
        button_layout.addWidget(self.test_btn)
        
        # Reset button
        reset_btn = QPushButton("Reset")
        reset_btn.clicked.connect(self.vu_meter.reset)
        button_layout.addWidget(reset_btn)
        
        # Random levels button
        random_btn = QPushButton("Random Levels")
        random_btn.clicked.connect(self.set_random_levels)
        button_layout.addWidget(random_btn)
        
        layout.addLayout(button_layout)
        
        # Timer for test pattern
        self.test_timer = QTimer()
        self.test_timer.timeout.connect(self.update_test_pattern)
        self.test_running = False
        self.test_phase = 0
        
        self.resize(600, 200)
    
    def toggle_test(self):
        if self.test_running:
            self.test_timer.stop()
            self.test_running = False
            self.test_btn.setText("Start Test Pattern")
            self.vu_meter.reset()
        else:
            self.test_timer.start(50)  # 20 FPS
            self.test_running = True
            self.test_btn.setText("Stop Test Pattern")
    
    def update_test_pattern(self):
        """Generate sinusoidal test pattern"""
        self.test_phase += 0.1
        
        # Generate levels in dB
        left_db = -20 + 15 * math.sin(self.test_phase)
        right_db = -20 + 15 * math.sin(self.test_phase + math.pi / 4)
        
        # Add some random spikes
        if random.random() > 0.95:
            left_db = random.uniform(-6, 0)
        if random.random() > 0.95:
            right_db = random.uniform(-6, 0)
        
        # Update VU meter
        self.vu_meter.update_db_levels(left_db, right_db)
    
    def set_random_levels(self):
        """Set random dB levels"""
        left_db = random.uniform(-40, 3)
        right_db = random.uniform(-40, 3)
        self.vu_meter.update_db_levels(left_db, right_db)


def main():
    app = QApplication(sys.argv)
    window = TestWindow()
    window.show()
    
    # Set initial levels
    window.vu_meter.update_db_levels(-10, -12)
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()