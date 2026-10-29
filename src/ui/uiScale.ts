/**
 * Short screens (a phone held sideways is ~360-420 CSS px tall): the in-game HUD is laid out on a virtual
 * screen at least DESIGN_H tall and zoomed down to fit (CSS `zoom` on the HUD's root), so its panels,
 * bars and buttons keep their proportions instead of crowding each other. Everything inside the HUD that
 * reads the screen's size asks here (uiHeight / uiWidth: the virtual size), and pointer movements over it
 * are divided by uiZoom().
 */
import { useEffect, useState } from 'react';

const DESIGN_H = 520;
/** Never below this: the smallest buttons stay a thumb's width. */
const MIN_ZOOM = 0.62;

export const uiZoom = (): number => {
    const h = window.innerHeight;
    return h >= DESIGN_H ? 1 : Math.max(MIN_ZOOM, h / DESIGN_H);
};
export const uiHeight = (): number => window.innerHeight / uiZoom();
export const uiWidth = (): number => window.innerWidth / uiZoom();

export function useUiZoom(): number {
    const [z, setZ] = useState(uiZoom);
    useEffect(() => {
        const on = () => setZ(uiZoom());
        window.addEventListener('resize', on);
        window.addEventListener('orientationchange', on);
        return () => {
            window.removeEventListener('resize', on);
            window.removeEventListener('orientationchange', on);
        };
    }, []);
    return z;
}
