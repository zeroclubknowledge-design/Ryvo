"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { Icon } from "@/components/collection-art";
import { SolanaProvider, useSolanaBalances } from "@/components/solana-provider";
import { loadCashout } from "@/lib/cashout";
import { credit, money, type DemoState } from "@/lib/demo";
import { SOLANA_NETWORK, USDC_SCALE, shortAddress } from "@/lib/solana-config";

type Activity = DemoState["ledger"][number];

/** Solana Mobile's adapter opens whichever wallet app is installed on the phone. */
const walletLabel = (name: string) => (name === "Mobile Wallet Adapter" ? "Wallet app on this phone" : name);

const noop = () => () => {};
/** Wallets are only discoverable in the browser, so render the list after hydration. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

const dollars = (micro: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(micro / USDC_SCALE);

export function WalletPage(props: { creditBalance: string; activity: Activity[]; signedIn: boolean; tokenCard?: ReactNode }) {
  return (
    <SolanaProvider>
      <WalletScreen {...props} />
    </SolanaProvider>
  );
}

function WalletScreen({ creditBalance, activity, signedIn, tokenCard }: { creditBalance: string; activity: Activity[]; signedIn: boolean; tokenCard?: ReactNode }) {
  const { connected } = useWallet();
  const connectRef = useRef<HTMLElement>(null);
  const earnings = useEarnings(signedIn);
  // Cash entries are stored in legacy naira units; money() shows them in dollars.
  const rows = activity;

  const focusConnect = () => {
    connectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    connectRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };

  return (
    <div className="wallet-hub">
      <ConnectPanel ref={connectRef} />

      <div className="ryvo-wallet-grid">
        <section className="ryvo-wallet-card wallet-credit">
          <span>Your RYVO Credit</span>
          <strong>{creditBalance}<small>r/</small></strong>
          <p>Collect what moves you.</p>
          <div className="ryvo-wallet-actions">
            {connected ? (
              <button disabled title="USDC funding opens with on-chain checkout"><Icon name="spark" />Fund</button>
            ) : (
              <button onClick={focusConnect}><Icon name="spark" />Fund</button>
            )}
            <button disabled title="Swaps open with on-chain checkout"><Icon name="arrow" />Swap</button>
            <Link href="/wallet/p2p"><Icon name="wallet" />P2P</Link>
          </div>
          {!connected && <small className="wallet-card-hint">Connect a wallet to fund with USDC.</small>}
        </section>

        <section className="ryvo-wallet-card wallet-earnings">
          <span>Available to withdraw</span>
          <strong>{earnings.available === null ? "—" : dollars(earnings.available)}</strong>
          <p>
            {earnings.message ??
              (earnings.reserved ? `${dollars(earnings.reserved)} held in escrow. ` : "") + "Paid in USDC to your connected wallet. 1 USDC = $1."}
          </p>
          <button className="secondary" disabled>
            {connected ? "Withdrawals open soon" : "Connect a wallet to withdraw"} <Icon name="arrow" />
          </button>
        </section>
      </div>

      {tokenCard}

      <section className="wallet-activity-section">
        <h2>Wallet activity<span className="lime-dot" /></h2>
        {rows.length ? (
          <div className="ledger">
            {rows.map((entry) => (
              <div key={entry.id}>
                <Icon name="wallet" />
                <p><b>{entry.label}</b><small>{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small></p>
                <strong>{entry.amount < 0 ? "−" : "+"}{entry.currency === "NGN" ? money(Math.abs(entry.amount)) : credit(Math.abs(entry.amount))}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="live-empty-copy">Your transactions will appear here.</p>
        )}
      </section>
    </div>
  );
}

/** USDC earnings from the cash-out ledger; dollars are USDC at 1:1. */
function useEarnings(signedIn: boolean) {
  const [state, setState] = useState<{ available: number | null; reserved: number; message: string | null }>({
    available: null,
    reserved: 0,
    message: signedIn ? "Loading your earnings…" : "Sign in to see your earnings.",
  });
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    loadCashout()
      .then((workspace) => {
        if (active) setState({ available: workspace.earnings.available_micro, reserved: workspace.earnings.reserved_micro, message: null });
      })
      .catch(() => {
        if (active) setState({ available: null, reserved: 0, message: "Earnings are unavailable right now. Refresh to try again." });
      });
    return () => { active = false; };
  }, [signedIn]);
  return state;
}

function ConnectPanel({ ref }: { ref: React.Ref<HTMLElement> }) {
  const { wallets, wallet, select, connect, disconnect, connected, connecting, publicKey } = useWallet();
  const { balances, error, refresh } = useSolanaBalances();
  const [requested, setRequested] = useState(false);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);

  // select() only picks the adapter; connect once React has applied it.
  useEffect(() => {
    if (!requested || !wallet) return;
    let active = true;
    connect()
      .catch((e: unknown) => { if (active) setProblem(e instanceof Error && e.message ? e.message : "The wallet declined the connection."); })
      .finally(() => { if (active) setRequested(false); });
    return () => { active = false; };
  }, [requested, wallet, connect]);

  const hydrated = useHydrated();
  const detected = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  const choose = (name: WalletName) => { setProblem(""); select(name); setRequested(true); };
  const copy = async () => {
    if (!publicKey) return;
    try { await navigator.clipboard.writeText(publicKey.toBase58()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  const network = SOLANA_NETWORK === "devnet" ? "Solana Devnet" : "Solana";

  return (
    <section ref={ref} className={`wallet-connect-panel${connected ? " is-connected" : ""}`} aria-labelledby="wallet-connect-title" id="connect-wallet">
      <div className="wallet-connect-head">
        <Image src="/ryvo-logo.png" alt="" width={34} height={34} />
        <span className="wallet-network"><i aria-hidden="true" />{network}</span>
      </div>

      {connected && publicKey ? (
        <>
          <h2 id="wallet-connect-title">Wallet connected.</h2>
          <div className="wallet-identity">
            {wallet?.adapter.icon && (
              // Wallet icons are data URIs supplied by the wallet itself.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wallet.adapter.icon} alt="" width={40} height={40} />
            )}
            <div>
              <b>{wallet ? walletLabel(wallet.adapter.name) : "Solana wallet"}</b>
              <span>{shortAddress(publicKey.toBase58())}</span>
            </div>
            <button className="wallet-chip" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy address"}</button>
          </div>
          <div className="wallet-balances">
            <div><span>USDC</span><strong>{balances ? dollars(balances.usdcMicro) : "—"}</strong></div>
            <div><span>SOL</span><strong>{balances ? balances.sol.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}</strong></div>
          </div>
          {error && <p className="wallet-connect-error" role="alert">{error} <button className="wallet-link" onClick={refresh}>Retry</button></p>}
          <button className="wallet-link wallet-disconnect" onClick={() => void disconnect()}>Disconnect wallet</button>
        </>
      ) : (
        <>
          <h2 id="wallet-connect-title">Connect your wallet.</h2>
          <p className="wallet-connect-copy">Link a Solana wallet to hold USDC, fund your RYVO Credit and receive withdrawals. Connecting never moves funds.</p>
          {!hydrated ? (
            <div className="wallet-options" aria-hidden="true"><div className="wallet-option wallet-option-placeholder" /></div>
          ) : detected.length ? (
            <div className="wallet-options" role="list">
              {detected.map((item) => {
                const busy = (connecting || requested) && wallet?.adapter.name === item.adapter.name;
                return (
                  <button key={item.adapter.name} role="listitem" className="wallet-option" disabled={connecting || requested} onClick={() => choose(item.adapter.name)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.adapter.icon} alt="" width={32} height={32} />
                    <b>{walletLabel(item.adapter.name)}</b>
                    <span>{busy ? "Check your wallet…" : "Connect"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="wallet-empty">
              <b>No Solana wallet found in this browser.</b>
              <p>On your phone, open Ryvo inside your wallet app’s browser. On desktop, install a wallet extension and refresh.</p>
              <div>
                <a className="wallet-chip" href="https://phantom.com/download" target="_blank" rel="noreferrer">Get Phantom ↗</a>
                <a className="wallet-chip" href="https://solflare.com/download" target="_blank" rel="noreferrer">Get Solflare ↗</a>
              </div>
            </div>
          )}
          {problem && <p className="wallet-connect-error" role="alert">{problem}</p>}
        </>
      )}
    </section>
  );
}
