"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

/* Admin money monitor: token launch pool, the entry split, launch fees,
   refunds due, Universal piece activity and the settings that drive it.
   Reads ryvo_economy (admin-only in the database). */

type Totals = { entries: number; collected: number; winners: number; creators: number; ryvo: number; referrals: number; pool: number };
type Row = { id: string; title: string; status: string; joined: number; capacity: number; winners: number; winnerShare: number; collected: number; winnersMicro: number; creatorMicro: number; ryvoMicro: number; poolMicro: number };
type Report = {
  totals: Totals; launchFees: number; refundsDue: { count: number; amount: number }; competitions: Row[];
  universal: { tokenRate: number; tokenSwaps24h: number; tokenMicro: number; usdMicro: number; activeListings: number; sold: number };
  settings: { universalUsdCents: number; tokenDemandTarget: number };
};

const usd = (micro: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(micro / 1e6);
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

async function economy(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase().rpc("ryvo_economy", { action, payload });
  if (error) throw Error(error.code === "PGRST202" ? "Run migration 202611190007_competition_economy.sql to turn on the economy monitor." : error.message);
  return data as Report;
}

export function EconomyPanel() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [usdText, setUsdText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => economy("report").then((r) => { if (active) { setReport(r); setError(""); } }).catch((e: Error) => { if (active) setError(e.message); });
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  if (!report) return <section className="ops-panel econ-empty"><h2>Economy</h2><p className="ops-context">{error || "Loading the money picture…"}</p></section>;

  const t = report.totals;
  const u = report.universal;
  const s = report.settings;
  const usdValue = usdText === "" ? (s.universalUsdCents / 100).toFixed(2) : usdText;
  const targetValue = targetText === "" ? String(s.tokenDemandTarget) : targetText;
  const cents = Math.round(Number(usdValue) * 100);
  const target = Number(targetValue);
  const settingsValid = Number.isFinite(cents) && cents >= 1 && cents <= 100000 && Number.isInteger(target) && target >= 1 && target <= 1_000_000;

  async function save() {
    setSaving(true); setSaved(false); setError("");
    try { const r = await economy("save-settings", { universalUsdCents: cents, tokenDemandTarget: target }); setReport(r); setUsdText(""); setTargetText(""); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setSaving(false); }
  }

  const split = [
    { label: "Winners' prize pools", value: t.winners, note: "10–40% of each entry, by winner ratio", tone: "green" },
    { label: "Creators", value: t.creators, note: "10% of each entry", tone: "purple" },
    { label: "Ryvo", value: t.ryvo, note: `50% of each entry · ${usd(t.referrals)} of it to referrals`, tone: "pink" },
    { label: "Token launch pool", value: t.pool, note: "Unused winner share", tone: "gold" },
  ];

  return (
    <div className="econ">
      <section className="econ-pool" aria-labelledby="econ-pool-title">
        <p className="econ-kicker">RYVO TOKEN LAUNCH POOL</p>
        <strong id="econ-pool-title">{usd(t.pool)}</strong>
        <p>Every entry sets aside the part of the 40% winner budget its competition doesn’t use. This pool funds the RYVO token launch. It grows with each registration.</p>
        <div className="econ-pool-facts">
          <span><b>{t.entries.toLocaleString()}</b> paid entries</span>
          <span><b>{t.collected ? ((t.pool / t.collected) * 100).toFixed(1) : "0.0"}%</b> of entries so far</span>
        </div>
      </section>

      <section className="ops-panel" aria-labelledby="econ-split-title">
        <h2 id="econ-split-title">Where entry money went</h2>
        <p className="ops-context">{usd(t.collected)} collected from {t.entries.toLocaleString()} entries.</p>
        {t.collected > 0 && (
          <div className="econ-bar" aria-hidden="true">
            {split.map((x) => <i key={x.label} className={`tone-${x.tone}`} style={{ flexGrow: x.value }} />)}
          </div>
        )}
        <div className="econ-grid">
          {split.map((x) => (
            <article key={x.label} className={`econ-card tone-${x.tone}`}>
              <span>{x.label}</span><b>{usd(x.value)}</b><small>{x.note}</small>
            </article>
          ))}
        </div>
        <p className="ops-context econ-note">Referral rewards are a percentage of Ryvo’s 50%. They show as $0.00 until sign-up records who referred each player.</p>
      </section>

      <div className="econ-grid econ-grid-wide">
        <article className="econ-card"><span>Launch fees received</span><b>{usd(report.launchFees)}</b><small>Paid by creators to open competitions</small></article>
        <article className={`econ-card${report.refundsDue.count ? " tone-alert" : ""}`}><span>Refunds due</span><b>{usd(report.refundsDue.amount)}</b><small>{report.refundsDue.count} payment{report.refundsDue.count === 1 ? "" : "s"} arrived after a competition filled</small></article>
      </div>

      <section className="ops-panel" aria-labelledby="econ-universal-title">
        <h2 id="econ-universal-title">Universal pieces</h2>
        <div className="econ-grid">
          <article className="econ-card"><span>Token rate now</span><b>{num(u.tokenRate)} RYVO</b><small>per piece · {u.tokenSwaps24h} of {s.tokenDemandTarget} conversions in 24h</small></article>
          <article className="econ-card"><span>Tokens from conversions</span><b>{num(u.tokenMicro / 1e6)}</b><small>Counts toward the 8M community allocation</small></article>
          <article className="econ-card"><span>Bought back for USD</span><b>{usd(u.usdMicro)}</b><small>At ${(s.universalUsdCents / 100).toFixed(2)} per piece</small></article>
          <article className="econ-card"><span>Marketplace</span><b>{u.activeListings} listed</b><small>{u.sold} sold between players</small></article>
        </div>
        <form className="econ-settings" onSubmit={(e) => { e.preventDefault(); if (settingsValid) void save(); }}>
          <label className="lc-field">Universal piece price (USD)
            <input type="text" inputMode="decimal" value={usdValue} onChange={(e) => { setSaved(false); setUsdText(e.target.value.replace(/[^\d.]/g, "")); }} />
            <small>What Ryvo pays when a player sells a piece back.</small>
          </label>
          <label className="lc-field">Token demand target (conversions per day)
            <input type="text" inputMode="numeric" value={targetValue} onChange={(e) => { setSaved(false); setTargetText(e.target.value.replace(/\D/g, "")); }} />
            <small>Up to this many a day, 1 piece = 1 RYVO. Above it, the rate falls (target ÷ conversions, never below 0.1).</small>
          </label>
          <button className="primary" disabled={!settingsValid || saving}>{saving ? "Saving…" : saved ? "Saved" : "Save settings"}</button>
        </form>
      </section>

      <section className="ops-panel" aria-labelledby="econ-table-title">
        <h2 id="econ-table-title">By competition</h2>
        {report.competitions.length ? (
          <div className="ops-table-wrap">
            <table>
              <thead><tr><th>Competition</th><th>Players</th><th>Winner share</th><th>Collected</th><th>Winners</th><th>Creator</th><th>Ryvo</th><th>Launch pool</th></tr></thead>
              <tbody>
                {report.competitions.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.title}</b><small>{r.status}</small></td>
                    <td>{r.joined.toLocaleString()} / {r.capacity.toLocaleString()}<small>{r.winners} winner slots</small></td>
                    <td>{Number(r.winnerShare)}%</td>
                    <td>{usd(r.collected)}</td><td>{usd(r.winnersMicro)}</td><td>{usd(r.creatorMicro)}</td><td>{usd(r.ryvoMicro)}</td><td>{usd(r.poolMicro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="ops-context">No competitions yet.</p>}
      </section>
      {error && <p className="lc-error" role="alert">{error}</p>}
    </div>
  );
}
