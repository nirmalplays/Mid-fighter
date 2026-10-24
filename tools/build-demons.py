"""
The story's bosses and demons, drawn from scratch (no pack art): every one is a puppet of simple 3D
parts (balls, tapered limbs, flat plates) posed per frame, turned to the five facings the game uses
(front, three-quarter front, side, three-quarter back, back; the game mirrors the other three) and
drawn back to front at twice the size in the art's style: a thick plum outline round every part,
two-tone cel shading lit from the top left, and glowing eyes, runes and cores. Each gets a move,
an attack and a die sheet (the die dissolves into embers), like the pack's enemies.

    python tools/build-demons.py            # every demon
    python tools/build-demons.py d_ignis    # just these

Writes public/images/world/enemy/<kind>-<move|attack|die>.png, src/game/world/demonAtlas.ts, and a
portrait for the cinematic's dialogue: public/images/world/npc/<kind>-portrait.png.
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'images', 'world', 'enemy')
NPC_OUT = os.path.join(ROOT, 'public', 'images', 'world', 'npc')
CELL = 224
SS = 2
CX, GY = 112, 204
OUTLINE = (52, 1, 41)
OW = 3.6
PITCH = 0.42
YAWS = [0, math.pi / 4, math.pi / 2, 3 * math.pi / 4, math.pi]
FRAMES = {'move': 6, 'attack': 6, 'die': 6}


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def mul(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ------------------------------------------------------------------ parts

class Part:
    """One piece of a puppet: kind 'ball' | 'cap' | 'poly'; points in model space (x side, y up, z forward)."""

    def __init__(self, kind, pts, r=None, col=(200, 200, 200), glow=False, n=None, bias=0.0, outline=True, shade=True):
        self.kind, self.pts, self.r, self.col, self.glow, self.n, self.bias = kind, pts, r, col, glow, n, bias
        self.outline = outline and not glow
        self.shade = shade and not glow


def ball(c, rx, ry=None, col=(200, 200, 200), **k):
    return Part('ball', [c], (rx, ry if ry is not None else rx), col, **k)


def cap(a, b, ra, rb=None, col=(200, 200, 200), **k):
    return Part('cap', [a, b], (ra, rb if rb is not None else ra), col, **k)


def poly(pts, col=(200, 200, 200), **k):
    return Part('poly', pts, None, col, **k)


def add(p, d):
    return (p[0] + d[0], p[1] + d[1], p[2] + d[2])


class View:
    """Model space to the cell: turn by yaw, tilt the camera down by PITCH."""

    def __init__(self, yaw, pose):
        self.c, self.s = math.cos(yaw), math.sin(yaw)
        self.pose = pose  # (fall angle, sink, forward shift)

    def world(self, p):
        x, y, z = p
        fall, sink, fwd = self.pose
        z += fwd
        if fall:
            # Topple backwards about the feet.
            c, s = math.cos(fall), math.sin(fall)
            y, z = y * c + z * s, z * c - y * s
        y -= sink
        wx = x * self.c - z * self.s
        wz = x * self.s + z * self.c
        return wx, y, wz

    def screen(self, p):
        wx, y, wz = self.world(p)
        return (CX + wx) * SS, (GY - y * math.cos(PITCH) + wz * math.sin(PITCH)) * SS, wz * math.cos(PITCH) + y * math.sin(PITCH)

    def facing(self, n):
        nx, ny, nz = n
        wz = nx * self.s + nz * self.c
        return wz * math.cos(PITCH) + ny * math.sin(PITCH)


def draw_shape(dr, part, pts2, grow, fill, dx=0.0, dy=0.0, k=1.0):
    """Draw a part (its projected points) grown by `grow` px, shifted, its size scaled by k."""
    if part.kind == 'ball':
        x, y = pts2[0]
        rx, ry = part.r[0] * SS * k + grow, part.r[1] * SS * k + grow
        dr.ellipse([x + dx - rx, y + dy - ry, x + dx + rx, y + dy + ry], fill=fill)
    elif part.kind == 'cap':
        (ax, ay), (bx, by) = pts2
        ra, rb = part.r[0] * SS * k + grow, part.r[1] * SS * k + grow
        ax, ay, bx, by = ax + dx, ay + dy, bx + dx, by + dy
        L = math.hypot(bx - ax, by - ay)
        if L > 0.5:
            nx, ny = -(by - ay) / L, (bx - ax) / L
            dr.polygon([(ax + nx * ra, ay + ny * ra), (bx + nx * rb, by + ny * rb), (bx - nx * rb, by - ny * rb), (ax - nx * ra, ay - ny * ra)], fill=fill)
        dr.ellipse([ax - ra, ay - ra, ax + ra, ay + ra], fill=fill)
        dr.ellipse([bx - rb, by - rb, bx + rb, by + rb], fill=fill)
    else:
        cx = sum(p[0] for p in pts2) / len(pts2)
        cy = sum(p[1] for p in pts2) / len(pts2)
        pp = [(cx + (x - cx) * k + dx, cy + (y - cy) * k + dy) for x, y in pts2]
        if len(pp) >= 3:
            dr.polygon(pp, fill=fill)
        if grow > 0:
            for i in range(len(pp)):
                a, b = pp[i], pp[(i + 1) % len(pp)]
                dr.line([a, b], fill=fill, width=int(grow * 2))
                dr.ellipse([a[0] - grow, a[1] - grow, a[0] + grow, a[1] + grow], fill=fill)


def render(parts, yaw, pose=(0, 0, 0)):
    v = View(yaw, pose)
    W = CELL * SS
    canvas = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    glow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    items = []
    for p in parts:
        if p.n is not None and v.facing(p.n) < -0.08:
            continue
        sp = [v.screen(q) for q in p.pts]
        depth = sum(s[2] for s in sp) / len(sp) + p.bias
        items.append((depth, p, [(s[0], s[1]) for s in sp]))
    items.sort(key=lambda t: t[0])
    ow = OW * SS
    for _, p, pts2 in items:
        if p.outline:
            mo = Image.new('L', (W, W), 0)
            draw_shape(ImageDraw.Draw(mo), p, pts2, ow, 255)
            canvas.paste(OUTLINE + (255,), (0, 0), mo)
        mf = Image.new('L', (W, W), 0)
        draw_shape(ImageDraw.Draw(mf), p, pts2, 0, 255)
        if p.glow:
            core = mix(p.col, (255, 255, 255), 0.55)
            layer = Image.new('RGBA', (W, W), p.col + (255,))
            ImageDraw.Draw(layer)
            ld = ImageDraw.Draw(layer)
            draw_shape(ld, p, pts2, 0, core + (255,), k=0.55)
            canvas.paste(layer, (0, 0), mf)
            draw_shape(gd, p, pts2, 6 * SS, p.col + (150,))
            continue
        if p.shade:
            dark = mul(p.col, 0.6)
            light = mix(p.col, (255, 248, 230), 0.35)
            layer = Image.new('RGBA', (W, W), dark + (255,))
            ld = ImageDraw.Draw(layer)
            size = 1.0
            if p.kind == 'ball':
                size = max(p.r) * SS
            elif p.kind == 'cap':
                size = max(p.r) * SS
            else:
                ys = [q[1] for q in pts2]
                size = (max(ys) - min(ys)) * 0.5 + 1
            draw_shape(ld, p, pts2, 0, p.col + (255,), dx=-0.16 * size, dy=-0.24 * size)
            if p.kind == 'ball':
                draw_shape(ld, p, pts2, 0, light + (255,), dx=-0.36 * p.r[0] * SS, dy=-0.42 * p.r[1] * SS, k=0.3)
            canvas.paste(layer, (0, 0), mf)
        else:
            canvas.paste(p.col + (255,), (0, 0), mf)
    g = glow.filter(ImageFilter.GaussianBlur(7 * SS))
    a = np.array(g).astype(np.float32)
    a[:, :, 3] *= 0.85
    canvas = Image.alpha_composite(Image.fromarray(a.astype(np.uint8)), canvas)
    # The glow over the body too, softly (light spills onto it).
    over = np.array(g).astype(np.float32)
    over[:, :, 3] *= 0.35
    canvas = Image.alpha_composite(canvas, Image.fromarray(over.astype(np.uint8)))
    return rim(canvas)


def rim(img):
    """A thin bright edge where the body meets the air toward the top left (the light), and a darker one opposite."""
    a = np.array(img).astype(np.float32)
    al = a[:, :, 3] > 128
    d = 3 * SS
    lit = al & ~np.roll(np.roll(al, d, 0), d, 1)
    dark = al & ~np.roll(np.roll(al, -d, 0), -d, 1)
    inner = al & np.roll(np.roll(al, -2, 0), -2, 1) & np.roll(np.roll(al, 2, 0), 2, 1)
    for k in range(3):
        a[:, :, k] = np.where(lit & inner, np.minimum(255, a[:, :, k] * 1.25 + 18), a[:, :, k])
        a[:, :, k] = np.where(dark & inner, a[:, :, k] * 0.82, a[:, :, k])
    return Image.fromarray(a.astype(np.uint8))


def shrink(img):
    return img.convert('RGBa').resize((CELL, CELL), Image.LANCZOS).convert('RGBA')


# ------------------------------------------------------------------ helpers

def limb(a, b, c, r1, r2, r3, col, **k):
    """Upper and lower limb: a to b, b to c."""
    return [cap(a, b, r1, r2, col, **k), cap(b, c, r2, r3, col, **k)]


def horn(base, up, out, r, col, curl=0.0):
    """A curved horn as a tapered chain of caps."""
    parts = []
    p = base
    n = 4
    for i in range(n):
        t = (i + 1) / n
        q = (base[0] + out[0] * t + curl * math.sin(t * math.pi) * (1 if out[0] >= 0 else -1),
             base[1] + up * t - abs(curl) * t * t * 0.6,
             base[2] + out[2] * t)
        parts.append(cap(p, q, r * (1 - i / n) + 0.6, r * (1 - (i + 1) / n) + 0.6, col))
        p = q
    return parts


def ring(c, rx, rz, n, r, col, phase=0.0, tilt=0.0, glow=True):
    out = []
    for i in range(n):
        a = phase + i * 2 * math.pi / n
        out.append(ball((c[0] + math.cos(a) * rx, c[1] + math.sin(a) * rz * tilt, c[2] + math.sin(a) * rz), r, col=col, glow=glow))
    return out


# ------------------------------------------------------------------ body plans

def hulk(p, anim, f, n):
    """A hulking demon on two legs: small horned head sunk between great shoulders, huge arms."""
    t = f / n
    s = 2 * math.pi * t
    skin, belly, sh = p['skin'], p['belly'], p['shoulder']
    eye = p['eye']
    bob = abs(math.sin(s)) * 4 if anim == 'move' else 0
    swing = math.sin(s) * 18 if anim == 'move' else 0
    lean = 0
    # Attack: lift the weapon arm high behind the head, then smash it down in front.
    raise_ = 0.0
    if anim == 'attack':
        raise_ = [0.2, 0.7, 1.0, -0.6, -1.0, -0.4][f]
        lean = [0, -4, -6, 10, 14, 6][f]
    y0 = bob
    parts = []
    # legs and feet
    for side, ph in ((1, 1), (-1, -1)):
        hip = (side * 24, 66 + y0, -4)
        knee = (side * 28, 38 + y0 * 0.5, 6 + ph * swing * 0.6)
        foot = (side * 28, 12, ph * swing)
        parts += limb(hip, knee, foot, 17, 15, 13, mul(skin, 0.92))
        parts.append(ball(add(foot, (0, -2, 8)), 15, 10, col=p.get('foot', mul(skin, 0.7))))
    tz = lean
    parts.append(ball((0, 104 + y0, tz * 0.5), 54, 48, col=skin))
    parts.append(ball((0, 88 + y0, 22 + tz * 0.5), 34, 30, col=belly, n=(0, 0, 1)))
    # magma or rune cracks on the chest
    for (x0, y1, x1, y2) in p.get('cracks', []):
        parts.append(cap((x0, y1 + y0, 40 + tz * 0.5), (x1, y2 + y0, 42 + tz * 0.5), 2.2, 1.6, col=p['glowc'], glow=True, n=(0, 0, 1)))
    # head
    hz = 26 + tz
    head = (0, 146 + y0, hz)
    parts.append(ball(head, 23, 21, col=skin))
    parts.append(ball(add(head, (0, -12, 12)), 17, 11, col=mul(skin, 0.85), n=(0, -0.2, 1)))
    for side in (1, -1):
        parts.append(ball(add(head, (side * 9, 3, 19)), 4.6, 3.6, col=eye, glow=True, n=(0, 0, 1)))
        parts.append(poly([add(head, (side * 9, -14, 22)), add(head, (side * 13, -4, 22)), add(head, (side * 5, -10, 24))], col=(245, 236, 214), n=(0, 0, 1)))
        parts += horn(add(head, (side * 17, 10, 0)), p.get('horn_up', 30), (side * p.get('horn_out', 18), 0, -6), 8, p['horn'], curl=p.get('curl', 6))
    # shoulders
    for side in (1, -1):
        sp = (side * 52, 128 + y0, tz * 0.4)
        if p.get('crystal'):
            parts.append(ball(sp, 24, 20, col=sh))
            for k in range(3):
                a = (k - 1) * 0.5
                parts.append(poly([add(sp, (side * 6 + math.sin(a) * 14, 10, -6 + k * 6)), add(sp, (side * (12 + 8 * k), 40 + k * 6, -4 + k * 4)), add(sp, (side * (18 + k * 4), 8, k * 6))], col=p['crystal']))
        else:
            parts.append(ball(sp, 28, 22, col=sh))
            parts.append(ball(add(sp, (side * 4, 12, 0)), 16, 10, col=mix(sh, (255, 255, 255), 0.18)))
    # arms: the right (side -1) holds the weapon
    for side in (1, -1):
        sp = (side * 60, 120 + y0, tz * 0.4)
        if side == -1 and anim == 'attack':
            a = raise_
            elbow = (side * 66, 120 + y0 + 24 * a, 18 + tz - 10 * a)
            hand = (side * 58, 116 + y0 + 46 * a, 34 + tz - 34 * max(a, 0) + 26 * max(-a, 0))
        else:
            sw = -swing * side * 0.8
            elbow = (side * 70, 88 + y0, 8 + sw * 0.6)
            hand = (side * 68, 56 + y0, 22 + sw)
        parts += limb(sp, elbow, hand, 18, 16, 19, skin)
        parts.append(ball(hand, 20, 18, col=mul(skin, 0.9)))
        if side == -1:
            parts += weapon(p, hand, elbow, sp, None if anim == 'attack' else (-0.25, -0.45, 0.85))
        elif p.get('claws'):
            for k in (-1, 0, 1):
                parts.append(poly([add(hand, (k * 8, -8, 12)), add(hand, (k * 10, -30, 26)), add(hand, (k * 8 + 5, -10, 16))], col=p['claws']))
    return parts


def weapon(p, hand, elbow, sp, held=None):
    """The weapon in a hand, along the forearm (or `held`, a direction, when carried at rest)."""
    w = p.get('weapon')
    dx, dy, dz = held if held else (hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2])
    L = math.sqrt(dx * dx + dy * dy + dz * dz) or 1
    ux, uy, uz = dx / L, dy / L, dz / L
    tip = lambda d: (hand[0] + ux * d, hand[1] + uy * d, hand[2] + uz * d)
    out = []
    if w == 'cleaver':
        out.append(cap(tip(-10), tip(8), 4, 4, col=(70, 46, 30)))
        a, b = tip(8), tip(78)
        side = (-20, 0, 18) if abs(uy) > 0.7 else (0, 26, 0)
        sc = lambda k: (side[0] * k, side[1] * k, side[2] * k)
        out.append(poly([a, b, add(b, sc(1.25)), add(a, sc(1.0))], col=(128, 118, 128)))
        out.append(poly([add(a, sc(0.82)), add(b, sc(1.02)), add(b, sc(1.25)), add(a, sc(1.0))], col=p['glowc'], glow=True))
    elif w == 'hammer':
        out.append(cap(tip(-14), tip(70), 4.5, 4.5, col=(92, 60, 36)))
        h = tip(76)
        out.append(ball(h, 26, 20, col=(140, 128, 116)))
        out.append(ball(add(h, (0, 4, 0)), 18, 12, col=(170, 158, 144)))
        out.append(ball(h, 6, 6, col=p['glowc'], glow=True, bias=30))
    elif w == 'sword':
        out.append(cap(tip(-8), tip(10), 4, 4, col=(80, 60, 50)))
        out.append(cap(add(tip(10), (-10, 0, 0)), add(tip(10), (10, 0, 0)), 4, 4, col=p.get('guard', (200, 170, 80))))
        out.append(cap(tip(12), tip(104), 8, 2.5, col=p.get('blade', (205, 215, 230))))
        if p.get('blade_glow'):
            out.append(cap(tip(20), tip(96), 2.5, 1, col=p['blade_glow'], glow=True, bias=4))
    elif w == 'scythe':
        out.append(cap(tip(-60), tip(80), 4, 4, col=(60, 44, 70)))
        top = tip(80)
        out.append(poly([top, add(top, (0, 10, 4)), add(top, (-30, 18, 40)), add(top, (-14, -6, 52)), add(top, (-6, 4, 14))], col=(200, 205, 230)))
        out.append(ball(top, 6, 6, col=p['glowc'], glow=True))
    return out


def caster(p, anim, f, n):
    """A floating sorcerer: a robe with no feet, sleeves, a masked or crowned head, orbiting fires."""
    t = f / n
    s = 2 * math.pi * t
    robe, trim, skin = p['robe'], p['trim'], p['skin']
    lift = 16 + math.sin(s) * 5
    parts = []
    flare = 0.0
    if anim == 'attack':
        flare = [0.1, 0.4, 0.8, 1.0, 0.6, 0.2][f]
    # the robe: a tapered body widening to a ragged hem
    hem = (0, 34 + lift, 0)
    parts.append(cap((0, 112 + lift, 0), hem, 22, 36, col=robe))
    for k in range(9):
        a = k * 2 * math.pi / 9 + s * 0.3
        parts.append(poly([(math.cos(a) * 30, 30 + lift, math.sin(a) * 30), (math.cos(a + 0.35) * 40, 2 + lift + 5 * math.sin(s + k), math.sin(a + 0.35) * 40), (math.cos(a + 0.7) * 30, 30 + lift, math.sin(a + 0.7) * 30)], col=mul(robe, 0.8), bias=-4))
    if p.get('tentacles'):
        for k in range(6):
            a = k * 2 * math.pi / 6 + 0.4
            base = (math.cos(a) * 30, 14 + lift, math.sin(a) * 30)
            w = math.sin(s + k * 1.3) * 10
            mid = (math.cos(a) * 44 + w * 0.3, 0 + lift * 0.4, math.sin(a) * 44)
            end = (math.cos(a) * 52 + w, -2, math.sin(a) * 52 + w * 0.5)
            parts += limb(base, mid, end, 9, 6, 2.5, p['tentacles'])
    parts.append(cap((0, 96 + lift, 14), (0, 40 + lift, 30), 4, 6, col=trim, n=(0, 0, 1)))
    parts.append(ball((0, 76 + lift, 28), 7, 7, col=p['glowc'], glow=True, n=(0, 0, 1)))
    # shoulders and the head
    parts.append(ball((0, 122 + lift, 0), 32, 18, col=mul(robe, 1.05)))
    head = (0, 146 + lift, 4)
    if p.get('hood'):
        parts.append(ball(add(head, (0, 2, -4)), 25, 26, col=p['hood']))
        parts.append(poly([add(head, (-18, 24, -6)), add(head, (0, 46, -16)), add(head, (18, 24, -6))], col=p['hood']))
        parts.append(ball(add(head, (0, -2, 12)), 16, 18, col=(20, 10, 26), n=(0, 0, 1), shade=False))
    else:
        parts.append(ball(head, 19, 21, col=skin))
    parts.append(ball(add(head, (0, -2, 15)), 14, 15, col=p.get('mask', mul(skin, 1.1)), n=(0, 0, 1)))
    for side in (1, -1):
        parts.append(ball(add(head, (side * 6, 0, 26)), 3.6, 2.6, col=p['eye'], glow=True, n=(0, 0, 1), bias=2))
    if p.get('flamehair'):
        for k in range(5):
            a = (k - 2) * 0.45
            sw = math.sin(s * 2 + k) * 5
            parts.append(poly([add(head, (math.sin(a) * 18, 8, math.cos(a) * 6 - 6)), add(head, (math.sin(a) * 26 + sw, 44 + (2 - abs(k - 2)) * 9, -14)), add(head, (math.sin(a) * 6, 14, -8))], col=p['flamehair'], glow=True, bias=-12))
    if p.get('crown'):
        for k in range(5):
            a = (k - 2) * 0.5
            parts.append(poly([add(head, (math.sin(a) * 16 - 4, 14, math.cos(a) * 10 - 4)), add(head, (math.sin(a) * 22, 34 + (2 - abs(k - 2)) * 8, math.cos(a) * 8 - 6)), add(head, (math.sin(a) * 16 + 4, 14, math.cos(a) * 10 - 4))], col=p['crown']))
    # arms: sleeves out to the sides, raised and forward on the cast
    for side in (1, -1):
        sp = (side * 30, 122 + lift, 0)
        el = (side * (40 + 6 * flare), 98 + lift + 26 * flare, 10 + 14 * flare)
        hand = (side * (36 - 10 * flare), 84 + lift + 52 * flare, 24 + 26 * flare)
        parts += limb(sp, el, hand, 11, 13, 15, robe)
        parts.append(ball(hand, 8, 8, col=skin))
    # orbiting fires; on the cast they gather before the hands and flare
    k = p.get('orbs', 3)
    for i in range(k):
        a = s + i * 2 * math.pi / k
        rr = 56 * (1 - flare * 0.6)
        c = (math.cos(a) * rr, 100 + lift + math.sin(a * 2) * 10 + flare * 30, math.sin(a) * rr + flare * 40)
        parts.append(ball(c, 7 + 4 * flare, col=p['glowc'], glow=True))
    if flare > 0.5:
        parts.append(ball((0, 140 + lift, 56), 10 + 16 * flare, col=p['glowc'], glow=True, bias=40))
    if p.get('weapon') == 'scythe':
        hand = (-36 + 10 * flare, 84 + lift + 52 * flare, 24 + 26 * flare)
        parts += weapon(p, hand, (-46, 60 + lift, 18), None)
    return parts


def beast(p, anim, f, n):
    """A four-legged demon: chest, belly, haunches along its length, a horned head on a thick neck, a tail."""
    t = f / n
    s = 2 * math.pi * t
    hide, belly = p['hide'], p['belly']
    fwd = 0
    rear = 0
    if anim == 'attack':
        rear = [0, 0.6, 1.0, -0.2, -0.6, -0.2][f]
        fwd = [0, -6, -10, 22, 30, 10][f]
    bob = math.sin(2 * s) * 4 if anim == 'move' else 0
    y0 = bob + max(rear, 0) * 10
    parts = []
    big = p.get('size', 1.0)
    # legs (front pair at z +28, hind at -32), gallop phase
    for side in (1, -1):
        for front, ph in ((1, 0), (-1, math.pi)):
            z = 30 * front + fwd * 0.4
            sw = math.sin(s + ph + (0.5 if side > 0 else 0)) * 16 if anim == 'move' else 0
            lift = max(0, math.cos(s + ph)) * 8 if anim == 'move' else 0
            hip = (side * 22 * big, 66 + y0 + (rear * 16 if front > 0 else 0), z)
            knee = (side * 24 * big, 36 + lift + (rear * 22 if front > 0 else 0), z + sw * 0.5 + (6 if front < 0 else -4))
            paw = (side * 24 * big, 10 + lift + (rear * 30 if front > 0 else 0), z + sw + (front * 6 if rear > 0.5 else 0))
            parts += limb(hip, knee, paw, 12 * big, 9 * big, 8 * big, mul(hide, 0.9))
            parts.append(ball(add(paw, (0, -2, 6)), 11 * big, 7 * big, col=mul(hide, 0.7)))
            for k in (-1, 0, 1):
                parts.append(poly([add(paw, (k * 5, -4, 10)), add(paw, (k * 6, -8, 20)), add(paw, (k * 5 + 3, -2, 12))], col=(240, 228, 210)))
    # body
    cy = 72 + y0
    parts.append(ball((0, cy + 2 + rear * 14, 22 + fwd), 34 * big, 32 * big, col=hide))
    parts.append(ball((0, cy, -4 + fwd), 32 * big, 28 * big, col=hide))
    parts.append(ball((0, cy - 2, -30 + fwd), 30 * big, 27 * big, col=hide))
    parts.append(ball((0, cy - 10 + rear * 10, 12 + fwd), 22 * big, 16 * big, col=belly, n=(0, -1, 0.3)))
    # spines / glowing ridges along the back
    for k in range(5):
        z = 26 - k * 14 + fwd
        h = 14 + (2 - abs(k - 2)) * 5
        top = cy + 26 * big + (rear * 14 if k < 2 else 0)
        parts.append(poly([(-5, top, z + 5), (0, top + h, z - 6), (5, top, z + 5)], col=p['spine'], glow=p.get('spine_glow', False)))
    # wings
    if p.get('wings'):
        flap = math.sin(s) * 0.4 + rear * 0.5
        for side in (1, -1):
            root = (side * 18, cy + 24, 14 + fwd)
            tipp = (side * 86, cy + 70 + flap * 40, -26 + fwd)
            mid = (side * 50, cy + 84 + flap * 30, 4 + fwd)
            low = (side * 70, cy + 12 + flap * 20, -36 + fwd)
            parts.append(cap(root, mid, 4, 3, col=mul(hide, 0.8)))
            parts.append(cap(mid, tipp, 3, 2, col=mul(hide, 0.8)))
            parts.append(poly([root, mid, tipp, low, (side * 30, cy + 10, -26 + fwd)], col=p['wings'], bias=-20))
    # neck and head
    nz = 46 + fwd + rear * -6
    ny = cy + 24 + rear * 34
    neck = (0, ny, nz)
    parts.append(cap((0, cy + 14 + rear * 14, 26 + fwd), neck, 22 * big, 18 * big, col=hide))
    head = (0, ny + 10, nz + 18 - rear * 4)
    parts.append(ball(head, 22 * big, 20 * big, col=hide))
    jaw_open = max(0.0, -rear) * 10 + (6 if anim == 'attack' and f == 2 else 0)
    snout = add(head, (0, -4, 22 * big))
    parts.append(ball(snout, 13 * big, 10 * big, col=mul(hide, 0.95)))
    parts.append(ball(add(snout, (0, -10 - jaw_open, -2)), 11 * big, 6 * big, col=mul(hide, 0.75)))
    if jaw_open > 2:
        parts.append(ball(add(snout, (0, -5 - jaw_open * 0.5, 2)), 8, 3 + jaw_open * 0.3, col=p['glowc'], glow=True))
    for side in (1, -1):
        parts.append(poly([add(snout, (side * 6, -4, 8)), add(snout, (side * 7, -14, 9)), add(snout, (side * 3, -6, 10))], col=(245, 236, 214), n=(0, 0, 1)))
        parts.append(ball(add(head, (side * 10, 6, 15 * big)), 4.4, 3.4, col=p['eye'], glow=True, n=(side * 0.4, 0, 1)))
        if p.get('horns', True):
            parts += horn(add(head, (side * 12, 14, -4)), p.get('horn_up', 24), (side * 14, 0, -26), 6, p['horn'], curl=p.get('curl', 4))
        if p.get('ears'):
            parts.append(poly([add(head, (side * 10, 14, -2)), add(head, (side * 18, 36, -8)), add(head, (side * 20, 12, -8))], col=p['ears']))
    for (dx, dy, dz) in p.get('extra_eyes', []):
        parts.append(ball((dx, cy + dy, dz + fwd), 4.2, 4.2, col=p['eye'], glow=True, n=(0, 0.2, 1) if dz > 0 else (math.copysign(1, dx), 0, 0)))
    if p.get('mane'):
        for k in range(6):
            a = (k - 2.5) * 0.45
            parts.append(poly([add(head, (math.sin(a) * 16, 10, -10)), add(head, (math.sin(a) * 26, 24 + 4 * math.sin(s * 2 + k), -30 - k)), add(head, (math.sin(a) * 10, 2, -20))], col=p['mane'], glow=p.get('mane_glow', False), bias=-8))
    # tail
    prev = (0, cy + 4, -50 + fwd)
    for k in range(5):
        w = math.sin(s + k * 0.7) * 8
        q = (w, cy + 10 + k * 6, -62 - k * 12 + fwd)
        parts.append(cap(prev, q, 9 - k * 1.4, 8 - k * 1.5, col=hide))
        prev = q
    parts.append(poly([add(prev, (-6, 0, 0)), add(prev, (0, 6, -16)), add(prev, (6, 0, 0))], col=p['tailtip'], glow=p.get('tail_glow', False)))
    return parts


def knight(p, anim, f, n):
    """An armoured demon knight: plated legs, a broad cuirass, pauldrons, a horned helm with a burning slit, a cape, a blade."""
    t = f / n
    s = 2 * math.pi * t
    arm, dark, cape_c = p['armor'], p['under'], p['cape']
    swing = math.sin(s) * 16 if anim == 'move' else 0
    bob = abs(math.sin(s)) * 3 if anim == 'move' else 0
    raise_ = 0.0
    lean = 0
    if anim == 'attack':
        raise_ = [0.3, 0.8, 1.0, -0.5, -1.0, -0.4][f]
        lean = [0, -4, -6, 10, 14, 6][f]
    y0 = bob
    big = p.get('size', 1.0)
    parts = []
    for side, ph in ((1, 1), (-1, -1)):
        hip = (side * 16 * big, 74 + y0, 0)
        knee = (side * 18 * big, 42 + y0 * 0.4, 6 + ph * swing * 0.6)
        foot = (side * 18 * big, 12, ph * swing)
        parts += limb(hip, knee, foot, 13 * big, 11 * big, 10 * big, dark)
        parts.append(ball(add(knee, (0, 4, 8)), 10 * big, 9 * big, col=arm))
        parts.append(cap(add(knee, (0, -6, 6)), add(foot, (0, 6, 6)), 9 * big, 8 * big, col=arm))
        parts.append(ball(add(foot, (0, -2, 8)), 12 * big, 8 * big, col=arm))
    # cape behind
    cs = math.sin(s) * 6
    parts.append(poly([(-30 * big, 134 + y0, -16), (30 * big, 134 + y0, -16), (40 * big, 20 + y0, -36 + cs), (0, 8, -42 - cs), (-40 * big, 20 + y0, -36 - cs)], col=cape_c, bias=-30))
    tz = lean
    parts.append(ball((0, 84 + y0, tz * 0.3), 26 * big, 16 * big, col=dark))
    parts.append(ball((0, 110 + y0, tz * 0.5), 36 * big, 32 * big, col=arm))
    parts.append(ball((0, 112 + y0, 14 + tz * 0.5), 24 * big, 22 * big, col=mix(arm, (255, 255, 255), 0.12), n=(0, 0, 1)))
    if p.get('core'):
        parts.append(ball((0, 112 + y0, 34 * big + tz * 0.5), 10 * big, 10 * big, col=p['core'], glow=True, n=(0, 0, 1), bias=4))
        for k in range(4):
            a = k * math.pi / 2 + 0.785
            parts.append(cap((math.cos(a) * 11 * big, 112 + y0 + math.sin(a) * 11 * big, 34 * big + tz * 0.5), (math.cos(a) * 20 * big, 112 + y0 + math.sin(a) * 20 * big, 32 * big + tz * 0.5), 2.4, 2.4, col=(60, 50, 60), n=(0, 0, 1), bias=6))
    for (x0, y1, x1, y2) in p.get('runes', []):
        parts.append(cap((x0, y1 + y0, 32 + tz * 0.5), (x1, y2 + y0, 32 + tz * 0.5), 1.8, 1.8, col=p['glowc'], glow=True, n=(0, 0, 1)))
    # helm
    head = (0, 152 + y0, 6 + tz)
    parts.append(ball(head, 20 * big, 22 * big, col=arm))
    parts.append(cap(add(head, (-11, 2, 17)), add(head, (11, 2, 17)), 3, 3, col=p['eye'], glow=True, n=(0, 0, 1), bias=3))
    parts.append(cap(add(head, (0, 18, 6)), add(head, (0, 18, -18)), 4, 2, col=p.get('crest', mul(arm, 0.8))))
    for side in (1, -1):
        parts += horn(add(head, (side * 14, 10, 0)), p.get('horn_up', 26), (side * 16, 0, -8), 5.5, p['horn'], curl=p.get('curl', 5))
    # pauldrons
    for side in (1, -1):
        sp = (side * 38 * big, 132 + y0, tz * 0.3)
        parts.append(ball(sp, 20 * big, 15 * big, col=arm))
        parts.append(poly([add(sp, (side * 6, 10, -8)), add(sp, (side * 18, 30, -12)), add(sp, (side * 16, 6, 8))], col=p.get('spike', mul(arm, 0.8))))
    # wings of blades
    if p.get('bladewings'):
        fl = math.sin(s) * 6
        for side in (1, -1):
            for k in range(4):
                root = (side * 14, 128 + y0, -18)
                tipp = (side * (50 + k * 14), 150 + y0 + 30 - k * 22 + fl, -40 - k * 4)
                parts.append(poly([root, tipp, add(tipp, (side * -8, -8, 4)), add(root, (0, -10, 0))], col=p['bladewings'], bias=-25))
    # arms: the right (-1) swings the blade; the left carries a shield or a lantern
    for side in (1, -1):
        sp = (side * 44 * big, 124 + y0, tz * 0.3)
        if side == -1 and anim == 'attack':
            a = raise_
            el = (side * 50 * big, 120 + y0 + 28 * a, 16 + tz - 10 * a)
            hand = (side * 44 * big, 118 + y0 + 60 * a, 34 + tz - 26 * max(a, 0) + 24 * max(-a, 0))
        else:
            sw = -swing * side * 0.6
            el = (side * 50 * big, 96 + y0, 6 + sw * 0.5)
            hand = (side * 48 * big, 72 + y0, 20 + sw)
        parts += limb(sp, el, hand, 11 * big, 10 * big, 10 * big, arm)
        parts.append(ball(hand, 10 * big, col=mul(arm, 0.85)))
        if side == -1:
            parts += weapon(p, hand, el, sp, None if anim == 'attack' else (-0.15, 0.55, 0.8))
        elif p.get('shield'):
            parts.append(ball(add(hand, (side * 10, 14, 10)), 8, col=mul(arm, 0.8)))
            c = add(hand, (side * 14, 18, 14))
            parts.append(poly([add(c, (side * 2, 34, -12)), add(c, (side * 2, 34, 22)), add(c, (side * 2, -14, 26)), add(c, (side * 2, -34, 6)), add(c, (side * 2, -14, -16))], col=p['shield']))
            parts.append(ball(add(c, (side * 4, 4, 4)), 7, col=p['glowc'], glow=True, n=(side, 0, 0.4)))
        elif p.get('lantern'):
            c = add(hand, (0, -26, 6))
            parts.append(cap(hand, c, 1.5, 1.5, col=(60, 50, 60)))
            parts.append(ball(c, 11, 13, col=(60, 50, 60)))
            parts.append(ball(c, 7, 9, col=p['glowc'], glow=True, bias=2))
    return parts


def elemental(p, anim, f, n):
    """A storm made flesh: a blazing core in a shell of floating stones, rings of sparks, arcs of lightning."""
    t = f / n
    s = 2 * math.pi * t
    flare = [0, 0.3, 0.7, 1.0, 0.6, 0.2][f] if anim == 'attack' else 0.0
    lift = 30 + math.sin(s) * 6
    cy = 90 + lift
    parts = []
    parts.append(ball((0, cy, 0), 24 + flare * 8, col=p['glowc'], glow=True))
    for side in (1, -1):
        parts.append(ball((side * 8, cy + 4, 24), 4.2, 5, col=(255, 255, 255), glow=True, n=(0, 0, 1), bias=8))
    parts.append(cap((-7, cy - 9, 24), (7, cy - 9, 24), 2.2, 2.2, col=(255, 255, 255), glow=True, n=(0, 0, 1), bias=8))
    # the stone shell, opening as it casts
    for i in range(9):
        a = i * 2 * math.pi / 9 + s * 0.25
        e = (i % 3 - 1) * 0.6
        r = 40 + flare * 22
        c = (math.cos(a) * r, cy + e * 26 + math.sin(s + i) * 3, math.sin(a) * r)
        parts.append(ball(c, 15 - abs(e) * 4, 12 - abs(e) * 3, col=p['stone']))
        parts.append(cap(add(c, (-6, 2, 4)), add(c, (6, -2, 4)), 1.5, 1.5, col=p['glowc'], glow=True, n=(math.cos(a), 0, math.sin(a))))
    # crown of spikes
    for i in range(5):
        a = i * 2 * math.pi / 5 + s * 0.2
        base = (math.cos(a) * 18, cy + 30, math.sin(a) * 18)
        parts.append(poly([add(base, (-6, 0, 0)), add(base, (math.cos(a) * 8, 34 + (i % 2) * 10, math.sin(a) * 8)), add(base, (6, 0, 0))], col=p['stone']))
    parts += ring((0, cy, 0), 70, 70, 10, 3.2, p['ring'], phase=s, tilt=0.35)
    # arcs of lightning
    import random
    rnd = random.Random(f * 31 + (7 if anim == 'attack' else 0))
    for k in range(3 + int(flare * 3)):
        a = rnd.random() * 2 * math.pi
        pts = [(0, cy, 0)]
        for j in range(4):
            r = 22 + j * (16 + flare * 10)
            pts.append((math.cos(a) * r + rnd.uniform(-8, 8), cy + rnd.uniform(-14, 14) - j * flare * 8, math.sin(a) * r + rnd.uniform(-8, 8)))
        for a0, b0 in zip(pts, pts[1:]):
            parts.append(cap(a0, b0, 2, 1.4, col=p['bolt'], glow=True))
    # stones shed below it, drifting
    for k in range(3):
        a = s + k * 2.1
        parts.append(ball((math.cos(a) * 20, cy - 50 - k * 16 + math.sin(s * 2 + k) * 4, math.sin(a) * 20), 7 - k * 1.5, col=mul(p['stone'], 0.85)))
    return parts


def leviathan(p, anim, f, n):
    """A sea serpent rearing out of its own coils: a frilled, crystal-crowned head, ice along its spine."""
    t = f / n
    s = 2 * math.pi * t
    scale_c, belly = p['hide'], p['belly']
    strike = [0, -0.6, -1.0, 0.8, 1.0, 0.3][f] if anim == 'attack' else 0.0
    parts = []
    # coils on the ground
    for k in range(10):
        a = k * 0.72 + s * 0.15
        r = 46 - k * 1.5
        parts.append(ball((math.cos(a) * r, 18 + (k % 2) * 4, math.sin(a) * r - 6), 22 - k * 0.6, 18 - k * 0.5, col=scale_c if k % 2 else mul(scale_c, 0.92)))
    # the rearing neck
    sway = math.sin(s) * 10
    pts = []
    for k in range(9):
        u = k / 8
        y = 30 + u * 120 - max(strike, 0) * u * u * 30 + max(-strike, 0) * u * 10
        z = 10 + math.sin(u * math.pi) * 22 * (1 - max(strike, 0)) + u * 30 * strike + u * 10
        x = math.sin(u * 3 + s) * 6 * u + sway * u
        pts.append((x, y, z))
    for k in range(8):
        r0 = 22 - k * 1.3
        parts.append(cap(pts[k], pts[k + 1], r0, r0 - 1.3, col=scale_c))
        parts.append(ball(add(pts[k], (0, -2, r0 * 0.7)), r0 * 0.6, r0 * 0.5, col=belly, n=(0, 0, 1)))
        parts.append(poly([add(pts[k], (-4, r0 - 2, -r0 * 0.6)), add(pts[k], (0, r0 + 16, -r0 * 0.9 - 6)), add(pts[k], (4, r0 - 2, -r0 * 0.6))], col=p['ice']))
    head = add(pts[-1], (0, 10, 14))
    parts.append(ball(head, 22, 18, col=scale_c))
    jaw = 6 + max(strike, 0) * 14 + (8 if anim == 'attack' and f == 4 else 0)
    parts.append(ball(add(head, (0, -2, 24)), 15, 10, col=scale_c))
    parts.append(ball(add(head, (0, -12 - jaw, 20)), 13, 7, col=mul(scale_c, 0.8)))
    parts.append(ball(add(head, (0, -8 - jaw * 0.5, 24)), 9, 2 + jaw * 0.3, col=p['glowc'], glow=True))
    for side in (1, -1):
        parts.append(ball(add(head, (side * 10, 6, 16)), 4.4, 3.4, col=p['eye'], glow=True, n=(side * 0.5, 0, 1)))
        parts.append(poly([add(head, (side * 14, 0, -4)), add(head, (side * 46, 22, -20)), add(head, (side * 40, -4, -14)), add(head, (side * 30, -14, -4))], col=p['frill'], bias=-6))
        for k in range(3):
            parts.append(poly([add(head, (side * 6 * k, 14, -6 + k * 4)), add(head, (side * (8 + k * 8), 40 - k * 6, -14 - k * 4)), add(head, (side * (10 + k * 6), 12, -2))], col=p['ice']))
        parts.append(poly([add(head, (side * 5, -10, 30)), add(head, (side * 6, -22, 30)), add(head, (side * 2, -12, 32))], col=(240, 250, 255), n=(0, 0, 1)))
    return parts


def archmage(p, anim, f, n):
    """Malakor: a tall robed figure in a crown of obsidian spikes, a long staff with a captured star, shards and a ring of stars about him."""
    t = f / n
    s = 2 * math.pi * t
    robe, trim, skin = p['robe'], p['trim'], p['skin']
    flare = [0.1, 0.4, 0.8, 1.0, 0.6, 0.2][f] if anim == 'attack' else 0.0
    lift = 6 + math.sin(s) * 3
    parts = []
    # the celestial ring behind him
    parts += ring((0, 122 + lift, -30), 66, 66, 14, 2.6, p['ring'], phase=s * 0.5, tilt=0, glow=True)
    for pp in parts:
        pp.pts = [(q[0], q[1] + (q[2] + 30) * 1.0, -30) for q in pp.pts]
    # the cape
    cs = math.sin(s) * 6
    parts.append(poly([(-34, 140 + lift, -12), (34, 140 + lift, -12), (48, 4, -30 + cs), (0, 0, -40 - cs), (-48, 4, -30 - cs)], col=p['cape'], bias=-30))
    parts.append(cap((0, 128 + lift, 0), (0, 4 + lift, 0), 22, 42, col=robe))
    parts.append(cap((0, 122 + lift, 18), (0, 10 + lift, 34), 5, 9, col=trim, n=(0, 0, 1)))
    for k in range(3):
        parts.append(ball((0, 100 - k * 26 + lift, 26 + k * 4), 4, col=p['glowc'], glow=True, n=(0, 0, 1)))
    parts.append(ball((0, 138 + lift, 0), 34, 20, col=mul(robe, 1.08)))
    for side in (1, -1):
        sp = (side * 32, 142 + lift, 0)
        parts.append(ball(sp, 18, 13, col=p['plate']))
        for k in range(2):
            parts.append(poly([add(sp, (side * 4, 8, -4 + k * 8)), add(sp, (side * (14 + k * 6), 34 - k * 8, -6 + k * 8)), add(sp, (side * 14, 4, k * 8))], col=p['obsidian']))
    head = (0, 164 + lift, 4)
    parts.append(ball(head, 17, 19, col=skin))
    parts.append(ball(add(head, (0, -2, 13)), 13, 14, col=p['mask'], n=(0, 0, 1)))
    for side in (1, -1):
        parts.append(ball(add(head, (side * 5.5, 0, 24)), 3.4, 2.4, col=p['eye'], glow=True, n=(0, 0, 1), bias=2))
    # the crown: a band and five broad obsidian spikes, a star caught at its brow
    parts.append(cap(add(head, (-16, 12, 0)), add(head, (16, 12, 0)), 5, 5, col=p['plate']))
    for k in range(5):
        a = (k - 2) * 0.62
        h = 16 + (2 - abs(k - 2)) * 9
        parts.append(poly([add(head, (math.sin(a) * 16 - 7, 12, math.cos(a) * 9 - 3)), add(head, (math.sin(a) * 24, 14 + h, math.cos(a) * 6 - 8)), add(head, (math.sin(a) * 16 + 7, 12, math.cos(a) * 9 - 3))], col=p['obsidian']))
    parts.append(ball(add(head, (0, 14, 14)), 4, 4, col=p['glowc'], glow=True, n=(0, 0, 1), bias=6))
    # arms: staff in the right hand, the left raised to cast
    for side in (1, -1):
        sp = (side * 34, 136 + lift, 0)
        if side == 1:
            el = (side * (46 + 6 * flare), 112 + lift + 24 * flare, 10 + 12 * flare)
            hand = (side * (44 - 6 * flare), 96 + lift + 52 * flare, 26 + 24 * flare)
        else:
            el = (side * 46, 104 + lift, 8)
            hand = (side * 48, 90 + lift, 22)
        parts += limb(sp, el, hand, 11, 12, 13, robe)
        parts.append(ball(hand, 7, col=skin))
        if side == -1:
            top = add(hand, (0, 92 + flare * 6, 0))
            parts.append(cap(add(hand, (0, -84, 0)), top, 3.6, 3.6, col=(40, 28, 46)))
            for k in range(3):
                a = k * 2 * math.pi / 3 + s
                parts.append(poly([add(top, (math.cos(a) * 6, -6, math.sin(a) * 6)), add(top, (math.cos(a) * 14, 18, math.sin(a) * 14)), add(top, (math.cos(a + 0.5) * 6, 0, math.sin(a + 0.5) * 6))], col=p['obsidian']))
            parts.append(ball(add(top, (0, 10, 0)), 9 + flare * 6, col=p['glowc'], glow=True, bias=4))
    # orbiting obsidian shards
    for i in range(5):
        a = s + i * 2 * math.pi / 5
        rr = 64 * (1 - flare * 0.4)
        c = (math.cos(a) * rr, 96 + lift + math.sin(a * 2 + i) * 14 + flare * 30, math.sin(a) * rr + flare * 30)
        parts.append(poly([add(c, (0, 12, 0)), add(c, (6, 0, 3)), add(c, (0, -12, 0)), add(c, (-6, 0, -3))], col=p['obsidian']))
        parts.append(ball(c, 2.6, col=p['glowc'], glow=True, bias=2))
    if flare > 0.5:
        parts.append(ball((14, 160 + lift, 60), 12 + 18 * flare, col=p['glowc'], glow=True, bias=40))
    return parts


def lord(p, anim, f, n):
    """A demon lord: a towering horned figure of cracked obsidian, lava running in its seams and a molten
    heart in its chest, a crown of fire, spiked pauldrons, clawed hands trailing the broken chains of its
    seal, and tattered wings edged with embers."""
    t = f / n
    s = 2 * math.pi * t
    skin, plate, lava = p['skin'], p['plate'], p['glowc']
    stride = math.sin(s) * 14 if anim == 'move' else 0
    bob = abs(math.sin(s)) * 4 if anim == 'move' else 0
    # Attack: both arms rise, fire gathering in the claws, then come down together.
    up = [0.2, 0.7, 1.0, -0.5, -1.0, -0.3][f] if anim == 'attack' else 0.0
    lean = [0, -6, -8, 12, 16, 6][f] if anim == 'attack' else 0
    y0 = bob
    parts = []
    # legs: thick, armoured, clawed feet
    for side, ph in ((1, 1), (-1, -1)):
        hip = (side * 22, 80 + y0, -2)
        knee = (side * 27, 46 + y0 * 0.5, 10 + ph * stride * 0.5)
        foot = (side * 26, 12, ph * stride)
        parts += limb(hip, knee, foot, 16, 13, 11, skin)
        parts.append(ball(add(knee, (0, 4, 8)), 12, 11, col=plate))
        parts.append(ball(add(foot, (0, -2, 8)), 15, 9, col=plate))
        for k in (-1, 0, 1):
            parts.append(poly([add(foot, (k * 7, -6, 16)), add(foot, (k * 8, -10, 28)), add(foot, (k * 7 + 4, -4, 18))], col=(240, 224, 200)))
        parts.append(cap(add(hip, (side * 4, -6, 14)), add(knee, (side * 2, 4, 18)), 2.2, 1.8, col=lava, glow=True, n=(0, 0, 1)))
    # wings: tattered membranes, their edges burning
    fl = math.sin(s) * 0.25 + max(up, 0) * 0.4
    for side in (1, -1):
        root = (side * 16, 140 + y0, -20)
        arm1 = (side * 62, 196 + y0 + fl * 30, -40)
        tip = (side * 104, 170 + y0 + fl * 50, -52)
        # the trailing edge torn into ragged points
        low = [(side * 98, 118 + y0, -52), (side * 84, 128 + y0, -50), (side * 76, 96 + y0, -48), (side * 62, 112 + y0, -44), (side * 52, 86 + y0, -40), (side * 38, 104 + y0, -34)]
        parts.append(cap(root, arm1, 5, 4, col=mul(skin, 0.8), bias=-40))
        parts.append(cap(arm1, tip, 4, 2, col=mul(skin, 0.8), bias=-40))
        parts.append(poly([root, arm1, tip, *low], col=p['wing'], bias=-42))
        for a, b in zip([tip, *low], [*low, (side * 30, 110 + y0, -30)]):
            parts.append(cap(a, b, 1.8, 1.8, col=lava, glow=True, bias=-41))
    # torso: a broad cracked chest, plated belly, the molten heart
    tz = lean
    parts.append(ball((0, 96 + y0, tz * 0.3), 28, 22, col=plate))
    parts.append(poly([(-46, 150 + y0, tz * 0.6), (46, 150 + y0, tz * 0.6), (30, 96 + y0, 16 + tz * 0.4), (0, 84 + y0, 22 + tz * 0.4), (-30, 96 + y0, 16 + tz * 0.4)], col=skin, n=(0, 0, 1)))
    parts.append(ball((0, 128 + y0, tz * 0.5), 40, 34, col=skin))
    heart = (0, 126 + y0, 34 + tz * 0.5)
    parts.append(ball(heart, 11, 12, col=lava, glow=True, n=(0, 0, 1), bias=6))
    for a in (0.4, 1.3, 2.2, 3.1, 4.0, 5.0):
        parts.append(cap(heart, add(heart, (math.cos(a) * 26, math.sin(a) * 22, -2)), 2.4, 1.2, col=lava, glow=True, n=(0, 0, 1), bias=5))
    for (x0, y1, x1, y2) in [(-30, 140, -16, 112), (30, 142, 18, 110), (-14, 100, -4, 88), (16, 104, 6, 90)]:
        parts.append(cap((x0, y1 + y0, 26 + tz * 0.5), (x1, y2 + y0, 30 + tz * 0.5), 2, 1.5, col=lava, glow=True, n=(0, 0, 1)))
    # head: a horned, skull-like face, burning eyes, a crown of fire
    head = (0, 176 + y0, 10 + tz)
    parts.append(ball(add(head, (0, -10, 4)), 16, 12, col=mul(skin, 0.9)))
    parts.append(ball(head, 19, 18, col=skin))
    parts.append(ball(add(head, (0, -6, 14)), 13, 9, col=mul(skin, 0.75), n=(0, 0, 1)))
    for side in (1, -1):
        parts.append(poly([add(head, (side * 3, 6, 18)), add(head, (side * 16, 11, 15)), add(head, (side * 13, 0, 17)), add(head, (side * 4, 1, 18))], col=p['eye'], glow=True, n=(0, 0, 1), bias=3))
        parts.append(poly([add(head, (side * 6, -12, 20)), add(head, (side * 8, -22, 19)), add(head, (side * 3, -14, 21))], col=(245, 236, 214), n=(0, 0, 1), bias=2))
        parts += horn(add(head, (side * 13, 12, 0)), 38, (side * 30, 0, -14), 7, plate, curl=12)
    for k in range(5):
        a = (k - 2) * 0.45
        sw = math.sin(s * 2 + k) * 5
        parts.append(poly([add(head, (math.sin(a) * 14 - 4, 14, -4)), add(head, (math.sin(a) * 20 + sw, 40 + (2 - abs(k - 2)) * 10, -10)), add(head, (math.sin(a) * 14 + 4, 14, -4))], col=p['fire'], glow=True, bias=-6))
    # pauldrons of black glass
    for side in (1, -1):
        sp = (side * 44, 150 + y0, tz * 0.4)
        parts.append(ball(sp, 20, 15, col=plate))
        for k in range(3):
            parts.append(poly([add(sp, (side * 4, 8, -8 + k * 8)), add(sp, (side * (16 + k * 4), 34 - k * 6, -6 + k * 8)), add(sp, (side * 14, 6, k * 8))], col=p['spike']))
    # arms: long, clawed, a broken chain hanging from each wrist
    for side in (1, -1):
        sp = (side * 46, 142 + y0, tz * 0.4)
        if anim == 'attack':
            el = (side * 58, 140 + y0 + 26 * up, 14 + tz - 10 * up)
            hand = (side * 44, 136 + y0 + 52 * up, 30 + tz - 24 * max(up, 0) + 30 * max(-up, 0))
        else:
            sw = -stride * side * 0.7
            el = (side * 60, 106 + y0, 8 + sw * 0.5)
            hand = (side * 58, 72 + y0, 20 + sw)
        parts += limb(sp, el, hand, 14, 12, 12, skin)
        parts.append(ball(add(el, (side * 4, 0, 0)), 11, col=plate))
        parts.append(cap(add(sp, (side * 2, -10, 14)), add(el, (side * 2, 0, 12)), 1.8, 1.6, col=lava, glow=True, n=(0, 0, 1)))
        parts.append(ball(hand, 13, 12, col=mul(skin, 0.9)))
        for k in (-1, 0, 1):
            parts.append(poly([add(hand, (k * 7, -4, 10)), add(hand, (k * 8, -24, 20)), add(hand, (k * 7 + 4, -8, 14))], col=(240, 224, 200)))
        if anim == 'attack' and up > 0.3:
            parts.append(ball(add(hand, (0, 10, 10)), 8 + 10 * up, col=lava, glow=True, bias=20))
        # the chain: links swinging below the wrist
        prev = add(hand, (side * 4, -8, -4))
        for k in range(4):
            q = add(prev, (side * 3 + math.sin(s + k) * 3, -12, -2))
            parts.append(cap(prev, q, 3, 3, col=(90, 80, 96)))
            prev = q
    # molten drips
    for k in range(3):
        y = (100 - ((t * 120 + k * 40) % 90)) + y0
        parts.append(ball((14 * (k - 1), y, 26), 2.5, col=lava, glow=True, n=(0, 0, 1), bias=8))
    return parts


PLANS = {'lord': lord, 'hulk': hulk, 'caster': caster, 'beast': beast, 'knight': knight, 'elemental': elemental, 'leviathan': leviathan, 'archmage': archmage}

H = hexc
DEMONS = {
    # Pyraxis
    'd_cindergore': ('hulk', dict(skin=H('#7a2e22'), belly=H('#a8553a'), shoulder=H('#3b2a2a'), horn=H('#2a1c1c'), eye=H('#ffd166'), glowc=H('#ff7a2a'), weapon='cleaver',
                                  cracks=[(-20, 110, -6, 92), (-6, 92, 4, 100), (12, 118, 22, 96), (2, 84, 14, 74)])),
    'd_tarek': ('hulk', dict(skin=H('#8a7a68'), belly=H('#b8a68e'), shoulder=H('#5e564e'), horn=H('#3a332c'), eye=H('#ffb347'), glowc=H('#ff9a3c'), weapon='hammer', horn_up=18, horn_out=22, curl=2, foot=H('#4a423a'))),
    'd_pyra': ('caster', dict(scale=0.86, robe=H('#a3341c'), trim=H('#f0b13a'), skin=H('#e8b088'), mask=H('#f4e0c0'), eye=H('#ff5a1a'), glowc=H('#ff8a2a'), flamehair=H('#ff9a2a'), orbs=4)),
    'd_ignis': ('lord', dict(scale=0.86, skin=H('#4a3238'), plate=H('#221a28'), spike=H('#0e0a12'), glowc=H('#ff6a1a'), fire=H('#ffa23a'), eye=H('#ffe066'), wing=H('#4a1a14'))),
    # Zephyria
    'd_zephyrclaw': ('beast', dict(hide=H('#c6dcef'), belly=H('#f0f6fb'), spine=H('#7fb4e0'), horn=H('#5b7a9a'), eye=H('#5eead4'), glowc=H('#7dd3fc'), ears=H('#a9c8e4'), horns=False,
                                   mane=H('#e8f4ff'), tailtip=H('#7fb4e0'), wings=H('#dbeafe'))),
    'd_baruch': ('elemental', dict(scale=0.92, stone=H('#5d6478'), glowc=H('#fde047'), ring=H('#fef08a'), bolt=H('#fffbd0'))),
    'd_skyshredder': ('knight', dict(armor=H('#b08a4a'), under=H('#4a3a2a'), cape=H('#6b8fb5'), horn=H('#3a2c1c'), eye=H('#7dd3fc'), glowc=H('#7dd3fc'), weapon='sword', bladewings=H('#d8dee8'), blade=H('#e8edf5'), blade_glow=H('#bae6fd'))),
    'd_vael': ('caster', dict(scale=0.9, robe=H('#4b3a78'), trim=H('#c4b5fd'), skin=H('#b8b0d8'), hood=H('#2e2450'), mask=H('#d8d4ec'), eye=H('#a5f3fc'), glowc=H('#a78bfa'), weapon='scythe', orbs=3)),
    # Aquatica
    'd_frostbite': ('hulk', dict(scale=0.94, skin=H('#5d86a8'), belly=H('#9cc4de'), shoulder=H('#a8d8f0'), horn=H('#e0f2ff'), eye=H('#e0ffff'), glowc=H('#9fe8ff'), crystal=H('#d0f0ff'), claws=H('#e8f8ff'), horn_up=22, curl=2)),
    'd_queen': ('caster', dict(scale=0.9, robe=H('#0f6e6a'), trim=H('#fbcfe8'), skin=H('#7fc8c0'), mask=H('#c8f0ea'), eye=H('#fef08a'), glowc=H('#5eead4'), crown=H('#f472b6'), tentacles=H('#2a8a84'), orbs=3)),
    'd_paladin': ('knight', dict(armor=H('#b8d8ec'), under=H('#47657e'), cape=H('#2c4a6a'), horn=H('#e8f6ff'), eye=H('#7dd3fc'), glowc=H('#bae6fd'), weapon='sword', shield=H('#8ab8d8'), blade=H('#e0f4ff'), blade_glow=H('#bae6fd'), guard=H('#e8f4ff'))),
    'd_hydros': ('leviathan', dict(hide=H('#2b5d8a'), belly=H('#9fd0ea'), ice=H('#d8f4ff'), eye=H('#fef9c3'), glowc=H('#7dd3fc'), frill=H('#5aa0c8'))),
    # The Void Wastes
    'd_voidknight': ('knight', dict(armor=H('#3a2d52'), under=H('#1c1428'), cape=H('#5b21b6'), horn=H('#140e1e'), eye=H('#d8b4fe'), glowc=H('#a855f7'), weapon='sword', blade=H('#2a2238'), blade_glow=H('#c084fc'),
                                    runes=[(-14, 124, -4, 104), (14, 124, 4, 104), (-6, 96, 6, 96)], core=H('#c084fc'))),
    'd_amalgam': ('beast', dict(hide=H('#a85a62'), belly=H('#d8949a'), spine=H('#5a2a34'), horn=H('#e8dcd0'), eye=H('#fef08a'), glowc=H('#f472b6'), tailtip=H('#5a2a34'), size=1.12, curl=3, horn_up=14,
                                extra_eyes=[(18, 20, 20), (-20, 14, 10), (24, 6, -12), (-22, 22, -26), (0, 32, -10), (14, 26, -36)])),
    'd_echo': ('caster', dict(scale=0.9, robe=H('#6d4aa8'), trim=H('#e9d5ff'), skin=H('#c4b5fd'), hood=H('#4c2f86'), mask=H('#ede9fe'), eye=H('#f0abfc'), glowc=H('#c084fc'), crown=H('#2a1a3e'), orbs=5)),
    'd_reliquary': ('knight', dict(armor=H('#6a6070'), under=H('#2a2430'), cape=H('#3c2a4e'), horn=H('#1e1824'), eye=H('#fde68a'), glowc=H('#fbbf24'), weapon='sword', lantern=True, core=H('#fcd34d'), size=1.12,
                                   blade=H('#8a8094'), blade_glow=H('#fde68a'), spike=H('#3a3040'))),
    'd_malakor': ('archmage', dict(scale=0.84, robe=H('#2a1a44'), trim=H('#c084fc'), skin=H('#9a8ab8'), mask=H('#d8cff0'), eye=H('#f0abfc'), glowc=H('#b06bff'), cape=H('#170e26'), plate=H('#3a2c52'),
                                   obsidian=H('#140e1e'), ring=H('#e9d5ff'))),
}


def noise_field(seed):
    rng = np.random.default_rng(seed)
    small = rng.random((14, 14)).astype(np.float32)
    big = Image.fromarray((small * 255).astype(np.uint8)).resize((CELL * SS, CELL * SS), Image.BICUBIC)
    fine = rng.random((CELL * SS // 4, CELL * SS // 4)).astype(np.float32)
    fine = np.array(Image.fromarray((fine * 255).astype(np.uint8)).resize((CELL * SS, CELL * SS), Image.BILINEAR)).astype(np.float32) / 255
    return np.array(big).astype(np.float32) / 255 * 0.7 + fine * 0.3


def dissolve(img, d, nf, ember, f, seed):
    """Burn a frame away: pixels whose noise is under d vanish, a rim of embers at the burning edge."""
    a = np.array(img).astype(np.float32)
    alpha = a[:, :, 3]
    gone = nf < d
    edge = (~gone) & (nf < d + 0.07) & (alpha > 0)
    a[gone, 3] = 0
    for k in range(3):
        a[:, :, k] = np.where(edge, ember[k], a[:, :, k])
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    # rising embers
    rng = np.random.default_rng(seed * 100 + f)
    gl = Image.new('RGBA', out.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    ys, xs = np.where(alpha > 40)
    if len(ys):
        for _ in range(int(14 + 30 * d)):
            i = rng.integers(len(ys))
            x, y = xs[i], ys[i] - rng.random() * 60 * SS * d
            r = (1.5 + rng.random() * 2.5) * SS
            gd.ellipse([x - r, y - r, x + r, y + r], fill=ember + (230,))
    glow = gl.filter(ImageFilter.GaussianBlur(3 * SS))
    out = Image.alpha_composite(out, glow)
    return Image.alpha_composite(out, gl)


def scaled(fn, sc):
    """A body plan drawn at a size (the tall ones are brought into the cell)."""
    if sc == 1:
        return fn

    def g(p, anim, f, n):
        parts = fn(p, anim, f, n)
        for q in parts:
            q.pts = [(x * sc, y * sc, z * sc) for x, y, z in q.pts]
            if q.r:
                q.r = (q.r[0] * sc, q.r[1] * sc)
        return parts
    return g


def build_one(kind):
    plan, p = DEMONS[kind]
    fn = scaled(PLANS[plan], p.get('scale', 1))
    seed = sum(map(ord, kind))
    nf = noise_field(seed)
    ember = p.get('glowc', (255, 140, 60))
    tops = []
    feet = None
    sheets = {}
    for anim, nfr in FRAMES.items():
        sheet = Image.new('RGBA', (CELL * nfr, CELL * 5), (0, 0, 0, 0))
        for row, yaw in enumerate(YAWS):
            for f in range(nfr):
                if anim == 'die':
                    # Recoil, sag and fall back, then burn away to embers.
                    parts = fn(p, 'move', 0, 6)
                    fall = [0.0, 0.12, 0.35, 0.6, 0.8, 0.9][f]
                    sink = [0, 4, 14, 26, 34, 38][f]
                    big = render(parts, yaw, (fall, sink, -4 * f))
                    d = [0, 0, 0.06, 0.22, 0.46, 0.74][f]
                    if d > 0:
                        big = dissolve(big, d, nf, ember, f, seed + row)
                else:
                    big = render(fn(p, anim, f, nfr), yaw)
                cell = shrink(big)
                sheet.paste(cell, (f * CELL, row * CELL))
                if anim == 'move':
                    al = np.array(cell)[:, :, 3]
                    ys = np.where(al.max(axis=1) > 40)[0]
                    if len(ys):
                        tops.append(ys.min())
        sheets[anim] = sheet
        sheet.quantize(colors=200, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, f'{kind}-{anim}.png'), optimize=True)
    height = GY - int(np.median(tops)) if tops else 150
    # The portrait: the front-facing first frame, head and shoulders.
    first = sheets['move'].crop((0, 0, CELL, CELL))
    al = np.array(first)[:, :, 3]
    ys, xs = np.where(al > 40)
    top = int(ys.min())
    cxm = int((xs.min() + xs.max()) / 2)
    side = 96
    box = (max(0, cxm - side // 2), max(0, top - 6), max(0, cxm - side // 2) + side, max(0, top - 6) + side)
    first.crop(box).resize((100, 100), Image.LANCZOS).save(os.path.join(NPC_OUT, f'{kind}-portrait.png'), optimize=True)
    return {a: FRAMES[a] for a in FRAMES}, (CX, GY), height


def write_atlas(info):
    path = os.path.join(ROOT, 'src', 'game', 'world', 'demonAtlas.ts')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/** Generated by tools/build-demons.py — do not edit. */\n')
        f.write(f'/** The bosses\' own art: {CELL} px cells, five facing rows; the file is images/world/enemy/<key>.png. */\n')
        f.write(f'export const DEMON_CELL = {CELL};\n')
        f.write('export const DEMON_SHEETS: Record<string, number> = {\n')
        for k in sorted(info):
            for a, n in info[k][0].items():
                f.write(f"    '{k}-{a}': {n},\n")
        f.write('};\n/** Feet (x, y) in a cell, and how tall the figure stands (px), per demon. */\n')
        f.write('export const DEMON_FEET: Record<string, [number, number]> = {\n')
        for k in sorted(info):
            f.write(f'    {k}: [{info[k][1][0]}, {info[k][1][1]}],\n')
        f.write('};\nexport const DEMON_HEIGHT: Record<string, number> = {\n')
        for k in sorted(info):
            f.write(f'    {k}: {info[k][2]},\n')
        f.write('};\n')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or list(DEMONS)
    info = {}
    for k in DEMONS:
        if k in want:
            info[k] = build_one(k)
            print(k, info[k][2], flush=True)
        else:
            # keep the others' entries: read their move sheet back for the height
            try:
                im = Image.open(os.path.join(OUT, f'{k}-move.png')).convert('RGBA')
                al = np.array(im)[:CELL, :CELL, 3]
                ys = np.where(al.max(axis=1) > 40)[0]
                info[k] = ({a: FRAMES[a] for a in FRAMES}, (CX, GY), GY - int(ys.min()) if len(ys) else 150)
            except FileNotFoundError:
                pass
    write_atlas(info)
