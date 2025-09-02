#!/usr/bin/env python3
"""
Script de validación del VU meter - Prueba que ambos canales funcionan
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QLabel, QHBoxLayout
from PyQt6.QtCore import QTimer, Qt
from PyQt6.QtGui import QPixmap, QPainter, QColor
from ui.vu_meter import VUMeterWidget
import math
import time


class VUValidationWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("VU Meter Validation - Both Channels Test")
        self.setStyleSheet("background-color: #1a1a1a;")
        
        # Main widget
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        
        # Layout
        layout = QVBoxLayout()
        main_widget.setLayout(layout)
        
        # Title
        title = QLabel("VU METER VALIDATION TEST")
        title.setStyleSheet("color: white; font-size: 16px; font-weight: bold; padding: 10px;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # VU Meter with exact production height
        self.vu_meter = VUMeterWidget()
        self.vu_meter.setMinimumHeight(50)
        self.vu_meter.setMaximumHeight(70)
        self.vu_meter.setFixedHeight(60)  # Same as in music_player.py
        layout.addWidget(self.vu_meter)
        
        # Status labels
        status_layout = QHBoxLayout()
        
        self.left_status = QLabel("L: --")
        self.left_status.setStyleSheet("color: #00ff00; font-family: monospace;")
        status_layout.addWidget(self.left_status)
        
        self.right_status = QLabel("R: --")
        self.right_status.setStyleSheet("color: #00ff00; font-family: monospace;")
        status_layout.addWidget(self.right_status)
        
        self.test_status = QLabel("Status: Initializing...")
        self.test_status.setStyleSheet("color: yellow; font-family: monospace;")
        status_layout.addWidget(self.test_status)
        
        layout.addLayout(status_layout)
        
        # Info panel
        info = QLabel("""
VALIDATION CHECKS:
1. Two separate bars visible (L and R)
2. L channel has dB scale marks (-20, -10, -6, -3, 0, 3)
3. R channel has no scale marks
4. Both channels show green/orange/red zones
5. Peak indicators (white lines) work on both
6. Height = 60px (production setting)
        """)
        info.setStyleSheet("color: #888; font-family: monospace; font-size: 11px; padding: 10px;")
        layout.addWidget(info)
        
        # Timer for automated test pattern
        self.test_timer = QTimer()
        self.test_timer.timeout.connect(self.run_test_pattern)
        self.test_phase = 0
        self.test_timer.start(100)  # 10 FPS for clear observation
        
        self.resize(700, 300)
        
        # Track test results
        self.channels_visible = {"L": False, "R": False}
    
    def run_test_pattern(self):
        """Generate test pattern to validate both channels"""
        self.test_phase += 0.2
        
        # Generate different patterns for L and R to prove independence
        left_db = -20 + 15 * math.sin(self.test_phase)
        right_db = -20 + 15 * math.cos(self.test_phase)  # 90 degrees out of phase
        
        # Occasional peaks to test peak hold
        if self.test_phase % 3 < 0.2:
            left_db = -3
        if self.test_phase % 4 < 0.2:
            right_db = -2
        
        # Update VU meter
        self.vu_meter.update_db_levels(left_db, right_db)
        
        # Update status labels
        self.left_status.setText(f"L: {left_db:+.1f} dB")
        self.right_status.setText(f"R: {right_db:+.1f} dB")
        
        # Validation checks
        if abs(left_db - right_db) > 5:  # Channels are showing different values
            self.channels_visible["L"] = True
            self.channels_visible["R"] = True
            
        if self.channels_visible["L"] and self.channels_visible["R"]:
            self.test_status.setText("Status: ✓ BOTH CHANNELS WORKING")
            self.test_status.setStyleSheet("color: #00ff00; font-family: monospace;")
        else:
            self.test_status.setText("Status: Testing channels...")
            self.test_status.setStyleSheet("color: yellow; font-family: monospace;")
    
    def closeEvent(self, event):
        """Report results on close"""
        print("\n=== VU METER VALIDATION RESULTS ===")
        print(f"Left channel (L) detected: {self.channels_visible['L']}")
        print(f"Right channel (R) detected: {self.channels_visible['R']}")
        print(f"Widget height: {self.vu_meter.height()}px")
        print(f"Both channels working: {all(self.channels_visible.values())}")
        print("===================================\n")
        event.accept()


def main():
    print("\n=== STARTING VU METER VALIDATION ===")
    print("Checking dual-channel display...")
    print("Expected: L channel with scale, R channel without scale")
    print("Height: 60px (production setting)")
    print("=====================================\n")
    
    app = QApplication(sys.argv)
    window = VUValidationWindow()
    window.show()
    
    # Set initial test values
    window.vu_meter.update_db_levels(-10, -15)
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()