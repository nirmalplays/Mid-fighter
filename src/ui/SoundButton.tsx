/**
 * A small speaker button: shows whether sound is live (on, muted, or still waiting for the
 * browser to allow it) and switches it. Tapping it while waiting is itself the gesture
 * browsers need to start sound.
 */
import { Ico } from './icons.tsx';
import { useSoundState } from '../game/audio.ts';
import { settings, useSettings } from '../game/settings.ts';

export function SoundButton({ dark = false }: { dark?: boolean }) {
    const state = useSoundState();
    const s = useSettings();
    const muted = !s.sound && !s.music;
    const label = muted ? 'Sound off' : state === 'on' ? 'Sound on' : 'Tap for sound';
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            data-quiet
            onClick={() => {
                if (muted) settings.set({ sound: true, music: true });
                else if (state === 'on') settings.set({ sound: false, music: false });
                // While waiting, this tap is what lets the browser start sound.
            }}
            className={`pointer-events-auto flex items-center gap-1 rounded-full px-2.5 text-[12px] font-bold ${!muted && state !== 'on' ? 'animate-pulse' : ''}`}
            style={{ height: 34, background: dark ? 'rgba(22,12,16,.72)' : 'rgba(255,255,255,.12)', border: `1.5px solid ${muted ? 'rgba(255,255,255,.4)' : state === 'on' ? '#86efac' : '#fde68a'}`, color: '#fff' }}
        >
            <Ico name={muted ? 'soundOff' : 'soundOn'} size={16} color="currentColor" style={{ opacity: !muted && state !== 'on' ? 0.6 : 1 }} />
            {!muted && state !== 'on' && <span>Tap for sound</span>}
        </button>
    );
}
