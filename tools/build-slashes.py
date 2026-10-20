"""Packs the crescent slash (Isometric_Frog_Character/Pixel Art Animations - Slashes, 128x128, "Slash 3")
into public/images/slashes.png: 9 frames across, one row per colour (colour1..colour5)."""
from PIL import Image
SRC = 'src/assets/Isometric_Frog_Character/Pixel Art Animations - Slashes/128x128/Slash 3/color%d/sprite-sheet.png'
out = Image.new('RGBA', (128 * 9, 128 * 5))
for c in range(1, 6):
    sheet = Image.open(SRC % c).convert('RGBA')
    for f in range(9):
        cell = sheet.crop(((f % 5) * 128, (f // 5) * 128, (f % 5) * 128 + 128, (f // 5) * 128 + 128))
        out.alpha_composite(cell, (f * 128, (c - 1) * 128))
out.save('public/images/slashes.png', optimize=True)
print(out.size)
