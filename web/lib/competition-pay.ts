import { Transaction, type PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { supabase } from "@/lib/supabase";

export type PayStage = "preparing" | "signing" | "confirming";
export type PayResult = { status: string; competitionId: string; credits?: number; signature?: string };
export type LaunchDraft = {
  title: string; description: string; artist: string; fee: number; capacity: number; winners: number;
  creatorShare: 5 | 10; total: number; artworkPath: string; coverPath: string;
};

async function post(body: Record<string, unknown>) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw Error("Sign in to continue.");
  const response = await fetch("/api/competitions/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(Error(result.error || "The payment could not be completed."), { status: response.status });
  return result;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Launch or join with USDC: the server builds the transfer, the wallet signs
 * it, the server sends, confirms and records it. If confirmation is missed
 * the payment is looked up on-chain by its reference before giving up.
 */
export async function payCompetition(
  input: { kind: "launch" | "entry"; competitionId: string; draft?: LaunchDraft; expectedMicro: number },
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  onStage: (stage: PayStage) => void,
): Promise<PayResult> {
  onStage("preparing");
  const prepared = await post({ action: "prepare", ...input, wallet: wallet.publicKey.toBase58() });
  onStage("signing");
  const signed = await wallet.signTransaction(Transaction.from(Buffer.from(prepared.transaction, "base64")));
  onStage("confirming");
  const paymentId = prepared.payment.id as string;
  try {
    return await post({ action: "submit", paymentId, transaction: Buffer.from(signed.serialize()).toString("base64"), lastValidBlockHeight: prepared.lastValidBlockHeight });
  } catch (error) {
    // A 400 means the payment was refused before it was sent; anything else may have landed.
    if ((error as { status?: number }).status === 400) throw error;
    for (let attempt = 0; attempt < 6; attempt++) {
      await pause(5000);
      const checked = await post({ action: "check", paymentId }).catch(() => null);
      if (checked && checked.status !== "pending") return checked;
    }
    throw Error("Your payment is still confirming on Solana. It will be recorded automatically — check back in a minute.");
  }
}

export const stageLabel = (stage: PayStage | null) =>
  stage === "preparing" ? "Preparing payment…" : stage === "signing" ? "Approve in your wallet…" : stage === "confirming" ? "Confirming on Solana…" : "";
