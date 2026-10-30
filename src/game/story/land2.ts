/**
 * Land 2: Zephyria, the Howling Crags. Shattered sky-islands, brass wind-turbines and purple
 * lightning. Lyra has a third of her memories back: two-thirds were pulled up the ley-tethers, and
 * the second shard sits in the chest turbine of Vael the Storm-Reaper, Malakor's adoptive sister.
 * Curse: Static Disorientation (sky-lightning strikes unless you stand by a copper rod) and Gale
 * Shear (gusts shove you about unless you wear iron-sole boots).
 */
import { guardCode, wardenCode } from '../eidolon.ts';
import { cine, flashback, say, scroll, vision, type Land, type PropDef, type SideQuest, type Step } from './types.ts';

const LIN = 'Artificer Lin';

const PROPS: PropDef[] = [
    // Cloud-Watch Aerie (the Sanctuary): the struck Spire, Lyra's corner, the Strata-Loom.
    { id: 'z_spire', type: 'spire', site: 'camp', at: [0, -3.4] },
    { id: 'z_altar', type: 'altar', site: 'camp', at: [-2.8, -1.8] },
    { id: 'z_loom', type: 'loom', site: 'camp', at: [2.6, -2.8] },
    // The Sky-Bridge: where Lyra waits as you come across.
    { id: 'z_palanquin', type: 'slab', site: 'bridge', at: [0, 0], name: 'Lyra' },
    // Gale-Spider Ravine: stone web-anchors.
    ...[[-3, -2], [3, -2], [0, 3]].map(([x, y], n): PropDef => ({ id: `z_web${n}`, type: 'web', site: 'ravine', at: [x, y], hp: 3, name: 'Web-anchor' })),
    // The wind-shrine's barometric bell.
    { id: 'z_bell', type: 'bell', site: 'shrine', at: [0, -1], name: 'Barometric bell' },
    // Broken Pinion Gorge: Thorne's glider, and the cockpit.
    { id: 'z_glider', type: 'ship', site: 'gorge', at: [0, -1], name: "Thorne's glider", color: 0xc8a060 },
    // The Cliffside Academy: five chained wind-chimes.
    ...[[-3, -1], [-1.5, -2.4], [0, -2.8], [1.5, -2.4], [3, -1]].map(([x, y], n): PropDef => ({ id: `z_chime${n}`, type: 'chain', site: 'academy', at: [x, y], hp: 2, name: 'Inquisitor chain' })),
    { id: 'z_chimes', type: 'bell', site: 'academy', at: [0, 1], name: 'Wind-chimes', color: 0xd4b06a },
    // The Spire of the First Gale: copper floor spikes round Zephyr-Claw's ledge.
    ...[[-5, -3], [5, -3], [-5, 4], [5, 4]].map(([x, y], n): PropDef => ({ id: `z_cs${n}`, type: 'rod', site: 'spire1', at: [x, y], name: 'Copper floor spike' })),
    // The three Miasma Turbines.
    { id: 'z_horns', type: 'vane', site: 'turbineE', at: [0, 1.5], name: 'Intake horns' },
    { id: 'z_counter', type: 'fault', site: 'turbineE', at: [0, -2], wedge: true, name: 'Granite counterweight' },
    { id: 'z_car', type: 'box', site: 'turbineW', at: [0, 0], name: 'Cable-car', color: 0x9a7a40 },
    { id: 'z_circuit', type: 'machine', site: 'turbineW', at: [2.4, -1.6], name: 'Copper circuit board' },
    ...[0, 1, 2, 3].map((n): PropDef => ({ id: `z_lever${n}`, type: 'pylon', site: 'turbineN', at: [-4.5 + n * 3, n % 2 ? 2 : -2], name: `Track lever ${n + 1}` })),
    // Vael's childhood workshop: the broken harmonium.
    { id: 'z_harmonium', type: 'machine', site: 'workshop', at: [0, -1], name: 'Clockwork Harmonium', color: 0xd4a050 },
    // The Ionized Cloud-Sea: capacitor stepping-pads.
    ...[[-4, 2], [0, -3], [4, 2]].map(([x, y], n): PropDef => ({ id: `z_pad${n}`, type: 'pad', site: 'cloudsea', at: [x, y], name: 'Capacitor pad' })),
    // Volt-Lord Baruch's substation: four polarity pylons.
    ...[[-6, -6], [6, -6], [-6, 6], [6, 6]].map(([x, y], n): PropDef => ({ id: `z_py${n}`, type: 'pylon', site: 'substation', at: [x, y], name: 'Polarity pylon' })),
    // The Chasm of the Crown: four giant wind-harps; the post-vault's manifold.
    { id: 'z_harp', type: 'harp', site: 'harps', at: [0, -1], name: 'Wind-harps' },
    { id: 'z_manifold', type: 'pipe', site: 'postvault', at: [0, -1], name: 'Pneumatic manifold' },
    // Tempest Crown's gear-shafts: crushing gears to jam with wedges.
    ...[[-3, -1], [3, -1], [0, 3]].map(([x, y], n): PropDef => ({ id: `z_gear${n}`, type: 'fault', site: 'crownBase', at: [x, y], wedge: true, name: 'Crushing gear', color: 0xb08a4a })),
    // The exterior pinnacle: floating debris to grapple between.
    { id: 'z_deb1', type: 'pad', site: 'debris1', at: [0, 0], name: 'Floating debris' },
    { id: 'z_deb2', type: 'pad', site: 'debris2', at: [0, 0], name: 'Floating debris' },
    { id: 'z_deb3', type: 'pad', site: 'debris3', at: [0, 0], name: 'Floating debris' },
    // The Eye of the Reaper: the brass rings (stand on a grounded one when she electrifies the floor).
    ...[[-6, -6], [6, -6], [-6, 6], [6, 6]].map(([x, y], n): PropDef => ({ id: `z_ring${n}`, type: 'grounding', site: 'eye', at: [x, y], name: 'Brass ring segment' })),
];

const MAIN: Step[] = [
    // ================================================================ ACT I: INTO THE EYE OF STATIC
    {
        id: 'z_bridge', quest: 'Across the Sky-Bridge', act: 1,
        task: 'Lead Lyra across the Sky-Bridge to Cloud-Watch Aerie',
        how: 'Press E beside Lyra to take her hand; she follows you. Gale-Talon Harpies dive from the cloud and the gusts shove you toward the edges. Lead her to the Aerie.',
        goal: { kind: 'carry', label: 'Lyra' }, at: 'camp',
        spawn: { at: 'bridge', foes: ['wraith', 'wraith', 'wraith', 'archer', 'wraith'] },
        intro: [cine('The Sky-Bridge of the Howling Crags', 'Across the Sky-Bridge',
            'The chains of the Sky-Bridge groan in a wind that never stops. Lyra walks beside you, one hand tight on your sleeve, flinching at every gust.',
            'Somewhere above the purple storm, a third of her is caught in the turbines of Zephyria. The last third lies deeper still, under the ice of Aquatica.',
            'Master Orin stayed behind to tend the Pyraxis Spire. From here, you go on alone.')],
        reward: { xp: 120, lyra: 20 },
    },
    {
        id: 'z_ores', quest: 'Across the Sky-Bridge', act: 1,
        task: 'Mine 12 Copper Ore and 8 Storm-Quartz',
        how: 'The Aerie\'s Spire is shattered and struck by lightning. Mine rocks in Zephyria (E with the pickaxe): copper and storm-quartz lie in the high stone.',
        goal: { kind: 'items', items: { copper_ore: 12, storm_quartz: 8 } },
        reward: { xp: 120 },
    },
    {
        id: 'z_vane', quest: 'Across the Sky-Bridge', act: 1,
        task: 'Ground the lightning: the Weathervane Roof Puzzle',
        how: 'Press E at the Spire. Turn all four rusted brass vanes north-east, into the purple gale, to channel the sky-lightning into its foundation.',
        goal: { kind: 'puzzle', puzzle: 'weathervane', prop: 'z_spire' }, at: 'prop:z_spire',
        outro: [cine('Cloud-Watch Aerie', 'The Dome Holds',
            'The lightning bends, crackles down the copper and into the stone. The dome steadies, and Lyra lets go of your sleeve for the first time since the bridge.',
            'An old woman in a weaver\'s harness stumbles in from the gale, blinking as the dome gives her name back: Master Artificer Lin.'),
        say(LIN, 'The Looms', 'Vael reversed the great Atmospheric Turbines. They were built to filter the Mist; now they whip it into Storm-Miasma that strips a mind on contact.', 'And they spin your girl\'s soul-threads up into Tempest Crown, the floating fortress. You cannot cross these islands on foot, Archaeologist. Bring me Gale-Silk and I will make you a way.')],
        reward: { xp: 150, flags: ['lin'], items: { resonant_wedge: 3 } },
    },
    {
        id: 'z_silk', quest: 'Silks of the Cliff-Weaver', act: 1,
        task: 'Strike the three web-anchors in the Gale-Spider Ravine',
        how: 'Strike each stone anchor with your chisel: the acoustic jolt discharges the electrified web. Then the Brood-Mother comes.',
        goal: { kind: 'break', props: ['z_web0', 'z_web1', 'z_web2'] }, at: 'ravine',
        reward: { xp: 120 },
    },
    {
        id: 'z_aranea', quest: 'Silks of the Cliff-Weaver', act: 1,
        task: 'Defeat the Static Aranea Brood-Mother and her brood',
        how: 'Keep moving. Kill every spider in the ravine to harvest the Insulated Gale-Silks.',
        goal: { kind: 'clear', site: 'ravine', foes: ['scorpion', 'scorpion', 'scorpion', 'brute', 'scorpion'], secs: 0, gives: { gale_silk: 6 } }, at: 'ravine',
        reward: { xp: 150 },
    },
    {
        id: 'z_bell', quest: 'Silks of the Cliff-Weaver', act: 1,
        task: 'The Barometric Bell: bring the three pinwheels into the green',
        how: 'Press E at the bell in the wind-shrine. Each shutter changes the pressure on two pinwheels at once; get all three into the green zone to free the Thunder-Thistle.',
        goal: { kind: 'puzzle', puzzle: 'barometer', prop: 'z_bell' }, at: 'prop:z_bell',
        reward: { xp: 150, items: { thunder_thistle: 3 } },
    },
    {
        id: 'z_grapple', quest: 'Silks of the Cliff-Weaver', act: 1,
        task: 'Have Lin forge the Magnetic Grapple-Chisel',
        how: 'Talk to Artificer Lin at the Aerie with 6 Gale-Silk and 2 iron ore.',
        goal: { kind: 'forge', cost: { gale_silk: 6, iron: 2 }, npc: 'lin', made: 'Lin threads the silk through a lodestone head: the Magnetic Grapple-Chisel. Now the islands are yours.' }, at: 'npc:lin',
        reward: { xp: 120, flags: ['grapple'] },
    },
    {
        id: 'z_draught', quest: 'Silks of the Cliff-Weaver', act: 1,
        task: 'Brew a Grounding Draught and give it to Lyra',
        how: 'Build or use the Alchemy tent at the Aerie (Bag › Camp, then Bag › Craft): Thunder-Thistle and a herb. Press E beside Lyra.',
        goal: { kind: 'give', item: 'grounding_draught' }, at: 'prop:z_altar',
        outro: [say(LIN, 'Earthed', 'The lightning has stopped climbing toward her temples. Good. Now listen: the storm is building over the Aerie. The Vanguard will come.')],
        reward: { xp: 150, lyra: 60 },
    },
    {
        id: 'z_fortify', quest: 'The Roaring Vanguard', act: 1,
        task: 'Raise 4 Copper Lightning-Rods and 2 Harpoon Net-Launchers at the Aerie',
        how: 'Craft them at the bench (Bag › Craft) and set them inside the Sanctuary. The rods also ground the sky-lightning around them.',
        goal: { kind: 'place', items: { copper_rod: 4, harpoon_launcher: 2 } }, at: 'camp',
        reward: { xp: 120 },
    },
    {
        id: 'z_siege1', quest: 'The Roaring Vanguard', act: 1,
        task: 'Survive Sky-Siege I: defend the Spire',
        how: 'Storm-Gargoyles and Miasma Bombers come from the air. Hold the Sanctuary until the storm passes.',
        goal: { kind: 'siege', secs: 90, waves: [{ t: 0, foes: ['wraith', 'wraith', 'bomber', 'bomber', 'archer', 'wraith'] }, { t: 30, foes: ['wraith', 'wraith', 'bomber', 'brute', 'archer'] }, { t: 60, foes: ['wraith', 'wraith', 'wraith', 'bomber', 'bomber', 'wizard'] }] },
        at: 'prop:z_spire',
        reward: { xp: 220, items: { potion_red: 2 } },
    },
    {
        id: 'z_kaelen', quest: 'The Roaring Vanguard', act: 1,
        task: 'Defeat Zephyr-Claw on the Spire of the First Gale',
        how: 'Dodge (K) the sonic dives. Below 55% his chains crackle and blows glance off: strike a copper floor spike when he is beside it to drag the lightning down his chains. Then strike.',
        goal: { kind: 'boss', boss: 'kaelen', site: 'spire1' }, at: 'spire1',
        outro: [
            cine('Commander Kaelen', 'The Cavalry\'s Tether', 'The griffon half sags first, its great eyes clearing. The rider slumps forward and lays a hand on its neck.', '"Let her go... she never chose this..."', 'He presses a coil of blackened copper into your palm: the Grounding Inductor.'),
            flashback('Kites Over the Quarry', 'The highest ridge of Pyraxis. Lyra runs ahead with a paper-and-reed kite she painted herself, testing the wind above the ash.', '"Pull, {hero}! You have to lean into it, not away!"', 'The string bites your palm. The kite climbs.'),
        ],
        reward: { xp: 500, lyra: 10, flags: ['gale_snap', 'zoneB', 'shard:tether'] },
    },
    // ================================================================ ACT II: THE MIASMA TURBINES
    {
        id: 'z_inductor', quest: 'Reversing the Wind-Looms', act: 2,
        task: "Give Kaelen's Grounding Inductor to Lyra",
        how: 'Press E at the alcove in the Aerie.',
        goal: { kind: 'touch', prop: 'z_altar', label: 'Slot the Inductor' }, at: 'prop:z_altar',
        outro: [say(LIN, 'Bastions', 'She held the coil for an hour and remembered the smell of rain on copper. Now the turbines. Raise the Healer\'s tent to level 2 first: you will come back hurt.')],
        reward: { xp: 100, lyra: 15 },
    },
    {
        id: 'z_bastion', quest: 'Reversing the Wind-Looms', act: 2,
        task: "Raise the Healer's tent to level 2",
        how: 'Bag › Camp at the Aerie.',
        goal: { kind: 'build', building: 'healer', level: 2 }, at: 'camp',
        reward: { xp: 100 },
    },
    {
        id: 'z_horns', quest: 'Reversing the Wind-Looms', act: 2,
        task: 'Turbine East: turn the three intake horns to the trade-wind',
        how: 'Press E at the intake horns and rotate each into the western trade-wind.',
        goal: { kind: 'puzzle', puzzle: 'horns', prop: 'z_horns' }, at: 'prop:z_horns',
        reward: { xp: 120 },
    },
    {
        id: 'z_counter', quest: 'Reversing the Wind-Looms', act: 2,
        task: 'Turbine East: drop the granite counterweight onto the gear lock',
        how: 'Plant Resonant Wedges in the counterweight (put them in your hotbar and use them: up to 3), step back, and press E with nothing else in front of you to detonate them all.',
        goal: { kind: 'break', props: ['z_counter'] }, at: 'prop:z_counter',
        reward: { xp: 150 },
    },
    {
        id: 'z_car', quest: 'Reversing the Wind-Looms', act: 2,
        task: 'Turbine West: defend the cable-car for 2 minutes',
        how: 'Stand by the cable-car as it climbs; Electro-Wraiths swarm it.',
        goal: { kind: 'defend', prop: 'z_car', secs: 120, foes: ['wraith', 'wraith', 'wraith', 'wraith', 'wizard', 'wraith'], label: 'Guard the cable-car' }, at: 'prop:z_car',
        reward: { xp: 150 },
    },
    {
        id: 'z_circuit', quest: 'Reversing the Wind-Looms', act: 2,
        task: 'Turbine West: route the copper circuit',
        how: 'Press E at the board. Turn the copper tiles so the current runs from the gold terminal to the motor without a break.',
        goal: { kind: 'puzzle', puzzle: 'circuit', prop: 'z_circuit' }, at: 'prop:z_circuit',
        reward: { xp: 150 },
    },
    {
        id: 'z_levers', quest: 'Reversing the Wind-Looms', act: 2,
        task: 'Turbine North: throw the four track levers ahead of the runaway cart',
        how: 'Strike the levers in order, 1 to 4, before the cart reaches them. A wrong lever resets the track.',
        goal: { kind: 'strikes', props: ['z_lever0', 'z_lever1', 'z_lever2', 'z_lever3'], label: 'Track levers' }, at: 'turbineN',
        outro: [cine('Turbine North', 'The Looms Turn Back', 'The cart rams the core switch. Far across the archipelago, three great turbines shudder, stop, and begin to turn the other way.', 'The green Storm-Miasma thins. For the first time in three centuries, sunlight falls on the Archipelago of Whispers.')],
        reward: { xp: 200 },
    },
    {
        id: 'z_pads', quest: 'The High-Voltage Warden', act: 2,
        task: 'Cross the Ionized Cloud-Sea on the capacitor pads',
        how: 'Stand on each capacitor pad until it charges (the ground between them is live), then the next.',
        goal: { kind: 'stations', props: ['z_pad0', 'z_pad1', 'z_pad2'], secs: 3, foes: ['wraith', 'wraith'], label: 'Capacitor pads' }, at: 'cloudsea',
        reward: { xp: 150 },
    },
    {
        id: 'z_baruch', quest: 'The High-Voltage Warden', act: 2,
        task: 'Defeat Volt-Lord Baruch',
        how: 'He rolls as a live boulder and magnetizes the arena: stand by a polarity pylon when the field flips or it throws you. Below half, strike a pylon he is near to overload his tether, then hit him.',
        goal: { kind: 'boss', boss: 'baruch', site: 'substation' }, at: 'substation',
        outro: [
            cine('Chief Electromancer Baruch', 'The Dynamo', 'The brass rings fall still. Inside, a tired old man in a scholar\'s coat, his hair standing on end.', '"A blank mind still breathes, he told me... charge the coils... I charged them..."', 'He gives you the Dynamo Core.'),
            flashback('Shelter from the Monsoon', 'An acid rainstorm on an early dig. Lyra holds her heavy mason\'s cloak over both your heads in a narrow rock cleft.', 'Thunder shakes the stones. She is laughing so hard she cannot breathe.', '"Next time, {hero}, you carry the cloak."'),
        ],
        reward: { xp: 550, lyra: 10, flags: ['static_aegis', 'zoneC', 'shard:dynamo', 'dynamo'] },
    },
    // ================================================================ ACT III: THE FLOATING CITADEL OF TEMPEST CROWN
    {
        id: 'z_coils', quest: 'The Hurricane Siege', act: 3,
        task: 'Arm the Aerie: 2 Tesla Coils',
        how: 'A Category-5 Miasma storm is coming. Craft Tesla Coils at the bench and set them in the Sanctuary. Power them: lay Ley-Conduits from the Spire to each turret.',
        goal: { kind: 'place', items: { tesla_coil: 2 } }, at: 'camp',
        reward: { xp: 120 },
    },
    {
        id: 'z_siege2', quest: 'The Hurricane Siege', act: 3,
        task: 'Survive the Category-5 Miasma Siege',
        how: 'Thunder-Wyverns dive on the Spire. Hold.',
        goal: { kind: 'siege', secs: 110, waves: [{ t: 0, foes: ['wraith', 'wraith', 'wraith', 'bomber', 'bomber', 'archer', 'archer'] }, { t: 35, foes: ['brute', 'wraith', 'wraith', 'wizard', 'wizard', 'bomber'] }, { t: 70, foes: ['brute', 'brute', 'wraith', 'wraith', 'wraith', 'wizard', 'archer'] }] },
        at: 'prop:z_spire',
        reward: { xp: 300, items: { potion_purple: 1 } },
    },
    {
        id: 'z_harps', quest: 'The Wind-Bridge', act: 3,
        task: 'Tune the four wind-harps into a bridge of hard light',
        how: 'Press E at the harps. Tighten each cable until it rings its note of the Ancient Tuning Scale; the clouds harden into a bridge.',
        goal: { kind: 'puzzle', puzzle: 'harps', prop: 'z_harp' }, at: 'prop:z_harp',
        reward: { xp: 180 },
    },
    {
        id: 'z_crown', quest: 'The Automaton of Grief', act: 3,
        task: 'Reach the base of Tempest Crown',
        how: 'Cross the hard-light bridge to the floating fortress.',
        goal: { kind: 'reach', site: 'crownBase', r: 8 }, at: 'crownBase',
        reward: { xp: 100 },
    },
    {
        id: 'z_gears', quest: 'The Automaton of Grief', act: 3,
        task: 'Jam the three crushing gears in the clocktower shaft',
        how: 'Plant Resonant Wedges in each gear and detonate them (E with nothing in front of you).',
        goal: { kind: 'break', props: ['z_gear0', 'z_gear1', 'z_gear2'] }, at: 'crownBase',
        reward: { xp: 180 },
    },
    {
        id: 'z_shredder', quest: 'The Automaton of Grief', act: 3,
        task: 'Defeat the Sky-Shredder',
        how: 'Six saw-wings and feather-missiles. Below 40% its arms fly off as drones and it is untouchable: press R (the Resonant Hymn) when they gather, to short-circuit them, then strike its heart.',
        goal: { kind: 'boss', boss: 'shredder', site: 'clocktower' }, at: 'clocktower',
        outro: [
            cine('The Sky-Shredder', 'The Automaton of Grief', 'The brass angel falls to its knees. Its face is Malakor\'s, carved by a grieving girl.', 'Behind it, a door opens onto stairs that climb into the storm.'),
            flashback('The Breath Before the Collapse', 'The last second before Ignis took the Pillar. You remember now.', 'Lyra could have let go of the stone. She felt the beast drinking through it, and she held on: while it fed on her, it was not turning on the rest of you.', 'Over its shoulder she found your eyes, and she smiled.'),
        ],
        reward: { xp: 600, lyra: 10, flags: ['tempest', 'zoneD', 'shard:betrayal'] },
    },
    // ================================================================ ACT IV: THE EYE OF THE REAPER
    {
        id: 'z_relics', quest: 'The Strata-Loom', act: 4,
        task: 'Mend the three relics of Zephyria at the Strata-Loom',
        how: "Press E at the Archaeologist's Workbench in the Aerie.",
        goal: { kind: 'relics', ids: ['tether', 'dynamo', 'betrayal'] }, at: 'prop:z_loom',
        reward: { xp: 200 },
    },
    {
        id: 'z_crisis', quest: 'Climbing the Lightning Spire', act: 4,
        task: 'Return to the Aerie: the Mist is closing on Lyra',
        how: 'Talk to Artificer Lin.',
        goal: { kind: 'talk', npc: 'lin' }, at: 'npc:lin',
        outro: [say(LIN, 'The Mist Comes Back', 'The Mist is pouring into the gaps where her memories were. She forgot the kite this morning. Then she forgot me.', 'Vael\'s turbine holds the second shard. Forge a blade that can carry lightning, and climb.')],
        reward: { xp: 100, lyra: -30 },
    },
    {
        id: 'z_forge', quest: 'Climbing the Lightning Spire', act: 4,
        task: 'Forge the Tempest-Weaver Chisel-Blade with Lin',
        how: 'Talk to Lin with 8 copper ore, 4 storm-quartz and 4 iron ore.',
        goal: { kind: 'forge', cost: { copper_ore: 8, storm_quartz: 4, iron: 4 }, npc: 'lin', made: 'Lin and you temper the edge in a lightning strike: the Tempest-Weaver Chisel-Blade.' }, at: 'npc:lin',
        reward: { xp: 150, flags: ['tempest_blade'] },
    },
    {
        id: 'z_debris', quest: 'Climbing the Lightning Spire', act: 4,
        task: 'Scale the pinnacle across the floating debris',
        how: 'Stand on each piece of debris until your grapple bites, then the next. Vael\'s sniper lightning comes down where you stand still too long.',
        goal: { kind: 'stations', props: ['z_deb1', 'z_deb2', 'z_deb3'], secs: 4, foes: ['wraith', 'wraith', 'archer'], label: 'Floating debris' }, at: 'debris1',
        reward: { xp: 200 },
    },
    {
        id: 'z_vael', quest: 'The Weeping Hurricane', act: 4,
        task: 'Defeat Vael the Storm-Reaper',
        how: 'She electrifies the floor: strike a brass ring segment to ground it and stand on it. Her Miasma Cyclone makes her untouchable: ring the Hymn (R) to shatter it. At the end, parry her five-strike Valkyrie combo on the beat.',
        goal: { kind: 'boss', boss: 'vael', site: 'eye' }, at: 'eye',
        outro: [cine('The Eye of the Reaper', 'The Bird Is Tired', 'The storm parts into turquoise sky. Vael\'s brass wings fall away like autumn leaves.', 'In her last human breath she looks at the sunshine and whispers: "Tell my brother... the bird is tired of flying..."', 'In your hands: the Purified Storm Core, and the second shard of Lyra.')],
        reward: { xp: 1000 },
    },
    {
        id: 'z_awaken', quest: 'The Weeping Hurricane', act: 4,
        task: 'Bring the Storm Core to Lyra',
        how: "Return to the Aerie and press E beside Lyra.",
        goal: { kind: 'touch', prop: 'z_altar', label: 'Bind the Storm Core' }, at: 'prop:z_altar',
        outro: [
            cine('Cloud-Watch Aerie', 'Two of Three', 'You lay the Storm Core in her hands beside the Fire Core. Light runs up her arms; she closes her eyes, and when she opens them they are sharper.', 'She knows you. She knows the kite, the rain, the quarry gate.'),
            say('Lyra', 'The Quarry', '"You saw it, didn\'t you? I could have let go of the Pillar. If I had, it would have turned on the guild... on you. So I held on."', '"I\'m almost here... {hero}... just pull my hands out of the cold water..."'),
            cine('Zephyria', 'The Sunken Rime', 'One memory still will not come: the last third of her, pulled down a frozen tether into the deep, far below.', 'At the edge of Zephyria the storm waterfall thaws into a great descending lift. Zephyria is pacified. The way to Aquatica is open.'),
        ],
        reward: { xp: 400, lyra: 60, flags: ['land2'] },
    },
];

const SIDES: SideQuest[] = [
    {
        id: 'z_aviator', title: "The Aviator's Grounded Wings", unlock: 'lin',
        steps: [
            {
                id: 'z_av_reach', quest: "The Aviator's Grounded Wings", act: 1, task: "Find the crashed glider in Broken Pinion Gorge", how: 'A Hollowed sky-scout dangles from a broken glider. Clear the Volt-Stalkers around it.',
                goal: { kind: 'clear', site: 'gorge', foes: ['wolf', 'wolf', 'wolf', 'wolf'], secs: 0, gives: {} }, at: 'gorge',
            },
            {
                id: 'z_av_code', quest: "The Aviator's Grounded Wings", act: 1, task: 'Open the cockpit with the altimeter code', how: 'Press E at the glider. Dawn Climb 30, Noon Cruise 15, Dusk Dive 45.',
                goal: { kind: 'puzzle', puzzle: 'altimeter', prop: 'z_glider' }, at: 'prop:z_glider',
                outro: [say('Zephyr-Captain Thorne', 'The Flight Charts', 'My name... Thorne. I was flying these charts to my navigator. Elena. My wife.', 'Here: the Pre-Shattering Sky-Charts, and a voice-crystal. I cannot bear to play it yet. Keep my spare cape; it bites anything that touches you.')],
                reward: { xp: 250, flags: ['thorne', 'glider', 'discharge_cape'] },
            },
        ],
    },
    {
        id: 'z_nursery', title: 'The Chimes of the Forgotten Nursery', unlock: 'grapple',
        steps: [
            {
                id: 'z_nu_chains', quest: 'The Chimes of the Forgotten Nursery', act: 1, task: 'Break the inquisitor chains off the five wind-chimes', how: 'In the Cliffside Academy, strike each chain until it parts.',
                goal: { kind: 'break', props: ['z_chime0', 'z_chime1', 'z_chime2', 'z_chime3', 'z_chime4'] }, at: 'academy',
            },
            {
                id: 'z_nu_play', quest: 'The Chimes of the Forgotten Nursery', act: 1, task: 'Play the floor melody on the chimes', how: 'Press E at the chimes. The melody is chalked on the floor in children\'s hands: low, high, middle, high, low.',
                goal: { kind: 'puzzle', puzzle: 'nursery', prop: 'z_chimes' }, at: 'prop:z_chimes',
                outro: [scroll('Scroll II: The Children\'s Tuning', 'A lesson plan, three centuries old: "Today the little ones linked their Memory Pillar to the next village\'s, unaided. Even children can hold the line."', 'Stamped across it in red wax: SUPPRESSED, by order of the Arch-Mage.')],
                reward: { xp: 200 },
            },
        ],
    },
    {
        id: 'z_musicbox', title: "The Sister's Music Box", unlock: 'done:z_car',
        steps: [
            {
                id: 'z_mb_springs', quest: "The Sister's Music Box", act: 2, task: 'Take 3 Beryllium Gear-Springs from the Clockwork Sentinels', how: "Below Turbine West lies Vael's childhood workshop. Destroy the Sentinels that guard it.",
                goal: { kind: 'clear', site: 'workshop', foes: ['skeleton', 'skeleton', 'skeleton', 'brute'], secs: 0, gives: { beryl_spring: 3 } }, at: 'workshop',
            },
            {
                id: 'z_mb_gears', quest: "The Sister's Music Box", act: 2, task: 'Mend the Clockwork Harmonium', how: 'Press E at the harmonium. Set the gear-train: small, then medium, then large.',
                goal: { kind: 'puzzle', puzzle: 'geartrain', prop: 'z_harmonium' }, at: 'prop:z_harmonium',
                outro: [
                    vision('The Harmonium', 'The music box plays four low notes. Lyra\'s grandmother\'s song.', 'Then a hologram: a teenage Vael, writing.', '"Brother Malakor stays awake for weeks staring at the star-charts. Yesterday he said if the sky ever falls, he will lock me in the highest tower so I never touch the burning dirt. He doesn\'t look at me like a sister anymore; he looks at me like a mathematical variable."'),
                    say('Vael\'s Tuning Fork', 'The Fourth Key', 'The fourth key was snapped off on the night of the Shattering. In its place, a slender tuning fork, still humming.', 'Strike it in her storm and her shield will remember this song.'),
                ],
                reward: { xp: 300, flags: ['fork'] },
            },
        ],
    },
    {
        id: 'z_letters', title: 'The Unsent Letters of the Aerie', unlock: 'done:z_crown',
        steps: [
            {
                id: 'z_le_pipes', quest: 'The Unsent Letters of the Aerie', act: 3, task: 'Repair the pneumatic manifold in the post-vault', how: 'Press E at the manifold and turn the pipes so the tubes run from the intake to the sorting drum.',
                goal: { kind: 'puzzle', puzzle: 'manifold', prop: 'z_manifold' }, at: 'prop:z_manifold',
            },
            {
                id: 'z_le_deliver', quest: 'The Unsent Letters of the Aerie', act: 3, task: 'Deliver the last canisters to Lin', how: 'Talk to Artificer Lin at the Aerie.',
                goal: { kind: 'talk', npc: 'lin' }, at: 'npc:lin',
                outro: [say(LIN, 'Two Hundred and Eighty Years', 'This one... this is my mother\'s hand. "Lin, eat something, and do not stay up with the looms."', 'Thank you, Archaeologist. Take this sash. The weavers wore it to dance between the gusts.')],
                reward: { xp: 250, flags: ['sash'] },
            },
        ],
    },
];

const RELICS = [
    { id: 'tether', n: 4, title: "Relic IV: The Cavalry's Tether", shards: 3, vision: vision("Corrupted Memory Relic IV: The Cavalry's Tether", 'Kaelen kneels before Malakor, one hand on his griffon\'s neck.', '"Let her go free. Bind me alone."', 'Malakor finishes the binding anyway. "Her instincts will keep the airway barred forever, Commander. Yours would hesitate."') },
    { id: 'dynamo', n: 5, title: "Relic V: The Dynamo's Plea", shards: 4, vision: vision("Corrupted Memory Relic V: The Dynamo's Plea", 'Baruch at the coil-room door: "Sever the sky-leylines and the Mist will empty every scholar\'s mind within a decade!"', 'Malakor, without turning: "A blank mind still breathes, Baruch. Charge the coils."') },
    { id: 'betrayal', n: 6, title: "Relic VI: The Sister's Betrayal", shards: 5, vision: vision("Corrupted Memory Relic VI: The Sister's Betrayal", 'Malakor seals a weeping Vael inside the turbine core. She beats on the glass.', '"You promised we would fix it together, brother! Don\'t leave me in the dark!"', 'He turns his back. "Hold the sky up, little bird. I will carry the sin."') },
];

export const LAND2: Land = {
    n: 2,
    el: 'air',
    title: 'Zephyria, the Howling Crags',
    camp: 'Cloud-Watch Aerie',
    alias: { camp: 'camp', spire1: 'guard:1', substation: 'guard:2', clocktower: 'guard:3', eye: 'arena' },
    siteNames: {
        camp: 'Cloud-Watch Aerie', bridge: 'Sky-Bridge', ravine: 'Gale-Spider Ravine', shrine: 'Wind-shrine', gorge: 'Broken Pinion Gorge', academy: 'Cliffside Academy',
        spire1: 'Spire of the First Gale', turbineE: 'Turbine East', turbineW: 'Turbine West', turbineN: 'Turbine North', workshop: "Vael's workshop", cloudsea: 'Ionized Cloud-Sea',
        substation: 'Central Substation', harps: 'Chasm of the Crown', postvault: 'Post-vault', crownBase: 'Tempest Crown', clocktower: 'Clocktower shaft',
        debris1: 'Floating debris', debris2: 'Floating debris', debris3: 'Floating debris', summit: 'The Pinnacle', eye: 'Eye of the Reaper',
    },
    start: 'bridge',
    props: PROPS,
    main: MAIN,
    sides: SIDES,
    bosses: {
        kaelen: { code: guardCode('air', 1), site: 'spire1', intro: 'Zephyr-Claw tears loose from the wind-gate!', mechs: [
            { kind: 'armor', at: 0.55, share: 0.2, props: ['rod'], near: 4, open: 8000, msg: 'Zephyr-Claw\'s chains crackle with stolen lightning! Strike a copper floor spike when he is beside it', openMsg: 'The lightning runs down his chains: he is grounded! Strike now' },
            { kind: 'adds', at: 0.55, foes: ['wraith', 'wraith', 'wraith'], msg: 'He whips up miniature tornadoes!' },
        ] },
        baruch: { code: guardCode('air', 2), site: 'substation', intro: 'Volt-Lord Baruch rolls out of the substation in a cage of lightning!', mechs: [
            { kind: 'polarity', from: 0.95, to: 0, every: 9000, anchor: 'pylon', msg: 'The field flips! Stand by a polarity pylon' },
            { kind: 'armor', at: 0.5, share: 0.15, props: ['pylon'], near: 5, open: 8000, msg: 'Baruch magnetizes the arena and his rings shrug off blows! Strike a pylon he is near to overload his tether', openMsg: 'The tether overloads: his gyroscope rings stall! Strike now' },
        ] },
        shredder: { code: guardCode('air', 3), site: 'clocktower', intro: 'The Sky-Shredder unfolds six saw-wings!', mechs: [
            { kind: 'adds', at: 0.4, foes: ['wraith', 'wraith', 'wraith', 'wraith', 'wraith', 'wraith'], msg: 'Its six arms detach as drones!' },
            { kind: 'armor', at: 0.4, share: 0.05, byHymn: true, open: 9000, msg: 'The drones cage it in light! Ring the Resonant Hymn (R) to short-circuit them', openMsg: 'The drones die in a shower of sparks: its clockwork heart is bare!' },
        ] },
        vael: { code: wardenCode('air'), site: 'eye', intro: 'VAEL THE STORM-REAPER', mechs: [
            { kind: 'flood', from: 1, to: 0.7, every: 16000, dur: 7000, safe: 'grounding', msg: 'Vael electrifies the brass rings! Strike a ring segment to ground it and stand on it' },
            { kind: 'armor', at: 0.7, share: 0.05, byHymn: true, open: 10000, msg: 'The Miasma Cyclone shields her! Ring the Hymn (R): her tuning fork remembers the song', openMsg: 'The cyclone shatters! Strike her chest turbine!' },
            { kind: 'finisher', at: 0.12, beats: 5, msg: 'She rips free for the Valkyrie Tempest: parry all five strikes on the beat!' },
        ] },
    },
    hazards: [{ kind: 'static', every: 26000 }, { kind: 'gale', every: 19000 }],
    relics: RELICS,
    puzzles: {
        weathervane: { kind: 'dials', title: 'The Weathervane Roof', hint: 'Turn all four brass vanes north-east (the gold mark), into the purple gale.', size: 8, start: [3, 6, 0, 5], target: [1, 1, 1, 1], labels: ['North', 'East', 'South', 'West'], show: 'angle' },
        barometer: { kind: 'dials', title: 'The Barometric Bell', hint: 'Each shutter turns two pinwheels. Bring all three pinwheels into the green zone (position 3).', size: 6, start: [0, 5, 1], target: [3, 3, 3], couple: true, labels: ['Pinwheel I', 'Pinwheel II', 'Pinwheel III'], show: 'level' },
        altimeter: { kind: 'sequence', title: 'The Cockpit Altimeter', hint: 'Dawn Climb, Noon Cruise, Dusk Dive.', items: [{ label: '15', color: '#7dd3fc', freq: 330 }, { label: '30', color: '#fde68a', freq: 392 }, { label: '45', color: '#fca5a5', freq: 262 }, { label: '60', color: '#c4b5fd', freq: 440 }], order: [1, 0, 2] },
        nursery: { kind: 'sequence', title: 'The Nursery Chimes', hint: 'Chalked on the floor: low, high, middle, high, low.', items: [{ label: 'Low', color: '#a16207', freq: 262 }, { label: 'Middle', color: '#d4b06a', freq: 330 }, { label: 'High', color: '#fde68a', freq: 440 }], order: [0, 2, 1, 2, 0] },
        horns: { kind: 'dials', title: 'The Intake Horns', hint: 'Rotate all three horns west, into the trade-wind (the gold mark).', size: 8, start: [2, 5, 7], target: [6, 6, 6], labels: ['Horn I', 'Horn II', 'Horn III'], show: 'angle' },
        circuit: { kind: 'route', title: 'The Copper Circuit', hint: 'Turn the tiles so the current runs from S (the gold terminal) to E (the motor).', grid: ['SIL.', '..I.', '..LL', '...E'], rot: ['0120', '0000', '0031', '0000'] },
        geartrain: { kind: 'sequence', title: 'The Gear-Train', hint: 'Set the gears in ratio: small, medium, large.', items: [{ label: 'Large', color: '#b08a4a', freq: 196 }, { label: 'Small', color: '#fde68a', freq: 392 }, { label: 'Medium', color: '#d4b06a', freq: 294 }], order: [1, 2, 0] },
        harps: { kind: 'dials', title: 'The Wind-Harps', hint: 'Tighten each harp to its note of the Ancient Tuning Scale: 2, 5, 3, 6.', size: 8, start: [0, 0, 0, 0], target: [2, 5, 3, 6], labels: ['Harp I', 'Harp II', 'Harp III', 'Harp IV'], show: 'level' },
        manifold: { kind: 'route', title: 'The Pneumatic Manifold', hint: 'Turn the pipes so the tubes run from S (the intake) to E (the sorting drum).', grid: ['S...', 'I...', 'LIL.', '..LE'], rot: ['0000', '1000', '3020', '0010'] },
    },
    bedside: [
        { flag: '', line: 'Lyra watches the storm through the dome. She knows your name now, and the quarry, and very little else.' },
        { flag: 'done:z_draught', line: 'The lightning has stopped climbing. She settles, and her hand finds the edge of your sleeve.' },
        { flag: 'gale_snap', line: 'She smiles in her sleep when the wind gusts. Her lips move: "...pull..."' },
        { flag: 'static_aegis', line: '"...the cloak..." she murmurs, and laughs, very softly.' },
        { flag: 'tempest', line: 'You tell her you remember the quarry gate. A tear runs down her cheek.' },
        { flag: 'land2', line: '"{hero}." She says it clearly, and smiles. "There is still a cold place in me, where something should be."' },
    ],
    draught: 'grounding_draught',
    conduit: 0x7dd3fc,
    memories: [
        { flag: 'gale_snap', line: 'A paper kite above the ash. "Lean into it, {hero}, not away!"' },
        { flag: 'static_aegis', line: 'Thunder in a rock cleft. Her cloak over both your heads, and her laughing.' },
        { flag: 'tempest', line: 'The rune-gate closing. Her smile through the glass as the fire came.' },
    ],
};
