/**
 * Procedural stand-in for creator artwork.
 *
 * Every piece on a board is a crop of ONE composition, exactly like a real
 * fragmented artwork, so the grid reads as a fragmented whole rather than a
 * set of unrelated thumbnails. Deterministic: same seed, same artwork.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PALETTE = ["#ff6a4d", "#f4c34e", "#efe6d2", "#6b4e9b", "#2b2f7a"];

export function artworkBackground(seed: number): string {
  const r = rng(seed);
  const W = 1200;
  const H = 900;

  const blooms = Array.from({ length: 10 }, () => {
    const cx = 60 + r() * (W - 120);
    const cy = 50 + r() * (H - 100);
    const rx = 90 + r() * 200;
    const ry = 70 + r() * 180;
    const fill = PALETTE[Math.floor(r() * PALETTE.length)];
    const opacity = (0.5 + r() * 0.5).toFixed(2);
    const rotate = Math.floor(r() * 180);
    return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(
      0
    )}" ry="${ry.toFixed(0)}" fill="${fill}" opacity="${opacity}" transform="rotate(${rotate} ${cx.toFixed(
      0
    )} ${cy.toFixed(0)})"/>`;
  }).join("");

  const arcs = Array.from({ length: 7 }, () => {
    const cx = (60 + r() * (W - 120)).toFixed(0);
    const cy = (50 + r() * (H - 100)).toFixed(0);
    const radius = (50 + r() * 260).toFixed(0);
    const opacity = (0.12 + r() * 0.34).toFixed(2);
    const width = (2 + r() * 7).toFixed(0);
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#efe6d2" stroke-opacity="${opacity}" stroke-width="${width}"/>`;
  }).join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#101031"/>${blooms}${arcs}</svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Position + scale a background so each cell shows its own slice. */
export function slicePosition(cols: number, rows: number, index: number) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${
      rows > 1 ? (row / (rows - 1)) * 100 : 0
    }%`,
  };
}

/** A board keeps the artwork's 4:3 proportion, so each cell is its own ratio. */
export function cellAspect(cols: number, rows: number) {
  return `${4 / cols} / ${3 / rows}`;
}
