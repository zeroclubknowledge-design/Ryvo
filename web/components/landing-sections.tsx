import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/collection-art";

/* Landing sections that explain money, wallets and Solana in plain words.
   Solana and Solflare are named and linked, never shown with their logos:
   Ryvo is built on Solana and recommends Solflare, but isn't affiliated. */

const SOLFLARE_DOWNLOAD = "https://solflare.com/download";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Glyph = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">{children}</svg>;
const glyphs = {
  dollar: <Glyph><circle {...stroke} cx="12" cy="12" r="9" /><path {...stroke} d="M14.5 9.2c-.4-1-1.4-1.6-2.5-1.6-1.5 0-2.6.8-2.6 2 0 2.8 5.3 1.4 5.3 4.4 0 1.2-1.2 2.1-2.7 2.1-1.2 0-2.3-.6-2.7-1.7M12 6v1.6M12 16.1v1.9" /></Glyph>,
  bolt: <Glyph><path {...stroke} d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></Glyph>,
  coin: <Glyph><ellipse {...stroke} cx="12" cy="7" rx="7" ry="3" /><path {...stroke} d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></Glyph>,
  key: <Glyph><circle {...stroke} cx="8" cy="15" r="4" /><path {...stroke} d="m11 12 8-8m-3 3 2 2m-4 0 1.5 1.5" /></Glyph>,
  wallet: <Glyph><path {...stroke} d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" /><rect {...stroke} x="4" y="8" width="16" height="11" rx="2.5" /><circle cx="16" cy="13.5" r="1.3" fill="currentColor" /></Glyph>,
};

/** Three quiet facts under the hero buttons. */
export function TrustRow() {
  return (
    <ul className="lx-trust" aria-label="Why Ryvo">
      <li><i className="lx-sol-dot" aria-hidden="true" />Built on Solana</li>
      <li>Pay in USDC — digital dollars</li>
      <li>Entries from $5</li>
    </ul>
  );
}

/** Four numbers a first-time visitor wants before anything else. */
export function AtAGlance() {
  const facts = [
    ["$5–$20", "to enter a challenge"],
    ["1,000 r/", "RYVO Credit for every $1"],
    ["1 month", "to complete your board"],
    ["< 1¢", "network fee per payment"],
  ];
  return (
    <section className="lx-glance" aria-label="Ryvo at a glance">
      {facts.map(([value, label]) => (
        <div key={label}><b>{value}</b><span>{label}</span></div>
      ))}
    </section>
  );
}

export function SolanaSection() {
  const points = [
    { glyph: glyphs.dollar, title: "Pay in digital dollars", text: "Entries and prizes use USDC. 1 USDC is always worth $1 — no price swings to worry about." },
    { glyph: glyphs.bolt, title: "Done in seconds", text: "Payments confirm on Solana in a few seconds, any time of day. No bank queues, no waiting." },
    { glyph: glyphs.coin, title: "Fees under a cent", text: "Each payment costs a fraction of a cent in network fees, paid in a tiny amount of SOL." },
    { glyph: glyphs.key, title: "Your wallet, your money", text: "You approve every payment in your own wallet. Ryvo never sees your keys or recovery phrase." },
  ];
  return (
    <section className="lx-section lx-solana" id="solana" aria-labelledby="lx-solana-title">
      <div className="lx-solana-copy">
        <p className="lx-kicker"><i className="lx-sol-dot" aria-hidden="true" />POWERED BY SOLANA</p>
        <h2 id="lx-solana-title">REAL MONEY.<br />REAL FAST. YOURS.</h2>
        <p className="lx-lede">Ryvo runs on Solana, a fast public network for payments. You play with dollars you hold in your own wallet — and every payment is recorded publicly, so anyone can check it.</p>
        <div className="lx-points">
          {points.map((p) => (
            <article key={p.title}>
              <span className="lx-point-icon">{p.glyph}</span>
              <div><h3>{p.title}</h3><p>{p.text}</p></div>
            </article>
          ))}
        </div>
      </div>
      <WalletCard />
    </section>
  );
}

/** Recommends Solflare with its official download page, plus three set-up steps. */
function WalletCard() {
  return (
    <aside className="lx-wallet" aria-labelledby="lx-wallet-title">
      <div className="lx-wallet-head">
        <span className="lx-wallet-icon">{glyphs.wallet}</span>
        <div>
          <p className="lx-kicker">RECOMMENDED WALLET</p>
          <h3 id="lx-wallet-title">Solflare</h3>
        </div>
      </div>
      <p className="lx-wallet-copy">A free Solana wallet for your phone or browser. It holds your USDC and connects to Ryvo in one tap.</p>
      <ol className="lx-wallet-steps">
        <li><b>Install Solflare</b><span>On iPhone, Android or as a browser extension.</span></li>
        <li><b>Add USDC</b><span>Buy it in the app with a card, or receive it from another wallet. Keep a little SOL for fees.</span></li>
        <li><b>Connect to Ryvo</b><span>Open Ryvo, tap Connect and approve in Solflare.</span></li>
      </ol>
      <a className="lx-wallet-cta" href={SOLFLARE_DOWNLOAD} target="_blank" rel="noopener noreferrer">
        Get Solflare <span aria-hidden="true">↗</span>
      </a>
      <small>Opens solflare.com. Phantom and Backpack work too.</small>
    </aside>
  );
}

export function StartSteps() {
  const steps = [
    ["01", "Get a wallet", "Install Solflare and add a few dollars of USDC. It takes about two minutes."],
    ["02", "Pick a challenge", "Choose an artwork and pay its $5, $10 or $20 entry. You get RYVO Credit straight away — 1,000 r/ for every $1."],
    ["03", "Collect and trade", "When every place fills, the race begins. Draw random pieces with your credit and swap extras with other players."],
    ["04", "Finish first, win", "Complete your board within the month to claim a winner slot and a share of the prize pool."],
  ];
  return (
    <section className="lx-section lx-steps" id="how-to-start" aria-labelledby="lx-steps-title">
      <div className="ryvo-section-title">
        <h2 id="lx-steps-title">FOUR STEPS.<br />ONE COMPLETE BOARD.</h2>
        <p>No experience with crypto needed. If you can use a payment app, you can play Ryvo.</p>
      </div>
      <ol className="lx-step-list">
        {steps.map(([n, title, text]) => (
          <li key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></li>
        ))}
      </ol>
      <div className="lx-steps-cta">
        <Link className="primary" href="/explore">Find a challenge <Icon name="arrow" size={18} /></Link>
        <a className="lx-ghost" href={SOLFLARE_DOWNLOAD} target="_blank" rel="noopener noreferrer">Get Solflare ↗</a>
      </div>
    </section>
  );
}

export function LandingFaq() {
  const faqs: [string, ReactNode][] = [
    ["Do I need to know crypto?", "No. You need a wallet app like Solflare with some USDC in it. Ryvo shows every amount in dollars, and your wallet asks you to approve each payment."],
    ["What is USDC?", "A digital dollar. 1 USDC is designed to always equal $1, so your entry and your winnings don’t rise or fall in value."],
    ["What is RYVO Credit?", "The in-game credit you use to draw pieces and buy from other players. Every entry gives you 1,000 r/ for each $1 you pay. It stays inside Ryvo."],
    ["How do I win, and how much?", "Be among the first players to complete the board within the month. Each competition’s prize pool is 20% of its entries, shared across its winner slots — you can see the exact pool on every challenge before you join."],
    ["How are prizes paid?", "Prize shares and sale proceeds are recorded in your Ryvo earnings in USDC. Withdrawals straight to your connected wallet are opening soon."],
    ["What does it cost to create a challenge?", "A one-off launch fee set by the size of your game — from about $1 for a small one. You earn 10% of every entry."],
    ["Is my money safe?", "You keep your own wallet and approve every payment yourself. Ryvo never asks for your recovery phrase — anyone who does is a scammer."],
  ];
  return (
    <section className="lx-section lx-faq" id="faq" aria-labelledby="lx-faq-title">
      <div className="ryvo-section-title"><h2 id="lx-faq-title">GOOD<br />QUESTIONS.</h2></div>
      <div className="lx-faq-list">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}<span aria-hidden="true" /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
