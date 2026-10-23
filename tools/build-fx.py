"""Packs the spell effects from "Super Pixel Effects Gigapack (Free Version) 2" into public/images/fx/<name>.png
(equal frames in rows of at most 4096 px) and prints the frame counts and sizes for src/game/world/fxAtlas.ts."""
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
    # combat
    'hit': 'Impacts/symmetrical_impact_001/symmetrical_impact_001_small_yellow',
    'crit': 'Impacts/symmetrical_impact_001/symmetrical_impact_001_large_yellow',
    'death': 'Smoke Bursts/stylized_skull_smoke_burst_001/stylized_skull_smoke_burst_001_small_white',
    'spawn': 'Smoke Bursts/symmetrical_smoke_burst_001/symmetrical_smoke_burst_001_small_brown',
    'splat': 'Splatters/burst_splatter_001/burst_splatter_001_small_red',
    'aura': 'Lightning/lightning_aura_002/lightning_aura_002_small_blue',
    # rewards and signs
    'levelup': 'Symbols/symbol_level_up_text_001/symbol_level_up_text_001_large_blue',
    'complete': 'Symbols/symbol_complete_text_001/symbol_complete_text_001_large_blue',
    'alert': 'Symbols/symbol_alert_001/symbol_alert_001_small_red',
    'coins': 'Magic Bursts/directional_coin_burst_001/directional_coin_burst_001_large_yellow',
    'pickup': 'Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green',
    # potions and states
    'atkup': 'Fantasy Spells/spell_attack_up_001/spell_attack_up_001_small_red',
    'defup': 'Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue',
    'haste': 'Fantasy Spells/spell_haste_001/spell_haste_001_small_green',
    'poison': 'Fantasy Spells/status_poison_001/status_poison_001_small_green',
    # the world
    'warp': 'Sci-fi/scifi_warp_001/scifi_warp_001_large_green',
    'campfire': 'Fire/fire_looping_004A/fire_looping_004A_small_orange',
}
os.makedirs('public/images/fx', exist_ok=True)
for name, d in FX.items():
    frames = [Image.open(f).convert('RGBA') for f in sorted(glob.glob(ROOT + d + '/frame*.png'))]
    w, h = frames[0].size
    # A long effect wraps onto more rows, so no sheet is wider than 4096 px (phones refuse bigger textures).
    cols = max(1, min(len(frames), 4096 // w))
    rows = -(-len(frames) // cols)
    sheet = Image.new('RGBA', (w * cols, h * rows))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, ((i % cols) * w, (i // cols) * h))
    sheet.save(f'public/images/fx/{name}.png', optimize=True)
    print(f"    {name}: {{ n: {len(frames)}, w: {w}, h: {h}, c: {cols} }},")
