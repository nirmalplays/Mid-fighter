"""
The hero's looks for the character creator. The game dresses the hero's sheets itself at load time
(skin, outfit and trim recoloured, hair, headwear, face and gear pieces drawn on), so this prepares
what that needs:

  * where the head is in every frame of every hero sheet (src/game/world/heroHeads.ts), and
  * every piece as 5-row strips (one 180 px cell per facing row), drawn for a head centred at
    (90, 70) in its cell; the game shifts them onto each frame's head. A piece has up to three layers:
      <kind>-<name>.png        drawn over the hero, in a neutral grey the game tints (multiply),
      <kind>-<name>-under.png  drawn behind the hero (a cape behind the body, a ponytail behind the head),
      <kind>-<name>-fix.png    drawn over the hero in its own colours (metal, a gem, a leather patch).
    Kinds: hair (hairstyles and hats), acc (headwear), face (eyepatch, earrings), gear (cape, pauldron).

Everything is drawn the way build-npcs.py draws the story's people: flat fills lit from above and the
pack's thick plum outline (52, 1, 41).

    python tools/build-hero-looks.py
"""
import importlib.util
import json
import math
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('npcs', os.path.join(ROOT, 'tools', 'build-npcs.py'))
npcs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(npcs)
CELL = npcs.CELL
SS = npcs.SS
SRC = npcs.SRC
OUT = os.path.join(ROOT, 'public', 'images', 'world', 'hero')
GREY = (226, 226, 226)
SHADE = (176, 176, 176)
CX, CY = 90, 70

# The first styles are build-npcs' own (kept identical so old saves look the same).
NPC_HAIRS = {'short': 'cropped', 'bun': 'bun', 'spiky': 'cap'}
NPC_ACCS = {'goggles': dict(goggles=GREY), 'headband': dict(band=GREY)}
NEW_HAIRS = ['long', 'ponytail', 'braids', 'mohawk', 'curls', 'hood', 'helmet', 'aviator']
NEW_ACCS = ['scarf', 'bandana', 'circlet', 'crown']
FACES = ['eyepatch', 'earrings']
GEARS = ['cape', 'pauldron']


class Cell:
    """One supersampled cell with head-unit coordinates and three layers (over, under, fixed)."""

    def __init__(self, row, R):
        n = CELL * SS
        self.row = row
        yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / SS
        self.X, self.Y = (xx - CX) / R, (yy - CY) / R
        self.disk = self.X * self.X + self.Y * self.Y
        self.over = npcs.layer(n)
        self.under = npcs.layer(n)
        self.fix = npcs.layer(n)

    def ell(self, x, y, rx, ry):
        return ((self.X - x) / rx) ** 2 + ((self.Y - y) / ry) ** 2 < 1

    def chain(self, pts, radii):
        """Union of circles along a path (interpolated), for tails, braids and capes' edges."""
        m = np.zeros(self.X.shape, bool)
        for (x0, y0), (x1, y1), r0, r1 in zip(pts, pts[1:], radii, radii[1:]):
            steps = max(2, int(math.hypot(x1 - x0, y1 - y0) / 0.04))
            for k in range(steps + 1):
                t = k / steps
                x, y, r = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t
                m |= (self.X - x) ** 2 + (self.Y - y) ** 2 < r * r
        return m

    def cap(self, extent=-0.25, swell=1.08):
        """build-npcs' hair cap: the scalp, reaching further down at the back in the turned rows."""
        X, Y, d, row = self.X, self.Y, self.disk, self.row
        m = (d < swell * swell) & (Y < extent)
        # Turned away: the hairline runs diagonally down the back of the head (no square notch).
        if row == 1:
            m |= (d < swell * swell) & (Y < np.minimum(0.4, extent + np.maximum(0, X - 0.1) * 1.4))
        if row == 2:
            m |= (d < swell * swell) & (Y < np.minimum(0.6, extent + np.maximum(0, X + 0.1) * 1.5))
        if row in (3, 4):
            m |= (d < swell * swell) & (Y < (0.55 if row == 4 else 0.45))
        return m

    def images(self):
        out = []
        for can in (self.over, self.under, self.fix):
            img = Image.fromarray(np.clip(can, 0, 255).astype(np.uint8), 'RGBA').resize((CELL, CELL), Image.LANCZOS)
            out.append(img)
        return out


def flat(canvas, mask, col):
    """Fill without an outline (folds, shading, highlights inside an outlined shape)."""
    for k in range(3):
        canvas[:, :, k] = np.where(mask, col[k], canvas[:, :, k])


def braid(c, layer, x, y0, y1, r=0.17, drift=0.0):
    """A plait: beads painted top to bottom, each with its own outline, so the segments read."""
    n = max(2, int((y1 - y0) / (r * 1.25)))
    for k in range(n + 1):
        t = k / n
        rr = r * (1.0 - 0.25 * t)
        npcs.paint(layer, c.ell(x + drift * t, y0 + (y1 - y0) * t, rr * 1.08, rr), GREY)
    npcs.paint(layer, c.ell(x + drift, y1 + r * 0.9, r * 0.55, r * 0.45), SHADE, shade=False)


def hair(c, name):
    X, Y, d, row = c.X, c.Y, c.disk, c.row
    if name == 'long':
        # Long hair falling past the shoulders: rounded locks, a few strands marked in.
        npcs.paint(c.over, c.cap(-0.25, 1.08), GREY)
        if row == 0:
            for sx in (-1, 1):
                lock = c.chain([(0.8 * sx, -0.35), (0.98 * sx, 0.45), (0.95 * sx, 1.2), (0.8 * sx, 1.5)], [0.26, 0.26, 0.2, 0.12])
                lock &= np.abs(X) > 0.66
                npcs.paint(c.over, lock, GREY)
                flat(c.over, lock & (np.abs(np.abs(X) - 0.92) < 0.035) & (Y > 0.1) & (Y < 1.3), SHADE)
        elif row in (1, 2):
            mass = c.chain([(0.5, -0.55), (0.82, 0.35), (0.86, 1.2), (0.7, 1.62)], [0.56, 0.5, 0.36, 0.14]) & (X > (0.2 if row == 1 else 0.08))
            mass |= c.cap(-0.25, 1.08)
            npcs.paint(c.over, mass, GREY)
            for k, off in enumerate((0.55, 0.85)):
                flat(c.over, mass & (np.abs(X - off - 0.1 * np.clip(Y, 0, 2)) < 0.035) & (Y > 0.3) & (Y < 1.35 - 0.2 * k), SHADE)
        else:
            x0 = 0.0 if row == 4 else 0.12
            mass = c.chain([(x0, -0.2), (x0, 0.8), (x0, 1.3)], [1.05, 0.95, 0.72]) & (np.abs(X - x0) < 1.04) & (Y < 1.72)
            mass |= c.cap(-0.25, 1.08)
            npcs.paint(c.over, mass, GREY)
            for off in (-0.45, 0.0, 0.45):
                flat(c.over, mass & (np.abs(X - x0 - off) < 0.035) & (Y > 0.5) & (Y < 1.5), SHADE)
    elif name == 'ponytail':
        m = c.cap(-0.3, 1.08)
        if row == 0:
            tail = c.chain([(0.55, -0.85), (1.05, -0.4), (1.12, 0.35), (0.95, 0.9)], [0.3, 0.32, 0.26, 0.12])
            npcs.paint(c.under, tail, GREY)
        elif row in (1, 2):
            tail = c.chain([(0.75, -0.75), (1.3, -0.45), (1.42, 0.3), (1.25, 0.95)], [0.3, 0.32, 0.25, 0.1])
            npcs.paint(c.over, tail, GREY)
            npcs.paint(c.over, c.ell(0.82, -0.62, 0.16, 0.2), SHADE, shade=False)
        else:
            tx = 0.0 if row == 4 else 0.3
            tail = c.chain([(tx, -0.55), (tx + 0.05, 0.3), (tx, 1.0), (tx - 0.05, 1.45)], [0.3, 0.3, 0.24, 0.1])
            m |= tail
        npcs.paint(c.over, m, GREY)
        if row in (3, 4):
            tx = 0.0 if row == 4 else 0.3
            npcs.paint(c.over, c.ell(tx, -0.5, 0.24, 0.12), SHADE, shade=False)
    elif name == 'braids':
        npcs.paint(c.over, c.cap(-0.3, 1.08), GREY)
        if row == 0:
            for sx in (-0.86, 0.86):
                braid(c, c.over, sx, -0.05, 1.35, drift=0.05 * (1 if sx > 0 else -1))
        elif row in (1, 2):
            braid(c, c.over, 0.78 if row == 1 else 0.7, 0.05, 1.45, drift=0.08)
        else:
            for sx in ((-0.5, 0.5) if row == 4 else (-0.15, 0.75)):
                braid(c, c.over, sx, 0.3, 1.6)
    elif name == 'mohawk':
        saw = lambda t: t - np.floor(t)
        if row == 0:
            # Seen from the front: a crest of three spikes fanning up off the crown.
            m = (np.abs(X) < 0.26) & (d < 1.04 ** 2) & (Y < -0.45)
            for sx, h, lean in ((-0.15, 1.34, -0.12), (0.0, 1.5, 0.0), (0.15, 1.34, 0.12)):
                t = np.clip((-Y - 0.8) / (h - 0.8), 0, 1)
                m |= (Y < -0.8) & (Y > -h) & (np.abs(X - sx - lean * t) < 0.11 * (1 - t) + 0.01)
        elif row in (1, 2):
            # From the side: a fin swept back over the head, its spikes leaning backwards.
            ang = np.arctan2(Y, X)
            jag = 1.06 + 0.34 * saw(ang * 6 / np.pi * 1.0)
            m = (np.sqrt(d) < jag) & (Y < (-0.4 if row == 2 else -0.45)) & (X > -0.62)
            m |= (np.sqrt(d) < 1.06) & (X > 0.45) & (Y < 0.2)
        else:
            x0 = 0.15 if row == 3 else 0.0
            m = (np.abs(X - x0) < 0.26) & (Y < 0.55) & (d < 1.06 ** 2)
            for sx, h, lean in ((-0.15, 1.3, -0.12), (0.0, 1.44, 0.0), (0.15, 1.3, 0.12)):
                t = np.clip((-Y - 0.8) / (h - 0.8), 0, 1)
                m |= (Y < -0.8) & (Y > -h) & (np.abs(X - x0 - sx - lean * t) < 0.11 * (1 - t) + 0.01)
        npcs.paint(c.over, m, GREY)
        # The shaved sides: a soft stubble shade on the scalp.
        if row == 0:
            st = (d < 0.98 ** 2) & (Y < -0.35) & (np.abs(X) > 0.38)
        elif row in (1, 2):
            st = (d < 0.98 ** 2) & (Y < 0.15) & (Y > -0.42) & (X > 0.0)
        else:
            st = (d < 0.98 ** 2) & (Y < 0.4) & (np.abs(X - (0.15 if row == 3 else 0.0)) > 0.4)
        flat(c.fix, st, (40, 30, 34))
        c.fix[:, :, 3] = np.where(st, 46, c.fix[:, :, 3])
    elif name == 'curls':
        m = c.cap(-0.15, 1.12)
        ring = [(-150 + 25 * k) for k in range(13)] if row == 0 else [(-170 + 22 * k) for k in range(16)]
        for a in ring:
            rad = math.radians(a)
            x, y = math.cos(rad) * 1.05, math.sin(rad) * 1.05
            if row == 0 and y > 0.15:
                continue
            if row in (1, 2) and y > 0.15 and x < 0.3:
                continue
            m |= c.ell(x, y, 0.32, 0.3)
        if row in (3, 4):
            for x in (-0.75, -0.25, 0.25, 0.75):
                m |= c.ell(x + (0.15 if row == 3 else 0), 0.55, 0.3, 0.28)
        if row == 0:
            for x in (-0.95, 0.95):
                m |= c.ell(x, 0.12, 0.26, 0.28)
        npcs.paint(c.over, m, GREY)
        # Curl marks inside the mass.
        for k in range(9):
            a = math.radians(-160 + 20 * k)
            x, y = math.cos(a) * 0.82, math.sin(a) * 0.82
            if row == 0 and y > -0.35:
                continue
            flat(c.over, c.ell(x, y, 0.1, 0.07) & m, SHADE)
    elif name == 'hood':
        if row == 0:
            m = (d < 1.2 ** 2) & (Y < 0.7)
            m &= ~c.ell(0.0, 0.32, 0.8, 0.86)
            m |= c.ell(0.0, -1.08, 0.3, 0.22)
            cowl = c.ell(0.0, 1.02, 1.05, 0.3)
        elif row in (1, 2):
            fx = -0.42 if row == 1 else -0.62
            m = (d < 1.2 ** 2) & (Y < 0.75)
            m &= ~c.ell(fx, 0.3, 0.68 if row == 1 else 0.55, 0.84)
            m |= c.chain([(0.7, -0.8), (1.25, -0.55), (1.45, -0.15)], [0.35, 0.22, 0.09])
            cowl = c.ell(0.3, 0.98, 0.6, 0.22)
        else:
            m = (d < 1.2 ** 2) & (Y < 0.95)
            m |= c.chain([(0.0, -0.6), (0.05, 0.4), (0.1, 1.3)], [0.4, 0.3, 0.12]) if row == 4 else c.chain([(0.3, -0.6), (0.4, 0.4), (0.45, 1.3)], [0.4, 0.3, 0.12])
            cowl = c.ell(0.0, 1.02, 1.05, 0.32)
        npcs.paint(c.over, cowl, GREY)
        npcs.paint(c.over, m, GREY)
        # The inside of the hood, shadowed around the face.
        if row < 3:
            fx = 0.0 if row == 0 else (-0.42 if row == 1 else -0.62)
            rim = c.ell(fx, 0.32, 0.88 if row == 0 else 0.76, 0.94) & ~c.ell(fx, 0.38, 0.8 if row == 0 else 0.66, 0.86) & (d < 1.12 ** 2) & (Y < 0.6)
            flat(c.over, rim, (120, 120, 120))
            c.over[:, :, 3] = np.where(rim, 255, c.over[:, :, 3])
    elif name == 'helmet':
        # The miner's helmet: brass, with its lamp lit (its own colours).
        m = (d < 1.12 ** 2) & (Y < -0.3)
        m |= (np.abs(X) < 1.25) & (Y > -0.42) & (Y < -0.28)
        npcs.paint(c.fix, m, (212, 168, 60))
        flat(c.fix, m & (Y < -0.85) & (X < -0.1) & (X > -0.55), (238, 206, 120))
        lamp = ((X + (0.0 if row not in (1, 2) else -0.5)) ** 2 + (Y + 0.62) ** 2 < 0.16 ** 2) & (row < 3)
        if lamp.any():
            npcs.paint(c.fix, lamp, (255, 240, 170), shade=False)
    elif name == 'aviator':
        m = (d < 1.1 ** 2) & (Y < -0.15)
        if row in (0, 1, 3, 4):
            m |= (np.abs(np.abs(X) - 0.95) < 0.2) & (Y > -0.3) & (Y < 0.5)
        if row == 2:
            m |= (X > 0.0) & (d < 1.1 ** 2) & (Y < 0.5)
        npcs.paint(c.fix, m, (128, 84, 52))
        flat(c.fix, m & (np.abs(Y + 0.62) < 0.05) & (d < 1.0), (92, 58, 36))


def acc(c, name):
    X, Y, d, row = c.X, c.Y, c.disk, c.row
    if name == 'scarf':
        # Wrapped under the chin (never over the face), a tail hanging from the knot.
        x0 = {0: 0.0, 1: -0.12, 2: -0.2, 3: 0.08, 4: 0.0}[row]
        rx = 0.7 if row in (0, 4) else 0.58
        wrap = c.ell(x0, 1.05, rx, 0.2) & (d >= 0.96 ** 2)
        tx = {0: 0.38, 1: 0.32, 2: 0.42, 3: 0.2, 4: -0.2}[row]
        tail = c.chain([(tx, 1.08), (tx + 0.08, 1.45), (tx + 0.04, 1.72)], [0.13, 0.12, 0.1])
        npcs.paint(c.over, tail, SHADE)
        npcs.paint(c.over, wrap, GREY)
        flat(c.over, wrap & (np.abs(X - x0 - 0.25) < 0.035), SHADE)
    elif name == 'bandana':
        m = (d < 1.13 ** 2) & (Y < -0.3)
        if row in (1, 2):
            m |= (d < 1.13 ** 2) & (Y < 0.05) & (X > 0.45)
        if row in (3, 4):
            m = (d < 1.13 ** 2) & (Y < 0.15)
        npcs.paint(c.over, m, GREY)
        # A row of spots, and the knot with its tails at the back.
        for k in range(-3, 4):
            flat(c.over, c.ell(k * 0.28, -0.62 + 0.1 * abs(k) ** 1.4 * 0.3, 0.06, 0.05) & m, (255, 255, 255))
        kx = {0: None, 1: 1.08, 2: 1.1, 3: 0.35, 4: 0.0}[row]
        if kx is not None:
            ky = -0.2 if row in (1, 2) else 0.1
            npcs.paint(c.over, c.chain([(kx, ky), (kx + 0.25, ky + 0.55)], [0.14, 0.08]), SHADE)
            npcs.paint(c.over, c.chain([(kx, ky), (kx - 0.1, ky + 0.6)], [0.13, 0.07]), SHADE)
            npcs.paint(c.over, c.ell(kx, ky, 0.17, 0.14), GREY)
    elif name == 'circlet':
        band = (d < 1.08 ** 2) & (np.abs(Y + 0.45) < 0.065)
        if row in (1, 2):
            band &= X < 0.95
        npcs.paint(c.over, band, GREY, shade=False)
        gx = {0: 0.0, 1: -0.62, 2: -0.92, 3: None, 4: None}[row]
        if gx is not None:
            npcs.paint(c.over, c.ell(gx, -0.47, 0.17 if row < 2 else 0.11, 0.17), GREY, shade=False)
            gem = c.ell(gx, -0.47, 0.1 if row < 2 else 0.06, 0.1)
            flat(c.fix, gem, (157, 107, 255))
            c.fix[:, :, 3] = np.where(gem, 255, c.fix[:, :, 3])
            flat(c.fix, gem & c.ell(gx - 0.03, -0.51, 0.04, 0.04), (230, 214, 255))
    elif name == 'crown':
        base = (np.abs(X) < 0.62) & (Y < -0.78) & (Y > -1.02)
        spikes = np.zeros_like(base)
        for sx in (-0.48, 0.0, 0.48):
            h = 0.48 if sx == 0 else 0.34
            spikes |= (Y < -1.0) & (Y > -1.0 - h) & (np.abs(X - sx) < 0.13 * (1 - (-(Y + 1.0)) / h))
        if row in (1, 2):
            base = (np.abs(X - 0.1) < 0.5) & (Y < -0.82) & (Y > -1.04)
            spikes = np.zeros_like(base)
            for sx in (-0.25, 0.15, 0.5):
                h = 0.4
                spikes |= (Y < -1.02) & (Y > -1.02 - h) & (np.abs(X - sx) < 0.12 * (1 - (-(Y + 1.02)) / h))
        npcs.paint(c.over, base | spikes, GREY)
        if row in (0, 4):
            gem = c.ell(0.0, -0.9, 0.08, 0.07)
            flat(c.fix, gem, (200, 40, 60))
            c.fix[:, :, 3] = np.where(gem, 255, c.fix[:, :, 3])


def face(c, name):
    X, Y, d, row = c.X, c.Y, c.disk, c.row
    leather = (58, 40, 40)
    if name == 'eyepatch':
        # Over the hero's right eye (left in the picture), the strap across the head.
        ex, ey = {0: (-0.45, 0.3), 1: (-0.63, 0.12), 2: (-0.5, 0.24), 3: (None, None), 4: (None, None)}[row]
        if row == 0:
            strap = (np.abs((Y + 0.05) - (X + 0.45) * -0.55) < 0.055) & (d < 1.04 ** 2)
        elif row in (1, 2):
            strap = (np.abs((Y + 0.15) - (X + 0.6) * -0.2) < 0.055) & (d < 1.04 ** 2) & (X < 1.0)
        else:
            strap = (np.abs((Y + 0.35) - X * 0.25) < 0.055) & (d < 1.04 ** 2)
        npcs.paint(c.fix, strap, leather, shade=False)
        if ex is not None:
            npcs.paint(c.fix, c.ell(ex, ey, 0.27 if row != 1 else 0.22, 0.26), leather, shade=False)
    elif name == 'earrings':
        gold = (232, 186, 72)
        spots = {0: [(-0.98, 0.5), (0.98, 0.5)], 1: [(0.5, 0.62)], 2: [(0.22, 0.66)], 3: [(-0.95, 0.5)], 4: [(-0.98, 0.5), (0.98, 0.5)]}[row]
        for x, y in spots:
            ring = c.ell(x, y + 0.1, 0.13, 0.15) & ~c.ell(x, y + 0.1, 0.05, 0.07)
            npcs.paint(c.fix, ring, gold, shade=False)


def gear(c, name):
    X, Y, d, row = c.X, c.Y, c.disk, c.row
    if name == 'cape':
        def drape(x0, top, bottom, half, flare):
            t = np.clip((Y - top) / (bottom - top), 0, 1)
            w = half + flare * np.sqrt(t)
            hem = bottom + 0.07 * np.sin((X - x0) * 10)
            return (np.abs(X - x0) < w) & (Y > top) & (Y < hem)
        if row == 0:
            # Behind the hero, showing at the sides; over the shoulders, a short mantle and a clasp.
            m = drape(0.0, 0.95, 2.4, 0.8, 0.42)
            npcs.paint(c.under, m, GREY)
            for fx in (-0.98, 0.98):
                flat(c.under, m & (np.abs(X - fx) < 0.06) & (Y > 1.55), SHADE)
            mantle = c.ell(0.0, 1.0, 0.98, 0.3) & (Y > 0.96)
            npcs.paint(c.over, mantle, GREY)
            npcs.paint(c.fix, c.ell(0.0, 1.12, 0.12, 0.1), (224, 178, 70), shade=False)
        elif row in (1, 2):
            x0 = 0.5 if row == 1 else 0.42
            m = drape(x0, 0.95, 2.4, 0.4, 0.4) & (X > (-0.05 if row == 1 else 0.02))
            npcs.paint(c.over, m, GREY)
            flat(c.over, m & (np.abs(X - (x0 + 0.38)) < 0.05) & (Y > 1.5), SHADE)
        else:
            x0 = 0.0 if row == 4 else 0.12
            m = drape(x0, 0.93, 2.4, 0.74, 0.36)
            m |= c.ell(x0, 1.02, 0.95, 0.28) & (Y > 0.96)
            npcs.paint(c.over, m, GREY)
            for fx in (-0.42, 0.0, 0.42):
                flat(c.over, m & (np.abs(X - x0 - fx) < 0.045) & (Y > 1.5), SHADE)
    elif name == 'pauldron':
        steel, dark, leather = (170, 176, 192), (118, 124, 146), (96, 62, 44)
        px = {0: 0.78, 1: 0.55, 2: 0.12, 3: -0.62, 4: -0.78}[row]
        sx = 1 if px >= 0 else -1
        # A leather strap across the chest (front) or back, then the plates: two lames under a dome.
        if row == 0:
            strap = c.chain([(0.6, 1.05), (-0.55, 1.78)], [0.07, 0.07])
        elif row == 4:
            strap = c.chain([(-0.6, 1.05), (0.55, 1.78)], [0.07, 0.07])
        else:
            strap = np.zeros_like(X, dtype=bool)
        if strap.any():
            npcs.paint(c.fix, strap, leather, shade=False)
        k = 1.0 if row in (0, 4) else 0.78
        npcs.paint(c.fix, c.ell(px + 0.06 * sx, 1.36, 0.33 * k, 0.15 * k), dark, shade=False)
        npcs.paint(c.fix, c.ell(px + 0.03 * sx, 1.25, 0.37 * k, 0.16 * k), dark, shade=False)
        npcs.paint(c.fix, c.ell(px, 1.1, 0.4 * k, 0.24 * k) & (Y < 1.1 + 0.12 * k), steel)
        flat(c.fix, c.ell(px - 0.12 * sx, 1.02, 0.14, 0.06), (230, 234, 244))
        flat(c.fix, c.ell(px + 0.2 * sx, 1.14, 0.045, 0.045), (80, 82, 100))

def strips(kind, name, R, draw):
    """Draw a piece for the five facing rows and save its layers; returns the layers that hold anything."""
    rows = [[], [], []]
    for row in range(5):
        c = Cell(row, R)
        draw(c, name)
        for k, img in enumerate(c.images()):
            rows[k].append(img)
    have = []
    for k, suffix in enumerate(('', '-under', '-fix')):
        out = Image.new('RGBA', (CELL, CELL * 5))
        for row, img in enumerate(rows[k]):
            out.paste(img, (0, row * CELL))
        path = os.path.join(OUT, f'{kind}-{name}{suffix}.png')
        if out.getbbox():
            out.save(path, optimize=True)
            have.append(('over', 'under', 'fix')[k])
        elif os.path.exists(path):
            os.remove(path)
    return have


def npc_strip(R, p):
    out = Image.new('RGBA', (CELL, CELL * 5))
    for row in range(5):
        out.paste(npcs.pieces(row, CX, CY, R, p), (0, row * CELL))
    return out


def find_head_fast(rgba, R):
    """The same ring search as build-npcs, vectorised over every candidate centre."""
    a = rgba[:, :, 3] > 160
    dark = (a & (rgba[:, :, 0] < 110)).astype(np.uint8)
    ang = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    cys = np.arange(16, 116)
    cxs = np.arange(44, 136)
    best, at = -1, (90, 60)
    for cy in cys:
        xs = (cxs[:, None] + np.cos(ang)[None, :] * R).astype(int)
        ys = (cy + np.sin(ang) * R).astype(int)[None, :].repeat(len(cxs), 0)
        ok = (xs >= 0) & (xs < CELL) & (ys >= 0) & (ys < CELL)
        vals = np.where(ok, dark[np.clip(ys, 0, CELL - 1), np.clip(xs, 0, CELL - 1)], 0).sum(axis=1)
        k = int(np.argmax(vals))
        if vals[k] > best:
            best, at = int(vals[k]), (int(cxs[k]), int(cy))
    return at


def build(heads_too=True):
    os.makedirs(OUT, exist_ok=True)
    idle = np.array(Image.open(os.path.join(SRC, 'idle.png')).convert('RGBA'))
    R = npcs.measure_radius(idle[0:CELL, 0:CELL])
    layers = {}
    for name, style in NPC_HAIRS.items():
        npc_strip(R, dict(skin=GREY, cloth=GREY, hair=GREY, style=style)).save(os.path.join(OUT, f'hair-{name}.png'), optimize=True)
        layers[f'hair-{name}'] = ['over']
    for name, extra in NPC_ACCS.items():
        npc_strip(R, dict(skin=GREY, cloth=GREY, hair=None, style='none', **extra)).save(os.path.join(OUT, f'acc-{name}.png'), optimize=True)
        layers[f'acc-{name}'] = ['over']
    for name in NEW_HAIRS:
        layers[f'hair-{name}'] = strips('hair', name, R, hair)
    for name in NEW_ACCS:
        layers[f'acc-{name}'] = strips('acc', name, R, acc)
    for name in FACES:
        layers[f'face-{name}'] = strips('face', name, R, face)
    for name in GEARS:
        layers[f'gear-{name}'] = strips('gear', name, R, gear)
    path = os.path.join(ROOT, 'src', 'game', 'world', 'heroHeads.ts')
    if heads_too:
        heads = {}
        for f in sorted(os.listdir(SRC)):
            if not f.endswith('.png'):
                continue
            sheet = np.array(Image.open(os.path.join(SRC, f)).convert('RGBA'))
            rows, cols = sheet.shape[0] // CELL, sheet.shape[1] // CELL
            pts = []
            for row in range(rows):
                for col in range(cols):
                    cx, cy = find_head_fast(sheet[row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL], R)
                    pts += [cx, cy]
            heads[f[:-4]] = [cols, *pts]
            print(f, cols)
    else:
        import re
        heads = json.loads(re.search(r'HERO_HEADS: Record<string, number\[\]> = (.*);', open(path, encoding='utf-8').read()).group(1))
    with open(path, 'w', encoding='utf-8', newline='\n') as out:
        out.write('/** Generated by tools/build-hero-looks.py — do not edit. */\n')
        out.write(f'/** The head\'s radius in the hero\'s 180 px cells, and where its pieces (hair, accessories) are drawn centred. */\nexport const HEAD_R = {R:.1f};\nexport const PIECE_AT = [{CX}, {CY}] as const;\n')
        out.write('/** The layers each piece has (images/world/hero/<piece>[-under|-fix].png): tinted over the hero, tinted behind it, or in its own colours over it. */\n')
        out.write('export const PIECE_LAYERS: Record<string, readonly (\'over\' | \'under\' | \'fix\')[]> = ')
        out.write(json.dumps(layers, separators=(',', ':')))
        out.write(';\n')
        out.write('/** Per hero sheet (file name without .png): columns, then x, y of the head centre for every frame, row by row. */\n')
        out.write('export const HERO_HEADS: Record<string, number[]> = ')
        out.write(json.dumps(heads, separators=(',', ':')))
        out.write(';\n')


if __name__ == '__main__':
    import sys
    build(heads_too='--pieces-only' not in sys.argv)
