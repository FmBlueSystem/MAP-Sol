#!/usr/bin/env python3
"""
Music Analyzer Pro - Qt Edition
Main application entry point
"""

import sys
import os
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QSplashScreen
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QPixmap, QPainter, QLinearGradient, QColor, QFont
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from app import MusicAnalyzerApp
from utils.logger import setup_logger
from utils.paths import is_ci_environment

# Load environment variables (optional)
try:
    load_dotenv()
except:
    pass  # dotenv is optional

logger = setup_logger(__name__)


class SplashScreen(QSplashScreen):
    """Custom splash screen with gradient background"""
    
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint)
        
        # Create splash pixmap
        pixmap = QPixmap(600, 400)
        pixmap.fill(Qt.GlobalColor.transparent)
        
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Draw gradient background
        gradient = QLinearGradient(0, 0, 600, 400)
        gradient.setColorAt(0, QColor("#030712"))
        gradient.setColorAt(1, QColor("#1a1a2e"))
        painter.fillRect(pixmap.rect(), gradient)
        
        # Draw logo
        logo_rect = pixmap.rect().adjusted(0, -50, 0, -50)
        painter.setPen(QColor("#00d4aa"))
        font = QFont("Arial", 48, QFont.Weight.Bold)
        painter.setFont(font)
        painter.drawText(logo_rect, Qt.AlignmentFlag.AlignCenter, "MP")
        
        # Draw title
        title_rect = pixmap.rect().adjusted(0, 50, 0, 50)
        painter.setPen(QColor("#ffffff"))
        font = QFont("Arial", 24, QFont.Weight.Light)
        painter.setFont(font)
        painter.drawText(title_rect, Qt.AlignmentFlag.AlignCenter, "MUSIC PRO")
        
        # Draw subtitle
        subtitle_rect = pixmap.rect().adjusted(0, 100, 0, 100)
        painter.setPen(QColor("#00d4aa"))
        font = QFont("Arial", 12)
        painter.setFont(font)
        painter.drawText(subtitle_rect, Qt.AlignmentFlag.AlignCenter, "QT EDITION")
        
        painter.end()
        
        self.setPixmap(pixmap)
        self.show()


def main():
    """Main application entry point"""
    
    # Check if running in CI environment
    if is_ci_environment():
        logger.info("Running in CI environment - skipping GUI initialization")
        # In CI, just verify imports work
        print("CI Mode: Basic import check passed")
        return 0
    
    # Configure Qt application
    QApplication.setApplicationName("Music Pro")
    QApplication.setOrganizationName("MusicPro")
    QApplication.setOrganizationDomain("bluesystemio.com")
    
    # Create application
    app = QApplication(sys.argv)
    app.setStyle("Fusion")  # Modern style
    
    # Show splash screen
    splash = SplashScreen()
    
    # Create main application
    logger.info("Starting Music Pro...")
    main_app = MusicAnalyzerApp()
    
    # Close splash and show main window
    QTimer.singleShot(2000, lambda: (
        splash.close(),
        main_app.show()
    ))
    
    # Run application
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
