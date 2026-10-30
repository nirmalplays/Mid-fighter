/**
 * Weather over the world, drawn in screen space above it: rain (puts out camp fires),
 * storms (rain, flashes and lightning that strikes near the player) and fog (the view
 * closes in to a small circle). Each kingdom has its own odds: Zephyria is stormy,
 * Aquatica rainy, Terragrim foggy, Pyraxis mostly clear with ash fog.
 * The state goes to the store so the HUD and the camp fires can react.
 */
import { Container, Graphics, Sprite, Texture, type Application } from 'pixi.js';
import { store, type AppState } from '../../state/store.ts';
import type { Region } from '../eidolon.ts';
import { settings } from '../settings.ts';

type Kind = AppState['weather'];
const ODDS: Record<Region, Record<Kind, number>> = {
    fire: { clear: 5, fog: 3, storm: 1, rain: 0 },
    air: { clear: 3, storm: 4, rain: 2, fog: 1 },
    water: { clear: 3, rain: 5, storm: 2, fog: 1 },
    earth: { clear: 4, fog: 4, rain: 2, storm: 0 },
    citadel: { clear: 1, storm: 3, fog: 3, rain: 0 },
};
const FADE_MS = 2500;

export interface Weather {
    update(dtMs: number): void;
    destroy(): void;
}

export function createWeather(app: Application, opts: {
    /** The world's container: the weather goes right above it (below the joystick). */
    above: Container;
    region: () => Region | null;
    /** Lightning struck near the player (the scene decides where and what it hits). */
    strike: () => void;
    /** Under a roof of rock: no rain, fog or lightning reaches the player. */
    indoors?: () => boolean;
}): Weather {
    const root = new Container();
    app.stage.addChildAt(root, app.stage.getChildIndex(opts.above) + 1);
    const dim = new Graphics();
    const rain = new Graphics();
    const flash = new Graphics();
    // Fog: clear in the middle, thick at the edges.
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g2 = c.getContext('2d')!;
    const grad = g2.createRadialGradient(128, 128, 30, 128, 128, 128);
    grad.addColorStop(0, 'rgba(200,205,215,0)');
    grad.addColorStop(0.55, 'rgba(200,205,215,0.55)');
    grad.addColorStop(1, 'rgba(200,205,215,0.97)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 256, 256);
    const fogTex = Texture.from(c);
    const fog = new Sprite(fogTex);
    fog.anchor.set(0.5);
    const fogEdge = new Graphics();
    root.addChild(dim, fog, fogEdge, rain, flash);

    const forced = new URLSearchParams(window.location.search).get('weather') as Kind | null;
    let kind: Kind = forced ?? 'clear';
    let left = forced ? Infinity : 120000; // the first two minutes are calm
    let amount = 0; // 0..1 fade of the current weather
    let flashT = 0;
    let boltIn = 6000;
    const drops = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), s: 0.7 + Math.random() * 0.6 }));

    const pick = () => {
        const r = opts.region() ?? 'earth';
        const odds = ODDS[r];
        const total = Object.values(odds).reduce((a, b) => a + b, 0);
        let x = Math.random() * total;
        for (const k of Object.keys(odds) as Kind[]) {
            x -= odds[k];
            if (x <= 0) return k;
        }
        return 'clear' as Kind;
    };

    store.patch({ weather: kind });
    return {
        update(dtMs) {
            const W = app.screen.width;
            const H = app.screen.height;
            left -= dtMs;
            if (left <= 0) {
                // Fade out, then change.
                amount = Math.max(0, amount - dtMs / FADE_MS);
                if (amount <= 0) {
                    kind = pick();
                    left = (kind === 'clear' ? 90000 + Math.random() * 110000 : 60000 + Math.random() * 90000);
                    store.patch({ weather: kind });
                }
            } else {
                amount = Math.min(1, amount + dtMs / FADE_MS);
            }
            const wet = kind === 'rain' || kind === 'storm';
            // With weather effects off, the sky still changes (fires still go out) but nothing is drawn.
            const inside = !!opts.indoors?.();
            root.visible = settings.get().weatherFx && !inside;
            dim.clear();
            if (wet || kind === 'fog') dim.rect(0, 0, W, H).fill({ color: kind === 'fog' ? 0x9aa3b0 : 0x1a2840, alpha: (kind === 'storm' ? 0.28 : kind === 'rain' ? 0.18 : 0.12) * amount });

            rain.clear();
            if (wet) {
                const n = kind === 'storm' ? drops.length : 100;
                for (let i = 0; i < n; i++) {
                    const d = drops[i];
                    d.y += (dtMs / 1000) * 1.6 * d.s;
                    d.x -= (dtMs / 1000) * (kind === 'storm' ? 0.35 : 0.15) * d.s;
                    if (d.y > 1) { d.y -= 1; d.x = Math.random() * 1.2; }
                    if (d.x < 0) d.x += 1.2;
                    const x = d.x * W, y = d.y * H;
                    rain.moveTo(x, y).lineTo(x - (kind === 'storm' ? 9 : 4), y + 18 * d.s);
                }
                rain.stroke({ width: 2, color: 0xbcd6ff, alpha: 0.45 * amount });
            }

            fog.visible = kind === 'fog' && amount > 0;
            fogEdge.clear();
            if (fog.visible) {
                const size = Math.round(Math.max(W, H) * 1.05);
                const x0 = Math.round(W / 2 - size / 2), y0 = Math.round(H / 2 - size / 2);
                fog.position.set(x0 + size / 2, y0 + size / 2);
                fog.width = fog.height = size;
                fog.alpha = amount;
                // Cover past the gradient's square so wide screens are fogged edge to edge: one frame with the
                // square cut out, on whole pixels (overlapping strips showed as seams).
                if (x0 > 0 || y0 > 0) fogEdge.rect(0, 0, W, H).fill({ color: 0xc8cdd7, alpha: 0.97 * amount }).rect(x0, y0, size, size).cut();
            }

            // Storms: lightning now and then.
            flashT = Math.max(0, flashT - dtMs);
            if (kind === 'storm' && amount > 0.8 && !inside) {
                boltIn -= dtMs;
                if (boltIn <= 0) {
                    boltIn = 5000 + Math.random() * 9000;
                    flashT = 260;
                    opts.strike();
                }
            }
            flash.clear();
            if (flashT > 0) flash.rect(0, 0, W, H).fill({ color: 0xeef4ff, alpha: 0.5 * (flashT / 260) });
        },
        destroy() {
            root.destroy({ children: true });
            fogTex.destroy(true);
            store.patch({ weather: 'clear' });
        },
    };
}
