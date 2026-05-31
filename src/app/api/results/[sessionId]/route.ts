import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const players = await prisma.sessionPlayer.findMany({
    where: { sessionId },
    orderBy: { score: "desc" },
  });

  if (!players.length) {
    return NextResponse.json({ leaderboard: [] });
  }

  const leaderboard = players.map((p, i) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    rank: i + 1,
  }));

  return NextResponse.json({ leaderboard });
}
