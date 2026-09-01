import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import type { ClassLevel } from "@/lib/detect";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isFinite(fileId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  return Response.json({ ok: true });
}

const VALID_CLASS_LEVELS: ClassLevel[] = ["11TH", "12TH", "DROPPER", "UNKNOWN"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isFinite(fileId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: Partial<{ classLevel: ClassLevel; exam: string; track: string }> = {};

  if (typeof body.classLevel === "string" && VALID_CLASS_LEVELS.includes(body.classLevel)) {
    updates.classLevel = body.classLevel;
  }
  if (body.exam === "NEET" || body.exam === "JEE") {
    updates.exam = body.exam;
  }
  if (body.track === "NEET" || body.track === "JEE_MAIN" || body.track === "JEE_ADVANCED") {
    updates.track = body.track;
  }

  if (!Object.keys(updates).length) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(uploadedFiles)
    .set(updates)
    .where(eq(uploadedFiles.id, fileId))
    .returning();

  return Response.json({ file: updated });
}
