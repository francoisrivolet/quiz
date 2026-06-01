import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quizId } = await params;
  const { text, imageUrl, type, duration, points, answers } = await req.json();

  if (!text?.trim()) return NextResponse.json({ error: "Texte requis" }, { status: 400 });

  const count = await prisma.question.count({ where: { quizId } });

  const question = await prisma.question.create({
    data: {
      quizId,
      text: text.trim(),
      imageUrl: imageUrl?.trim() || null,
      type: type ?? "SINGLE_CHOICE",
      order: count,
      duration: duration ?? 30,
      points: points ?? 100,
      answers: {
        create: (answers ?? []).map((a: { text: string; isCorrect: boolean }) => ({
          text: a.text,
          isCorrect: a.isCorrect ?? false,
        })),
      },
    },
    include: { answers: true },
  });

  return NextResponse.json(question, { status: 201 });
}
