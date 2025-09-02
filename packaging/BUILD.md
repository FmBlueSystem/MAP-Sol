# Building Music Analyzer Pro

This document describes how to build standalone executables for Music Analyzer Pro using PyInstaller.

## Prerequisites

1. Install PyInstaller:
   ```bash
   pip install pyinstaller
   ```

2. Install all application dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Ensure you have the required audio libraries for your platform:
   - **macOS**: Core Audio (built-in)
   - **Windows**: Windows Media Foundation (built-in)
   - **Linux**: ALSA/PulseAudio

## Building for macOS

### Command
```bash
cd packaging
pyinstaller --noconsole --clean -y MusicAnalyzerPro.spec
```

### Output
The build will create:
- `dist/MusicAnalyzerPro.app` - The macOS application bundle
- `dist/MusicAnalyzerPro/` - The collected files (can be ignored)
- `build/` - Build artifacts (can be deleted)

### Signing and Notarization (Optional)
For distribution outside the App Store:
```bash
# Sign the app
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" dist/MusicAnalyzerPro.app

# Create DMG for distribution
hdiutil create -volname "Music Analyzer Pro" -srcfolder dist/MusicAnalyzerPro.app -ov -format UDZO MusicAnalyzerPro.dmg
```

## Building for Windows

### Command
```bash
cd packaging
pyinstaller --noconsole --clean -y MusicAnalyzerPro_win.spec
```

### Output
The build will create:
- `dist/MusicAnalyzerPro.exe` - The Windows executable
- `build/` - Build artifacts (can be deleted)

### Creating an Installer (Optional)
Use Inno Setup or NSIS to create a proper Windows installer:

1. Download and install [Inno Setup](https://www.jrsoftware.org/isinfo.php)
2. Create an installer script (example):

```iss
[Setup]
AppName=Music Analyzer Pro
AppVersion=1.0.0
DefaultDirName={pf}\MusicAnalyzerPro
DefaultGroupName=Music Analyzer Pro
OutputDir=.
OutputBaseFilename=MusicAnalyzerPro_Setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "dist\MusicAnalyzerPro.exe"; DestDir: "{app}"
Source: "dist\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\Music Analyzer Pro"; Filename: "{app}\MusicAnalyzerPro.exe"
Name: "{commondesktop}\Music Analyzer Pro"; Filename: "{app}\MusicAnalyzerPro.exe"
```

## Building for Linux

### Command
```bash
cd packaging
pyinstaller --noconsole --clean -y MusicAnalyzerPro.spec
```

### Output
The build will create:
- `dist/MusicAnalyzerPro/` - Directory with executable and libraries
- `dist/MusicAnalyzerPro/MusicAnalyzerPro` - The Linux executable

### Creating AppImage (Recommended)
For better Linux distribution compatibility:

```bash
# Install appimagetool
wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x appimagetool-x86_64.AppImage

# Create AppDir structure
mkdir -p MusicAnalyzerPro.AppDir/usr/bin
cp -r dist/MusicAnalyzerPro/* MusicAnalyzerPro.AppDir/usr/bin/

# Create desktop entry
cat > MusicAnalyzerPro.AppDir/MusicAnalyzerPro.desktop << EOF
[Desktop Entry]
Name=Music Analyzer Pro
Exec=MusicAnalyzerPro
Icon=icon
Type=Application
Categories=Audio;Music;
EOF

# Add icon (if available)
cp ../resources/icon.png MusicAnalyzerPro.AppDir/icon.png

# Create AppRun script
cat > MusicAnalyzerPro.AppDir/AppRun << EOF
#!/bin/bash
HERE="$(dirname "$(readlink -f "${0}")")"
exec "${HERE}/usr/bin/MusicAnalyzerPro" "$@"
EOF
chmod +x MusicAnalyzerPro.AppDir/AppRun

# Build AppImage
./appimagetool-x86_64.AppImage MusicAnalyzerPro.AppDir
```

## Troubleshooting

### Missing modules at runtime
If the app fails with import errors:
1. Add the module to `hiddenimports` in the spec file
2. Rebuild with `--clean` flag

### Audio libraries not found
- **macOS**: Ensure PyQt6 multimedia plugins are included
- **Windows**: May need to manually copy Qt6 multimedia DLLs
- **Linux**: Install system audio libraries (libasound2, libpulse0)

### Large file size
To reduce size:
1. Use UPX compression (already enabled in spec)
2. Exclude unnecessary modules in the spec file
3. Use `--onefile` option (but this increases startup time)

### Path issues in frozen app
The application uses `utils.paths.resource_path()` to handle both development and frozen environments correctly.

## Resources and Data Files

The spec files automatically include:
- `resources/` - Icons, images, fonts
- `models/` - AI models (if present)
- `config*.yaml` - Example configuration files

These are bundled into the executable and extracted at runtime.

## Version Information

Update version numbers in:
- `packaging/MusicAnalyzerPro.spec` (info_plist for macOS)
- `src/app.py` (app_version)
- This BUILD.md file

## Clean Build

Always use `--clean` flag for production builds:
```bash
pyinstaller --noconsole --clean -y MusicAnalyzerPro.spec
```

This ensures no cached files from previous builds are included.