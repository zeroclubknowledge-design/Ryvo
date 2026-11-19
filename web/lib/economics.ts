/**
 * Where every entry goes. Mirrors the database (migration 202611190007:
 * ryvo_winner_share and the split recorded in ryvo_entry_splits).
 *
 *   Winners   10–40%, set by the winner ratio (winner slots ÷ players):
 *             10% + 30% × √(min(ratio, 50%) ÷ 50%), to one decimal.
 *   Creator   10%
 *   Ryvo      50%  — referral rewards are paid from this half
 *   Token launch pool  the rest: 40% − the winners' share
 */
export const CREATOR_PERCENT = 10;
export const RYVO_PERCENT = 50;

export function winnerSharePercent(players: number, winners: number) {
  const ratio = Math.min(Math.max(winners, 0) / Math.max(players, 1), 0.5);
  return Math.round((10 + 30 * Math.sqrt(ratio / 0.5)) * 10) / 10;
}

export function entrySplit(players: number, winners: number) {
  const winnersPct = winnerSharePercent(players, winners);
  return {
    winners: winnersPct,
    creator: CREATOR_PERCENT,
    ryvo: RYVO_PERCENT,
    pool: Math.round((100 - winnersPct - CREATOR_PERCENT - RYVO_PERCENT) * 10) / 10,
  };
}

/** Referral rewards are a percentage of Ryvo's 50% share. */
export const referralShareOfEntry = (referralRate: number) => (RYVO_PERCENT * referralRate) / 100;
