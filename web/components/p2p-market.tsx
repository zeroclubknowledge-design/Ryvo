"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/collection-art";
import { MerchantDirectory } from "@/components/merchant-directory";
import { RyvoSelect } from "@/components/ryvo-select";
import { WalletConnectOptions } from "@/components/wallet-page";
import { countries, currencyDigits, localMoney, shortAddress } from "@/lib/solana-config";
import { supabase } from "@/lib/supabase";

/* Exchange-style P2P desk: buy USDC or SOL from approved merchants straight
   into your Solana wallet. All rules live in the database (ryvo_p2p). */

type Asset = "USDC" | "SOL";
type Ad = { id: string; asset: Asset; currency: string; price: number; available: number; min: number; max: number; window: number; terms: string; merchant: string; mine: boolean; orders: number; completion: number | null; releaseMinutes: number | null };
export type P2POrder = {
  id: string; asset: Asset; currency: string; price_minor: number; fiat_minor: number; units: number; buyer_wallet: string;
  bank_name: string; account_name: string; account_number: string; status: string; created_at: string; expires_at: string;
  paid_at: string | null; released_at: string | null; release_signature: string | null; closed_reason: string | null; merchant?: string;
};

export async function p2p<T>(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase().rpc("ryvo_p2p", { action, payload });
  if (error) throw Error(error.code === "PGRST202" ? "The P2P market needs the latest database update." : error.message);
  return data as T;
}

const SCALE: Record<Asset, number> = { USDC: 1e6, SOL: 1e9 };
export const coins = (units: number, asset: Asset) => `${(units / SCALE[asset]).toLocaleString("en-US", { maximumFractionDigits: asset === "USDC" ? 2 : 4 })} ${asset}`;
const currencies = Array.from(new Set(countries.map((c) => c.currency)));

export function P2PMarket() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState<Asset | "RYVO">("USDC");
  const [currency, setCurrency] = useState("NGN");
  const [filter, setFilter] = useState("");
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    if (asset === "RYVO" || side !== "buy") return;
    let active = true;
    p2p<Ad[]>("market", { asset, currency }).then((r) => { if (active) { setAds(r); setError(""); } }).catch((e: Error) => { if (active) { setAds([]); setError(e.message); } });
    p2p<P2POrder[]>("my-orders").then((r) => { if (active) setOrders(r); }).catch(() => {});
    return () => { active = false; };
  }, [asset, currency, side, revision]);

  // Keep open orders live while the page is visible.
  const open = orders.filter((o) => ["awaiting_payment", "paid", "disputed"].includes(o.status));
  useEffect(() => {
    if (!open.length) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000);
    return () => clearInterval(t);
  }, [open.length, refresh]);

  const digits = currencyDigits(currency);
  const filterMinor = filter ? Math.round(Number(filter) * 10 ** digits) : 0;
  const shown = (ads ?? []).filter((a) => !filterMinor || (filterMinor >= a.min && filterMinor <= a.max));

  return (
    <div className="px">
      <div className="px-tabs" role="tablist" aria-label="Buy or sell">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={side === s} className={side === s ? "is-on" : ""} onClick={() => setSide(s)}>{s === "buy" ? "Buy" : "Sell"}</button>
        ))}
      </div>

      {side === "sell" ? (
        <section className="px-empty">
          <span className="px-empty-icon" aria-hidden="true"><Icon name="wallet" size={24} /></span>
          <h2>Selling for cash opens soon.</h2>
          <p>Cash-outs to your bank will run through on-chain escrow, so your USDC is protected until the merchant pays. Until then, use Buy to fund your wallet.</p>
        </section>
      ) : (
        <>
          <div className="px-filters">
            <div className="px-assets" role="tablist" aria-label="Asset">
              {(["USDC", "SOL", "RYVO"] as const).map((a) => (
                <button key={a} role="tab" aria-selected={asset === a} className={asset === a ? "is-on" : ""} onClick={() => { setAsset(a); setBuying(null); }}>
                  {a === "RYVO" ? "RYVO Credit" : a}
                </button>
              ))}
            </div>
            {asset !== "RYVO" && (
              <div className="px-filter-row">
                <label className="px-field"><span>Currency</span>
                  <RyvoSelect label="Currency" value={currency} onValueChange={(v) => { setCurrency(v); setBuying(null); }} options={currencies.map((c) => ({ value: c, label: c }))} />
                </label>
                <label className="px-field"><span>Amount</span>
                  <input type="text" inputMode="decimal" placeholder={`Any amount in ${currency}`} value={filter} onChange={(e) => setFilter(e.target.value.replace(/[^\d.]/g, ""))} />
                </label>
              </div>
            )}
          </div>

          {asset === "RYVO" ? <MerchantDirectory /> : (
            <>
              {open.length > 0 && (
                <section className="px-section" aria-labelledby="px-open-title">
                  <h2 id="px-open-title">Your open orders</h2>
                  {open.map((o) => <OrderCard key={o.id} order={o} onChanged={refresh} />)}
                </section>
              )}

              <section className="px-section" aria-labelledby="px-ads-title">
                <div className="px-section-head">
                  <h2 id="px-ads-title">Buy {asset} with {currency}</h2>
                  <span className="px-verified-note"><Icon name="check" size={14} /> Approved merchants only</span>
                </div>
                {ads === null ? <p className="px-muted">Finding merchants…</p> : shown.length === 0 ? (
                  <div className="px-empty small"><p>{error || `No approved merchant is selling ${asset} for ${currency}${filterMinor ? " in that amount" : ""} right now. Try another currency or check back soon.`}</p></div>
                ) : (
                  <div className="px-ads">
                    {shown.map((ad) => (
                      <article className="px-ad" key={ad.id}>
                        <div className="px-ad-merchant">
                          <span className="px-monogram" aria-hidden="true">{ad.merchant.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <b>{ad.merchant} <span className="px-badge" title="Approved by Ryvo"><Icon name="check" size={12} /></span></b>
                            <span>{ad.orders.toLocaleString()} orders · {ad.completion == null ? "New" : `${ad.completion}% completion`}{ad.releaseMinutes != null ? ` · ~${Math.max(1, ad.releaseMinutes)} min release` : ""}</span>
                          </div>
                        </div>
                        <div className="px-ad-price"><strong>{localMoney(ad.price, ad.currency)}</strong><span>per {ad.asset}</span></div>
                        <dl className="px-ad-facts">
                          <div><dt>Available</dt><dd>{coins(ad.available, ad.asset)}</dd></div>
                          <div><dt>Limits</dt><dd>{localMoney(ad.min, ad.currency)} – {localMoney(ad.max, ad.currency)}</dd></div>
                          <div><dt>Payment</dt><dd><span className="px-pay-chip">Bank transfer</span></dd></div>
                        </dl>
                        {ad.mine ? <span className="px-muted">Your ad</span> : buying === ad.id ? null : (
                          <button className="primary px-buy" onClick={() => setBuying(ad.id)}>Buy {ad.asset}</button>
                        )}
                        {buying === ad.id && <BuyPanel ad={ad} onClose={() => setBuying(null)} onOrdered={() => { setBuying(null); refresh(); }} />}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {orders.some((o) => !open.includes(o)) && (
                <section className="px-section" aria-labelledby="px-history-title">
                  <h2 id="px-history-title">Order history</h2>
                  <div className="px-history">
                    {orders.filter((o) => !open.includes(o)).map((o) => (
                      <div key={o.id} className="px-history-row">
                        <div><b>{coins(o.units, o.asset)}</b><span>{o.merchant} · {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
                        <span className={`px-status is-${o.status}`}>{statusLabel(o.status)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <p className="px-fine">Merchants are approved by Ryvo. Pay only to the account shown on your order, and only mark it paid once your transfer has gone through. If a merchant doesn’t release, open an appeal and Ryvo will review it.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function BuyPanel({ ad, onClose, onOrdered }: { ad: Ad; onClose: () => void; onOrdered: () => void }) {
  const { publicKey, connected } = useWallet();
  const digits = currencyDigits(ad.currency);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fiat = Math.round(Number(amount || 0) * 10 ** digits);
  const units = fiat ? Math.floor((fiat * SCALE[ad.asset]) / ad.price) : 0;
  const valid = fiat >= ad.min && fiat <= ad.max && units > 0 && units <= ad.available;

  async function order() {
    if (!publicKey) return;
    setBusy(true); setError("");
    try { await p2p("create-order", { adId: ad.id, fiatMinor: fiat, wallet: publicKey.toBase58() }); onOrdered(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't start the order."); }
    finally { setBusy(false); }
  }

  return (
    <div className="px-buy-panel">
      <label className="px-field"><span>You pay</span>
        <div className="px-amount"><input autoFocus type="text" inputMode="decimal" placeholder={`${(ad.min / 10 ** digits).toLocaleString()} – ${(ad.max / 10 ** digits).toLocaleString()}`} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /><b>{ad.currency}</b></div>
      </label>
      <div className="px-receive"><span>You receive</span><strong>{units ? coins(units, ad.asset) : `— ${ad.asset}`}</strong></div>
      {connected && publicKey ? (
        <p className="px-to-wallet"><span className="lc-dot" aria-hidden="true" />Sent to your wallet {shortAddress(publicKey.toBase58())}</p>
      ) : (
        <div className="px-connect"><p>Connect the wallet to receive into</p><WalletConnectOptions /></div>
      )}
      {ad.terms && <p className="px-terms"><b>Merchant terms:</b> {ad.terms}</p>}
      {amount && !valid && <p className="lc-error">Enter {localMoney(ad.min, ad.currency)} to {localMoney(ad.max, ad.currency)}, within what’s available.</p>}
      {error && <p className="lc-error" role="alert">{error}</p>}
      <div className="px-actions">
        <button className="lc-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="primary" onClick={() => void order()} disabled={!valid || !connected || busy}>{busy ? "Placing order…" : `Buy ${ad.asset}`}</button>
      </div>
      <small className="px-fine">You’ll have {ad.window} minutes to pay the merchant by bank transfer.</small>
    </div>
  );
}

export const statusLabel = (s: string) => ({ awaiting_payment: "Waiting for your payment", paid: "Waiting for release", released: "Completed", cancelled: "Cancelled", expired: "Expired", disputed: "Under appeal" } as Record<string, string>)[s] ?? s;

function OrderCard({ order: o, onChanged }: { order: P2POrder; onChanged: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(o.expires_at).getTime() - now);
  const step = o.status === "awaiting_payment" ? 0 : o.status === "released" ? 2 : 1;

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setError("");
    try { await p2p(action, { id: o.id, ...extra }); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : "That didn't go through."); } finally { setBusy(""); }
  }
  const copy = async (label: string, value: string) => { try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(""), 1400); } catch { /* blocked */ } };

  return (
    <article className="px-order">
      <div className="px-order-head">
        <div><span className="px-muted">Buying from {o.merchant}</span><strong>{coins(o.units, o.asset)}</strong></div>
        <span className={`px-status is-${o.status}`}>{statusLabel(o.status)}</span>
      </div>
      <ol className="px-steps" aria-label="Order progress">
        {["Pay the merchant", "Merchant releases", "Received"].map((label, i) => (
          <li key={label} className={i < step ? "is-done" : i === step ? "is-current" : ""}><span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>{label}</li>
        ))}
      </ol>

      {o.status === "awaiting_payment" && (
        <>
          <div className="px-timer" role="timer" aria-live="off">Pay within <b>{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}</b></div>
          <dl className="px-pay">
            {[["Amount", localMoney(o.fiat_minor, o.currency), String(o.fiat_minor / 10 ** currencyDigits(o.currency))], ["Bank", o.bank_name, o.bank_name], ["Account name", o.account_name, o.account_name], ["Account number", o.account_number, o.account_number], ["Transfer note", o.id.slice(0, 8).toUpperCase(), o.id.slice(0, 8).toUpperCase()]].map(([k, v, c]) => (
              <div key={k}><dt>{k}</dt><dd>{v}<button className="px-copy" onClick={() => void copy(k, c)} aria-label={`Copy ${k}`}>{copied === k ? "Copied" : "Copy"}</button></dd></div>
            ))}
          </dl>
          <div className="px-actions">
            <button className="lc-ghost" disabled={!!busy} onClick={() => void act("cancel")}>Cancel order</button>
            <button className="primary" disabled={!!busy} onClick={() => void act("mark-paid")}>{busy === "mark-paid" ? "Saving…" : "I’ve paid"}</button>
          </div>
        </>
      )}
      {o.status === "paid" && (
        <>
          <p className="px-waiting">You marked this paid. The merchant will release {coins(o.units, o.asset)} to {shortAddress(o.buyer_wallet)} once your transfer arrives.</p>
          <div className="px-actions"><button className="lc-ghost" disabled={!!busy} onClick={() => void act("dispute", { reason: "Paid but not released" })}>Open appeal</button></div>
        </>
      )}
      {o.status === "disputed" && <p className="px-waiting">Your appeal is open. Ryvo will review the payment and contact you.</p>}
      {error && <p className="lc-error" role="alert">{error}</p>}
    </article>
  );
}
