import * as XLSX from "xlsx";

export interface ParsedSheet {
  columns: string[];
  rows: Record<string, string>[];
}

/**
 * Reads an .xlsx/.xls file buffer into the same { columns, rows } shape our
 * CSV pipeline expects, so standardizeCsv() can consume either format
 * identically.
 *
 * Uses SheetJS rather than exceljs: some real-world exports (seen from PW's
 * own export tooling) write technically-valid but non-standard OOXML, e.g.
 * wrapping every tag in a namespace prefix (`<x:workbook><x:sheets>...`
 * instead of `<workbook><sheets>...`). Excel/Google Sheets open these fine,
 * but exceljs's parser silently fails to find the sheet list. SheetJS's
 * parser is far more tolerant of this kind of variation.
 *
 * Picks the worksheet with the most data rows (handles files that have an
 * extra summary/instructions tab before the real "Export" data tab).
 * Percentage-formatted cells (e.g. a 0.96 cell styled as "96.00%") are
 * rendered back out as "96.00%" text so downstream percentage parsing
 * behaves the same whether the source was CSV or XLSX.
 */
export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellNF: true });

  let best: ParsedSheet | null = null;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet["!ref"]) continue;

    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    const headerRowIdx = range.s.r;

    const columns: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
      const text = cell ? String(cell.v ?? "").trim() : "";
      columns[c - range.s.c] = text;
    }
    if (!columns.some(Boolean)) continue;

    const rows: Record<string, string>[] = [];
    for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
      const record: Record<string, string> = {};
      let hasValue = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const colName = columns[c - range.s.c];
        if (!colName) continue;
        const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
        const text = cellToText(cell);
        if (text !== "") hasValue = true;
        record[colName] = text;
      }
      if (hasValue) rows.push(record);
    }

    if (rows.length && (!best || rows.length > best.rows.length)) {
      best = { columns: columns.filter(Boolean), rows };
    }
  }

  if (!best) throw new Error("Could not find a data sheet with a header row in this .xlsx file.");
  return best;
}

function cellToText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === null || cell.v === undefined) return "";

  // Deliberately NOT using cell.z (number format) to detect percentages here.
  // Some real-world exports (this app has seen files from PW's own export
  // tooling) write technically-valid but non-standard OOXML where styles.xml
  // is also namespace-prefixed (`<x:numFmt>` instead of `<numFmt>`), which
  // breaks SheetJS's format table and causes it to mis-tag plain columns
  // (Out of, Score, Rank) as percentages while leaving genuine percentage
  // columns (Avg. Physics %) as bare fractions. Rather than trust unreliable
  // formatting metadata, we emit every number plainly here; the specific
  // Avg.% columns are matched by header name downstream and their bare
  // 0-1 fractions are correctly interpreted as percentages by toPercent()
  // in detect.ts - which is safe because OOXML percent cells always store
  // the underlying fraction regardless of whether the format string parses.

  if (cell.t === "d" && cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }

  if (typeof cell.v === "number") {
    // Trim floating point noise (e.g. 0.30000000000000004) without adding
    // false precision to genuine integers.
    return String(Math.round(cell.v * 1e10) / 1e10);
  }

  return String(cell.v).trim();
}

