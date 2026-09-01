"use client";

import { useState } from "react";
import UploadPanel from "@/components/UploadPanel";
import FilesTable from "@/components/FilesTable";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">NEET + JEE Automation</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Fully Automatic Test Report Generator</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Upload CSVs from your test batches. Every file is auto-classified by <strong>exam</strong> (NEET / JEE),{" "}
          <strong>track</strong> (JEE Main / JEE Advanced), <strong>class level</strong> (11th / 12th / Dropper), and{" "}
          <strong>test date</strong> — no manual numbering or config needed. Add a CSV and it appears in the next
          report; delete one and it disappears.
        </p>
      </header>

      <div className="space-y-6">
        <UploadPanel onUploaded={() => setRefreshKey((k) => k + 1)} />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Uploaded Files</h2>
            <a href="/reports" className="text-sm font-semibold text-emerald-700 hover:underline">
              Go to Reports →
            </a>
          </div>
          <FilesTable refreshKey={refreshKey} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">How class level is detected</h2>
          <p className="mt-2 text-sm text-slate-600">
            Since a coaching group typically runs three parallel batches — <strong>11th Class</strong>,{" "}
            <strong>12th Class</strong>, and <strong>Dropper</strong> — every CSV filename is scanned for common
            institute naming patterns:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">11th</span>,{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Class 11</span>,{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">XI</span> → 11th Class
            </li>
            <li>
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">12th</span>,{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Class 12</span>,{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">XII</span> → 12th Class
            </li>
            <li>
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Dropper</span>,{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Target</span>,{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Repeater</span> → Dropper
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            Each combination of Exam × Track × Class Level becomes its own independent report (e.g. “NEET / 12th
            Class”, “JEE Advanced / Dropper”), exactly like the “NEET” and “JEE” reports were separate before — just
            one extra level of grouping. If the filename doesn&apos;t contain any of these hints, the file is marked{" "}
            <strong>Unclassified</strong> and you can fix it with one click in the table above (it will move into the
            correct report immediately).
          </p>
        </section>
      </div>
    </main>
  );
}
