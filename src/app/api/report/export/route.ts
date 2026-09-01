import ExcelJS from "exceljs";
import { buildReport } from "@/lib/reportBuilder";
import type { ClassLevel } from "@/lib/detect";
import { classLevelLabel } from "@/lib/detect";
import type { Track } from "@/lib/csvIngest";
import type { TableBlock } from "@/lib/reportBuilder";

export const dynamic = "force-dynamic";

const GREEN = "FF6E9E4F";
const DARK_GREEN = "FF4F7D37";
const LIGHT_GREEN = "FFE2F0D9";
const LIGHT_GOLD = "FFFFF2CC";
const WHITE = "FFFFFFFF";

function titleRow(ws: ExcelJS.Worksheet, text: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GREEN } };
  cell.font = { size: 16, bold: true, color: { argb: WHITE } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowIndex: number, count: number) {
  for (let c = 1; c <= count; c++) {
    const cell = ws.getCell(rowIndex, c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GOLD } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
}

function writeTableBlock(ws: ExcelJS.Worksheet, startRow: number, block: TableBlock): number {
  let row = startRow;
  ws.mergeCells(row, 1, row, block.headers.length);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = block.title;
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
  titleCell.font = { bold: true, size: 13, color: { argb: WHITE } };
  titleCell.alignment = { horizontal: "center" };
  row += 1;

  block.headers.forEach((h, i) => {
    ws.getCell(row, i + 1).value = h;
  });
  styleHeaderRow(ws, row, block.headers.length);
  row += 1;

  block.rows.forEach((r, i) => {
    r.forEach((v, j) => {
      const cell = ws.getCell(row + i, j + 1);
      cell.value = v;
      cell.alignment = { horizontal: "center" };
      if (i === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } };
        cell.font = { bold: true };
      }
    });
  });
  row += block.rows.length + 2;
  return row;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const exam = searchParams.get("exam");
  const track = searchParams.get("track");
  const classLevel = searchParams.get("classLevel");

  if (
    (exam !== "NEET" && exam !== "JEE") ||
    (track !== "NEET" && track !== "JEE_MAIN" && track !== "JEE_ADVANCED") ||
    (classLevel !== "11TH" && classLevel !== "12TH" && classLevel !== "DROPPER" && classLevel !== "UNKNOWN")
  ) {
    return Response.json({ error: "exam, track and classLevel query params are required" }, { status: 400 });
  }

  const report = await buildReport(exam, track as Track, classLevel as ClassLevel);
  if (!report) {
    return Response.json({ error: "No data found for this scope" }, { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "NEET+JEE Test Report Generator";

  // CEO Summary
  const ceo = wb.addWorksheet("CEO Summary");
  ceo.views = [{ showGridLines: false }];
  titleRow(ceo, report.title, 8);
  ceo.getCell(3, 1).value = "Tests Detected";
  ceo.getCell(3, 2).value = report.ceo.testsDetected;
  ceo.getCell(3, 4).value = "Unique Students";
  ceo.getCell(3, 5).value = report.ceo.uniqueStudents;
  ceo.getCell(3, 7).value = "QA Issues Logged";
  ceo.getCell(3, 8).value = report.ceo.qaIssuesCount;
  [1, 4, 7].forEach((c) => {
    ceo.getCell(3, c).font = { bold: true, color: { argb: WHITE } };
    ceo.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
  });
  [2, 5, 8].forEach((c) => {
    ceo.getCell(3, c).font = { bold: true, size: 13 };
    ceo.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } };
  });
  ceo.getColumn(1).width = 20;
  for (let c = 2; c <= 8; c++) ceo.getColumn(c).width = 16;

  // Vertical Summary
  const vSheet = wb.addWorksheet("Vertical Summary");
  vSheet.views = [{ showGridLines: false }];
  titleRow(vSheet, `${report.title} — VERTICAL-WISE`, Math.max(...report.tests.map((t) => t.vertical.headers.length), 8));
  let row = 3;
  for (const t of report.tests) row = writeTableBlock(vSheet, row, t.vertical);
  vSheet.columns.forEach((col) => (col.width = 16));

  // Region Summary
  const rSheet = wb.addWorksheet("Region Summary");
  rSheet.views = [{ showGridLines: false }];
  titleRow(rSheet, `${report.title} — REGION-WISE`, Math.max(...report.tests.map((t) => t.region.headers.length), 8));
  row = 3;
  for (const t of report.tests) row = writeTableBlock(rSheet, row, t.region);
  rSheet.columns.forEach((col) => (col.width = 18));

  // Student History
  const hSheet = wb.addWorksheet("Student History");
  hSheet.views = [{ showGridLines: false }];
  const totalCols = report.studentHistory.identityHeaders.length + report.studentHistory.blocks.reduce((a, b) => a + b.metrics.length, 0);
  titleRow(hSheet, `${report.title} — STUDENT TEST HISTORY`, totalCols);

  let col = 1;
  report.studentHistory.identityHeaders.forEach((h) => {
    hSheet.mergeCells(2, col, 3, col);
    const c = hSheet.getCell(2, col);
    c.value = h;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    c.font = { bold: true, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    col += 1;
  });
  for (const block of report.studentHistory.blocks) {
    hSheet.mergeCells(2, col, 2, col + block.metrics.length - 1);
    const c = hSheet.getCell(2, col);
    c.value = `${block.name}\n${block.date}`;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    c.font = { bold: true, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    block.metrics.forEach((m, k) => {
      const mc = hSheet.getCell(3, col + k);
      mc.value = m;
      mc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } };
      mc.font = { bold: true };
      mc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    col += block.metrics.length;
  }
  report.studentHistory.rows.forEach((r, i) => {
    r.forEach((v, j) => {
      hSheet.getCell(4 + i, j + 1).value = v;
    });
  });
  hSheet.getColumn(1).width = 14;
  hSheet.getColumn(2).width = 18;
  hSheet.getColumn(3).width = 26;
  hSheet.getColumn(4).width = 18;
  hSheet.getColumn(5).width = 30;
  for (let c = 6; c <= totalCols; c++) hSheet.getColumn(c).width = 14;
  hSheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: totalCols } };

  // Data QA
  const qaSheet = wb.addWorksheet("Data QA");
  qaSheet.views = [{ showGridLines: false }];
  titleRow(qaSheet, "DATA QA / AUDIT LOG", 6);
  const qaHeaders = ["Issue Type", "Test", "Date", "Source File", "Registration No", "Details"];
  qaHeaders.forEach((h, i) => (qaSheet.getCell(3, i + 1).value = h));
  styleHeaderRow(qaSheet, 3, qaHeaders.length);
  if (!report.qaIssues.length) {
    qaSheet.getCell(4, 1).value = "No QA issues detected.";
  } else {
    report.qaIssues.forEach((q, i) => {
      qaSheet.getCell(4 + i, 1).value = q.issueType;
      qaSheet.getCell(4 + i, 2).value = q.test;
      qaSheet.getCell(4 + i, 3).value = q.date;
      qaSheet.getCell(4 + i, 4).value = q.sourceFile;
      qaSheet.getCell(4 + i, 5).value = q.registrationNo;
      qaSheet.getCell(4 + i, 6).value = q.details;
    });
  }
  [28, 28, 16, 44, 20, 70].forEach((w, i) => (qaSheet.getColumn(i + 1).width = w));

  // Source Control
  const srcSheet = wb.addWorksheet("Source Control");
  srcSheet.views = [{ showGridLines: false }];
  titleRow(srcSheet, "SOURCE CONTROL — AUTO DISCOVERY", 11);
  const srcHeaders = ["Exam", "Track", "Class Level", "Test", "Date", "Source File", "Component", "Raw Rows", "Unique Registrations", "Blank Registration", "Status"];
  srcHeaders.forEach((h, i) => (srcSheet.getCell(3, i + 1).value = h));
  styleHeaderRow(srcSheet, 3, srcHeaders.length);
  report.sourceControl.forEach((s, i) => {
    const values = [s.exam, s.track, s.classLevel, s.test, s.date, s.sourceFile, s.component, s.rawRows, s.uniqueRegistrations, s.blankRegistration, s.status];
    values.forEach((v, j) => (srcSheet.getCell(4 + i, j + 1).value = v));
  });
  [10, 14, 14, 26, 14, 44, 12, 10, 18, 16, 10].forEach((w, i) => (srcSheet.getColumn(i + 1).width = w));

  const buffer = await wb.xlsx.writeBuffer();
  const filenameSafe = `${exam}_${track}_${classLevelLabel(classLevel as ClassLevel).replace(/\s+/g, "_")}_Report.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameSafe}"`,
    },
  });
}
