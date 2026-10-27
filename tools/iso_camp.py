"""
The kingdoms' war camps, drawn in the Ultimate Isometric Pack's style (flat colours, a lighter top-left
facet, a darker right, a thick plum outline) at the pack's own scale, so build-iso-atlas.py packs them
with the rest. Everything stands on a tall 500 x 1000 canvas (tile centre at 250, 639) or a big
1000 x 1000 one (tile centre at 500, 639); flats on the 500 x 500 overlay canvas (tile centre 250, 139).

  * the palisade: sharpened log stakes along either tile axis (and broken, charred ones for a camp
    the Tide has overrun), log watchtowers, the gate's timber frame;
  * cloth that the game tints in its kingdom's colour: tower flags, gate hangings, a banner;
  * barricades: cheval-de-frise, sandbag walls, a spiked ditch;
  * inside: a stone fire pit, log benches, a well, barrels, crates, weapon racks, a notice board, a
    training dummy, torch posts and braziers (the game lights them), and a pegged-out building site.

One tile step along u is (+203, +101.5) source px, along v (-203, +101.5); up is -y.
"""
import math
import random
from PIL import Image, ImageDraw

from iso_extra import OL, W_OL, ROOT, poly, lines, ellipse, mul, tall, big, flat

CX, GY = 250, 639

WOOD = (168, 112, 66, 255)
WOOD_D = (122, 78, 46, 255)
WOOD_L = (198, 142, 86, 255)
CUT = (232, 196, 132, 255)
CHAR = (70, 54, 52, 255)
CHAR_D = (48, 36, 38, 255)
STONE = (160, 150, 160, 255)
IRON = (96, 92, 108, 255)
ROPE = (214, 180, 112, 255)
CLOTH = (244, 240, 236, 255)  # tinted by the game
CLOTH_D = (196, 190, 190, 255)
CANVAS = (226, 208, 166, 255)


def P(u, v, h=0.0, cx=CX, cy=GY):
    """A point u, v tiles from the tile centre, h source px above the ground."""
    return (cx + (u - v) * 203, cy + (u + v) * 101.5 - h)


def outline(d, pts, w=W_OL):
    d.line(list(pts) + [pts[0], pts[1]], fill=OL, width=w, joint="curve")


def stake(d, x, yb, h, r=26, tip=56, light=WOOD_L, dark=WOOD_D, fresh=True, broken=False, rnd=None):
    """A sharpened log standing at (x, yb): a lit left half, a shaded right half, a pale cut point."""
    yt = yb - h
    if broken:
        # snapped: a jagged top instead of a point
        j = [(x - r, yt + 10), (x - r * 0.4, yt - 18), (x + r * 0.1, yt + 6), (x + r * 0.6, yt - 12), (x + r, yt + 14)]
        d.polygon([(x - r, yb), *j[:3], (x + r * 0.1, yb)], fill=light)
        d.polygon([(x + r * 0.1, yb), *j[2:], (x + r, yb)], fill=dark)
        sil = [(x - r, yb + 6), *j, (x + r, yb + 6)]
        d.line([(x - r * 0.5, yt + 8), (x + r * 0.5, yt + 2)], fill=CHAR_D, width=6)
        outline(d, sil)
        return
    top = (x, yt - tip)
    d.polygon([(x - r, yb), (x - r, yt), (x, yt), (x, yb)], fill=light)
    d.polygon([(x, yb), (x, yt), (x + r, yt), (x + r, yb)], fill=dark)
    d.polygon([(x - r, yt), top, (x, yt + 8)], fill=CUT if fresh else mul(light, 1.05))
    d.polygon([(x, yt + 8), top, (x + r, yt)], fill=mul(CUT, 0.8) if fresh else dark)
    # grain
    d.line([(x - r * 0.45, yb - 20), (x - r * 0.45, yt + 30)], fill=mul(light, 0.85), width=5)
    d.line([(x + r * 0.5, yb - 40), (x + r * 0.5, yt + 50)], fill=mul(dark, 0.85), width=5)
    outline(d, [(x - r, yb + 6), (x - r, yt), top, (x + r, yt), (x + r, yb + 6)])


def berm(d, a, b, cx=CX, cy=GY, color=(118, 86, 62, 255)):
    """A low bank of earth along the base of a wall, from point a to point b (tile coords)."""
    (u0, v0), (u1, v1) = a, b
    n = 6
    for k in range(n + 1):
        t = k / n
        x, y = P(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, 0, cx, cy)
        d.ellipse([x - 44, y - 16, x + 44, y + 18], fill=color)


def wall(axis, ruin=False, seed=0):
    """Four stakes along one tile (axis 'u' runs down-right on screen, 'v' down-left), tied with rope."""
    im, d = tall()
    rnd = random.Random(seed * 7 + (1 if axis == "u" else 2) + (50 if ruin else 0))
    pts = [(-0.5, 0), (0.5, 0)] if axis == "u" else [(0, -0.5), (0, 0.5)]
    berm(d, pts[0], pts[1], color=(96, 70, 52, 255) if ruin else (118, 86, 62, 255))
    tops = []
    for t in (-0.375, -0.125, 0.125, 0.375):
        u, v = (t, 0) if axis == "u" else (0, t)
        x, y = P(u, v)
        h = 270 + rnd.randint(-18, 18)
        tops.append((x, y, h))
    # rope lashing behind the front faces: one line along the row at two heights (drawn before the stakes)
    for k, (x, y, h) in enumerate(tops):
        if ruin:
            fate = rnd.random()
            if fate < 0.25:
                continue  # gone
            if fate < 0.6:
                stake(d, x, y, h * rnd.uniform(0.35, 0.6), light=CHAR, dark=CHAR_D, broken=True)
                continue
            stake(d, x, y, h, light=mul(WOOD_L, 0.62), dark=mul(WOOD_D, 0.6), fresh=False)
            continue
        stake(d, x, y, h, fresh=k % 2 == 0)
    if not ruin:
        for hh in (90, 200):
            a = tops[0][0] - 30, tops[0][1] - hh + (-15 if axis == "u" else 15)
            b = tops[-1][0] + 30, tops[-1][1] - hh + (15 if axis == "u" else -15)
            d.line([a, b], fill=OL, width=17)
            d.line([a, b], fill=ROPE, width=7)
    return im


def tower(ruin=False):
    """A log watchtower: four legs, braces, a plank deck with a rail, a thatched roof (or, ruined, charred legs and a fallen deck)."""
    im, d = tall()
    L, Ld = (WOOD_L, WOOD_D) if not ruin else (CHAR, CHAR_D)
    deck = 300
    legs = [(-0.36, -0.36), (0.36, -0.36), (-0.36, 0.36), (0.36, 0.36)]
    for u, v in legs[:2]:
        x, y = P(u, v)
        stake(d, x, y, deck + 40 if not ruin else deck * (0.5 if u > 0 else 0.8), r=24, tip=20, light=L, dark=Ld, broken=ruin)
    # braces between the front legs (an X under the deck on each visible side)
    for (a, b) in (((-0.36, 0.36), (0.36, 0.36)), ((0.36, -0.36), (0.36, 0.36))):
        pa0, pb1 = P(*a, 30), P(*b, deck - 40)
        pa1, pb0 = P(*a, deck - 40), P(*b, 30)
        if not ruin:
            lines(d, [pa0, pb1], WOOD, 12)
            lines(d, [pb0, pa1], mul(WOOD, 0.9), 12)
    if not ruin:
        # the deck: a slab on the legs with a top face and two front sides
        e = 0.5
        top = [P(-e, -e, deck), P(e, -e, deck), P(e, e, deck), P(-e, e, deck)]
        th = 34
        poly(d, [top[3], top[2], (top[2][0], top[2][1] + th), (top[3][0], top[3][1] + th)], (150, 100, 58, 255), 9)
        poly(d, [top[2], top[1], (top[1][0], top[1][1] + th), (top[2][0], top[2][1] + th)], (116, 74, 44, 255), 9)
        poly(d, top, (196, 146, 92, 255), 9)
        for k in range(1, 5):
            t = -e + k * 0.2
            d.line([P(t, -e, deck), P(t, e, deck)], fill=(150, 104, 62, 255), width=5)
        # a brazier on the deck (the game lights it), then the front legs, the rail
        bx, by = P(0, 0, deck)
        d.polygon([(bx - 40, by - 40), (bx + 40, by - 40), (bx + 26, by - 6), (bx - 26, by - 6)], fill=IRON, outline=OL)
        d.line([(bx - 40, by - 40), (bx + 40, by - 40)], fill=OL, width=9)
        d.ellipse([bx - 30, by - 50, bx + 30, by - 32], fill=(255, 120, 50, 255))
    for u, v in legs[2:]:
        x, y = P(u, v)
        stake(d, x, y, deck + 140 if not ruin else deck * (0.65 if u < 0 else 0.35), r=24, tip=20, light=L, dark=Ld, broken=ruin)
    if ruin:
        # the deck fallen in, planks askew, scorched
        lines(d, [P(-0.5, -0.2, 120), P(0.4, 0.3, 30)], CHAR, 26)
        lines(d, [P(-0.3, 0.5, 60), P(0.5, -0.1, 150)], mul(CHAR, 1.2), 22)
        lines(d, [P(-0.4, -0.5, 10), P(0.1, 0.45, 10)], CHAR_D, 18)
        return im
    rail = deck + 90
    for (a, b) in (((-0.5, 0.5), (0.5, 0.5)), ((0.5, -0.5), (0.5, 0.5))):
        lines(d, [P(*a, rail), P(*b, rail)], WOOD_L, 14)
    lines(d, [P(-0.5, -0.5, rail), P(-0.5, 0.5, rail)], WOOD, 12)
    # the roof: four posts up to a thatched pyramid
    for u, v in ((-0.36, 0.36), (0.36, 0.36), (0.36, -0.36)):
        lines(d, [P(u, v, deck + 140), P(u, v, deck + 165)], WOOD, 14)
    eave, apex = deck + 165, deck + 255
    o = 0.62
    a = P(0, 0, apex)
    poly(d, [P(-o, o, eave), P(o, o, eave), a], (214, 170, 90, 255))
    poly(d, [P(o, o, eave), P(o, -o, eave), a], (168, 124, 62, 255))
    for k in range(1, 4):
        t = k / 4
        d.line([P(-o + 2 * o * t, o, eave), a], fill=(186, 142, 74, 255), width=5)
        d.line([P(o, o - 2 * o * t, eave), a], fill=(140, 100, 50, 255), width=5)
    # a flag pole on the apex (the cloth is camp_tower_flag)
    lines(d, [a, (a[0], a[1] - 80)], WOOD_D, 9)
    ellipse(d, [a[0] - 11, a[1] - 96, a[0] + 11, a[1] - 74], (240, 200, 90, 255), 6)
    return im


def tower_flag():
    """The flag on a tower's apex pole, near-white so the game tints it in the kingdom's colour."""
    im, d = tall()
    deck = 300
    ax, ay = P(0, 0, deck + 255)
    x0, y0 = ax + 6, ay - 74
    pts = [(x0, y0), (x0 + 110, y0 + 8), (x0 + 88, y0 + 28), (x0 + 112, y0 + 50), (x0, y0 + 54)]
    poly(d, pts, CLOTH, 8)
    d.polygon([(x0 + 46, y0 + 6), (x0 + 68, y0 + 8), (x0 + 64, y0 + 48), (x0 + 44, y0 + 52)], fill=CLOTH_D)
    return im


def gate(ruin=False):
    """The gate's timber frame: two great posts, a doubled lintel, a sign board, spikes on top."""
    im, d = big()
    cx, cy = 500, GY
    L, Ld = (WOOD_L, WOOD_D) if not ruin else (CHAR, CHAR_D)
    s = 1.38
    for u in (-s, s):
        x, y = P(u, 0, 0, cx, cy)
        stake(d, x, y, 440 if not ruin else (300 if u < 0 else 170), r=34, tip=36, light=L, dark=Ld, broken=ruin)
    if ruin:
        lines(d, [P(-s, 0, 290, cx, cy), P(s * 0.6, 0, 20, cx, cy)], CHAR, 30)
        return im
    for h, w in ((420, 34), (350, 24)):
        lines(d, [P(-s - 0.12, 0, h, cx, cy), P(s + 0.12, 0, h, cx, cy)], WOOD if h < 400 else WOOD_L, w)
    # short sharpened stakes along the top of the lintel
    for k in range(9):
        t = -s + 0.15 + k * (2 * s - 0.3) / 8
        x, y = P(t, 0, 436, cx, cy)
        stake(d, x, y, 40, r=14, tip=34)
    # the sign board, hung on two chains
    a, b = P(-0.55, 0, 340, cx, cy), P(0.55, 0, 340, cx, cy)
    for p in (a, b):
        d.line([p, (p[0], p[1] + 34)], fill=IRON, width=6)
    q = [(a[0], a[1] + 30), (b[0], b[1] + 30), (b[0], b[1] + 110), (a[0], a[1] + 110)]
    poly(d, q, (190, 136, 80, 255), 10)
    d.line([(q[0][0] + 10, q[0][1] + 40), (q[1][0] - 10, q[1][1] + 40)], fill=(150, 104, 62, 255), width=5)
    # a carved crest: crossed swords over a shield
    mx, my = (q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2
    d.line([(mx - 50, my - 24), (mx + 50, my + 24)], fill=(70, 46, 34, 255), width=9)
    d.line([(mx - 50, my + 24), (mx + 50, my - 24)], fill=(70, 46, 34, 255), width=9)
    d.polygon([(mx - 22, my - 22), (mx + 22, my - 22), (mx + 18, my + 10), (mx, my + 26), (mx - 18, my + 10)], fill=(232, 196, 120, 255), outline=OL)
    return im


def gate_flags():
    """Two long hangings from the gate's lintel (tinted by the game)."""
    im, d = big()
    for u in (-1.0, 1.0):
        x, y = P(u, 0, 400, 500, GY)
        w = 46
        top = y + 14
        sk = 23 if u > 0 else 23  # the lintel runs down-right: the cloth's top follows it
        pts = [(x - w, top - sk), (x + w, top + sk), (x + w, top + sk + 190), (x, top + 160), (x - w, top - sk + 190)]
        poly(d, pts, CLOTH, 9)
        d.polygon([(x - 8, top - 4), (x + 12, top + 6), (x + 12, top + 170), (x - 8, top + 166)], fill=CLOTH_D)
        ellipse(d, [x - 26, top + 50, x + 26, top + 100], (255, 236, 160, 255), 7)
    return im


def banner_pole():
    im, d = tall()
    x, y = P(0, 0)
    d.ellipse([x - 40, y - 14, x + 40, y + 16], fill=(90, 80, 84, 255))
    stake(d, x, y, 420, r=12, tip=10, light=WOOD_L, dark=WOOD_D)
    lines(d, [(x - 8, y - 400), (x + 120, y - 400)], WOOD_D, 9)
    ellipse(d, [x - 14, y - 452, x + 14, y - 424], (240, 200, 90, 255), 6)
    return im


def banner_cloth():
    im, d = tall()
    x, y = P(0, 0)
    x0, y0 = x + 14, y - 396
    pts = [(x0, y0), (x0 + 104, y0), (x0 + 104, y0 + 190), (x0 + 52, y0 + 160), (x0, y0 + 190)]
    poly(d, pts, CLOTH, 9)
    d.polygon([(x0 + 64, y0 + 6), (x0 + 98, y0 + 6), (x0 + 98, y0 + 176), (x0 + 64, y0 + 158)], fill=CLOTH_D)
    ellipse(d, [x0 + 26, y0 + 50, x0 + 78, y0 + 102], (255, 236, 160, 255), 7)
    return im


def cheval(axis):
    """Cheval-de-frise: a log along the axis bristling with crossed sharpened stakes."""
    im, d = tall()
    along = (lambda t, s, h: P(t, s, h)) if axis == "u" else (lambda t, s, h: P(s, t, h))
    ts = (-0.36, 0, 0.36)
    def x_pair(t, front):
        # one stake leans across the log toward the viewer, one away
        a = along(t, -0.42, 150) if front else along(t, 0.42, 150)
        b = along(t, 0.32, 0) if front else along(t, -0.32, 0)
        lines(d, [b, a], WOOD if front else WOOD_D, 20)
        # pale sharpened point
        dx, dy = a[0] - b[0], a[1] - b[1]
        n = math.hypot(dx, dy)
        tip = (a[0] + dx / n * 30, a[1] + dy / n * 30)
        d.line([a, tip], fill=OL, width=20)
        d.line([a, (a[0] + dx / n * 22, a[1] + dy / n * 22)], fill=CUT, width=9)
    for t in ts:
        x_pair(t, False)
    lines(d, [along(-0.5, 0, 70), along(0.5, 0, 70)], WOOD_L, 34)
    e = along(0.5, 0, 70) if axis == "u" else along(-0.5, 0, 70)
    if axis == "u":
        ellipse(d, [e[0] - 18, e[1] - 22, e[0] + 18, e[1] + 22], CUT, 8)
    for t in ts:
        x_pair(t, True)
    return im


def sandbags(axis):
    im, d = tall()
    along = (lambda t, h: P(t, 0, h)) if axis == "u" else (lambda t, h: P(0, t, h))
    bag = (216, 192, 140, 255)
    for row, (n, h) in enumerate(((5, 0), (4, 40), (3, 80))):
        for k in range(n):
            t = -0.44 + (k + 0.5 + row * 0.5) * (0.88 / 5)
            x, y = along(t, h)
            col = bag if (k + row) % 3 else mul(bag, 0.9)
            ellipse(d, [x - 50, y - 30, x + 50, y + 22], col, 9)
            d.line([(x - 26, y - 14), (x + 18, y - 18)], fill=mul(col, 1.08), width=7)
            d.line([(x + 30, y - 8), (x + 30, y + 10)], fill=mul(col, 0.75), width=5)
    return im


def ditch(axis):
    """A trench along the axis with short stakes in it (a flat overlay)."""
    im, d = flat()
    cy = 139
    along = (lambda t, s: P(t, s, 0, 250, cy)) if axis == "u" else (lambda t, s: P(s, t, 0, 250, cy))
    rim = [along(-0.52, -0.3), along(0.52, -0.3), along(0.52, 0.3), along(-0.52, 0.3)]
    d.polygon(rim, fill=(110, 80, 58, 255))
    pit = [along(-0.52, -0.17), along(0.52, -0.17), along(0.52, 0.17), along(-0.52, 0.17)]
    d.polygon(pit, fill=(46, 28, 30, 255))
    d.line([pit[0], pit[1]], fill=OL, width=8)
    for k in range(5):
        t = -0.4 + k * 0.2
        x, y = along(t, 0.02 * (k % 2))
        d.polygon([(x - 9, y + 8), (x, y - 40), (x + 9, y + 8)], fill=CUT, outline=OL)
    return im


def firepit():
    im, d = tall()
    rx, ry = 120, 60
    rnd = random.Random(4)
    d.ellipse([CX - rx + 10, GY - ry + 6, CX + rx - 10, GY + ry - 6], fill=(40, 30, 34, 255))
    # charred logs crossed in the middle
    lines(d, [P(-0.25, 0, 16), P(0.25, 0, 30)], CHAR, 22)
    lines(d, [P(0, -0.25, 16), P(0, 0.25, 30)], mul(CHAR, 1.2), 22)
    d.ellipse([CX - 30, GY - 30, CX + 30, GY + 4], fill=(255, 140, 60, 255))
    for k in range(14):
        a = k / 14 * math.tau
        x, y = CX + math.cos(a) * rx, GY + math.sin(a) * ry
        r = rnd.randint(22, 28)
        ellipse(d, [x - r, y - r * 0.8 - 6, x + r, y + r * 0.7 - 6], mul(STONE, 1.08 if math.sin(a) < 0.2 else 0.86), 8)
    return im


def bench(axis):
    im, d = tall()
    along = (lambda t, h: P(t, 0, h)) if axis == "u" else (lambda t, h: P(0, t, h))
    for t in (-0.32, 0.32):
        x, y = along(t, 0)
        d.polygon([(x - 18, y + 6), (x - 18, y - 34), (x + 18, y - 34), (x + 18, y + 6)], fill=WOOD_D, outline=OL)
    lines(d, [along(-0.44, 54), along(0.44, 54)], WOOD_L, 38)
    lines(d, [along(-0.4, 66), along(0.4, 66)], mul(WOOD_L, 1.12), 10)
    e = along(0.44, 54) if axis == "u" else along(-0.44, 54)
    ellipse(d, [e[0] - 20, e[1] - 22, e[0] + 20, e[1] + 22], CUT, 8)
    d.ellipse([e[0] - 7, e[1] - 8, e[0] + 7, e[1] + 8], outline=mul(CUT, 0.7), width=4)
    return im


def cylinder(d, x, y, rx, ry, h, side_l, side_r, top, bands=(), staves=0):
    """An upright cylinder standing at (x, y): lit left, shaded right, its top an ellipse."""
    yt = y - h
    d.pieslice([x - rx, y - ry, x + rx, y + ry], 0, 180, fill=side_r)
    d.rectangle([x - rx, yt, x, y], fill=side_l)
    d.rectangle([x, yt, x + rx, y], fill=side_r)
    d.pieslice([x - rx, y - ry, x, y + ry], 90, 180, fill=side_l)
    for k in range(1, staves):
        sx = x - rx + 2 * rx * k / staves
        d.line([(sx, yt + ry * 0.6), (sx, y + ry * 0.4)], fill=mul(side_r if sx > x else side_l, 0.82), width=4)
    for bh in bands:
        d.arc([x - rx, yt + bh - ry, x + rx, yt + bh + ry], 0, 180, fill=IRON, width=12)
    d.line([(x - rx, y), (x - rx, yt)], fill=OL, width=W_OL)
    d.line([(x + rx, y), (x + rx, yt)], fill=OL, width=W_OL)
    d.arc([x - rx, y - ry, x + rx, y + ry], 0, 180, fill=OL, width=W_OL)
    ellipse(d, [x - rx, yt - ry, x + rx, yt + ry], top, 9)


def barrel_at(d, x, y, s=1.0, water=False):
    rx, ry, h = 54 * s, 26 * s, 128 * s
    cylinder(d, x, y, rx, ry, h, (176, 120, 70, 255), (130, 84, 50, 255), (60, 110, 170, 255) if water else (196, 146, 92, 255), bands=(22 * s, h - 26 * s), staves=5)
    if water:
        d.ellipse([x - rx * 0.5, y - h - ry * 0.4, x - rx * 0.1, y - h - ry * 0.1], fill=(170, 220, 250, 255))
    else:
        d.ellipse([x - 8, y - h - 5, x + 8, y - h + 5], fill=(110, 70, 40, 255))


def barrels():
    im, d = tall()
    barrel_at(d, *P(-0.18, -0.2))
    barrel_at(d, *P(0.22, -0.16))
    barrel_at(d, *P(0.02, 0.22), 0.9)
    return im


def water_barrel():
    im, d = tall()
    barrel_at(d, *P(0, 0), 1.05, water=True)
    # a ladle
    x, y = P(0, 0)
    lines(d, [(x + 10, y - 160), (x + 60, y - 210)], WOOD_L, 8)
    return im


def pack(path, scale):
    it = Image.open(ROOT + "PlacebleItems/" + path).convert("RGBA")
    return it.resize((round(it.width * scale), round(it.height * scale)), Image.LANCZOS)


def put(im, it, x, y):
    """Paste a pack item with its bottom centre at (x, y)."""
    im.alpha_composite(it, (int(x - it.width / 2), int(y - it.height)))


def crates():
    im, d = tall()
    c1 = pack("Wood/Wood_Crate.png", 0.85)
    c2 = pack("Wood/DarkWood_Crate.png", 0.8)
    sack = pack("Valuables/Sack.png", 0.8)
    x, y = P(-0.2, -0.2)
    put(im, c1, x, y + 30)
    put(im, c1, x, y + 30 - c1.height * 0.58)
    x2, y2 = P(0.25, -0.1)
    put(im, c2, x2, y2 + 30)
    x3, y3 = P(0.05, 0.3)
    put(im, sack, x3, y3 + 20)
    return im


def rack(axis):
    """A weapon rack: two posts and a rail, spears and a sword leaning on it, shields hung on the front."""
    im, d = tall()
    along = (lambda t, s, h: P(t, s, h)) if axis == "u" else (lambda t, s, h: P(s, t, h))
    for t in (-0.42, 0.42):
        x, y = along(t, 0, 0)
        stake(d, x, y, 220, r=14, tip=12)
    lines(d, [along(-0.48, 0, 190), along(0.48, 0, 190)], WOOD_L, 16)
    lines(d, [along(-0.48, 0, 60), along(0.48, 0, 60)], WOOD, 12)
    rnd = random.Random(9 if axis == "u" else 10)
    for k in range(5):
        t = -0.32 + k * 0.16
        foot = along(t + rnd.uniform(-0.03, 0.03), 0.2, 0)
        top = along(t, -0.05, 300 + rnd.randint(-20, 20))
        lines(d, [foot, top], (140, 96, 56, 255) if k % 2 else (120, 80, 50, 255), 9)
        if k % 2 == 0:
            poly(d, [(top[0] - 13, top[1] + 6), (top[0], top[1] - 50), (top[0] + 13, top[1] + 6)], (200, 204, 216, 255), 7)
        else:
            # an axe head
            poly(d, [(top[0], top[1] + 4), (top[0] + 36, top[1] - 16), (top[0] + 40, top[1] + 30), (top[0], top[1] + 22)], (180, 184, 196, 255), 7)
    for k, name in enumerate(("Metal/Iron_Shield.png", "Metal/Copper_Shield.png")):
        sh = pack(name, 0.62)
        x, y = along(-0.22 + k * 0.44, 0.08, 40)
        put(im, sh, x, y)
    return im


def board():
    """A notice board under a little roof, pinned with papers."""
    im, d = tall()
    for t in (-0.36, 0.36):
        x, y = P(t, 0)
        stake(d, x, y, 300, r=13, tip=10)
    q = [P(-0.42, 0, 270), P(0.42, 0, 270), P(0.42, 0, 110), P(-0.42, 0, 110)]
    poly(d, q, (176, 124, 74, 255), 10)
    for k in range(1, 4):
        h = 110 + k * 40
        d.line([P(-0.4, 0, h), P(0.4, 0, h)], fill=(148, 102, 60, 255), width=5)
    rnd = random.Random(12)
    for (t, h, w, hh) in ((-0.28, 250, 0.16, 70), (-0.06, 236, 0.15, 84), (0.16, 252, 0.17, 60), (0.06, 160, 0.14, 40), (-0.26, 166, 0.12, 44)):
        pts = [P(t, 0, h), P(t + w, 0, h), P(t + w, 0, h - hh), P(t, 0, h - hh)]
        col = rnd.choice([(250, 244, 226, 255), (240, 228, 196, 255), (255, 250, 240, 255)])
        poly(d, pts, col, 6)
        for r in range(2, int(hh / 14)):
            d.line([P(t + 0.02, 0, h - r * 13), P(t + w - 0.03, 0, h - r * 13)], fill=(150, 130, 140, 255), width=4)
        x, y = P(t + w / 2, 0, h - 6)
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(200, 60, 60, 255))
    # a little roof
    a, b = P(-0.52, 0, 300), P(0.52, 0, 300)
    poly(d, [(a[0], a[1] - 40), (b[0], b[1] - 40), (b[0] + 10, b[1] + 6), (a[0] - 10, a[1] + 6)], (150, 70, 52, 255), 9)
    return im


def dummy():
    """A straw training dummy on a post, a target painted on its chest and an arrow in it."""
    im, d = tall()
    x, y = P(0, 0)
    d.ellipse([x - 54, y - 18, x + 54, y + 18], fill=(110, 90, 70, 255))
    stake(d, x, y, 330, r=12, tip=8)
    lines(d, [(x - 92, y - 236), (x + 92, y - 236)], WOOD, 14)
    straw = (214, 170, 92, 255)
    poly(d, [(x - 52, y - 268), (x + 52, y - 268), (x + 60, y - 130), (x + 30, y - 110), (x - 30, y - 110), (x - 60, y - 130)], straw)
    d.polygon([(x + 8, y - 262), (x + 50, y - 262), (x + 56, y - 132), (x + 28, y - 116), (x + 8, y - 118)], fill=mul(straw, 0.84))
    for h in (-240, -150):
        d.line([(x - 54, y + h), (x + 56, y + h + 4)], fill=(132, 86, 50, 255), width=8)
    ellipse(d, [x - 30, y - 222, x + 30, y - 166], (240, 236, 226, 255), 6)
    ellipse(d, [x - 18, y - 206, x + 18, y - 182], (210, 60, 54, 255), 5)
    # the head: a sack with stitched eyes
    ellipse(d, [x - 42, y - 352, x + 42, y - 262], (200, 170, 120, 255))
    for ex in (-16, 16):
        d.line([(x + ex - 8, y - 320), (x + ex + 8, y - 304)], fill=OL, width=6)
        d.line([(x + ex - 8, y - 304), (x + ex + 8, y - 320)], fill=OL, width=6)
    d.line([(x - 22, y - 284), (x + 22, y - 284)], fill=OL, width=5)
    # an arrow stuck in it
    lines(d, [(x + 6, y - 196), (x + 90, y - 236)], (150, 104, 62, 255), 6)
    poly(d, [(x + 86, y - 246), (x + 108, y - 244), (x + 98, y - 226)], (240, 240, 240, 255), 5)
    # straw tufts at its feet
    for k in range(5):
        tx = x - 40 + k * 20
        d.line([(tx, y + 4), (tx + 8 - k * 4, y - 18)], fill=straw, width=5)
    return im


def torch_post():
    """A torch on a post with an iron cup (no flame: the game sets one burning in it)."""
    im, d = tall()
    x, y = P(0, 0)
    d.ellipse([x - 30, y - 10, x + 30, y + 12], fill=(100, 92, 96, 255))
    stake(d, x, y, 250, r=12, tip=6)
    lines(d, [(x - 18, y - 236), (x + 18, y - 236)], IRON, 8)
    d.polygon([(x - 26, y - 280), (x + 26, y - 280), (x + 14, y - 244), (x - 14, y - 244)], fill=IRON, outline=OL)
    d.line([(x - 26, y - 280), (x + 26, y - 280)], fill=OL, width=8)
    d.ellipse([x - 18, y - 290, x + 18, y - 272], fill=(70, 40, 34, 255))
    return im


def brazier():
    """An iron fire-bowl on a tripod, coals glowing in it."""
    im, d = tall()
    x, y = P(0, 0)
    for dx in (-40, 40, 0):
        lines(d, [(x + dx, y + (12 if dx == 0 else 0)), (x + dx * 0.4, y - 120)], IRON, 10)
    poly(d, [(x - 66, y - 160), (x + 66, y - 160), (x + 42, y - 110), (x - 42, y - 110)], (110, 106, 122, 255))
    d.polygon([(x + 8, y - 156), (x + 62, y - 156), (x + 40, y - 114), (x + 8, y - 114)], fill=(80, 76, 92, 255))
    ellipse(d, [x - 62, y - 176, x + 62, y - 146], (60, 34, 34, 255), 8)
    for k in range(7):
        cx_ = x - 40 + k * 13
        d.ellipse([cx_ - 9, y - 172 + (k % 2) * 6, cx_ + 9, y - 158 + (k % 2) * 6], fill=(255, 110 + 20 * (k % 3), 50, 255))
    return im


def well():
    """A round stone well under a little gabled roof, a bucket on its rope."""
    im, d = tall()
    x, y = P(0, 0)
    rx, ry, h = 108, 54, 96
    cylinder(d, x, y, rx, ry, h, (176, 168, 176, 255), (130, 122, 136, 255), (176, 168, 176, 255))
    for row in range(1, 3):
        yy = y - row * 32
        d.arc([x - rx, yy - ry, x + rx, yy + ry], 0, 180, fill=(110, 102, 116, 255), width=5)
    d.ellipse([x - rx + 22, y - h - ry + 14, x + rx - 22, y - h + ry - 14], fill=(40, 70, 110, 255), outline=OL, width=6)
    d.ellipse([x - 30, y - h - 12, x + 4, y - h], fill=(120, 170, 220, 255))
    for s in (-1, 1):
        lines(d, [(x + s * (rx - 8), y - h + 10), (x + s * (rx - 8), y - h - 210)], WOOD, 14)
    lines(d, [(x - rx - 6, y - h - 180), (x + rx + 6, y - h - 180)], WOOD_L, 12)
    d.line([(x + 20, y - h - 180), (x + 20, y - h - 70)], fill=ROPE, width=5)
    buck = pack("FoodAndDrink/Bucket_Water.png", 0.42)
    put(im, buck, x + 20, y - h - 22)
    # the roof
    ap = (x, y - h - 300)
    poly(d, [(x - rx - 40, y - h - 186), ap, (x + 10, y - h - 186)], (172, 80, 58, 255))
    poly(d, [(x + 10, y - h - 186), ap, (x + rx + 40, y - h - 186), (x + rx + 10, y - h - 170), (x + 10, y - h - 170)], (130, 58, 44, 255))
    return im


def build_site():
    """A pegged-out plot: dug earth, four pegs and a string between them, a stack of logs, a sign with a hammer."""
    im, d = tall()
    e = 0.42
    dig = [P(-e, -e), P(e, -e), P(e, e), P(-e, e)]
    d.polygon(dig, fill=(112, 80, 56, 255))
    rnd = random.Random(21)
    for _ in range(14):
        u, v = rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35)
        x, y = P(u, v)
        d.ellipse([x - 12, y - 6, x + 12, y + 6], fill=(140, 104, 72, 255))
    pegs = [P(-e, -e), P(e, -e), P(e, e), P(-e, e)]
    tops = [(x, y - 52) for x, y in pegs]
    for k in range(4):
        a, b = tops[k], tops[(k + 1) % 4]
        d.line([a, b], fill=OL, width=7)
        d.line([a, b], fill=(250, 240, 210, 255), width=3)
    for x, y in pegs:
        stake(d, x, y, 50, r=8, tip=12)
    # the log pile in the back half
    for row, (n, h) in enumerate(((3, 0), (2, 34), (1, 66))):
        for k in range(n):
            t = -0.18 + (k - (n - 1) / 2) * 0.17
            a, b = P(-0.32, t - 0.1, h + 22), P(0.12, t - 0.1, h + 22)
            lines(d, [a, b], WOOD if (k + row) % 2 else WOOD_L, 30)
            ellipse(d, [b[0] - 17, b[1] - 18, b[0] + 17, b[1] + 18], CUT, 7)
    # a sign on a stake at the front corner, a hammer painted on it
    x, y = P(0.3, 0.3)
    stake(d, x, y, 150, r=9, tip=6)
    q = [(x - 56, y - 200), (x + 56, y - 190), (x + 56, y - 120), (x - 56, y - 130)]
    poly(d, q, (206, 156, 96, 255), 8)
    d.line([(x - 22, y - 140), (x + 14, y - 178)], fill=(80, 50, 36, 255), width=8)
    d.polygon([(x + 2, y - 190), (x + 30, y - 166), (x + 20, y - 156), (x - 8, y - 180)], fill=(110, 108, 124, 255), outline=OL)
    return im


def trodden():
    """Packed earth for the paths between tents (a flat overlay)."""
    im, d = flat()
    rnd = random.Random(31)
    base = (116, 84, 60, 255)
    d.polygon([(250, 30), (465, 139), (250, 248), (35, 139)], fill=base)
    for _ in range(22):
        u, v = rnd.uniform(-0.85, 0.85), rnd.uniform(-0.85, 0.85)
        x, y = 250 + (u - v) * 101.5, 139 + (u + v) * 50.75
        r = rnd.uniform(8, 16)
        d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], fill=rnd.choice([(96, 68, 50, 255), (136, 102, 74, 255), (150, 140, 146, 255)]))
    return im


def make():
    s = {}
    s["camp_wall_u"] = wall("u")
    s["camp_wall_v"] = wall("v")
    s["camp_wall_u2"] = wall("u", seed=3)
    s["camp_wall_v2"] = wall("v", seed=3)
    s["camp_wall_u_ruin"] = wall("u", True)
    s["camp_wall_v_ruin"] = wall("v", True)
    s["camp_wall_u_ruin2"] = wall("u", True, 5)
    s["camp_wall_v_ruin2"] = wall("v", True, 5)
    s["camp_tower"] = tower()
    s["camp_tower_ruin"] = tower(True)
    s["camp_tower_flag"] = tower_flag()
    s["camp_gate"] = gate()
    s["camp_gate_ruin"] = gate(True)
    s["camp_gate_flags"] = gate_flags()
    s["camp_banner"] = banner_pole()
    s["camp_banner_cloth"] = banner_cloth()
    s["camp_cheval_u"] = cheval("u")
    s["camp_cheval_v"] = cheval("v")
    s["camp_sandbags_u"] = sandbags("u")
    s["camp_sandbags_v"] = sandbags("v")
    s["camp_ditch_u"] = ditch("u")
    s["camp_ditch_v"] = ditch("v")
    s["camp_firepit"] = firepit()
    s["camp_bench_u"] = bench("u")
    s["camp_bench_v"] = bench("v")
    s["camp_well"] = well()
    s["camp_barrels"] = barrels()
    s["camp_water"] = water_barrel()
    s["camp_crates"] = crates()
    s["camp_rack_u"] = rack("u")
    s["camp_rack_v"] = rack("v")
    s["camp_board"] = board()
    s["camp_dummy"] = dummy()
    s["camp_torch"] = torch_post()
    s["camp_brazier"] = brazier()
    s["camp_site"] = build_site()
    s["camp_trodden"] = trodden()
    return s


if __name__ == "__main__":
    # A contact sheet for checking the art: python3 tools/iso_camp.py out.png
    import sys
    sp = make()
    names = list(sp)
    cols = 8
    cell = 330
    sheet = Image.new("RGBA", (cols * cell, ((len(names) + cols - 1) // cols) * cell), (90, 120, 80, 255))
    dd = ImageDraw.Draw(sheet)
    for k, n in enumerate(names):
        im = sp[n]
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        im.thumbnail((cell - 20, cell - 30))
        sheet.alpha_composite(im, ((k % cols) * cell + 10, (k // cols) * cell + 6))
        dd.text(((k % cols) * cell + 10, (k // cols) * cell + cell - 18), n, fill=(255, 255, 255, 255))
    sheet.save(sys.argv[1] if len(sys.argv) > 1 else "camp_sheet.png")
