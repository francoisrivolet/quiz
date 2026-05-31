import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/session-code";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quizId } = await req.json();
  if (!quizId) return NextResponse.json({ error: "quizId requis" }, { status: 400 });

  // Generate unique code
  let code = generateCode();
  while (await prisma.gameSession.findUnique({ where: { code } })) {
    code = generateCode();
  }

  const gameSession = await prisma.gameSession.create({
    data: { quizId, code },
  });

  return NextResponse.json(gameSession, { status: 201 });
}
