import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface DeezerTrackRaw {
  id: number;
  title: string;
  preview: string;
  artist: { name: string };
  album: { cover_medium: string };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Paramètre q requis" }, { status: 400 });

  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return NextResponse.json({ error: "Erreur Deezer" }, { status: 502 });

  const json = await res.json();

  return NextResponse.json(
    (json.data ?? []).map((t: DeezerTrackRaw) => ({
      id: String(t.id),
      title: t.title,
      artist: t.artist.name,
      cover: t.album.cover_medium,
      preview: t.preview,
    }))
  );
}
