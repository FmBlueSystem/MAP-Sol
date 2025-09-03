"""
VU Meter widget for real-time audio level visualization.
"""

from PyQt6.QtWidgets import QWidget, QSizePolicy
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QPainter, QBrush, QPen, QLinearGradient, QColor, QFont
import math


class VUMeterWidget(QWidget):
    """Visual VU meter widget showing L/R audio levels."""
    
    def __init__(self, parent=None):
        """Initialize the VU meter widget."""
        super().__init__(parent)
        
        # Configuration (dBFS scale)
        self.min_db = -40.0
        self.max_db = 3.0
        
        # Current levels in dBFS (clamped to [min_db, max_db])
        self.left_db = self.min_db
        self.right_db = self.min_db
        
        # Peak hold values
        self.left_peak_db = self.min_db
        self.right_peak_db = self.min_db
        
        # Smoothed normalized (0..1) for visual bar rendering
        self.left_smooth = 0.0
        self.right_smooth = 0.0
        
        # Widget configuration (extra height to fit dB scale labels)
        self.setMinimumHeight(50)
        self.setMaximumHeight(70)
        self.setMinimumWidth(200)
        # Ensure layouts respect our vertical size (avoid clipping R channel)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        
        # Decay timer for smooth falloff
        self.decay_timer = QTimer()
        self.decay_timer.timeout.connect(self._decay_levels)
        self.decay_timer.start(50)  # 20 FPS update rate
        
        # Peak hold timer (decay of peak indicators)
        self.peak_timer = QTimer()
        self.peak_timer.timeout.connect(self._decay_peaks)
        self.peak_timer.start(1500)  # Hold peaks for 1.5 seconds

    # DPI utilities
    def _dpi_scale(self) -> float:
        """Return a UI scale factor based on logical DPI (96 DPI = 1.0)."""
        try:
            # Prefer screen DPI
            win = self.window()
            if win and hasattr(win, 'windowHandle') and win.windowHandle():
                scr = win.windowHandle().screen()
                if scr:
                    dpi = float(getattr(scr, 'logicalDotsPerInch', lambda: 96.0)())
                    return max(0.75, min(2.0, dpi / 96.0))
        except Exception:
            pass
        try:
            # QWidget inherits QPaintDevice (logicalDpiY may exist)
            dpi = float(self.logicalDpiY())
            return max(0.75, min(2.0, dpi / 96.0))
        except Exception:
            return 1.0
    
    def update_levels(self, left: float, right: float):
        """
        Update audio levels.
        
        Args:
            left: Left channel level (0.0 to 1.0)
            right: Right channel level (0.0 to 1.0)
        """
        # Backwards compatibility: allow linear [0..1] input and convert to dBFS
        left = max(0.0, min(1.0, float(left)))
        right = max(0.0, min(1.0, float(right)))
        left_db = 20.0 * math.log10(left) if left > 0.0 else self.min_db
        right_db = 20.0 * math.log10(right) if right > 0.0 else self.min_db
        self.update_db_levels(left_db, right_db)

    def update_db_levels(self, left_db: float, right_db: float):
        """Update audio levels in dBFS.

        Args:
            left_db: Left channel in dBFS
            right_db: Right channel in dBFS
        """
        # Clamp to configured range
        self.left_db = max(self.min_db, min(self.max_db, float(left_db)))
        self.right_db = max(self.min_db, min(self.max_db, float(right_db)))
        
        # Update peak holds in dB
        if self.left_db > self.left_peak_db:
            self.left_peak_db = self.left_db
        if self.right_db > self.right_peak_db:
            self.right_peak_db = self.right_db
        
        # Force repaint
        self.update()
    
    def _decay_levels(self):
        """Smooth decay of levels for visual appeal."""
        decay_rate = 0.85  # Smooth falloff
        attack_rate = 0.5  # Fast attack
        
        def _db_to_norm(db_val: float) -> float:
            # Map dB in [min_db, max_db] to [0..1]
            return (db_val - self.min_db) / (self.max_db - self.min_db)

        # Compute instantaneous normalized levels from current dB
        left_norm_target = _db_to_norm(self.left_db)
        right_norm_target = _db_to_norm(self.right_db)

        # Smooth left channel
        if left_norm_target > self.left_smooth:
            # Fast attack
            self.left_smooth += (left_norm_target - self.left_smooth) * attack_rate
        else:
            # Smooth decay
            self.left_smooth *= decay_rate
        
        # Smooth right channel
        if right_norm_target > self.right_smooth:
            # Fast attack
            self.right_smooth += (right_norm_target - self.right_smooth) * attack_rate
        else:
            # Smooth decay
            self.right_smooth *= decay_rate
        
        # Clamp to minimum threshold
        if self.left_smooth < 0.001:
            self.left_smooth = 0.0
        if self.right_smooth < 0.001:
            self.right_smooth = 0.0
        
        self.update()
    
    def _decay_peaks(self):
        """Decay peak hold values."""
        # Simple linear decay in dB domain towards min_db
        self.left_peak_db = max(self.min_db, self.left_peak_db - 1.0)
        self.right_peak_db = max(self.min_db, self.right_peak_db - 1.0)
    
    def paintEvent(self, event):
        """Paint the VU meter."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Get widget dimensions
        width = self.width()
        height = self.height()
        
        # Background
        painter.fillRect(0, 0, width, height, QColor(30, 30, 30))
        
        # Single-bar layout (mono view): use max of L/R for readability
        top_margin = 2
        bottom_margin = 2
        scale = self._dpi_scale()
        label_band = max(4, int(6 * scale))  # small padding if needed
        bar_height = max(14, height - (top_margin + bottom_margin + label_band))
        bar_y = top_margin
        
        # Compute mono normalized level from smoothed L/R
        mono_norm = max(self.left_smooth, self.right_smooth)
        mono_peak_db = max(self.left_peak_db, self.right_peak_db)
        
        # Draw single combined bar with scale
        self._draw_channel(painter, 2, bar_y, width - 4, bar_height,
                           mono_norm, mono_peak_db, "M")
    
    def _draw_channel(self, painter, x, y, width, height, level_norm, peak_db, label):
        """Draw a single channel bar."""
        # Background track
        painter.fillRect(x, y, width, height, QColor(50, 50, 50))
        # Border for clarity
        painter.setPen(QPen(QColor(70, 70, 70)))
        painter.drawRect(x, y, width, height)
        
        # Calculate filled width
        filled_width = int(width * max(0.0, min(1.0, level_norm)))
        
        if filled_width > 0:
            # Draw the level bar with segmented colors based on dB ranges
            # Instead of gradient, use solid colors for each section
            
            # Helper to map dB to pixel position
            def db_to_x(db):
                norm = max(0.0, min(1.0, (db - self.min_db) / (self.max_db - self.min_db)))
                return int(x + width * norm)
            
            # Current level in dB
            current_db = self.min_db + level_norm * (self.max_db - self.min_db)
            
            # Draw green section (-40 to -6 dB)
            if current_db > self.min_db:
                green_end = min(db_to_x(-6.0), x + filled_width)
                if green_end > x:
                    painter.fillRect(x, y, green_end - x, height, QColor(0, 200, 0))
            
            # Draw yellow/orange section (-6 to -3 dB)
            if current_db > -6.0:
                yellow_start = db_to_x(-6.0)
                yellow_end = min(db_to_x(-3.0), x + filled_width)
                if yellow_end > yellow_start:
                    painter.fillRect(yellow_start, y, yellow_end - yellow_start, height, QColor(255, 160, 0))
            
            # Draw red section (-3 to +3 dB)
            if current_db > -3.0:
                red_start = db_to_x(-3.0)
                red_end = x + filled_width
                if red_end > red_start:
                    painter.fillRect(red_start, y, red_end - red_start, height, QColor(255, 60, 60))
        
        # Draw peak indicator
        if peak_db > self.min_db:
            peak_norm = (peak_db - self.min_db) / (self.max_db - self.min_db)
            peak_x = int(x + width * max(0.0, min(1.0, peak_norm)))
            painter.setPen(QPen(QColor(255, 255, 255), 2))
            painter.drawLine(peak_x, y, peak_x, y + height)
        
        # Draw channel label
        painter.setPen(QPen(QColor(150, 150, 150)))
        painter.drawText(x + 2, y + height - 2, label)
        
        # Draw dB scale marks (-40 .. +3 dB) (for mono view or left channel)
        if label in ('L', 'M'):
            marks = [-20, -10, -6, -3, 0, 3]
            for m in marks:
                norm = (m - self.min_db) / (self.max_db - self.min_db)
                norm = max(0.0, min(1.0, norm))
                mark_x = x + int(width * norm)
                painter.setPen(QPen(QColor(100, 100, 100)))
                if m >= 0:
                    painter.setPen(QPen(QColor(255, 120, 120)))
                painter.drawLine(mark_x, y - 3, mark_x, y + 3)
                # Draw text labels above the bar
                if m in (-20, -10, -6, -3, 0, 3):
                    painter.setPen(QPen(QColor(200, 200, 200)))
                    old_font = painter.font()
                    font = QFont(old_font)
                    font.setPixelSize(max(7, min(12, int(8 * self._dpi_scale()))))
                    painter.setFont(font)
                    # Draw label inside the top bar, near the bottom edge
                    painter.drawText(mark_x - 10, y + height - 4, f"{m}")
                    painter.setFont(old_font)
    
    def reset(self):
        """Reset all levels to zero."""
        self.left_db = self.min_db
        self.right_db = self.min_db
        self.left_peak_db = self.min_db
        self.right_peak_db = self.min_db
        self.left_smooth = 0.0
        self.right_smooth = 0.0
        self.update()
