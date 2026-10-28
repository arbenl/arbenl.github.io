import { AuthorizationError, requireCurrentStaff } from "../../../../../../lib/auth/session";
import { readPrivateMaterial } from "../../../../../../lib/materials/week-07";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Vary": "Cookie", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN",
};

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  try {
    await requireCurrentStaff();
    const { file: name } = await context.params;
    const file = readPrivateMaterial(name);
    if (!file) return Response.json({ error: "Materiali nuk u gjet" }, { status: 404, headers: privateHeaders });
    const download = name.endsWith(".pptx") || name.endsWith(".md");
    return new Response(new Uint8Array(file.bytes), {
      headers: { ...privateHeaders, "Content-Type": file.mime,
        ...(download ? { "Content-Disposition": `attachment; filename="${name}"` } : {}) },
    });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 503;
    return Response.json({ error: status === 503 ? "Materialet private nuk janë në dispozicion tani" : "Hyrja lejohet vetëm për profesorin e autorizuar" }, { status, headers: privateHeaders });
  }
}
