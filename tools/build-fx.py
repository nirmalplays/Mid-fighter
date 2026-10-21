"""Packs the spell effects from "Super Pixel Effects Gigapack (Free Version) 2" into public/images/fx/<name>.png
(one row of equal frames) and prints the frame counts and sizes for src/game/world/fxAtlas.ts."""
import glob, os
from PIL import Image
ROOT = 'src/assets/Super Pixel Effects Gigapack (Free Version) 2/PNG/'
FX = {
    'fireball': 'Fire/fire_looping_003A/fire_looping_003A_large_orange',
    'explosion': 'Explosions/epic_explosion_001/epic_explosion_001_large_orange',
    'frost': 'Impacts/symmetrical_impact_002/symmetrical_impact_002_large_blue',
    'sparkle': 'Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_large_blue',
    'bolt': 'Lightning/lightning_strike_001/lightning_strike_001_large_violet',
    'boltburst': 'Lightning/lightning_burst_001/lightning_burst_001_large_violet',
    'heal': 'Fantasy Spells/spell_heal_001/spell_heal_001_large_red',
}
os.makedirs('public/images/fx', exist_ok=True)
for name, d in FX.items():
    frames = [Image.open(f).convert('RGBA') for f in sorted(glob.glob(ROOT + d + '/frame*.png'))]
    w, h = frames[0].size
    sheet = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * w, 0))
    sheet.save(f'public/images/fx/{name}.png', optimize=True)
    print(f"    {name}: {{ n: {len(frames)}, w: {w}, h: {h} }},")
