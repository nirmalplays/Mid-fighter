"""
Packs the Ultimate Isometric Pack tiles the game uses into one pre-scaled atlas:
  public/images/world/iso.png        (the atlas)
  src/game/world/isoAtlas.ts         (frame rectangles)
Run from the project root:  python3 tools/build-iso-atlas.py
Source art is 500 px wide with a ~406 px isometric top face; K scales it so one
tile step is 62 x 31 px (see TILE_DX / TILE_DY in src/game/world/constants.ts).
"""
import json
from PIL import Image

ROOT = "src/assets/Ultimate_Isometric_Pack (1)/Tiles/"
K = 62 / 203  # source px -> atlas px

def src(path):
    return Image.open(ROOT + path).convert("RGBA")

def berry_bush(n, color="Red"):
    base = src(f"Bushes/Bush_BerryBush{n}.png")
    base.alpha_composite(src(f"Bushes/Bush_BerryBush{n}_Berries{color}.png"))
    return base

sprites = {}
for i in (1, 2, 3):
    sprites[f"dirt{i}"] = src(f"Ground/GroundTileDiscreet_Dirt{i}.png")
    sprites[f"stone{i}"] = src(f"Stone/GroundTileDiscreet_Stone{i}.png")
    sprites[f"grass{i}"] = src(f"Grass/TileOverlayDiscreet_Grass{i}.png")
    sprites[f"gbush{i}"] = src(f"Bushes/Bush_GreenBush{i}.png")
    sprites[f"bbush{i}"] = berry_bush(i)
    sprites[f"bbush{i}b"] = berry_bush(i, "Black")
    sprites[f"bbush{i}w"] = berry_bush(i, "White")
    sprites[f"path{i}"] = src(f"Stone/TileOverlay_StonePath{i}.png")
sprites["sand"] = src("Ground/GroundTileDiscreet_Sand.png")
sprites["water"] = src("Water/GroundTileDiscreet_Water.png")
for i in range(1, 13):
    sprites[f"flower{i}"] = src(f"Grass/TileOverlay_Flower{i}.png")
for i in range(1, 5):
    sprites[f"clover{i}"] = src(f"Grass/TileOverlay_Clovers{i}.png")
    sprites[f"tallgrass{i}"] = src(f"Grass/TileOverlay_TallGrass{i}.png")
for i in range(1, 6):
    sprites[f"rock{i}"] = src(f"Stone/TallTileOverlay_Stone{i}.png")
sprites["pebbles"] = src("Stone/TileOverlay_Stones.png")
for name, file in {
    "oak": "Oak_Spring", "birch": "Birch_Spring", "pine": "Pine_Stage4", "apple": "Appletree_Stage4",
    "cherry": "CherryTree_Stage4", "ginkgo": "Ginkgo_Stage4", "fantasy": "FantasyTree_Spring",
    "pear": "PearTree_Stage4", "plum": "PlumTree_Stage4",
}.items():
    sprites[f"tree_{name}"] = src(f"Trees/{file}.png")
sprites["stump"] = src("Trees/Tree_Root.png")
sprites["sandpile"] = src("Ground/TileOverlay_SandPile.png")

def on_tile(path, scale=1.35, drop=24):
    """A placeable item (about 250 px) set on a 500 px tile canvas: bottom centre just below the tile centre."""
    item = Image.open(path).convert("RGBA")
    item = item.resize((round(item.width * scale), round(item.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (500, 500), (0, 0, 0, 0))
    canvas.alpha_composite(item, (250 - item.width // 2, 139 + drop - item.height))
    return canvas

PACK = "src/assets/Ultimate_Isometric_Pack (1)/PlacebleItems/"
sprites["driftwood1"] = on_tile(PACK + "Wood/Wood_OldLog.png")
sprites["driftwood2"] = on_tile(PACK + "Wood/Wood_Log.png", 1.2)
sprites["snow"] = src("Water/TileOverlayDiscreet_Snow.png")
for color in ("Blue", "Orange", "Pink"):
    sprites[f"dbush_{color.lower()}"] = src(f"Bushes/Bush_DecorativeBush_{color}.png")

# More of the pack's woods: young trees (two growth stages) so stands vary in size, the autumn coats, snow-laden
# trees for the heights, and bamboo.
TREES = {
    "oak": "Oak", "birch": "Birch", "pine": "Pine", "apple": "Appletree", "cherry": "CherryTree",
    "ginkgo": "Ginkgo", "fantasy": "FantasyTree", "pear": "PearTree", "plum": "PlumTree",
}
for name, file in TREES.items():
    sprites[f"tree_{name}_s2"] = src(f"Trees/{file}_Stage2.png")
    sprites[f"tree_{name}_s3"] = src(f"Trees/{file}_Stage3.png")
    if name != "pine":
        sprites[f"tree_{name}_fall"] = src(f"Trees/{file}_Fall.png")
for name, base in {"pine": "Pine_Stage4", "oak": "Oak_Stage4", "birch": "Birch_Stage4", "fantasy": "FantasyTree_Stage4"}.items():
    im = src(f"Trees/{base}.png")
    im.alpha_composite(src(f"Trees/{TREES[name]}_Snow.png"))
    sprites[f"tree_{name}_snow"] = im
for n in (2, 3):
    sprites[f"tree_bamboo{n}"] = src(f"Trees/Bamboo_Stage{n}.png")

# The caves', dungeons' and new lands' pieces (tools/iso_extra.py).
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import iso_extra
sprites.update(iso_extra.make())
import iso_camp; sprites.update(iso_camp.make())  # the kingdoms' war camps (Camp team)

scaled = {n: im.resize((round(im.width * K), round(im.height * K)), Image.LANCZOS) for n, im in sprites.items()}

# Each frame is trimmed to its art; the game restores the full canvas (Pixi's orig/trim), so anchors are unchanged.
trimmed = {}
for name, im in scaled.items():
    box = im.getbbox() or (0, 0, 1, 1)
    trimmed[name] = (im.crop(box), box[0], box[1], im.width, im.height)

# Shelf-pack (tallest first) into a 2048-wide sheet.
frames, x, y, shelf = {}, 0, 0, 0
for name in sorted(trimmed, key=lambda n: -trimmed[n][0].height):
    im, ox, oy, fw, fh = trimmed[name]
    if x + im.width + 2 > 2048:
        x, y, shelf = 0, y + shelf + 2, 0
    frames[name] = [x, y, im.width, im.height, ox, oy, fw, fh]
    x += im.width + 2
    shelf = max(shelf, im.height)
sheet = Image.new("RGBA", (2048, y + shelf), (0, 0, 0, 0))
for name, (fx, fy, *_rest) in frames.items():
    sheet.paste(trimmed[name][0], (fx, fy))
sheet.save("public/images/world/iso.png", optimize=True)

# A fingerprint of the sheet: the game asks for iso.png?v=<it>, so a browser or CDN holding an older
# sheet never draws new frames from an empty corner of it (props there, but invisible).
import hashlib
version = hashlib.sha1(open("public/images/world/iso.png", "rb").read()).hexdigest()[:10]
with open("src/game/world/isoAtlas.ts", "w", encoding="utf-8", newline="\n") as f:
    f.write("/** Generated by tools/build-iso-atlas.py — do not edit. [x, y, w, h] in iso.png, then where that sits in the untrimmed frame [ox, oy, full w, full h]. */\n")
    f.write(f"export const ISO_VERSION = '{version}';\n")
    f.write(f"export const ISO_SCALE = {K!r};\n")
    f.write("export const ISO_FRAMES: Record<string, [number, number, number, number, number, number, number, number]> = ")
    f.write(json.dumps(frames, indent=4) + ";\n")
print(len(frames), "sprites,", sheet.size)
