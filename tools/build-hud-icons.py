"""
Scales the Ultimate Isometric Pack tool items down to hotbar icons:
  public/images/hud/<tool>.png   (max 96 px, transparent)
Run from the project root:  python3 tools/build-hud-icons.py
"""
import os
from PIL import Image

ROOT = "src/assets/Ultimate_Isometric_Pack (1)/PlacebleItems/Metal/"
ICONS = {
    "sword": "Iron_Sword", "axe": "Iron_Axe", "pickaxe": "Iron_PickAxe", "hammer": "Iron_Hammer",
    "shovel": "Iron_Showel", "fishingpole": "Iron_Fishingpole", "watercan": "Iron_Watercan", "shield": "Iron_Shield",
}
# More icons: skill gems (the same art the monsters drop), a bag for the actions menu, a log to sit on.
PACK = "src/assets/Ultimate_Isometric_Pack (1)/PlacebleItems/"
EXTRA = {
    "gem-attack": PACK + "Valuables/Ruby.png", "gem-defence": PACK + "Valuables/LapisLazulie.png",
    "gem-speed": PACK + "Valuables/Emrald.png", "gem-vitality": PACK + "Valuables/Amber.png",
    "chest": PACK + "Wood/Wood_Chest.png", "log": PACK + "Wood/Wood_Log.png",
}
os.makedirs("public/images/hud", exist_ok=True)
for name, path in EXTRA.items():
    im = Image.open(path).convert("RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((96, 96), Image.LANCZOS)
    canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    canvas.paste(im, ((96 - im.width) // 2, (96 - im.height) // 2), im)
    canvas.save(f"public/images/hud/{name}.png", optimize=True)
for name, stem in ICONS.items():
    im = Image.open(f"{ROOT}{stem}.png").convert("RGBA")
    im.thumbnail((96, 96), Image.LANCZOS)
    canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    canvas.paste(im, ((96 - im.width) // 2, (96 - im.height) // 2), im)
    canvas.save(f"public/images/hud/{name}.png", optimize=True)
print(len(ICONS) + len(EXTRA), "icons")
