"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Cell = string | number | null;

interface TableBlock {
  title: string;
  headers: string[];
  rows: Cell[][];
}

interface TestReport {
  name: string;
  date: string;
  vertical: TableBlock;
  region: TableBlock;
}

interface QaRow {
  issueType: string;
  test: string;
  date: string;
  sourceFile: string;
  registrationNo: string;
  details: string;
}

interface SourceRow {
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

interface ReportData {
  exam: string;
  track: string;
  classLevel: string;
  title: string;
  ceo: { testsDetected: number; uniqueStudents: number; qaIssuesCount: number };
  tests: TestReport[];
  studentHistory: {
    identityHeaders: string[];
    blocks: { name: string; date: string; metrics: string[] }[];
    rows: Cell[][];
  };
  qaIssues: QaRow[];
  sourceControl: SourceRow[];
}

interface Scope {
  exam: string;
  track: string;
  classLevel: string;
  count: number;
}

const TRACK_LABEL: Record<string, string> = {
  NEET: "NEET",
  JEE_MAIN: "JEE Main",
  JEE_ADVANCED: "JEE Advanced",
};

const CLASS_LEVEL_LABEL: Record<string, string> = {
  "11TH": "11th Class",
  "12TH": "12th Class",
  DROPPER: "Dropper",
  UNKNOWN: "Unclassified",
};

function Cell({ value, highlight }: { value: Cell; highlight?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap border-b border-slate-100 px-3 py-1.5 text-center ${
        highlight ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-700"
      }`}
    >
      {value === null || value === undefined || value === "" ? <span className="text-slate-300">—</span> : value}
    </td>
  );
}

function DataTable({ block }: { block: TableBlock }) {
  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200">
      <div className="bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">{block.title}</div>
      <table className="w-full min-w-[600px] text-xs">
        <thead className="bg-amber-50">
          <tr>
            {block.headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <Cell key={j} value={v} highlight={i === 0} />
              ))}
            </tr>
          ))}
          {!block.rows.length && (
            <tr>
              <td colSpan={block.headers.length} className="px-3 py-4 text-center text-slate-400">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportView({ refreshKey }: { refreshKey: number }) {
  const [scopes, setScopes] = useState<Scope[] | null>(null);
  const [selected, setSelected] = useState<Scope | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"vertical" | "region" | "history" | "qa" | "source">("vertical");

  const loadScopes = useCallback(async () => {
    const res = await fetch("/api/scopes", { cache: "no-store" });
    const data = await res.json();
    const list: Scope[] = data.scopes ?? [];
    setScopes(list);
    setSelected((prev) => {
      if (prev && list.some((s) => s.exam === prev.exam && s.track === prev.track && s.classLevel === prev.classLevel)) {
        return prev;
      }
      return list[0] ?? null;
    });
  }, []);

  useEffect(() => {
    loadScopes();
  }, [loadScopes, refreshKey]);

  useEffect(() => {
    if (!selected) {
      setReport(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      exam: selected.exam,
      track: selected.track,
      classLevel: selected.classLevel,
    });
    fetch(`/api/report?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setReport(data.report ?? null))
      .finally(() => setLoading(false));
  }, [selected]);

  const grouped = useMemo(() => {
    const byExamTrack = new Map<string, Scope[]>();
    for (const s of scopes ?? []) {
      const key = `${s.exam}|${s.track}`;
      if (!byExamTrack.has(key)) byExamTrack.set(key, []);
      byExamTrack.get(key)!.push(s);
    }
    return byExamTrack;
  }, [scopes]);

  if (!scopes) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading reports…</div>;
  }

  if (!scopes.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No processed data yet. Upload CSV files first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {[...grouped.entries()].map(([key, list]) => {
          const [exam, track] = key.split("|");
          return (
            <div key={key} className="flex flex-wrap items-center gap-2">
              <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {exam} · {TRACK_LABEL[track] ?? track}
              </span>
              {list.map((s) => {
                const active =
                  selected?.exam === s.exam && selected?.track === s.track && selected?.classLevel === s.classLevel;
                return (
                  <button
                    key={s.classLevel}
                    onClick={() => setSelected(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {CLASS_LEVEL_LABEL[s.classLevel] ?? s.classLevel}
                    <span className="ml-1 opacity-70">({s.count})</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {loading && <div className="text-sm text-slate-500">Building report…</div>}

      {report && !loading && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{report.title}</h2>
              <div className="mt-2 flex gap-4 text-sm text-slate-600">
                <span>
                  <strong className="text-slate-900">{report.ceo.testsDetected}</strong> tests
                </span>
                <span>
                  <strong className="text-slate-900">{report.ceo.uniqueStudents}</strong> unique students
                </span>
                <span>
                  <strong className="text-slate-900">{report.ceo.qaIssuesCount}</strong> QA issues
                </span>
              </div>
            </div>
            <a
              href={`/api/report/export?${new URLSearchParams({
                exam: report.exam,
                track: report.track,
                classLevel: report.classLevel,
              }).toString()}`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            >
              ⬇ Download Excel Report
            </a>
          </div>

          <div className="flex gap-2 border-b border-slate-200">
            {(
              [
                ["vertical", "Vertical Summary"],
                ["region", "Region Summary"],
                ["history", "Student History"],
                ["qa", "Data QA"],
                ["source", "Source Control"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                  tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "vertical" && (
            <div>
              {report.tests.map((t, i) => (
                <DataTable key={i} block={t.vertical} />
              ))}
            </div>
          )}

          {tab === "region" && (
            <div>
              {report.tests.map((t, i) => (
                <DataTable key={i} block={t.region} />
              ))}
            </div>
          )}

          {tab === "history" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-max text-xs">
                <thead className="bg-emerald-700 text-white">
                  <tr>
                    {report.studentHistory.identityHeaders.map((h) => (
                      <th key={h} rowSpan={2} className="whitespace-nowrap border border-emerald-600 px-3 py-2">
                        {h}
                      </th>
                    ))}
                    {report.studentHistory.blocks.map((b, i) => (
                      <th key={i} colSpan={b.metrics.length} className="whitespace-nowrap border border-emerald-600 px-3 py-2">
                        {b.name} ({b.date})
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {report.studentHistory.blocks.map((b, bi) =>
                      b.metrics.map((m, mi) => (
                        <th key={`${bi}-${mi}`} className="whitespace-nowrap border border-emerald-500 bg-emerald-600 px-2 py-1 font-normal">
                          {m}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.studentHistory.rows.map((row, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                      {row.map((v, j) => (
                        <Cell key={j} value={v} />
                      ))}
                    </tr>
                  ))}
                  {!report.studentHistory.rows.length && (
                    <tr>
                      <td colSpan={20} className="px-3 py-4 text-center text-slate-400">
                        No students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "qa" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-amber-50">
                  <tr>
                    {["Issue Type", "Test", "Date", "Source File", "Registration No", "Details"].map((h) => (
                      <th key={h} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.qaIssues.map((q, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{q.issueType}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{q.test}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{q.date}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{q.sourceFile}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{q.registrationNo}</td>
                      <td className="border-b border-slate-100 px-3 py-1.5">{q.details}</td>
                    </tr>
                  ))}
                  {!report.qaIssues.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                        No QA issues detected. 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "source" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-amber-50">
                  <tr>
                    {["Exam", "Track", "Class Level", "Test", "Date", "Source File", "Component", "Raw Rows", "Unique Regs", "Blank Reg", "Status"].map(
                      (h) => (
                        <th key={h} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.sourceControl.map((s, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.exam}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{TRACK_LABEL[s.track] ?? s.track}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.classLevel}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.test}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.date}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.sourceFile}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.component}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.rawRows}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.uniqueRegistrations}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.blankRegistration}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
