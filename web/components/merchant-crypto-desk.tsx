"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useCallback, useEffect, useState } from "react";

import { coins, p2p, statusLabel, type P2POrder } from "@/components/p2p-market";
import { RyvoSelect } from "@/components/ryvo-select";
import { WalletConnectOptions } from "@/components/wallet-page";
import { countries, currencyDigits, localMoney, shortAddress } from "@/lib/solana-config";
import { supabase } from "@/lib/supabase";

/* Merchant studio: post USDC/SOL ads and release paid orders from your own
   wallet. Admins see the same orders view, filtered to open appeals. */

type Asset = "USDC" | "SOL";
type MyAd = { id: string; asset: Asset; currency: string; price_minor: number; available_units: number; reserved_units: number; min_minor: number; max_minor: number; window_minutes: number; terms: string; enabled: boolean };
const SCALE: Record<Asset, number> = { USDC: 1e6, SOL: 1e9 };
const currencies = Array.from(new Set(countries.map((c) => c.currency)));

async function release(orderId: string, wallet: { publicKey: import("@solana/web3.js").PublicKey; signTransaction: (t: Transaction) => Promise<Transaction> }) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw Error("Sign in to continue.");
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/p2p/release", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session!.access_token}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || "The release could not be completed.");
    return j;
  };
  const prepared = await post({ action: "prepare", orderId, wallet: wallet.publicKey.toBase58() });
  const signed = await wallet.signTransaction(Transaction.from(Buffer.from(prepared.transaction, "base64")));
  return post({ action: "submit", orderId, transaction: Buffer.from(signed.serialize()).toString("base64"), lastValidBlockHeight: prepared.lastValidBlockHeight });
}

export function MerchantCryptoDesk({ admin = false }: { admin?: boolean }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [ads, setAds] = useState<MyAd[]>([]);
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    Promise.all([admin ? Promise.resolve([] as MyAd[]) : p2p<MyAd[]>("merchant-ads"), p2p<P2POrder[]>("merchant-orders", admin ? { scope: "disputes" } : {})])
      .then(([a, o]) => { if (active) { setAds(a); setOrders(admin ? o.filter((x) => x.status === "disputed") : o); setError(""); } })
      .catch((e: Error) => { if (active) setError(e.message); });
    const t = setInterval(() => { if (document.visibilityState === "visible") setRevision((v) => v + 1); }, 10000);
    return () => { active = false; clearInterval(t); };
  }, [admin, revision]);

  async function doRelease(o: P2POrder) {
    if (!publicKey || !signTransaction) return;
    setBusy(o.id); setError("");
    try { await release(o.id, { publicKey, signTransaction }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Release failed."); } finally { setBusy(""); }
  }
  async function act(action: string, o: P2POrder, extra: Record<string, unknown> = {}) {
    setBusy(o.id); setError("");
    try { await p2p(action, { id: o.id, ...extra }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "That didn't go through."); } finally { setBusy(""); }
  }

  const queue = orders.filter((o) => ["paid", "disputed", "awaiting_payment"].includes(o.status));
  const done = orders.filter((o) => !queue.includes(o));

  return (
    <div className="mcd">
      {error && <div className="ops-alert" role="alert"><p>{error}</p></div>}
      {!admin && <AdEditor ads={ads} onSaved={refresh} />}

      <section className="ops-panel">
        <div className="ops-panel-heading"><h2>{admin ? "P2P appeals" : "Orders to handle"}</h2></div>
        {!admin && (connected && publicKey
          ? <p className="mcd-wallet"><span className="lc-dot" aria-hidden="true" />Releasing from {shortAddress(publicKey.toBase58())}</p>
          : <div className="mcd-connect"><p>Connect the wallet holding your USDC and SOL to release orders.</p><WalletConnectOptions /></div>)}
        {queue.length === 0 ? <p className="ops-context">{admin ? "No open appeals." : "No open orders right now."}</p> : (
          <div className="mcd-orders">
            {queue.map((o) => (
              <article key={o.id} className="mcd-order">
                <div className="mcd-order-main">
                  <b>{coins(o.units, o.asset)}</b>
                  <span>{localMoney(o.fiat_minor, o.currency)} · note {o.id.slice(0, 8).toUpperCase()} · to {shortAddress(o.buyer_wallet)}</span>
                  {o.closed_reason && o.status === "disputed" && <span className="mcd-reason">Appeal: {o.closed_reason}</span>}
                </div>
                <span className={`px-status is-${o.status}`}>{statusLabel(o.status)}</span>
                <div className="mcd-order-actions">
                  {admin ? (
                    <button className="lc-ghost" disabled={busy === o.id} onClick={() => void act("admin-resolve", o, { outcome: "cancelled" })}>Cancel order</button>
                  ) : o.status === "awaiting_payment" ? (
                    <button className="lc-ghost" disabled={busy === o.id} onClick={() => void act("merchant-cancel", o)}>Cancel</button>
                  ) : (
                    <>
                      <button className="primary" disabled={!connected || busy === o.id} onClick={() => void doRelease(o)}>{busy === o.id ? "Releasing…" : `Release ${o.asset}`}</button>
                      {o.status === "paid" && <button className="lc-ghost" disabled={busy === o.id} onClick={() => void act("dispute", o, { reason: "Payment not received" })}>Appeal</button>}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {!admin && <p className="ops-context">Release only after the buyer’s transfer has arrived in your account, matching the amount and note.</p>}
      </section>

      {!admin && done.length > 0 && (
        <section className="ops-panel">
          <div className="ops-panel-heading"><h2>Recent orders</h2></div>
          <div className="mcd-orders">
            {done.slice(0, 15).map((o) => (
              <article key={o.id} className="mcd-order is-done">
                <div className="mcd-order-main"><b>{coins(o.units, o.asset)}</b><span>{localMoney(o.fiat_minor, o.currency)} · {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
                <span className={`px-status is-${o.status}`}>{statusLabel(o.status)}</span>
                {o.release_signature && <a className="mcd-link" href={`https://solscan.io/tx/${o.release_signature}`} target="_blank" rel="noreferrer">View on Solscan ↗</a>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdEditor({ ads, onSaved }: { ads: MyAd[]; onSaved: () => void }) {
  const [asset, setAsset] = useState<Asset>("USDC");
  const [currency, setCurrency] = useState("NGN");
  const current = ads.find((a) => a.asset === asset && a.currency === currency);
  const digits = currencyDigits(currency);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const values = form ?? {
    price: current ? String(current.price_minor / 10 ** digits) : "",
    available: current ? String(current.available_units / SCALE[asset]) : "",
    min: current ? String(current.min_minor / 10 ** digits) : "",
    max: current ? String(current.max_minor / 10 ** digits) : "",
    window: String(current?.window_minutes ?? 15),
    terms: current?.terms ?? "",
    enabled: String(current?.enabled ?? true),
  };
  const set = (k: string, v: string) => setForm({ ...values, [k]: v });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    try {
      await p2p("save-ad", {
        asset, currency, price: Math.round(Number(values.price) * 10 ** digits), available: Math.round(Number(values.available) * SCALE[asset]),
        min: Math.round(Number(values.min) * 10 ** digits), max: Math.round(Number(values.max) * 10 ** digits),
        window: Number(values.window), terms: values.terms, enabled: values.enabled === "true",
      });
      setForm(null); setMsg("Ad saved."); onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save the ad."); } finally { setBusy(false); }
  }

  const num = (k: string, label: string, hint?: string) => (
    <label className="lc-field">{label}<input type="text" inputMode="decimal" value={values[k]} onChange={(e) => set(k, e.target.value.replace(/[^\d.]/g, ""))} />{hint && <small>{hint}</small>}</label>
  );

  return (
    <section className="ops-panel">
      <div className="ops-panel-heading"><h2>Your USDC &amp; SOL ads</h2></div>
      <p className="ops-context">Players buy from you by bank transfer to your merchant account, then you release coins from your wallet.</p>
      <div className="mcd-ad-pick">
        <label className="lc-field">Asset<RyvoSelect label="Asset" value={asset} onValueChange={(v) => { setAsset(v as Asset); setForm(null); }} options={[{ value: "USDC", label: "USDC" }, { value: "SOL", label: "SOL" }]} /></label>
        <label className="lc-field">Currency<RyvoSelect label="Currency" value={currency} onValueChange={(v) => { setCurrency(v); setForm(null); }} options={currencies.map((c) => ({ value: c, label: c }))} /></label>
      </div>
      <div className="mcd-ad-grid">
        {num("price", `Price per ${asset} (${currency})`)}
        {num("available", `Amount to sell (${asset})`, current ? `${coins(current.reserved_units, asset)} is reserved by open orders` : undefined)}
        {num("min", `Minimum order (${currency})`)}
        {num("max", `Maximum order (${currency})`)}
        {num("window", "Payment window (minutes)", "10 to 60")}
      </div>
      <label className="lc-field">Terms for buyers<textarea rows={2} maxLength={400} value={values.terms} onChange={(e) => set("terms", e.target.value)} placeholder="For example: pay from an account in your own name." /></label>
      <label className="mcd-toggle"><input type="checkbox" checked={values.enabled === "true"} onChange={(e) => set("enabled", String(e.target.checked))} /> Show this ad to players</label>
      <div className="mcd-ad-actions">
        {current && <span className="ops-context">Live price {localMoney(current.price_minor, current.currency)} per {asset}</span>}
        <button className="primary" disabled={busy || !values.price || !values.available || !values.min || !values.max} onClick={() => void save()}>{busy ? "Saving…" : current ? "Update ad" : "Post ad"}</button>
      </div>
      {msg && <p className="ops-context" role="status">{msg}</p>}
    </section>
  );
}
