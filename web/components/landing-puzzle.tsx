"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { Icon } from "@/components/collection-art";
import { winnerSharePercent } from "@/lib/economics";

/**
 * A practice board on the landing page: the hero artwork cut into 12 glass
 * pieces that drift around the board. Drag a piece (or tap it, then tap a
 * slot; or use the keyboard) to place it. Completing the board shows the
 * kind of reward a real winner gets — clearly labelled as an example.
 */

const COLS = 4, ROWS = 3, COUNT = COLS * ROWS;
const IMAGE = "/other-side-puzzle.webp";
// Example reward, from Ryvo's real rules: a $10, 100-player challenge with 10 winners.
const EXAMPLE = { fee: 10, players: 100, winners: 10, tokens: 100 };
const examplePrize = (EXAMPLE.fee * EXAMPLE.players * winnerSharePercent(EXAMPLE.players, EXAMPLE.winners)) / 100 / EXAMPLE.winners;

type Home = { cell: number; jx: number; jy: number; rot: number; drift: number };
type Layout = {
  W: number; H: number; board: { x: number; y: number; w: number; h: number };
  tray: { x: number; y: number; w: number; h: number; cols: number; rows: number }; pw: number; ph: number; trayScale: number;
};

function makeHomes(seed: number): Home[] {
  // Small deterministic shuffle so the server and first client render agree.
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cells = Array.from({ length: COUNT }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells.map((cell) => ({ cell, jx: rand() - 0.5, jy: rand() - 0.5, rot: (rand() - 0.5) * 18, drift: 4 + rand() * 4 }));
}

function computeLayout(W: number): Layout {
  const wide = W >= 860;
  const boardW = wide ? Math.min(560, W * 0.56) : W;
  const boardH = boardW * 0.75;
  const pw = boardW / COLS, ph = boardH / ROWS;
  const trayScale = wide ? 0.82 : 0.78;
  const tray = wide
    ? { x: boardW + 36, y: 0, w: W - boardW - 36, h: boardH, cols: 3, rows: 4 }
    : { x: 0, y: boardH + 22, w: W, h: ph * trayScale * 3 + 42, cols: 4, rows: 3 };
  return { W, H: wide ? boardH : tray.y + tray.h, board: { x: 0, y: 0, w: boardW, h: boardH }, tray, pw, ph, trayScale };
}

export function LandingPuzzle() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [round, setRound] = useState(1);
  const [placed, setPlaced] = useState<boolean[]>(() => Array(COUNT).fill(false));
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [message, setMessage] = useState("Drag a piece onto the board, or tap a piece and then its spot.");
  const misses = useRef(0);
  const grab = useRef({ dx: 0, dy: 0, startX: 0, startY: 0 });

  const homes = useMemo(() => makeHomes(round), [round]);
  const layout = width ? computeLayout(width) : null;
  const doneCount = placed.filter(Boolean).length;
  const complete = doneCount === COUNT;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slotRect = useCallback((i: number, l: Layout) => ({ x: l.board.x + (i % COLS) * l.pw, y: l.board.y + Math.floor(i / COLS) * l.ph }), []);
  const homeRect = (i: number, l: Layout) => {
    const h = homes[i], { tray } = l;
    const cw = tray.w / tray.cols, ch = tray.h / tray.rows;
    const col = h.cell % tray.cols, row = Math.floor(h.cell / tray.cols);
    const sw = l.pw * l.trayScale, sh = l.ph * l.trayScale;
    return { x: tray.x + col * cw + (cw - sw) / 2 + h.jx * Math.max(0, cw - sw) * 0.8 - (l.pw - sw) / 2, y: tray.y + row * ch + (ch - sh) / 2 + h.jy * Math.max(0, ch - sh) * 0.8 - (l.ph - sh) / 2 };
  };

  const place = (i: number) => {
    setPlaced((p) => { const n = [...p]; n[i] = true; return n; });
    setSelected(null); setHint(null); misses.current = 0;
    const left = COUNT - doneCount - 1;
    setMessage(left ? `Nice. ${left} piece${left === 1 ? "" : "s"} to go.` : "Board complete!");
  };
  const miss = (i: number) => {
    setWrong(i); window.setTimeout(() => setWrong(null), 450);
    misses.current += 1;
    if (misses.current >= 2) { setHint(i); setMessage("Look for the glowing spot."); } else setMessage("Not quite — match the picture on the board.");
  };

  function onPointerDown(e: PointerEvent<HTMLButtonElement>, i: number) {
    if (placed[i] || !layout || e.button > 0) return;
    const stage = stageRef.current!.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    grab.current = { dx: e.clientX - r.left - (r.width - layout.pw) / 2, dy: e.clientY - r.top - (r.height - layout.ph) / 2, startX: e.clientX, startY: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture is a nicety; dragging still works */ }
    setDrag({ id: i, x: e.clientX - stage.left - grab.current.dx, y: e.clientY - stage.top - grab.current.dy, moved: false });
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const stage = stageRef.current!.getBoundingClientRect();
    const moved = drag.moved || Math.hypot(e.clientX - grab.current.startX, e.clientY - grab.current.startY) > 6;
    setDrag({ ...drag, moved, x: e.clientX - stage.left - grab.current.dx, y: e.clientY - stage.top - grab.current.dy });
  }
  function onPointerUp(i: number) {
    if (!drag || !layout) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) { setSelected((s) => (s === i ? null : i)); setMessage("Now tap its spot on the board."); return; }
    const cx = d.x + layout.pw / 2, cy = d.y + layout.ph / 2;
    const target = slotRect(i, layout);
    if (Math.abs(cx - (target.x + layout.pw / 2)) < layout.pw * 0.5 && Math.abs(cy - (target.y + layout.ph / 2)) < layout.ph * 0.5) place(i);
    else if (cx > layout.board.x && cx < layout.board.x + layout.board.w && cy > layout.board.y && cy < layout.board.y + layout.board.h) miss(i);
  }
  function trySlot(slot: number) {
    if (selected === null || placed[slot]) return;
    if (slot === selected) place(selected); else miss(selected);
  }
  function restart() {
    setPlaced(Array(COUNT).fill(false)); setSelected(null); setHint(null); misses.current = 0;
    setRound((r) => r + 1); setMessage("Shuffled. Drag a piece onto the board, or tap a piece and then its spot.");
  }

  const bg = (i: number): CSSProperties => ({
    backgroundImage: `url(${IMAGE})`, backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
    backgroundPosition: `${((i % COLS) / (COLS - 1)) * 100}% ${(Math.floor(i / COLS) / (ROWS - 1)) * 100}%`,
  });

  return (
    <section className="lp" aria-labelledby="lp-title">
      <div className="lp-head">
        <p className="lx-kicker">TRY IT</p>
        <h3 id="lp-title">Complete the board.</h3>
        <p>Twelve pieces of <b>The Other Side</b> are loose. Put each one in its place.</p>
      </div>

      <div className="lp-stage" ref={stageRef} style={layout ? { height: layout.H } : undefined}>
        {layout && (
          <>
            <div className="lp-board" style={{ width: layout.board.w, height: layout.board.h }}>
              <div className="lp-ghost" style={{ backgroundImage: `url(${IMAGE})` }} aria-hidden="true" />
              {Array.from({ length: COUNT }, (_, s) => (
                <button
                  key={s} type="button" className={`lp-slot${hint === s && selected === s ? " is-hint" : ""}${hint === s && selected === null ? " is-hint" : ""}`}
                  style={{ left: (s % COLS) * layout.pw, top: Math.floor(s / COLS) * layout.ph, width: layout.pw, height: layout.ph }}
                  onClick={() => trySlot(s)} disabled={placed[s] || selected === null}
                  aria-label={placed[s] ? `Spot ${s + 1}, filled` : `Spot ${s + 1}`}
                />
              ))}
            </div>

            {Array.from({ length: COUNT }, (_, i) => {
              const isPlaced = placed[i], dragging = drag?.id === i;
              const pos = isPlaced ? slotRect(i, layout) : dragging ? { x: drag.x, y: drag.y } : homeRect(i, layout);
              const scale = isPlaced || dragging ? 1 : layout.trayScale;
              const style: CSSProperties = {
                ...bg(i), width: layout.pw, height: layout.ph,
                transform: `translate(${pos.x}px, ${pos.y}px) rotate(${isPlaced || dragging ? 0 : homes[i].rot}deg) scale(${dragging ? 1.06 : scale})`,
                ["--lp-drift" as string]: `${homes[i].drift}s`, ["--lp-delay" as string]: `${-i * 0.7}s`,
              };
              return (
                <button
                  key={`${round}-${i}`} type="button"
                  className={`lp-piece${isPlaced ? " is-placed" : ""}${dragging ? " is-dragging" : ""}${selected === i ? " is-selected" : ""}${wrong === i ? " is-wrong" : ""}`}
                  style={style} disabled={isPlaced || complete}
                  aria-label={isPlaced ? `Piece ${i + 1}, placed` : `Piece ${i + 1} of ${COUNT}${selected === i ? ", selected" : ""}`}
                  aria-pressed={selected === i}
                  onPointerDown={(e) => onPointerDown(e, i)} onPointerMove={onPointerMove} onPointerUp={() => onPointerUp(i)} onPointerCancel={() => setDrag(null)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected((s) => (s === i ? null : i)); setMessage("Now choose its spot on the board."); } }}
                >
                  <span className="lp-glass" aria-hidden="true" />
                </button>
              );
            })}

            {complete && (
              <div className="lp-win" role="status" style={{ width: layout.board.w, height: layout.board.h }}>
                <div className="lp-win-card">
                  <span className="lp-win-badge"><Icon name="check" size={16} /> Board complete</span>
                  <p className="lp-win-title">You’d win</p>
                  <div className="lp-win-rewards">
                    <div><b>${examplePrize.toFixed(2)}</b><span>prize share</span></div>
                    <i aria-hidden="true">+</i>
                    <div><b>{EXAMPLE.tokens}</b><span>RYVO tokens</span></div>
                  </div>
                  <small>Example from a ${EXAMPLE.fee}, {EXAMPLE.players}-player challenge with {EXAMPLE.winners} winner slots. Practice board — no real money.</small>
                  <div className="lp-win-actions">
                    <Link className="primary" href="/explore">Play for real <Icon name="arrow" size={17} /></Link>
                    <button type="button" className="lx-ghost" onClick={restart}>Play again</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="lp-foot">
        <div className="lp-meter" role="progressbar" aria-label="Pieces placed" aria-valuemin={0} aria-valuemax={COUNT} aria-valuenow={doneCount}>
          <i style={{ width: `${(doneCount / COUNT) * 100}%` }} />
        </div>
        <span className="lp-count">{doneCount} / {COUNT}</span>
        <p className="lp-message" aria-live="polite">{message}</p>
        {!complete && doneCount > 0 && <button type="button" className="lp-reset" onClick={restart}>Shuffle</button>}
      </div>
    </section>
  );
}
