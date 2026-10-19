"""
Scales the Isometric Frog Character sheets (350 px cells: front view 5x3, back view 5x2)
into one atlas used for the frog monsters:
  public/images/world/frog.png   (front sheet on top, back sheet below, cells of CELL px)
Run from the project root:  python3 tools/build-monsters.py
"""
import numpy as np
from PIL import Image

SRC = "src/assets/Isometric_Frog_Character/"
K = 0.38
front = Image.open(SRC + "CharacterSheet_CharacterFront.png").convert("RGBA")
back = Image.open(SRC + "CharacterSheet_FroggoBack.png").convert("RGBA")

def measure(im, rows):
    a = np.array(im)[:, :, 3]
    bottoms, centres = [], []
    for r in range(rows):
        for c in range(5):
            cell = a[r * 350:(r + 1) * 350, c * 350:(c + 1) * 350]
            ys, xs = np.where(cell > 20)
            if len(ys):
                bottoms.append(ys.max())
                centres.append((xs.min() + xs.max()) / 2)
    return int(np.median(bottoms)), int(np.median(centres))

fb, fc = measure(front, 3)
bb, bc = measure(back, 2)
print("front feet y/x", fb, fc, " back feet y/x", bb, bc, " -> scaled", round(fb * K), round(fc * K))
fs = front.resize((round(front.width * K), round(front.height * K)), Image.LANCZOS)
bs = back.resize((round(back.width * K), round(back.height * K)), Image.LANCZOS)
sheet = Image.new("RGBA", (fs.width, fs.height + bs.height), (0, 0, 0, 0))
sheet.paste(fs, (0, 0))
sheet.paste(bs, (0, fs.height))
sheet.save("public/images/world/frog.png", optimize=True)
print("cell", round(350 * K), "sheet", sheet.size, "back sheet offset y", fs.height)
