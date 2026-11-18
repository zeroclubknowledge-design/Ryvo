import type { User } from "@supabase/supabase-js";
import type { Competition, DemoState } from "@/lib/demo";
import { supabase } from "@/lib/supabase";

// Never migrate browser-owned balances or progress into a real account.
export function emptyWallet(user?: User | null): DemoState {
  return { version: 2, walletVersion: 1, ownerId: user?.id, balance: 0, cash: 0,
    earnings: 0, universal: 0, boards: {}, ledger: [], purchases: [],
    tokenProgram: { distributed: 0, awards: [] } };
}
export async function loadLiveData(user: User | null) {
  const db = supabase();
  const [catalog, wallet, ledger, boards, programme, players] = await Promise.all([
    db.from("competitions").select("definition").eq("published", true),
    user ? db.from("wallets").select("credits,earnings,universal,tokens,member_number").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    user ? db.from("wallet_entries").select("id,label,amount,currency,date").eq("user_id", user.id).order("date", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    user ? db.from("player_boards").select("competition_id,pieces").eq("user_id", user.id) : Promise.resolve({ data: [], error: null }),
    db.from("token_program").select("distributed").eq("id", 1).maybeSingle(),
    // Total platform players drives the population referral programme. A failed
    // count must never block the wallet, so it degrades to the first tier.
    db.from("wallets").select("user_id", { count: "exact", head: true }),
  ]);
  if ([catalog, wallet, ledger, boards, programme].some(result => result.error)) {
    throw new Error("We couldn’t load the latest game data. Please try again shortly.");
  }
  const state = emptyWallet(user);
  state.memberNumber = wallet.data?.member_number ? Number(wallet.data.member_number) : undefined;
  state.balance = Number(wallet.data?.credits ?? 0);
  state.earnings = Number(wallet.data?.earnings ?? 0);
  state.universal = Number(wallet.data?.universal ?? 0);
  state.ledger = ledger.data ?? [];
  state.boards = Object.fromEntries((boards.data ?? []).map(row => [row.competition_id, row.pieces]));
  state.tokenProgram = { distributed: Number(programme.data?.distributed ?? 0), awards: [] };
  state.platformPlayers = players.count ?? 0;
  return { state, competitions: (catalog.data ?? []).map(row => row.definition as Competition), tokens: Number(wallet.data?.tokens ?? 0) };
}
