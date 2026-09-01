"use client";

import { useEffect, useState, useCallback } from "react";

interface FileRow {
  id: number;
  filename: string;
  exam: string;
  track: string;
  classLevel: string;
  family: string;
  component: string;
  testDate: string;
  status: string;
  errorMessage: string | null;
  rawRowCount: number;
  uniqueRegistrations: number;
  createdAt: string;
}

const CLASS_LEVEL_LABEL: Record<string, string> = {
  "11TH": "11th Class",
  "12TH": "12th Class",
  DROPPER: "Dropper",
  UNKNOWN: "Unclassified",
};

const TRACK_LABEL: Record<string, string> = {
  NEET: "NEET",
  JEE_MAIN: "JEE Main",
  JEE_ADVANCED: "JEE Advanced",
};

export default function FilesTable({ refreshKey }: { refreshKey: number }) {
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/files", { cache: "no-store" });
    const data = await res.json();
    setFiles(data.files ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function updateClassLevel(id: number, classLevel: string) {
    setBusyId(id);
    await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classLevel }),
    });
    await load();
    setBusyId(null);
  }

  async function remove(id: number) {
    setBusyId(id);
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    await load();
    setBusyId(null);
  }

  if (!files) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading files…</div>;
  }

  if (!files.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No CSV files uploaded yet. Upload some above to auto-generate reports.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Exam</th>
            <th className="px-4 py-3">Track</th>
            <th className="px-4 py-3">Class Level</th>
            <th className="px-4 py-3">Family</th>
            <th className="px-4 py-3">Component</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Rows</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((f) => (
            <tr key={f.id} className={busyId === f.id ? "opacity-50" : ""}>
              <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-800" title={f.filename}>
                {f.filename}
              </td>
              <td className="px-4 py-3">{f.exam}</td>
              <td className="px-4 py-3">{TRACK_LABEL[f.track] ?? f.track}</td>
              <td className="px-4 py-3">
                <select
                  value={f.classLevel}
                  disabled={busyId === f.id}
                  onChange={(e) => updateClassLevel(f.id, e.target.value)}
                  className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                    f.classLevel === "UNKNOWN"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-slate-300 bg-slate-50 text-slate-700"
                  }`}
                >
                  <option value="11TH">11th Class</option>
                  <option value="12TH">12th Class</option>
                  <option value="DROPPER">Dropper</option>
                  <option value="UNKNOWN">Unclassified</option>
                </select>
              </td>
              <td className="px-4 py-3">{f.family}</td>
              <td className="px-4 py-3">{f.component || "—"}</td>
              <td className="px-4 py-3">{f.testDate}</td>
              <td className="px-4 py-3">{f.uniqueRegistrations}</td>
              <td className="px-4 py-3">
                {f.status === "OK" ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">OK</span>
                ) : (
                  <span
                    className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                    title={f.errorMessage ?? ""}
                  >
                    ERROR
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => remove(f.id)}
                  disabled={busyId === f.id}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
