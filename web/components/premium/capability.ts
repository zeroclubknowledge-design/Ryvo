/**
 * Rich GPU effects (extra WebGL canvases, SVG backdrop refraction) run only on
 * desktop-class devices. Phones keep their GPU budget for the hero artwork;
 * running all of it together got the mobile renderer killed.
 */
export function canRunRichEffects() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const desktop = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches;
  const memory = nav.deviceMemory ?? 8;
  return desktop && memory >= 4 && !nav.connection?.saveData;
}
