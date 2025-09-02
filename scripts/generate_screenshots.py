#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
BG1 = (3, 7, 18)       # #030712
BG2 = (26, 26, 46)     # #1a1a2e
TEAL = (0, 212, 170)
GRAY = (128, 128, 128)
WHITE = (255, 255, 255)
ACCENT = (0, 255, 255)

def gradient_bg(w=W, h=H, c1=BG1, c2=BG2):
    img = Image.new('RGB', (w, h), c1)
    dr = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        r = int(c1[0] * (1-t) + c2[0] * t)
        g = int(c1[1] * (1-t) + c2[1] * t)
        b = int(c1[2] * (1-t) + c2[2] * t)
        dr.line([(0, y), (w, y)], fill=(r, g, b))
    return img

def draw_chrome(draw: ImageDraw.ImageDraw):
    # Sidebar
    draw.rectangle([0, 0, 240, H], fill=(0, 0, 0))
    draw.line([240, 0, 240, H], fill=(40, 40, 40), width=1)
    # Header title
    draw.text((270, 28), "Home", fill=WHITE)
    # Player bar
    draw.rectangle([0, H-90, W, H], fill=(10, 10, 10))
    draw.line([0, H-90, W, H-90], fill=(40, 40, 40), width=1)

def album_card(draw, x, y, title, artist, badge=None):
    # cover
    draw.rounded_rectangle([x, y, x+180, y+180], radius=6, fill=(32, 32, 48))
    # title
    draw.text((x, y+190), title, fill=WHITE)
    # artist
    draw.text((x, y+210), artist, fill=(179, 179, 179))
    # badge
    if badge:
        draw.text((x, y+232), badge, fill=(0, 212, 170))

def controls(draw, mix=False, label=None):
    cy = H-45
    # prev/play/next
    draw.text((W//2-60, cy-10), "⏮", fill=WHITE)
    draw.text((W//2-20, cy-14), "▶", fill=WHITE)
    draw.text((W//2+20, cy-10), "⏭", fill=WHITE)
    if mix:
        draw.text((W//2+60, cy-10), "✨", fill=ACCENT)
    if label:
        draw.text((W//2-140, cy-40), label, fill=ACCENT)

def toast(draw, text):
    # simple centered toast
    tw, th = 420, 40
    x = (W - tw)//2
    y = H - 160
    draw.rounded_rectangle([x, y, x+tw, y+th], radius=10, fill=(0,0,0,180))
    draw.text((x+12, y+10), text, fill=WHITE)

def save_main_ui(path):
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    draw_chrome(d)
    # grid of albums
    x0, y0, dx = 270, 100, 210
    for i in range(4):
        album_card(d, x0 + i*dx, y0, f"Track {i+1}", "Artist", "128 BPM • 8A • E7")
    controls(d, mix=True)
    img.save(path)

def save_next_compatible(path):
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    draw_chrome(d)
    x0, y0, dx = 270, 100, 210
    for i in range(4):
        badge = "" if i==0 else "126 BPM • 9A • E7"
        album_card(d, x0 + i*dx, y0, f"Track {i+1}", "Artist", badge or None)
    controls(d, mix=True, label="Next Compatible")
    toast(d, "Next compatible: Track 2 (92%)")
    img.save(path)

def save_analyze_missing(path):
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    draw_chrome(d)
    x0, y0, dx = 270, 100, 210
    for i in range(4):
        album_card(d, x0 + i*dx, y0, f"Track {i+1}", "Artist")
    # progress dialog mock
    pw, ph = 520, 120
    px = (W - pw)//2
    py = (H - ph)//2
    d.rounded_rectangle([px, py, px+pw, py+ph], radius=12, fill=(26, 26, 46))
    d.text((px+20, py+20), "Analyzing missing features...", fill=WHITE)
    # progress bar
    barw, barh = pw-40, 16
    bx, by = px+20, py+60
    d.rounded_rectangle([bx, by, bx+barw, by+barh], radius=8, fill=(32, 32, 48))
    prog = int(barw*0.6)
    d.rounded_rectangle([bx, by, bx+prog, by+barh], radius=8, fill=TEAL)
    controls(d)
    img.save(path)

def main():
    out = Path('resources/screenshots')
    out.mkdir(parents=True, exist_ok=True)
    save_main_ui(out / 'main_ui.png')
    save_next_compatible(out / 'next_compatible.png')
    save_analyze_missing(out / 'analyze_missing.png')
    print('Screenshots generated under', out)

if __name__ == '__main__':
    main()

