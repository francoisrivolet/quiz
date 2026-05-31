import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId } = await params;
  const { text, type, duration, points, answers } = await req.json();

  await prisma.questionAnswer.deleteMany({ where: { questionId } });

  const question = await prisma.question.update({
    where: { id: questionId },
    data: {
      text,
      type,
      duration,
      points,
      answers: {
        create: (answers ?? []).map((a: { text: string; isCorrect: boolean }) => ({
          text: a.text,
          isCorrect: a.isCorrect ?? false,
        })),
      },
    },
    include: { answers: true },
  });

  return NextResponse.json(question);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId } = await params;
  await prisma.question.delete({ where: { id: questionId } });
  return NextResponse.json({ success: true });
}
