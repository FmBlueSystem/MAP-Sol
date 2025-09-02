# Music Pro - Qt Edition

A modern music application built with PyQt6, featuring a professional dark theme, MixedInKey‑aware import, HAMMS v3.0 compatibility analysis, and fast batch tools.

## Features

- 🎵 **Audio Format Support**: MP3, WAV, FLAC, M4A, OGG, AAC, WMA, OPUS
- 🖼️ **Album Artwork Extraction**: Automatically extracts and displays embedded album art
- 🎨 **Modern UI**: Tidal-style dark theme with smooth animations
- 📚 **Music Library**: Organize and browse your music collection
- 🏷️ **MixedInKey First**: Uses BPM/Key/Energy from MixedInKey if present; AI fallback
- ✨ **Next Compatible**: One‑click HAMMS‑based next track selection (button in player bar)
- 🔍 **Analyze Missing**: Batch analysis to fill BPM/Key/HAMMS with progress
- 🧩 **HAMMS Badges**: Cards show BPM • Key • Energy when available
- ⏳ **Import UX**: Progress + deduplication (Added/Skipped) when importing
- 💾 **Database Support**: SQLite library with safe upsert + artwork BLOBs

## Screenshots

Place screenshots under `resources/screenshots/` and they will be referenced here:

- Main UI (library + player bar): `resources/screenshots/main_ui.png`
- Next Compatible (toast + badges): `resources/screenshots/next_compatible.png`
- Analyze Missing (progress): `resources/screenshots/analyze_missing.png`

Example (paths are clickable in many viewers):

![Main UI](resources/screenshots/main_ui.png)
![Next Compatible](resources/screenshots/next_compatible.png)
![Analyze Missing](resources/screenshots/analyze_missing.png)

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
python src/music_player.py
```

### Configuration (config.yaml)
- The app reads configuration from `config.yaml` (in project root or `~/.music_player_qt/config.yaml`).
- Defaults live in code; see `config.example.yaml` for a template to copy.

Keys you can tune without touching code:
- `analysis.max_concurrent`: how many analysis workers run in parallel (default: 2)
- `database.busy_timeout_ms`: SQLite busy timeout for the single-writer thread (default: 3000)
- `ui.grid_page_size`: number of cards loaded per lazy-load batch (default: 40)
- `ui.toasts_enabled`: show/hide on-screen toasts (default: true)
- `ui.toast_timeout_ms`: toast visibility duration (default: 2500)

Environment variable overrides:
- `ANALYSIS_MAX_CONCURRENT`, `DB_BUSY_TIMEOUT_MS`, `UI_GRID_PAGE_SIZE`, `UI_TOASTS_ENABLED`, `UI_TOAST_TIMEOUT_MS`

### Adding Music
1. Click the "+ Add Files" button in the header
2. Select audio files from your computer
3. Files will appear in "My Library" with extracted artwork and badges (BPM • Key • Energy)

### Next Compatible (HAMMS)
- Use the ✨ button next to Next to jump to the most compatible track (BPM/Key/Energy). Falls back to sequential if insufficient data.

### Analyze Missing
- Click "Analyze Missing" to fill BPM/Key/HAMMS for tracks lacking data. Runs in background with progress.

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
│   ├── music_player.py      # Main application with modern UI
│   ├── app.py               # Alternative analyzer UI
│   ├── database.py          # SQLite database handler
│   ├── metadata_extractor.py # Audio metadata extraction
│   └── utils/
│       ├── logger.py        # Logging configuration
│       ├── config.py        # YAML config loader (config.yaml)
│       └── db_writer.py     # Single-writer DB worker (serialized writes)
├── resources/               # Icons, fonts, images
├── tests/                  # Unit tests
├── requirements.txt        # Python dependencies
├── AUDIO_FLOW.md          # Audio flow documentation
└── README.md              # This file
```

## Dependencies

- PyQt6, PyQt6-Qt6, PyQt6-sip
- numpy, scipy, librosa, soundfile
- mutagen, Pillow, pyqtgraph
- sqlite3 (built‑in)

## Audio Flow

The application follows a structured audio processing pipeline:

1. **File Import** → Validation → Metadata Extraction → Library Addition
2. **Metadata Processing** → Artist/Title/Album extraction → Artwork extraction
3. **Display** → Album cards with artwork → Library organization

See [AUDIO_FLOW.md](AUDIO_FLOW.md) for detailed documentation.

### Performance & Reliability
- Single-writer DB thread serializes writes to avoid `SQLITE_BUSY` under load.
- Priority analysis queue keeps the UI responsive (user actions first; batch later).
- Lazy loading grid prevents UI stalls with large libraries.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Modern dark theme UI design
- Built with PyQt6 framework
- Uses mutagen for metadata extraction

## Author

Music App Development Team

---

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
