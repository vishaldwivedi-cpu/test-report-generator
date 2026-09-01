"use client";

import { useRef, useState } from "react";

type UploadOutcome = {
  filename: string;
  status: "OK" | "ERROR";
  exam?: string;
  track?: string;
  classLevel?: string;
  family?: string;
  date?: string;
  component?: string;
  rows?: number;
  error?: string;
};

const CLASS_LEVEL_LABEL: Record<string, string> = {
  "11TH": "11th Class",
  "12TH": "12th Class",
  DROPPER: "Dropper",
  UNKNOWN: "Unclassified",
};

export default function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [classLevelOverride, setClassLevelOverride] = useState("AUTO");
  const [results, setResults] = useState<UploadOutcome[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    setResults(null);
    try {
      const form = new FormData();
      Array.from(fileList).forEach((f) => form.append("files", f));
      if (classLevelOverride !== "AUTO") form.append("classLevel", classLevelOverride);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      setResults(data.results ?? []);
      onUploaded();
    } catch (err) {
      setResults([{ filename: "Upload", status: "ERROR", error: String(err) }]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Upload Test CSVs</h2>
      <p className="mt-1 text-sm text-slate-600">
        Drop NEET or JEE (Main/Advanced) result CSVs here. The system auto-detects exam, track,
        component (Paper 1/2), date, and{" "}
        <span className="font-medium text-slate-800">class level (11th / 12th / Dropper)</span> from the
        filename. Delete a file any time and it disappears from the next report.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Class level override:</label>
        <select
          value={classLevelOverride}
          onChange={(e) => setClassLevelOverride(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="AUTO">Auto-detect from filename</option>
          <option value="11TH">Force 11th Class</option>
          <option value="12TH">Force 12th Class</option>
          <option value="DROPPER">Force Dropper</option>
          <option value="UNKNOWN">Force Unclassified</option>
        </select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
          dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm font-medium text-slate-700">
          {uploading ? "Uploading & parsing…" : "Click to browse or drag & drop CSV files"}
        </p>
        <p className="mt-1 text-xs text-slate-500">Multiple files supported — e.g. Paper 1 & Paper 2 for the same Advanced test.</p>
      </div>

      {results && (
        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm ${
                r.status === "OK" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <span className="font-medium">{r.filename}</span>
              {r.status === "OK" ? (
                <span className="ml-2 text-xs text-emerald-700">
                  {r.exam} · {r.track} · {CLASS_LEVEL_LABEL[r.classLevel ?? ""] ?? r.classLevel} · {r.family} ·{" "}
                  {r.date} {r.component ? `· ${r.component}` : ""} · {r.rows} rows
                </span>
              ) : (
                <span className="ml-2 text-xs">{r.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
