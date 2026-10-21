# Meh Fighter: an endless monster fighter (design)

Status: written for approval. Nothing here is built yet. Revised 2026-10-21: no workshop, no portals, death ends the game with a leaderboard.

## Intent
Meh Fighter is an endless monster fighter. Waves keep coming, harder and faster, until you die. Dying ends the game:
you see your score and the leaderboard, then you start again from wave 1. Gems you pick up are only worth something if you spend them at the frog before you die.
What lasts between runs (swords, bought skill levels, unlocked spells and their upgrades) is what lets the next run go further.

## Goals
- Constant pressure: waves every 20 s that ramp up hard.
- A real choice each time the frog visits: spend the gems you carry now, or keep fighting and risk losing them.
- Spells are earned: unlock at the frog, then buy charges and shorter cooldowns.
- The whole enemies pack is used (Kobolt and Scorpion added; colour variants mark tougher tiers).

## Non-goals
- No workshop, no portals, no banking, no safe areas, no scene changes. One world, one loop.
- No new currencies or story. No change to co-op joining, saves or the map.
- No hard anti-cheat for spells or gems (client-side as today).

## The loop (the user's words in quotes)
1. **A run** starts at wave 1 and lasts until you die. "u die u start from first." "when u die the game ends u get
   leader board": death shows a Game Over screen with your score and the leaderboard (see below), then Play again.
2. **Waves**: "no 2 minute break between each wave make it 20 sec", and "intensity must increase alot".
3. **Gems you pick up are carried.** "If you die, you lose that run's gems. Swords and the skill levels you've
   already bought stay." Spells you unlocked and their upgrades stay too.
4. **No workshop and no portals**: "its a endless monster fighter game now". Nothing takes you anywhere or banks gems.
5. **The frog** visits during a run (about every 3 minutes, for 40 s). It is the only place to spend gems, on skills
   and on spells (two tabs). "first they need unlock by buying from frog then they can buy how much they can carry,
   cool downs, all that."

## Rules I chose (the builder may tune the numbers)
- **Wave pacing**: a new wave starts 20 s after the previous one started (waves overlap; the spawn window shrinks to
  15 s). Alive-monster cap 60 so phones keep up.
- **Intensity** (start values): monsters = 4 + 4 per wave (cap 80), health x1.25 per wave compounding, speed +6% per
  wave (cap x1.8), bite 1 / 2 from wave 4 / 3 from wave 9 / 4 from wave 15. Kobolt joins at wave 2, Scorpion at wave 4.
- **Tiers**: colour variant by wave (waves 1-4 first variant, 5-9 second, 10+ third), sent in the snapshot.
- **Death** ends the run: the world stops for you and the Game Over screen opens (below). Play again puts you at the
  starting spot with full health, buffs cleared, wave 1, carried gems gone.
  Health does not otherwise come back (red potions and the Heal spell are how you recover).
- **Leaderboard** (RUN SDK `leaderboard`, simple mode, `rundot/leaderboard.config.json`): on death the game submits
  score = 100 x wave reached + enemies defeated, duration = seconds survived, metadata {wave, kills}. The Game Over
  screen shows your score, wave, kills, time, your rank and the top 10, with Play again. The SDK enforces a 60 s
  cooldown per player, so a run shorter than that may not post a second score; the screen says so if a score is not accepted.
- **Spells** (the 4 we have): all locked at the start. The frog's Spells tab: Unlock (costs gems of the spell's
  colour: Fireball attack, Frost defence, Bolt speed, Heal vitality), then **Carry** (charges, 1 to 5; each cast uses
  one, one recharges per cooldown) and **Cooldown** (-10 percent per level, 5 levels). Costs rise per level. The chest
  menu shows only unlocked spells, with charge pips. The Skills tab holds Attack, Defence, Speed and Vitality.
- **Co-op** (my call, flag if wrong): waves belong to the room, so a death does not reset the room's wave. The player
  who dies gets their own Game Over and score, loses their carried gems, and on Play again rejoins the room at the
  start with full health, at the room's current wave (their next score counts waves from where they rejoined).
- **Menu**: Continue (a new run, keeping your upgrades), Online, New game (wipes upgrades, spells and swords) and Leaderboard. No Workshop button; the in-game Workshop and Upgrades buttons go.

## Open points for the builder
- Exact numbers above (cost curves, ramp), balance by playing.
- Existing saves: gems kept as carried gems for the first run (so nobody loses them on update); spells all start
  locked (even for current players); a save left in the workshop resumes in the world.
- Remove the workshop and portal code (base scene, layout, atlas, safe-portal sim/view/HUD pill, tools) cleanly.

## What is left alone
Sword drops, potions, sword slash, spell visuals, co-op rooms, frog look and timing, the map.
