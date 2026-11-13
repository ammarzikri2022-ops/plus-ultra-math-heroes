// A separate document navigation is needed when the welcome panel is served
// at /. A hash-only link would leave the portal mounted after guest entry.
// Authorization for the learning shell remains in app/page.tsx.
export function GET(request: Request) {
  return new Response(null, { status: 303, headers: { Location: new URL('/#rumah', request.url).href, 'Cache-Control': 'private, no-store' } });
}
