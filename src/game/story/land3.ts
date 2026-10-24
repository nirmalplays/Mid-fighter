/**
 * Land 3: Aquatica, the Sunken Rime. An ocean flash-frozen mid-tsunami into walls of black ice,
 * coral cathedrals under cracking air-domes, and the Mariana Wound three miles down. The last third
 * of Lyra's soul and the Frost Core lie in the forehead diamond of Hydros the Frozen Leviathan,
 * once Grand Admiral Kaelis. Curse: Hypothermic Stagnation (frostbite builds while you stand still
 * away from a brazier) and Rime-Slip (crampons keep your footing).
 */
import { guardCode, wardenCode } from '../eidolon.ts';
import { cine, flashback, say, scroll, vision, type Land, type PropDef, type SideQuest, type Step } from './types.ts';

const NER = 'Scholar Nerissa';

const PROPS: PropDef[] = [
    // The Rime-Shelf Outpost (the Sanctuary).
    { id: 'a_spire', type: 'spire', site: 'camp', at: [0, -2.6] },
    { id: 'a_altar', type: 'altar', site: 'camp', at: [-1.9, -1.4] },
    { id: 'a_loom', type: 'loom', site: 'camp', at: [2.2, -1.8] },
    { id: 'a_bath', type: 'slab', site: 'icefall', at: [0, 0], name: 'Lyra' },
    // Three frozen magma fissures, and the steam manifold to the Spire.
    ...[[-3, -1], [3, -1], [0, 3]].map(([x, y], n): PropDef => ({ id: `a_fis${n}`, type: 'fault', site: 'vents', at: [x, y], wedge: true, name: 'Frozen fissure', color: 0xff8a3d })),
    { id: 'a_pipes', type: 'pipe', site: 'vents', at: [0, -3.4], name: 'Steam manifold' },
    // The Refracting Glacier vault.
    { id: 'a_prisms', type: 'crystal', site: 'glacier', at: [0, -1], name: 'Ice prisms', color: 0xbae6fd },
    // The Dawn-Breaker, frozen at the top of the wave.
    { id: 'a_ship', type: 'ship', site: 'wave', at: [0, -1], name: 'The Dawn-Breaker', color: 0x6a7a90 },
    // The Kelp Caverns: three perimeter steam geysers round Orlov.
    ...[[-5, -3], [5, -3], [0, 5]].map(([x, y], n): PropDef => ({ id: `a_gy${n}`, type: 'geyser', site: 'kelpden', at: [x, y], name: 'Steam geyser' })),
    // Thalassia's three boilers.
    { id: 'a_b1', type: 'machine', site: 'boiler1', at: [0, -1], name: 'Frozen lock', color: 0x8ab0c8 },
    { id: 'a_pipe2', type: 'pipe', site: 'boiler2', at: [0, -1], name: 'Steam intake pipe' },
    { id: 'a_b3', type: 'machine', site: 'boiler3', at: [0, 0], name: 'Pressure gauge', color: 0xd4a050 },
    // The Sunken Royal Conservatory: twelve frozen organ pipes.
    { id: 'a_organ', type: 'harp', site: 'conservatory', at: [0, -1], name: 'Crystal organ', color: 0xbae6fd },
    // The Echoing Trench: Seraphina's bioluminescent lures.
    ...[[-5, -4], [5, -4], [-5, 4], [5, 4]].map(([x, y], n): PropDef => ({ id: `a_lure${n}`, type: 'lure', site: 'trench', at: [x, y], name: 'Bioluminescent lure' })),
    // The Great Hydro-Engine: four basins.
    { id: 'a_sluice', type: 'machine', site: 'engine', at: [0, -1], name: 'Sluice wheels', color: 0x6a8aa0 },
    // The Hadal Chasm: the diving bell, pinned by ice.
    { id: 'a_ice0', type: 'fault', site: 'chasm', at: [-1.6, 0], wedge: true, name: 'Pressure ice', color: 0xbae6fd },
    { id: 'a_ice1', type: 'fault', site: 'chasm', at: [1.6, 0], wedge: true, name: 'Pressure ice', color: 0xbae6fd },
    { id: 'a_bell', type: 'bell', site: 'chasm', at: [0, -1.6], name: 'Diving bell', color: 0x8a9aa8 },
    // The Cathedral of Black Ice: three giant icicles over the portcullis.
    ...[[-3, -2], [0, -3], [3, -2]].map(([x, y], n): PropDef => ({ id: `a_icicle${n}`, type: 'stalactite', site: 'cathedral', at: [x, y], wedge: true, name: 'Giant icicle' })),
    // The Bathysphere's three furnace stops on the way down.
    { id: 'a_stop1', type: 'brazier', site: 'lift1', at: [0, 0], name: 'Lift furnace' },
    { id: 'a_stop2', type: 'brazier', site: 'lift2', at: [0, 0], name: 'Lift furnace' },
    { id: 'a_stop3', type: 'brazier', site: 'lift3', at: [0, 0], name: 'Lift furnace' },
    // The trench floor: four geothermal geyser vents round Hydros's platform.
    ...[[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]].map(([x, y], n): PropDef => ({ id: `a_gv${n}`, type: 'geyser', site: 'hydros', at: [x, y], name: 'Geothermal vent' })),
];

const MAIN: Step[] = [
    // ================================================================ ACT I: BENEATH THE BLACK ICE
    {
        id: 'a_lift', quest: 'The Glacier of Frozen Tears', act: 1,
        task: 'Lead Lyra down to the Rime-Shelf Outpost',
        how: 'Press E at the bath to take it. Glacial Stalkers prowl the ice. Keep moving: standing still builds frostbite. Carry her to the outpost and press E at the alcove.',
        goal: { kind: 'carry', label: 'Lyra' }, at: 'camp',
        spawn: { at: 'icefall', foes: ['wolf', 'wolf', 'wolf', 'wolf', 'wolf'] },
        intro: [cine('The Frozen Waterfall Lift', 'Beneath the Black Ice', 'The lift groans three thousand feet down into an ocean frozen mid-tsunami. Walls of black ice tower two hundred feet overhead, and in them, the shapes of drowned ships.', 'Lyra\'s hands and legs are sealed in rime. Her breath mists, though the bath is warm.')],
        reward: { xp: 150, lyra: 20 },
    },
    {
        id: 'a_fissures', quest: 'The Glacier of Frozen Tears', act: 1,
        task: 'Crack the three frozen magma fissures',
        how: 'Plant Resonant Wedges in each fissure (hotbar, then use: up to 3 at a time) and press E with nothing in front of you to detonate them.',
        goal: { kind: 'break', props: ['a_fis0', 'a_fis1', 'a_fis2'] }, at: 'vents',
        reward: { xp: 150 },
    },
    {
        id: 'a_pipes', quest: 'The Glacier of Frozen Tears', act: 1,
        task: 'Route the steam manifold into the Geothermal Spire',
        how: 'Press E at the manifold and turn the bronze pipes so the steam runs from the fissures (S) to the Spire (E).',
        goal: { kind: 'puzzle', puzzle: 'steampipes', prop: 'a_pipes' }, at: 'prop:a_pipes',
        outro: [cine('The Rime-Shelf Outpost', 'Thawed', 'Steam roars up the manifold. The geothermal dome blooms, and the black ice round the outpost weeps and runs.', 'A woman in a diver\'s harness takes one step, finishes the step she started three hundred years ago, and stares at you.'),
        say(NER, 'Before the Mist', 'I was flash-frozen on the night of the Shattering. Before the Mist existed. I remember everything.', 'Admiral Kaelis led an armada to stop Malakor that night. When Malakor froze the sea, Kaelis became Hydros, and his grief freezes every soul-memory in the world into the Black Ice Pillars of the trench.')],
        reward: { xp: 200, flags: ['nerissa'] },
    },
    {
        id: 'a_teeth', quest: 'Treading the Razor Rime', act: 1,
        task: 'Gather 10 Serrated Shark-Teeth and 8 Thermal Kelp Fibers',
        how: 'Mine the ice-entombed rocks of Aquatica for teeth; drink, fish or wade at open water for kelp.',
        goal: { kind: 'items', items: { shark_tooth: 10, kelp_fiber: 8 } },
        reward: { xp: 150 },
    },
    {
        id: 'a_crampons', quest: 'Treading the Razor Rime', act: 1,
        task: 'Forge Ice-Treader Crampons',
        how: 'Craft them at the bench (Bag › Craft). With them, the ice cannot steal your footing.',
        goal: { kind: 'items', items: { crampons: 1 } },
        reward: { xp: 120 },
    },
    {
        id: 'a_glacier', quest: 'Treading the Razor Rime', act: 1,
        task: 'The Refracting Glacier: bend the aurora onto the vault door',
        how: 'Press E at the ice prisms. Turn each prism a quarter at a time until the light runs through all four at right angles.',
        goal: { kind: 'puzzle', puzzle: 'refract', prop: 'a_prisms' }, at: 'prop:a_prisms',
        reward: { xp: 200, items: { thermal_salts: 2 } },
    },
    {
        id: 'a_salts', quest: 'Treading the Razor Rime', act: 1,
        task: 'Brew Lyra a tea of Thermal Salts',
        how: 'Press E beside Lyra with the salts.',
        goal: { kind: 'give', item: 'thermal_salts' }, at: 'prop:a_altar',
        outro: [say(NER, 'Warmth', 'The salts keep the cold Mist out of her, for a while. She asked me about the sea. She has never seen it frozen, she said, and then she laughed, because she has.', 'Now build. The blizzards here come with teeth.')],
        reward: { xp: 150, lyra: 60 },
    },
    {
        id: 'a_fortify', quest: "The Trench-Brute's Toll", act: 1,
        task: 'Set 4 Steam-Braziers and 2 Ice-Breaker Ballistas round the outpost',
        how: 'Craft them at the bench and set them inside the Sanctuary. Braziers also keep frostbite away.',
        goal: { kind: 'place', items: { brazier_beacon: 4, ballista: 2 } }, at: 'camp',
        reward: { xp: 150 },
    },
    {
        id: 'a_siege1', quest: "The Trench-Brute's Toll", act: 1,
        task: 'Survive Blizzard Siege I',
        how: 'Frost-Hulks and Shatter-Crabs come out of the whiteout. Hold the Spire.',
        goal: { kind: 'siege', secs: 95, waves: [{ t: 0, foes: ['scorpion', 'scorpion', 'wolf', 'wolf', 'brute', 'archer'] }, { t: 32, foes: ['brute', 'scorpion', 'scorpion', 'wolf', 'bomber'] }, { t: 64, foes: ['brute', 'brute', 'scorpion', 'wraith', 'wraith', 'wizard'] }] },
        at: 'prop:a_spire',
        reward: { xp: 300, items: { potion_red: 2 } },
    },
    {
        id: 'a_orlov', quest: "The Trench-Brute's Toll", act: 1,
        task: 'Defeat Frost-Bite the Trench Brute',
        how: 'Dodge the ice-breath and the sliding slams. Below half he seals himself in an Absolute-Zero shell: strike a steam geyser beside him to superheat it, then hit him.',
        goal: { kind: 'boss', boss: 'orlov', site: 'kelpden' }, at: 'kelpden',
        outro: [
            cine('First Mate Orlov', 'The Mutiny', 'The glacier shell bursts into steam. Inside, a broad-shouldered sailor with frost in his beard.', '"I told him to turn the fleet around... I told him..."'),
            flashback('Winter in the High Pass', 'The expedition wagon snowed in on a mountain pass. You feed old crate slats to the stove.', 'Lyra sketches constellations on the frosted windowpane with her thumb, and names them after the two of you.'),
        ],
        reward: { xp: 650, lyra: 10, flags: ['thermal_shock', 'zoneB', 'shard:mutiny'] },
    },
    // ================================================================ ACT II: THE SUNKEN CATHEDRALS
    {
        id: 'a_walls', quest: 'Thawing the Great Boilers', act: 2,
        task: 'Raise the Storehouse to level 3 (coral-stone and steam-piped walls)',
        how: 'Bag › Camp at the outpost.',
        goal: { kind: 'build', building: 'store', level: 3 }, at: 'camp',
        reward: { xp: 120 },
    },
    {
        id: 'a_boiler1', quest: 'Thawing the Great Boilers', act: 2,
        task: 'Boiler 1: slide the granite blocks onto the three pressure switches',
        how: 'Press E at the frozen lock. Blocks slide until they hit something; raise ice pillars as stops.',
        goal: { kind: 'puzzle', puzzle: 'slide', prop: 'a_b1' }, at: 'prop:a_b1',
        reward: { xp: 200 },
    },
    {
        id: 'a_boiler2', quest: 'Thawing the Great Boilers', act: 2,
        task: 'Boiler 2: hunt the three Angler-Beasts in the flooded dark',
        how: 'Kill the Angler-Beasts in the lower chambers; their lure-lanterns drive back the shadow-eels.',
        goal: { kind: 'clear', site: 'boiler2', foes: ['scorpion', 'scorpion', 'scorpion', 'slime', 'slime'], secs: 0, gives: { lure_lantern: 3 } }, at: 'boiler2',
        reward: { xp: 180 },
    },
    {
        id: 'a_boiler2b', quest: 'Thawing the Great Boilers', act: 2,
        task: 'Boiler 2: weld the steam intake pipe',
        how: 'Press E at the intake pipe.',
        goal: { kind: 'touch', prop: 'a_pipe2', label: 'Weld the pipe' }, at: 'prop:a_pipe2',
        reward: { xp: 100 },
    },
    {
        id: 'a_boiler3', quest: 'Thawing the Great Boilers', act: 2,
        task: 'Boiler 3: defend the pressure gauges for 2 minutes',
        how: 'Stay by the gauges while the pressure climbs; Drowned Conclave Zealots come for them.',
        goal: { kind: 'defend', prop: 'a_b3', secs: 120, foes: ['skeleton', 'skeleton', 'wizard', 'skeleton', 'skeleton', 'wizard'], label: 'Hold the gauges' }, at: 'prop:a_b3',
        outro: [cine('Thalassia', 'The Canal', 'Three boilers roar. The ice floor of the city melts into a canal, black and steaming, running down into the Echoing Trench.')],
        reward: { xp: 200 },
    },
    {
        id: 'a_seraphina', quest: 'The Siren of the Dark Trench', act: 2,
        task: 'Defeat the Queen of the Trench',
        how: 'Her Siren\'s Lament turns your controls backwards: ring the Hymn (R) to clear your head. At half health she drowns the light: strike a glowing lure near her to light the cavern and stun her.',
        goal: { kind: 'boss', boss: 'seraphina', site: 'trench' }, at: 'trench',
        outro: [
            cine('High Hydromancer Seraphina', 'The Siren', 'The jellyfish crown dims. Inside it, a woman\'s face, peaceful at last.', '"He poured my wine himself... he was crying..."'),
            flashback('The Underground River', 'A hidden crystal lake in your first year as apprentices. Lyra skips a flat granite stone across the dark water.', 'You both listen to the echoes count the depth. Seven. Eight. Nine.'),
        ],
        reward: { xp: 700, lyra: 10, flags: ['glacial_counter', 'zoneC', 'shard:murder'] },
    },
    // ================================================================ ACT III: THE DROWNED ENGINE OF THALASSIA
    {
        id: 'a_siege2', quest: 'The Rime-Moon Siege', act: 3,
        task: 'Survive the Absolute-Zero Siege',
        how: 'Lyra watches from the alcove window and calls out where they come from. Hold the Spire.',
        goal: { kind: 'siege', secs: 115, waves: [{ t: 0, foes: ['scorpion', 'scorpion', 'brute', 'wolf', 'wolf', 'archer', 'bomber'] }, { t: 38, foes: ['brute', 'brute', 'scorpion', 'wizard', 'wraith', 'wraith'] }, { t: 76, foes: ['brute', 'brute', 'brute', 'scorpion', 'scorpion', 'wizard', 'wizard'] }] },
        at: 'prop:a_spire',
        reward: { xp: 350, items: { potion_purple: 1 } },
    },
    {
        id: 'a_basins', quest: 'The Floodgates', act: 3,
        task: 'The Four-Basin Water Level: equalize the basins',
        how: 'Press E at the sluice wheels. Each wheel pours water from one basin into the next; bring all four to exactly the same level.',
        goal: { kind: 'puzzle', puzzle: 'basins', prop: 'a_sluice' }, at: 'prop:a_sluice',
        reward: { xp: 220 },
    },
    {
        id: 'a_icicles', quest: 'The Unyielding Shield', act: 3,
        task: 'Breach the Cathedral of Black Ice: drop the three giant icicles',
        how: 'Plant wedges in each icicle and detonate them onto the portcullis.',
        goal: { kind: 'break', props: ['a_icicle0', 'a_icicle1', 'a_icicle2'] }, at: 'cathedral',
        reward: { xp: 200 },
    },
    {
        id: 'a_vane', quest: 'The Unyielding Shield', act: 3,
        task: 'Defeat the Frozen Paladin',
        how: 'His tower shield turns every blow from the front: roll (K) past him and strike within a breath, from behind. Below 40% he summons ice-mirror clones; the true Vane trails sapphire mist.',
        goal: { kind: 'boss', boss: 'vane', site: 'paladin' }, at: 'paladin',
        outro: [
            cine('Lord Commander Vane', 'The Bodyguard', 'The rime armour falls away. The old soldier sits down heavily on the cathedral step.', '"I came too late... they were already dead at the table... and he was at the spikes..."'),
            flashback('The Oath on the Chisel', 'The night before the Pyraxis dig. Lyra hands you her master-crafted mason\'s chisel, both your names engraved on it.', '"Whatever we dig up tomorrow, we finish the carving together."'),
        ],
        reward: { xp: 750, lyra: 10, flags: ['triad', 'zoneD', 'shard:failure'] },
    },
    // ================================================================ ACT IV: THE HEART OF THE ABYSS
    {
        id: 'a_relics', quest: 'The Strata-Loom', act: 4,
        task: 'Mend the three relics of Aquatica at the Strata-Loom',
        how: "Press E at the Archaeologist's Workbench in the outpost.",
        goal: { kind: 'relics', ids: ['mutiny', 'murder', 'failure'] }, at: 'prop:a_loom',
        reward: { xp: 250 },
    },
    {
        id: 'a_descent', quest: 'Descent into the Mariana Wound', act: 4,
        task: 'Ride the Bathysphere down: stoke its three furnaces',
        how: 'Stand at each furnace stop until it is stoked, fighting off the Trench Horrors that board.',
        goal: { kind: 'stations', props: ['a_stop1', 'a_stop2', 'a_stop3'], secs: 5, foes: ['scorpion', 'wraith', 'wraith'], label: 'Lift furnaces' }, at: 'lift1',
        reward: { xp: 250 },
    },
    {
        id: 'a_hydros', quest: 'The Frozen Leviathan', act: 4,
        task: 'Defeat Hydros the Frozen Leviathan',
        how: 'Below 65% he dives and hardens: strike the geothermal vent he breaches beside to scald him onto the platform. At the end, Triad and Hymn: strike on the beat to shatter his diamond crown.',
        goal: { kind: 'boss', boss: 'hydros', site: 'hydros' }, at: 'hydros',
        outro: [cine('The Mariana Wound', 'The Black Ice Thaws', 'The diamond crown shatters. Inside the leviathan, for a heartbeat, an old admiral salutes.', 'The black ice across Aquatica runs into warm turquoise sea. The frozen waterfalls roar back to life, and a thousand memory motes rise from the trench like lanterns.')],
        reward: { xp: 1200 },
    },
    {
        id: 'a_awaken', quest: 'The Frozen Leviathan', act: 4,
        task: 'Complete the Elemental Triad',
        how: 'Return to the outpost and press E beside Lyra.',
        goal: { kind: 'touch', prop: 'a_altar', label: 'The Frost Core' }, at: 'prop:a_altar',
        outro: [
            cine('The Rime-Shelf Outpost', 'Whole', 'Fire, Storm and Frost. You lay the last Core in her hands, and a warm, golden wave washes through the room.', 'Her eyes open, clear and bright and full of tears. She throws her arms around your neck.'),
            say('Lyra', 'All the Way Down', '"{hero}! By the stones... I saw you fighting through the ash, through the thunder, through the dark water... You came all the way to the bottom of the world for me!"'),
            cine('Eidolon', 'The Final Purge', 'Lyra picks up her Master Enchanter\'s Runic Staff. Above, the whole sky turns violet.', 'In the Void Citadel, Malakor feels his three anchors die. He begins to drain the Heart of the World, to drop every land into the Abyss and begin again.', 'Golden ley-bridges link the three pacified lands. The Void Wastes are open.'),
        ],
        reward: { xp: 500, lyra: 100, flags: ['land3', 'lyra_staff'] },
    },
];

const SIDES: SideQuest[] = [
    {
        id: 'a_signal', title: "The Frozen Armada's Last Signal", unlock: 'nerissa',
        steps: [
            {
                id: 'a_si_climb', quest: "The Frozen Armada's Last Signal", act: 1, task: 'Climb the frozen wave to the Dawn-Breaker', how: 'Rime-Harpy Scavengers nest on the wave. Clear them.',
                goal: { kind: 'clear', site: 'wave', foes: ['wraith', 'wraith', 'wraith', 'archer'], secs: 0, gives: {} }, at: 'wave',
            },
            {
                id: 'a_si_lamp', quest: "The Frozen Armada's Last Signal", act: 1, task: 'Flash the heliograph signal down to the outpost', how: 'Press E at the ship. Align both mirrors so the lamp reaches the outpost.',
                goal: { kind: 'puzzle', puzzle: 'heliograph', prop: 'a_ship' }, at: 'prop:a_ship',
                outro: [say(NER, 'Fleet Anchored', 'I saw it from the window. "Fleet anchored. Come home safe." Varian\'s code. He held that lamp for three hundred years.', 'Take his spyglass. And these plans: a steam-mortar the navy never had time to build.')],
                reward: { xp: 300, flags: ['spyglass'] },
            },
        ],
    },
    {
        id: 'a_choir', title: 'The Choir of the Drowned Children', unlock: 'done:a_boiler1',
        steps: [
            {
                id: 'a_ch_pipes', quest: 'The Choir of the Drowned Children', act: 2, task: 'Thaw the twelve organ pipes in rising pitch', how: 'Press E at the crystal organ. Thaw the pipes from the lowest note to the highest.',
                goal: { kind: 'puzzle', puzzle: 'organ', prop: 'a_organ' }, at: 'prop:a_organ',
                outro: [scroll('The Final Conclave', 'The organ plays, and a hologram rises: the Grand Circle\'s last vote.', 'Six Arch-Mages voted to rally the nations and fight the Fourth Tide together, as Eidolon always had. One voted to shatter the world rather than risk the war. Malakor.', 'That night, he poisoned the other six.')],
                reward: { xp: 300, flags: ['pitch_pipe'] },
            },
        ],
    },
    {
        id: 'a_diver', title: "The Diver's Last Breath", unlock: 'done:a_siege2',
        steps: [
            {
                id: 'a_di_ice', quest: "The Diver's Last Breath", act: 3, task: 'Free the prototype diving bell in the Hadal Chasm', how: 'Wedge the pressure ice off the bell and detonate it.',
                goal: { kind: 'break', props: ['a_ice0', 'a_ice1'] }, at: 'chasm',
            },
            {
                id: 'a_di_bell', quest: "The Diver's Last Breath", act: 3, task: 'Open the diving bell', how: 'Press E at the bell.',
                goal: { kind: 'touch', prop: 'a_bell', label: 'Open the bell' }, at: 'prop:a_bell',
                outro: [say(NER, 'Hadal Plate', 'Varian\'s bell. He was testing it for the armada. Wear his cuirass: the cold will not touch you now.')],
                reward: { xp: 300, flags: ['hadal'] },
            },
        ],
    },
];

const RELICS = [
    { id: 'mutiny', n: 7, title: "Relic VII: The First Mate's Mutiny", shards: 3, vision: vision("Corrupted Memory Relic VII: The First Mate's Mutiny", 'Orlov grips the Admiral\'s sleeve on the flagship\'s deck. "He has armed the spikes! Turn the fleet around!"', 'Kaelis shakes him off. "If the Arch-Mage breaks the world today, let the history books show the Navy died trying to pull his hand off the lever."') },
    { id: 'murder', n: 8, title: 'Relic VIII: The Murder of the Circle', shards: 4, vision: vision('Corrupted Memory Relic VIII: The Murder of the Circle', 'Malakor fills Seraphina\'s ceremonial goblet before the Conclave meets. His hand does not shake. His eyes are wet.', '"Your kindness will kill this planet, Seraphina. Sleep, while I do the butcher\'s work."') },
    { id: 'failure', n: 9, title: "Relic IX: The Bodyguard's Failure", shards: 5, vision: vision("Corrupted Memory Relic IX: The Bodyguard's Failure", 'Vane bursts into the council chamber, sword drawn. Seraphina and the councillors lie still at the table.', 'Through the far window, Malakor stands among the obsidian spikes, already singing.') },
];

export const LAND3: Land = {
    n: 3,
    el: 'water',
    title: 'Aquatica, the Sunken Rime',
    camp: 'Rime-Shelf Outpost',
    alias: { camp: 'camp', kelpden: 'guard:1', trench: 'guard:2', paladin: 'guard:3', hydros: 'arena' },
    siteNames: {
        camp: 'Rime-Shelf Outpost', icefall: 'Frozen Waterfall Lift', shelf: 'Frozen Tsunami Shelf', glacier: 'Refracting Glacier', wave: 'The Frozen Wave', vents: 'Frozen fissures',
        kelp: 'Bioluminescent Kelp', kelpden: 'Kelp Caverns', boiler1: 'Boiler I', boiler2: 'Boiler II', boiler3: 'Boiler III', conservatory: 'Royal Conservatory', trench: 'Echoing Trench',
        engine: 'Great Hydro-Engine', chasm: 'Hadal Chasm', cathedral: 'Cathedral of Black Ice', paladin: 'Cathedral Nave',
        lift1: 'Bathysphere', lift2: 'Bathysphere', lift3: 'Bathysphere', wound: 'Mariana Wound', hydros: 'The Trench Floor',
    },
    start: 'icefall',
    props: PROPS,
    main: MAIN,
    sides: SIDES,
    bosses: {
        orlov: { code: guardCode('water', 1), site: 'kelpden', intro: 'Frost-Bite the Trench Brute drags his anchor chain out of the kelp!', mechs: [
            { kind: 'armor', at: 0.5, share: 0.1, props: ['geyser'], near: 4, open: 8000, msg: 'Orlov seals himself in an Absolute-Zero shell! Strike a steam geyser beside him', openMsg: 'Thermal shock! The shell bursts into steam: strike now' },
        ] },
        seraphina: { code: guardCode('water', 2), site: 'trench', intro: 'The Queen of the Trench rises, singing!', mechs: [
            { kind: 'invert', at: 0.95, every: 26000, msg: "The Siren's Lament twists your senses! Ring the Hymn (R) to clear your head" },
            { kind: 'dark', at: 0.5, props: 'lure', msg: 'She shatters every light! Strike a glowing lure near her to electrify the water' },
        ] },
        vane: { code: guardCode('water', 3), site: 'paladin', intro: 'The Frozen Paladin raises his tower shield of rime!', mechs: [
            { kind: 'shield', share: 0.15, msg: 'His shield turns the blow! Roll (K) past him and strike from behind' },
            { kind: 'adds', at: 0.4, foes: ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'wraith', 'wraith', 'wraith', 'wraith'], msg: 'The Hall of Eight Mirrors: ice clones charge!' },
        ] },
        hydros: { code: wardenCode('water'), site: 'hydros', intro: 'HYDROS THE FROZEN LEVIATHAN', mechs: [
            { kind: 'armor', at: 0.65, share: 0.1, props: ['geyser'], near: 6, open: 9000, msg: 'Hydros dives under the ice in a whiteout! Strike the geothermal vent he breaches beside', openMsg: 'The vent scalds his throat: he flips onto the platform! Strike!' },
            { kind: 'finisher', at: 0.1, beats: 4, msg: 'Absolute Zero! Triad and Hymn: strike on the beat to shatter his diamond crown' },
        ] },
    },
    hazards: [{ kind: 'frost' }],
    relics: RELICS,
    puzzles: {
        steampipes: { kind: 'route', title: 'The Steam Manifold', hint: 'Turn the bronze pipes so steam runs from S (the fissures) to E (the Spire).', grid: ['SIIL', '...I', '.LIL', '.E..'], rot: ['0103', '0000', '0213', '0000'] },
        refract: { kind: 'dials', title: 'The Refracting Glacier', hint: 'Turn each ice prism a quarter at a time. The beam goes on through every prism set at its right angle.', size: 4, start: [0, 0, 0, 0], target: [1, 3, 2, 1], labels: ['Prism I', 'Prism II', 'Prism III', 'Prism IV'], show: 'angle' },
        heliograph: { kind: 'dials', title: 'The Heliograph', hint: 'Aim the two signal mirrors: the first catches the sun (3), the second throws it down to the outpost (6).', size: 8, start: [0, 0], target: [3, 6], labels: ['Sun mirror', 'Signal mirror'], show: 'angle' },
        slide: { kind: 'slide', title: 'The Frozen Lock', hint: 'Pick a block, then a direction: it slides until it hits something. Raise up to 2 ice pillars as stops. Get all three blocks onto the switches.', size: 5, blocks: [[1, 0], [3, 4], [0, 1]], switches: [[1, 3], [3, 1], [2, 1]], walls: [[1, 4], [3, 0]], pillars: 2 },
        organ: { kind: 'sequence', title: 'The Crystal Organ', hint: 'Thaw the twelve pipes from the lowest note to the highest.', items: Array.from({ length: 12 }, (_, n) => ({ label: '', color: '#bae6fd', freq: 220 * Math.pow(2, [5, 11, 2, 8, 0, 6, 10, 3, 9, 1, 7, 4][n] / 12) })), order: [4, 9, 2, 7, 11, 0, 5, 10, 3, 8, 6, 1] },
        basins: { kind: 'levels', title: 'The Four Basins', hint: 'Each wheel pours one measure from a basin into the next. Bring all four basins to the same level (37.5%).', start: [6, 1, 4, 1], target: 3, step: 1 },
    },
    bedside: [
        { flag: '', line: 'Lyra stands at the outpost window, watching the frozen sea. Two-thirds of her are home. She keeps reaching for a word that is not there.' },
        { flag: 'done:a_salts', line: 'She stands at the window, leaning on you. "The sea is frozen," she says, as if remembering it was not.' },
        { flag: 'thermal_shock', line: '"Do you remember the wagon? The stars on the glass?" She laughs. "You named one after a pickaxe."' },
        { flag: 'glacial_counter', line: 'She counts under her breath: "Seven. Eight. Nine." Then she smiles at you.' },
        { flag: 'triad', line: 'She turns the chisel over in her hands, tracing both your names. "Together," she says.' },
        { flag: 'land3', line: 'Lyra is whole. She leans her staff against the alcove and will not let go of your hand.' },
    ],
    draught: 'thermal_salts',
    conduit: 0xbae6fd,
    memories: [
        { flag: 'thermal_shock', line: 'Stars drawn on a frosted window, named after the two of you.' },
        { flag: 'glacial_counter', line: 'A skipping stone on a black lake. "Seven. Eight. Nine."' },
        { flag: 'triad', line: '"Whatever we dig up tomorrow, we finish the carving together."' },
    ],
};
