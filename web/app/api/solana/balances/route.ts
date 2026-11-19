import { Connection, PublicKey } from '@solana/web3.js';
import { SOLANA_RPC, USDC_MINT } from '@/lib/solana-config';

/**
 * Public wallet balances, read server-side.
 *
 * Solana's public RPC answers 403 to any request carrying a browser Origin, so
 * the wallet page asks this route instead. It only reads public chain data for
 * the address given; nothing is stored. Set SOLANA_RPC_URL to a dedicated RPC
 * (Helius, Triton, QuickNode) for production traffic.
 */
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const connection = new Connection(process.env.SOLANA_RPC_URL || SOLANA_RPC, 'confirmed');

let price: { usd: number | null; expires: number } = { usd: null, expires: 0 };
async function solUsd() {
  if (price.expires > Date.now()) return price.usd;
  try {
    const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`, { signal: AbortSignal.timeout(4000) });
    const body = await response.json();
    const usd = Number(body?.[SOL_MINT]?.usdPrice);
    price = { usd: Number.isFinite(usd) && usd > 0 ? usd : null, expires: Date.now() + 60_000 };
  } catch {
    price = { usd: price.usd, expires: Date.now() + 15_000 };
  }
  return price.usd;
}

const recent = new Map<string, { at: number; body: unknown }>();

export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  let owner: PublicKey;
  try {
    owner = new PublicKey(new URL(req.url).searchParams.get('address') ?? '');
  } catch {
    return Response.json({ error: 'Enter a valid Solana address.' }, { status: 400, headers });
  }
  const key = owner.toBase58();
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < 8_000) return Response.json(hit.body, { headers });

  try {
    const [lamports, tokens, usd] = await Promise.all([
      connection.getBalance(owner, 'confirmed'),
      connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(USDC_MINT) }, 'confirmed'),
      solUsd(),
    ]);
    let usdcMicro = BigInt(0);
    for (const item of tokens.value) {
      const amount = item.account.data.parsed.info.tokenAmount;
      if (amount.decimals !== 6) throw Error('Unexpected USDC precision.');
      usdcMicro += BigInt(amount.amount);
    }
    if (usdcMicro > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Balance too large.');
    const body = { address: key, sol: lamports / 1e9, usdcMicro: Number(usdcMicro), solUsd: usd };
    recent.set(key, { at: Date.now(), body });
    if (recent.size > 500) recent.delete(recent.keys().next().value!);
    return Response.json(body, { headers });
  } catch {
    return Response.json({ error: 'Solana is busy right now. Try again in a moment.' }, { status: 502, headers });
  }
}
