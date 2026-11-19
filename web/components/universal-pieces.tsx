"use client";

import { useCallback, useEffect, useState } from "react";

import { RyvoSelect } from "@/components/ryvo-select";
import { supabase } from "@/lib/supabase";

/* Universal pieces: convert to RYVO tokens (rate falls when demand is high),
   sell to Ryvo for USD (admin price), or list in a competition's marketplace.
   Every change runs in the database function ryvo_universal. */

type Piece = { id: string; source: string; expiresAt: string; listingId: string | null };
type UniversalState = { pieces: Piece[]; tokenRate: number; usdCents: number; tokenMicro: number; competitions: { id: string; title: string }[] };
type Listing = { id: string; price: number; mine: boolean; listedAt: string };

async function call<T>(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase().rpc("ryvo_universal", { action, payload });
  if (error) throw Error(error.code === "PGRST202" ? "Universal piece swaps need the latest database update." : error.message);
  return data as T;
}

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const tokens = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

type Pending = { kind: "token" } | { kind: "usd" } | { kind: "list"; competitionId: string; price: number } | null;

export function UniversalPieces({ signedIn, onChanged }: { signedIn: boolean; onChanged?: () => void }) {
  const [state, setState] = useState<UniversalState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [listing, setListing] = useState(false);
  const [competitionId, setCompetitionId] = useState("");
  const [priceText, setPriceText] = useState("1000");
  const [done, setDone] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    call<UniversalState>("state")
      .then((s) => { if (active) { setState(s); setError(""); } })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [signedIn, revision]);

  if (!signedIn) return null;

  const free = state?.pieces.filter((p) => !p.listingId) ?? [];
  const listed = state?.pieces.filter((p) => p.listingId) ?? [];
  const next = free[0];
  const competition = competitionId || state?.competitions[0]?.id || "";
  const price = Number(priceText) || 0;

  async function run() {
    if (!next || !pending || !state) return;
    setBusy(true); setError(""); setDone("");
    try {
      if (pending.kind === "token") {
        const r = await call<{ tokenMicro: number }>("to-token", { id: next.id, expectedRate: state.tokenRate });
        setDone(`Converted to ${tokens(r.tokenMicro / 1e6)} RYVO token${r.tokenMicro === 1e6 ? "" : "s"}.`);
      } else if (pending.kind === "usd") {
        await call("to-usd", { id: next.id, expectedCents: state.usdCents });
        setDone(`${usd(state.usdCents)} was added to your earnings.`);
      } else {
        await call("list", { id: next.id, competitionId: pending.competitionId, price: pending.price });
        setDone("Listed. Players in that competition can buy it now."); setListing(false);
      }
      setPending(null); setRevision((v) => v + 1); onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
      setPending(null); setRevision((v) => v + 1);
    } finally { setBusy(false); }
  }

  async function cancel(listingId: string) {
    setBusy(true); setError("");
    try { await call("cancel", { listingId }); setRevision((v) => v + 1); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't cancel."); } finally { setBusy(false); }
  }

  return (
    <section className="wl-section up" aria-labelledby="up-title">
      <div className="wl-section-head">
        <h2 id="up-title">Universal pieces</h2>
        <p>A Universal piece fills any slot. Keep it, or swap it below.</p>
      </div>

      {!state ? (
        <div className="up-card"><p className="up-muted">{error || "Loading your pieces…"}</p></div>
      ) : state.pieces.length === 0 ? (
        <div className="up-card"><p className="up-muted">You have no Universal pieces right now. You get one when you join, and more from referrals.</p></div>
      ) : (
        <div className="up-card">
          <div className="up-count">
            <span className="up-glyph" aria-hidden="true">✳</span>
            <div><b>{free.length} available{listed.length ? ` · ${listed.length} listed` : ""}</b>
              <span>{next ? `Next expires in ${daysLeft(next.expiresAt)} day${daysLeft(next.expiresAt) === 1 ? "" : "s"}` : "All your pieces are listed"}</span></div>
          </div>

          {next && !pending && !listing && (
            <div className="up-actions">
              <button className="up-action" disabled={busy} onClick={() => setPending({ kind: "token" })}>
                <b>Convert to RYVO tokens</b><span>{tokens(state.tokenRate)} token{state.tokenRate === 1 ? "" : "s"} per piece{state.tokenRate < 1 ? " · high demand" : ""}</span>
              </button>
              <button className="up-action" disabled={busy} onClick={() => setPending({ kind: "usd" })}>
                <b>Sell to Ryvo</b><span>{usd(state.usdCents)} to your earnings</span>
              </button>
              <button className="up-action" disabled={busy || state.competitions.length === 0} onClick={() => setListing(true)}>
                <b>List in a competition</b><span>{state.competitions.length ? "Sell to players for RYVO Credit" : "Join a competition to list"}</span>
              </button>
            </div>
          )}

          {listing && next && !pending && (
            <div className="up-form">
              <label className="lc-field">Competition
                <RyvoSelect label="Competition" value={competition} onValueChange={setCompetitionId} options={state.competitions.map((c) => ({ value: c.id, label: c.title }))} />
              </label>
              <label className="lc-field">Price in RYVO Credit
                <input type="text" inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/\D/g, "").slice(0, 7))} aria-invalid={price < 100 || price > 1_000_000} />
                <small>{price >= 100 ? `You receive ${usd(price * 0.0995)} after the 0.5% fee.` : "Minimum 100 r/."}</small>
              </label>
              <div className="up-confirm-actions">
                <button className="lc-ghost" onClick={() => setListing(false)}>Back</button>
                <button className="primary" disabled={price < 100 || price > 1_000_000 || !competition} onClick={() => setPending({ kind: "list", competitionId: competition, price })}>Review listing</button>
              </div>
            </div>
          )}

          {pending && next && (
            <div className="up-confirm" role="alertdialog" aria-labelledby="up-confirm-title">
              <b id="up-confirm-title">
                {pending.kind === "token" ? `Convert 1 Universal piece to ${tokens(state.tokenRate)} RYVO token${state.tokenRate === 1 ? "" : "s"}?`
                  : pending.kind === "usd" ? `Sell 1 Universal piece to Ryvo for ${usd(state.usdCents)}?`
                  : `List 1 Universal piece for ${pending.price.toLocaleString()} r/?`}
              </b>
              <span>{pending.kind === "list" ? "You can cancel the listing until it sells." : "This can’t be undone."}</span>
              <div className="up-confirm-actions">
                <button className="lc-ghost" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
                <button className="primary" disabled={busy} onClick={() => void run()}>{busy ? "Working…" : "Confirm"}</button>
              </div>
            </div>
          )}

          {listed.length > 0 && (
            <ul className="up-listed">
              {listed.map((p) => (
                <li key={p.id}><span>Listed piece · expires in {daysLeft(p.expiresAt)} days</span>
                  <button className="wl-chip" disabled={busy} onClick={() => void cancel(p.listingId!)}>Cancel listing</button></li>
              ))}
            </ul>
          )}
          {state.tokenMicro > 0 && <p className="up-muted">You hold {tokens(state.tokenMicro / 1e6)} RYVO tokens from conversions.</p>}
          {done && <p className="up-done" role="status">{done}</p>}
          {error && <p className="lc-error" role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}

/** Universal pieces listed in one competition; joined players can buy with RYVO Credit. */
export function UniversalMarket({ competitionId, onBought }: { competitionId: string; onBought?: () => void }) {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => call<Listing[]>("market", { competitionId }).then(setRows).catch((e: Error) => setError(e.message)), [competitionId]);
  useEffect(() => {
    let active = true;
    call<Listing[]>("market", { competitionId }).then((r) => { if (active) setRows(r); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [competitionId]);

  async function buy(id: string) {
    setBusy(id); setError("");
    try { await call("buy", { listingId: id }); setConfirming(null); await load(); onBought?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "That piece couldn't be bought."); await load(); }
    finally { setBusy(""); }
  }

  if (!rows?.length && !error) return null;
  return (
    <section className="up-market" aria-labelledby="up-market-title">
      <h2 id="up-market-title">Universal pieces for sale</h2>
      <p className="up-muted">Each one fills any slot on your board.</p>
      <ul>
        {rows?.map((r) => (
          <li key={r.id}>
            <span className="up-glyph" aria-hidden="true">✳</span>
            <b>{r.price.toLocaleString()} r/</b>
            {r.mine ? <span className="up-mine">Your listing</span> : confirming === r.id ? (
              <span className="up-buy-confirm">
                <button className="lc-ghost" disabled={!!busy} onClick={() => setConfirming(null)}>Cancel</button>
                <button className="primary" disabled={!!busy} onClick={() => void buy(r.id)}>{busy === r.id ? "Buying…" : "Confirm"}</button>
              </span>
            ) : (
              <button className="wl-chip" disabled={!!busy} onClick={() => setConfirming(r.id)}>Buy</button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="lc-error" role="alert">{error}</p>}
    </section>
  );
}
