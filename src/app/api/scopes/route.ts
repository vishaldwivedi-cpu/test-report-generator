import { listAvailableScopes } from "@/lib/reportBuilder";

export const dynamic = "force-dynamic";

export async function GET() {
  const scopes = await listAvailableScopes();
  return Response.json({ scopes });
}
