/**
 * Land 4: the Void Wastes, Malakor's Citadel. Obsidian monoliths adrift in violet nebula, rivers
 * of raw mana, and the Citadel of the Broken Axis over the pulsing Heart of the World. Lyra is whole
 * and fights beside you (Q: Runic Binding and Harmonic Aegis). Curse: Spatial Gravity Inversion
 * (gravity tips and slides you) and Void Rift Bleed (rifts spill shades until sealed with Fire,
 * Storm and Frost in turn).
 */
import { guardCode, MALAKOR_CODE, wardenCode } from '../eidolon.ts';
import { cine, say, scroll, vision, type Land, type PropDef, type SideQuest, type Step } from './types.ts';

const LYRA = 'Lyra';

const lock = (rift: string, site: string): PropDef[] => [
    { id: `v_${rift}_f`, type: 'node', site, at: [-2.2, 1], color: 0xff6a3d, name: 'Fire lock' },
    { id: `v_${rift}_s`, type: 'node', site, at: [0, -2.4], color: 0x7dd3fc, name: 'Storm lock' },
    { id: `v_${rift}_i`, type: 'node', site, at: [2.2, 1], color: 0xbae6fd, name: 'Frost lock' },
    { id: `v_${rift}`, type: 'rift', site, at: [0, 0], name: 'Void Rift' },
];

const PROPS: PropDef[] = [
    // The Grand Coalition Sanctuary.
    { id: 'v_spire', type: 'spire', site: 'camp', at: [0, -2.6] },
    { id: 'v_loom', type: 'loom', site: 'camp', at: [2.2, -1.8] },
    // The four Abyssal Tears.
    ...lock('r1', 'rift1'), ...lock('r2', 'rift2'), ...lock('r3', 'rift3'), ...lock('r4', 'rift4'),
    // Malakor's conservatory: the dual astrolabe.
    { id: 'v_astrolabe', type: 'ring', site: 'conservatory', at: [0, -1], name: 'Dual astrolabe', color: 0xd4b06a },
    // The three Obsidian Siphon Spires.
    { id: 'v_sp1', type: 'fault', site: 'siphon1', at: [0, -1], wedge: true, name: 'Obsidian Siphon Spire', color: 0x9d6bff },
    { id: 'v_sp2', type: 'fault', site: 'siphon2', at: [0, -1], wedge: true, name: 'Obsidian Siphon Spire', color: 0x9d6bff },
    { id: 'v_sp3', type: 'fault', site: 'siphon3', at: [0, -1], wedge: true, name: 'Obsidian Siphon Spire', color: 0x9d6bff },
    // The Vault of Stolen Names: the harmonic pipes.
    { id: 'v_phials', type: 'pipe', site: 'vault', at: [0, -1], name: 'Harmonic pipes' },
    // The Amalgamation's arena: three elemental braziers (strike one to imbue your blade).
    { id: 'v_brz_f', type: 'brazier', site: 'chimera', at: [-5, -3], color: 0xff6a3d, name: 'Fire brazier' },
    { id: 'v_brz_g', type: 'brazier', site: 'chimera', at: [5, -3], color: 0xa8a29e, name: 'Granite brazier' },
    { id: 'v_brz_i', type: 'brazier', site: 'chimera', at: [0, 5], color: 0xbae6fd, name: 'Frost brazier' },
    // The Grand Signal Bell.
    { id: 'v_bell', type: 'bell', site: 'bell', at: [0, -1], name: 'Grand Signal Bell', color: 0xd4b06a },
    // The golden bridge's stair landings.
    { id: 'v_land1', type: 'pad', site: 'stair1', at: [0, 0], name: 'Golden landing' },
    { id: 'v_land2', type: 'pad', site: 'stair2', at: [0, 0], name: 'Golden landing' },
    // The Astrolabe Dial: the rewinding sectors.
    ...[[-5, 0], [5, 0], [0, -5], [0, 5]].map(([x, y], n): PropDef => ({ id: `v_sector${n}`, type: 'ring', site: 'dial', at: [x, y], name: 'Rewinding sector', color: 0xa855f7 })),
    // The Cradle of the Heart: the Heart, Malakor's monoliths, the raised platforms.
    { id: 'v_heart', type: 'crystal', site: 'heart', at: [0, -3], name: 'The Heart of the World', color: 0xfde68a },
    ...[[-7, -4], [7, -4], [-7, 5], [7, 5]].map(([x, y], n): PropDef => ({ id: `v_mono${n}`, type: 'pillar', site: 'heart', at: [x, y], name: 'Obsidian monolith', color: 0x2a1f3a })),
    ...[[-4, 2], [4, 2], [0, 7], [0, -7]].map(([x, y], n): PropDef => ({ id: `v_plat${n}`, type: 'grounding', site: 'heart', at: [x, y], name: 'Resonance platform' })),
];

const rift = (n: number, act: 1 | 2): Step => ({
    id: `v_rift${n}`, quest: 'Sealing the Four Abyssal Tears', act,
    task: `Seal Abyssal Tear ${['I', 'II', 'III', 'IV'][n - 1]}`,
    how: 'Lyra holds the containment ring. Strike the three orbiting locks in order: Fire, then Storm, then Frost. A wrong strike resets them; the rift spills shades until it closes.',
    goal: { kind: 'strikes', props: [`v_r${n}_f`, `v_r${n}_s`, `v_r${n}_i`], label: 'Elemental locks' }, at: `rift${n}`,
    reward: { xp: 180, flags: [`sealed:v_r${n}`] },
});

const MAIN: Step[] = [
    // ================================================================ ACT I: THE UNITED BRIDGEHEAD
    {
        id: 'v_march', quest: 'The Camp of Four Banners', act: 1,
        task: 'March across the Golden Ley-Bridge to the bridgehead',
        how: 'Lyra walks beside you now: press Q to have her cast a Runic Binding or a Harmonic Aegis. Follow the marker into the Void Wastes.',
        goal: { kind: 'reach', site: 'camp', r: 6 }, at: 'camp',
        intro: [cine('The Golden Ley-Bridge', 'The Camp of Four Banners', 'Bram\'s masons from Pyraxis. Lin\'s sky-weavers and Captain Thorne from Zephyria. Nerissa\'s divers from Aquatica. They march behind you across the golden bridge.', 'And beside you, for the first time in all of this, Lyra, her staff in her hand.'),
            say(LYRA, 'Together', '"Whatever we dig up, {hero}. We finish the carving together."')],
        reward: { xp: 200, flags: ['coalition'] },
    },
    {
        id: 'v_spire', quest: 'The Camp of Four Banners', act: 1,
        task: 'Raise the Master Triad Spire: a Flame Turret, a Tesla Coil and a Steam-Mortar',
        how: 'Craft them at the bench and set them inside the Coalition Sanctuary. Lay Ley-Conduits from the Spire so they have power.',
        goal: { kind: 'place', items: { flame_turret: 1, tesla_coil: 1, steam_mortar: 1 } }, at: 'camp',
        reward: { xp: 200 },
    },
    rift(1, 1), rift(2, 1), rift(3, 1), rift(4, 1),
    {
        id: 'v_siege1', quest: 'The First Sword of the Axis', act: 1,
        task: 'Survive the Void Eclipse Siege',
        how: 'The militia of three lands stands with you. Hold the Coalition Spire.',
        goal: { kind: 'siege', secs: 120, waves: [{ t: 0, foes: ['wraith', 'wraith', 'skeleton', 'skeleton', 'wizard', 'archer', 'bomber'] }, { t: 40, foes: ['brute', 'brute', 'wraith', 'wraith', 'wizard', 'wizard', 'scorpion'] }, { t: 80, foes: ['brute', 'brute', 'brute', 'wraith', 'wraith', 'wraith', 'wizard', 'bomber'] }] },
        at: 'prop:v_spire',
        reward: { xp: 450, items: { potion_purple: 1, potion_red: 2 } },
    },
    {
        id: 'v_davos', quest: 'The First Sword of the Axis', act: 1,
        task: 'Defeat the Void Knight at the Outer Bailey',
        how: 'He steps through shadow portals. At half health he splits the world in two and you cannot see him: watch for Lyra\'s gold marker arrow and strike where it lands.',
        goal: { kind: 'boss', boss: 'davos', site: 'outer' }, at: 'outer',
        outro: [cine('Grand Marshal Davos', 'The Loyal Damned', 'The claymore drops. Davos lowers himself to the ground beside it, almost gently.', '"I knew the math was wrong, you know. I stayed anyway. Someone had to stand at his door."')],
        reward: { xp: 900, flags: ['zoneB', 'shard:damned'] },
    },
    // ================================================================ ACT II: THE SIPHON SPIRES OF THE HEART
    {
        id: 'v_siphons', quest: "Cutting the Tyrant's Chains", act: 2,
        task: 'Demolish the three Obsidian Siphon Spires',
        how: 'Gravity tips on the Escher walkways: brace and keep going. Plant wedges in each spire and detonate them (E with nothing in front of you).',
        goal: { kind: 'break', props: ['v_sp1', 'v_sp2', 'v_sp3'] }, at: 'siphon1',
        reward: { xp: 400 },
    },
    {
        id: 'v_amalgam', quest: 'The Chimera of Regret', act: 2,
        task: 'Defeat the Amalgamation',
        how: 'Its three heads take turns; the one awake glows. Strike the brazier of its counter-element to imbue your blade (Frost against the Magma head, Fire against the Rime head, Granite against the Storm head), then strike.',
        goal: { kind: 'boss', boss: 'amalgam', site: 'chimera' }, at: 'chimera',
        outro: [cine('The Amalgamation', 'The Chimera of Regret', 'The three heads sag together, and the fire, the storm and the rime that made them drain away into the floor.', 'Bram sends word across the bridge: your blade is ready. The Mythic Grand Archivist\'s Chisel-Blade.')],
        reward: { xp: 1000, flags: ['zoneC', 'mythic'] },
    },
    // ================================================================ ACT III: ASCENDING THE BROKEN AXIS
    {
        id: 'v_bell', quest: 'The Choir of Three Realms', act: 3,
        task: 'Ring the Grand Signal Bell with Lyra\'s song',
        how: 'Press E at the bell. Strike its four elemental chimes in the order of her grandmother\'s song.',
        goal: { kind: 'puzzle', puzzle: 'song', prop: 'v_bell' }, at: 'prop:v_bell',
        outro: [cine('The Choir of Three Realms', 'Every Spire at Once', 'Malakor shatters the stair behind you. Then, far across the sky, a light.', 'In Pyraxis Bram, in Zephyria Lin and Thorne, in Aquatica Nerissa: every Memory Spire you raised fires at once. Amber, emerald, sapphire.', 'The three beams meet beneath your feet as a bridge of gold.')],
        reward: { xp: 300 },
    },
    {
        id: 'v_stairs', quest: 'The Choir of Three Realms', act: 3,
        task: 'Charge up the golden bridge',
        how: 'Stand on each golden landing until the bridge carries you on.',
        goal: { kind: 'stations', props: ['v_land1', 'v_land2'], secs: 3, foes: ['wraith', 'wraith', 'skeleton'], label: 'Golden landings' }, at: 'stair1',
        reward: { xp: 300 },
    },
    {
        id: 'v_echo', quest: 'The Shadow of the Architect', act: 3,
        task: "Defeat Malakor's Echo on the Astrolabe Dial",
        how: 'The purple sectors rewind time: while the Echo stands in one, it heals. Knock it out of them, and Lyra jams the clock-hand.',
        goal: { kind: 'boss', boss: 'echo', site: 'dial' }, at: 'dial',
        outro: [cine("Malakor's Echo", 'The Sanctum Opens', 'The astral projection flickers out mid-sentence. Beyond the dial, the doors of the Sanctum of the World\'s Heart grind open.')],
        reward: { xp: 1000, flags: ['zoneD', 'citadel_open'] },
    },
    // ================================================================ ACT IV: THE FINAL RECKONING
    {
        id: 'v_relics', quest: 'The Strata-Loom', act: 4,
        task: 'Mend the last relic at the Strata-Loom',
        how: "Press E at the Archaeologist's Workbench in the Coalition Sanctuary.",
        goal: { kind: 'relics', ids: ['damned'] }, at: 'prop:v_loom',
        reward: { xp: 300 },
    },
    {
        id: 'v_debate', quest: 'The Final Reckoning', act: 4,
        task: 'Face Malakor at the Heart of the World',
        how: 'Go to the Cradle of the Heart at the centre of the world and press E at the Heart. Answer him with what you dug up.',
        goal: { kind: 'puzzle', puzzle: 'debate', prop: 'v_heart' }, at: 'prop:v_heart',
        reward: { xp: 300 },
    },
    {
        id: 'v_malakor', quest: 'The Final Reckoning', act: 4,
        task: 'Defeat Malakor, Arbiter of the Broken Axis',
        how: 'Shatter his obsidian monoliths when he hides behind them. Stand on a raised platform (strike it) when he floods the cradle with the three stolen crowns. At the end, strike on the beat with Lyra: four times, for the Primal Chorus.',
        goal: { kind: 'boss', boss: 'malakor', site: 'heart' }, at: 'heart',
        outro: [cine('The Cradle of the Heart', 'How Quiet the Stars Are', 'The Obsidian Spike shatters into ten thousand harmless stars. Malakor sinks to his knees at the edge of the Heart.', 'The golden light of the people\'s Spires holds the core perfectly still. Not a tremor.', '"The choir... it didn\'t break... How quiet the stars are... when you don\'t hold them alone..."', 'He dissolves into golden motes and returns to the earth he feared.')],
        reward: { xp: 3000 },
    },
    {
        id: 'v_end', quest: 'The Reforging of Eidolon', act: 4,
        task: 'Set the three Cores into the Heart of the World',
        how: 'Press E at the Heart with Lyra beside you.',
        goal: { kind: 'touch', prop: 'v_heart', label: 'Carve the binding rune' }, at: 'prop:v_heart',
        outro: [
            cine('The Heart of the World', 'The Reforging of Eidolon', 'You and Lyra set the Cores of Fire, Storm and Frost into the Heart, and carve the final binding rune into the bedrock together.', 'The four lands glide across the sky and lock back into one. The fissures seal; the Wave Demons turn to harmless stone. A warm wind blows across every valley and sea, and the Amnesia Mist is gone.'),
            cine('That Winter', 'Shoulder to Shoulder', 'That winter the Heart faltered, as it does every five hundred years, and the abyss climbed out of the cracks.', 'It found four nations waiting for it on one shore, under four banners, shoulder to shoulder. It broke against them like every Tide before it.'),
            cine('Two Seasons Later', 'The Northern Meadows', 'The high green meadows of the northern plateau, under a clear blue sky. No ash. No mist.', 'You finish carving the second Stone Swallow and set it in her palm.', 'Below, a city thrives around a gleaming white Resonance Pillar, where no name will ever be forgotten again.'),
        ],
        reward: { xp: 2000, flags: ['land4'] },
    },
];

const SIDES: SideQuest[] = [
    {
        id: 'v_hall', title: 'The Hall of Unbuilt Tomorrows', unlock: 'done:v_rift2',
        steps: [
            {
                id: 'v_ha_astro', quest: 'The Hall of Unbuilt Tomorrows', act: 1, task: 'Open Malakor\'s journal vault: the dual astrolabe', how: 'Press E at the astrolabe in his conservatory. Lyra turns the lunar ring on the balcony with you: each turn of yours moves hers too.',
                goal: { kind: 'puzzle', puzzle: 'astrolabe', prop: 'v_astrolabe' }, at: 'prop:v_astrolabe',
                outro: [scroll("Malakor's Year 52 Confession", 'In a dusty study among scale models of a peaceful, united Eidolon: a confession crystal.', '"Fifty-two years after the Shattering I recalculated the charts. The Eastern Mages were right. United, the nations would have won the Fourth Tide. They always had."', '"I murdered the Circle. I bound my sister. I emptied a world\'s memory. For a miscalculation. I cannot bear it, so I will hold the lands apart until history proves me right. It never will."')],
                reward: { xp: 400, flags: ['confession', 'crown'] },
            },
        ],
    },
    {
        id: 'v_vault', title: 'The Vault of Stolen Names', unlock: 'done:v_davos',
        steps: [
            {
                id: 'v_va_warden', quest: 'The Vault of Stolen Names', act: 2, task: 'Defeat the Reliquary Warden', how: 'In the Sub-Citadel vault of stolen Soul-Phials.',
                goal: { kind: 'boss', boss: 'reliquary', site: 'reliquary' }, at: 'reliquary',
            },
            {
                id: 'v_va_pipes', quest: 'The Vault of Stolen Names', act: 2, task: 'Route the harmonic pipes back to the Coalition Spire', how: 'Press E at the pipes in the vault.',
                goal: { kind: 'touch', prop: 'v_phials', label: 'Open the pipes' }, at: 'prop:v_phials',
                outro: [say(LYRA, 'Thousands of Names', '"Listen. Can you hear them going home?" Ten thousand stolen names hum up the pipes toward the Spire.')],
                reward: { xp: 400, flags: ['phials'] },
            },
        ],
    },
];

const RELICS = [
    { id: 'damned', n: 10, title: 'Relic X: The Loyal Damned', shards: 5, vision: vision('Corrupted Memory Relic X: The Loyal Damned', 'A broken Malakor at a window. Davos lays a hand on his shoulder.', '"I know the math was wrong, old friend. And I know the world will come for your head one day. Until then, I will stand at the door."') },
];

export const LAND4: Land = {
    n: 4,
    el: 'earth',
    title: "The Void Wastes, Malakor's Citadel",
    camp: 'Grand Coalition Sanctuary',
    alias: { camp: 'camp', outer: 'guard:1', chimera: 'guard:2', dial: 'guard:3', reliquary: 'arena', heart: 'citadel' },
    siteNames: {
        camp: 'Coalition Sanctuary', bridgehead: 'The Bridgehead', rift1: 'Abyssal Tear', rift2: 'Abyssal Tear', rift3: 'Abyssal Tear', rift4: 'Abyssal Tear',
        conservatory: "Malakor's Conservatory", outer: 'The Outer Bailey', siphon1: 'Siphon Spire', siphon2: 'Siphon Spire', siphon3: 'Siphon Spire', vault: 'Vault of Stolen Names',
        chimera: 'The Chimera Pit', bell: 'Grand Signal Bell', stair1: 'Golden stair', stair2: 'Golden stair', dial: 'The Astrolabe Dial', reliquary: 'The Reliquary', heart: 'Cradle of the Heart',
    },
    start: 'bridgehead',
    props: PROPS,
    main: MAIN,
    sides: SIDES,
    bosses: {
        davos: { code: guardCode('earth', 1), site: 'outer', intro: 'The Void Knight steps out of a shadow portal!', mechs: [
            { kind: 'unseen', at: 0.5, msg: 'Davos splits the world in two! Lyra marks him: strike at her gold arrow' },
        ] },
        amalgam: { code: guardCode('earth', 2), site: 'chimera', intro: 'The Amalgamation heaves itself out of the pit!', mechs: [
            { kind: 'heads', every: 40000, msg: 'Another head wakes! Imbue your blade at the counter-element brazier' },
        ] },
        echo: { code: guardCode('earth', 3), site: 'dial', intro: "Malakor's Echo flickers onto the dial!", mechs: [
            { kind: 'heal', props: 'ring', msg: 'The Echo rewinds itself in the purple sector! Knock it out' },
        ] },
        reliquary: { code: wardenCode('earth'), site: 'reliquary', intro: 'The Reliquary Warden rises among the stolen names!', mechs: [
            { kind: 'adds', at: 0.5, foes: ['wraith', 'wraith', 'wraith', 'wraith'], msg: 'The stolen names scream out of their phials!' },
        ] },
        malakor: { code: MALAKOR_CODE, site: 'heart', intro: 'MALAKOR, ARBITER OF THE BROKEN AXIS', mechs: [
            { kind: 'armor', at: 1, share: 0.3, props: ['pillar'], near: 30, open: 8000, msg: 'Malakor raises his obsidian monoliths! Shatter one to break his ward', openMsg: 'The monolith bursts: his ward falls!' },
            { kind: 'flood', from: 0.75, to: 0.45, every: 18000, dur: 7000, safe: 'grounding', msg: 'The Three Stolen Crowns: magma, gale and rime flood the cradle! Strike a platform and stand on it' },
            { kind: 'finisher', at: 0.1, beats: 4, msg: 'The final sunder! Strike your chisel against Lyra\'s staff, four times, on the beat of the choir' },
        ] },
    },
    hazards: [{ kind: 'gravity', every: 24000 }, { kind: 'rift', id: 'v_r1', site: 'rift1' }, { kind: 'rift', id: 'v_r2', site: 'rift2' }, { kind: 'rift', id: 'v_r3', site: 'rift3' }, { kind: 'rift', id: 'v_r4', site: 'rift4' }],
    relics: RELICS,
    puzzles: {
        astrolabe: { kind: 'dials', title: 'The Dual Astrolabe', hint: 'You turn the Solar Ring; Lyra turns the Lunar Ring with you. Set the sun to 5 and the moon to 2.', size: 8, start: [0, 0], target: [5, 2], couple: true, labels: ['Solar Ring', 'Lunar Ring'], show: 'angle' },
        debate: { kind: 'debate' },
    },
    bedside: [{ flag: '', line: 'Lyra is beside you, staff in hand.' }],
    draught: null,
    conduit: 0xc4a5ff,
    memories: [{ flag: 'coalition', line: '"Whatever we dig up, we finish the carving together."' }],
};

