"use client";

import ReportView from "@/components/ReportView";

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">NEET + JEE Automation</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Reports</h1>
        </div>
        <a href="/" className="text-sm font-semibold text-emerald-700 hover:underline">
          ← Upload / Manage Files
        </a>
      </header>

      <ReportView refreshKey={0} />
    </main>
  );
}
