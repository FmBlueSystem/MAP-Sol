# Music Player Qt - Tidal Style

A modern music player application built with PyQt6, featuring a Tidal-inspired interface with audio metadata extraction and album artwork display.

## Features

- 🎵 **Audio Format Support**: MP3, WAV, FLAC, M4A, OGG, AAC, WMA, OPUS
- 🖼️ **Album Artwork Extraction**: Automatically extracts and displays embedded album art
- 🎨 **Modern UI**: Tidal-style dark theme with smooth animations
- 📚 **Music Library**: Organize and browse your music collection
- 🏷️ **Metadata Extraction**: Reads artist, title, and album information from files
- 🎯 **Drag & Drop**: Support for drag and drop audio files
- 💾 **Database Support**: SQLite database for library management

## Screenshots

### Main Interface
- Sidebar navigation with search
- Grid view for albums/tracks
- Bottom player bar with controls
- Modern dark theme inspired by Tidal

## Installation

### Prerequisites
- Python 3.8+
- macOS, Windows, or Linux

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/music-app-qt.git
cd music-app-qt
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

Run the application:
```bash
python src/tidal_app.py
```

### Adding Music
1. Click the "+ Add Files" button in the header
2. Select audio files from your computer
3. Files will appear in "My Library" with extracted artwork

### Features in Development
- ▶️ Audio playback functionality
- 📊 Waveform visualization
- 🎚️ Equalizer
- 📝 Playlist management
- 🔍 Advanced search and filtering

## Project Structure

```
music-app-qt/
├── src/
│   ├── tidal_app.py         # Main application (Tidal-style UI)
│   ├── app.py               # Alternative analyzer UI
│   ├── database.py          # SQLite database handler
│   ├── metadata_extractor.py # Audio metadata extraction
│   └── utils/
│       └── logger.py        # Logging configuration
├── resources/               # Icons, fonts, images
├── tests/                  # Unit tests
├── requirements.txt        # Python dependencies
├── AUDIO_FLOW.md          # Audio flow documentation
└── README.md              # This file
```

## Dependencies

- **PyQt6**: GUI framework
- **mutagen**: Audio metadata extraction
- **numpy**: Numerical computing
- **pyqtgraph**: Scientific graphics and visualization
- **sqlite3**: Database management (built-in)

## Audio Flow

The application follows a structured audio processing pipeline:

1. **File Import** → Validation → Metadata Extraction → Library Addition
2. **Metadata Processing** → Artist/Title/Album extraction → Artwork extraction
3. **Display** → Album cards with artwork → Library organization

See [AUDIO_FLOW.md](AUDIO_FLOW.md) for detailed documentation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- UI design inspired by Tidal
- Built with PyQt6 framework
- Uses mutagen for metadata extraction

## Author

Music App Development Team

---

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>