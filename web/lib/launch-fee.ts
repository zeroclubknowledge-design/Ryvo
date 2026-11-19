/**
 * Launch fee, set by the size of the game rather than chosen by the creator.
 *
 *   fee = $1.00 base
 *       + $0.01  per player          (registrations, boards, support)
 *       + $0.10  per winner slot     (each winner is a verified prize payout)
 *       + $0.0005 per piece in play  (players × pieces: the supply drawn and traded)
 *
 * All amounts are cents (the app's money unit); the total rounds up to the
 * cent. The database computes the same formula in
 * ryvo_prepare_competition_payment, so the price shown is the price charged.
 */
export const LAUNCH_FEE = { base: 100, perPlayer: 1, perWinner: 10, perPieceInPlay: 0.05 } as const;

/** Creators earn a fixed share of entry revenue. */
export const CREATOR_SHARE = 10;

export function launchFeeBreakdown(players: number, winners: number, pieces: number) {
  const piecesInPlay = players * pieces;
  const base = LAUNCH_FEE.base;
  const playerCost = players * LAUNCH_FEE.perPlayer;
  const winnerCost = winners * LAUNCH_FEE.perWinner;
  const supplyCost = piecesInPlay * LAUNCH_FEE.perPieceInPlay;
  return { base, playerCost, winnerCost, supplyCost, piecesInPlay, total: Math.ceil(base + playerCost + winnerCost + supplyCost) };
}
