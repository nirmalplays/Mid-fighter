"""
Builds the story's people from the hero's own sheets (public/images/world/char): the same chibi body,
outline, proportions and animation frames, re-dressed per character: skin and clothes recoloured
(keeping the art's shading), then hair, beards, hats, crowns, goggles and aprons drawn on in the same
thick plum outline, following the head in every frame and every facing row.

    python tools/build-npcs.py

Writes public/images/world/npc/<who>-<anim>.png (same layout as the hero's: 5 facing rows of 180 px
cells) and src/game/world/npcAtlas.ts.
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'images', 'world', 'char')
OUT = os.path.join(ROOT, 'public', 'images', 'world', 'npc')
CELL = 180
SS = 4  # supersampling for the drawn-on pieces
OUTLINE = np.array([52, 1, 41], dtype=np.float32)

# Who, and how they are dressed. Colours are RGB; `hair` styles: cap, long, bun, bald, cropped, none.
PEOPLE = {
    'lyra': dict(skin=(242, 208, 176), cloth=(47, 111, 106), hair=(138, 58, 28), style='long', band=(224, 169, 72)),
    'orin': dict(skin=(232, 200, 168), cloth=(91, 59, 138), hair=None, style='bald', beard=(236, 232, 226), beard_size=(0.62, 0.55)),
    'bram': dict(skin=(200, 144, 106), cloth=(120, 120, 128), hair=(86, 56, 36), style='cropped', beard=(110, 72, 44), beard_size=(0.5, 0.36), apron=(122, 74, 42)),
    'kael': dict(skin=(240, 200, 160), cloth=(58, 90, 138), hair=(214, 112, 40), style='cap', goggles=(240, 190, 80)),
    'lin': dict(skin=(230, 198, 168), cloth=(106, 176, 216), hair=(240, 240, 246), style='bun', scarf=(224, 169, 72)),
    'thorne': dict(skin=(216, 168, 120), cloth=(138, 90, 51), hair=(96, 60, 30), style='aviator', goggles=(150, 210, 240)),
    'nerissa': dict(skin=(232, 200, 176), cloth=(42, 138, 138), hair=(30, 34, 48), style='long', goggles=(150, 230, 230)),
    'malakor': dict(skin=(214, 206, 222), cloth=(52, 38, 72), hair=(190, 190, 210), style='long', narrow=True, crown=(157, 107, 255), trim=(224, 169, 72)),
    'mason': dict(skin=(214, 160, 120), cloth=(154, 106, 60), hair=(106, 74, 42), style='helmet'),
    'mason2': dict(skin=(150, 100, 70), cloth=(110, 120, 90), hair=(106, 74, 42), style='helmet'),
}
ANIMS = {'idle': 8, 'walk': 6, 'swing-pickaxe': 6, 'die': 6}
WHO_ANIMS = {k: ['idle', 'walk'] for k in PEOPLE}
WHO_ANIMS['mason'] = ['idle', 'walk', 'swing-pickaxe', 'die']
WHO_ANIMS['mason2'] = ['idle', 'walk', 'swing-pickaxe', 'die']
WHO_ANIMS['lyra'] = ['idle', 'walk', 'die']


def find_head(rgba, R):
    """The head's centre: the point whose ring of radius R holds the most outline pixels."""
    a = rgba[:, :, 3] > 160
    dark = a & (rgba[:, :, 0] < 110)
    best, at = -1, (90, 60)
    ang = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    for cy in range(20, 110, 2):
        for cx in range(50, 130, 2):
            xs = (cx + np.cos(ang) * R).astype(int)
            ys = (cy + np.sin(ang) * R).astype(int)
            ok = (xs >= 0) & (xs < CELL) & (ys >= 0) & (ys < CELL)
            score = dark[ys[ok], xs[ok]].sum()
            if score > best:
                best, at = score, (cx, cy)
    # Refine to the pixel.
    cx0, cy0 = at
    for cy in range(cy0 - 2, cy0 + 3):
        for cx in range(cx0 - 2, cx0 + 3):
            xs = (cx + np.cos(ang) * R).astype(int)
            ys = (cy + np.sin(ang) * R).astype(int)
            ok = (xs >= 0) & (xs < CELL) & (ys >= 0) & (ys < CELL)
            score = dark[ys[ok], xs[ok]].sum()
            if score > best:
                best, at = score, (cx, cy)
    return at


def measure_radius(rgba):
    """Half the widest opaque run in the top part of the front idle frame (the head)."""
    a = rgba[:, :, 3] > 160
    rows = np.where(a.any(axis=1))[0]
    top = rows[0]
    widths = [a[y].sum() for y in range(top, top + 80)]
    return max(widths) / 2 - 2


def recolor(cell, cx, cy, R, p):
    out = cell.astype(np.float32).copy()
    h, w = cell.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    a = cell[:, :, 3] > 40
    r, g, b = cell[:, :, 0].astype(np.float32), cell[:, :, 1].astype(np.float32), cell[:, :, 2].astype(np.float32)
    light = a & (r > 150) & (np.abs(r - g) < 40) & (np.abs(r - b) < 40)
    lum = (r + g + b) / 3 / 253
    head = (xx - cx) ** 2 + (yy - cy) ** 2 < (R - 2) ** 2
    for mask, col in ((light & head, p['skin']), (light & ~head, p['cloth'])):
        for k in range(3):
            out[:, :, k] = np.where(mask, np.clip(col[k] * (0.55 + 0.45 * lum), 0, 255), out[:, :, k])
    # The plum strap lines take a darker shade of the cloth.
    strap = a & ~light & (r > 90) & (r < 140) & ~head
    for k in range(3):
        out[:, :, k] = np.where(strap, p['cloth'][k] * 0.6, out[:, :, k])
    return out


def layer(size):
    return np.zeros((size, size, 4), dtype=np.float32)


def paint(canvas, mask, col, shade=True):
    """Fill a mask (supersampled) with a colour, lit from above, and ring it with the plum outline."""
    h = mask.shape[0]
    ow = 6 * SS
    dil = mask.copy()
    # A round-ish dilation by shifting.
    for dy in range(-ow, ow + 1, SS):
        for dx in range(-ow, ow + 1, SS):
            if dx * dx + dy * dy > ow * ow:
                continue
            dil |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    ring = dil & ~mask
    yy = np.mgrid[0:h, 0:h][0]
    for k in range(3):
        fill = np.full(mask.shape, float(col[k]))
        if shade:
            fill = fill * (1.1 - 0.25 * (yy % (h // 1) / h))
        canvas[:, :, k] = np.where(mask, np.clip(fill, 0, 255), np.where(ring, OUTLINE[k], canvas[:, :, k]))
    canvas[:, :, 3] = np.where(mask | ring, 255, canvas[:, :, 3])


def pieces(row, cx, cy, R, p):
    """The drawn-on pieces for one frame, supersampled, in cell coordinates."""
    n = CELL * SS
    can = layer(n)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / SS
    X, Y = (xx - cx) / R, (yy - cy) / R  # head units; +x is the back of the head in rows 1-2 (they face left)
    disk = X * X + Y * Y
    style = p['style']
    face_side = row in (1, 2)
    back = row in (3, 4)
    hair = p.get('hair')

    def cap(extent=-0.2, swell=1.1):
        m = (disk < swell * swell) & (Y < extent)
        if row == 1:
            m |= (disk < swell * swell) & (X > 0.35) & (Y < 0.35)
        if row == 2:
            m |= (disk < swell * swell) & (X > 0.1) & (Y < 0.55)
        if back:
            m |= (disk < swell * swell) & (Y < (0.55 if row == 4 else 0.45))
        return m

    if style in ('cap', 'long', 'bun', 'cropped'):
        m = cap(-0.25 if style != 'cropped' else -0.45, 1.08 if style != 'cropped' else 1.04)
        if style == 'long':
            if row == 0:
                inner = 0.82 if p.get('narrow') else 0.76
                m |= ((np.abs(X) > inner) & (np.abs(X) < 1.08) & (Y > -0.3) & (Y < (1.25 if p.get('narrow') else 1.55)))
            elif row in (1, 2):
                m |= ((X > 0.15) & (X < 1.1) & (Y > -0.3) & (Y < 1.65))
            else:
                m |= ((np.abs(X) < 1.02) & (Y > 0) & (Y < 1.75))
        if style == 'bun':
            m |= ((X) ** 2 + (Y + 1.05) ** 2 < 0.27 ** 2)
        paint(can, m, hair)
    if style == 'helmet':
        m = (disk < 1.12 ** 2) & (Y < -0.3)
        m |= (np.abs(X) < 1.25) & (Y > -0.42) & (Y < -0.28)
        paint(can, m, (212, 168, 60))
        lamp = ((X + (0.0 if not face_side else -0.5)) ** 2 + (Y + 0.62) ** 2 < 0.16 ** 2) & (row < 3)
        if lamp.any():
            paint(can, lamp, (255, 240, 170), shade=False)
    if style == 'aviator':
        m = (disk < 1.1 ** 2) & (Y < -0.15)
        if row in (0, 1, 3, 4):
            m |= (np.abs(np.abs(X) - 0.95) < 0.2) & (Y > -0.3) & (Y < 0.5)
        if row == 2:
            m |= (X > 0.0) & (disk < 1.1 ** 2) & (Y < 0.5)
        paint(can, m, hair)
    if style == 'bald' and hair is not None:
        # A white fringe round the back of the head.
        m = (disk < 1.07 ** 2) & (disk > 0.8 ** 2) & (Y > -0.35) & (Y < 0.35)
        if row == 0:
            m &= np.abs(X) > 0.75
        elif row in (1, 2):
            m &= X > 0.3
        paint(can, m, hair)
    if p.get('band') is not None and row < 3:
        m = (disk < 1.1 ** 2) & (np.abs(Y + 0.32) < 0.09)
        if row in (1, 2):
            m &= X > -0.95
        paint(can, m, p['band'], shade=False)
    if p.get('goggles') is not None:
        gy = -0.5
        if row == 0:
            m = ((X + 0.38) ** 2 + (Y - gy) ** 2 < 0.24 ** 2) | ((X - 0.38) ** 2 + (Y - gy) ** 2 < 0.24 ** 2)
        elif row in (1, 2):
            m = (X + 0.45) ** 2 + (Y - gy) ** 2 < 0.26 ** 2
        else:
            m = (np.abs(Y - gy) < 0.08) & (disk < 1.05 ** 2)
        paint(can, m, p['goggles'], shade=False)
    if p.get('beard') is not None and not back:
        bx = 0.0 if row == 0 else -0.45
        bw, bh = p.get('beard_size', (0.62, 0.48))
        m = ((X - bx) / bw) ** 2 + ((Y - 0.8) / bh) ** 2 < 1
        m &= Y > 0.42
        paint(can, m, p['beard'])
    if p.get('crown') is not None:
        base = (np.abs(X) < 0.9) & (Y < -0.72) & (Y > -1.02)
        spikes = np.zeros_like(base)
        for sx in (-0.7, -0.35, 0.0, 0.35, 0.7):
            h = 0.75 if sx == 0 else 0.5
            spikes |= (Y < -0.95) & (Y > -0.95 - h) & (np.abs(X - sx) < 0.13 * (1 - (-(Y + 0.95)) / h))
        paint(can, base | spikes, p['crown'])
    if p.get('scarf') is not None:
        m = ((X / 0.72) ** 2 + ((Y - 1.08) / 0.17) ** 2 < 1)
        paint(can, m, p['scarf'])
    if p.get('apron') is not None and row in (0, 1):
        ax = 0.0 if row == 0 else -0.3
        m = (np.abs(X - ax) < 0.62) & (Y > 1.15) & (Y < 2.55)
        paint(can, m, p['apron'])
    if p.get('trim') is not None and row in (0, 1, 2):
        m = (np.abs(X - (0.0 if row == 0 else -0.2)) < 0.12) & (Y > 1.15) & (Y < 2.6)
        paint(can, m, p['trim'], shade=False)
    img = Image.fromarray(np.clip(can, 0, 255).astype(np.uint8), 'RGBA').resize((CELL, CELL), Image.LANCZOS)
    return img


def build():
    os.makedirs(OUT, exist_ok=True)
    idle = np.array(Image.open(os.path.join(SRC, 'idle.png')).convert('RGBA'))
    R = measure_radius(idle[0:CELL, 0:CELL])
    print('head radius', R)
    heads = {}
    sheets = {}
    for anim in ANIMS:
        sheets[anim] = np.array(Image.open(os.path.join(SRC, f'{anim}.png')).convert('RGBA'))
        rows, cols = sheets[anim].shape[0] // CELL, sheets[anim].shape[1] // CELL
        for row in range(rows):
            for col in range(cols):
                cell = sheets[anim][row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL]
                heads[(anim, row, col)] = find_head(cell, R)
    for who, p in PEOPLE.items():
        for anim in WHO_ANIMS[who]:
            src = sheets[anim]
            rows, cols = src.shape[0] // CELL, src.shape[1] // CELL
            out = Image.new('RGBA', (cols * CELL, rows * CELL))
            for row in range(rows):
                for col in range(cols):
                    cell = src[row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL]
                    cx, cy = heads[(anim, row, col)]
                    base = Image.fromarray(np.clip(recolor(cell, cx, cy, R, p), 0, 255).astype(np.uint8), 'RGBA')
                    over = pieces(row, cx, cy, R, p)
                    if row >= 3 or p['style'] in ('long',) and row == 0:
                        pass
                    base.alpha_composite(over)
                    # Eyes stay on top in the facing rows (hair never covers them).
                    if row < 3:
                        eyes = cell.copy()
                        dark = (eyes[:, :, 0] < 90) & (eyes[:, :, 3] > 160)
                        yy, xx = np.mgrid[0:CELL, 0:CELL]
                        inside = (xx - cx) ** 2 + (yy - cy) ** 2 < (R * 0.62) ** 2
                        keep = dark & inside & (yy > cy - R * 0.2)
                        e = np.zeros_like(eyes)
                        e[keep] = eyes[keep]
                        base.alpha_composite(Image.fromarray(e, 'RGBA'))
                    out.paste(base, (col * CELL, row * CELL))
            out.quantize(colors=64, method=Image.FASTOCTREE).save(os.path.join(OUT, f'{who}-{anim}.png'), optimize=True)
            print(who, anim)
    with open(os.path.join(ROOT, 'src', 'game', 'world', 'npcAtlas.ts'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('/** Generated by tools/build-npcs.py — do not edit. */\n')
        f.write('/** The story\'s people, dressed from the hero\'s sheets: images/world/npc/<who>-<anim>.png (5 facing rows of 180 px cells). */\n')
        f.write('export const NPC_SHEETS: Record<string, Record<string, number>> = {\n')
        for who in PEOPLE:
            f.write(f"    {who}: {{ {', '.join(f'{repr(a)}: {ANIMS[a]}' for a in WHO_ANIMS[who])} }},\n")
        f.write('};\n')


if __name__ == '__main__':
    build()
