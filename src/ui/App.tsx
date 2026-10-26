/**
 * Screen router. One phase visible at a time; the 'playing' phase stacks the
 * React HUD above the Pixi canvas.
 *
 * #app-frame (styled in styles/app.css) is the device frame: a centered
 * portrait column that fills phones edge-to-edge and letterboxes on desktop.
 * Everything — canvas and DOM UI — lives inside it, so they always align.
 */
import { useEffect } from 'react';
import { useStore } from '../state/store.ts';
import { music, sfx } from '../game/audio.ts';
import LoadingScreen from './LoadingScreen.tsx';
import MainMenu from './MainMenu.tsx';
import IntroCutscene from './IntroCutscene.tsx';
import KingdomSelect from './KingdomSelect.tsx';
import Hud from './Hud.tsx';
import GameCanvas from '../game/GameCanvas.tsx';
import RotatePrompt from './RotatePrompt.tsx';


export default function App() {
    // A soft tap for menu and panel buttons (gameplay buttons sit inside [data-quiet]).
    useEffect(() => {
        const on = (e: PointerEvent) => {
            const el = e.target as Element | null;
            if (el?.closest?.('button') && !el.closest('[data-quiet]')) sfx('click');
        };
        window.addEventListener('pointerdown', on);
        return () => window.removeEventListener('pointerdown', on);
    }, []);
    const phase = useStore((s) => s.phase);
    const runId = useStore((s) => s.runId);
    // Off the battlefield: the cutscene has its own music; the home screen and menus the intro theme.
    useEffect(() => {
        if (phase === 'intro') music.set('cutscene');
        else if (phase !== 'playing') music.set('title');
    }, [phase]);
    return (
        <div id="app-frame" className="bg-surface text-white">
            {phase === 'loading' && <LoadingScreen />}
            {phase === 'menu' && <MainMenu />}
            {phase === 'intro' && <IntroCutscene />}
            {phase === 'kingdom' && <KingdomSelect />}
            {phase === 'playing' && (
                <div className="absolute inset-0">
                    <GameCanvas key={runId} />
                    <Hud />
                </div>
            )}
            <RotatePrompt />
        </div>
    );
}
