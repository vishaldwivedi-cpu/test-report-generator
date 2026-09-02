import Papa from "papaparse";
import { db } from "@/db";
import { uploadedFiles, testRecords } from "@/db/schema";
import { standardizeCsv } from "@/lib/csvIngest";
import { parseXlsx } from "@/lib/xlsxIngest";
import {
  inferClassLevel,
  inferComponent,
  inferDate,
  inferExam,
  inferFamily,
  inferJeeType,
} from "@/lib/detect";
import type { ClassLevel } from "@/lib/detect";

export const dynamic = "force-dynamic";

interface UploadResult {
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
}

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const classLevelOverride = form.get("classLevel");
  const examOverride = form.get("exam");

  if (!files.length) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  const results: UploadResult[] = [];

  for (const file of files) {
    const filename = file.name;
    try {
      const isExcel = /\.xlsx?$/i.test(filename);

      let columns: string[];
      let data: Record<string, string>[];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const sheet = await parseXlsx(buffer);
        columns = sheet.columns;
        data = sheet.rows;
      } else {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });

        if (parsed.errors?.length) {
          const fatal = parsed.errors.filter((e) => e.type !== "FieldMismatch");
          if (fatal.length && (!parsed.data || parsed.data.length === 0)) {
            throw new Error(fatal[0].message);
          }
        }

        columns = parsed.meta.fields ?? [];
        data = parsed.data;
      }

      if (!columns.length) throw new Error("Could not detect any columns in the file header.");

      const exam = (examOverride === "NEET" || examOverride === "JEE" ? examOverride : inferExam(filename)) as
        | "NEET"
        | "JEE";
      const jeeType = inferJeeType(filename);
      const family = inferFamily(filename);
      const date = inferDate(filename);
      const detectedClassLevel = inferClassLevel(filename);
      const classLevel = (
        classLevelOverride === "11TH" ||
        classLevelOverride === "12TH" ||
        classLevelOverride === "DROPPER" ||
        classLevelOverride === "UNKNOWN"
          ? classLevelOverride
          : detectedClassLevel
      ) as ClassLevel;

      const testType = exam === "NEET" ? "NEET" : jeeType;
      const component = inferComponent(filename, testType, columns);

      const result = standardizeCsv(data, columns, exam, jeeType, filename);

      const [fileRow] = await db
        .insert(uploadedFiles)
        .values({
          filename,
          exam,
          track: result.track,
          classLevel,
          family,
          component,
          testDate: date,
          status: "OK",
          rawRowCount: result.rawRowCount,
          uniqueRegistrations: result.uniqueRegistrations,
          blankRegistrations: result.blankRegistrations,
          qaIssues: result.qaIssues,
        })
        .returning();

      if (result.records.length) {
        const values = result.records.map((r) => ({
          fileId: fileRow.id,
          registrationNo: r.registrationNo,
          studentName: r.studentName,
          vertical: r.vertical,
          region: r.region,
          center: r.center,
          rank: r.rank === null ? null : String(r.rank),
          total: r.total === null ? null : String(r.total),
          physics: r.physics === null ? null : String(r.physics),
          chemistry: r.chemistry === null ? null : String(r.chemistry),
          maths: r.maths === null ? null : String(r.maths),
          botany: r.botany === null ? null : String(r.botany),
          zoology: r.zoology === null ? null : String(r.zoology),
          paper1: r.paper1 === null ? null : String(r.paper1),
          paper2: r.paper2 === null ? null : String(r.paper2),
          p1Physics: r.p1Physics === null ? null : String(r.p1Physics),
          p1Chemistry: r.p1Chemistry === null ? null : String(r.p1Chemistry),
          p1Maths: r.p1Maths === null ? null : String(r.p1Maths),
          p1Total: r.p1Total === null ? null : String(r.p1Total),
          p1Rank: r.p1Rank === null ? null : String(r.p1Rank),
          p2Physics: r.p2Physics === null ? null : String(r.p2Physics),
          p2Chemistry: r.p2Chemistry === null ? null : String(r.p2Chemistry),
          p2Maths: r.p2Maths === null ? null : String(r.p2Maths),
          p2Total: r.p2Total === null ? null : String(r.p2Total),
          p2Rank: r.p2Rank === null ? null : String(r.p2Rank),
        }));

        const chunkSize = 500;
        for (let i = 0; i < values.length; i += chunkSize) {
          await db.insert(testRecords).values(values.slice(i, i + chunkSize));
        }
      }

      results.push({
        filename,
        status: "OK",
        exam,
        track: result.track,
        classLevel,
        family,
        date,
        component,
        rows: result.records.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exam = inferExam(filename);
      await db.insert(uploadedFiles).values({
        filename,
        exam,
        track: exam === "NEET" ? "NEET" : inferJeeType(filename) === "ADVANCED" ? "JEE_ADVANCED" : "JEE_MAIN",
        classLevel: inferClassLevel(filename),
        family: inferFamily(filename),
        component: "",
        testDate: inferDate(filename),
        status: "ERROR",
        errorMessage: message,
        rawRowCount: 0,
        uniqueRegistrations: 0,
        blankRegistrations: 0,
        qaIssues: [],
      });
      results.push({ filename, status: "ERROR", error: message });
    }
  }

  return Response.json({ results });
}
