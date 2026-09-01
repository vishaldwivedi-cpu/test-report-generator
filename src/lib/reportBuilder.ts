import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { testRecords, uploadedFiles } from "@/db/schema";
import type { NormalizedRecord, Track } from "./csvIngest";
import { combineAdvancedPieces, type AdvancedPiece } from "./advancedMerge";
import type { ClassLevel } from "./detect";
import { classLevelLabel } from "./detect";

export type Cell = string | number | null;

export interface TableBlock {
  title: string;
  headers: string[];
  rows: Cell[][];
}

export interface TestReport {
  name: string;
  date: string;
  vertical: TableBlock;
  region: TableBlock;
}

export interface QaRow {
  issueType: string;
  test: string;
  date: string;
  sourceFile: string;
  registrationNo: string;
  details: string;
}

export interface SourceRow {
  exam: string;
  track: string;
  classLevel: string;
  test: string;
  date: string;
  sourceFile: string;
  component: string;
  rawRows: number;
  uniqueRegistrations: number;
  blankRegistration: number;
  status: string;
}

export interface StudentHistoryBlock {
  name: string;
  date: string;
  metrics: string[];
}

export interface ReportData {
  exam: string;
  track: Track;
  classLevel: ClassLevel;
  title: string;
  ceo: {
    testsDetected: number;
    uniqueStudents: number;
    qaIssuesCount: number;
  };
  tests: TestReport[];
  studentHistory: {
    identityHeaders: string[];
    blocks: StudentHistoryBlock[];
    rows: Cell[][];
  };
  qaIssues: QaRow[];
  sourceControl: SourceRow[];
}

type FileRow = typeof uploadedFiles.$inferSelect;
type RecordRow = typeof testRecords.$inferSelect;

function numOrNull(v: string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNormalized(r: RecordRow): NormalizedRecord {
  return {
    registrationNo: r.registrationNo,
    studentName: r.studentName,
    vertical: r.vertical,
    region: r.region,
    center: r.center,
    rank: numOrNull(r.rank),
    total: numOrNull(r.total),
    physics: numOrNull(r.physics),
    chemistry: numOrNull(r.chemistry),
    maths: numOrNull(r.maths),
    botany: numOrNull(r.botany),
    zoology: numOrNull(r.zoology),
    paper1: numOrNull(r.paper1),
    paper2: numOrNull(r.paper2),
    p1Physics: numOrNull(r.p1Physics),
    p1Chemistry: numOrNull(r.p1Chemistry),
    p1Maths: numOrNull(r.p1Maths),
    p1Total: numOrNull(r.p1Total),
    p1Rank: numOrNull(r.p1Rank),
    p2Physics: numOrNull(r.p2Physics),
    p2Chemistry: numOrNull(r.p2Chemistry),
    p2Maths: numOrNull(r.p2Maths),
    p2Total: numOrNull(r.p2Total),
    p2Rank: numOrNull(r.p2Rank),
  };
}

function fmtDate(d: string): string {
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

interface LogicalTestGroup {
  name: string;
  date: string;
  files: FileRow[];
}

function buildLogicalGroups(files: FileRow[], exam: string, track: Track): LogicalTestGroup[] {
  const byKey = new Map<string, FileRow[]>();
  for (const f of files) {
    const key = `${f.family}|${f.testDate}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(f);
  }

  // Chronological ordinal per family.
  const datesByFamily = new Map<string, Set<string>>();
  for (const f of files) {
    if (!datesByFamily.has(f.family)) datesByFamily.set(f.family, new Set());
    datesByFamily.get(f.family)!.add(f.testDate);
  }
  const ordinalOf = new Map<string, number>();
  for (const [family, dates] of datesByFamily) {
    [...dates].sort().forEach((d, i) => ordinalOf.set(`${family}|${d}`, i + 1));
  }

  const groups: LogicalTestGroup[] = [];
  for (const [key, groupFiles] of byKey) {
    const [family, date] = key.split("|");
    const ordinal = ordinalOf.get(key) ?? 1;
    let name: string;
    if (exam === "NEET") {
      name = family === "UNIVERSE" || family === "AITS"
        ? `${family} ${String(ordinal).padStart(2, "0")}`
        : `TEST ${String(ordinal).padStart(2, "0")}`;
    } else if (track === "JEE_MAIN") {
      name = `${family} ${String(ordinal).padStart(2, "0")} - MAIN`;
    } else {
      name = `${family} ${String(ordinal).padStart(2, "0")} - ADVANCED`;
    }
    groups.push({ name, date, files: groupFiles });
  }

  groups.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return groups;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, v) => a + v, 0) / values.length;
}

function round2(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100) / 100;
}

interface SubjectDef {
  key: string; // field on merged record, or synthetic
  label: string;
  agg: "mean" | "min";
  accessor: (r: NormalizedRecord) => number | null;
}

function subjectDefsFor(track: Track, sampleRows: NormalizedRecord[]): SubjectDef[] {
  if (track === "NEET") {
    return (["physics", "chemistry", "botany", "zoology"] as const).map((k) => ({
      key: k,
      label: `${k[0].toUpperCase()}${k.slice(1)} Average`,
      agg: "mean" as const,
      accessor: (r) => r[k],
    }));
  }
  if (track === "JEE_MAIN") {
    return (["physics", "chemistry", "maths"] as const).map((k) => ({
      key: k,
      label: `${k[0].toUpperCase()}${k.slice(1)} Average`,
      agg: "mean" as const,
      accessor: (r) => r[k],
    }));
  }

  // JEE_ADVANCED
  const hasDetailed = sampleRows.some(
    (r) => r.p1Physics !== null || r.p1Total !== null || r.p2Physics !== null || r.p2Total !== null,
  );
  if (hasDetailed) {
    const defs: SubjectDef[] = [];
    for (const prefix of ["p1", "p2"] as const) {
      const label = prefix === "p1" ? "P1" : "P2";
      for (const subj of ["Physics", "Chemistry", "Maths", "Total"] as const) {
        const key = `${prefix}${subj}` as keyof NormalizedRecord;
        defs.push({
          key: String(key),
          label: `${label} ${subj} Average`,
          agg: "mean",
          accessor: (r) => r[key] as number | null,
        });
      }
      const rankKey = `${prefix}Rank` as keyof NormalizedRecord;
      defs.push({
        key: String(rankKey),
        label: `${label} Best Rank`,
        agg: "min",
        accessor: (r) => r[rankKey] as number | null,
      });
    }
    return defs;
  }

  return [
    { key: "paper1", label: "Paper 1 Average", agg: "mean", accessor: (r) => r.paper1 },
    { key: "paper2", label: "Paper 2 Average", agg: "mean", accessor: (r) => r.paper2 },
  ];
}

function buildVerticalTable(track: Track, name: string, date: string, rows: NormalizedRecord[]): TableBlock {
  const subjectDefs = subjectDefsFor(track, rows);
  const headers = [
    "Vertical",
    "# Attempts",
    "Average Score",
    ...subjectDefs.map((d) => d.label),
    "Top 10",
    "Top 50",
    "Top 100",
    "Best Rank",
  ];

  const groups = new Map<string, NormalizedRecord[]>();
  for (const r of rows) {
    const v = r.vertical ?? "Unclassified";
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v)!.push(r);
  }

  const buildRow = (label: string, list: NormalizedRecord[]): Cell[] => {
    const totals = list.map((r) => r.total).filter((v): v is number => v !== null);
    const ranks = list.map((r) => r.rank).filter((v): v is number => v !== null);
    const row: Cell[] = [
      label,
      new Set(list.map((r) => r.registrationNo)).size,
      round2(mean(totals)),
    ];
    for (const d of subjectDefs) {
      const vals = list.map(d.accessor).filter((v): v is number => v !== null);
      if (!vals.length) row.push(null);
      else row.push(d.agg === "mean" ? round2(mean(vals)) : Math.min(...vals));
    }
    row.push(new Set(list.filter((r) => r.rank !== null && r.rank <= 10).map((r) => r.registrationNo)).size);
    row.push(new Set(list.filter((r) => r.rank !== null && r.rank <= 50).map((r) => r.registrationNo)).size);
    row.push(new Set(list.filter((r) => r.rank !== null && r.rank <= 100).map((r) => r.registrationNo)).size);
    row.push(ranks.length ? Math.min(...ranks) : null);
    return row;
  };

  const outRows: Cell[][] = [buildRow("Overall", rows)];
  for (const [vertical, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    outRows.push(buildRow(vertical, list));
  }

  return { title: `${name} | ${fmtDate(date)}`, headers, rows: outRows };
}

function buildRegionTable(track: Track, name: string, date: string, rows: NormalizedRecord[]): TableBlock {
  // FIX: previously this filtered rows down to a hard-coded vertical
  // allow-list (e.g. only "VP" or only "AIR"/"Non-AIR") before computing
  // region stats. If actual vertical labels didn't match that fixed list,
  // the whole table silently emptied out (blank region row, 0 attempts).
  // We now use every record that has a Region value, regardless of
  // vertical labels, so the region summary always reflects real data.
  const subjectDefs = subjectDefsFor(track, rows).filter((d) => d.agg === "mean");
  const headers = ["Region", "# Attempts", "Average Score", ...subjectDefs.map((d) => d.label)];

  const withRegion = rows.filter((r) => r.region && r.region.trim() !== "");
  const groups = new Map<string, NormalizedRecord[]>();
  for (const r of withRegion) {
    const region = r.region!.trim();
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region)!.push(r);
  }

  const buildRow = (label: string, list: NormalizedRecord[]): Cell[] => {
    const totals = list.map((r) => r.total).filter((v): v is number => v !== null);
    const row: Cell[] = [label, new Set(list.map((r) => r.registrationNo)).size, round2(mean(totals))];
    for (const d of subjectDefs) {
      const vals = list.map(d.accessor).filter((v): v is number => v !== null);
      row.push(vals.length ? round2(mean(vals)) : null);
    }
    return row;
  };

  const outRows: Cell[][] = [buildRow("Overall", withRegion)];
  for (const [region, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    outRows.push(buildRow(region, list));
  }
  if (withRegion.length < rows.length) {
    const missing = rows.length - withRegion.length;
    outRows.push([`(No Region on file for ${missing} record${missing === 1 ? "" : "s"})`, "", "", ...subjectDefs.map(() => "")]);
  }

  return { title: `${name} | ${fmtDate(date)}`, headers, rows: outRows };
}

function historyMetricsFor(track: Track, rows: NormalizedRecord[]): string[] {
  if (track === "NEET") return ["physics", "chemistry", "botany", "zoology", "total", "rank"];
  if (track === "JEE_MAIN") return ["physics", "chemistry", "maths", "total", "rank"];

  const hasDetailed = rows.some(
    (r) => r.p1Physics !== null || r.p1Total !== null || r.p2Physics !== null || r.p2Total !== null,
  );
  if (hasDetailed) {
    const m: string[] = [];
    for (const p of ["p1", "p2"]) {
      for (const s of ["Physics", "Chemistry", "Maths"]) {
        const k = `${p}${s}`;
        if (rows.some((r) => (r as unknown as Record<string, unknown>)[k] !== null)) m.push(k);
      }
      const totalKey = `${p}Total`;
      if (rows.some((r) => (r as unknown as Record<string, unknown>)[totalKey] !== null)) m.push(totalKey);
      const rankKey = `${p}Rank`;
      if (rows.some((r) => (r as unknown as Record<string, unknown>)[rankKey] !== null)) m.push(rankKey);
    }
    m.push("total", "rank");
    return m;
  }
  const m: string[] = [];
  if (rows.some((r) => r.paper1 !== null)) m.push("paper1");
  if (rows.some((r) => r.paper2 !== null)) m.push("paper2");
  m.push("total", "rank");
  return m;
}

const METRIC_LABELS: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  maths: "Maths",
  botany: "Botany",
  zoology: "Zoology",
  total: "Total",
  rank: "Rank",
  paper1: "Paper 1",
  paper2: "Paper 2",
  p1Physics: "P1 Physics",
  p1Chemistry: "P1 Chemistry",
  p1Maths: "P1 Maths",
  p1Total: "P1 Total",
  p1Rank: "P1 Rank",
  p2Physics: "P2 Physics",
  p2Chemistry: "P2 Chemistry",
  p2Maths: "P2 Maths",
  p2Total: "P2 Total",
  p2Rank: "P2 Rank",
};

export function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key;
}

export async function buildReport(
  exam: "NEET" | "JEE",
  track: Track,
  classLevel: ClassLevel,
): Promise<ReportData | null> {
  const files = await db
    .select()
    .from(uploadedFiles)
    .where(
      and(
        eq(uploadedFiles.exam, exam),
        eq(uploadedFiles.track, track),
        eq(uploadedFiles.classLevel, classLevel),
        eq(uploadedFiles.status, "OK"),
      ),
    )
    .orderBy(asc(uploadedFiles.testDate));

  if (!files.length) return null;

  const fileIds = files.map((f) => f.id);
  const allRecords = fileIds.length
    ? await db.select().from(testRecords).where(inArray(testRecords.fileId, fileIds))
    : [];

  const recordsByFile = new Map<number, RecordRow[]>();
  for (const r of allRecords) {
    if (!recordsByFile.has(r.fileId)) recordsByFile.set(r.fileId, []);
    recordsByFile.get(r.fileId)!.push(r);
  }

  const groups = buildLogicalGroups(files, exam, track);

  const testItems: { name: string; date: string; rows: NormalizedRecord[]; files: FileRow[] }[] = [];

  for (const g of groups) {
    let mergedRows: NormalizedRecord[];

    if (track === "JEE_ADVANCED") {
      const pieces: AdvancedPiece[] = g.files.map((f) => ({
        component: (f.component || "") as AdvancedPiece["component"],
        records: (recordsByFile.get(f.id) ?? []).map(toNormalized),
      }));
      mergedRows = combineAdvancedPieces(pieces);
    } else {
      const all = g.files.flatMap((f) => (recordsByFile.get(f.id) ?? []).map(toNormalized));
      const byReg = new Map<string, NormalizedRecord>();
      for (const r of all) {
        const existing = byReg.get(r.registrationNo);
        if (!existing) {
          byReg.set(r.registrationNo, r);
        } else {
          const et = existing.total ?? -Infinity;
          const rt = r.total ?? -Infinity;
          if (rt > et) byReg.set(r.registrationNo, r);
        }
      }
      mergedRows = [...byReg.values()];
    }

    testItems.push({ name: g.name, date: g.date, rows: mergedRows, files: g.files });
  }

  // Region backfill: build a Center -> Region map from every record in
  // this report (across all tests), then fill gaps.
  const centerRegionCount = new Map<string, Map<string, number>>();
  for (const item of testItems) {
    for (const r of item.rows) {
      if (r.center && r.region && r.region.trim()) {
        if (!centerRegionCount.has(r.center)) centerRegionCount.set(r.center, new Map());
        const m = centerRegionCount.get(r.center)!;
        m.set(r.region.trim(), (m.get(r.region.trim()) ?? 0) + 1);
      }
    }
  }
  const centerRegionMap = new Map<string, string>();
  for (const [center, counts] of centerRegionCount) {
    let best = "";
    let bestCount = -1;
    for (const [region, count] of counts) {
      if (count > bestCount) {
        best = region;
        bestCount = count;
      }
    }
    centerRegionMap.set(center, best);
  }

  const qaIssues: QaRow[] = [];
  for (const item of testItems) {
    for (const r of item.rows) {
      if ((!r.region || !r.region.trim()) && r.center && centerRegionMap.has(r.center)) {
        r.region = centerRegionMap.get(r.center)!;
      }
    }
  }

  // Collect QA issues stored at ingest time.
  for (const f of files) {
    const testForFile = testItems.find((t) => t.files.some((ff) => ff.id === f.id));
    for (const issue of f.qaIssues ?? []) {
      qaIssues.push({
        issueType: issue.issueType,
        test: testForFile?.name ?? "",
        date: testForFile ? fmtDate(testForFile.date) : "",
        sourceFile: f.filename,
        registrationNo: issue.registrationNo,
        details: issue.details,
      });
    }
  }

  const tests: TestReport[] = testItems.map((item) => ({
    name: item.name,
    date: item.date,
    vertical: buildVerticalTable(track, item.name, item.date, item.rows),
    region: buildRegionTable(track, item.name, item.date, item.rows),
  }));

  // Student history.
  const identityHeaders = ["Vertical", "Registration No", "Student Name", "Region", "Center", "Tests Attempted", "Average Score", "Best Score"];
  const blocks: StudentHistoryBlock[] = testItems.map((item) => ({
    name: item.name,
    date: fmtDate(item.date),
    metrics: historyMetricsFor(track, item.rows).map((m) => metricLabel(m)),
  }));
  const blockMetricKeys = testItems.map((item) => historyMetricsFor(track, item.rows));

  const identityMap = new Map<string, { vertical: string | null; studentName: string | null; region: string | null; center: string | null }>();
  const allRegs = new Set<string>();
  for (const item of testItems) {
    for (const r of item.rows) {
      allRegs.add(r.registrationNo);
      if (!identityMap.has(r.registrationNo)) {
        identityMap.set(r.registrationNo, {
          vertical: r.vertical,
          studentName: r.studentName,
          region: r.region,
          center: r.center,
        });
      } else {
        const cur = identityMap.get(r.registrationNo)!;
        if (!cur.vertical && r.vertical) cur.vertical = r.vertical;
        if (!cur.studentName && r.studentName) cur.studentName = r.studentName;
        if (!cur.region && r.region) cur.region = r.region;
        if (!cur.center && r.center) cur.center = r.center;
      }
    }
  }

  const lookups = testItems.map((item) => {
    const m = new Map<string, NormalizedRecord>();
    for (const r of item.rows) m.set(r.registrationNo, r);
    return m;
  });

  const sortedRegs = [...allRegs].sort((a, b) => a.localeCompare(b));
  const historyRows: Cell[][] = sortedRegs.map((reg) => {
    const identity = identityMap.get(reg)!;
    const attemptedTotals: number[] = [];
    const row: Cell[] = [identity.vertical, reg, identity.studentName, identity.region, identity.center];

    const blockCells: Cell[][] = lookups.map((lookup, idx) => {
      const rec = lookup.get(reg);
      const keys = blockMetricKeys[idx];
      if (!rec) return keys.map(() => null);
      if (rec.total !== null) attemptedTotals.push(rec.total);
      return keys.map((k) => (rec as unknown as Record<string, number | string | null>)[k] ?? null);
    });

    const attempts = attemptedTotals.length;
    row.push(attempts);
    row.push(attempts ? round2(mean(attemptedTotals)) : null);
    row.push(attempts ? Math.max(...attemptedTotals) : null);
    for (const cells of blockCells) row.push(...cells);
    return row;
  });

  const sourceControl: SourceRow[] = files.map((f) => ({
    exam: f.exam,
    track: f.track,
    classLevel: classLevelLabel(f.classLevel as ClassLevel),
    test: testItems.find((t) => t.files.some((ff) => ff.id === f.id))?.name ?? "",
    date: fmtDate(f.testDate),
    sourceFile: f.filename,
    component: f.component || "COMBINED",
    rawRows: f.rawRowCount,
    uniqueRegistrations: f.uniqueRegistrations,
    blankRegistration: f.blankRegistrations,
    status: f.status,
  }));

  const titleMap: Record<Track, string> = {
    NEET: "NEET",
    JEE_MAIN: "JEE MAIN",
    JEE_ADVANCED: "JEE ADVANCED",
  };

  return {
    exam,
    track,
    classLevel,
    title: `${titleMap[track]} — ${classLevelLabel(classLevel).toUpperCase()} — FULLY AUTOMATIC TEST PERFORMANCE`,
    ceo: {
      testsDetected: testItems.length,
      uniqueStudents: sortedRegs.length,
      qaIssuesCount: qaIssues.length,
    },
    tests,
    studentHistory: { identityHeaders, blocks, rows: historyRows },
    qaIssues,
    sourceControl,
  };
}

export async function listAvailableScopes(): Promise<
  { exam: string; track: Track; classLevel: ClassLevel; count: number }[]
> {
  const files = await db.select().from(uploadedFiles).where(eq(uploadedFiles.status, "OK"));
  const map = new Map<string, { exam: string; track: Track; classLevel: ClassLevel; count: number }>();
  for (const f of files) {
    const key = `${f.exam}|${f.track}|${f.classLevel}`;
    if (!map.has(key)) {
      map.set(key, { exam: f.exam, track: f.track as Track, classLevel: f.classLevel as ClassLevel, count: 0 });
    }
    map.get(key)!.count += 1;
  }
  return [...map.values()];
}
