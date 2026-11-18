export type PieceState = "owned" | "missing";

export type Piece = {
  id: string;
  index: number;
  code: string;
  state: PieceState;
  listingPrice?: number;
};

export type BoardStatus = "active" | "grace" | "refunded";

export type Board = {
  id: string;
  title: string;
  artist: string;
  seed: number;
  cols: number;
  rows: number;
  entryFee: number;
  ryvoCredit: number;
  winnersTotal: number;
  winnersLeft: number;
  timeLeft: string;
  status: BoardStatus;
  pieces: Piece[];
  history: { code: string; amount: number | null; when: string }[];
};

const nf = new Intl.NumberFormat("en-NG");
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** Mock prices are legacy naira units, shown in dollars at ₦100 = $1. */
export const usd = (n: number) => money.format(n / 100);
export const ryvo = (n: number) => `${nf.format(n)} RYVO`;
export const count = (n: number) => nf.format(n);

function buildPieces(
  cols: number,
  rows: number,
  owned: number[],
  listings: Record<number, number> = {}
): Piece[] {
  const total = cols * rows;
  return Array.from({ length: total }, (_, i) => ({
    id: `piece-${i + 1}`,
    index: i,
    code: String(i + 1).padStart(2, "0"),
    state: owned.includes(i) ? "owned" : "missing",
    listingPrice: owned.includes(i) ? undefined : listings[i],
  }));
}

export const BOARDS: Board[] = [
  {
    id: "night-bloom",
    title: "Night Bloom",
    artist: "Ifeoma Adeyemi",
    seed: 7,
    cols: 4,
    rows: 3,
    entryFee: 2000,
    ryvoCredit: 20000,
    winnersTotal: 25,
    winnersLeft: 8,
    timeLeft: "19 days",
    status: "active",
    pieces: buildPieces(4, 3, [0, 1, 2, 4, 5, 6, 8, 9], {
      3: 1800,
      7: 2400,
      11: 2600,
    }),
    history: [
      { code: "09", amount: 1750, when: "2 days ago" },
      { code: "06", amount: 1600, when: "4 days ago" },
      { code: "02", amount: 1900, when: "6 days ago" },
      { code: "01", amount: null, when: "12 days ago · on entry" },
    ],
  },
  {
    id: "salt-flats",
    title: "Salt Flats",
    artist: "Tomas Reiner",
    seed: 21,
    cols: 5,
    rows: 5,
    entryFee: 500,
    ryvoCredit: 5000,
    winnersTotal: 10,
    winnersLeft: 3,
    timeLeft: "grace · 6 days",
    status: "grace",
    pieces: buildPieces(5, 5, [0, 1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 23], {
      2: 900,
      14: 1200,
    }),
    history: [
      { code: "23", amount: 850, when: "9 days ago" },
      { code: "01", amount: null, when: "31 days ago · on entry" },
    ],
  },
  {
    id: "paper-lanterns",
    title: "Paper Lanterns",
    artist: "Mira Sato",
    seed: 34,
    cols: 5,
    rows: 2,
    entryFee: 1000,
    ryvoCredit: 10000,
    winnersTotal: 5,
    winnersLeft: 0,
    timeLeft: "closed",
    status: "refunded",
    pieces: buildPieces(5, 2, [0]),
    history: [{ code: "01", amount: null, when: "63 days ago · on entry" }],
  },
];

export function findBoard(id: string) {
  return BOARDS.find((b) => b.id === id);
}

export type BoardStats = {
  owned: number;
  total: number;
  missing: number;
  listed: number;
  cheapest: number | null;
  completeRoute: number | null;
};

export function boardStats(board: Board): BoardStats {
  const total = board.pieces.length;
  const ownedPieces = board.pieces.filter((p) => p.state === "owned");
  const missingPieces = board.pieces.filter((p) => p.state === "missing");
  const prices = missingPieces
    .map((p) => p.listingPrice)
    .filter((p): p is number => typeof p === "number");

  return {
    owned: ownedPieces.length,
    total,
    missing: missingPieces.length,
    listed: prices.length,
    cheapest: prices.length ? Math.min(...prices) : null,
    completeRoute:
      prices.length === missingPieces.length && prices.length > 0
        ? prices.reduce((a, b) => a + b, 0)
        : null,
  };
}

/** Next competition waiting for registration capacity to open. */
export const NEXT_OPEN = {
  id: "harbour-lights",
  title: "Harbour Lights",
  artist: "Ada Nwosu",
  entryFee: 1000,
  winnersTotal: 40,
  joined: 47,
  capacity: 50,
  note: "Opens the moment Salt Flats fills. Three places left.",
};
