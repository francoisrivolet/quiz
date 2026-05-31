import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quizzes = await prisma.quiz.findMany({
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quizzes);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  const quiz = await prisma.quiz.create({ data: { title: title.trim(), description } });
  return NextResponse.json(quiz, { status: 201 });
}
