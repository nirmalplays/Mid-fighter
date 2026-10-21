# Meh Fighter: the run loop (design)

Status: written for approval. Nothing here is built yet. Revised 2026-10-21: the workshop is removed.

## Intent
Turn the current "fight forever, upgrades happen" sandbox into a run: you push as far as you can through
ever harder waves, gems you carry are at risk until you bank them at the portal, and dying sends you back
to wave 1. What you keep (banked gems, swords, bought levels, unlocked spells) is what makes the next run go further.

## Goals
- A clear reason to push on (waves get brutal) and a clear reason to stop (carried gems are lost if you die).
- Gems feel like a decision: spend them at the frog mid-run (safe once spent) or bank them at the portal.
- Spells are earned, not free: unlock at the frog, then buy more charges and shorter cooldowns.
- The enemies pack is used fully (Kobolt and Scorpion added; colour variants mark tougher tiers).

## Non-goals
- No new currencies, no leaderboards, no story. No change to co-op joining, saves or the map.
- No hard anti-cheat for spells or gems (client-side as today).

## The loop (the user's words in quotes)
1. **A run** starts at wave 1 and lasts until you die. "u die u start from first."
2. **Waves**: "no 2 minute break between each wave make it 20 sec", and "intensity must increase alot".
3. **Gems you pick up are carried (at risk).** "If you die, you lose that run's gems." Swords, bought skill
   levels, unlocked spells and banked gems stay.
4. **The portal** still opens at a random time and place for about 20 s. "portal is not a save area": it gives no
   protection, monsters reach you at it. Walking into it **banks your carried gems** and the run goes on (my call).
5. **There is no workshop** ("remove workshop i feel its not needed at all"): no base scene, no Workshop button
   on the menu or in the game, no Upgrades button. The frog is the only place to spend gems.
6. **The frog** visits during a run (about every 3 minutes, 40 s). It is where you spend gems on spells and skills (both panels, as tabs).
   "first they need unlock by buying from frog then they can buy how much they can carry, cool downs, all that."

## Rules I chose (the builder may tune the numbers)
- **Wave pacing**: a new wave starts 20 s after the previous one started (waves overlap; the spawn window shrinks
  to 15 s). Alive-monster cap 60 so phones keep up.
- **Intensity** (start values): monsters = 4 + 4 per wave (cap 80), health x1.25 per wave compounding, speed +6% per
  wave (cap x1.8), bite 1 / 2 from wave 4 / 3 from wave 9 / 4 from wave 15. Kobolt joins at wave 2, Scorpion at wave 4.
- **Tiers**: colour variant by wave (waves 1-4 first variant, 5-9 second, 10+ third), sent in the snapshot.
- **Death**: you respawn at the starting spot with full health, buffs cleared, wave back to 1, carried gems gone.
- **Gems**: two numbers per colour, banked and carried. The HUD shows both (banked, +carried). The frog spends
  carried gems first, then banked. Spending at the frog is therefore how you save gems mid-run.
- **Spells** (the 4 we have): all locked at the start. The frog panel has a Spells tab: Unlock (costs gems of the
  spell's colour: Fireball attack, Frost defence, Bolt speed, Heal vitality), then **Carry** (charges, 1 to 5; each
  cast uses one, one recharges per cooldown) and **Cooldown** (-10 percent per level, 5 levels). Costs rise per level.
  The chest menu shows only unlocked spells, with charge pips. Skills (Attack, Defence, Speed, Vitality) keep their
  panel as the Skills tab, at the frog.
- **Co-op** (my call, flag if wrong): waves belong to the room, so a death does not reset the room's wave. The player
  who dies loses their carried gems and respawns at the start with full health, and keeps playing.
  The portal only banks that player's gems; nobody leaves the world.

## Open points for the builder
- Exact numbers above (cost curves, ramp), balance by playing.
- The portal gives a short banked-gems banner and effect; whether it vanishes after use or stays its 20 s is up to the builder.
- Existing saves: banked gems = current gems; spells all start locked (even for current players); a save that was in the workshop resumes in the world.
- Remove the workshop code (base scene, layout, atlas, tools) and the menu's Workshop button.

## What is left alone
Sword drops, potions, sword slash, spell visuals, co-op rooms, safe-portal timing (random), frog look and timing.
