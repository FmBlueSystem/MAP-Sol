#!/usr/bin/env python3
import sys

with open('js/audio-panel.js', 'r') as f:
    content = f.read()
    
# Replace smart quotes with regular quotes
content = content.replace(''', "'")
content = content.replace(''', "'")
content = content.replace('"', '"')
content = content.replace('"', '"')
content = content.replace('｀', '`')

with open('js/audio-panel.js', 'w') as f:
    f.write(content)
    
print('Smart quotes replaced in audio-panel.js')