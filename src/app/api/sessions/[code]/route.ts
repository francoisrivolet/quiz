import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await prisma.gameSession.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true, status: true, quiz: { select: { title: true } } },
  });

  if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  if (session.status !== "WAITING")
    return NextResponse.json({ error: "Cette session a déjà démarré" }, { status: 409 });

  return NextResponse.json(session);
}
