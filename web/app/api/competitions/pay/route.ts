import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { requestUser, serviceClient } from '@/lib/server/solana';
import { SOLANA_RPC, TREASURY_ADDRESS, USDC_MINT } from '@/lib/solana-config';

/**
 * USDC payments for launching and joining competitions.
 *
 * prepare: the database validates the launch or entry and opens a 15-minute
 *   payment; the server builds the USDC transfer to Ryvo's treasury with a
 *   one-off reference key, and the wallet only signs it.
 * submit: the signed transaction must match what was built exactly; the server
 *   sends it, waits for confirmation, then records the launch or entry.
 * check: recovers a payment whose confirmation was missed, by its reference.
 */
const connection = new Connection(process.env.SOLANA_RPC_URL || SOLANA_RPC, 'confirmed');
const mint = new PublicKey(USDC_MINT);
const treasury = new PublicKey(process.env.SOLANA_TREASURY_ADDRESS || TREASURY_ADDRESS);
const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);
const headers = { 'Cache-Control': 'no-store' };
const fail = (message: string, status = 400) => Response.json({ error: message }, { status, headers });

type Payment = { id: string; user_id: string; amount_micro: number; reference: string; status: string; competition_id: string; kind: string };

function paymentInstructions(payer: PublicKey, amount: bigint, reference: PublicKey): TransactionInstruction[] {
  const transfer = createTransferCheckedInstruction(getAssociatedTokenAddressSync(mint, payer), mint, treasuryAta, payer, amount, 6);
  transfer.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  return [createAssociatedTokenAccountIdempotentInstruction(payer, treasuryAta, treasury, mint), transfer];
}

const sameInstruction = (a: TransactionInstruction, b: TransactionInstruction) =>
  a.programId.equals(b.programId) && Buffer.from(a.data).equals(Buffer.from(b.data)) && a.keys.length === b.keys.length &&
  a.keys.every((k, i) => k.pubkey.equals(b.keys[i].pubkey) && k.isSigner === b.keys[i].isSigner && k.isWritable === b.keys[i].isWritable);

async function loadPayment(id: unknown, userId: string) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw Error('Invalid payment.');
  const { data, error } = await serviceClient().from('ryvo_competition_payments').select('id,user_id,amount_micro,reference,status,competition_id,kind').eq('id', id).maybeSingle();
  if (error || !data || data.user_id !== userId) throw Error('Payment not found.');
  return data as Payment;
}

async function settle(payment: Payment, signature: string, payer: string) {
  const { data, error } = await serviceClient().rpc('ryvo_settle_competition_payment', { payment: payment.id, sig: signature, payer_wallet: payer });
  if (error) throw Error(error.message);
  return data as { status: string; competitionId: string; credits?: number };
}

/** Confirms a landed transfer of the exact amount to the treasury that carries this payment's reference. */
async function verifyOnChain(signature: string, payment: Payment) {
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx || tx.meta?.err) return null;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  if (!keys.includes(payment.reference)) return null;
  for (const ix of tx.transaction.message.instructions) {
    if (!('parsed' in ix) || ix.program !== 'spl-token' || ix.parsed?.type !== 'transferChecked') continue;
    const info = ix.parsed.info;
    if (info.destination === treasuryAta.toBase58() && info.mint === mint.toBase58() && info.tokenAmount?.amount === String(payment.amount_micro)) {
      return info.authority as string;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 20000) return fail('Request too large.', 413);
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return fail('Invalid origin.', 403);
    const { user } = await requestUser(req);
    const body = await req.json();

    if (body.action === 'prepare') {
      if (!['launch', 'entry'].includes(body.kind)) return fail('Invalid payment.');
      let payer: PublicKey;
      try { payer = new PublicKey(body.wallet); } catch { return fail('Connect a Solana wallet first.'); }
      const reference = Keypair.generate().publicKey;
      const { data, error } = await serviceClient().rpc('ryvo_prepare_competition_payment', {
        actor: user.id, pay_kind: body.kind, competition: String(body.competitionId ?? ''),
        launch_draft: body.kind === 'launch' ? body.draft : null, ref: reference.toBase58(),
      });
      if (error) return fail(error.code === 'PGRST202' ? 'The competition payments database update has not been applied yet.' : error.message);
      const amount = BigInt((data as { amountMicro: number }).amountMicro);
      // Never ask the wallet for a different amount than the screen showed.
      if (body.expectedMicro != null && String(body.expectedMicro) !== amount.toString()) {
        await serviceClient().from('ryvo_competition_payments').update({ status: 'expired' }).eq('id', (data as { id: string }).id);
        return fail(`The price changed to ${(Number(amount) / 1e6).toFixed(2)} USDC. Refresh the page and review it before paying.`);
      }

      const [lamports, usdc] = await Promise.all([
        connection.getBalance(payer, 'confirmed'),
        connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, payer), 'confirmed').then((b) => BigInt(b.value.amount)).catch(() => BigInt(0)),
      ]);
      if (usdc < amount) return fail(`This wallet needs ${(Number(amount) / 1e6).toFixed(2)} USDC. It has ${(Number(usdc) / 1e6).toFixed(2)} USDC.`);
      if (lamports < 3_000_000) return fail('Add a little SOL (about 0.003) to this wallet to cover the network fee.');

      const block = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: payer, blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight }).add(...paymentInstructions(payer, amount, reference));
      return Response.json({
        payment: data,
        transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
        lastValidBlockHeight: block.lastValidBlockHeight,
      }, { headers });
    }

    if (body.action === 'submit') {
      const payment = await loadPayment(body.paymentId, user.id);
      if (payment.status !== 'pending') return Response.json({ status: payment.status, competitionId: payment.competition_id }, { headers });
      const tx = Transaction.from(Buffer.from(String(body.transaction ?? ''), 'base64'));
      const payer = tx.feePayer;
      if (!payer || !tx.recentBlockhash) return fail('Invalid transaction.');
      const expected = paymentInstructions(payer, BigInt(payment.amount_micro), new PublicKey(payment.reference));
      if (tx.instructions.length !== expected.length || !tx.instructions.every((ix, i) => sameInstruction(ix, expected[i]))) return fail('This transaction does not match your Ryvo payment.');
      if (!tx.verifySignatures()) return fail('The wallet signature is missing or invalid.');
      const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
      const confirmed = await connection.confirmTransaction({ signature, blockhash: tx.recentBlockhash, lastValidBlockHeight: Number(body.lastValidBlockHeight) || 0 }, 'confirmed');
      if (confirmed.value.err) return fail('Solana rejected the payment. No USDC was taken.');
      const result = await settle(payment, signature, payer.toBase58());
      return Response.json({ ...result, signature }, { headers });
    }

    if (body.action === 'check') {
      const payment = await loadPayment(body.paymentId, user.id);
      if (payment.status !== 'pending') return Response.json({ status: payment.status, competitionId: payment.competition_id }, { headers });
      const signatures = await connection.getSignaturesForAddress(new PublicKey(payment.reference), { limit: 10 }, 'confirmed');
      for (const item of signatures) {
        if (item.err) continue;
        const payer = await verifyOnChain(item.signature, payment);
        if (payer) return Response.json({ ...(await settle(payment, item.signature, payer)), signature: item.signature }, { headers });
      }
      return Response.json({ status: 'pending', competitionId: payment.competition_id }, { headers });
    }

    return fail('Invalid request.');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment failed.';
    const known = /Sign in|not configured|Payment not found|Invalid/.test(message);
    return fail(known ? message : 'The payment could not be completed. If USDC left your wallet, it will be recorded automatically — check again shortly.', known ? 400 : 502);
  }
}
