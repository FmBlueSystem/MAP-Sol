#!/usr/bin/env python3
import os
import sys

def fix_smart_quotes(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        # Replace smart quotes with regular quotes
        content = content.replace(''', "'")
        content = content.replace(''', "'")
        content = content.replace('"', '"')
        content = content.replace('"', '"')
        content = content.replace('｀', '`')
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'✅ Fixed smart quotes in {filepath}')
            return True
        return False
    except Exception as e:
        print(f'❌ Error processing {filepath}: {e}')
        return False

# Fix specific files
files_to_fix = [
    'utils/artwork-helper.js',
    'js/audio-panel.js',
    'js/professional-meter-suite.js',
    'js/simple-player.js'
]

fixed_count = 0
for file in files_to_fix:
    if os.path.exists(file):
        if fix_smart_quotes(file):
            fixed_count += 1
    else:
        print(f'⚠️  File not found: {file}')

print(f'\n📊 Fixed {fixed_count} files with smart quotes')