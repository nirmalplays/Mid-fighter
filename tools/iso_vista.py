"""
The vistas' pieces (src/game/world/vistas.ts), drawn in the Ultimate Isometric Pack's style (flat colours, a
lighter top-left facet, a darker right, a thick plum outline) at the pack's own scale, so build-iso-atlas.py
packs them with the rest:

  * waterfalls pouring down a six-level cliff face (either visible face, four frames each), the foam and
    mist where they land (three frames), the rills that feed them across the clifftop;
  * aqueduct arches along either tile axis, with water running in their channel;
  * the farmstead: a windmill (its sails turning over six frames), cottages from the Isometric RPG
    Buildings layers, a great oak, sunflowers, the pack's wheat and pumpkins, rail fences, hay bales;
  * the sleeping dragon: scaled hide (a ground cube), its head, its folded wing and the tip of its tail;
  * the open-air archive: a stained-glass window, reading tables, piles of books, lamp posts and
    floating paper lanterns.

Most pieces use the usual canvases (a tall 500 x 1000 or a big 1000 x 1000, tile centre at y 639). Pieces
that rise higher or hang lower name where their tile centre sits instead: make() returns those anchors
(source px from the top) next to the sprites, and the atlas passes them on to the game (ISO_ANCHORS).

One tile step along u is (+203, +101.5) source px, along v (-203, +101.5); one terrace level is 124.4 px.
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from iso_extra import OL, W_OL, ROOT, poly, lines, ellipse, mul, tall, big, flat, on_top, src

GY = 639
LEVEL = 38 / (62 / 203)  # one terrace level in source px
CLIFF = 6  # the levels a waterfall drops (vistas.ts: FALL_H)

WATER = (126, 206, 232, 255)
WATER_L = (196, 238, 250, 255)
WATER_D = (88, 166, 214, 255)
FOAM = (246, 252, 255, 255)
# The same pieces in molten rock, for Pyraxis's Ember Cascade.
LAVA = {"WATER": (255, 122, 44, 255), "WATER_L": (255, 214, 120, 255), "WATER_D": (206, 58, 30, 255), "FOAM": (255, 236, 180, 255), "MIST": (90, 70, 70)}
AQUA = {"WATER": WATER, "WATER_L": WATER_L, "WATER_D": WATER_D, "FOAM": FOAM, "MIST": (250, 254, 255)}
STONE = (176, 166, 160, 255)
STONE_D = (132, 122, 120, 255)
STONE_L = (204, 196, 188, 255)
MOSS = (104, 150, 78, 255)
MOSS_D = (78, 120, 64, 255)
WOOD = (168, 112, 66, 255)
WOOD_D = (122, 78, 46, 255)
WOOD_L = (198, 142, 86, 255)
STRAW = (232, 196, 108, 255)
STRAW_D = (196, 150, 72, 255)


def P(u, v, h=0.0, cx=250, cy=GY):
    """A point u, v tiles from the tile centre (cx, cy), h source px above the ground."""
    return (cx + (u - v) * 203, cy + (u + v) * 101.5 - h)


def canvas(w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def glow(d, x, y, r, color, steps=7, a=30):
    """A soft halo of light: rings of low alpha, widest first (the pack's ladder light)."""
    for k in range(steps, 0, -1):
        rr = r * k / steps
        d.ellipse([x - rr, y - rr * 0.8, x + rr, y + rr * 0.8], fill=color[:3] + (a,))


# ------------------------------------------------------------------ water

def waterfall(frame, pal=AQUA):
    WATER, WATER_L, WATER_D, FOAM = pal["WATER"], pal["WATER_L"], pal["WATER_D"], pal["FOAM"]
    """A sheet of water down the left-front face of a cliff cell CLIFF levels high, its tile centre at (250, 139)."""
    drop = CLIFF * LEVEL
    H = int(139 + 101.5 + drop + 150)
    im, d = canvas(500, H)
    a, b = (47 + 6, 139 + 3), (250 - 6, 240.5 - 3)  # the face's top edge, a little in from the corners
    low = drop + 120  # past the foot of the cliff, under the water (which hides the end)
    sheet = [a, b, (b[0], b[1] + low), (a[0], a[1] + low)]
    d.polygon(sheet, fill=WATER)
    # bands of light and shade running down the sheet, each frame a quarter period further on
    rnd = random.Random(11)
    period = 230
    shift = frame * period / 4
    for n in range(15):
        t = (n + 0.5) / 15 + rnd.uniform(-0.02, 0.02)
        x = a[0] + (b[0] - a[0]) * t
        y0 = a[1] + (b[1] - a[1]) * t
        col = WATER_L if n % 3 != 1 else WATER_D
        w = rnd.randint(7, 13) if col == WATER_L else rnd.randint(9, 15)
        start = rnd.uniform(0, period)
        length = rnd.uniform(70, 150)
        k = -2
        while True:
            top = y0 + start + shift + k * period
            if top > y0 + low:
                break
            s, e = max(top, y0 + 4), min(top + length, y0 + low)
            if e > s:
                d.line([(x, s), (x, e)], fill=col, width=w)
            k += 1
    # the curl of water over the lip, on the clifftop
    lip_in = (101.5 * 0.16, -50.75 * 0.16)  # toward the tile centre from that edge
    lip = [(a[0], a[1]), (b[0], b[1]), (b[0] + lip_in[0], b[1] + lip_in[1]), (a[0] + lip_in[0], a[1] + lip_in[1])]
    d.polygon(lip, fill=WATER_L)
    d.line([(a[0] + 4, a[1] + 8), (b[0] - 4, b[1] + 8)], fill=FOAM, width=9)
    # spray along the edges, and the outline down both sides
    for (x, y) in (a, b):
        for k in range(6):
            yy = y + 60 + k * (drop / 6) + (frame * 23 + k * 37) % 40
            d.ellipse([x - 9, yy - 9, x + 9, yy + 9], fill=FOAM)
    d.line([a, (a[0], a[1] + low)], fill=OL, width=7)
    d.line([b, (b[0], b[1] + low)], fill=OL, width=7)
    d.line([(a[0] + lip_in[0], a[1] + lip_in[1]), (b[0] + lip_in[0], b[1] + lip_in[1])], fill=OL, width=7)
    return im


def foam(frame, pal=AQUA):
    FOAM = pal["FOAM"]
    """Where a fall lands: churned water and mist along the water cell's upper-right edge (tall canvas)."""
    im, d = tall()
    rnd = random.Random(31 + frame)
    sink = 50  # the water's surface sits below a ground tile's top
    x0, y0, x1, y1 = 250, GY - 101.5 + sink, 453, GY + sink
    # mist: soft white rising off the pool
    for k in range(10):
        t = rnd.uniform(0, 1)
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        r = rnd.uniform(40, 80)
        lift = rnd.uniform(30, 140) + frame * 12
        d.ellipse([x - r, y - lift - r * 0.7, x + r, y - lift + r * 0.7], fill=pal["MIST"] + (70,))
    # the churn: a band of white bubbles along the edge
    for k in range(16):
        t = (k + rnd.uniform(-0.3, 0.3)) / 15
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        r = rnd.uniform(16, 30) * (1.0 if (k + frame) % 3 else 1.25)
        ellipse(d, [x - r, y - r * 0.65 + 8, x + r, y + r * 0.65 + 8], FOAM, 6)
    # rings spreading out into the pool
    for k in range(3):
        t = (k + 0.5) / 3
        x, y = x0 + (x1 - x0) * t - 40 - frame * 10, y0 + (y1 - y0) * t + 30 + frame * 6
        r = 34 + frame * 12
        d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], outline=FOAM[:3] + (200,), width=6)
    return im


def rill(axis, pal=AQUA):
    WATER, WATER_L, WATER_D = pal["WATER"], pal["WATER_L"], pal["WATER_D"]
    """A brook across a clifftop toward the lip (a flat), running along u or v."""
    im, d = flat()
    pts = []
    for k in range(13):
        t = -1.05 + k * 2.1 / 12
        w = 0.1 * math.sin(k * 1.3)
        pts.append(on_top(t, w) if axis == "u" else on_top(w, t))
    d.line(pts, fill=OL, width=96, joint="curve")
    d.line(pts, fill=WATER_D, width=80, joint="curve")
    d.line(pts, fill=WATER, width=56, joint="curve")
    for k in range(1, 12, 3):
        a, b = pts[k], pts[k + 1]
        d.line([a, b], fill=WATER_L, width=12)
    return im


# ------------------------------------------------------------------ aqueduct

def arch_u():
    """One span of an aqueduct along u: a pier at each end, an arch between, water in a channel on top."""
    im, d = tall()
    t, top = 0.17, 300.0
    front = [P(-0.5, t, 0), P(0.5, t, 0), P(0.5, t, top), P(-0.5, t, top)]
    side = [P(0.5, t, 0), P(0.5, -t, 0), P(0.5, -t, top), P(0.5, t, top)]
    deck = [P(-0.5, -t, top), P(0.5, -t, top), P(0.5, t, top), P(-0.5, t, top)]
    d.polygon(front, fill=STONE)
    d.polygon(side, fill=STONE_D)
    # courses of stone on the face
    for z in range(40, int(top), 52):
        d.line([P(-0.5, t, z), P(0.5, t, z)], fill=mul(STONE, 0.84), width=6)
    # the arch: see-through where the front and back openings overlap, the inside of the vault elsewhere
    def opening(tt):
        pts = [P(-0.3, tt, 0), P(-0.3, tt, 150)]
        for k in range(11):
            ang = math.pi - k * math.pi / 10
            pts.append(P(0.3 * math.cos(ang), tt, 150 + 70 * math.sin(ang)))
        pts += [P(0.3, tt, 150), P(0.3, tt, 0)]
        return pts
    d.polygon(opening(t), fill=mul(STONE_D, 0.8))
    m1 = Image.new("L", im.size, 0)
    ImageDraw.Draw(m1).polygon(opening(t), fill=255)
    m2 = Image.new("L", im.size, 0)
    ImageDraw.Draw(m2).polygon(opening(-t), fill=255)
    hole = np.minimum(np.array(m1), np.array(m2)) > 0
    arr = np.array(im)
    arr[hole] = 0
    im = Image.fromarray(arr)
    d = ImageDraw.Draw(im)
    d.line(opening(t), fill=OL, width=W_OL, joint="curve")
    # the deck: the channel of water, a mossy rim
    d.polygon(deck, fill=STONE_L)
    d.polygon([P(-0.5, -t * 0.45, top), P(0.5, -t * 0.45, top), P(0.5, t * 0.45, top), P(-0.5, t * 0.45, top)], fill=WATER)
    d.line([P(-0.4, 0, top), P(-0.1, 0, top)], fill=WATER_L, width=6)
    d.line([P(0.15, 0, top), P(0.4, 0, top)], fill=WATER_L, width=6)
    rnd = random.Random(5)
    for k in range(7):
        s = -0.45 + k * 0.15
        x, y = P(s, t, top)
        r = rnd.uniform(14, 24)
        d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.7], fill=MOSS if k % 2 else MOSS_D)
        if k % 3 == 1:  # ivy hanging down the face
            lines(d, [(x, y), (x + 4, y + rnd.uniform(60, 120))], MOSS_D, 7)
    d.line(front + [front[0]], fill=OL, width=W_OL, joint="curve")
    d.line(side + [side[0]], fill=OL, width=W_OL, joint="curve")
    d.line(deck + [deck[0]], fill=OL, width=W_OL, joint="curve")
    return im


# ------------------------------------------------------------------ farmstead

def windmill(frame):
    """A stone windmill with a thatched cap; its four sails turn 15 degrees a frame (they repeat every 90)."""
    W, H, cx, cy = 900, 1500, 450, 1100
    im, d = canvas(W, H)
    base, roof = 0.0, 560.0
    # the tower: a tapered round of whitewashed stone, lit left, shaded right
    bw, tw = 150, 108
    left = [(cx - bw, cy + 30), (cx, cy + 50), (cx, cy - roof), (cx - tw, cy - roof + 16)]
    right = [(cx, cy + 50), (cx + bw, cy + 30), (cx + tw, cy - roof + 16), (cx, cy - roof)]
    d.polygon(left, fill=(236, 228, 214, 255))
    d.polygon(right, fill=(196, 186, 172, 255))
    for z in range(60, int(roof), 70):
        f = z / roof
        w = bw + (tw - bw) * f
        d.arc([cx - w, cy - z - 22, cx + w, cy - z + 22], 0, 180, fill=(170, 160, 150, 255), width=5)
    d.line(left + [left[0]], fill=OL, width=W_OL)
    d.line([right[0], right[1], right[2], right[3]], fill=OL, width=W_OL)
    # a door and a window
    poly(d, [(cx - 52, cy + 40), (cx - 52, cy - 70), (cx - 26, cy - 98), (cx + 2, cy - 70), (cx + 2, cy + 44)], WOOD_D, 8)
    poly(d, [(cx + 30, cy - 300), (cx + 70, cy - 302), (cx + 70, cy - 250), (cx + 30, cy - 248)], (255, 220, 140, 255), 8)
    # the cap: a thatched cone
    cap = [(cx - tw - 40, cy - roof + 20), (cx, cy - roof - 210), (cx + tw + 40, cy - roof + 20), (cx, cy - roof + 46)]
    d.polygon([cap[0], cap[1], cap[3]], fill=STRAW)
    d.polygon([cap[3], cap[1], cap[2]], fill=STRAW_D)
    for k in range(1, 6):
        t = k / 6
        d.line([(cap[0][0] + (cap[1][0] - cap[0][0]) * t, cap[0][1] + (cap[1][1] - cap[0][1]) * t), (cx, cy - roof + 46 - 256 * t)], fill=mul(STRAW, 0.85), width=5)
    d.line(cap + [cap[0]], fill=OL, width=W_OL)
    # the sails, on a hub at the front of the cap
    hx, hy = cx - 30, cy - roof - 40
    ang0 = math.radians(frame * 15 + 20)
    for k in range(4):
        a = ang0 + k * math.pi / 2
        ca, sa = math.cos(a), math.sin(a)
        nx, ny = -sa, ca
        r0, r1, w = 40, 330, 58
        # the frame (a spar) and the cloth beside it
        spar = [(hx + ca * 10, hy + sa * 10), (hx + ca * r1, hy + sa * r1)]
        cloth = [(hx + ca * r0 + nx * 6, hy + sa * r0 + ny * 6), (hx + ca * r1 + nx * 6, hy + sa * r1 + ny * 6),
                 (hx + ca * r1 + nx * w, hy + sa * r1 + ny * w), (hx + ca * r0 + nx * (w * 0.7), hy + sa * r0 + ny * (w * 0.7))]
        poly(d, cloth, (244, 236, 220, 255), 8)
        for s in range(1, 5):
            rr = r0 + (r1 - r0) * s / 5
            d.line([(hx + ca * rr + nx * 6, hy + sa * rr + ny * 6), (hx + ca * rr + nx * w * 0.95, hy + sa * rr + ny * w * 0.95)], fill=WOOD_D, width=5)
        lines(d, spar, WOOD, 14)
    ellipse(d, [hx - 26, hy - 26, hx + 26, hy + 26], WOOD_D, 8)
    return im, cy


def cottage(walls, roof, wood):
    """A two-by-two cottage from the Isometric RPG Buildings layers, standing on its front cell."""
    R = "src/assets/Isometric_RPG_Buildings (1)/2x2Tile_SmallHouse/"
    layers = ["Layer1_InnerWalls.png", f"Layer2_BackBeam_{wood}.png", f"Layer3_MiddleBeams_{wood}.png", "Layer4_FLoor.png",
              f"Layer5_ClosedDoor_{wood}.png", f"Layer6_OuterWall_{walls}.png", f"Layer7_WoodBeams_{wood}.png",
              f"Layer9_FrontBeam_{wood}.png", f"Layer10_RoofBeams_{wood}.png", f"Layer11_Window_{wood}.png",
              f"Layer12_Roof_{roof}.png", "Layer13_Chimney.png"]
    house = None
    for name in layers:
        layer = Image.open(R + name).convert("RGBA")
        house = layer if house is None else Image.alpha_composite(house, layer)
    # The RPG buildings are drawn larger than the pack: 0.9 brings their floor to two of its tiles.
    k = 0.9
    house = house.resize((round(house.width * k), round(house.height * k)), Image.LANCZOS)
    # The art's front corner (at 0.5, 0.93 of it) is the front cell's bottom corner, 101.5 px below its centre.
    cy = round(house.height * 0.93 - 101.5)
    im, _ = canvas(house.width, house.height)
    im.alpha_composite(house)
    return im, cy


def great_oak():
    """The pack's oak, grown nearly twice as big: a meadow's old landmark tree."""
    s = 1.8
    tree = src("Tiles/Trees/Oak_Spring.png")
    tree = tree.resize((round(tree.width * s), round(tree.height * s)), Image.LANCZOS)
    return tree, round(GY * s)


def sunflower(seed):
    im, d = tall()
    rnd = random.Random(seed)
    for k, (dx, h) in enumerate([(-60, 300), (40, 360), (-10, 250)][: 2 + seed % 2]):
        h *= rnd.uniform(0.9, 1.1)
        x0, top = 250 + dx, GY - h
        lines(d, [(x0, GY + 10), (x0 + 6, top + 30)], (92, 150, 62, 255), 14)
        for side, y in ((-1, GY - h * 0.45), (1, GY - h * 0.65)):
            poly(d, [(x0 + 4, y), (x0 + side * 70, y - 34), (x0 + side * 92, y + 4), (x0 + side * 40, y + 20)], (110, 168, 72, 255), 7)
        cx, cy = x0 + 6, top
        petals = []
        for p in range(24):
            a = p * math.pi / 12
            r = 62 if p % 2 == 0 else 40
            petals.append((cx + math.cos(a) * r, cy + math.sin(a) * r * 0.9))
        poly(d, petals, (252, 204, 48, 255), 8)
        d.polygon(petals[::2], fill=(255, 226, 92, 255))
        ellipse(d, [cx - 30, cy - 27, cx + 30, cy + 27], (120, 72, 40, 255), 7)
        for q in range(6):
            a = q * 1.05
            d.ellipse([cx + math.cos(a) * 14 - 4, cy + math.sin(a) * 12 - 4, cx + math.cos(a) * 14 + 4, cy + math.sin(a) * 12 + 4], fill=(80, 46, 26, 255))
    return im


def fence(axis):
    im, d = tall()
    a, b = (-0.5, 0.0), (0.5, 0.0)
    if axis == "v":
        a, b = (0.0, -0.5), (0.0, 0.5)
    for h in (70, 140):
        lines(d, [P(*a, h), P(*b, h)], WOOD_L, 16)
    for (u, v) in (a, (0, 0), b) if axis == "u" else (a, (0, 0), b):
        x, y = P(u, v)
        poly(d, [(x - 14, y + 8), (x - 14, y - 170), (x, y - 186), (x + 14, y - 170), (x + 14, y + 8)], WOOD, 8)
    return im


def haybale():
    im, d = tall()
    # a round bale lying on its side, its face toward the viewer's left
    poly(d, [(170, GY - 120), (330, GY - 170), (380, GY - 40), (220, GY + 10)], STRAW_D, 9)
    ellipse(d, [120, GY - 140, 250, GY + 20], STRAW, 9)
    for r in (20, 40):
        d.arc([185 - r, GY - 60 - r, 185 + r, GY - 60 + r], 20, 320, fill=STRAW_D, width=6)
    for k in range(3):
        d.line([(200 + k * 50, GY - 130 - k * 14), (250 + k * 50, GY - 4 - k * 14)], fill=mul(STRAW_D, 0.85), width=5)
    return im


# ------------------------------------------------------------------ the sleeping dragon

SCALE = (92, 146, 82, 255)
SCALE_L = (128, 180, 96, 255)
SCALE_D = (62, 104, 66, 255)
BELLY = (226, 214, 150, 255)
HORN = (236, 222, 196, 255)


def scale_cube():
    """A ground cube of dragon hide: overlapping scales on the top and both sides."""
    im, d = canvas(500, 500)
    top = [(250, 37), (453, 139), (250, 241), (47, 139)]
    left = [(47, 139), (250, 241), (250, 489), (47, 388)]
    right = [(250, 241), (453, 139), (453, 388), (250, 489)]
    d.polygon(left, fill=SCALE)
    d.polygon(right, fill=SCALE_D)
    d.polygon(top, fill=SCALE_L)
    def rows(face, col, u_axis, v_axis, o):
        # scales as small arcs on a face parametrised by its corner o and two edge vectors
        for r in range(9):
            for c in range(7):
                s = (c + (0.5 if r % 2 else 0)) / 6.5
                t = r / 8.5
                if s > 1:
                    continue
                x = o[0] + u_axis[0] * s + v_axis[0] * t
                y = o[1] + u_axis[1] * s + v_axis[1] * t
                d.arc([x - 20, y - 14, x + 20, y + 14], 10, 170, fill=col, width=6)
    rows(top, mul(SCALE_L, 0.8), (203, 101.5), (-203, 101.5), (250, 37))
    rows(left, mul(SCALE, 0.78), (203, 101.5), (0, 249), (47, 139))
    rows(right, mul(SCALE_D, 0.75), (203, -101.5), (0, 249), (250, 241))
    for f in (left, right, top):
        d.line(f + [f[0]], fill=OL, width=W_OL, joint="curve")
    return im


def dragon_head():
    """The sleeping dragon's head resting on the ground, snout toward the viewer, eyes shut, smoke curling up."""
    im, d = canvas(1200, 1000)
    cx, cy = 600, 700
    # horns sweeping back and up
    for s in (-1, 1):
        lines(d, [(cx + s * 170, cy - 300), (cx + s * 300, cy - 420), (cx + s * 330, cy - 560)], HORN, 46)
        lines(d, [(cx + s * 120, cy - 330), (cx + s * 180, cy - 470)], mul(HORN, 0.9), 30)
    # neck and skull
    skull = [(cx - 300, cy - 120), (cx - 250, cy - 330), (cx - 110, cy - 420), (cx + 110, cy - 420), (cx + 250, cy - 330), (cx + 300, cy - 120)]
    poly(d, skull + [(cx + 200, cy - 20), (cx - 200, cy - 20)], SCALE)
    d.polygon([(cx, cy - 420), (cx + 110, cy - 420), (cx + 250, cy - 330), (cx + 300, cy - 120), (cx + 200, cy - 20), (cx, cy - 40)], fill=SCALE_D)
    d.line(skull + [(cx + 200, cy - 20), (cx - 200, cy - 20), skull[0]], fill=OL, width=W_OL, joint="curve")
    # cheek frills
    for s in (-1, 1):
        poly(d, [(cx + s * 280, cy - 260), (cx + s * 390, cy - 300), (cx + s * 360, cy - 220), (cx + s * 420, cy - 180), (cx + s * 300, cy - 150)], SCALE_L if s < 0 else SCALE, 9)
    # the snout: a long wedge lying on the ground toward the viewer
    snout = [(cx - 200, cy - 220), (cx + 200, cy - 220), (cx + 170, cy + 120), (cx + 90, cy + 190), (cx - 90, cy + 190), (cx - 170, cy + 120)]
    d.polygon(snout, fill=SCALE_L)
    d.polygon([(cx, cy - 220), (cx + 200, cy - 220), (cx + 170, cy + 120), (cx + 90, cy + 190), (cx, cy + 190)], fill=SCALE)
    # a ridge of plates down the middle of the snout
    for k in range(5):
        y = cy - 190 + k * 70
        poly(d, [(cx - 26, y + 30), (cx, y - 10), (cx + 26, y + 30)], HORN, 7)
    # scales on the snout
    for r in range(4):
        for c in range(-3, 4):
            x, y = cx + c * 48 + (24 if r % 2 else 0), cy - 120 + r * 70
            if abs(x - cx) < 30 or abs(x - cx) > 150:
                continue
            d.arc([x - 22, y - 14, x + 22, y + 14], 10, 170, fill=mul(SCALE, 0.8), width=6)
    d.line(snout + [snout[0]], fill=OL, width=W_OL, joint="curve")
    # the jaw resting on the ground, a fang or two showing
    jaw = [(cx - 150, cy + 150), (cx + 150, cy + 150), (cx + 80, cy + 230), (cx - 80, cy + 230)]
    poly(d, jaw, BELLY)
    for s in (-1, 1):
        poly(d, [(cx + s * 110, cy + 150), (cx + s * 96, cy + 205), (cx + s * 80, cy + 150)], (252, 248, 236, 255), 6)
    # nostrils and the smoke of its breathing
    for s in (-1, 1):
        ellipse(d, [cx + s * 62 - 22, cy + 120, cx + s * 62 + 22, cy + 150], (60, 24, 26, 255), 6)
    for k, (x, y, r) in enumerate([(cx - 100, cy + 40, 34), (cx - 150, cy - 30, 44), (cx - 200, cy - 120, 54)]):
        d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.8], fill=(220, 214, 210, 110 - k * 25))
    # brows and the shut eyes
    for s in (-1, 1):
        poly(d, [(cx + s * 70, cy - 260), (cx + s * 230, cy - 300), (cx + s * 250, cy - 250), (cx + s * 90, cy - 220)], SCALE_D if s > 0 else SCALE, 9)
        d.arc([cx + s * 160 - 60, cy - 250, cx + s * 160 + 60, cy - 190], 10, 170, fill=OL, width=12)
        for q in range(3):
            x = cx + s * (125 + q * 32)
            d.line([(x, cy - 196), (x + s * 6, cy - 176)], fill=OL, width=6)
    return im, cy


def dragon_wing():
    """The folded wing lying over the dragon's back: a membrane between long finger bones."""
    im, d = canvas(1300, 1100)
    cx, cy = 650, 800
    root = (cx + 120, cy - 40)
    tips = [(cx - 520, cy - 120), (cx - 380, cy - 420), (cx - 120, cy - 600), (cx + 200, cy - 640)]
    mem = [root] + tips + [(cx + 360, cy - 380), (cx + 380, cy - 120)]
    d.polygon(mem, fill=(116, 160, 92, 255))
    # scalloped lower edge between the fingers
    for a, b in zip(tips, tips[1:]):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        d.polygon([a, (mx + (root[0] - mx) * 0.18, my + (root[1] - my) * 0.18), b], fill=(92, 134, 80, 255))
    d.polygon([root, tips[-1], (cx + 360, cy - 380), (cx + 380, cy - 120)], fill=(84, 124, 74, 255))
    d.line(mem + [mem[0]], fill=OL, width=W_OL, joint="curve")
    for tp in tips:
        lines(d, [root, tp], SCALE_D, 22)
    lines(d, [(cx + 380, cy - 120), (cx + 200, cy - 640)], SCALE_D, 30)
    poly(d, [(cx + 190, cy - 650), (cx + 230, cy - 720), (cx + 230, cy - 640)], HORN, 7)
    return im, cy


def dragon_tail():
    im, d = tall()
    pts = [(120, GY - 90), (200, GY - 40), (300, GY - 20), (360, GY - 70), (340, GY - 140)]
    for k in range(len(pts) - 1):
        lines(d, [pts[k], pts[k + 1]], SCALE if k % 2 else SCALE_L, int(80 - k * 16))
    tip = pts[-1]
    poly(d, [(tip[0] - 40, tip[1] + 10), (tip[0] - 10, tip[1] - 90), (tip[0] + 60, tip[1] - 40), (tip[0] + 30, tip[1] + 20)], SCALE_D)
    return im


# ------------------------------------------------------------------ the archive

GLASS = [(84, 148, 230, 255), (70, 196, 196, 255), (236, 112, 150, 255), (250, 200, 80, 255), (150, 110, 230, 255)]


def stained_arch():
    """A tall ruined window of the archive, its stained glass still whole and glowing."""
    W, H, cx, cy = 900, 1500, 450, 1260
    im, d = canvas(W, H)
    glow(d, cx, cy - 560, 420, (255, 236, 190), 8, 18)
    half, spring, apex = 260, 760, 1080
    def arch_pts(w, s, a):
        pts = [(cx - w, cy + 20), (cx - w, cy - s)]
        for k in range(1, 12):
            t = k / 12
            ang = t * math.pi / 2
            pts.append((cx - w + w * (1 - math.cos(ang)) * 0.98, cy - s - (a - s) * math.sin(ang)))
        pts.append((cx, cy - a))
        for k in range(11, 0, -1):
            t = k / 12
            ang = t * math.pi / 2
            pts.append((cx + w - w * (1 - math.cos(ang)) * 0.98, cy - s - (a - s) * math.sin(ang)))
        pts += [(cx + w, cy - s), (cx + w, cy + 20)]
        return pts
    poly(d, arch_pts(half + 70, spring, apex + 70), STONE)
    glass = arch_pts(half - 20, spring - 20, apex - 30)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).polygon(glass, fill=255)
    panes = Image.new("RGBA", im.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(panes)
    rnd = random.Random(8)
    for row in range(14):
        for col in range(6):
            x0 = cx - half + col * (2 * half / 6)
            y0 = cy - row * 80
            pd.rectangle([x0, y0 - 80, x0 + 2 * half / 6, y0], fill=rnd.choice(GLASS))
    # a rose in the head of the arch
    rx, ry = cx, cy - spring - 60
    for k in range(8):
        a = k * math.pi / 4
        pd.polygon([(rx, ry), (rx + math.cos(a - 0.3) * 150, ry + math.sin(a - 0.3) * 150), (rx + math.cos(a + 0.3) * 150, ry + math.sin(a + 0.3) * 150)], fill=GLASS[k % len(GLASS)])
    pd.ellipse([rx - 46, ry - 46, rx + 46, ry + 46], fill=(255, 236, 160, 255))
    im.paste(panes, (0, 0), mask)
    d = ImageDraw.Draw(im)
    # the lead between the panes and the stone mullions
    for col in range(1, 6):
        x = cx - half + col * (2 * half / 6)
        d.line([(x, cy + 20), (x, cy - spring - 140)], fill=(60, 50, 64, 255), width=8)
    for row in range(1, 10):
        d.line([(cx - half, cy - row * 80), (cx + half, cy - row * 80)], fill=(60, 50, 64, 255), width=6)
    d.ellipse([rx - 160, ry - 160, rx + 160, ry + 160], outline=STONE_D, width=22)
    d.line(glass, fill=OL, width=W_OL)
    for x in (cx - half / 3, cx + half / 3):
        lines(d, [(x, cy + 20), (x, cy - spring + 40)], STONE_L, 26)
    # ivy over the stone
    for k in range(9):
        x = cx - half - 50 + rnd.uniform(0, 120)
        y = cy - rnd.uniform(200, 900)
        d.ellipse([x - 26, y - 18, x + 26, y + 18], fill=MOSS if k % 2 else MOSS_D)
    # steps at its foot
    poly(d, [(cx - half - 110, cy + 10), (cx + half + 110, cy + 10), (cx + half + 80, cy + 70), (cx - half - 80, cy + 70)], STONE_D, 9)
    return im, cy


def reading_table():
    im, d = tall()
    top = 150
    e = 0.42
    deck = [P(-e, -0.3, top), P(e, -0.3, top), P(e, 0.3, top), P(-e, 0.3, top)]
    for u, v in ((-e + 0.06, 0.3 - 0.06), (e - 0.06, 0.3 - 0.06), (e - 0.06, -0.3 + 0.06)):
        x, y = P(u, v)
        lines(d, [(x, y), (x, y - top)], WOOD_D, 16)
    poly(d, [deck[3], deck[2], (deck[2][0], deck[2][1] + 26), (deck[3][0], deck[3][1] + 26)], WOOD, 8)
    poly(d, [deck[2], deck[1], (deck[1][0], deck[1][1] + 26), (deck[2][0], deck[2][1] + 26)], WOOD_D, 8)
    poly(d, deck, WOOD_L, 8)
    # an open book and a candle
    bx, by = P(-0.1, 0.05, top + 6)
    poly(d, [(bx - 70, by), (bx, by - 20), (bx + 70, by), (bx, by + 22)], (246, 238, 214, 255), 7)
    d.line([(bx, by - 20), (bx, by + 22)], fill=(150, 130, 110, 255), width=4)
    cx, cy = P(0.25, -0.12, top)
    glow(d, cx, cy - 70, 110, (255, 214, 140), 6, 26)
    poly(d, [(cx - 12, cy), (cx - 12, cy - 60), (cx + 12, cy - 60), (cx + 12, cy)], (248, 240, 220, 255), 6)
    poly(d, [(cx, cy - 98), (cx + 12, cy - 72), (cx, cy - 62), (cx - 12, cy - 72)], (255, 190, 70, 255), 5)
    return im


def book_pile(seed):
    im, d = tall()
    rnd = random.Random(seed)
    cols = [(150, 50, 50, 255), (60, 90, 140, 255), (70, 120, 70, 255), (190, 150, 70, 255), (110, 70, 130, 255)]
    for s, (dx, n) in enumerate([(-50, 5), (60, 3)]):
        y = GY + 10
        for k in range(n):
            w, h = rnd.randint(70, 96), rnd.randint(22, 32)
            x = 250 + dx + rnd.randint(-10, 10)
            poly(d, [(x - w, y), (x + w, y), (x + w, y - h), (x - w, y - h)], rnd.choice(cols), 6)
            d.line([(x - w + 8, y - h / 2), (x + w - 8, y - h / 2)], fill=(240, 230, 200, 255), width=4)
            y -= h
    return im


def lamp_post():
    im, d = tall()
    iron = (70, 64, 80, 255)
    lines(d, [(250, GY + 10), (250, GY - 380)], iron, 18)
    lines(d, [(250, GY - 380), (330, GY - 400), (330, GY - 360)], iron, 10)
    glow(d, 330, GY - 320, 140, (255, 210, 130), 7, 26)
    poly(d, [(306, GY - 360), (354, GY - 360), (364, GY - 290), (296, GY - 290)], (255, 214, 120, 255), 8)
    poly(d, [(300, GY - 366), (360, GY - 366), (330, GY - 392)], iron, 6)
    ellipse(d, [226, GY - 4, 274, GY + 18], iron, 6)
    return im


def float_lantern(seed):
    """A paper lantern drifting well above the ground (the game bobs it)."""
    im, d = tall()
    rnd = random.Random(seed)
    x, y = 250 + rnd.randint(-40, 40), GY - rnd.randint(380, 520)
    glow(d, x, y, 120, (255, 190, 110), 7, 30)
    body = [(x - 34, y - 40), (x + 34, y - 40), (x + 42, y + 26), (x - 42, y + 26)]
    poly(d, body, (255, 170, 80, 255) if seed % 2 else (255, 204, 110, 255), 7)
    d.line([(x - 30, y - 8), (x + 30, y - 8)], fill=(214, 110, 50, 255), width=5)
    poly(d, [(x - 20, y + 26), (x + 20, y + 26), (x + 14, y + 40), (x - 14, y + 40)], (120, 70, 50, 255), 6)
    return im


def golden(im):
    """The pack's wheat is a dusky purple; ripen it to gold (its outline kept)."""
    a = np.array(im).astype(np.float32)
    lum = a[:, :, :3].mean(axis=2)
    ripe = (lum > 70) & (a[:, :, 3] > 0)
    for ch, (base, k) in enumerate(((70, 0.95), (48, 0.78), (10, 0.32))):
        a[:, :, ch] = np.where(ripe, np.minimum(255, base + lum * k), a[:, :, ch])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ------------------------------------------------------------------ the pack

def make():
    s, anchors = {}, {}
    for f in range(4):
        fall = waterfall(f)
        s[f"fall_l_f{f + 1}"] = fall
        s[f"fall_r_f{f + 1}"] = ImageOps.mirror(fall)
        anchors[f"fall_l_f{f + 1}"] = anchors[f"fall_r_f{f + 1}"] = 139
        lava = waterfall(f, LAVA)
        s[f"lfall_l_f{f + 1}"] = lava
        s[f"lfall_r_f{f + 1}"] = ImageOps.mirror(lava)
        anchors[f"lfall_l_f{f + 1}"] = anchors[f"lfall_r_f{f + 1}"] = 139
    for f in range(3):
        for pre, pal in (("", AQUA), ("l", LAVA)):
            fm = foam(f, pal)
            s[f"{pre}foam_l_f{f + 1}"] = fm
            s[f"{pre}foam_r_f{f + 1}"] = ImageOps.mirror(fm)
    s["rill_u"] = rill("u")
    s["rill_v"] = rill("v")
    s["lrill_u"] = rill("u", LAVA)
    s["lrill_v"] = rill("v", LAVA)
    au = arch_u()
    s["arch_u"] = au
    s["arch_v"] = ImageOps.mirror(au)
    for f in range(6):
        im, cy = windmill(f)
        s[f"windmill_f{f + 1}"] = im
        anchors[f"windmill_f{f + 1}"] = cy
    for name, walls, roof, wood in (("cottage_a", "PaintedCream", "Straw", "Wood"), ("cottage_b", "PaintedSky", "Clay", "DarkWood"),
                                    ("cottage_c", "ClayBricks", "GrassPinkFlowers", "LightWood")):
        im, cy = cottage(walls, roof, wood)
        s[name] = im
        anchors[name] = cy
    im, cy = great_oak()
    s["great_oak"] = im
    anchors["great_oak"] = cy
    s["sunflower1"] = sunflower(1)
    s["sunflower2"] = sunflower(2)
    s["wheat"] = golden(src("Tiles/Crops/Wheet_Stage2.png"))
    s["pumpkin"] = src("Tiles/Crops/Pumpkin_Stage2.png")
    s["fence_u"] = fence("u")
    s["fence_v"] = fence("v")
    s["haybale"] = haybale()
    s["scales"] = scale_cube()
    im, cy = dragon_head()
    k = 1.7  # it should dwarf the cottages beside it
    s["dragon_head"] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    anchors["dragon_head"] = cy * k
    im, cy = dragon_wing()
    s["dragon_wing"] = im
    anchors["dragon_wing"] = cy
    s["dragon_tail"] = dragon_tail()
    im, cy = stained_arch()
    s["stained_arch"] = im
    anchors["stained_arch"] = cy
    s["reading_table"] = reading_table()
    s["books1"] = book_pile(1)
    s["books2"] = book_pile(2)
    s["lamp_post"] = lamp_post()
    for k in (1, 2, 3):
        s[f"float_lantern{k}"] = float_lantern(k)
    return s, anchors
