"""Cuts the frog shopkeeper's three idle frames (Isometric_Frog_Character/CharacterSheet_CharacterFront.png,
350 px cells, top row) down to 175 px into public/images/world/frog.png, three frames across."""
from PIL import Image
sheet = Image.open('src/assets/Isometric_Frog_Character/CharacterSheet_CharacterFront.png').convert('RGBA')
out = Image.new('RGBA', (175 * 3, 175))
for f in range(3):
    cell = sheet.crop((f * 350, 0, f * 350 + 350, 350)).resize((175, 175), Image.LANCZOS)
    out.alpha_composite(cell, (f * 175, 0))
out.save('public/images/world/frog.png', optimize=True)
