/**
 * The intro cutscene's narration: what the old storyteller says over each scene (with
 * ElevenLabs v3 delivery tags), the subtitle shown, and the voice file it plays
 * (public/voice, made once with the dev voice tool: ?voicegen on the dev server). Until the
 * files exist the cutscene runs on its own clock with subtitles only.
 */
export type SceneId = 'oneworld' | 'peoples' | 'guardian' | 'exile' | 'whispers' | 'sunder' | 'kingdoms' | 'survivor';

export interface NarrationLine {
    scene: SceneId;
    /** Sent to the speech model (v3 tags shape the delivery). */
    speech: string;
    /** Shown on screen. */
    subtitle: string;
    /** public/voice/<file> */
    file: string;
}

export const NARRATION: NarrationLine[] = [
    {
        scene: 'oneworld',
        speech: 'Long ago... the world was one. [pause] Eidolon. A single great land, beating with the light of its Heart.',
        subtitle: 'Long ago, the world was one. Eidolon. A single great land, beating with the light of its Heart.',
        file: 'narration_01.mp3',
    },
    {
        scene: 'peoples',
        speech: 'Four peoples shared its gifts. [pause] Fire, in the crags of Pyraxis. Wind, over the isles of Zephyria. Tide, in the depths of Aquatica. [pause] And stone, in the hollows of Terragrim.',
        subtitle: 'Four peoples shared its gifts. Fire, in the crags of Pyraxis. Wind, over the isles of Zephyria. Tide, in the depths of Aquatica. And stone, in the hollows of Terragrim.',
        file: 'narration_02.mp3',
    },
    {
        scene: 'guardian',
        speech: 'One man was sworn to guard the Heart. [pause] Malakor. High scholar of the Council... and the wisest of us all.',
        subtitle: 'One man was sworn to guard the Heart. Malakor. High scholar of the Council, and the wisest of us all.',
        file: 'narration_03.mp3',
    },
    {
        scene: 'exile',
        speech: 'But power corrupts. [pause] He reached for the Heart, to make himself a god... and the Council cast him down, into the dark beneath the world.',
        subtitle: 'But power corrupts. He reached for the Heart, to make himself a god, and the Council cast him down, into the dark beneath the world.',
        file: 'narration_04.mp3',
    },
    {
        scene: 'whispers',
        speech: 'In the dark, he learned to whisper. [whispers] They steal your fire. They poison your water. They are coming for you. [/whispers]',
        subtitle: 'In the dark, he learned to whisper. "They steal your fire. They poison your water. They are coming for you."',
        file: 'narration_05.mp3',
    },
    {
        scene: 'sunder',
        speech: 'And when the hatred was ripe... [pause] he tore the land apart.',
        subtitle: 'And when the hatred was ripe, he tore the land apart.',
        file: 'narration_06.mp3',
    },
    {
        scene: 'kingdoms',
        speech: 'Now four kingdoms smoulder behind his barriers, each ruled by a corrupted warden. [pause] And at the heart of the ruin, Malakor waits in the Void Citadel... feeding on their hate.',
        subtitle: 'Now four kingdoms smoulder behind his barriers, each ruled by a corrupted warden. And at the heart of the ruin, Malakor waits in the Void Citadel, feeding on their hate.',
        file: 'narration_07.mp3',
    },
    {
        scene: 'survivor',
        speech: 'But one survivor still stands. [pause] Choose your allegiance. Master your kingdom\'s power. [pause] And make Eidolon whole again.',
        subtitle: 'But one survivor still stands. Choose your allegiance. Master your kingdom\'s power. And make Eidolon whole again.',
        file: 'narration_08.mp3',
    },
];

/** How long a line takes when there is no voice file: a slow storyteller's pace, plus room to breathe. */
export const estimateSeconds = (line: NarrationLine): number => {
    const words = line.subtitle.split(/\s+/).length;
    const pauses = (line.speech.match(/\[pause\]|\.\.\./g) ?? []).length;
    return Math.max(5, words / 2.3 + pauses * 0.6 + 1.2);
};

/** The voice the narration was made with (described for the voice designer). */
export const NARRATOR_VOICE = {
    name: 'Eidolon Storyteller',
    description: 'An old male storyteller with a deep, weathered, slightly gravelly voice. Slow, grave and warm, like an elder telling an ancient legend by a campfire. Neutral accent, calm and measured, with gravitas.',
    sample: 'Gather close, and listen. Long ago, before the kingdoms burned and the barriers rose, the world was one. I was young then, and I remember the light of the Heart on every face. Let me tell you how it was lost, and how it may yet be found.',
};
