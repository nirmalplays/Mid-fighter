# Meh Fighter: studio critique and overhaul brief

Written as the lead critic after playing the current build (Oct 27). Every team works from this file.
References the owner gave: Dimraeth (Steam, Mudtek), classic 2D Pokémon overworlds, and painted
pixel-art scenes (a statue in a sunlit clearing between ruined walls; a mossy stone bridge over
waterfalls under a giant tree).

## What those references do that we don't

1. **Places, not terrain.** Every screen of a Pokémon route or Dimraeth has a reason to exist: a
   bridge, a shrine, a fenced field, a dock, a gate. Ours is procedural ground with props sprinkled on
   it. Between story sites there is nothing to find.
2. **Framing and paths.** Their maps frame the player: tree walls, cliffs and fences funnel you along
   a path that opens into a clearing with a landmark in the middle. Ours is an open field.
3. **Height and water that read.** Waterfalls, cliffs with ledges, bridges, stairs. We have terraces
   but no waterfalls, bridges or stairs.
4. **Settlements that feel lived in.** Villages with fences, wells, gardens, market stalls, docks with
   boats. We have three lone houses per kingdom.
5. **Light and atmosphere.** Shafts of light, fireflies, drifting leaves, dust, tumbleweeds. We have
   weather and day/night but little life on the ground.

## Defects found in play (by area)

### World and camp
- The home camp is two tents on bare dirt with floating "empty plot" labels. No palisade, gate,
  barricades, towers, torches, banners, crates or paths. It does not read as a camp under siege.
- Kingdom borders are dead-straight lines; the ground style flips abruptly across them.
- No villages, farms, ports, waterfalls, temple ruins, statues/monuments, or secret places.
- Pyraxis badlands have no tumbleweeds, no wind-blown life.
- Large stretches of the map edge are bare grey mountain with nothing on it.

### Caves and dungeons
- Generated caves are mazes of one-tile corridors; the hand-laid digs and catacombs are the same.
  You cannot fight in them, the camera sees walls, and every room is cluttered with props.
- No sense of arrival: no big chamber, no vista, no set piece.

### Combat
- The dodge/dash is a spin with a scale change. No afterimage, no dust, no speed lines, no
  hit-stop, no camera kick. Compare Dimraeth's dash: a stretched silhouette, a ghost trail, a puff of
  dust at start and end.
- Attacks lack weight: little hit-stop, no knockback curve, few hit sparks, enemies don't stagger.
- There are no classes; every hero fights the same.

### Opponents
- Most foes walk at you and bite. They don't telegraph, flank, retreat, guard, or combine.
- Boss fights lean on more HP rather than patterns and phases.

### Character creation
- Few hair styles and outfits, no class, the preview is small, no randomise-with-intent, choices
  don't show their effect.

### Story and presentation
- The prologue is narrated slides; the game starts with a quarry chore ("break three boulders").
  The world's promise (kings, queens, wizards, chariots, magic) never shows up in Act I of Pyraxis.
- No anticipation hooks: nothing on the horizon pulls you forward (a smoking tower, a rumbling
  chariot, a sealed door with a glow).
- The HUD covers a third of the screen (quest panel, banners, floating labels over the world).

## Studio teams and what each owns

| Team | Owns (files) | Goal |
|---|---|---|
| World | `src/game/world/mapGen.ts`, `tools/build-iso-atlas.py`, `tools/iso_extra.py`, new `src/game/world/places.ts` | Villages, farms, ports, waterfalls, temple ruins, statues, secret arenas, tumbleweeds; framed paths and clearings |
| Camp | camp drawing in `src/game/world/survivalLayer.ts`, camp layout in `src/game/survival.ts` | A real fortified camp: palisade, gate, barricades, watchtowers, torches, banners, paths, tents placed with purpose |
| Caves | `src/game/world/interiors.ts` | Wide caverns with chambers and set pieces; less clutter; corridors at least 3 wide |
| Combat | `src/game/world/character.ts`, dash/attack code in `worldScene.ts`, `src/game/classes.ts` | Dash and hit feel, classes (warrior / ranger / arcanist) |
| Opponents | `src/shared/sim.ts`, `src/game/world/monsters.ts` | Telegraphs, behaviours per foe, boss phases |
| Hero | `src/ui/CharacterCreator.tsx`, `src/game/world/heroLook.ts` | A creator worth spending time in, with class choice |
| Story | `src/game/eidolon.ts` (text), `src/ui/IntroCutscene.tsx`, `src/ui/cutscene/`, `src/game/story/land1.ts`, `src/game/world/storyLayer.ts`, `src/game/world/cinematic.ts` | A prologue that hooks; Act I of Pyraxis with real encounters and anticipation |

## Rules for every team
- Keep the art style: the Ultimate Isometric Pack's flat colours, lighter top-left facet, darker right,
  thick plum outline (52, 1, 41). New art either comes from the local packs in `src/assets/`
  (composited, recoloured) or is drawn in that style by the atlas tools.
- Don't break saves: bump `src/saveConfig.ts` version only with a migration.
- `npm run build` must pass. Check your work in the running game with screenshots.
