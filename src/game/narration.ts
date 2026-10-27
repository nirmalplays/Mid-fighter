/**
 * The prologue: the story of Eidolon told over thirteen illustrated scenes (ui/cutscene/Scenes.tsx),
 * by one old storyteller (no one in the story speaks for themselves here). Each line has its delivery
 * (ElevenLabs v3 audio tags: the emotion, the pauses, the whispers and shouts), the subtitle shown,
 * and its recording in public/voice. A scene can hold several lines; it lasts as long as they do.
 *
 * What it has to make clear, in order: the Heart feeds one world; every five hundred years it falters
 * and the abyss comes up as a war (the Tide); united, the nations always won; Malakor foresaw a far
 * worse Fourth Tide and watched the kings refuse to unite; so he broke the Heart in four (a Heart in
 * pieces can never grow wild enough to wake the abyss), made the world forget so it would never be
 * rejoined, and chained the last Tide's demons over the pieces as jailers; three hundred years later
 * the pieces are bleeding and the Tide is coming anyway; only the Memory Pillars kept the truth, and the
 * guild that digs for them is you and Lyra. Then: what you must do.
 */
export type SceneId =
    | 'oneworld' | 'peoples' | 'tide' | 'united' | 'charts' | 'council' | 'verdict'
    | 'sunder' | 'aftermath' | 'wardens' | 'cracks' | 'guild' | 'survivor';

export type Speaker = 'Narrator' | 'Malakor' | 'Commander' | 'King of Pyraxis' | 'Queen of Aquatica' | 'Lyra';

export interface NarrationLine {
    scene: SceneId;
    speaker: Speaker;
    /** Sent to the speech model (v3 tags shape the delivery). */
    speech: string;
    /** Shown on screen (exactly the words spoken). */
    subtitle: string;
    /** public/voice/<file> */
    file: string;
}

export const NARRATION: NarrationLine[] = [
    {
        scene: 'oneworld', speaker: 'Narrator', file: 'prologue_01.mp3',
        speech: '[warmly, with wistful wonder] Before the lands drifted apart... there was one world. Eidolon. [softly] At its centre beat the Heart of the World... and its light ran through the earth in great ley-veins, [gently] like blood through a body.',
        subtitle: 'Before the lands drifted apart, there was one world. Eidolon. At its centre beat the Heart of the World, and its light ran through the earth in great ley-veins, like blood through a body.',
    },
    {
        scene: 'peoples', speaker: 'Narrator', file: 'prologue_02.mp3',
        speech: '[fondly, painting each picture] Four nations lived by that light. The fire-smiths of Pyraxis. The sky-sailors of Zephyria. The tide-folk of Aquatica. [pause] And the stone halls of Terragrim... where the Conclave of Arch-Mages kept watch over the Heart.',
        subtitle: 'Four nations lived by that light. The fire-smiths of Pyraxis. The sky-sailors of Zephyria. The tide-folk of Aquatica. And the stone halls of Terragrim, where the Conclave of Arch-Mages kept watch over the Heart.',
    },
    {
        scene: 'tide', speaker: 'Narrator', file: 'prologue_03.mp3',
        speech: '[ominous, slowing down] But every five hundred years... the Heart falters. Its light grows wild, and the ground splits open. [low and tense] And out of the cracks... the abyss climbs into the world. [pause] We call it the Grand Arcane Tide. [grimly] It is not a flood. [beat] It is a war.',
        subtitle: 'But every five hundred years, the Heart falters. Its light grows wild, and the ground splits open. And out of the cracks, the abyss climbs into the world. We call it the Grand Arcane Tide. It is not a flood. It is a war.',
    },
    {
        scene: 'united', speaker: 'Narrator', file: 'prologue_04.mp3',
        speech: '[rising, proud] Three times the Tide came. And three times, the four nations put aside every quarrel... [swelling with pride] and stood, shoulder to shoulder.',
        subtitle: 'Three times the Tide came. And three times, the four nations put aside every quarrel, and stood shoulder to shoulder.',
    },
    {
        scene: 'united', speaker: 'Narrator', file: 'prologue_04c.mp3',
        speech: '[triumphant] Three times, they drove the abyss back into the dark. [pause, softer, with weight] Together... they never lost.',
        subtitle: 'Three times, they drove the abyss back into the dark. Together, they never lost.',
    },
    {
        scene: 'charts', speaker: 'Narrator', file: 'prologue_05.mp3',
        speech: '[quiet, foreboding] Then came the age of Malakor, Grand Arch-Mage of the Conclave. [pause] Night after night, he read the coming Tide in the stars.',
        subtitle: 'Then came the age of Malakor, Grand Arch-Mage of the Conclave. Night after night, he read the coming Tide in the stars.',
    },
    {
        scene: 'charts', speaker: 'Narrator', file: 'prologue_05b.mp3',
        speech: '[hushed, afraid] And what he saw there terrified him. The Fourth Tide would be ten times the last. [pause] Twenty. [barely a whisper] Not a war... an ending.',
        subtitle: 'And what he saw there terrified him. The Fourth Tide would be ten times the last. Twenty. Not a war: an ending.',
    },
    {
        scene: 'council', speaker: 'Narrator', file: 'prologue_06.mp3',
        speech: '[heavy] He carried his charts to the kings and queens of his age. [sighs] But they were proud... and old grudges ran deep.',
        subtitle: 'He carried his charts to the kings and queens of his age. But they were proud, and old grudges ran deep.',
    },
    {
        scene: 'council', speaker: 'Narrator', file: 'prologue_06b.mp3',
        speech: '[bitter] Pyraxis would not march under another nation’s banner. [pause] Aquatica would sooner let Pyraxis burn alone. [sighs] Grudges older than any Tide... and not one crown would bend.',
        subtitle: 'Pyraxis would not march under another nation’s banner. Aquatica would sooner let Pyraxis burn alone. Grudges older than any Tide, and not one crown would bend.',
    },
    {
        scene: 'verdict', speaker: 'Narrator', file: 'prologue_07.mp3',
        speech: '[quiet, grave] Malakor saw that they would never stand together... and that alone, they would lose. [pause] So he made a terrible choice. [slow, cold] The Tide is born of the Heart. A Heart broken in four could never grow wild again. [firm] He would end the cycle. [beat] Forever.',
        subtitle: 'Malakor saw that they would never stand together, and that alone, they would lose. So he made a terrible choice. The Tide is born of the Heart. A Heart broken in four could never grow wild again. He would end the cycle. Forever.',
    },
    {
        scene: 'sunder', speaker: 'Narrator', file: 'prologue_08.mp3',
        speech: '[dramatic, building] So he drove obsidian spikes into the world’s veins... [intense] and broke the Heart. [pause, grief-stricken] And the world broke with it.',
        subtitle: 'So he drove obsidian spikes into the world’s veins, and broke the Heart. And the world broke with it.',
    },
    {
        scene: 'aftermath', speaker: 'Narrator', file: 'prologue_09.mp3',
        speech: '[sorrowful] Four lands, cast adrift on the Abyssal Maelstrom, walled apart by his barriers. [pause] And so that no one would ever try to make them whole again... [bitterly] he made them forget. [softly] A pale Mist rose, and ate the memories of the people. [pause] Neighbours became strangers. [heavy] Strangers became enemies.',
        subtitle: 'Four lands, cast adrift on the Abyssal Maelstrom, walled apart by his barriers. And so that no one would ever try to make them whole again, he made them forget. A pale Mist rose, and ate the memories of the people. Neighbours became strangers. Strangers became enemies.',
    },
    {
        scene: 'wardens', speaker: 'Narrator', file: 'prologue_10.mp3',
        speech: '[low, menacing] Three pieces of the Heart, the Cores of Fire, Storm and Frost, he sealed deep beneath three of the lands... and set jailers over them. [bitterly] His own champions, who knelt to him, twisted by his magic into monsters. [darkly] But beneath Pyraxis, he chained something worse. [pause] A demon of the last Tide. Ignis, the Molten Scourge. [whispering] A beast that feeds on memory.',
        subtitle: 'Three pieces of the Heart, the Cores of Fire, Storm and Frost, he sealed deep beneath three of the lands, and set jailers over them: his own champions, who knelt to him, twisted by his magic into monsters. But beneath Pyraxis, he chained something worse. A demon of the last Tide. Ignis, the Molten Scourge. A beast that feeds on memory.',
    },
    {
        scene: 'wardens', speaker: 'Narrator', file: 'prologue_10b.mp3',
        speech: '[cold, quiet] The last piece, the Heart itself, he kept for himself... in a citadel at the centre of the world, where Terragrim had stood. [pause, sorrowful] Terragrim became the Void Wastes.',
        subtitle: 'The last piece, the Heart itself, he kept for himself, in a citadel at the centre of the world, where Terragrim had stood. Terragrim became the Void Wastes.',
    },
    {
        scene: 'cracks', speaker: 'Narrator', file: 'prologue_11.mp3',
        speech: '[urgent, rising] But a broken heart does not heal. [pause] Three hundred years on, the Cores are bleeding. The Maelstrom is rising. The jailers strain at their chains... [grave] and the Fourth Tide is coming anyway. [quietly, sadly] To a world that no longer remembers how to stand together.',
        subtitle: 'But a broken heart does not heal. Three hundred years on, the Cores are bleeding. The Maelstrom is rising. The jailers strain at their chains, and the Fourth Tide is coming anyway. To a world that no longer remembers how to stand together.',
    },
    {
        scene: 'guild', speaker: 'Narrator', file: 'prologue_12.mp3',
        speech: '[warmer, a spark of hope] Only the Memory Pillars kept the truth: old stones that remember what the Mist erased. [lighter] And a small guild of archaeologist-enchanters went digging for them... [fondly] you, among them. [pause] And Lyra.',
        subtitle: 'Only the Memory Pillars kept the truth: old stones that remember what the Mist erased. And a small guild of archaeologist-enchanters went digging for them. You, among them. And Lyra.',
    },
    {
        scene: 'survivor', speaker: 'Narrator', file: 'prologue_13.mp3',
        speech: '[determined, stirring] This is where your story begins. [pause] Find what was stolen. Mend what was broken. [building] And when the Tide comes... [powerful, rousing] make sure the world stands together.',
        subtitle: 'This is where your story begins. Find what was stolen. Mend what was broken. And when the Tide comes, make sure the world stands together.',
    },
];

/** How long a line takes when there is no voice file: a storyteller's pace, plus room to breathe. */
export const estimateSeconds = (line: NarrationLine): number => {
    const words = line.subtitle.split(/\s+/).length;
    const pauses = (line.speech.match(/\[pause\]|\[beat\]|\.\.\./g) ?? []).length;
    return Math.max(3, words / 2.4 + pauses * 0.6 + 0.8);
};

/** How each speaker's name is coloured in the subtitles. */
export const SPEAKER_COLOR: Record<Speaker, string> = {
    Narrator: '#f3eefb',
    Malakor: '#d8b4fe',
    Commander: '#fca5a5',
    'King of Pyraxis': '#fdba74',
    'Queen of Aquatica': '#7dd3fc',
    Lyra: '#fde68a',
};
