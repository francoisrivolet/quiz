import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quizId } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { answers: true },
      },
    },
  });
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quiz);
}

export async function PUT(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quizId } = await params;
  const { title, description } = await req.json();

  const quiz = await prisma.quiz.update({
    where: { id: quizId },
    data: { title, description },
  });
  return NextResponse.json(quiz);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quizId } = await params;
  await prisma.quiz.delete({ where: { id: quizId } });
  return NextResponse.json({ success: true });
}
