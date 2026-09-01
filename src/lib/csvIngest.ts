import {
  ALIASES,
  cleanCol,
  findCol,
  inferComponent,
  normalizeVertical,
  toNumber,
} from "./detect";

export type Track = "NEET" | "JEE_MAIN" | "JEE_ADVANCED";

export interface QaIssue {
  issueType: string;
  registrationNo: string;
  details: string;
}

export interface NormalizedRecord {
  registrationNo: string;
  studentName: string | null;
  vertical: string | null;
  region: string | null;
  center: string | null;
  rank: number | null;
  total: number | null;
  physics: number | null;
  chemistry: number | null;
  maths: number | null;
  botany: number | null;
  zoology: number | null;
  paper1: number | null;
  paper2: number | null;
  p1Physics: number | null;
  p1Chemistry: number | null;
  p1Maths: number | null;
  p1Total: number | null;
  p1Rank: number | null;
  p2Physics: number | null;
  p2Chemistry: number | null;
  p2Maths: number | null;
  p2Total: number | null;
  p2Rank: number | null;
}

export interface StandardizeResult {
  track: Track;
  records: NormalizedRecord[];
  qaIssues: QaIssue[];
  rawRowCount: number;
  uniqueRegistrations: number;
  blankRegistrations: number;
  derivedTotal: boolean;
}

function emptyRecord(registrationNo: string): NormalizedRecord {
  return {
    registrationNo,
    studentName: null,
    vertical: null,
    region: null,
    center: null,
    rank: null,
    total: null,
    physics: null,
    chemistry: null,
    maths: null,
    botany: null,
    zoology: null,
    paper1: null,
    paper2: null,
    p1Physics: null,
    p1Chemistry: null,
    p1Maths: null,
    p1Total: null,
    p1Rank: null,
    p2Physics: null,
    p2Chemistry: null,
    p2Maths: null,
    p2Total: null,
    p2Rank: null,
  };
}

export function standardizeCsv(
  rows: Record<string, string>[],
  rawColumns: string[],
  exam: "NEET" | "JEE",
  jeeType: "MAIN" | "ADVANCED",
  filename: string,
): StandardizeResult {
  const columns = rawColumns.map(cleanCol);
  const colMap = new Map<string, string>();
  rawColumns.forEach((raw, i) => colMap.set(columns[i], raw));

  const req = (field: string): string => {
    const col = findCol(columns, ALIASES[field]);
    if (!col) throw new Error(`Missing required column: ${field}`);
    return colMap.get(col)!;
  };
  const opt = (field: string): string | null => {
    const col = findCol(columns, ALIASES[field]);
    return col ? colMap.get(col)! : null;
  };

  const regCol = req("Registration No");
  const nameCol = req("Student Name");
  const verticalCol = req("Vertical");
  const centerCol = req("Center");
  const rankCol = req("Rank");
  const regionCol = opt("Region");
  const totalCol = opt("Total");

  const qaIssues: QaIssue[] = [];
  const track: Track =
    exam === "NEET" ? "NEET" : jeeType === "ADVANCED" ? "JEE_ADVANCED" : "JEE_MAIN";

  const testType = exam === "NEET" ? "NEET" : jeeType;
  const component = inferComponent(filename, testType, columns);

  const byReg = new Map<string, NormalizedRecord[]>();
  let blankRegistrations = 0;

  for (const row of rows) {
    const rawReg = row[regCol];
    const reg = rawReg === undefined || rawReg === null ? "" : String(rawReg).trim();
    if (!reg || reg.toLowerCase() === "nan" || reg.toLowerCase() === "none") {
      blankRegistrations += 1;
      continue;
    }

    const rec = emptyRecord(reg);
    rec.studentName = row[nameCol] ?? null;
    rec.vertical = normalizeVertical(row[verticalCol]);
    rec.region = regionCol ? (row[regionCol] ?? null) : null;
    rec.center = row[centerCol] ?? null;
    rec.rank = toNumber(row[rankCol]);

    if (track === "NEET") {
      const subjects = ["Physics", "Chemistry", "Botany", "Zoology"] as const;
      const key: Record<string, keyof NormalizedRecord> = {
        Physics: "physics",
        Chemistry: "chemistry",
        Botany: "botany",
        Zoology: "zoology",
      };
      for (const s of subjects) {
        const c = findCol(columns, ALIASES[s]);
        if (!c) throw new Error(`Missing subject column: ${s}`);
        (rec[key[s]] as number | null) = toNumber(row[colMap.get(c)!]);
      }
      if (totalCol) {
        rec.total = toNumber(row[totalCol]);
      } else {
        const sum = [rec.physics, rec.chemistry, rec.botany, rec.zoology];
        rec.total = sum.some((v) => v !== null)
          ? sum.reduce((a: number, v) => a + (v ?? 0), 0)
          : null;
      }
    } else if (track === "JEE_MAIN") {
      const subjects = ["Physics", "Chemistry", "Maths"] as const;
      const key: Record<string, keyof NormalizedRecord> = {
        Physics: "physics",
        Chemistry: "chemistry",
        Maths: "maths",
      };
      for (const s of subjects) {
        const c = findCol(columns, ALIASES[s]);
        if (!c) throw new Error(`Missing subject column: ${s}`);
        (rec[key[s]] as number | null) = toNumber(row[colMap.get(c)!]);
      }
      if (totalCol) {
        rec.total = toNumber(row[totalCol]);
      } else {
        const sum = [rec.physics, rec.chemistry, rec.maths];
        rec.total = sum.some((v) => v !== null)
          ? sum.reduce((a: number, v) => a + (v ?? 0), 0)
          : null;
      }
    } else {
      // JEE_ADVANCED
      const p1Col = findCol(columns, ALIASES["Paper 1"]);
      const p2Col = findCol(columns, ALIASES["Paper 2"]);

      if (p1Col || p2Col) {
        if (p1Col) rec.paper1 = toNumber(row[colMap.get(p1Col)!]);
        if (p2Col) rec.paper2 = toNumber(row[colMap.get(p2Col)!]);
        if (totalCol) {
          rec.total = toNumber(row[totalCol]);
        } else {
          const parts = [rec.paper1, rec.paper2];
          rec.total = parts.some((v) => v !== null)
            ? parts.reduce((a: number, v) => a + (v ?? 0), 0)
            : null;
        }
      } else {
        const prefix: "P1" | "P2" = component === "P2" ? "P2" : "P1";
        const subjects = ["Physics", "Chemistry", "Maths"] as const;
        let foundAny = false;
        for (const s of subjects) {
          const c = findCol(columns, ALIASES[s]);
          if (c) {
            foundAny = true;
            const val = toNumber(row[colMap.get(c)!]);
            if (prefix === "P1") {
              if (s === "Physics") rec.p1Physics = val;
              if (s === "Chemistry") rec.p1Chemistry = val;
              if (s === "Maths") rec.p1Maths = val;
            } else {
              if (s === "Physics") rec.p2Physics = val;
              if (s === "Chemistry") rec.p2Chemistry = val;
              if (s === "Maths") rec.p2Maths = val;
            }
          }
        }
        if (!foundAny) {
          throw new Error("Advanced file has no Physics/Chemistry/Maths columns.");
        }

        const subjVals =
          prefix === "P1"
            ? [rec.p1Physics, rec.p1Chemistry, rec.p1Maths]
            : [rec.p2Physics, rec.p2Chemistry, rec.p2Maths];
        const paperTotal = totalCol
          ? toNumber(row[totalCol])
          : subjVals.some((v) => v !== null)
            ? subjVals.reduce((a: number, v) => a + (v ?? 0), 0)
            : null;

        if (prefix === "P1") {
          rec.p1Total = paperTotal;
          rec.p1Rank = rec.rank;
        } else {
          rec.p2Total = paperTotal;
          rec.p2Rank = rec.rank;
        }
      }
    }

    if (!byReg.has(reg)) byReg.set(reg, []);
    byReg.get(reg)!.push(rec);
  }

  let derivedTotal = false;
  if ((track === "NEET" || track === "JEE_MAIN") && !totalCol) {
    derivedTotal = true;
  }

  const records: NormalizedRecord[] = [];
  for (const [reg, list] of byReg) {
    if (list.length > 1) {
      qaIssues.push({
        issueType: "Duplicate Registration No.",
        registrationNo: reg,
        details: "Duplicate rows in source; highest available Total retained.",
      });
      list.sort((a, b) => {
        const ta = a.total ?? -Infinity;
        const tb = b.total ?? -Infinity;
        if (tb !== ta) return tb - ta;
        const ra = a.rank ?? Infinity;
        const rb = b.rank ?? Infinity;
        return ra - rb;
      });
    }
    records.push(list[0]);
  }

  // Total mismatch QA (NEET / JEE Main only, when a Total column exists).
  if ((track === "NEET" || track === "JEE_MAIN") && totalCol) {
    for (const rec of records) {
      const subjects =
        track === "NEET"
          ? [rec.physics, rec.chemistry, rec.botany, rec.zoology]
          : [rec.physics, rec.chemistry, rec.maths];
      if (subjects.every((v) => v !== null) && rec.total !== null) {
        const sum = subjects.reduce((a: number, v) => a + (v ?? 0), 0);
        if (Math.abs(sum - rec.total) > 1e-6) {
          qaIssues.push({
            issueType: "Total mismatch",
            registrationNo: rec.registrationNo,
            details: `Reported Total=${rec.total}; subject sum=${sum}`,
          });
        }
      }
    }
  }

  if (derivedTotal) {
    qaIssues.push({
      issueType: "Derived Total",
      registrationNo: "",
      details:
        track === "NEET"
          ? "Total column absent; derived from Physics+Chemistry+Botany+Zoology."
          : "Total column absent; derived from Physics+Chemistry+Maths.",
    });
  }

  return {
    track,
    records,
    qaIssues,
    rawRowCount: rows.length,
    uniqueRegistrations: records.length,
    blankRegistrations,
    derivedTotal,
  };
}
