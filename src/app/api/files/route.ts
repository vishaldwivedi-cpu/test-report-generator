import { desc } from "drizzle-orm";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const files = await db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt));
  return Response.json({ files });
}
