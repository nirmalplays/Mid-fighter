"""
Iso art for the caves, dungeons, ruins and new lands, drawn in the Ultimate Isometric Pack's style
(flat colours, a lighter top-left facet, a darker right, a thick plum outline) at the pack's own
scale, so build-iso-atlas.py packs them with the rest:

  * ground cubes: dungeon brick, plank floor (from the pack's subtle cubes, patterned), the pack's
    ochre, gem and ore cubes;
  * flat overlays: rails, ash, salt crust, lava cracks, rubble, the pack's holes, puddles and ice;
  * standing pieces on a 500 x 1000 canvas (tile centre at 250, 639): torches, crystals, stalagmites,
    scaffolds, a mine cart, pillars, ladders, stairs, archways, dead trees, cacti, palms, coral,
    obsidian, bookshelves, ruined walls, and the pack's lanterns, mushrooms, crates, bones and skulls;
  * big pieces on a 1000 x 1000 canvas (tile centre at 500, 639): the cave mouth, the ruin gate.
"""
import math
from PIL import Image, ImageDraw

ROOT = "src/assets/Ultimate_Isometric_Pack (1)/"
OL = (52, 1, 41, 255)
W_OL = 11


def src(path):
    return Image.open(ROOT + path).convert("RGBA")


def rgb(h, a=255):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), a)


def mul(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)


def poly(d, pts, fill, w=W_OL):
    pts = [(float(x), float(y)) for x, y in pts]
    d.polygon(pts, fill=fill)
    d.line(pts + [pts[0]], fill=OL, width=w, joint="curve")


def lines(d, pts, fill, w):
    w = int(round(w))
    """A thick stroke with a plum outline round it."""
    d.line(pts, fill=OL, width=w + W_OL, joint="curve")
    for p in (pts[0], pts[-1]):
        r = (w + W_OL) / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=OL)
    d.line(pts, fill=fill, width=w, joint="curve")
    for p in (pts[0], pts[-1]):
        r = w / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill)


def ellipse(d, box, fill, w=W_OL):
    d.ellipse(box, fill=fill, outline=OL, width=w)


def tall():
    im = Image.new("RGBA", (500, 1000), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def big():
    im = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def flat():
    im = Image.new("RGBA", (500, 500), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


# The top face of a cube / a flat overlay: a diamond centred at (250, 139), 406 x 203.
TOP = [(250, 37), (453, 139), (250, 241), (47, 139)]


def on_top(u, v):
    """A point on the top face: u, v in -1..1 along the two tile axes."""
    return (250 + (u - v) * 101.5, 139 + (u + v) * 50.75)


GY = 639  # tile centre on a tall canvas


# ------------------------------------------------------------------ ground

def brick_cube():
    im = src("Tiles/Stone/GroundTileDiscreet_Stone2.png")
    d = ImageDraw.Draw(im)
    line = (70, 60, 80, 255)
    for k in range(-3, 4):
        a = on_top(-1, k / 4)
        b = on_top(1, k / 4)
        d.line([a, b], fill=line, width=5)
    for row in range(-4, 4):
        for n in range(-4, 5):
            off = 0.5 if row % 2 else 0
            u = (n + off) / 4
            if -1 < u < 1:
                d.line([on_top(u, row / 4), on_top(u, (row + 1) / 4)], fill=line, width=5)
    return im


def plank_cube():
    im = src("Tiles/Ground/GroundTileDiscreet_Dirt2.png")
    d = ImageDraw.Draw(im)
    line = (60, 34, 20, 255)
    for k in range(-4, 5):
        d.line([on_top(k / 5, -1), on_top(k / 5, 1)], fill=line, width=5)
    for k, v in enumerate([-0.55, 0.15, 0.7]):
        u = -0.6 + 0.4 * k
        d.line([on_top(u - 0.2, v), on_top(u + 0.2, v)], fill=line, width=4)
    return im


# ------------------------------------------------------------------ flats

def rail(axis):
    im, d = flat()
    wood = (120, 78, 44, 255)
    for k in range(-3, 4):
        t = k / 3.6
        a, b = (on_top(t, -0.55), on_top(t, 0.55)) if axis == "u" else (on_top(-0.55, t), on_top(0.55, t))
        lines(d, [a, b], wood, 14)
    steel = (150, 150, 170, 255)
    for s in (-0.35, 0.35):
        a, b = (on_top(-1, s), on_top(1, s)) if axis == "u" else (on_top(s, -1), on_top(s, 1))
        lines(d, [a, b], steel, 8)
    return im


def speckle(colors, n, seed, size=(6, 14)):
    import random
    rnd = random.Random(seed)
    im, d = flat()
    for _ in range(n):
        u, v = rnd.uniform(-0.85, 0.85), rnd.uniform(-0.85, 0.85)
        x, y = on_top(u, v)
        r = rnd.uniform(*size)
        d.ellipse([x - r, y - r * 0.55, x + r, y + r * 0.55], fill=rnd.choice(colors))
    return im


def cracks(color, glow, seed):
    import random
    rnd = random.Random(seed)
    im, d = flat()
    for _ in range(4):
        u, v = rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6)
        pts = [on_top(u, v)]
        for _ in range(4):
            u += rnd.uniform(-0.35, 0.35)
            v += rnd.uniform(-0.35, 0.35)
            u, v = max(-0.9, min(0.9, u)), max(-0.9, min(0.9, v))
            pts.append(on_top(u, v))
        if glow:
            d.line(pts, fill=glow, width=18, joint="curve")
        d.line(pts, fill=color, width=7, joint="curve")
    return im


# ------------------------------------------------------------------ standing pieces

def torch():
    im, d = tall()
    lines(d, [(250, GY + 20), (250, GY - 190)], (110, 70, 40, 255), 18)
    poly(d, [(222, GY - 200), (278, GY - 200), (266, GY - 168), (234, GY - 168)], (90, 80, 90, 255))
    poly(d, [(250, GY - 330), (292, GY - 236), (270, GY - 200), (230, GY - 200), (208, GY - 236)], (255, 140, 40, 255), 8)
    d.polygon([(250, GY - 290), (272, GY - 232), (250, GY - 206), (228, GY - 232)], fill=(255, 220, 120, 255))
    return im


def crystal(base, seed):
    import random
    rnd = random.Random(seed)
    im, d = tall()
    c = rgb(base)
    shards = [(0, 230, 0), (-70, 150, -0.35), (70, 170, 0.3), (-30, 110, -0.15), (40, 100, 0.2)]
    rnd.shuffle(shards)
    for dx, h, lean in sorted(shards, key=lambda s: -s[1]):
        h *= rnd.uniform(0.85, 1.1)
        x0 = 250 + dx
        w = 28 + h * 0.08
        top = (x0 + lean * h, GY + 10 - h)
        left = [(x0 - w, GY + 10), (x0 - w + lean * h * 0.9, GY + 10 - h * 0.85), top, (x0 + lean * h * 0.95, GY + 10)]
        right = [(x0 + lean * h * 0.95, GY + 10), top, (x0 + w + lean * h * 0.9, GY + 10 - h * 0.85), (x0 + w, GY + 10)]
        poly(d, left, mul(c, 1.15))
        poly(d, right, mul(c, 0.8))
        d.line([(x0 - w * 0.4 + lean * h * 0.4, GY - h * 0.3), (x0 - w * 0.2 + lean * h * 0.75, GY - h * 0.72)], fill=(255, 255, 255, 170), width=7)
    return im


def stalagmite(seed):
    import random
    rnd = random.Random(seed)
    im, d = tall()
    for k, (dx, h, w) in enumerate([(0, 300, 70), (-80, 170, 46), (78, 140, 40)][: 2 + seed % 2]):
        h *= rnd.uniform(0.85, 1.15)
        x0 = 250 + dx
        tip = (x0 + rnd.uniform(-12, 12), GY + 8 - h)
        poly(d, [(x0 - w, GY + 14), (x0 - w * 0.55, GY - h * 0.45), tip, (x0 - 4, GY + 18)], (150, 120, 112, 255))
        poly(d, [(x0 - 4, GY + 18), tip, (x0 + w * 0.6, GY - h * 0.42), (x0 + w, GY + 12)], (112, 86, 82, 255))
    return im


def scaffold():
    im, d = tall()
    wood = (150, 100, 56, 255)
    for x in (150, 350):
        lines(d, [(x, GY + 40), (x, GY - 260)], wood, 20)
    lines(d, [(150, GY - 120), (350, GY - 220)], mul(wood, 0.85), 14)
    lines(d, [(130, GY - 250), (370, GY - 250)], wood, 22)
    poly(d, [(120, GY - 268), (380, GY - 268), (370, GY - 238), (130, GY - 238)], (176, 124, 72, 255))
    return im


def minecart():
    im, d = tall()
    for x in (180, 320):
        ellipse(d, [x - 32, GY - 30, x + 32, GY + 34], (70, 66, 80, 255))
    poly(d, [(120, GY - 150), (380, GY - 150), (350, GY - 10), (150, GY - 10)], (120, 112, 128, 255))
    poly(d, [(120, GY - 150), (380, GY - 150), (360, GY - 128), (140, GY - 128)], (150, 142, 158, 255), 8)
    for k, (x, y, r) in enumerate([(200, -170, 34), (255, -185, 40), (310, -168, 32), (240, -150, 30)]):
        ellipse(d, [x - r, GY + y - r * 0.8, x + r, GY + y + r * 0.8], [(140, 130, 150, 255), (220, 150, 60, 255), (150, 140, 160, 255), (230, 170, 70, 255)][k])
    return im


def pillar(broken):
    im, d = tall()
    stone = (178, 166, 176, 255)
    top = GY - (210 if broken else 420)
    poly(d, [(170, GY + 30), (330, GY + 30), (320, GY - 10), (180, GY - 10)], mul(stone, 0.85))
    poly(d, [(190, GY - 10), (310, GY - 10), (310, top), (190, top)], stone)
    for x in (220, 250, 280):
        d.line([(x, GY - 14), (x, top + 12)], fill=mul(stone, 0.78), width=8)
    if broken:
        poly(d, [(186, top + 6), (210, top - 40), (240, top - 4), (268, top - 52), (314, top + 6)], mul(stone, 1.08))
        for x, y, r in ((130, GY + 34, 30), (372, GY + 28, 24)):
            poly(d, [(x - r, y), (x - r * 0.4, y - r), (x + r * 0.6, y - r * 0.7), (x + r, y)], mul(stone, 0.9), 8)
    else:
        poly(d, [(176, top + 4), (324, top + 4), (334, top - 34), (166, top - 34)], mul(stone, 1.08))
    return im


def ladder(light):
    im, d = tall()
    if light:
        for k in range(6, 0, -1):
            d.ellipse([250 - 28 * k, GY - 470 - 16 * k, 250 + 28 * k, GY - 470 + 16 * k], fill=(255, 236, 170, 26))
    wood = (160, 108, 60, 255)
    lines(d, [(190, GY + 20), (214, GY - 470)], wood, 16)
    lines(d, [(310, GY + 20), (286, GY - 470)], wood, 16)
    for k in range(9):
        y = GY - 20 - k * 52
        t = k / 9
        lines(d, [(192 + 22 * t, y), (308 - 22 * t, y)], mul(wood, 0.9), 11)
    return im


def hole_ladder():
    hole = src("Tiles/Ground/TileOverlay_Hole.png").resize((650, 650), Image.LANCZOS)
    im, d = tall()
    im.alpha_composite(hole, (250 - 325, GY - 325 - 60 + 40))
    wood = (160, 108, 60, 255)
    lines(d, [(214, GY - 40), (204, GY - 150)], wood, 14)
    lines(d, [(286, GY - 40), (296, GY - 150)], wood, 14)
    lines(d, [(206, GY - 120), (294, GY - 120)], wood, 10)
    return im


def stairs_down():
    im, d = flat()
    rim = (150, 140, 150, 255)
    poly(d, [on_top(-0.75, -0.75), on_top(0.75, -0.75), on_top(0.75, 0.75), on_top(-0.75, 0.75)], rim)
    for k in range(5):
        t = k / 5
        s = 0.62 - t * 0.1
        dark = int(90 - 70 * t)
        d.polygon([on_top(-s, -0.62 + t * 1.2), on_top(s, -0.62 + t * 1.2), on_top(s, -0.62 + (t + 0.2) * 1.2), on_top(-s, -0.62 + (t + 0.2) * 1.2)], fill=(dark, dark - 10 if dark > 10 else 0, dark + 10, 255))
    return im


def arch(dark=True, w=1.0):
    im, d = big()
    stone = (168, 156, 168, 255)
    cx = 500
    half = 150 * w
    for s in (-1, 1):
        x = cx + s * half
        poly(d, [(x - 46, GY + 60), (x + 46, GY + 60), (x + 40, GY - 300), (x - 40, GY - 300)], stone if s < 0 else mul(stone, 0.85))
    poly(d, [(cx - half - 56, GY - 300), (cx + half + 56, GY - 300), (cx + half + 40, GY - 360), (cx - half - 40, GY - 360)], mul(stone, 1.05))
    inner = [(cx - half + 40, GY + 56), (cx - half + 40, GY - 210), (cx, GY - 290), (cx + half - 40, GY - 210), (cx + half - 40, GY + 56)]
    poly(d, inner, (16, 8, 20, 255) if dark else (255, 236, 180, 255))
    if dark:
        d.polygon([(cx - half + 60, GY + 50), (cx + half - 60, GY + 50), (cx + half - 60, GY), (cx - half + 60, GY)], fill=(40, 26, 44, 255))
    return im


def cave_mouth():
    im, d = big()
    rock = (150, 118, 106, 255)
    # the hill of rock the tunnel cuts into
    poly(d, [(170, GY + 80), (210, GY - 200), (330, GY - 330), (520, GY - 390), (690, GY - 320), (800, GY - 170), (840, GY + 80)], rock)
    poly(d, [(520, GY - 390), (690, GY - 320), (800, GY - 170), (840, GY + 80), (600, GY + 80), (610, GY - 220)], mul(rock, 0.82))
    for x, y, r in ((300, GY - 230, 46), (700, GY - 260, 38), (460, GY - 330, 30)):
        d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=mul(rock, 1.12))
    # the dark mouth, shored up with timber
    poly(d, [(380, GY + 80), (380, GY - 120), (420, GY - 200), (580, GY - 200), (620, GY - 120), (620, GY + 80)], (14, 8, 16, 255))
    wood = (150, 100, 56, 255)
    lines(d, [(372, GY + 80), (372, GY - 170)], wood, 26)
    lines(d, [(628, GY + 80), (628, GY - 170)], wood, 26)
    lines(d, [(350, GY - 186), (650, GY - 186)], mul(wood, 1.08), 30)
    # a lantern on a hook
    lines(d, [(650, GY - 186), (676, GY - 140)], (80, 70, 80, 255), 6)
    poly(d, [(660, GY - 140), (692, GY - 140), (700, GY - 90), (652, GY - 90)], (255, 196, 90, 255), 8)
    return im


def ruin_wall():
    im, d = tall()
    stone = (176, 160, 150, 255)
    pts = [(110, GY + 40), (110, GY - 200), (150, GY - 240), (190, GY - 210), (230, GY - 300), (290, GY - 260), (330, GY - 170), (390, GY - 150), (390, GY + 40)]
    poly(d, pts, stone)
    for y in range(int(GY - 30), int(GY - 240), -46):
        d.line([(118, y), (382, y)], fill=mul(stone, 0.78), width=7)
    for k, y in enumerate(range(int(GY - 30), int(GY - 240), -46)):
        for x in range(140 + (k % 2) * 40, 380, 80):
            d.line([(x, y), (x, y - 46)], fill=mul(stone, 0.78), width=7)
    d.ellipse([140, GY - 120, 200, GY - 90], fill=(98, 140, 74, 220))
    return im


def dead_tree():
    im, d = tall()
    bark = (82, 66, 62, 255)
    lines(d, [(250, GY + 20), (244, GY - 160), (256, GY - 300)], bark, 34)
    for a, b in [((246, GY - 150), (160, GY - 250)), ((160, GY - 250), (120, GY - 330)), ((252, GY - 220), (340, GY - 300)), ((340, GY - 300), (360, GY - 380)), ((256, GY - 290), (230, GY - 400))]:
        lines(d, [a, b], bark, 16)
    return im


def cactus():
    im, d = tall()
    g = (96, 150, 70, 255)
    lines(d, [(250, GY + 10), (250, GY - 300)], g, 64)
    lines(d, [(250, GY - 140), (170, GY - 150), (170, GY - 240)], mul(g, 0.9), 38)
    lines(d, [(250, GY - 190), (330, GY - 200), (330, GY - 270)], mul(g, 1.08), 36)
    for y in range(int(GY - 280), int(GY), 40):
        d.line([(244, y), (256, y + 14)], fill=(220, 230, 180, 255), width=4)
    return im


def palm():
    im, d = tall()
    trunk = (156, 116, 72, 255)
    pts = [(250, GY + 10), (262, GY - 120), (290, GY - 240), (322, GY - 350)]
    lines(d, pts, trunk, 30)
    top = pts[-1]
    leaf = (74, 160, 82, 255)
    for ang in (-160, -120, -60, -20, 20, 160, 200):
        a = math.radians(ang)
        mid = (top[0] + math.cos(a) * 90, top[1] + math.sin(a) * 40 - 30)
        end = (top[0] + math.cos(a) * 170, top[1] + math.sin(a) * 60 + 40)
        poly(d, [top, (mid[0], mid[1] - 22), end, (mid[0], mid[1] + 18)], leaf if ang % 40 else mul(leaf, 0.85), 8)
    for dx in (-14, 12):
        ellipse(d, [top[0] + dx - 16, top[1] + 4, top[0] + dx + 16, top[1] + 36], (110, 74, 40, 255), 7)
    return im


def coral(base):
    im, d = tall()
    c = rgb(base)
    def branch(x, y, ang, length, w, depth):
        if depth == 0 or length < 20:
            return
        x2 = x + math.cos(ang) * length
        y2 = y - math.sin(ang) * length
        lines(d, [(x, y), (x2, y2)], c if depth % 2 else mul(c, 0.88), w)
        branch(x2, y2, ang + 0.45, length * 0.72, w * 0.75, depth - 1)
        branch(x2, y2, ang - 0.5, length * 0.68, w * 0.75, depth - 1)
    branch(250, GY + 10, math.pi / 2, 110, 30, 4)
    return im


def obsidian():
    im, d = tall()
    for dx, h, w in ((0, 330, 60), (-70, 180, 40), (66, 220, 44)):
        x0 = 250 + dx
        poly(d, [(x0 - w, GY + 16), (x0 - 6, GY + 6 - h), (x0 + 2, GY + 22)], (40, 30, 56, 255))
        poly(d, [(x0 + 2, GY + 22), (x0 - 6, GY + 6 - h), (x0 + w, GY + 12)], (24, 16, 34, 255))
        d.line([(x0 - w * 0.5, GY - 10), (x0 - 10, GY - h * 0.85)], fill=(170, 120, 255, 200), width=6)
    return im


def bookshelf():
    im, d = tall()
    wood = (116, 74, 42, 255)
    poly(d, [(140, GY + 30), (360, GY + 30), (360, GY - 300), (140, GY - 300)], wood)
    import random
    rnd = random.Random(3)
    for y in (GY - 290, GY - 190, GY - 90):
        d.rectangle([150, y, 350, y + 86], fill=mul(wood, 0.6))
        x = 156
        while x < 340:
            w = rnd.randint(12, 22)
            h = rnd.randint(58, 82)
            col = rnd.choice([(150, 50, 50, 255), (60, 90, 140, 255), (70, 120, 70, 255), (190, 150, 70, 255), (110, 70, 130, 255)])
            d.rectangle([x, y + 86 - h, x + w, y + 86], fill=col, outline=OL, width=3)
            x += w + 2
        lines(d, [(146, y + 90), (354, y + 90)], mul(wood, 1.1), 10)
    return im


def item(path, scale=1.35, drop=24):
    """A pack item set on a tall canvas, its bottom just below the tile centre."""
    it = Image.open(ROOT + "PlacebleItems/" + path).convert("RGBA")
    it = it.resize((round(it.width * scale), round(it.height * scale)), Image.LANCZOS)
    im, _ = tall()
    im.alpha_composite(it, (250 - it.width // 2, GY + drop - it.height))
    return im


def make():
    s = {}
    s["brick"] = brick_cube()
    s["plank"] = plank_cube()
    s["ochre"] = src("Tiles/Ground/GroundTileDiscreet_Ochre.png")
    for n in ("Amathyst", "Ruby", "Emerald", "LapisLazulie", "Diamond"):
        s[f"gem_{n.lower()[:4]}"] = src(f"Tiles/Stone/GroundTileDiscreet_GemStone{n}.png")
    for n in ("Iron", "MetalGold", "MetalCopper"):
        s[f"ore_{n.replace('Metal', '').lower()}"] = src(f"Tiles/Stone/GroundTileDiscreet_{n}.png")
    s["ice"] = src("Tiles/Water/TileOverlayDiscreet_Ice.png")
    for k in (1, 2, 3):
        s[f"puddle{k}"] = src(f"Tiles/Water/TileOverlay_WaterPuddle{k}.png")
    s["hole"] = src("Tiles/Ground/TileOverlay_Hole.png")
    s["rubble"] = src("Tiles/Stone/TileOverlay_Stones.png")
    s["rail_u"] = rail("u")
    s["rail_v"] = rail("v")
    s["ash"] = speckle([(70, 64, 66, 255), (96, 90, 92, 255), (50, 44, 46, 255)], 40, 1)
    s["salt"] = cracks((236, 236, 240, 255), None, 2)
    s["lavacrack"] = cracks((255, 196, 80, 255), (255, 90, 30, 160), 3)
    s["moss"] = speckle([(90, 140, 70, 255), (70, 120, 60, 255)], 26, 4, (8, 18))
    s["stairs_down"] = stairs_down()
    s["torch"] = torch()
    for k, c in enumerate(("#a78bfa", "#7dd3fc", "#f87171", "#fbbf24")):
        s[f"crystal{k + 1}"] = crystal(c, k)
    for k in (1, 2):
        s[f"stalag{k}"] = stalagmite(k)
    s["scaffold"] = scaffold()
    s["minecart"] = minecart()
    s["pillar"] = pillar(False)
    s["pillar_broken"] = pillar(True)
    s["ladder_up"] = ladder(True)
    s["hole_ladder"] = hole_ladder()
    s["deadtree"] = dead_tree()
    s["cactus"] = cactus()
    s["palm"] = palm()
    s["coral1"] = coral("#f472b6")
    s["coral2"] = coral("#fb923c")
    s["obsidian"] = obsidian()
    s["bookshelf"] = bookshelf()
    s["ruinwall"] = ruin_wall()
    s["lantern"] = item("Valuables/Lantern_On.png", 1.5)
    s["crate"] = item("Wood/Wood_Crate.png", 1.4)
    s["crate2"] = item("Wood/DarkWood_Crate.png", 1.4)
    s["barrelish"] = item("Wood/Wood_Round.png", 1.3)
    s["logpile"] = item("Wood/Wood_OldLogMoss.png", 1.3)
    s["skull"] = item("AnimalProducts/Skull.png", 1.1, 30)
    s["bones"] = item("AnimalProducts/Bone.png", 1.1, 30)
    s["candle"] = item("AnimalProducts/Candle.png", 1.0, 30)
    for k in (1, 2, 3):
        s[f"mush_glow{k}"] = item(f"Plants/Mushroom_Light{k}.png", 1.4, 28)
        s[f"mush_dark{k}"] = item(f"Plants/Mushroom_Dark{k}.png", 1.4, 28)
    s["big_cave"] = cave_mouth()
    s["big_gate"] = arch(True, 1.0)
    s["big_exit"] = arch(False, 0.9)
    return s
