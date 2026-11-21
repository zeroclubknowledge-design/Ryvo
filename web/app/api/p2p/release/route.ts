import { Connection, Keypair, PublicKey, SystemProgram, Transaction, type TransactionInstruction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { requestUser, serviceClient } from '@/lib/server/solana';
import { SOLANA_RPC, USDC_MINT } from '@/lib/solana-config';

/**
 * Merchant releases a paid P2P order from their own wallet.
 * prepare: the database confirms the order is paid and belongs to this
 *   merchant, and stores a one-off reference; the server builds the exact
 *   USDC or SOL transfer to the buyer's wallet. The merchant's wallet signs.
 * submit: the signed transaction must match exactly; the server sends it,
 *   confirms it on Solana, then marks the order released.
 */
const connection = new Connection(process.env.SOLANA_RPC_URL || SOLANA_RPC, 'confirmed');
const mint = new PublicKey(USDC_MINT);
const headers = { 'Cache-Control': 'no-store' };
const fail = (message: string, status = 400) => Response.json({ error: message }, { status, headers });

type Release = { asset: 'USDC' | 'SOL'; units: number; buyerWallet: string };

function instructions(asset: Release['asset'], from: PublicKey, to: PublicKey, units: bigint, reference: PublicKey): TransactionInstruction[] {
  if (asset === 'SOL') {
    const transfer = SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: units });
    transfer.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
    return [transfer];
  }
  const toAta = getAssociatedTokenAddressSync(mint, to, true);
  const transfer = createTransferCheckedInstruction(getAssociatedTokenAddressSync(mint, from), mint, toAta, from, units, 6);
  transfer.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  return [createAssociatedTokenAccountIdempotentInstruction(from, toAta, to, mint), transfer];
}

const same = (a: TransactionInstruction, b: TransactionInstruction) =>
  a.programId.equals(b.programId) && Buffer.from(a.data).equals(Buffer.from(b.data)) && a.keys.length === b.keys.length &&
  a.keys.every((k, i) => k.pubkey.equals(b.keys[i].pubkey) && k.isSigner === b.keys[i].isSigner && k.isWritable === b.keys[i].isWritable);

export async function POST(req: Request) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 20000) return fail('Request too large.', 413);
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return fail('Invalid origin.', 403);
    const { user } = await requestUser(req);
    const body = await req.json();
    if (typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.orderId)) return fail('Invalid order.');

    if (body.action === 'prepare') {
      let merchantWallet: PublicKey;
      try { merchantWallet = new PublicKey(body.wallet); } catch { return fail('Connect the wallet you are releasing from.'); }
      const reference = Keypair.generate().publicKey;
      const { data, error } = await serviceClient().rpc('ryvo_p2p_release_ref', { order_id: body.orderId, merchant: user.id, ref: reference.toBase58() });
      if (error) return fail(error.code === 'PGRST202' ? 'The P2P database update has not been applied yet.' : error.message);
      const order = data as Release;
      const units = BigInt(order.units);
      const buyer = new PublicKey(order.buyerWallet);
      if (order.asset === 'USDC') {
        const balance = await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, merchantWallet), 'confirmed').then((b) => BigInt(b.value.amount)).catch(() => BigInt(0));
        if (balance < units) return fail(`This wallet has ${(Number(balance) / 1e6).toFixed(2)} USDC; the order needs ${(Number(units) / 1e6).toFixed(2)}.`);
      }
      const lamports = BigInt(await connection.getBalance(merchantWallet, 'confirmed'));
      const needed = (order.asset === 'SOL' ? units : BigInt(0)) + BigInt(3_000_000);
      if (lamports < needed) return fail('This wallet needs more SOL to cover the release and the network fee.');
      const block = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: merchantWallet, blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight })
        .add(...instructions(order.asset, merchantWallet, buyer, units, reference));
      return Response.json({ transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), lastValidBlockHeight: block.lastValidBlockHeight }, { headers });
    }

    if (body.action === 'submit') {
      const { data: order, error } = await serviceClient().from('ryvo_p2p_orders').select('merchant_id,asset,units,buyer_wallet,reference,status').eq('id', body.orderId).maybeSingle();
      if (error || !order || order.merchant_id !== user.id) return fail('Order not found.');
      if (order.status === 'released') return Response.json({ status: 'released' }, { headers });
      if (!order.reference) return fail('Prepare the release again.');
      const tx = Transaction.from(Buffer.from(String(body.transaction ?? ''), 'base64'));
      const from = tx.feePayer;
      if (!from || !tx.recentBlockhash) return fail('Invalid transaction.');
      const expected = instructions(order.asset, from, new PublicKey(order.buyer_wallet), BigInt(order.units), new PublicKey(order.reference));
      if (tx.instructions.length !== expected.length || !tx.instructions.every((ix, i) => same(ix, expected[i]))) return fail('This transaction does not match the order.');
      if (!tx.verifySignatures()) return fail('The wallet signature is missing or invalid.');
      const signature = await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed' });
      const confirmed = await connection.confirmTransaction({ signature, blockhash: tx.recentBlockhash, lastValidBlockHeight: Number(body.lastValidBlockHeight) || 0 }, 'confirmed');
      if (confirmed.value.err) return fail('Solana rejected the transfer. Nothing was sent.');
      const marked = await serviceClient().rpc('ryvo_p2p_mark_released', { order_id: body.orderId, sig: signature, wallet: from.toBase58() });
      if (marked.error) return fail(marked.error.message);
      return Response.json({ status: 'released', signature }, { headers });
    }
    return fail('Invalid request.');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Release failed.';
    const known = /Sign in|not configured|Invalid/.test(message);
    return fail(known ? message : 'The release could not be completed. If it went through on Solana, refresh in a moment.', known ? 400 : 502);
  }
}
