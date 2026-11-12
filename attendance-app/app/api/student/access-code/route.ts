export async function POST() {
  return Response.json(
    { error: "Hyr me GitHub nga karta e studentit." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
