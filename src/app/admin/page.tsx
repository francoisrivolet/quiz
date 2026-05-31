"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Quiz {
  id: string;
  title: string;
  description?: string;
  _count: { questions: number };
}

export default function AdminPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/admin/quizzes")
      .then((r) => r.json())
      .then(setQuizzes);
  }, []);

  async function createQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const quiz = await res.json();
    setCreating(false);
    setTitle("");
    setShowForm(false);
    router.push(`/admin/quizzes/${quiz.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Quiz Admin</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nouveau quiz
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {showForm && (
          <form
            onSubmit={createQuiz}
            className="bg-white rounded-xl border p-4 mb-6 flex gap-3"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du quiz"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Créer
            </button>
          </form>
        )}

        {quizzes.length === 0 ? (
          <p className="text-center text-gray-400 py-16">Aucun quiz. Créez-en un !</p>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                onClick={() => router.push(`/admin/quizzes/${quiz.id}`)}
                className="bg-white rounded-xl border px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{quiz.title}</p>
                  <p className="text-sm text-gray-400">
                    {quiz._count.questions} question{quiz._count.questions !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-gray-300 text-lg flex-shrink-0">›</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
