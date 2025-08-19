const fs = require('fs');
const path = require('path');

// Create a simple default album image as base64 SVG
const defaultAlbumSVG = `
<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="200" cy="200" r="140" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <circle cx="200" cy="200" r="50" fill="rgba(0,0,0,0.3)"/>
  <path d="M 180 150 L 180 250 L 240 200 Z" fill="rgba(255,255,255,0.8)"/>
  <text x="200" y="350" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.6)" text-anchor="middle">No Artwork</text>
</svg>
";

// Convert SVG to base64
const base64SVG = Buffer.from(defaultAlbumSVG).toString('base64');
const dataURL = `data:image/svg+xml;base64,${base64SVG}`;

// Save as HTML file with embedded SVG for reference
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Default Album Image</title>
</head>
<body style="background: #333; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
    <img src="${dataURL}" alt="Default Album" style="width: 400px; height: 400px;">
</body>
</html>";

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    logInfo('✅ Created assets directory');
}

// Save the data URL to a JS file for easy import
const jsContent = `// Default album artwork as base64 data URL
export const DEFAULT_ALBUM_ARTWORK = '${dataURL}';

// Function to get default artwork
export function getDefaultArtwork() {
    return DEFAULT_ALBUM_ARTWORK;
}
';

fs.writeFileSync(path.join(assetsDir, 'default-album.js'), jsContent);
logInfo('✅ Created default-album.js with embedded SVG');

// Also save the HTML for testing
fs.writeFileSync(path.join(assetsDir, 'default-album-preview.html'), htmlContent);
logInfo('✅ Created default-album-preview.html for testing');

// Export the data URL for immediate use
module.exports = { DEFAULT_ALBUM_ARTWORK: dataURL };

logInfo('✅ Default album image created successfully');
logDebug('📍 Data URL length:', dataURL.length, 'characters');
logDebug('🎨 Preview available at: assets/default-album-preview.html');
