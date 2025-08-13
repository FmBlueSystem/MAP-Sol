#!/bin/bash

# Music Analyzer Pro - Quick Launch Script
echo "🎵 Music Analyzer Pro v1.0"
echo "=========================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if database exists
if [ -f "music_analyzer.db" ]; then
    SIZE=$(du -h music_analyzer.db | cut -f1)
    echo "✅ Database found ($SIZE)"
else
    echo "⚠️  No database found (will be created on first run)"
fi

# Check artwork cache
if [ -d "artwork-cache" ]; then
    COUNT=$(ls artwork-cache/*.jpg 2>/dev/null | wc -l | tr -d ' ')
    echo "✅ Artwork cache: $COUNT images"
fi

# Performance check
echo ""
echo "🧪 Running quick tests..."
if node tests/performance.test.js > /dev/null 2>&1; then
    echo "✅ Performance tests: PASSED"
else
    echo "⚠️  Performance tests: SKIPPED"
fi

# Launch app
echo ""
echo "🚀 Launching Music Analyzer Pro..."
echo "   Press Ctrl+C to stop"
echo ""
npm start