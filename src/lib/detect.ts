// Ported (and extended) from the original Python automation script.
// Adds automatic CLASS LEVEL detection (11th / 12th / Dropper) on top of
// exam / track / family / component / date detection.

export const ALIASES: Record<string, string[]> = {
  "Registration No": ["Roll No", "Registration No", "Registration Number", "Roll_No"],
  "Student Name": ["Students_name", "Student Name", "Student_Name", "Name"],
  Vertical: ["Vertical"],
  Region: ["Region"],
  Center: ["Center", "Centre"],
  Rank: ["Rank", "All India Rank", "AIR Rank"],
  Total: ["Total Marks", "Total_Marks", "Total", "Total Score"],
  Physics: ["Physics Marks", "Phy Marks", "Physics", "Phy_Marks"],
  Chemistry: ["Chemistry Marks", "Chem Marks", "Chemistry", "Chem_Marks"],
  Maths: ["Maths Marks", "Math_Marks", "Maths", "Mathematics", "Mathematics Marks"],
  Botany: ["Botany Marks", "Bot Marks", "Botany", "Botany_Marks"],
  Zoology: ["Zoology Marks", "Zoo Marks", "Zoology", "Zoology_Marks"],
  "Paper 1": ["Adv. P:1", "Adv P1", "Adv. P1", "Paper 1", "P1", "P_1", "P1 Total", "Paper 1 Total"],
  "Paper 2": ["Adv. P:2", "Adv P2", "Adv. P2", "Paper 2", "P2", "P_2", "P2 Total", "Paper 2 Total"],
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2,
  mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

export function cleanCol(x: unknown): string {
  return String(x).trim().replace(/\s+/g, " ");
}

export function findCol(columns: string[], aliases: string[]): string | null {
  const lookup = new Map<string, string>();
  for (const c of columns) lookup.set(cleanCol(c).toLowerCase(), c);

  for (const alias of aliases) {
    const key = cleanCol(alias).toLowerCase();
    if (lookup.has(key)) return lookup.get(key)!;
  }

  for (const c of columns) {
    const lc = cleanCol(c).toLowerCase();
    for (const alias of aliases) {
      const a = cleanCol(alias).toLowerCase();
      if (a && lc.includes(a)) return c;
    }
  }
  return null;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "nan" || s.toLowerCase() === "none") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function normalizeVertical(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const u = s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").toUpperCase();
  if (u === "AIR") return "AIR";
  if (u === "NON AIR") return "Non-AIR";
  return s;
}

/** Take the LAST valid day+month pair in the filename. */
export function inferDate(filename: string): string {
  const re = /(\d{1,2})(?:st|nd|rd|th)?[\s._-]+([A-Za-z]+)(?:[\s._-]+(\d{4}))?/gi;
  const matches = [...filename.matchAll(re)];

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return d.toISOString().slice(0, 10);
    }
  }
  return "2100-01-01";
}

export function inferExam(filename: string): "NEET" | "JEE" {
  const text = filename.toUpperCase();
  return text.includes("NEET") ? "NEET" : "JEE";
}

export function inferJeeType(filename: string): "MAIN" | "ADVANCED" {
  const u = filename.toUpperCase();
  const tokens = ["ADVANCE", "ADV.", "ADV_", "ADV ", "P_1", "P_2", "P1", "P2", "PAPER 1", "PAPER 2"];
  if (tokens.some((t) => u.includes(t))) return "ADVANCED";
  return "MAIN";
}

export function inferFamily(filename: string): "AITS" | "UNIVERSE" | "TEST" {
  const u = filename.toUpperCase();
  if (u.includes("AITS")) return "AITS";
  if (u.includes("UNIVERSE")) return "UNIVERSE";
  return "TEST";
}

export type ClassLevel = "11TH" | "12TH" | "DROPPER" | "UNKNOWN";

/**
 * Automatically figures out which "batch" a CSV belongs to:
 *   11th class, 12th class, or Dropper (repeater) batch.
 *
 * It looks at the filename (and, as a fallback, the folder path) for
 * common naming patterns used by coaching institutes:
 *   11th / Class 11 / Class-11 / XI / 11 GRADE           -> 11TH
 *   12th / Class 12 / Class-12 / XII / 12 GRADE          -> 12TH
 *   Dropper / Drop / Repeater / Target / Yakeen / Lakshya -> DROPPER
 *
 * If nothing matches, it returns UNKNOWN so the file still shows up in
 * the report (grouped under an "Unknown / Unclassified" batch) instead
 * of silently being dropped - and the UI lets the user override it.
 */
export function inferClassLevel(pathLike: string): ClassLevel {
  const u = ` ${pathLike.toUpperCase().replace(/[_]/g, " ")} `;

  const dropperPatterns = [
    /\bDROPPER\b/, /\bDROPPERS\b/, /\bDROP\b/, /\bREPEATER\b/, /\bREPEATERS\b/,
    /\bTARGET\b/, /\bYAKEEN\b/, /\bLAKSHYA\b/, /\bRISE\b/, /\bPRAYAS\b/,
  ];
  if (dropperPatterns.some((p) => p.test(u))) return "DROPPER";

  // "12th", "class 12", "class-12", "XII", "grade 12"
  if (
    /\b12\s*(?:TH)?\b/.test(u) ||
    /CLASS[\s-]*12\b/.test(u) ||
    /GRADE[\s-]*12\b/.test(u) ||
    /\bXII\b/.test(u)
  ) {
    return "12TH";
  }

  // "11th", "class 11", "class-11", "XI", "grade 11"
  if (
    /\b11\s*(?:TH)?\b/.test(u) ||
    /CLASS[\s-]*11\b/.test(u) ||
    /GRADE[\s-]*11\b/.test(u) ||
    /\bXI\b/.test(u)
  ) {
    return "11TH";
  }

  return "UNKNOWN";
}

export function inferComponent(
  filename: string,
  testType: "NEET" | "MAIN" | "ADVANCED",
  columns: string[],
): "" | "P1" | "P2" | "COMBINED" {
  if (testType !== "ADVANCED") return "";
  const u = filename.toUpperCase();

  if (/(?:P|PAPER)[ _.-]*1(?:\D|$)/.test(u)) return "P1";
  if (/(?:P|PAPER)[ _.-]*2(?:\D|$)/.test(u)) return "P2";

  if (findCol(columns, ALIASES["Paper 1"]) && findCol(columns, ALIASES["Paper 2"])) {
    return "COMBINED";
  }
  return "";
}

export function classLevelLabel(level: ClassLevel): string {
  switch (level) {
    case "11TH":
      return "11th Class";
    case "12TH":
      return "12th Class";
    case "DROPPER":
      return "Dropper";
    default:
      return "Unclassified";
  }
}
