import type { NormalizedRecord } from "./csvIngest";
import { competitionRankDesc } from "./rank";

export interface AdvancedPiece {
  component: "P1" | "P2" | "COMBINED" | "";
  records: NormalizedRecord[];
}

/** Merged advanced-track row: same shape as NormalizedRecord. */
export type MergedAdvancedRecord = NormalizedRecord;

const IDENTITY_FIELDS: (keyof NormalizedRecord)[] = [
  "studentName",
  "vertical",
  "region",
  "center",
];

const CARRY_FIELDS: (keyof NormalizedRecord)[] = [
  "paper1",
  "paper2",
  "p1Physics",
  "p1Chemistry",
  "p1Maths",
  "p1Total",
  "p1Rank",
  "p2Physics",
  "p2Chemistry",
  "p2Maths",
  "p2Total",
  "p2Rank",
  "rank",
];

/**
 * Combines Paper-1 / Paper-2 pieces of a JEE Advanced logical test into one
 * row per student (mirrors `combine_advanced_pieces` from the Python tool).
 */
export function combineAdvancedPieces(pieces: AdvancedPiece[]): MergedAdvancedRecord[] {
  const byReg = new Map<string, MergedAdvancedRecord>();

  for (const piece of pieces) {
    for (const rec of piece.records) {
      let merged = byReg.get(rec.registrationNo);
      if (!merged) {
        merged = { ...rec };
        // Don't let a single piece's generic "rank" leak in yet; handled below.
        byReg.set(rec.registrationNo, merged);
        continue;
      }
      for (const f of IDENTITY_FIELDS) {
        if (merged[f] === null || merged[f] === undefined) {
          (merged[f] as unknown) = rec[f];
        }
      }
      for (const f of CARRY_FIELDS) {
        if (merged[f] === null || merged[f] === undefined) {
          (merged[f] as unknown) = rec[f];
        }
      }
    }
  }

  const rows = [...byReg.values()];
  const hasCombinedCols = rows.some((r) => r.paper1 !== null || r.paper2 !== null);

  // Combined (overall) Total.
  for (const r of rows) {
    const p1 = hasCombinedCols ? r.paper1 : r.p1Total;
    const p2 = hasCombinedCols ? r.paper2 : r.p2Total;
    if (p1 !== null && p2 !== null) r.total = p1 + p2;
    else if (p1 !== null) r.total = p1;
    else if (p2 !== null) r.total = p2;
    else r.total = null;
  }

  // Per-paper rank fallback when the source file didn't provide one.
  if (!hasCombinedCols) {
    for (const prefix of ["p1", "p2"] as const) {
      const totalKey = `${prefix}Total` as const;
      const rankKey = `${prefix}Rank` as const;
      const needsRank = rows.some((r) => r[totalKey] !== null && r[rankKey] === null);
      if (needsRank) {
        const ranks = competitionRankDesc(rows.map((r) => r[totalKey]));
        rows.forEach((r, i) => {
          if (r[rankKey] === null && r[totalKey] !== null) r[rankKey] = ranks[i];
        });
      }
    }
  }

  // Overall combined rank, based on combined Total.
  const multiplePieces = pieces.length > 1;
  if (multiplePieces) {
    const ranks = competitionRankDesc(rows.map((r) => r.total));
    rows.forEach((r, i) => {
      if (r.total !== null) r.rank = ranks[i];
    });
  } else if (!hasCombinedCols) {
    // Lone per-paper file: the generic Rank column was paper-specific, not
    // an overall rank, so it should not be surfaced as one.
    for (const r of rows) r.rank = null;
  }

  return rows;
}
