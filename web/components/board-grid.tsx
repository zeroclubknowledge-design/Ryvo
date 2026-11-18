import { artworkBackground, cellAspect, slicePosition } from "@/lib/artwork";
import { usd, type Piece } from "@/lib/mock";

type Props = {
  pieces: Piece[];
  cols: number;
  rows: number;
  seed: number;
  compact?: boolean;
};

export function BoardGrid({ pieces, cols, rows, seed, compact = false }: Props) {
  const art = artworkBackground(seed);
  const aspectRatio = cellAspect(cols, rows);

  return (
    <ul
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: compact ? 3 : 8,
      }}
    >
      {pieces.map((piece) => {
        const owned = piece.state === "owned";
        const slice = slicePosition(cols, rows, piece.index);

        return (
          <li
            key={piece.id}
            className="relative overflow-hidden rounded-[3px]"
            style={{ aspectRatio }}
            aria-label={
              owned
                ? `Piece ${piece.code}, owned`
                : `Piece ${piece.code}, missing${
                    piece.listingPrice ? `, listed at ${usd(piece.listingPrice)}` : ", no listings"
                  }`
            }
          >
            {owned ? (
              <>
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: art, ...slice }}
                />
                <span
                  className={`absolute bottom-1 left-1 rounded-[2px] bg-white/88 px-1 font-mono text-ink ${
                    compact ? "text-[8px]" : "text-[10px]"
                  }`}
                >
                  {piece.code}
                </span>
              </>
            ) : (
              <>
                <div className="hatch absolute inset-0 bg-surface" />
                <div className="absolute inset-0 rounded-[3px] border border-dashed border-line" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
                  <span
                    className={`font-mono text-ink-soft ${compact ? "text-[8px]" : "text-[11px]"}`}
                  >
                    {piece.code}
                  </span>
                  {!compact && (
                    <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-soft">
                      Missing
                    </span>
                  )}
                  {!compact && (
                    <span className="tabular mt-0.5 text-[10px] text-ink-soft">
                      {piece.listingPrice ? usd(piece.listingPrice) : "no listing"}
                    </span>
                  )}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
