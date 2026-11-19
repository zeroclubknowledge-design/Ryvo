"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/collection-art";
import { WalletConnectOptions } from "@/components/wallet-page";
import { payCompetition, stageLabel, type PayStage } from "@/lib/competition-pay";
import { money, type Competition } from "@/lib/demo";
import { shortAddress } from "@/lib/solana-config";

type Props = { competition: Competition; user: User | null; joined: boolean; onJoined: () => void };

export function JoinCompetition(props: Props) {
  return (
<JoinPanel {...props} />
  );
}

function JoinPanel({ competition: c, user, joined, onJoined }: Props) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [stage, setStage] = useState<PayStage | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"joined" | "refund" | null>(null);
  const placesLeft = Math.max(0, c.capacity - c.joined);
  const credits = c.fee * 10;

  async function join() {
    if (!publicKey || !signTransaction) return;
    setError("");
    try {
      const paid = await payCompetition({ kind: "entry", competitionId: c.id }, { publicKey, signTransaction }, setStage);
      if (paid.status === "paid") { setResult("joined"); onJoined(); }
      else if (paid.status === "refund_due") setResult("refund");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Joining failed. No USDC was taken.");
    } finally {
      setStage(null);
    }
  }

  const head = (
    <div className="jc-head">
      <div><span className="jc-eyebrow">Entry</span><strong>{money(c.fee)}</strong><span className="jc-sub">You get {credits.toLocaleString()} r/ to collect pieces</span></div>
      <div className="jc-places"><b>{placesLeft.toLocaleString()}</b><span>{placesLeft === 1 ? "place left" : "places left"}</span></div>
    </div>
  );
  const meter = <div className="jc-meter" role="progressbar" aria-label="Places filled" aria-valuemin={0} aria-valuemax={c.capacity} aria-valuenow={c.joined}><i style={{ width: `${Math.min(100, (c.joined / Math.max(1, c.capacity)) * 100)}%` }} /></div>;

  if (joined || result === "joined") {
    return (
      <section className="jc is-in" aria-live="polite">
        <span className="jc-badge"><Icon name="check" size={16} /> You’re in</span>
        <h2>Your board is ready.</h2>
        <p>{result === "joined" ? `${credits.toLocaleString()} r/ was added to your RYVO Credit. ` : ""}{c.status === "open" ? "Draws unlock when every place is filled." : "The round is live. Start collecting."}</p>
        <Link className="primary" href={`/board/${c.id}`}>Open your board <Icon name="arrow" /></Link>
      </section>
    );
  }
  if (result === "refund") {
    return (
      <section className="jc" role="status">
        <h2>This competition filled first.</h2>
        <p>Your USDC arrived after the last place was taken. It’s recorded for a refund to your wallet.</p>
      </section>
    );
  }
  if (c.status !== "open" || placesLeft === 0) {
    return (
      <section className="jc">
        {head}{meter}
        <p className="jc-closed">{c.status === "active" ? "Registration is closed — this round is live." : "Registration is closed."}</p>
        <Link className="lc-ghost" href="/explore">Find another challenge</Link>
      </section>
    );
  }
  if (!user) {
    return (
      <section className="jc">
        {head}{meter}
        <Link className="primary jc-cta" href={`/signin?next=/collection/${c.id}`}>Sign in to join <Icon name="arrow" /></Link>
      </section>
    );
  }
  return (
    <section className="jc" aria-labelledby="jc-title">
      <h2 id="jc-title" className="jc-sr">Join {c.title}</h2>
      {head}{meter}
      {connected && publicKey ? (
        <>
          <p className="jc-wallet"><span className="lc-dot" aria-hidden="true" />Paying {money(c.fee)} USDC from {shortAddress(publicKey.toBase58())}</p>
          <button className="primary jc-cta" onClick={() => void join()} disabled={!!stage || !signTransaction}>
            {stage ? stageLabel(stage) : <>Pay {money(c.fee)} & join <Icon name="arrow" /></>}
          </button>
        </>
      ) : (
        <div className="jc-connect">
          <p>Connect the Solana wallet you’ll pay from.</p>
          <WalletConnectOptions />
        </div>
      )}
      {error && <p className="lc-error" role="alert">{error}</p>}
      <p className="jc-fine">Paid in USDC on Solana to Ryvo. A small SOL network fee applies.</p>
    </section>
  );
}
