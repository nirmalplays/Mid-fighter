"""
PLACEHOLDER art for the bestiary's mythical bosses and foes (src/game/bestiary.ts).

These sheets are stand-ins so every creature can be spawned and tested in game: they reuse the
puppet body plans of tools/build-demons.py with new palettes and a few extra parts (more heads,
a scorpion tail, fire breath). Final art comes from elsewhere (see docs/studio/bestiary-art-brief.md);
it only has to match the layout recorded in src/game/world/beastAtlas.ts, which this script writes:

    per art id: cell width/height, frames per animation, number of facing rows (5 = front,
    three-quarter front, side, three-quarter back, back; the game mirrors the other three),
    the feet point inside a cell, and the figure's height in cell px.

Files: public/images/world/enemy/<art>-<move|attack|die>.png (art ids: b_* bosses, foes with
_1/_2 colour tiers) and a portrait public/images/world/npc/<art>-portrait.png for each boss.

    python tools/build-beasts.py              # everything
    python tools/build-beasts.py b_dragon imp # just these (and their tiers)
"""
import importlib.util
import math
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('build_demons', os.path.join(HERE, 'build-demons.py'))
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)

ROOT, OUT, NPC_OUT = bd.ROOT, bd.OUT, bd.NPC_OUT
ball, cap, poly, add, mul, mix, H = bd.ball, bd.cap, bd.poly, bd.add, bd.mul, bd.mix, bd.hexc
FRAMES = {'move': 6, 'attack': 6, 'die': 6}
FACING_ROWS = 5
# Cell geometry: (size, feet x, feet y). Bosses use the demons' cell; foes the pack's.
CELLS = {'boss': (224, 112, 204), 'foe': (180, 90, 170)}


def atk(anim, f, seq):
    return seq[f] if anim == 'attack' else 0.0


# ------------------------------------------------------------------ extra parts

def fire_cone(origin, d, k, col_hot, col):
    """A breath of fire from `origin` along direction d, `k` (0-1) how far it has come out."""
    out = []
    if k <= 0:
        return out
    for i in range(7):
        t = (i + 1) / 7
        c = (origin[0] + d[0] * 120 * t * k, origin[1] + d[1] * 120 * t * k, origin[2] + d[2] * 120 * t * k)
        out.append(ball(c, 5 + 16 * t * k, col=mix(col_hot, col, t), glow=True, bias=60))
    return out


def hound_head(head, p, jaw, side_turn=0.0):
    """A dog's head (for Cerberus): skull, snout, open jaw with a glowing maw, ears, eyes, spiked collar."""
    out = [ball(head, 18, 16, col=p['hide'])]
    snout = add(head, (side_turn * 10, -4, 20))
    out.append(ball(snout, 11, 8, col=mul(p['hide'], 0.95)))
    out.append(ball(add(snout, (0, -8 - jaw, -2)), 9, 5, col=mul(p['hide'], 0.75)))
    if jaw > 2:
        out.append(ball(add(snout, (0, -4 - jaw * 0.5, 2)), 7, 2 + jaw * 0.3, col=p['glowc'], glow=True))
    for side in (1, -1):
        out.append(ball(add(head, (side * 8, 5, 13)), 3.8, 3, col=p['eye'], glow=True, n=(side * 0.4, 0, 1)))
        out.append(poly([add(head, (side * 8, 12, -2)), add(head, (side * 14, 34, -8)), add(head, (side * 16, 10, -6))], col=mul(p['hide'], 0.8)))
        out.append(poly([add(snout, (side * 5, -3, 7)), add(snout, (side * 6, -12, 8)), add(snout, (side * 2, -5, 9))], col=(245, 236, 214), n=(0, 0, 1)))
    collar = add(head, (0, -12, -14))
    out.append(ball(collar, 20, 9, col=p['collar']))
    for k in range(5):
        a = (k - 2) * 0.6
        b = add(collar, (math.sin(a) * 18, 2, math.cos(a) * 8))
        out.append(poly([add(b, (-3, 0, 0)), add(b, (math.sin(a) * 10, 4, math.cos(a) * 6)), add(b, (3, 0, 0))], col=(200, 196, 190)))
    return out


def scorpion_tail(p, s, strike):
    """A segmented tail arching from the haunch over the back; `strike` (0-1) whips the sting forward."""
    out = []
    prev = (0, 84, -50)
    n = 9
    for k in range(n):
        u = (k + 1) / n
        ang = u * (2.6 + strike * 1.1)
        rr = 60 + strike * 20
        q = (math.sin(s + k) * 2, 84 + math.sin(ang) * rr * 1.2, -50 - math.cos(ang) * rr * 0.4 + u * (strike * 110))
        q = (q[0], q[1], q[2] - (1 - strike) * 30 * math.sin(u * math.pi))
        out.append(cap(prev, q, 11 - k * 0.8, 10 - k * 0.8, col=p['tailc']))
        prev = q
    out.append(poly([add(prev, (-6, 0, 0)), add(prev, (0, -8 - strike * 8, 26)), add(prev, (6, 0, 0))], col=p['sting']))
    out.append(ball(add(prev, (0, -4, 18)), 3 + strike * 3, col=p['venom'], glow=True, bias=8))
    return out


# ------------------------------------------------------------------ placeholder plans (base plan + extras)

def plan_dragon(p, anim, f, n):
    parts = bd.beast(p, anim, f, n)
    k = atk(anim, f, [0, 0, 0.4, 1, 0.9, 0.3])
    rear = atk(anim, f, [0, 0.6, 1.0, -0.2, -0.6, -0.2])
    head = (0, 72 + 24 + rear * 34 + 10 + max(rear, 0) * 10, 46 + atk(anim, f, [0, -6, -10, 22, 30, 10]) + 18)
    parts += fire_cone(add(head, (0, -10, 34)), (0, -0.5, 0.86), k, (255, 240, 160), p['glowc'])
    return parts


def plan_hydra(p, anim, f, n):
    parts = bd.leviathan(p, anim, f, n)
    for side, ph in ((1, 2), (-1, 4)):
        q = dict(p)
        sub = bd.leviathan(q, anim, (f + ph) % n, n)[10:]  # neck and head only (the coils are the first ten)
        for part in sub:
            part.pts = [(x * 0.82 + side * 46, y * 0.82, z * 0.82 - 8) for x, y, z in part.pts]
            part.r = (part.r[0] * 0.82, part.r[1] * 0.82) if part.r else None
        parts += sub
    return parts


def plan_kraken(p, anim, f, n):
    parts = bd.caster(p, anim, f, n)
    # the sea it rises from
    water = [(math.cos(a) * 96, 2, math.sin(a) * 70) for a in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
    parts.append(bd.Part('poly', water, None, p['water'], outline=False, shade=False, bias=-400))
    for i in range(10):
        a = i * 2 * math.pi / 10 + f * 0.3
        parts.append(ball((math.cos(a) * 84, 4, math.sin(a) * 60), 10, 4, col=(220, 240, 250), outline=False, shade=False, bias=-300))
    # two great tentacles that rise and slam
    lift = atk(anim, f, [0.3, 0.8, 1.0, -0.4, -0.8, -0.2])
    for side in (1, -1):
        prev = (side * 50, 4, 20)
        for k in range(7):
            u = (k + 1) / 7
            q = (side * (50 + u * 20), 4 + math.sin(u * math.pi) * (60 + 80 * max(lift, 0)) + 20 * u, 20 + u * (40 + 60 * max(-lift, 0)))
            parts.append(cap(prev, q, 13 - k * 1.5, 12 - k * 1.5, col=p['tentacles']))
            prev = q
    return parts


def plan_cerberus(p, anim, f, n):
    parts = bd.beast(p, anim, f, n)
    rear = atk(anim, f, [0, 0.6, 1.0, -0.2, -0.6, -0.2])
    fwd = atk(anim, f, [0, -6, -10, 22, 30, 10])
    jaw = 4 + max(0.0, -rear) * 10
    for side in (1, -1):
        head = (side * 34, 72 + 34 + rear * 30, 50 + fwd - 6)
        parts.append(cap((side * 14, 86 + rear * 12, 26 + fwd), head, 16, 13, col=p['hide']))
        parts += hound_head(head, p, jaw, side)
    return parts


def plan_manticore(p, anim, f, n):
    parts = bd.beast(p, anim, f, n)
    return parts + scorpion_tail(p, 2 * math.pi * f / n, atk(anim, f, [0, 0.1, 0.3, 1.0, 0.8, 0.3]))


def plan_basic(base):
    return lambda p, anim, f, n: bd.PLANS[base](p, anim, f, n)


# ------------------------------------------------------------------ the roster
# (plan, cell, params[, tiers: list of two param overrides for the _1/_2 colour variants])

BOSSES = {
    'b_dragon': (plan_dragon, dict(scale=0.8, size=1.25, hide=H('#8a1f14'), belly=H('#e0a050'), spine=H('#2a0c0a'), horn=H('#e8d8b8'), eye=H('#ffe066'), glowc=H('#ff6a1a'),
                                   wings=H('#5a1410'), tailtip=H('#2a0c0a'), curl=6, horn_up=30)),
    'b_griffin': (plan_basic('beast'), dict(scale=0.85, hide=H('#8a7a5a'), belly=H('#e8e0cc'), spine=H('#e8f0f8'), horn=H('#e0b040'), eye=H('#7dd3fc'), glowc=H('#bae6fd'), horns=False,
                                            ears=H('#f0f4f8'), mane=H('#f4f8fc'), tailtip=H('#4a3a28'), wings=H('#c8d4e4'))),
    'b_hydra': (plan_hydra, dict(scale=0.86, hide=H('#1f5a4a'), belly=H('#9ad8b8'), ice=H('#0c2e26'), eye=H('#e0ff70'), glowc=H('#5eead4'), frill=H('#2a8aa0'))),
    'b_kraken': (plan_kraken, dict(scale=0.9, robe=H('#5a1e4e'), trim=H('#f0a8c8'), skin=H('#8a3a6e'), hood=H('#4a1640'), mask=H('#b05a8a'), eye=H('#fde047'), glowc=H('#f472b6'),
                                   tentacles=H('#6e2a5e'), water=H('#2b6a9a'), orbs=0)),
    'b_colossus': (plan_basic('hulk'), dict(scale=0.95, skin=H('#6a6474'), belly=H('#8a8494'), shoulder=H('#4a4454'), horn=H('#2e2a36'), eye=H('#c084fc'), glowc=H('#a855f7'),
                                            crystal=H('#b48cff'), claws=H('#3a3444'), horn_up=8, horn_out=8, curl=0, foot=H('#3a3444'),
                                            cracks=[(-24, 116, -8, 96), (-8, 96, 6, 106), (14, 120, 24, 98), (0, 88, 12, 76)])),
    'b_minotaur': (plan_basic('hulk'), dict(scale=0.95, skin=H('#5a3a28'), belly=H('#8a6a50'), shoulder=H('#3a2418'), horn=H('#efe2c8'), eye=H('#ff3a2a'), glowc=H('#ff7a2a'),
                                            weapon='cleaver', horn_up=10, horn_out=34, curl=14, foot=H('#1e140e'))),
    'b_basilisk': (plan_basic('leviathan'), dict(scale=0.95, hide=H('#a88a4a'), belly=H('#e8d8a8'), ice=H('#5a3a1a'), eye=H('#a3ff4a'), glowc=H('#84cc16'), frill=H('#c0302a'))),
    'b_phoenix': (plan_basic('caster'), dict(scale=0.95, robe=H('#d0401a'), trim=H('#ffd060'), skin=H('#f08a3a'), mask=H('#ffd8a0'), eye=H('#fff7c0'), glowc=H('#ffb02a'),
                                             flamehair=H('#ff7a1a'), orbs=6)),
    'b_cerberus': (plan_cerberus, dict(scale=0.86, size=1.15, hide=H('#2a2228'), belly=H('#4a3a3e'), spine=H('#ff6a1a'), spine_glow=True, horn=H('#1a1418'), eye=H('#ff3a1a'),
                                       glowc=H('#ff7a1a'), ears=H('#2a2228'), horns=False, collar=H('#6a2a1a'), mane=H('#ff8a2a'), mane_glow=True, tailtip=H('#ff6a1a'), tail_glow=True)),
    'b_manticore': (plan_manticore, dict(scale=0.86, size=1.1, hide=H('#a8442a'), belly=H('#d8945a'), spine=H('#4a1a10'), horn=H('#2a1410'), eye=H('#ffe066'), glowc=H('#ff8a3a'),
                                         horns=False, ears=H('#8a3420'), mane=H('#3a140c'), wings=H('#5a1a2a'), tailtip=H('#3a1a10'),
                                         tailc=H('#5a2a1a'), sting=H('#1e0e0a'), venom=H('#a3ff4a'))),
}

FOES = {
    'imp': (plan_basic('lord'), dict(scale=0.5, skin=H('#a8301e'), plate=H('#4a1a14'), spike=H('#2a0c0a'), glowc=H('#ff8a2a'), fire=H('#ffc04a'), eye=H('#ffe066'), wing=H('#5a1810')),
            [dict(skin=H('#6a2a8a'), wing=H('#3a1450'), glowc=H('#c084fc'), fire=H('#e9a8ff')), dict(skin=H('#2a2a30'), wing=H('#141418'), glowc=H('#5eead4'), fire=H('#a5f3fc'))]),
    'harpy': (plan_basic('caster'), dict(scale=0.62, robe=H('#7a8aa8'), trim=H('#e8eef8'), skin=H('#c8b8b0'), mask=H('#e8dcd4'), eye=H('#fde047'), glowc=H('#bae6fd'), crown=H('#4a5a78'), orbs=0),
              [dict(robe=H('#8a5a3a'), crown=H('#3a2414'), glowc=H('#fbbf24')), dict(robe=H('#3a3448'), crown=H('#1a1624'), glowc=H('#f472b6'), eye=H('#f472b6'))]),
    'hellhound': (plan_basic('beast'), dict(scale=0.66, hide=H('#26201f'), belly=H('#3e3230'), spine=H('#ff6a1a'), spine_glow=True, horn=H('#141010'), eye=H('#ff3a1a'), glowc=H('#ff7a1a'),
                                            horns=False, ears=H('#26201f'), mane=H('#ff8a2a'), mane_glow=True, tailtip=H('#ff6a1a'), tail_glow=True),
                  [dict(spine=H('#a855f7'), mane=H('#c084fc'), tailtip=H('#a855f7'), glowc=H('#c084fc'), eye=H('#f0abfc')), dict(hide=H('#5a5a64'), belly=H('#7a7a84'), spine=H('#7dd3fc'), mane=H('#bae6fd'), tailtip=H('#7dd3fc'), glowc=H('#7dd3fc'), eye=H('#e0ffff'))]),
    'gargoyle': (plan_basic('hulk'), dict(scale=0.6, skin=H('#6e6a66'), belly=H('#8e8a84'), shoulder=H('#56524e'), horn=H('#2e2c2a'), eye=H('#fbbf24'), glowc=H('#f59e0b'), claws=H('#3a3836'), horn_up=26, curl=8),
                 [dict(skin=H('#5a6e5a'), belly=H('#7a8e7a'), shoulder=H('#4a5a4a'), eye=H('#a3ff4a'), glowc=H('#84cc16')), dict(skin=H('#3a3446'), belly=H('#5a5466'), shoulder=H('#2a2436'), eye=H('#e879f9'), glowc=H('#c026d3'))]),
    'salamander': (plan_basic('knight'), dict(scale=0.66, armor=H('#d0602a'), under=H('#8a3a1a'), cape=H('#5a2a14'), horn=H('#f0c040'), eye=H('#ffe066'), glowc=H('#ff8a2a'), weapon='sword',
                                              shield=H('#a8742a'), blade=H('#e0d0b0'), blade_glow=H('#ffb04a')),
                   [dict(armor=H('#2a8a6a'), under=H('#145a44'), eye=H('#e0ff70'), glowc=H('#5eead4'), blade_glow=H('#5eead4')), dict(armor=H('#4a2a6a'), under=H('#24143a'), eye=H('#f0abfc'), glowc=H('#c084fc'), blade_glow=H('#c084fc'))]),
    'wisp': (plan_basic('elemental'), dict(scale=0.55, stone=H('#2a4a5a'), glowc=H('#7dfcd4'), ring=H('#c8fff0'), bolt=H('#e0fff8')),
             [dict(stone=H('#4a2a5a'), glowc=H('#e879f9'), ring=H('#fae8ff'), bolt=H('#fdf4ff')), dict(stone=H('#5a3a1a'), glowc=H('#fbbf24'), ring=H('#fef3c7'), bolt=H('#fffbeb'))]),
    'deathknight': (plan_basic('knight'), dict(scale=0.7, armor=H('#4a4650'), under=H('#d8d0c0'), cape=H('#3a1418'), horn=H('#1e1c22'), eye=H('#ff3a2a'), glowc=H('#ff4a3a'), weapon='sword',
                                               shield=H('#2e2a34'), blade=H('#8a8494'), blade_glow=H('#ff6a5a')),
                    [dict(armor=H('#2e3a4e'), cape=H('#14243a'), eye=H('#7dd3fc'), glowc=H('#7dd3fc'), blade_glow=H('#bae6fd')), dict(armor=H('#2a1a2e'), cape=H('#4a0e2a'), eye=H('#e879f9'), glowc=H('#c026d3'), blade_glow=H('#f0abfc'))]),
}

ALL = {}
for k, (fn, p) in BOSSES.items():
    ALL[k] = (fn, 'boss', p)
for k, (fn, p, tiers) in FOES.items():
    ALL[k] = (fn, 'foe', p)
    for i, t in enumerate(tiers, 1):
        ALL[f'{k}_{i}'] = (fn, 'foe', {**p, **t})


def set_cell(kind):
    size, fx, fy = CELLS[kind]
    bd.CELL, bd.CX, bd.GY = size, fx, fy


def build_one(art):
    fn, cellkind, p = ALL[art]
    set_cell(cellkind)
    size = bd.CELL
    plan = bd.scaled(fn, p.get('scale', 1))
    seed = sum(map(ord, art))
    nf = bd.noise_field(seed)
    ember = p.get('glowc', (255, 140, 60))
    tops = []
    sheets = {}
    for anim, nfr in FRAMES.items():
        sheet = Image.new('RGBA', (size * nfr, size * FACING_ROWS), (0, 0, 0, 0))
        for row, yaw in enumerate(bd.YAWS):
            for f in range(nfr):
                if anim == 'die':
                    parts = plan(dict(p), 'move', 0, 6)
                    fall = [0.0, 0.12, 0.35, 0.6, 0.8, 0.9][f]
                    sink = [0, 4, 14, 26, 34, 38][f]
                    big = bd.render(parts, yaw, (fall, sink, -4 * f))
                    d = [0, 0, 0.06, 0.22, 0.46, 0.74][f]
                    if d > 0:
                        big = bd.dissolve(big, d, nf, ember, f, seed + row)
                else:
                    big = bd.render(plan(dict(p), anim, f, nfr), yaw)
                cell = bd.shrink(big)
                sheet.paste(cell, (f * size, row * size))
                if anim == 'move':
                    ys = np.where(np.array(cell)[:, :, 3].max(axis=1) > 40)[0]
                    if len(ys):
                        tops.append(ys.min())
        sheets[anim] = sheet
        sheet.quantize(colors=200, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, f'{art}-{anim}.png'), optimize=True)
    height = bd.GY - int(np.median(tops)) if tops else 120
    if cellkind == 'boss':
        first = sheets['move'].crop((0, 0, size, size))
        al = np.array(first)[:, :, 3]
        ys, xs = np.where(al > 40)
        top = int(ys.min())
        cxm = int((xs.min() + xs.max()) / 2)
        side = 110
        x0 = max(0, min(size - side, cxm - side // 2))
        y0 = max(0, top - 4)
        first.crop((x0, y0, x0 + side, y0 + side)).resize((100, 100), Image.LANCZOS).save(os.path.join(NPC_OUT, f'{art}-portrait.png'), optimize=True)
    return art, dict(w=size, h=size, feet=(bd.CX, bd.GY), height=height, facings=FACING_ROWS, frames=dict(FRAMES))


def read_back(art):
    """An art not rebuilt this run: its layout from the sheet on disk."""
    _, cellkind, _ = ALL[art]
    size, fx, fy = CELLS[cellkind]
    try:
        im = Image.open(os.path.join(OUT, f'{art}-move.png')).convert('RGBA')
    except FileNotFoundError:
        return None
    al = np.array(im)[:, :, 3]
    tops = [np.where(al[r * size:(r + 1) * size, c * size:(c + 1) * size].max(axis=1) > 40)[0] for r in range(FACING_ROWS) for c in range(im.width // size)]
    tops = [t.min() for t in tops if len(t)]
    return art, dict(w=size, h=size, feet=(fx, fy), height=fy - int(np.median(tops)) if tops else 120, facings=FACING_ROWS, frames=dict(FRAMES))


def write_atlas(info):
    path = os.path.join(ROOT, 'src', 'game', 'world', 'beastAtlas.ts')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/** Generated by tools/build-beasts.py — do not edit (replace the art, then re-run or hand-edit the numbers to match). */\n')
        f.write('/**\n * The bestiary\'s sheet layouts. Each art id has three sheets, images/world/enemy/<art>-<anim>.png, laid out\n')
        f.write(' * as a grid of `w` x `h` cells: one column per frame, one row per facing. `facings` is 5 (front,\n')
        f.write(' * three-quarter front, side, three-quarter back, back; the game mirrors the other three), 8 (all eight,\n')
        f.write(' * clockwise from front, none mirrored), 3 (front, side, back) or 1 (one view, mirrored left/right).\n')
        f.write(' * `feet` is where the figure stands inside a cell; `height` how tall it stands in cell px.\n */\n')
        f.write('export interface BeastArt {\n    w: number;\n    h: number;\n    feet: [number, number];\n    height: number;\n    facings: 1 | 3 | 5 | 8;\n    frames: { move: number; attack: number; die: number };\n}\n')
        f.write('export const BEAST_ART: Record<string, BeastArt> = {\n')
        for k in sorted(info):
            a = info[k]
            fr = a['frames']
            f.write(f"    {k}: {{ w: {a['w']}, h: {a['h']}, feet: [{a['feet'][0]}, {a['feet'][1]}], height: {a['height']}, facings: {a['facings']}, frames: {{ move: {fr['move']}, attack: {fr['attack']}, die: {fr['die']} }} }},\n")
        f.write('};\n')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:]
    todo = [k for k in ALL if not want or k in want or k.split('_')[0] in want or (k.startswith('b_') and k in want)]
    with Pool(max(1, os.cpu_count() or 1)) as pool:
        built = dict(pool.map(build_one, todo))
    info = {}
    for k in ALL:
        if k in built:
            info[k] = built[k]
        else:
            r = read_back(k)
            if r:
                info[k] = r[1]
    for k in todo:
        print(k, info[k]['height'])
    write_atlas(info)
