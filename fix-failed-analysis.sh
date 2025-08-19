#!/bin/bash

# Script to fix failed audio analysis
# Re-runs analysis for files that failed

echo "🔧 FIXING FAILED AUDIO ANALYSIS"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we have the error file
if [ ! -f "missing_89_errors.txt" ]; then
    echo -e "${RED}❌ Error file missing_89_errors.txt not found${NC}"
    exit 1
fi

# Count total failed files
TOTAL_FAILED=$(grep -c "ANALYSIS_FAILED" missing_89_errors.txt)
echo -e "${YELLOW}📊 Found $TOTAL_FAILED files with failed analysis${NC}"

# Create a temporary file with just the filenames
grep "ANALYSIS_FAILED: " missing_89_errors.txt | sed 's/ANALYSIS_FAILED: //' > failed_files_list.txt

# Check if Python environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️ Activating Python virtual environment...${NC}"
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    elif [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    else
        echo -e "${RED}❌ No virtual environment found. Please create one first.${NC}"
        exit 1
    fi
fi

# Counter for progress
PROCESSED=0
FIXED=0
STILL_FAILED=0

# Create results file
echo "FAILED ANALYSIS FIX REPORT - $(date)" > fix_analysis_report.txt
echo "================================" >> fix_analysis_report.txt

# Process each failed file
while IFS= read -r filename; do
    PROCESSED=$((PROCESSED + 1))
    echo -e "\n${YELLOW}[$PROCESSED/$TOTAL_FAILED] Processing: $filename${NC}"
    
    # Try different analysis methods
    
    # Method 1: Try with MixedInKey metadata extraction
    echo "  → Attempting MixedInKey metadata extraction..."
    python3 << EOF
import os
import sqlite3
from mutagen import File
import json

filename = """$filename"""
db_path = "music_analyzer.db"

try:
    # Find the file
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get file path
    cursor.execute("SELECT id, file_path FROM audio_files WHERE file_name = ?", (filename,))
    result = cursor.fetchone()
    
    if result:
        file_id, file_path = result
        
        # Try to read metadata with mutagen
        audio = File(file_path)
        if audio:
            # Extract any available metadata
            bpm = None
            key = None
            energy = None
            
            # Check for MixedInKey tags
            if 'TBPM' in audio:
                bpm = str(audio['TBPM'][0])
            elif 'BPM' in audio:
                bpm = str(audio['BPM'][0])
                
            if 'TKEY' in audio:
                key = str(audio['TKEY'][0])
            elif 'KEY' in audio:
                key = str(audio['KEY'][0])
                
            if 'TCOM' in audio:  # Comments often contain energy
                comment = str(audio['TCOM'][0])
                if 'energy' in comment.lower():
                    # Try to extract energy value
                    import re
                    match = re.search(r'energy[:\s]+(\d+)', comment.lower())
                    if match:
                        energy = float(match.group(1)) / 10.0
            
            # Update database
            if bpm or key or energy:
                update_query = """
                    INSERT OR REPLACE INTO llm_metadata (file_id, AI_BPM, AI_KEY, AI_ENERGY, AI_TEMPO_CONFIDENCE)
                    VALUES (?, ?, ?, ?, ?)
                """
                cursor.execute(update_query, (file_id, bpm, key, energy, 0.5))
                conn.commit()
                print(f"    ✅ Updated: BPM={bpm}, KEY={key}, ENERGY={energy}")
            else:
                print(f"    ⚠️ No MixedInKey metadata found")
        else:
            print(f"    ❌ Could not read file")
    else:
        print(f"    ❌ File not found in database")
    
    conn.close()
    
except Exception as e:
    print(f"    ❌ Error: {e}")
EOF
    
    # Method 2: Try with basic audio properties
    if [ $? -ne 0 ]; then
        echo "  → Attempting basic audio property extraction..."
        ffprobe -v quiet -print_format json -show_format "$filename" > /tmp/audio_info.json 2>/dev/null
        
        if [ -s /tmp/audio_info.json ]; then
            # Extract duration and bitrate at least
            python3 << EOF
import json
import sqlite3

with open('/tmp/audio_info.json', 'r') as f:
    data = json.load(f)
    
if 'format' in data:
    duration = data['format'].get('duration', 0)
    bitrate = data['format'].get('bit_rate', 0)
    
    # Update database with basic info
    conn = sqlite3.connect("music_analyzer.db")
    cursor = conn.cursor()
    
    filename = """$filename"""
    cursor.execute("UPDATE audio_files SET duration = ?, bitrate = ? WHERE file_name = ?", 
                   (duration, bitrate, filename))
    conn.commit()
    conn.close()
    
    print(f"    ✅ Updated basic properties: duration={duration}s, bitrate={bitrate}")
EOF
        fi
    fi
    
    # Check if fixed
    RESULT=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files af LEFT JOIN llm_metadata lm ON af.id = lm.file_id WHERE af.file_name = '$filename' AND (lm.AI_BPM IS NOT NULL OR lm.AI_KEY IS NOT NULL)")
    
    if [ "$RESULT" -gt 0 ]; then
        echo -e "    ${GREEN}✅ FIXED${NC}"
        echo "FIXED: $filename" >> fix_analysis_report.txt
        FIXED=$((FIXED + 1))
    else
        echo -e "    ${RED}❌ STILL FAILED${NC}"
        echo "STILL_FAILED: $filename" >> fix_analysis_report.txt
        STILL_FAILED=$((STILL_FAILED + 1))
    fi
    
done < failed_files_list.txt

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}📊 FIX ANALYSIS COMPLETE${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Total processed: $PROCESSED"
echo -e "${GREEN}✅ Fixed: $FIXED${NC}"
echo -e "${RED}❌ Still failed: $STILL_FAILED${NC}"

# Save summary
echo "" >> fix_analysis_report.txt
echo "SUMMARY" >> fix_analysis_report.txt
echo "-------" >> fix_analysis_report.txt
echo "Total processed: $PROCESSED" >> fix_analysis_report.txt
echo "Fixed: $FIXED" >> fix_analysis_report.txt
echo "Still failed: $STILL_FAILED" >> fix_analysis_report.txt

echo -e "\n📄 Report saved to: fix_analysis_report.txt"

# Clean up
rm -f failed_files_list.txt /tmp/audio_info.json

echo -e "\n✨ Fix process complete!"