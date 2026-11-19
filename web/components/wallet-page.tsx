"use client";

import { Menu } from "@base-ui/react/menu";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { useSolanaBalances, type SolanaBalances } from "@/components/solana-provider";
import { UniversalPieces } from "@/components/universal-pieces";
import { loadCashout } from "@/lib/cashout";
import { credit, money, type DemoState } from "@/lib/demo";
import { SOLANA_NETWORK, USDC_SCALE, shortAddress } from "@/lib/solana-config";

type Activity = DemoState["ledger"][number];

const MOBILE_ADAPTER = "Mobile Wallet Adapter";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dollars = (micro: number) => usd.format(micro / USDC_SCALE);
const tokenAmount = (n: number, digits = 4) => n.toLocaleString("en-US", { maximumFractionDigits: digits });

const noop = () => () => {};
/** Wallets are only discoverable in the browser, so render them after hydration. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** Hidden balances persist per browser, like a wallet app's privacy toggle. */
const HIDE_KEY = "ryvo-hide-balances";
const hideListeners = new Set<() => void>();
function useHiddenBalances() {
  const hidden = useSyncExternalStore(
    (fn) => { hideListeners.add(fn); return () => hideListeners.delete(fn); },
    () => { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } },
    () => false,
  );
  const toggle = () => {
    try { localStorage.setItem(HIDE_KEY, hidden ? "0" : "1"); } catch { /* storage blocked */ }
    hideListeners.forEach((fn) => fn());
  };
  return [hidden, toggle] as const;
}

export function WalletPage(props: { creditBalance: string; activity: Activity[]; signedIn: boolean; tokenCard?: ReactNode }) {
  return (
<WalletScreen {...props} />
  );
}

function WalletScreen({ creditBalance, activity, signedIn, tokenCard }: { creditBalance: string; activity: Activity[]; signedIn: boolean; tokenCard?: ReactNode }) {
  const { connected, publicKey } = useWallet();
  const { balances, error, loading, refresh } = useSolanaBalances();
  const [hidden, toggleHidden] = useHiddenBalances();
  const earnings = useEarnings(signedIn);
  const heroRef = useRef<HTMLElement>(null);
  const receiveRef = useRef<HTMLDialogElement>(null);

  const toConnect = () => {
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    heroRef.current?.querySelector<HTMLButtonElement>(".wl-option")?.focus({ preventScroll: true });
  };
  const mask = (value: string) => (hidden ? "••••" : value);

  return (
    <div className="wl">
      <WalletHero ref={heroRef} balances={balances} error={error} loading={loading} refresh={refresh} hidden={hidden} onToggleHidden={toggleHidden} onReceive={() => receiveRef.current?.showModal()} />

      <section className="wl-section" aria-labelledby="wl-actions-title">
        <div className="wl-section-head">
          <h2 id="wl-actions-title">Move money</h2>
          <p>Top up your wallet, buy RYVO Credit or swap it out.</p>
        </div>
        <div className="wl-rows">
          <ActionRow
            tone="green" glyph={<ReceiveGlyph />}
            title="Add funds" text={connected ? "Receive USDC or SOL from another Solana wallet" : "Connect a wallet to receive USDC or SOL"}
            onClick={connected ? () => receiveRef.current?.showModal() : toConnect}
          />
          <ActionRow tone="pink" glyph={<P2PGlyph />} title="Buy with P2P" text="Pay an approved merchant by local bank transfer" href="/wallet/p2p" />
          <ActionRow tone="purple" glyph={<SwapGlyph />} title="Swap" text="RYVO Credit ⇄ USDC at 1,000 r/ = $1" soon />
          <ActionRow tone="neutral" glyph={<FundGlyph />} title="Fund RYVO Credit" text="Pay with USDC straight from your wallet" soon />
        </div>
      </section>

      <section className="wl-section" aria-labelledby="wl-assets-title">
        <div className="wl-section-head">
          <h2 id="wl-assets-title">Your assets</h2>
          {connected && publicKey && <p>On Solana at {shortAddress(publicKey.toBase58())}</p>}
        </div>
        <div className="wl-rows">
          <AssetRow
            glyph={<Image src="/ryvo-logo-mark.png" alt="" width={40} height={40} />}
            name="RYVO Credit" detail="Game credit for draws and listings"
            value={mask(`${creditBalance} r/`)}
          />
          {connected && (
            <>
              <AssetRow
                glyph={<UsdcGlyph />} name="USD Coin"
                detail={balances ? mask(`${tokenAmount(balances.usdcMicro / USDC_SCALE, 2)} USDC`) : "USDC"}
                value={balances ? mask(dollars(balances.usdcMicro)) : loading ? <Skeleton /> : "—"}
              />
              <AssetRow
                glyph={<SolGlyph />} name="Solana"
                detail={balances ? mask(`${tokenAmount(balances.sol)} SOL`) : "SOL"}
                value={balances ? (balances.solUsd === null ? mask(`${tokenAmount(balances.sol)} SOL`) : mask(usd.format(balances.sol * balances.solUsd))) : loading ? <Skeleton /> : "—"}
              />
            </>
          )}
        </div>
      </section>

      <section className="wl-earnings" aria-labelledby="wl-earnings-title">
        <div className="wl-earnings-top">
          <span className="wl-eyebrow" id="wl-earnings-title">Available to withdraw</span>
          <span className="wl-pill">Paid in USDC</span>
        </div>
        <strong className="wl-earnings-value">{earnings.available === null ? "—" : mask(dollars(earnings.available))}</strong>
        <p>
          {earnings.message ??
            (earnings.reserved ? `${mask(dollars(earnings.reserved))} held in escrow. ` : "") + "Prize shares and sale proceeds, sent to your connected wallet. 1 USDC = $1."}
        </p>
        <button className="wl-earnings-action" disabled>
          {connected ? "Withdrawals open soon" : "Connect a wallet to withdraw"}
        </button>
      </section>

      <UniversalPieces signedIn={signedIn} />

      {tokenCard}

      <section className="wl-section wl-activity-section" aria-labelledby="wl-activity-title">
        <div className="wl-section-head"><h2 id="wl-activity-title">Activity</h2></div>
        {activity.length ? (
          <div className="wl-rows">
            {activity.map((entry) => (
              <div className="wl-row wl-activity" key={entry.id}>
                <span className={`wl-tile ${entry.amount < 0 ? "tone-neutral" : "tone-green"}`} aria-hidden="true">
                  {entry.amount < 0 ? <SendGlyph /> : <ReceiveGlyph />}
                </span>
                <div className="wl-row-copy">
                  <b>{entry.label}</b>
                  <span>{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <strong className={entry.amount < 0 ? "" : "is-positive"}>
                  {mask(`${entry.amount < 0 ? "−" : "+"}${entry.currency === "NGN" ? money(Math.abs(entry.amount)) : credit(Math.abs(entry.amount))}`)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="wl-empty-note">Your transactions will appear here.</p>
        )}
      </section>

      {connected && publicKey && <ReceiveDialog ref={receiveRef} address={publicKey.toBase58()} />}
    </div>
  );
}

/* ---------------------------------------------------------------- hero */

function WalletHero({ ref, balances, error, loading, refresh, hidden, onToggleHidden, onReceive }: {
  ref: React.Ref<HTMLElement>; balances: SolanaBalances | null; error: string; loading: boolean; refresh: () => void;
  hidden: boolean; onToggleHidden: () => void; onReceive: () => void;
}) {
  const { wallet, disconnect, connected, publicKey } = useWallet();
  const [copied, setCopied] = useState(false);
  const address = publicKey?.toBase58() ?? "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  const network = SOLANA_NETWORK === "devnet" ? "Devnet" : "Solana";

  if (connected && publicKey) {
    const solValue = balances?.solUsd != null ? balances.sol * balances.solUsd : null;
    const total = balances ? balances.usdcMicro / USDC_SCALE + (solValue ?? 0) : null;
    const name = wallet && wallet.adapter.name !== MOBILE_ADAPTER ? wallet.adapter.name : "My wallet";
    const totalText = total === null ? "" : usd.format(total);
    return (
      <section ref={ref} className="wl-hero" aria-labelledby="wl-hero-title">
        <div className="wl-hero-top">
          <Avatar address={address} />
          <div className="wl-identity">
            <b id="wl-hero-title">{name}</b>
            <button className="wl-address" onClick={copy} aria-label={copied ? "Address copied" : `Copy address ${shortAddress(address)}`}>
              {shortAddress(address)} {copied ? <CheckGlyph /> : <CopyGlyph />}
            </button>
          </div>
          <span className="wl-network"><i aria-hidden="true" />{network}</span>
          <Menu.Root>
            <Menu.Trigger className="wl-icon-button" aria-label="Wallet options"><MoreGlyph /></Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className="ryvo-select-positioner" align="end" sideOffset={10}>
                <Menu.Popup className="wl-menu">
                  <Menu.Item className="wl-menu-item" onClick={onReceive}>Receive</Menu.Item>
                  <Menu.Item className="wl-menu-item" onClick={() => void copy()}>Copy address</Menu.Item>
                  <Menu.Item className="wl-menu-item" render={<a href={`https://solscan.io/account/${address}${SOLANA_NETWORK === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" />}>View on Solscan ↗</Menu.Item>
                  <Menu.Item className="wl-menu-item is-danger" onClick={() => void disconnect()}>Disconnect</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>

        <span className="wl-eyebrow">Balance</span>
        <div className="wl-total">
          <strong aria-live="polite" data-size={totalText.length > 13 ? "s" : totalText.length > 9 ? "m" : "l"}>
            {hidden ? "$••••" : total === null ? (loading ? <Skeleton wide /> : "$—") : totalText}
          </strong>
          <button className="wl-icon-button" onClick={onToggleHidden} aria-pressed={hidden} aria-label={hidden ? "Show balances" : "Hide balances"}>
            {hidden ? <EyeOffGlyph /> : <EyeGlyph />}
          </button>
        </div>
        <p className="wl-total-note">
          {error ? (
            <span className="wl-error" role="alert">{error} <button onClick={refresh}>Retry</button></span>
          ) : balances && balances.solUsd === null ? "USDC only. The SOL price is unavailable right now." : "USDC and SOL in this wallet, in US dollars."}
        </p>
      </section>
    );
  }

  return (
    <section ref={ref} className="wl-hero is-disconnected" aria-labelledby="wl-hero-title">
      <div className="wl-hero-top">
        <span className="wl-avatar wl-avatar-brand"><Image src="/ryvo-logo-mark.png" alt="" width={30} height={30} /></span>
        <div className="wl-identity"><b>Ryvo wallet</b><span>Not connected</span></div>
        <span className="wl-network"><i aria-hidden="true" />{network}</span>
      </div>
      <span className="wl-eyebrow">Balance</span>
      <h2 className="wl-connect-title" id="wl-hero-title">Connect a Solana wallet.</h2>
      <p className="wl-connect-copy">Hold USDC, fund RYVO Credit and receive withdrawals. Connecting never moves funds.</p>

      <WalletConnectOptions />
    </section>
  );
}


/** Detected Solana wallets as rows; used by the wallet, create and join screens. */
export function WalletConnectOptions() {
  const { wallets, wallet, select, connect, connecting } = useWallet();
  const hydrated = useHydrated();
  const [requested, setRequested] = useState(false);
  const [problem, setProblem] = useState("");

  // select() only picks the adapter; connect once React has applied it.
  useEffect(() => {
    if (!requested || !wallet) return;
    let active = true;
    connect()
      .catch((e: unknown) => { if (active) setProblem(e instanceof Error && e.message ? e.message : "The wallet declined the connection."); })
      .finally(() => { if (active) setRequested(false); });
    return () => { active = false; };
  }, [requested, wallet, connect]);

  const detected = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  const choose = (name: WalletName) => { setProblem(""); select(name); setRequested(true); };

  // The last approved wallet is being restored on its own: don't offer the picker.
  if (hydrated && connecting && !requested && wallet) {
    return (
      <div className="wl-options">
        <div className="wl-option is-reconnecting" role="status">
          <span className="wl-option-glyph" aria-hidden="true"><WalletGlyph /></span>
          <span className="wl-option-copy">
            <b>Reconnecting your wallet…</b>
            <span>{wallet.adapter.name === MOBILE_ADAPTER ? "Restoring your wallet app" : `Restoring ${wallet.adapter.name}`}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
        {!hydrated ? (
          <div className="wl-options" aria-hidden="true"><div className="wl-option is-placeholder" /></div>
        ) : detected.length ? (
          <div className="wl-options">
            {detected.map((item) => {
              const busy = (connecting || requested) && wallet?.adapter.name === item.adapter.name;
              const mobile = item.adapter.name === MOBILE_ADAPTER;
              return (
                <button key={item.adapter.name} className="wl-option" disabled={connecting || requested} onClick={() => choose(item.adapter.name)}>
                  {mobile ? (
                    <span className="wl-option-glyph" aria-hidden="true"><WalletGlyph /></span>
                  ) : (
                    // Wallet icons are data URIs supplied by the wallet itself.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.adapter.icon} alt="" width={40} height={40} />
                  )}
                  <span className="wl-option-copy">
                    <b>{mobile ? "Open my wallet app" : item.adapter.name}</b>
                    <span>{busy ? "Approve in your wallet…" : mobile ? "Phantom, Solflare, Backpack and more" : "Detected in this browser"}</span>
                  </span>
                  <span className="wl-chevron" aria-hidden="true"><ChevronGlyph /></span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="wl-no-wallet">
            <p>No Solana wallet was found here. On a phone, open Ryvo in your wallet app’s browser. On a computer, add a wallet extension and refresh.</p>
            <div>
              <a className="wl-chip" href="https://phantom.com/download" target="_blank" rel="noreferrer">Get Phantom ↗</a>
              <a className="wl-chip" href="https://solflare.com/download" target="_blank" rel="noreferrer">Get Solflare ↗</a>
            </div>
          </div>
        )}
      {problem && <p className="wl-error" role="alert">{problem}</p>}
    </>
  );
}

/* ------------------------------------------------------------- pieces */

function ActionRow({ tone, glyph, title, text, href, onClick, soon }: {
  tone: "green" | "pink" | "purple" | "neutral"; glyph: ReactNode; title: string; text: string; href?: string; onClick?: () => void; soon?: boolean;
}) {
  const body = (
    <>
      <span className={`wl-tile tone-${tone}`} aria-hidden="true">{glyph}</span>
      <span className="wl-row-copy"><b>{title}</b><span>{text}</span></span>
      {soon ? <span className="wl-soon">Soon</span> : <span className="wl-chevron" aria-hidden="true"><ChevronGlyph /></span>}
    </>
  );
  if (soon) return <div className="wl-row is-soon" aria-disabled="true">{body}</div>;
  if (href) return <Link className="wl-row" href={href}>{body}</Link>;
  return <button className="wl-row" onClick={onClick}>{body}</button>;
}

function AssetRow({ glyph, name, detail, value }: { glyph: ReactNode; name: string; detail: ReactNode; value: ReactNode }) {
  return (
    <div className="wl-row wl-asset">
      <span className="wl-token" aria-hidden="true">{glyph}</span>
      <span className="wl-row-copy"><b>{name}</b><span>{detail}</span></span>
      <strong>{value}</strong>
    </div>
  );
}

function ReceiveDialog({ ref, address }: { ref: React.Ref<HTMLDialogElement>; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  return (
    <dialog ref={ref} className="wl-sheet" aria-labelledby="wl-receive-title" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
      <div className="wl-sheet-body">
        <span className="wl-tile tone-green" aria-hidden="true"><ReceiveGlyph /></span>
        <h2 id="wl-receive-title">Receive on Solana</h2>
        <p>Send only USDC or SOL on the Solana network to this address. Other networks will lose funds.</p>
        <code className="wl-full-address">{address}</code>
        <button className="wl-sheet-primary" onClick={copy}>{copied ? "Address copied" : "Copy address"}</button>
        <form method="dialog"><button className="wl-sheet-secondary">Done</button></form>
      </div>
    </dialog>
  );
}

/** Deterministic two-tone avatar from the address, like a wallet app's identicon. */
function Avatar({ address }: { address: string }) {
  let hash = 0;
  for (const char of address) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const a = hash % 360, b = (a + 70 + (hash >> 9) % 80) % 360;
  return (
    <span className="wl-avatar" style={{ background: `linear-gradient(135deg, hsl(${a} 70% 55%), hsl(${b} 75% 45%))` }} aria-hidden="true">
      {address.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Skeleton({ wide }: { wide?: boolean }) {
  return <span className={`wl-skeleton${wide ? " is-wide" : ""}`} aria-label="Loading" />;
}

function useEarnings(signedIn: boolean) {
  const [state, setState] = useState<{ available: number | null; reserved: number; message: string | null }>({
    available: null, reserved: 0, message: signedIn ? "Loading your earnings…" : "Sign in to see your earnings.",
  });
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    loadCashout()
      .then((w) => { if (active) setState({ available: w.earnings.available_micro, reserved: w.earnings.reserved_micro, message: null }); })
      .catch(() => { if (active) setState({ available: null, reserved: 0, message: "Earnings are unavailable right now. Refresh to try again." }); });
    return () => { active = false; };
  }, [signedIn]);
  return state;
}

/* -------------------------------------------------------------- glyphs */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Svg = ({ children, size = 22 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{children}</svg>
);
const ReceiveGlyph = () => <Svg><path {...stroke} d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14" /></Svg>;
const SendGlyph = () => <Svg><path {...stroke} d="M12 20V9m0 0 4.5 4.5M12 9l-4.5 4.5M5 5h14" /></Svg>;
const SwapGlyph = () => <Svg><path {...stroke} d="M7 7h11l-3.5-3.5M17 17H6l3.5 3.5" /></Svg>;
const P2PGlyph = () => <Svg><circle {...stroke} cx="8" cy="8" r="3" /><circle {...stroke} cx="16" cy="16" r="3" /><path {...stroke} d="M14 6h4v4M10 18H6v-4" /></Svg>;
const FundGlyph = () => <Svg><rect {...stroke} x="3" y="6" width="18" height="13" rx="3" /><path {...stroke} d="M3 10h18M16 15h2" /></Svg>;
const WalletGlyph = () => <Svg size={24}><path {...stroke} d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" /><rect {...stroke} x="4" y="8" width="16" height="11" rx="2.5" /><circle cx="16" cy="13.5" r="1.3" fill="currentColor" /></Svg>;
const ChevronGlyph = () => <Svg size={18}><path {...stroke} d="m9 6 6 6-6 6" /></Svg>;
const CopyGlyph = () => <Svg size={14}><rect {...stroke} x="8" y="8" width="12" height="12" rx="2.5" /><path {...stroke} d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></Svg>;
const CheckGlyph = () => <Svg size={14}><path {...stroke} d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
const MoreGlyph = () => <Svg size={20}><circle cx="12" cy="5.5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="18.5" r="1.7" fill="currentColor" /></Svg>;
const EyeGlyph = () => <Svg size={20}><path {...stroke} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle {...stroke} cx="12" cy="12" r="3" /></Svg>;
const EyeOffGlyph = () => <Svg size={20}><path {...stroke} d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.1 3.9M6.3 7.3A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Svg>;
const UsdcGlyph = () => (
  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#2775CA" /><path d="M24.6 22.6c0-2.4-1.5-3.3-4.4-3.6-2.1-.3-2.5-.9-2.5-1.8s.7-1.6 2.1-1.6c1.2 0 1.9.4 2.2 1.4.1.2.2.3.4.3h1.2c.3 0 .5-.2.5-.5-.3-1.5-1.5-2.6-3.1-2.8v-1.7c0-.3-.2-.5-.6-.5h-1.1c-.3 0-.5.2-.6.5v1.6c-2.1.3-3.4 1.7-3.4 3.4 0 2.3 1.4 3.2 4.3 3.5 1.9.3 2.6.8 2.6 1.9s-1 1.8-2.3 1.8c-1.8 0-2.4-.8-2.6-1.8 0-.3-.3-.4-.5-.4h-1.2c-.3 0-.5.2-.5.5.3 1.7 1.4 2.8 3.6 3.2v1.7c0 .3.2.5.6.5h1.1c.3 0 .5-.2.6-.5v-1.7c2.1-.3 3.5-1.8 3.5-3.6Z" fill="#fff" /><path d="M16.1 29.9c-5.5-2-8.3-8-6.3-13.4 1-2.9 3.4-5.2 6.3-6.3.3-.1.4-.3.4-.6v-1c0-.3-.1-.5-.4-.5h-.1a12.6 12.6 0 0 0 0 24c.3.1.5 0 .6-.3V31c0-.5-.2-.8-.5-1.1Zm7.9-22.3c-.3-.1-.5 0-.6.3V9c0 .3.2.6.5.7 5.5 2 8.3 8 6.3 13.4-1 2.9-3.4 5.2-6.3 6.3-.3.1-.4.3-.4.6v1c0 .3.1.5.4.5h.1a12.6 12.6 0 0 0 0-24Z" fill="#fff" /></svg>
);
const SolGlyph = () => (
  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
    <defs><linearGradient id="wl-sol" x1="8" y1="30" x2="32" y2="10" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" /></linearGradient></defs>
    <circle cx="20" cy="20" r="20" fill="#0c0c10" />
    <path fill="url(#wl-sol)" d="M13.3 24.4a.6.6 0 0 1 .4-.2h14.4c.3 0 .4.3.2.5l-2.6 2.7a.6.6 0 0 1-.4.1H10.9c-.3 0-.4-.3-.2-.5l2.6-2.6Zm0-11.3a.6.6 0 0 1 .4-.1h14.4c.3 0 .4.3.2.5l-2.6 2.6a.6.6 0 0 1-.4.2H10.9c-.3 0-.4-.3-.2-.5l2.6-2.7Zm13 5.6a.6.6 0 0 0-.4-.2H11.5c-.3 0-.4.4-.2.6l2.6 2.6c.1.1.3.2.4.2h14.4c.3 0 .4-.4.2-.6l-2.6-2.6Z" />
  </svg>
);
