"""
Quick Start dialog for Music Analyzer Pro.
Provides embedded help documentation without leaving the app.
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QPushButton,
    QTextBrowser, QDialogButtonBox
)
from PyQt6.QtCore import Qt, QUrl
from PyQt6.QtGui import QDesktopServices
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.paths import resource_path


class QuickStartDialog(QDialog):
    """Quick Start guide dialog with HTML content."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Quick Start")
        self.setModal(True)
        self.resize(800, 600)
        
        self._setup_ui()
        self._load_content()
    
    def _setup_ui(self):
        """Setup the dialog UI."""
        layout = QVBoxLayout(self)
        
        # Text browser for HTML content
        self.text_browser = QTextBrowser()
        self.text_browser.setOpenExternalLinks(True)
        layout.addWidget(self.text_browser)
        
        # Button box
        button_layout = QHBoxLayout()
        
        # Open Documentation button
        self.doc_button = QPushButton("Open Documentation")
        self.doc_button.clicked.connect(self._open_documentation)
        button_layout.addWidget(self.doc_button)
        
        button_layout.addStretch()
        
        # Close button
        self.close_button = QPushButton("Close")
        self.close_button.clicked.connect(self.accept)
        self.close_button.setDefault(True)
        button_layout.addWidget(self.close_button)
        
        layout.addLayout(button_layout)
    
    def _load_content(self):
        """Load Quick Start content from file or use default."""
        # Try to load from resources
        html_file = resource_path('resources', 'quick_start.html')
        
        if html_file.exists():
            try:
                with open(html_file, 'r', encoding='utf-8') as f:
                    html_content = f.read()
            except Exception:
                html_content = self._get_content_html()
        else:
            html_content = self._get_content_html()
        
        self.text_browser.setHtml(html_content)
    
    def _get_content_html(self):
        """Get default HTML content for Quick Start guide."""
        return """
<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
h2 { color: #1e40af; margin-top: 25px; }
h3 { color: #374151; margin-top: 20px; }
ul { line-height: 1.8; }
li { margin: 5px 0; }
code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
.section { margin-bottom: 30px; }
.highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
</style>
</head>
<body>

<h1>🎵 Music Analyzer Pro - Quick Start Guide</h1>

<div class="section">
<h2>Requisitos</h2>
<ul>
<li><b>Python 3.11+</b> con PyQt6</li>
<li><b>Archivos de audio</b>: MP3, M4A, FLAC, WAV</li>
<li><b>Espacio en disco</b>: ~500MB para biblioteca típica</li>
<li><b>RAM recomendada</b>: 4GB+ para análisis fluido</li>
</ul>
</div>

<div class="section">
<h2>Primeros pasos</h2>
<ol>
<li><b>Importar música</b>: Click en "Import Library" o arrastra archivos</li>
<li><b>Esperar análisis</b>: El sistema detecta BPM, tonalidad y energía</li>
<li><b>Explorar biblioteca</b>: Usa la tabla principal para navegar</li>
<li><b>Reproducir</b>: Doble click en cualquier track</li>
</ol>
</div>

<div class="section">
<h2>Análisis IA y Loudness</h2>
<ul>
<li><b>BPM Detection</b>: Automático con librosa/aubio</li>
<li><b>Key Detection</b>: Camelot Wheel compatible (1A-12B)</li>
<li><b>Energy Level</b>: Escala 1-10 basada en características espectrales</li>
<li><b>LUFS/Peak</b>: Medición profesional de loudness</li>
<li><b>Waveform</b>: Visualización en tiempo real durante reproducción</li>
</ul>
</div>

<div class="section">
<h2>Generación y Exportación de Playlists</h2>
<h3>Crear Playlist Harmónica</h3>
<ol>
<li>Menú <code>Playlists → Generate Playlist</code></li>
<li>Selecciona modo: Energy Flow, Harmonic, Genre-based</li>
<li>Ajusta duración y parámetros</li>
<li>Click "Generate" para crear</li>
</ol>

<h3>Exportar Playlists</h3>
<ul>
<li><b>CSV</b>: Para importar en otros DJ software</li>
<li><b>JSON</b>: Formato estructurado con metadata completa</li>
<li><b>Share Link</b>: URL base64 para compartir (máx 100KB)</li>
</ul>
</div>

<div class="section">
<h2>Búsqueda Avanzada</h2>
<p>Usa la barra de búsqueda con operadores:</p>
<ul>
<li><code>bpm:120-130</code> - Rango de BPM</li>
<li><code>key:5A</code> - Tonalidad específica</li>
<li><code>energy:>7</code> - Nivel de energía mínimo</li>
<li><code>genre:techno</code> - Filtro por género</li>
<li>Combina: <code>bpm:128 energy:>8 key:2A</code></li>
</ul>
</div>

<div class="section">
<h2>Mix Suggestions y Clusters</h2>
<ul>
<li><b>Harmonic Mixing</b>: Sugerencias basadas en Camelot Wheel</li>
<li><b>Energy Matching</b>: Transiciones suaves por niveles de energía</li>
<li><b>Auto-clusters</b>: Agrupación automática por características similares</li>
<li><b>Transition Score</b>: Puntuación 0-100 para calidad de mezcla</li>
</ul>
</div>

<div class="section">
<h2>Atajos de Teclado</h2>
<table style="width:100%; margin-top:10px;">
<tr><td><code>Space</code></td><td>Play/Pause</td></tr>
<tr><td><code>Ctrl+O</code></td><td>Abrir archivo</td></tr>
<tr><td><code>Ctrl+I</code></td><td>Importar biblioteca</td></tr>
<tr><td><code>Ctrl+F</code></td><td>Buscar</td></tr>
<tr><td><code>Ctrl+P</code></td><td>Generar playlist</td></tr>
<tr><td><code>Ctrl+E</code></td><td>Exportar</td></tr>
<tr><td><code>F11</code></td><td>Pantalla completa</td></tr>
</table>
</div>

<div class="section">
<h2>Telemetría (opt-in)</h2>
<div class="highlight">
<p><b>Privacidad primero:</b> La telemetría está <b>deshabilitada por defecto</b>.</p>
<p>Si la activas en Preferencias → Privacy:</p>
<ul>
<li>Solo se guardan eventos localmente (JSONL)</li>
<li>Sin envío a servidores externos</li>
<li>Puedes exportar/eliminar datos en cualquier momento</li>
</ul>
</div>
</div>

<div class="section">
<h2>Links a Documentación</h2>
<ul>
<li><a href="https://github.com/yourusername/music-analyzer-pro">GitHub Repository</a></li>
<li><a href="https://github.com/yourusername/music-analyzer-pro/wiki">Wiki & Tutorials</a></li>
<li><a href="https://github.com/yourusername/music-analyzer-pro/issues">Report Issues</a></li>
<li><a href="https://camelotwheel.com">Camelot Wheel Reference</a></li>
</ul>
</div>

<div class="section" style="margin-top:40px; padding-top:20px; border-top:1px solid #e5e7eb;">
<p style="text-align:center; color:#6b7280;">
Music Analyzer Pro v1.0.0 - Professional DJ Analysis Tool<br>
© 2024 - Built with PyQt6 and AI-powered analysis
</p>
</div>

</body>
</html>
"""
    
    def _open_documentation(self):
        """Open external documentation."""
        # Try to open README in repo
        readme_path = Path(__file__).parent.parent.parent / 'README.md'
        
        if readme_path.exists():
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(readme_path)))
        else:
            # Fallback to GitHub URL
            url = QUrl("https://github.com/yourusername/music-analyzer-pro/blob/main/README.md")
            QDesktopServices.openUrl(url)