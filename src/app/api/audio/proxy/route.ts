import { NextResponse } from "next/server";

// Allow any subdomain of dzcdn.net (Deezer's CDN)
function isDeezerCdn(hostname: string) {
  return hostname === "dzcdn.net" || hostname.endsWith(".dzcdn.net");
}

async function fetchFreshUrl(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.deezer.com/track/${encodeURIComponent(trackId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.preview === "string" ? data.preview : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get("trackId");
  let rawUrl = searchParams.get("url");

  // If trackId given, always fetch a fresh URL from Deezer API
  if (trackId) {
    rawUrl = await fetchFreshUrl(trackId);
    if (!rawUrl) {
      return NextResponse.json({ error: "Track not found on Deezer" }, { status: 404 });
    }
  }

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url or trackId" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isDeezerCdn(parsed.hostname)) {
    return NextResponse.json({ error: "Forbidden domain" }, { status: 403 });
  }

  const upstreamHeaders: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) upstreamHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, { headers: upstreamHeaders });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "audio/mpeg");
  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Cache-Control", "public, max-age=3600");
  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) responseHeaders.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("Content-Range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
