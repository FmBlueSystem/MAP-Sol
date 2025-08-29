# Audio Flow Documentation - Music Player Qt

## Overview
This document describes the audio processing and playback flow in the Music Player Pro application built with PyQt6.

## Architecture Components

### 1. Audio File Import Flow
```
User Action → File Dialog → File Validation → Library Addition → UI Update
```

#### 1.1 File Import Process
- **Trigger**: User clicks "+ Add Files" button
- **File Selection**: QFileDialog opens with audio format filters
- **Supported Formats**: 
  - MP3 (MPEG Audio Layer III)
  - WAV (Waveform Audio File Format)
  - FLAC (Free Lossless Audio Codec)
  - M4A (MPEG-4 Audio)
  - OGG (Ogg Vorbis)
  - AAC (Advanced Audio Coding)
  - WMA (Windows Media Audio)
  - OPUS (Opus Audio Codec)

#### 1.2 File Processing
```python
add_audio_files() → validate_formats() → extract_metadata() → add_to_library()
```

### 2. Audio Playback Pipeline

#### 2.1 Core Components
- **QMediaPlayer**: Primary audio playback engine
- **QAudioOutput**: Audio output device handler
- **QUrl**: File path to URL conversion for media player

#### 2.2 Playback Flow
```
File Selection → Media Loading → Buffer Management → Audio Output
     ↓              ↓                    ↓                ↓
AlbumCard Click → setSource() → QMediaPlayer Buffer → QAudioOutput
```

### 3. Audio Control System

#### 3.1 Player Controls
- **Play/Pause**: Toggle playback state
- **Stop**: Reset playback position
- **Previous/Next**: Navigate playlist
- **Seek**: Position control via slider
- **Volume**: Audio level adjustment (0-100%)

#### 3.2 Control Signal Flow
```
User Input → Qt Signal → Handler Method → Media Player Action
    ↓            ↓              ↓                 ↓
Button Click → pyqtSignal → Slot Method → QMediaPlayer API
```

### 4. Metadata Extraction

#### 4.1 Basic Metadata Parser
- **Current Implementation**: Filename-based extraction
- **Pattern Recognition**: "Artist - Title" format
- **Default Values**: "Unknown Artist" for unrecognized patterns

#### 4.2 Future Enhancement Path
```
File → Mutagen Library → ID3/Vorbis Tags → Metadata Object
         ↓                    ↓                  ↓
    Audio File → Tag Parser → Extract Info → Display Data
```

### 5. UI Update Flow

#### 5.1 Library Display Update
```
File Added → Create AlbumCard → Add to Grid → Update Layout
     ↓            ↓                ↓              ↓
New Audio → Card Widget → Library Section → Qt Layout Refresh
```

#### 5.2 Player Bar Update
```
Track Selected → Load Media → Update Display → Start Playback
       ↓             ↓              ↓               ↓
   Click Event → Set Source → Update Labels → Play Audio
```

### 6. State Management

#### 6.1 Application States
- **Library State**: List of loaded audio files
- **Playback State**: Current track, position, volume
- **UI State**: Selected items, active sections

#### 6.2 State Synchronization
```
State Change → Signal Emission → Connected Slots → UI Updates
      ↓              ↓                 ↓              ↓
Media Event → Qt Signal System → Handler Methods → Widget Updates
```

## Audio Processing Features

### Current Implementation
1. **File Import**: Multi-file selection with format validation
2. **Library Management**: Visual card-based library display
3. **Basic Playback**: Play/pause/stop functionality (placeholder)
4. **Volume Control**: Slider-based volume adjustment
5. **Progress Tracking**: Seek bar with time display

### Planned Enhancements
1. **Waveform Visualization**: Real-time audio waveform display
2. **Spectrum Analyzer**: FFT-based frequency visualization
3. **Gapless Playback**: Seamless track transitions
4. **Crossfading**: Smooth transitions between tracks
5. **Equalizer**: Multi-band frequency adjustment
6. **Audio Effects**: Reverb, echo, pitch adjustment

## Technical Specifications

### Audio Backend
- **Framework**: PyQt6.QtMultimedia
- **Player Engine**: QMediaPlayer (Qt6)
- **Output System**: QAudioOutput
- **Codec Support**: System-dependent (via Qt multimedia backend)

### Performance Considerations
- **Buffer Size**: Default Qt buffer management
- **Latency**: ~50-100ms typical system latency
- **Sample Rate**: Automatic detection from source file
- **Bit Depth**: Maintained from source file

## Error Handling

### File Import Errors
- Unsupported format → Show error dialog
- Corrupted file → Skip and notify user
- Access denied → Request permissions

### Playback Errors
- Codec missing → Suggest codec installation
- Device unavailable → Fallback to default device
- Buffer underrun → Automatic recovery

## API Reference

### Key Classes
```python
class MusicPlayerWindow(QMainWindow):
    - add_audio_files()      # Import audio files
    - add_file_to_library()  # Add single file to library
    - play_file()           # Initialize playback

class AlbumCard(QFrame):
    - clicked signal        # Emitted on selection
    - play_clicked signal   # Emitted on play button

class PlayerBar(QWidget):
    - play_clicked signal   # Play button pressed
    - pause_clicked signal  # Pause button pressed
    - volume_changed signal # Volume slider moved
```

## Testing Considerations

### Unit Tests
- File format validation
- Metadata extraction accuracy
- Signal/slot connections
- State management integrity

### Integration Tests
- End-to-end file import flow
- Playback initialization and control
- UI responsiveness during playback
- Memory management during long sessions

## Future Architecture

### Proposed Audio Engine Enhancement
```
┌─────────────────┐
│   File Input    │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Audio Decoder  │ ← FFmpeg/GStreamer
└────────┬────────┘
         ↓
┌─────────────────┐
│  Audio Buffer   │ ← Ring Buffer Implementation
└────────┬────────┘
         ↓
┌─────────────────┐
│  DSP Pipeline   │ ← Effects, EQ, Normalization
└────────┬────────┘
         ↓
┌─────────────────┐
│  Audio Output   │ ← Platform-specific API
└─────────────────┘
```

## Dependencies

### Required Libraries
- PyQt6 >= 6.5.0
- PyQt6-Qt6 >= 6.5.0
- numpy >= 1.24.0 (for future audio processing)

### Optional Libraries (Future)
- librosa: Advanced audio analysis
- soundfile: High-quality audio I/O
- pydub: Audio manipulation
- mutagen: Metadata extraction

## Version History

### v1.0.0 (Current)
- Basic file import functionality
- UI framework implementation
- Placeholder playback system

### v2.0.0 (Planned)
- Full playback implementation
- Metadata extraction
- Playlist management
- Audio visualization

---

*Last Updated: 2024*
*Author: Music App Development Team*