#!/usr/bin/env python3
import re

with open('js/audio-panel.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all types of smart quotes
replacements = {
    '"': '"',  # Left double quote
    '"': '"',  # Right double quote  
    ''': "'",  # Left single quote
    ''': "'",  # Right single quote
    '＂': '"', # Fullwidth quote
    '｀': '`', # Fullwidth backtick
}

for smart, regular in replacements.items():
    if smart in content:
        count = content.count(smart)
        content = content.replace(smart, regular)
        print(f'Replaced {count} instances of {smart} with {regular}')

with open('js/audio-panel.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Fixed all smart quotes in audio-panel.js')