# Bestiary art brief: mythical bosses and foes

For the artist or image generator who replaces the placeholder sheets. The design data (names, lore,
phases, attacks, weak points) is in `src/game/bestiary.ts`; this file says what to draw.

The current sheets were built by `tools/build-beasts.py` from the demon puppet kit. They are
placeholders: they only prove the layout and let the creatures be spawned in game.

## What the game loads

Each creature has an **art id** (`b_dragon`, `imp`, `imp_1`, ...) and three PNG sheets in
`public/images/world/enemy/`: `<art>-move.png`, `<art>-attack.png`, `<art>-die.png`.

- A sheet is a grid of equal cells: **one column per frame, one row per facing**.
- Cells can be any size, frame counts can differ per animation, and the number of facing rows can be
  **5** (front, three-quarter front, side, three-quarter back, back; the game mirrors these for the
  other three directions, so draw them facing the viewer's right), **8** (clockwise from front, not
  mirrored), **3** (front, side, back) or **1** (one view, mirrored left/right).
- Record each art's layout in `src/game/world/beastAtlas.ts` (`BEAST_ART`): cell `w`/`h`, `feet` (the
  pixel in a cell where the creature touches the ground; for flyers, the point under it where its
  shadow goes), `height` (how tall the figure stands in cell px; the game scales it to its size class
  from this), `facings` and `frames` per animation. No other code change is needed.
- Placeholder layout today: bosses 224 x 224 cells, foes 180 x 180, 6 frames per animation, 5 facings.
- **move** loops (walk, gallop, hover or swim). **attack** plays once over the attack's length and should
  show the wind-up in the first third, the blow around 60%, and the recovery last. **die** plays once
  and should end empty or nearly so (the game fades whatever is left).
- Style: the Ultimate Isometric Pack look (flat colours, a lighter top-left facet, darker right, thick
  plum outline `#340129`), lit from the top left, seen from the game's isometric camera (about 25° down).
  Glowing parts (eyes, fire, runes) are lighter in the middle and carry no outline.
- Bosses: a portrait for dialogue, `public/images/world/npc/<art>-portrait.png`, 100 x 100, head and
  shoulders, facing three-quarter front.
- Foes: three colour tiers, `<art>`, `<art>_1`, `<art>_2` (later waves send the tougher-looking ones);
  same drawings, recoloured as listed.

Size is the creature's footprint in tiles (a tile is about the hero's shoulder width; the hero is about
1.3 tiles tall). Bosses should stand roughly two to three times the hero's height.

## Bosses

**Vulkaris, the Ember Dragon** (`b_dragon`, Pyraxis, huge: 3 tiles). Silhouette: a long, low, heavy
four-legged dragon with a long neck, great bat wings half-raised, a head crowned with swept-back horns,
and a long tail ending in a spade. The wings and the neck must read even at a glance. Palette: oxblood
and rust scales (`#8a1f14`), tan belly plates (`#e0a050`), near-black spines and wing bones, bone-white
horns, yellow eyes; molten orange (`#ff6a1a`) glowing from the throat and between the belly plates.
Move: a prowling walk, head low, wings folded and swaying. Attack (Cinder Breath): the head rears back
and the chest swells with light (frames 1-2), then thrusts forward and down, jaws wide, and a cone of
fire rolls out across the ground ahead (frames 3-5). Die: collapses on its side, the inner fire going
out, the body cracking into cooling cinders.

**Tempestra, the Storm Griffin** (`b_griffin`, Zephyria, large: 2 tiles). Silhouette: eagle front, lion
back; a sharp hooked beak, ear tufts, huge feathered wings held high, taloned front legs, a lion's tail
with a dark tuft. Palette: storm-grey and white feathers (`#c8d4e4`, `#f4f8fc`), tawny lion hide
(`#8a7a5a`), golden beak and talons, pale blue eyes, electric blue (`#bae6fd`) sparks crawling along
the wing edges. Move: a stalking walk with the wings half-open, or a low hover. Attack (Stoop): wings
snap up high, the body rears, then it lunges down talons first with lightning crackling round the
claws. Die: wings fold around it as it crashes, feathers blowing away.

**Thalassa, the Abyssal Hydra** (`b_hydra`, Aquatica, huge: 3 tiles). Silhouette: a squat, heavy body on
four short legs, from which three long serpent necks rise and spread like a fan, each with a frilled,
fanged head; the middle neck tallest. Palette: deep teal-green scales (`#1f5a4a`), pale green belly,
sea-blue frills (`#2a8aa0`), yellow-green eyes, acid-aqua (`#5eead4`) glow in the mouths. Move: the
heads sway out of step with each other. Attack (Triple Strike): the three heads strike forward one
after another, each with a spray of acid. Die: the heads droop one by one, the body sinking in brine.

**Mother Maw, the Kraken Below the Breakers** (`b_kraken`, Aquatica coast, colossal: 4 tiles).
Silhouette: a huge bulbous mantle and a pair of enormous eyes rising out of a pool of churning water,
ringed by thick tentacles; only the top third of the beast is above water. Palette: wine-purple flesh
(`#5a1e4e`, `#8a3a6e`) with paler suckers, deep sea-blue water (`#2b6a9a`) with white foam, yellow eyes
with slit pupils, a pink bioluminescent glow (`#f472b6`). Draw the water ring as part of the sprite.
Move: tentacles coil and uncoil, the mantle bobs. Attack (Slam): two tentacles rise high above the
head, then crash down across the ground in front with a splash. Die: the eyes close and it sinks, the
water closing over it.

**Ostrakon, the Stone Colossus** (`b_colossus`, Void Wastes, colossal: 4 tiles). Silhouette: a
towering humanoid of stacked boulders, tiny head sunk between massive shoulders, arms that reach the
ground ending in huge fists; violet crystals growing from the shoulders. Palette: cold grey-violet
stone (`#6a6474`), darker joints, violet rune cracks glowing `#a855f7`, a single visor-slit eye.
Move: a slow, heavy stomp, fists dragging. Attack (Hammerfall): both fists lifted overhead, then
brought down together in front, a ring of rubble bursting out. Die: crumbles from the top down into a
pile of stones, the runes guttering out.

**Asterion, Lord of the Labyrinth** (`b_minotaur`, the Void Citadel's arena, large: 2 tiles).
Silhouette: a hulking bull-headed man, shoulders wider than he is tall, horns wide and forward-curving,
hooved legs, a two-headed axe (labrys) as long as he is tall. Palette: dark chocolate hide (`#5a3a28`),
blackened hooves, ivory horns (`#efe2c8`), a brass nose ring, red eyes (`#ff3a2a`), iron axe with an
orange-hot edge. Move: a heavy stride; steam from the nostrils. Attack (Labrys Cleave): the axe raised
high behind the head, then an overhead cleave into the ground with a bright arc trail. A second pose for
the Gore Charge (head down, horns forward) would be welcome as extra attack frames. Die: drops to his
knees, then falls forward onto the axe.

**Sarrazh, the Basilisk of the Glass Dunes** (`b_basilisk`, Pyraxis badlands, large: 2 tiles).
Silhouette: a huge serpent rearing from its own sand-coloured coils, an arrow-shaped head with a tall
crimson crest and fanned frills. Palette: sand and ochre scales with dark bands (`#a88a4a`, `#5a3a1a`),
cream belly, crimson crest (`#c0302a`), poison-green eyes (`#a3ff4a`). Move: coils slide, the neck
sways. Attack (Stone Gaze): the crest flares wide, the head pulls back, and a cone of green light
shoots from the eyes; the fang strike is the same head snapping forward. Die: the crest folds, and it
turns to grey stone and cracks apart.

**Cinderwake, the Twice-Born Phoenix** (`b_phoenix`, Zephyria skies, large: 2 tiles). Silhouette: a
great bird hovering upright, wings spread wide in a burning fan, a long trailing tail of flame plumes
reaching to the ground, a crest of fire. Palette: crimson and orange plumage (`#d0401a`, `#ff7a1a`),
golden beak and talons (`#ffd060`), white-hot eyes, flame tips glowing `#ffb02a`. Much of it glows, so
keep a solid outlined body and head so it reads against bright ground. Move: a slow hover, wings
beating. Attack (Feather Volley / Sunburst): wings sweep up and back, then forward, flinging a fan of
burning feathers. Die: bursts into flame and collapses into an ash egg (the egg can be a final frame or
a separate sprite).

**Grimmaw, the Hound of Three Gates** (`b_cerberus`, Void Wastes, huge: 3 tiles). Silhouette: a massive
black hound with three heads on short thick necks, fanned left, centre and right, each in a spiked iron
collar, a mane of fire down the neck and back, a tail ending in a snake's head. Palette: charcoal hide
(`#2a2228`), ember cracks and mane (`#ff7a1a`), rust-red collars with steel spikes, red eyes; a broken
chain hanging from the middle collar. Move: a menacing lope, heads out of step. Attack (Triple Bite):
crouch, then lunge with all three jaws wide and glowing. Die: the heads fall one after another; the
fire in the mane goes out.

**Kharzul, the Manticore** (`b_manticore`, Zephyria, large: 2 tiles). Silhouette: a lion with a heavy
dark mane, leathery bat wings, and a segmented scorpion tail arching high over its back with a black
sting. The tail is the signature: it must read in every facing. Palette: crimson-tawny hide (`#a8442a`),
near-black mane (`#3a140c`), wine-dark wings (`#5a1a2a`), the tail darker than the body, venom green
(`#a3ff4a`) dripping from the sting. Move: a slinking walk, tail swaying. Attack (Sting): the tail
coils back, then whips over the head and stabs forward. Die: the tail collapses first, then the body.

## Foes (three colour tiers each)

**Imp** (`imp`, Pyraxis, small: 0.6 tiles). A pot-bellied, horned little devil on bat wings, hovering,
with a spade-tipped tail and a fireball in one claw. Base: brick red, orange fire. `_1`: violet with
lilac fire. `_2`: soot black with cyan fire. Move: bobbing hover, wings beating fast. Attack: arm back,
then throws the fireball. Die: pops into sparks.

**Harpy** (`harpy`, Zephyria, medium). A gaunt woman's body with great feathered wings for arms, bird
legs with long talons, wild feathered hair. Base: slate blue feathers, pale skin, yellow eyes. `_1`:
hawk brown with amber. `_2`: dusk violet with pink eyes. Move: hovering, legs dangling. Attack: a swoop,
talons first. Die: tumbles out of the air in a burst of feathers.

**Hellhound** (`hellhound`, Pyraxis, medium). A lean, ribbed black hound, never cute: long fangs,
spines along the back, fire for a mane and tail tip, glowing eyes. Base: charcoal with orange fire.
`_1`: violet fire. `_2`: ash grey with blue fire. Move: fast low lope. Attack: a lunge with jaws open
and glowing. Die: burns down to ash.

**Gargoyle** (`gargoyle`, Void Wastes, medium). A hunched stone demon with folded wings, horns, a
snarling face and heavy claws; it should look like a statue when still. Base: weathered grey with amber
eyes. `_1`: mossy green with green eyes. `_2`: obsidian with magenta eyes. Move: a heavy hop. Attack:
wings flare, then it dives claws first. Die: cracks and crumbles.

**Salamander** (`salamander`, Pyraxis, medium). An upright lizard warrior, crested head, long tail, a
round bronze shield and a long spear. Base: orange-red scales, yellow belly. `_1`: jade. `_2`: violet.
Move: a disciplined march, shield forward. Attack: a spear thrust from behind the shield. Die: falls
back, the tail curling.

**Will-o'-wisp** (`wisp`, Aquatica marsh, small). A floating cold flame around a pale mask-like face,
trailing wisps and a few orbiting sparks; it should be the brightest thing on screen. Base: cyan-green.
`_1`: magenta. `_2`: amber. Move: a drifting bob. Attack: flares bright, then flings a bolt. Die: gutters
out into smoke.

**Death Knight** (`deathknight`, the Void Citadel, medium, as tall as a brute). A skeleton in dented,
dark plate armour and a tattered cape, red eye-lights in the helm, a notched sword and a tower shield.
Base: gunmetal with red eyes. `_1`: frost blue. `_2`: violet. Move: a slow armoured walk. Attack: an
overhead sword swing. Die: the armour collapses into an empty heap.
