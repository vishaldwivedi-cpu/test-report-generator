import { buildReport } from "@/lib/reportBuilder";
import type { ClassLevel } from "@/lib/detect";
import type { Track } from "@/lib/csvIngest";

export const dynamic = "force-dynamic";

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
  return Response.json({ report });
}
