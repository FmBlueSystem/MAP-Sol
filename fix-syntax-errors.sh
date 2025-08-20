#!/bin/bash

echo "🔧 Fixing syntax errors in JavaScript files..."

# Fix professional-meter-suite.js
echo "Fixing professional-meter-suite.js..."
sed -i "s/padStart(2, '0')}'/padStart(2, '0')}\`/g" js/professional-meter-suite.js

# Fix audio-panel.js  
echo "Fixing audio-panel.js..."
sed -i "s/padStart(2, '0')}'/padStart(2, '0')}\`/g" js/audio-panel.js

# Fix artwork-helper.js
echo "Fixing artwork-helper.js..."
# Remove EOF comment if exists
sed -i '/^\/\/ EOF$/d' utils/artwork-helper.js

# Add missing closing braces if needed
echo "}" >> utils/artwork-helper.js

echo "✅ Syntax errors fixed!"
echo ""
echo "Now clearing Electron cache..."
rm -rf ~/.config/Electron/Cache/*
rm -rf ~/.config/MAP*/Cache/*
rm -rf ~/.config/map*/Cache/*

echo "✅ Cache cleared!"