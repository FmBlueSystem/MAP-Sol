#!/usr/bin/env python3
"""
Generate PWA icons for Music Analyzer Pro
Creates all required icon sizes from a base design
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_base_icon(size=512):
    """Create the base icon design"""
    # Create a new image with gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw gradient background
    for i in range(size):
        # Gradient from purple to blue
        r = int(118 + (102 - 118) * (i / size))  # 0x76 to 0x66
        g = int(75 + (126 - 75) * (i / size))    # 0x4B to 0x7E
        b = int(162 + (234 - 162) * (i / size))  # 0xA2 to 0xEA
        draw.rectangle([0, i, size, i+1], fill=(r, g, b, 255))
    
    # Draw music note symbol
    center_x = size // 2
    center_y = size // 2
    note_size = size // 3
    
    # Draw circle for note head
    note_head_size = size // 8
    draw.ellipse(
        [center_x - note_head_size, center_y - note_head_size,
         center_x + note_head_size, center_y + note_head_size],
        fill=(255, 255, 255, 255)
    )
    
    # Draw stem
    stem_width = size // 50
    stem_height = size // 3
    draw.rectangle(
        [center_x + note_head_size - stem_width, center_y - stem_height,
         center_x + note_head_size, center_y],
        fill=(255, 255, 255, 255)
    )
    
    # Draw flag
    flag_points = [
        (center_x + note_head_size - stem_width, center_y - stem_height),
        (center_x + note_head_size + size//10, center_y - stem_height + size//10),
        (center_x + note_head_size, center_y - stem_height + size//8)
    ]
    draw.polygon(flag_points, fill=(255, 255, 255, 255))
    
    # Add "MAP" text
    try:
        # Try to use a system font
        font_size = size // 10
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    text = "MAP"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = center_x - text_width // 2
    text_y = size - size // 6
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)
    
    return img

def create_maskable_icon(size=512):
    """Create a maskable icon with safe area"""
    # Create base icon
    img = create_base_icon(size)
    
    # Add padding for maskable safe area (10% on each side)
    padding = int(size * 0.1)
    new_size = size + padding * 2
    
    # Create new image with padding
    padded_img = Image.new('RGBA', (new_size, new_size), (102, 126, 234, 255))
    
    # Resize original to fit in safe area
    safe_size = int(size * 0.8)
    resized = img.resize((safe_size, safe_size), Image.Resampling.LANCZOS)
    
    # Paste in center
    paste_pos = (new_size - safe_size) // 2
    padded_img.paste(resized, (paste_pos, paste_pos), resized)
    
    # Resize back to original size
    final_img = padded_img.resize((size, size), Image.Resampling.LANCZOS)
    
    return final_img

def generate_icons():
    """Generate all required icon sizes"""
    sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512]
    maskable_sizes = [192, 512]
    
    # Create icons directory
    os.makedirs('icons', exist_ok=True)
    
    # Generate base icon
    base_icon = create_base_icon(512)
    
    # Generate regular icons
    for size in sizes:
        icon = base_icon.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(f'icons/icon-{size}.png', 'PNG')
        print(f'✅ Generated icon-{size}.png')
    
    # Generate maskable icons
    for size in maskable_sizes:
        maskable = create_maskable_icon(size)
        maskable.save(f'icons/icon-maskable-{size}.png', 'PNG')
        print(f'✅ Generated icon-maskable-{size}.png')
    
    # Generate Apple touch icon
    apple_icon = base_icon.resize((180, 180), Image.Resampling.LANCZOS)
    apple_icon.save('icons/apple-touch-icon.png', 'PNG')
    print('✅ Generated apple-touch-icon.png')
    
    # Generate favicon
    favicon_sizes = [(16, 16), (32, 32), (48, 48)]
    favicon_images = []
    for size in favicon_sizes:
        favicon_images.append(base_icon.resize(size, Image.Resampling.LANCZOS))
    
    favicon_images[0].save('icons/favicon.ico', format='ICO', sizes=favicon_sizes)
    print('✅ Generated favicon.ico')
    
    print('\n🎉 All icons generated successfully!')

if __name__ == '__main__':
    generate_icons()