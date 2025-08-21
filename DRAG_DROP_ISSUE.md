# Drag & Drop Issue - Security Context Problem

## Problem Summary

Drag & drop from OS file system to Electron app fails because browser security prevents access to file paths.

## Technical Explanation

### Two Different Contexts in Electron:

1. **Renderer Process (Frontend)**
    - Runs in Chromium browser context
    - Security sandbox prevents file system access
    - File objects from drag & drop DO NOT contain real paths
    - Only has: name, size, type, content (via FileReader API)

2. **Main Process (Backend)**
    - Full Node.js access
    - Can read/write file system
    - dialog.showOpenDialog() works here
    - Returns real file paths

### Why Drag & Drop Fails:

```javascript
// When file is dragged into app:
file.path; // undefined (security restriction)
file.webkitRelativePath; // empty (not from input element)
file.name; // "song.mp3" (only filename, no path)
```

## Solution

### Option 1: Use Button + Dialog (IMPLEMENTED)

```javascript
// Main process - works
ipcMain.handle('select-music-files', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'flac', ...] }]
    });
    return { filePaths: result.filePaths }; // Real paths!
});
```

### Option 2: Process File Content (NOT IMPLEMENTED)

```javascript
// Renderer process - read file content directly
const arrayBuffer = await file.arrayBuffer();
// Process audio without needing path
// But cannot save reference for later playback
```

## Decision

Use **Option 1** - File dialog via button. Simple, works, no security issues.

## User Instructions

**To import music:**

1. Click the + button
2. Select audio files
3. Click Open

**Note:** Drag & drop is disabled due to Electron security restrictions.
