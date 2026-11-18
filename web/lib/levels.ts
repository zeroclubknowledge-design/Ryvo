import type { Competition, DemoState } from "@/lib/demo";

/**
 * Player progression.
 *
 * A level is earned by completing boards, never by draws or trades: one board
 * counts once every piece in the picture is owned. Thresholds ramp gently at
 * the start and slow down, so level 6 is reachable in a few rounds while the
 * last levels stay worth chasing.
 */

export type PlayerLevel = {
  level: number;
  name: string;
  minBoards: number;
  nextBoards: number | null;
  /** Referral commission percentage earned on referred entry payments. */
  rate: number;
};

const TABLE: [minBoards: number, name: string][] = [
  [0, "Newcomer"],
  [1, "Collector"],
  [2, "Assembler"],
  [4, "Curator"],
  [6, "Challenger"],
  [9, "Finisher"],
  [12, "Connoisseur"],
  [16, "Virtuoso"],
  [20, "Master"],
  [25, "Laureate"],
];

const rateForLevel = (level: number) =>
  level <= 2 ? 10 : level <= 4 ? 20 : level <= 6 ? 30 : level <= 8 ? 40 : 50;

export const LEVELS: PlayerLevel[] = TABLE.map(([minBoards, name], index) => {
  const level = index + 1;
  return {
    level,
    name,
    minBoards,
    nextBoards: index < TABLE.length - 1 ? TABLE[index + 1][0] : null,
    rate: rateForLevel(level),
  };
});

export function levelFor(completedBoards: number): PlayerLevel {
  let current = LEVELS[0];
  for (const entry of LEVELS) if (completedBoards >= entry.minBoards) current = entry;
  return current;
}

export function completedBoards(state: DemoState, catalog: Competition[]) {
  return Object.entries(state.boards).filter(([id, pieces]) => {
    const competition = catalog.find((c) => c.id === id);
    return Boolean(competition) && new Set(pieces).size >= competition!.total;
  }).length;
}

/** 0–1 progress toward the next level, 1 at the top level. */
export function levelProgress(completed: number, level: PlayerLevel) {
  if (level.nextBoards === null) return 1;
  const span = level.nextBoards - level.minBoards;
  return Math.max(0, Math.min(1, (completed - level.minBoards) / span));
}

/* Referral programmes ------------------------------------------------------ */

export type ReferralScheme = "level" | "population";

export const isReferralScheme = (value: unknown): value is ReferralScheme =>
  value === "level" || value === "population";

export const schemeLabel = (scheme: ReferralScheme) =>
  scheme === "level" ? "Level programme" : "Population programme";

export type PopulationTier = {
  from: number;
  label: string;
  rate: number;
};

/**
 * The population programme pays more while Ryvo is small and steps down as the
 * platform grows. The rate is tied to Ryvo's total player count, not to how
 * many players one person invited.
 */
export const POPULATION_TIERS: PopulationTier[] = [
  { from: 0, label: "First 10,000 players", rate: 50 },
  { from: 10_000, label: "10,001–100,000 players", rate: 30 },
  { from: 100_000, label: "100,001–1,000,000 players", rate: 20 },
  { from: 1_000_000, label: "More than 1,000,000 players", rate: 10 },
];

export function populationTierFor(players: number) {
  let current = POPULATION_TIERS[0];
  for (const tier of POPULATION_TIERS) if (players >= tier.from) current = tier;
  return current;
}

export function referralRate(scheme: ReferralScheme, level: PlayerLevel, players: number) {
  return scheme === "level" ? level.rate : populationTierFor(players).rate;
}
