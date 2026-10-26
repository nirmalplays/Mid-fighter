/**
 * Land 1: Pyraxis, the Scorched Strata. The whole campaign of the first land as data: its places,
 * the things in them you break, strike, solve and carry, and the quest line (four acts) with its
 * side quests, every line said, every flashback and relic vision, every reward.
 * The engine that runs it is game/story/quest.ts; the world side is game/world/storyLayer.ts.
 *
 * The story: you are an Archaeologist-Enchanter. Your expedition broke an obsidian seal in the
 * ash-caverns; Ignis the Molten Scourge woke and devoured the village's Memory Pillars, and with
 * them everything Lyra remembered. She is unhurt, still herself, and she does not know you. Carve her memories back out of the beast.
 */
import { guardCode, wardenCode } from '../eidolon.ts';
import { cine, flashback, say, scroll, vision, type Land, type PropDef, type SideQuest, type Step } from './types.ts';

/** Everything placed by the story, site by site. */
const PROPS: PropDef[] = [
    // The Deep-Strata Dig's Sealed Chamber (an interior, world/interiors.ts): Lyra walled in by three resonance-locked boulders.
    { id: 'q_slab', type: 'slab', site: 'quarry', at: [0, 0] },
    { id: 'q_b1', type: 'boulder', site: 'quarry', at: [-1.6, 0.4], hp: 5 },
    { id: 'q_b2', type: 'boulder', site: 'quarry', at: [1.6, 0.4], hp: 5 },
    { id: 'q_b3', type: 'boulder', site: 'quarry', at: [0, 1.8], hp: 5 },
    { id: 'q_ruin1', type: 'ruin', site: 'quarry', at: [-3.5, -2.5] },
    { id: 'q_ruin2', type: 'ruin', site: 'quarry', at: [3.2, -3] },
    // The Ruined Watchtower of Oakhaven (the Sanctuary): the Memory Spire and Lyra's altar.
    { id: 'spire', type: 'spire', site: 'camp', at: [0, -2.6] },
    { id: 'altar', type: 'altar', site: 'camp', at: [-1.9, -1.4] },
    // The Sunken Village of Oakhaven: Orin's alembic in the burned bathhouse.
    { id: 'o_alembic', type: 'alembic', site: 'oakhaven', at: [2.5, -2] },
    { id: 'o_ruin1', type: 'ruin', site: 'oakhaven', at: [1.2, -3] },
    { id: 'o_ruin2', type: 'ruin', site: 'oakhaven', at: [-3, 1.5] },
    { id: 'o_ruin3', type: 'ruin', site: 'oakhaven', at: [-2, -3.4] },
    // The hot springs: five geysers around a dry basin.
    { id: 's_basin', type: 'basin', site: 'springs', at: [0, 0] },
    ...[0, 1, 2, 3, 4].map((n) => ({ id: `s_g${n}`, type: 'geyser' as const, site: 'springs' as const, at: [Math.cos((n / 5) * Math.PI * 2) * 3.2, Math.sin((n / 5) * Math.PI * 2) * 3.2] as [number, number] })),
    // Bram's cellar: the fallen roof beam, then the acoustic lock box.
    { id: 'c_beam', type: 'beam', site: 'cellar', at: [0, 0] },
    { id: 'c_box', type: 'lockbox', site: 'cellar', at: [1.4, 1.2] },
    // The Whispering Catacombs: the false wall, the Conclave's sarcophagus.
    { id: 't_wall', type: 'fakewall', site: 'catacombs', at: [0, -1.6], hp: 8 },
    { id: 't_sarc', type: 'sarcophagus', site: 'catacombs', at: [0, -3.6] },
    // The Scorched Ridge Pass: the slag barrier's tether nodes, and the steam vents round Cedric's cliff.
    { id: 'r_t1', type: 'tether', site: 'ridge', at: [-5, -4], hp: 6 },
    { id: 'r_t2', type: 'tether', site: 'ridge', at: [5, -4], hp: 6 },
    { id: 'r_t3', type: 'tether', site: 'ridge', at: [0, -7], hp: 6 },
    { id: 'r_v1', type: 'vent', site: 'ridge', at: [-5, 2] },
    { id: 'r_v2', type: 'vent', site: 'ridge', at: [5, 2] },
    { id: 'r_v3', type: 'vent', site: 'ridge', at: [0, 5.5] },
    // The Fractured Siphon Trench.
    { id: 'a_c1', type: 'chain', site: 'siphonA', at: [-2, -1], hp: 4 },
    { id: 'a_c2', type: 'chain', site: 'siphonA', at: [2, -1], hp: 4 },
    { id: 'a_gear', type: 'gearbox', site: 'siphonA', at: [0, 1.5] },
    { id: 'b_h1', type: 'harmonic', site: 'siphonB', at: [-2.4, 0] },
    { id: 'b_h2', type: 'harmonic', site: 'siphonB', at: [2.4, 0] },
    { id: 'b_h3', type: 'harmonic', site: 'siphonB', at: [0, 2.4] },
    { id: 'b_quartz', type: 'quartz', site: 'siphonB', at: [4.5, -3] },
    { id: 'g_winch', type: 'winch', site: 'siphonG', at: [0, 0] },
    { id: 'h_scale', type: 'scale', site: 'guildhall', at: [0, 0] },
    { id: 'n_satchel', type: 'satchel', site: 'grotto', at: [0, -1] },
    // The Slag Reservoir: Tarek's four cooling valves.
    { id: 'v1', type: 'valve', site: 'reservoir', at: [-6, -6] },
    { id: 'v2', type: 'valve', site: 'reservoir', at: [6, -6] },
    { id: 'v3', type: 'valve', site: 'reservoir', at: [-6, 6] },
    { id: 'v4', type: 'valve', site: 'reservoir', at: [6, 6] },
    // The Molten Archive.
    { id: 'w_smelter', type: 'smelter', site: 'scriptW', at: [0, -1] },
    { id: 'e_smelter', type: 'smelter', site: 'scriptE', at: [0, -1] },
    { id: 'l_lectern', type: 'lectern', site: 'library', at: [0, -1.5] },
    ...[[-4, -2, true], [4, -2, false], [-4, 2, true], [4, 2, true], [0, 4, false]].map(([x, y, h], n) => ({ id: `l_st${n}`, type: 'statue' as const, site: 'library' as const, at: [x, y] as [number, number], hollow: h as boolean })),
    { id: 'l_chest', type: 'chest', site: 'library', at: [-1.8, -3.4] },
    // Mount Pyraxis: the shelter domes, the Solstice Gate, Ignis's grounding spires.
    { id: 'd1', type: 'shelter', site: 'shelter1', at: [0, 0] },
    { id: 'd2', type: 'shelter', site: 'shelter2', at: [0, 0] },
    { id: 'd3', type: 'shelter', site: 'shelter3', at: [0, 0] },
    { id: 'gate', type: 'solstice', site: 'gate', at: [0, 0] },
    { id: 'gs1', type: 'grounding', site: 'ignis', at: [-6.5, -6.5] },
    { id: 'gs2', type: 'grounding', site: 'ignis', at: [6.5, -6.5] },
    { id: 'gs3', type: 'grounding', site: 'ignis', at: [-6.5, 6.5] },
    { id: 'gs4', type: 'grounding', site: 'ignis', at: [6.5, 6.5] },
];

const ORIN = 'Master Orin';

const MAIN: Step[] = [
    // ================================================================ ACT I: ASHES OF THE UNWRITTEN
    {
        id: 'free', quest: 'The Weight of Blank Eyes', act: 1,
        task: 'Shatter the three boulders walling Lyra in',
        how: 'Strike each boulder with your chisel (J). Land three blows in a row and the fourth bursts in a Runic Fracture that hits everything around you.',
        goal: { kind: 'break', props: ['q_b1', 'q_b2', 'q_b3'] }, at: 'quarry',
        intro: [{
            speaker: 'The Sealed Chamber', title: 'The Weight of Blank Eyes', style: 'cinematic', lines: [
                'The dust settles in the Sealed Chamber. Daylight falls through the hole the beast tore in the roof. The Mist that poured out of the seal took the guild: they wander the galleries above, babbling like infants.',
                'Lyra sits against a cracked granite slab, walled in by fallen basalt. Not a scratch on her. Her golden eyes stare straight through you.',
                'There is no recognition in them at all.',
            ],
        }],
        reward: { xp: 30 },
    },
    {
        id: 'carry', quest: 'The Weight of Blank Eyes', act: 1,
        task: 'Lead Lyra out of the dig to the Ruined Watchtower',
        how: 'Press E beside her to take her hand. She follows you like a frightened stranger. Climb the ladder to the upper galleries, out through the dig’s mouth, and on to the Watchtower. Cinder-Leech larvae hunt anyone the Mist has emptied, and the Mist-struck guild wander the tunnels: keep them off her.',
        goal: { kind: 'carry' }, at: 'camp',
        spawn: { at: 'quarry', foes: ['slime', 'slime', 'slime', 'slime', 'slime', 'slime'] },
        intro: [cine('The Sealed Chamber', 'A Stranger’s Hand',
            'The last boulder falls. Lyra presses herself back against the slab as you step through, as if you were one more thing that might hurt her.',
            'Behind you the broken seal is still breathing out Mist. Stay down here, and it will take what little is left of her.',
            'Up on the ash plain stands the guild’s camp, the ruined Watchtower of Oakhaven, and in it the old Memory Spire. If it can be woken, its light holds the Mist back.',
            'You hold out your hand. After a long moment, she takes it.')],
        outro: [cine('The Ruined Watchtower', 'The Cold Spire',
            'The camp is empty. The Memory Spire stands at its heart, split down its length and dark.',
            'Its runes still remember how to burn. Patch the crack with granite, seal it with ember-resin from the scorched pines, and it may wake.')],
        reward: { xp: 40, lyra: 40 },
    },
    {
        id: 'gather', quest: 'The Weight of Blank Eyes', act: 1,
        task: 'Mine 6 granite and gather 3 ember-resin',
        how: 'The Memory Spire is cracked and dark. Mine rocks (E with the pickaxe) for granite shards and chop the scorched pines (E with the axe) for resin.',
        goal: { kind: 'items', items: { stone: 6, resin: 3 } },
        reward: { xp: 40 },
    },
    {
        id: 'seal', quest: 'The Weight of Blank Eyes', act: 1,
        task: 'Light the Memory Spire: solve the Threefold Seal',
        how: "Press E at the Spire. Turn the three stone rings until every carved channel meets the copper conduits below.",
        goal: { kind: 'puzzle', puzzle: 'seal', prop: 'spire' }, at: 'prop:spire',
        outro: [
            { speaker: 'The Watchtower', title: 'The Spire Wakes', style: 'cinematic', lines: [
                'The Spire hums to life. A shimmering dome pushes the pale mist back forty paces.',
                'At its edge an old man stumbles out of the ash and falls across the line. As his head crosses into the light he gasps, clutching his temples. His name, his trade, the last terrible hour: it all slams back into him at once.',
                'Master Orin, your guild\'s senior apothecary. He crawls to Lyra\'s altar and looks at the black veins.',
            ] },
            say(ORIN, 'Emptied', 'Not a burn on her. Her hand was on the Pillar when the beast took it, child, and everything she was went with the stone. They are not gone. I saw it swallow the Pillar whole.', 'It sits in its furnace-belly, unmelted. But the Mist pours into an emptied mind like water into a cracked jar. If it fills her before you crack that beast open, there will be nothing left to pour her memories back into.'),
        ],
        reward: { xp: 60, flags: ['orin'], items: { rune_torch: 4 } },
    },
    {
        id: 'descend', quest: "The Apothecary's Tether", act: 1,
        task: 'Descend into the Sunken Village of Oakhaven',
        how: 'Orin\'s alembic and the Cinder-Lotus lie down in Oakhaven: follow the gold marker. Orin gave you four Runic Way-Torches for the Mist there, and they are already on your hotbar.',
        goal: { kind: 'reach', site: 'oakhaven', r: 12 }, at: 'oakhaven',
        intro: [say(ORIN, "The Apothecary's Tether", 'There is a draught, a Brimstone Lucid Draught. It holds the Mist out of a mind for a while. My alembic is in the bathhouse at Oakhaven, and the Cinder-Lotus grows by the hot springs behind it.', 'The Mist is thick down there. Breathe it unwarded and it eats who you are. Take these four way-torches, child: set them down as you go, and keep to their light.')],
        reward: { xp: 30 },
    },
    {
        id: 'torches', quest: "The Apothecary's Tether", act: 1,
        task: 'Light the way: place 4 Runic Way-Torches in Oakhaven',
        how: 'Your way-torches are on your hotbar (the slot with the flame): press its number, or tap it, and you set one down in front of you. Place them a few paces apart through the village. Out of their light for long, your sight whitens and your stamina slows. Need more? Craft them at a workbench: Bag › Craft, 1 wood and 1 resin make 2.',
        goal: { kind: 'place', items: { rune_torch: 4 } }, at: 'oakhaven',
        reward: { xp: 40 },
    },
    {
        id: 'alembic', quest: "The Apothecary's Tether", act: 1,
        task: "Recover Orin's alembic from the bathhouse",
        how: 'The Hollowed Quarriers are your own coworkers, mad with Mist. Hit them with a blunt tool (pickaxe or hammer) and they fall unconscious and are carried to the Spire to be cured; a blade kills them. Then press E at the alembic.',
        goal: { kind: 'touch', prop: 'o_alembic' }, at: 'prop:o_alembic',
        spawn: { at: 'oakhaven', foes: ['hollowed', 'hollowed', 'hollowed', 'hollowed', 'hollowed'] },
        outro: [scroll('Pre-Shattering Scroll I: The Census of Ash', 'Three days before the Shattering, Malakor ordered every child of the High Council evacuated to the central citadel.', 'Every child but those of Captain Cedric, who refused to leave the miners behind.')],
        reward: { xp: 50 },
    },
    {
        id: 'lotus', quest: "The Apothecary's Tether", act: 1,
        task: 'Make the Cinder-Lotus bloom at the hot springs',
        how: 'Press E at the dry basin. Weight three of the five geysers with basalt so the steam is forced into the basin; the lotus blooms in the sudden heat.',
        goal: { kind: 'puzzle', puzzle: 'steam', prop: 's_basin' }, at: 'prop:s_basin',
        reward: { xp: 60, items: { cinder_lotus: 4 } },
    },
    {
        id: 'brew', quest: "The Apothecary's Tether", act: 1,
        task: 'Brew the Brimstone Lucid Draught and give it to Lyra',
        how: "Back at the Watchtower: build the Alchemy tent (Bag › Camp) if it isn't up, brew the draught there (Bag › Craft), then press E beside Lyra.",
        goal: { kind: 'give', item: 'stasis_draught' }, at: 'prop:altar',
        outro: [say(ORIN, 'Holding', 'There. Her eyes are clearer. The Mist will keep out of her, for now.', 'And look who followed you up the road: Bram, the blacksmith. The Spire gave him his name back. Talk to him; his forge is cold.')],
        reward: { xp: 80, lyra: 100, flags: ['bram'] },
    },
    {
        id: 'fortify', quest: 'The Night the Earth Breathed', act: 1,
        task: 'Fortify the Watchtower: 2 barricades, a spike trap and a ballista',
        how: 'Dusk is coming, and with it the first Core-Bleed Siege. Craft them at the bench (Bag › Craft), put them in your hotbar and set them down inside the Sanctuary, across the paths in.',
        goal: { kind: 'place', items: { barricade: 2, trap_spike: 1, ballista: 1 } }, at: 'camp',
        intro: [say(ORIN, 'The Night the Earth Breathed', 'Feel that? The ground is breathing. When the sky reddens the core vents, and the Wave Demons come for the memories stored in the Spire.', 'Wall the paths. Trap the choke points. They will come tonight.')],
        reward: { xp: 60 },
    },
    {
        id: 'siege1', quest: 'The Night the Earth Breathed', act: 1,
        task: 'Survive the Core-Bleed Siege: defend the Spire',
        how: 'Stay in the Sanctuary. Monsters come from every side for the Spire; if it falls the siege starts over. Knock them into your traps and strike them down.',
        goal: { kind: 'siege', secs: 75, waves: [{ t: 0, foes: ['slime', 'slime', 'kobolt', 'kobolt', 'slime', 'kobolt'] }, { t: 22, foes: ['archer', 'archer', 'kobolt', 'kobolt', 'slime', 'slime'] }, { t: 45, foes: ['brute', 'kobolt', 'kobolt', 'archer'] }] },
        at: 'prop:spire',
        reward: { xp: 120, items: { potion_red: 2 } },
    },
    {
        id: 'ridge', quest: 'The Night the Earth Breathed', act: 1,
        task: 'Shatter the three tether nodes of the slag barrier',
        how: 'Climb to the Scorched Ridge Pass. Only a Slag-Breaker edge can cut the tether nodes: Bram can forge one if you find his hammer.',
        goal: { kind: 'break', props: ['r_t1', 'r_t2', 'r_t3'] }, at: 'ridge',
        intro: [say(ORIN, 'The Champions',
            'The road to the mountain is walled with slag, held up by three tether nodes. Break them, and something will come to stop you.',
            'Malakor left champions over every road to the Fire Core. Three hundred years ago they were Pyraxis’s own: a knight, a mason, a priestess. They knelt to him. What is left of them wears fire for skin.')],
        reward: { xp: 60 },
    },
    {
        id: 'cedric', quest: 'The Night the Earth Breathed', act: 1,
        task: 'Defeat Cinder-Gore the Cleaver',
        how: 'Dodge (K) his sweeping cleaves. Below 60% he ignites his basalt armour and blows barely hurt: strike the steam vents round the cliff edge to quench it, then hit him while he is brittle.',
        goal: { kind: 'boss', boss: 'cedric', site: 'ridge' }, at: 'ridge',
        outro: [
            { speaker: 'Sir Cedric', title: 'The Anchor', style: 'cinematic', lines: ['His molten mask cracks away. Beneath it, the weeping, scarred face of an honourable knight.', '"The anchor... did it hold? Tell my men... they can lay down their picks..."', 'He presses a knot of cooled iron into your hand: the Mantle Stabilizer Knot.'] },
                        flashback('The First Chisel', 'A cedar tree. Lyra, laughing, wraps a strip of linen round your cut fingers.', '"You fight the stone. Don\'t. Feel for the grain, and strike along it."', 'She guides your hand. The rock splits clean.'),
        ],
        reward: { xp: 300, lyra: 25, flags: ['vein_striker', 'zoneB', 'shard:oath'] },
    },
    // ================================================================ ACT II: THE VEINS OF WRATH
    {
        id: 'forge2', quest: 'The Blood of the Mountain', act: 2,
        task: 'Raise the Runic Forge to level 2',
        how: "Cedric's knot is in Lyra's brazier; her fingers moved. Survivors from the ridge have joined you. Build up the Forge (Bag › Camp) to arm them for the trench.",
        goal: { kind: 'build', building: 'forge', level: 2 }, at: 'camp',
        intro: [say(ORIN, 'The Blood of the Mountain', 'She asked me your name today. She did not remember it a minute later, but she asked. And her hand closed on your cloak.', 'The Siphon Trench lies open beyond the ridge, flooded with core-magma because the three great Siphons are locked shut. Goliath Tarek, the Grand Mason, locked them. Open them, and the way to him drains.')],
        reward: { xp: 60 },
    },
    {
        id: 'alpha', quest: 'The Blood of the Mountain', act: 2,
        task: 'Siphon Alpha: cut the two counterweight chains, then align the gears',
        how: 'Strike both obsidian chains until they snap, then press E at the gearbox and turn the gears so the teeth mesh.',
        goal: { kind: 'puzzle', puzzle: 'gears', prop: 'a_gear' }, at: 'siphonA',
        reward: { xp: 80 },
    },
    {
        id: 'beta', quest: 'The Blood of the Mountain', act: 2,
        task: 'Siphon Beta: strike the three Harmonic Pillars together',
        how: 'Hit all three pillars within four seconds of each other: the standing wave shatters the glass shell. Then put down the Pyre-Wardens.',
        goal: { kind: 'chord', props: ['b_h1', 'b_h2', 'b_h3'], within: 4000 }, at: 'siphonB',
        reward: { xp: 80 },
    },
    {
        id: 'betaWardens', quest: 'The Blood of the Mountain', act: 2,
        task: 'Defeat the Pyre-Wardens guarding the wheel',
        how: 'Three elite wardens. Keep moving and dodge (K) their blows.',
        goal: { kind: 'clear', site: 'siphonB', foes: ['skeleton', 'skeleton', 'brute'], secs: 0, gives: {} }, at: 'siphonB',
        reward: { xp: 80 },
    },
    {
        id: 'gamma', quest: 'The Blood of the Mountain', act: 2,
        task: 'Siphon Gamma: defend the winch while Kael lowers himself',
        how: 'Stay by the winch for 90 seconds; Scorch-Drakes dive from the dark.',
        goal: { kind: 'defend', prop: 'g_winch', secs: 90, foes: ['wraith', 'wraith', 'wraith', 'wraith', 'archer', 'wraith'] }, at: 'prop:g_winch',
        outro: [say('Kael', 'The Apprentice', 'You... you came down for me. I thought the whole guild was gone.', 'My grandfather drafted Tarek\'s chassis before the Shattering. There is something you should know about that golem.')],
        reward: { xp: 120, flags: ['kael'] },
    },
    {
        id: 'filter', quest: 'The Petrified Architect', act: 2,
        task: 'Brew a Filter Draught and drink it',
        how: 'The Slag Reservoir is drowned in sulfur fog. Mine rocks in Pyraxis for Luminescent Lichen, brew a Filter Draught from 15 of it at the Alchemy tent (Bag › Craft), then drink it from your bag.',
        goal: { kind: 'drink', item: 'filter_draught' }, at: 'camp',
        reward: { xp: 40 },
    },
    {
        id: 'tarek', quest: 'The Petrified Architect', act: 2,
        task: 'Defeat Goliath Tarek',
        how: 'Dodge his piston slams and the slag mortars. Below half he overheats and shrugs off blows: break the four cooling valves round the floor to flash-cool him, then strike.',
        goal: { kind: 'boss', boss: 'tarek', site: 'reservoir' }, at: 'reservoir',
        outro: [
            { speaker: 'Goliath Tarek', title: 'The Architect', style: 'cinematic', lines: ['The golem crumbles. Tarek\'s fossilized hand reaches toward the ceiling and turns to quiet grey dust.', '"The blueprints... were a lie... he never meant to mend the sky..."'] },
                        flashback('The Promise at the Quarry', 'A campfire deep in the quarry. Lyra leans against your shoulder.', '"When the vault is carved, two seasons of leave. The northern meadows. No ash, no stone, just grass."', 'You promised.'),
        ],
        reward: { xp: 400, lyra: 15, flags: ['echo_dash', 'zoneC', 'piston', 'shard:ledger'] },
    },
    // ================================================================ ACT III: THE SEAT OF HERESY
    {
        id: 'bloodmoon', quest: 'The Blood Moon Siege', act: 3,
        task: 'Arm the Sanctuary: set down a flame turret and a catapult',
        how: "Tarek's fall shook the mantle. A Blood Moon siege is coming. Build a Hydraulic Flame Turret and a Catapult at the bench (Tarek's Piston Core powers them) and set them inside the Sanctuary.",
        goal: { kind: 'place', items: { flame_turret: 1, catapult: 1 } }, at: 'camp',
        intro: [say(ORIN, 'Blood Moon', 'Did you feel the mountain shift? Breaking Tarek\'s lock opened the Molten Archive... and woke everything beneath it.', 'The moon is turning red. They will come at the Spire from every side, and some will burrow under the very floor Lyra lies on.')],
        reward: { xp: 60 },
    },
    {
        id: 'siege2', quest: 'The Blood Moon Siege', act: 3,
        task: 'Survive the Blood Moon Siege',
        how: 'Hold the Sanctuary. Obsidian Behemoths and tunnelling Ash-Worms come for the Spire and Lyra.',
        goal: { kind: 'siege', secs: 100, waves: [{ t: 0, foes: ['scorpion', 'scorpion', 'kobolt', 'kobolt', 'bomber', 'archer'] }, { t: 30, foes: ['brute', 'scorpion', 'wizard', 'archer', 'bomber'] }, { t: 62, foes: ['brute', 'brute', 'scorpion', 'wraith', 'wraith', 'wizard'] }] },
        at: 'prop:spire',
        reward: { xp: 180, items: { potion_purple: 1 } },
    },
    {
        id: 'archive', quest: 'The Sunken Library', act: 3,
        task: 'Enter the Molten Archive',
        how: 'Go down through the drained reservoir gates to the Archive Sanctum, a cathedral of black marble hung over the magma.',
        goal: { kind: 'reach', site: 'library', r: 9 }, at: 'library',
        reward: { xp: 50 },
    },
    {
        id: 'tabletsW', quest: 'The Sunken Library', act: 3,
        task: 'West Scriptorium: save the tablets from the smelter',
        how: 'Zealot Inquisitors are feeding tablets to the smelter. Kill them all within 60 seconds to save what is left.',
        goal: { kind: 'clear', site: 'scriptW', foes: ['wizard', 'wizard', 'skeleton', 'skeleton'], secs: 60, gives: { solstice_tablet: 2 } }, at: 'scriptW',
        reward: { xp: 90 },
    },
    {
        id: 'tabletsE', quest: 'The Sunken Library', act: 3,
        task: 'East Scriptorium: save the last tablet',
        how: 'The same again: kill every zealot within 60 seconds.',
        goal: { kind: 'clear', site: 'scriptE', foes: ['wizard', 'wizard', 'wizard', 'skeleton', 'skeleton'], secs: 60, gives: { solstice_tablet: 1 } }, at: 'scriptE',
        reward: { xp: 90 },
    },
    {
        id: 'wordlock', quest: 'The Sunken Library', act: 3,
        task: 'Break the Runic Word-Lock',
        how: 'Press E at the lectern with the three Solstice Tablets. Turn their prisms until the projected stars match the fresco above.',
        goal: { kind: 'puzzle', puzzle: 'prism', prop: 'l_lectern' }, at: 'prop:l_lectern',
        reward: { xp: 100 },
    },
    {
        id: 'pyra', quest: "The Blind Seer's Pyre", act: 3,
        task: 'Defeat Pyra the Flame-Weaver',
        how: 'Dodge the burning scripture. Below 40% she splits into illusions and your blows pass through: press E to strike the floor with your chisel; the ripple shows the true Pyra and breaks her ward. Then strike.',
        goal: { kind: 'boss', boss: 'pyra', site: 'pyra' }, at: 'pyra',
        outro: [
            { speaker: 'High Priestess Pyra', title: 'The Blind Seer', style: 'cinematic', lines: ['She dissolves into quiet embers. Her golden blindfold slips, showing eyes wept dry centuries ago.', '"The lie... was so heavy to carry... forgive us, children of the ash..."', 'Where she fell lies the Keystone of the Caldera.'] },
                        flashback('The Unspoken Song', 'Twilight in the market at home. Lyra hums her grandmother\'s melody, four notes, low and strange.', '"As long as someone sings it, the path home never completely disappears."'),
        ],
        reward: { xp: 450, lyra: 10, flags: ['hymn', 'keystone', 'zoneD', 'shard:sin'] },
    },
    // ================================================================ ACT IV: THE CALDERA OF CONSUMED SOULS
    {
        id: 'relics1', quest: 'The Strata-Loom', act: 4,
        task: 'Mend the three Corrupted Memory Relics at the Strata-Loom',
        how: "The champions' relics came out of the rock in shards. At the Sanctuary, press E at the Archaeologist's Workbench: turn each shard to its grain, brush off the ash, and seal the seams with gold resin.",
        goal: { kind: 'relics', ids: ['oath', 'ledger', 'sin'] }, at: 'prop:loom',
        reward: { xp: 150 },
    },
    {
        id: 'crisis', quest: 'When the Mist Reaches Her', act: 4,
        task: 'Return to the Watchtower: the Spire is ringing',
        how: 'The Sanctuary bell is ringing. Go back to Lyra and talk to Master Orin.',
        goal: { kind: 'talk', npc: 'orin' }, at: 'npc:orin',
        outro: [say(ORIN, 'Before Dawn', 'The Mist got into her in the night. She has stopped asking questions; she just watches the door.', 'No draught will hold it now. You must climb Mount Pyraxis and tear the Fire Core out of Ignis before dawn. Go to Bram first: you will not crack that hide with what you carry.')],
        reward: { xp: 60, lyra: -40 },
    },
    {
        id: 'masterwork', quest: 'When the Mist Reaches Her', act: 4,
        task: "Forge the Grand Archivist's Chisel-Blade with Bram",
        how: "Talk to Bram at his forge and give him Cedric's iron, Tarek's chisel-head and Pyra's flame scroll (you carry them), with 6 iron ore and 2 gold ore.",
        goal: { kind: 'forge', cost: { iron: 6, gold: 2 }, npc: 'bram', made: "Bram forges the Grand Archivist's Chisel-Blade: Cedric's iron, Tarek's chisel-head and Pyra's flame scroll in one edge" }, at: 'npc:bram',
        reward: { xp: 120 },
    },
    {
        id: 'climb', quest: 'When the Mist Reaches Her', act: 4,
        task: 'Climb the caldera: light the three Resonance Shelter Domes',
        how: 'Magma meteors fall every twenty seconds. Stand inside each dome until it lights (and fight off what guards it), then run for the next.',
        goal: { kind: 'shelters', props: ['d1', 'd2', 'd3'], secs: 5, foes: ['wolf', 'wolf', 'wizard'] }, at: 'shelter1',
        reward: { xp: 160 },
    },
    {
        id: 'solstice', quest: 'When the Mist Reaches Her', act: 4,
        task: 'Open the Solstice Gate with Lyra\'s song',
        how: 'Press E at the gate with the Keystone. Strike the four elemental chimes in the order of the song Lyra hummed.',
        goal: { kind: 'puzzle', puzzle: 'song', prop: 'gate' }, at: 'prop:gate',
        reward: { xp: 120 },
    },
    {
        id: 'ignis', quest: 'The Belly of the World-Burner', act: 4,
        task: 'Defeat Ignis the Molten Scourge',
        how: 'Three phases. Strike the glowing seams (Vein-Striker). In the second, strike the blue spirit-shots back at it instead of dodging; when it dives into the lava, strike a grounding spire and stand on it. At the very end, hammer the chisel home to the beat of the song.',
        goal: { kind: 'boss', boss: 'ignis', site: 'ignis' }, at: 'ignis',
        outro: [{
            speaker: 'The Caldera', title: 'The Eruption of Names', style: 'cinematic', lines: [
                'With a final, deafening crack, Ignis\'s chest ruptures into harmless ash.',
                'The swallowed Memory Pillar bursts into ten thousand sapphire motes that rise into the clouds and rain down on every valley in Pyraxis.',
                'At the Sanctuary, Bram drops his hammer and falls to his knees, weeping, as his daughter\'s name and face rush back to him. Across the ash plains, husks blink, look at each other, and embrace.',
                'In your hands: the pulsing Purified Fire Core, and a fist-sized shard of the Pillar that holds Lyra.',
            ],
        }],
        reward: { xp: 900 },
    },
    {
        id: 'awaken', quest: 'The Belly of the World-Burner', act: 4,
        task: 'Bring the Fire Core to Lyra',
        how: "Go back to the Watchtower as the sun rises, and press E at Lyra's altar.",
        goal: { kind: 'touch', prop: 'altar' }, at: 'prop:altar',
        outro: [
            { speaker: 'Dawn', title: 'Awakening', style: 'cinematic', lines: [
                'The first clean sunrise in three hundred years breaks over Pyraxis. You lay the Fire Core and the shard of the Pillar in her hands.',
                'The shard melts into light and runs up her arms. She breathes in, sharply, as if waking from deep water.',
                'She looks up at your soot-streaked face, raises a trembling hand to your cheek.',
                '"You... you found the vein in the stone... You kept your promise..."',
                'Then she frowns. Her hand drops. "I know you... I know I know you... why is the rest so dark?" Her eyes cloud again.',
            ],
        }, say(ORIN, 'The Triad', 'By the First Circle... When the Pillar shattered, it did not only feed Ignis. The pillars were linked across the old grid. Two-thirds of her memories were pulled up the severed ley-tethers, into Zephyria and Aquatica.', 'She has a third of herself back: you, the cedar tree, the quarry. The rest is out there, in the Storm Core and the Frost Core. Bring them home and she will be whole.'),
        { speaker: 'Pyraxis', title: 'The Sky-Bridge', style: 'cinematic', lines: ['Outside, the obsidian chains on the eastern cliff snap. High above, the Maelstrom parts, and the ancient Sky-Bridge of the Howling Crags descends with a boom.', 'Pyraxis is pacified. The way to Zephyria is open.'] }],
        reward: { xp: 300, lyra: 60, flags: ['land1'] },
    },
];

const SIDES: SideQuest[] = [
    {
        id: 'hammer', title: "The Blacksmith's Forgotten Hammer", unlock: 'bram',
        steps: [
            {
                id: 'h_talk', quest: "The Blacksmith's Forgotten Hammer", act: 1, task: 'Talk to Bram', how: 'Bram stands by the forge in the Sanctuary. Press E beside him.',
                goal: { kind: 'talk', npc: 'bram' }, at: 'npc:bram',
                outro: [say('Bram', 'The Shaking Hands', 'I know my name. I know my trade. But my hands shake at the anvil.', 'I forged a masterwork hammer before the mist took me. Hid it in my cellar in Oakhaven, in a shielded chest, with something for my daughter. I can\'t see her face. Help me get it.')],
            },
            {
                id: 'h_beam', quest: "The Blacksmith's Forgotten Hammer", act: 1, task: "Defend Bram while he lifts the cellar's roof beam", how: 'Stand by the cellar for two minutes; Magma Hounds come.',
                goal: { kind: 'defend', prop: 'c_beam', secs: 120, foes: ['wolf', 'wolf', 'wolf', 'wolf', 'wolf', 'wolf'] }, at: 'prop:c_beam',
            },
            {
                id: 'h_box', quest: "The Blacksmith's Forgotten Hammer", act: 1, task: 'Open the acoustic lock box', how: 'Press E at the chest. Strike the three bronze chimes in the order painted on the nursery wall: low C, high G, middle E.',
                goal: { kind: 'puzzle', puzzle: 'chimes', prop: 'c_box' }, at: 'prop:c_box',
                outro: [say('Bram', 'The Doll', 'Inside: the Runic Cross-Peen Hammer, and a small wooden doll, black with soot.', 'Bram turns the doll over and over, then sets it on his workbench. "I still can\'t see her eyes... Get that pillar back from the demon, Mason. I want to know why I made this."', 'He reforges your edge on the spot: the Slag-Breaker.')],
                reward: { xp: 150, flags: ['slag_edge'] },
            },
        ],
    },
    {
        id: 'tombs', title: 'The Empty Tombs of the Conclave', unlock: 'orin',
        steps: [
            {
                id: 't_wall', quest: 'The Empty Tombs of the Conclave', act: 1, task: 'Break the false wall in the Whispering Catacombs', how: 'The catacombs lie underground: walk in through the ruined stone gate between Oakhaven and the ridge (tap this side quest to follow its marker). Inside, go up the main hall to the narrow passage at its end: it is bricked up with newer stone that glows faintly. Strike it (J) until it breaks.',
                goal: { kind: 'break', props: ['t_wall'] }, at: 'catacombs',
                intro: [vision('Outside the Mausoleum', 'A ghost-projection flickers at the tomb\'s door: guards carrying heavy iron coffins out of the tomb. The coffins are thrashing.')],
            },
            {
                id: 't_mirror', quest: 'The Empty Tombs of the Conclave', act: 1, task: 'Light the sarcophagus: the Mirror-Beam puzzle', how: 'Press E at the sarcophagus. Turn the four obsidian shields so the sunbeam from the ceiling bounces onto its lid.',
                goal: { kind: 'puzzle', puzzle: 'mirror', prop: 't_sarc' }, at: 'prop:t_sarc',
                outro: [vision('Corrupted Memory Fragment 0.5: The Conscription of Friends', 'The coffins are empty. Claw marks score the inside of the lids.', 'From a crystal in the central coffin, Malakor\'s voice, cold:', '"Forgive the chains, Cedric, Tarek, Pyra. If I ask for volunteers to become living nails in the earth\'s crust, your pride will make you hesitate, and hesitation is extinction. Better you curse my name forever as monsters than die tonight as heroes."')],
                reward: { xp: 150, flags: ['martyr_ring'] },
            },
        ],
    },
    {
        id: 'blueprint', title: "The Mason's Secret Blueprint", unlock: 'kael',
        steps: [
            {
                id: 'b_talk', quest: "The Mason's Secret Blueprint", act: 2, task: 'Talk to Kael', how: 'Kael is in the Sanctuary. Press E beside him.',
                goal: { kind: 'talk', npc: 'kael' }, at: 'npc:kael',
                outro: [say('Kael', 'The Quench System', 'Tarek built a secret Emergency Quench into his own chassis, in case Malakor\'s magic ever drove him mad.', 'The schematic is in the Drafting Guildhall, half sunk in the lava flow. If you find it, you will know exactly where his cooling valves are.')],
            },
            {
                id: 'b_scale', quest: "The Mason's Secret Blueprint", act: 2, task: "Solve the Architect's Scale in the Guildhall", how: 'Press E at the great scale. Balance the golden keystone (weight 9) with pumice (1), basalt (3) and obsidian (5).',
                goal: { kind: 'puzzle', puzzle: 'scale', prop: 'h_scale' }, at: 'prop:h_scale',
                outro: [scroll('The Quench Schematic', 'Four cooling valves at the corners of the pumping floor, each one opened by a single strike.', 'Your map now marks them, and they break at one blow.')],
                reward: { xp: 150, flags: ['schematic'] },
            },
        ],
    },
    {
        id: 'swallow', title: "The Swallow's Nest", unlock: 'quartz',
        steps: [
            {
                id: 'n_grotto', quest: "The Swallow's Nest", act: 2, task: "Find Lyra's satchel in the Whispering Grotto", how: 'Clear the Crystal-Back Spiders nesting in the grotto, then press E at the satchel on the ledge.',
                goal: { kind: 'touch', prop: 'n_satchel' }, at: 'prop:n_satchel',
                spawn: { at: 'grotto', foes: ['scorpion', 'scorpion', 'scorpion', 'scorpion'] },
                intro: [flashback('The Dropped Bag', 'The blue quartz rings under your mattock, and you remember: two weeks before the disaster you dropped Lyra\'s tool-bag down a chasm in the Old Whispering Grotto.', 'She had been carving something in it. For you.')],
            },
            {
                id: 'n_give', quest: "The Swallow's Nest", act: 2, task: 'Place the satchel in Lyra\'s hand', how: "Press E at Lyra's altar in the Sanctuary.",
                goal: { kind: 'touch', prop: 'altar' }, at: 'prop:altar',
                outro: [{ speaker: 'Lyra', title: 'The Stone Swallow', style: 'flashback', lines: ['Inside: an unfinished Stone Swallow pendant, and a charcoal sketch of the northern meadows.', 'Her handwriting: "For when the vault is finished. No more ash."', 'You fold her fingers round the swallow. She looks at it a long time, and a single tear runs down her cheek.'] }],
                reward: { xp: 120, lyra: 20 },
            },
        ],
    },
    {
        id: 'ink', title: "The Heretic's Ink", unlock: 'done:archive',
        steps: [
            {
                id: 'i_statues', quest: "The Heretic's Ink", act: 3, task: 'Find the three hollow statues in the library', how: "Press E at a statue to ping it with your chisel: a hollow one rings high. Break the hollow ones (a Cinder-Mimic waits in each).",
                goal: { kind: 'break', props: ['l_st0', 'l_st2', 'l_st3'] }, at: 'library',
                intro: [vision('Scribe Valen', 'Behind a bookshelf, a skeleton in a scribe\'s robe. His ghost-echo points to three statues, then to a lead-lined chest.')],
            },
            {
                id: 'i_chest', quest: "The Heretic's Ink", act: 3, task: "Open Valen's chest with the Cipher Key", how: 'Press E at the lead-lined chest.',
                goal: { kind: 'touch', prop: 'l_chest' }, at: 'prop:l_chest',
                outro: [scroll('The Uncensored Ledger of the Fourth Tide', 'The proof the Eastern Mages found twelve hours before the Shattering:', 'With the nations united behind the linked village Memory Pillars, the Fourth Tide could be fought and won, with fewer dead than any Tide before it.', 'Malakor read it. He buried it, because he had already decided the kings of his age could not be trusted to stand together.')],
                reward: { xp: 200, flags: ['tome'] },
            },
        ],
    },
];

/** What the companion says at her altar as the story goes (one line, the latest that applies). */
const BEDSIDE: { flag: string; line: string }[] = [
    { flag: '', line: 'Lyra sits by the Spire with her knees drawn up. When you speak her name, she looks at you politely, the way you look at a stranger.' },
    { flag: 'bram', line: 'She is calmer. She watches the light of the Spire, and once she almost smiles at you, then forgets why.' },
    { flag: 'vein_striker', line: 'Her fingers twitch as you talk about the cedar tree. She does not look at you, but they curl, just a little.' },
    { flag: 'echo_dash', line: '"...meadows..." The word is so faint you might have imagined it.' },
    { flag: 'hymn', line: 'Under her breath, almost nothing: four notes. Her grandmother\'s song. She does not know she is humming.' },
    { flag: 'land1', line: 'She squeezes your hand, once. She knows you. Only a third of her is home, but she knows you. Hold on to that.' },
];

const VISION_1 = vision('Corrupted Memory Relic I: The Oath', 'Torchlight in a stone hall. Malakor, younger, grips Cedric by the shoulders.', '"I need someone the miners will follow into the dark. Swear it, Cedric. Swear you will hold the line, whatever I become."', 'Cedric swears.');
const VISION_2 = vision("Corrupted Memory Relic II: The Architect's Ledger", 'Tarek slams a ledger on Malakor\'s desk. "Sever the aquifers and the deep fire has nowhere to go! You will boil the land!"', 'Malakor does not look up. "The land will boil either way, old friend. This way, some of it lives."');
const VISION_3 = vision("Corrupted Memory Relic III: The Scribe's Sin", 'Malakor on his knees before Pyra, holding out a sheaf of calculations.', '"Burn it. If they learn it could have been done another way, they will tear each other apart in grief. Let them hate me instead."');

const RELICS = [
    { id: 'oath', n: 1, title: "Relic I: The Knight's Oath", shards: 3, vision: VISION_1 },
    { id: 'ledger', n: 2, title: "Relic II: The Architect's Ledger", shards: 4, vision: VISION_2 },
    { id: 'sin', n: 3, title: "Relic III: The Scribe's Sin", shards: 5, vision: VISION_3 },
];

export const LAND1: Land = {
    n: 1,
    el: 'fire',
    title: 'Pyraxis, the Scorched Strata',
    camp: 'Watchtower Sanctuary',
    alias: { camp: 'camp', ridge: 'guard:1', reservoir: 'guard:2', pyra: 'guard:3', ignis: 'arena' },
    siteNames: {
        camp: 'Watchtower Sanctuary', quarry: 'Deep-Strata Quarry', oakhaven: 'Oakhaven', springs: 'Hot springs', cellar: "Bram's cellar", catacombs: 'Whispering Catacombs',
        ridge: 'Scorched Ridge Pass', siphonA: 'Siphon Alpha', siphonB: 'Siphon Beta', siphonG: 'Siphon Gamma', guildhall: 'Drafting Guildhall', grotto: 'Whispering Grotto',
        reservoir: 'Slag Reservoir', scriptW: 'West Scriptorium', scriptE: 'East Scriptorium', library: 'Archive Sanctum', pyra: "Pyra's Pyre",
        shelter1: 'Shelter dome', shelter2: 'Shelter dome', shelter3: 'Shelter dome', gate: 'Solstice Gate', ignis: 'The Caldera',
    },
    start: 'quarry',
    props: PROPS,
    main: MAIN,
    sides: SIDES,
    bosses: {
        cedric: { code: guardCode('fire', 1), site: 'ridge', intro: 'Cinder-Gore the Cleaver drops from the cliff!', mechs: [
            { kind: 'armor', at: 0.6, share: 0.15, props: ['vent'], near: 4, open: 8000, msg: 'Cinder-Gore ignites his basalt armour! Strike a steam vent beside him to quench it', openMsg: 'Steam blasts over him: the armour cracks! Strike now' },
        ] },
        tarek: { code: guardCode('fire', 2), site: 'reservoir', intro: 'Goliath Tarek grinds out of the slag!', mechs: [
            { kind: 'armor', at: 0.5, share: 0.15, props: ['valve'], near: 30, open: 8000, msg: 'Tarek overheats and shrugs off your blows! Break the cooling valves round the floor', openMsg: 'Coolant floods the floor: Tarek is brittle! Strike now' },
        ] },
        pyra: { code: guardCode('fire', 3), site: 'pyra', intro: 'Pyra the Flame-Weaver rises from the pyre!', mechs: [
            { kind: 'adds', at: 0.4, foes: ['wizard', 'wizard', 'wizard'] },
            { kind: 'armor', at: 0.4, share: 0.05, byE: true, open: 7000, msg: 'Pyra splits into illusions! Press E to strike the floor with your chisel and find the true one', openMsg: 'The ripple runs true: Pyra is exposed!' },
        ] },
        ignis: { code: wardenCode('fire'), site: 'ignis', intro: 'IGNIS THE MOLTEN SCOURGE', mechs: [
            { kind: 'flood', from: 0.66, to: 0.12, every: 24000, dur: 8000, safe: 'grounding', msg: 'Ignis dives into the lava, and the floor floods! Strike a grounding spire and stand on it' },
            { kind: 'finisher', at: 0.12, beats: 4, msg: 'Ignis staggers! Hammer the chisel home to the beat of the song: attack on each glowing beat' },
        ] },
    },
    hazards: [
        { kind: 'mist', site: 'oakhaven', r: 17 }, { kind: 'mist', site: 'springs', r: 11 }, { kind: 'mist', site: 'cellar', r: 9 },
        { kind: 'mist', site: 'catacombs', r: 11 },
        { kind: 'fog', site: 'reservoir', r: 14, item: 'filter_draught', say: 'The sulfur burns your lungs. Drink a Filter Draught' },
    ],
    relics: RELICS,
    puzzles: {},
    bedside: BEDSIDE,
    draught: 'stasis_draught',
    conduit: 0xff6a3d,
    memories: [
        { flag: 'vein_striker', line: 'A cedar tree. Lyra wraps your cut fingers: "Feel for the grain, and strike along it."' },
        { flag: 'echo_dash', line: 'A quarry fire. "Two seasons of leave. The northern meadows. Just grass." You promised.' },
        { flag: 'hymn', line: 'Twilight. Four low notes. "As long as someone sings it, the path home never disappears."' },
    ],
};
