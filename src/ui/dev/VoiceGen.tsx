/**
 * Dev-only: makes the intro narration with the RUN SDK's ElevenLabs text-to-speech. Open the
 * dev server with ?voicegen while signed in to the playground. Design an old storyteller's
 * voice (or pick one from the library), generate the eight lines, listen, then download them;
 * the files go in public/voice/. Never part of a production build (App only loads it in dev).
 */
import { useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { NARRATION, NARRATOR_VOICE } from '../../game/narration.ts';

type Voice = { id: string; name: string; preview?: string; note?: string };
type Line = { url?: string; seconds?: number; status: 'idle' | 'working' | 'done' | 'failed'; error?: string };

const box = { background: '#1b1530', border: '1px solid #4b3b66', borderRadius: 12, padding: 12 };
const btn = 'rounded-md px-3 py-1.5 text-[13px] font-bold text-[#1b1033] disabled:opacity-40';

export default function VoiceGen() {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [chosen, setChosen] = useState<Voice | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lines, setLines] = useState<Line[]>(NARRATION.map(() => ({ status: 'idle' })));
    const [speed, setSpeed] = useState(0.9);
    const [stability, setStability] = useState(0.45);

    const run = async (label: string, fn: () => Promise<void>) => {
        setBusy(label);
        setError(null);
        try {
            await fn();
        } catch (e) {
            setError(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        setBusy(null);
    };

    const design = () => run('Designing voices', async () => {
        const r = await RundotGameAPI.audioGen.designVoices({ description: NARRATOR_VOICE.description, sampleText: NARRATOR_VOICE.sample });
        setVoices((v) => [...r.previews.map((p, n) => ({ id: p.generatedVoiceId, name: `Designed storyteller ${n + 1}`, preview: p.audioUrl, note: 'designed (saved when chosen)' })), ...v]);
    });
    const library = () => run('Loading the voice library', async () => {
        const r = await RundotGameAPI.audioGen.listVoices();
        const fits = r.voices.filter((v) => {
            const text = `${v.name} ${v.description ?? ''} ${Object.values(v.labels ?? {}).join(' ')}`.toLowerCase();
            return /old|elder|narrat|story|deep|grandpa|wise/.test(text) && !/female|woman|girl/.test(text);
        });
        setVoices((v) => [...v, ...(fits.length ? fits : r.voices).map((x) => ({ id: x.voiceId, name: x.name, preview: x.previewUrl, note: [x.category, ...Object.values(x.labels ?? {})].filter(Boolean).join(' · ') }))]);
    });
    const choose = (v: Voice) => run('Saving the voice', async () => {
        if (v.note?.startsWith('designed')) {
            const saved = await RundotGameAPI.audioGen.saveDesignedVoice({ generatedVoiceId: v.id, voiceName: NARRATOR_VOICE.name, voiceDescription: NARRATOR_VOICE.description });
            setChosen({ ...v, id: saved.voiceId, note: 'designed and saved' });
        } else setChosen(v);
    });

    const generate = (only?: number) => run('Generating narration', async () => {
        if (!chosen) return;
        for (let n = 0; n < NARRATION.length; n++) {
            if (only !== undefined && n !== only) continue;
            setLines((l) => l.map((x, i) => (i === n ? { status: 'working' } : x)));
            try {
                const r = await RundotGameAPI.audioGen.generate({ type: 'tts', text: NARRATION[n].speech, voiceId: chosen.id, model: 'eleven_v3', stability, similarityBoost: 0.8, speed, clientRef: `narration-${n + 1}` });
                setLines((l) => l.map((x, i) => (i === n ? { status: 'done', url: r.audioUrl, seconds: r.durationSec } : x)));
            } catch (e) {
                setLines((l) => l.map((x, i) => (i === n ? { status: 'failed', error: e instanceof Error ? e.message : String(e) } : x)));
            }
        }
    });

    /** Save each line as narration_0N.mp3 (into the browser's Downloads folder). */
    const download = () => run('Downloading', async () => {
        for (let n = 0; n < NARRATION.length; n++) {
            const url = lines[n].url;
            if (!url) continue;
            const blob = await (await fetch(url)).blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = NARRATION[n].file;
            document.body.appendChild(a);
            a.click();
            a.remove();
            await new Promise((r) => setTimeout(r, 400));
        }
    });

    const total = lines.reduce((t, l) => t + (l.seconds ?? 0), 0);
    return (
        <div className="absolute inset-0 overflow-y-auto p-4 text-[#efe8fa]" style={{ background: '#0b0614' }}>
            <h1 className="text-[22px] font-black">Narration maker (dev only)</h1>
            <p className="mb-3 text-[13px] text-[#b9aed0]">ElevenLabs text-to-speech through the RUN SDK. You must be signed in to the playground. 1) get a voice, 2) choose it, 3) generate, 4) listen, 5) download and tell Claude the files are in Downloads.</p>
            {error && <p className="mb-2 rounded-md bg-red-900/60 p-2 text-[13px]">{error}</p>}
            {busy && <p className="mb-2 text-[13px] text-amber-200">{busy}…</p>}

            <div style={box} className="mb-3 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={btn} style={{ background: '#c4b5fd' }} disabled={!!busy} onClick={design}>Design an old storyteller voice</button>
                    <button type="button" className={btn} style={{ background: '#a5f3fc' }} disabled={!!busy} onClick={library}>Show narrator voices from the library</button>
                </div>
                <p className="text-[12px] text-[#9d92b5]">Voice brief: {NARRATOR_VOICE.description}</p>
                {voices.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md p-1.5" style={{ background: chosen?.name === v.name ? '#2e2450' : 'transparent' }}>
                        <span className="w-56 text-[13px] font-bold">{v.name}</span>
                        <span className="w-64 truncate text-[11px] text-[#9d92b5]">{v.note}</span>
                        {v.preview && <audio controls src={v.preview} className="h-8" />}
                        <button type="button" className={btn} style={{ background: '#fde68a' }} disabled={!!busy} onClick={() => choose(v)}>Use this voice</button>
                    </div>
                ))}
                {chosen && <p className="text-[13px] font-bold text-emerald-300">Voice: {chosen.name} ({chosen.note})</p>}
            </div>

            <div style={box} className="mb-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    <label>Speed {speed.toFixed(2)} <input type="range" min={0.7} max={1.1} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
                    <label>Expressiveness {(1 - stability).toFixed(2)} <input type="range" min={0.2} max={0.8} step={0.05} value={1 - stability} onChange={(e) => setStability(1 - Number(e.target.value))} /></label>
                    <button type="button" className={btn} style={{ background: '#86efac' }} disabled={!chosen || !!busy} onClick={() => generate()}>Generate all 8 lines</button>
                    <button type="button" className={btn} style={{ background: '#fbbf24' }} disabled={!lines.some((l) => l.url) || !!busy} onClick={download}>Download all</button>
                    {total > 0 && <span className="text-[#b9aed0]">Total {total.toFixed(0)}s</span>}
                </div>
                {NARRATION.map((line, n) => (
                    <div key={line.file} className="flex flex-col gap-1 rounded-md p-2" style={{ background: '#140f24' }}>
                        <div className="text-[12px] text-[#9d92b5]">{n + 1}. {line.file} · {lines[n].status}{lines[n].seconds ? ` · ${lines[n].seconds!.toFixed(1)}s` : ''}{lines[n].error ? ` · ${lines[n].error}` : ''}</div>
                        <div className="text-[13px]">{line.speech}</div>
                        <div className="flex items-center gap-2">
                            {lines[n].url && <audio controls src={lines[n].url} className="h-8" />}
                            {lines[n].url && <a href={lines[n].url} target="_blank" rel="noreferrer" className="text-[11px] underline">open</a>}
                            <button type="button" className={btn} style={{ background: '#e9d5ff' }} disabled={!chosen || !!busy} onClick={() => generate(n)}>Redo this line</button>
                        </div>
                    </div>
                ))}
                {lines.some((l) => l.url) && (
                    <textarea readOnly className="h-28 w-full rounded-md bg-black/40 p-2 text-[11px]" value={lines.map((l, n) => `${NARRATION[n].file} ${l.url ?? ''}`).join('\n')} />
                )}
            </div>
        </div>
    );
}
