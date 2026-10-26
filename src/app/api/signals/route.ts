// Signals are computed client-side to avoid serverless timeout.
// This route is unused but kept for future server-side caching.
export async function GET() {
  return new Response("Use client-side signal computation", { status: 200 });
}
