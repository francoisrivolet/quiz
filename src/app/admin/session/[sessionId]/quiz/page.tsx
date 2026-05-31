"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

type Phase = "idle" | "question" | "results";

interface Question {
  id: string; text: string; type: string; duration: number; points: number;
  index: number; total: number; answers: { id: string; text: string }[];
}
interface QuestionResult {
  question: { id: string; text: string; type: string; answers: { id: string; text: string; isCorrect: boolean }[] };
  playerAnswers: { playerId: string; nickname: string; answer: string; isCorrect: boolean; pointsEarned: number }[];
  leaderboard: { id: string; nickname: string; score: number; rank: number }[];
  isLastQuestion: boolean;
}

export default function AdminQuizPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [answered, setAnswered] = useState({ count: 0, total: 0 });

  useEffect(() => {
    const socket = getSocket();
    socket.emit("admin:join", { sessionId });

    socket.on("question:started", ({ question: q, startTime: st }: { question: Question; startTime: number }) => {
      setQuestion(q);
      setStartTime(st);
      setTimeLeft(q.duration);
      setAnswered({ count: 0, total: 0 });
      setPhase("question");
    });

    socket.on("session:answer-count", ({ answered: a, total }: { answered: number; total: number }) => {
      setAnswered({ count: a, total });
    });

    socket.on("question:ended", (data: QuestionResult) => {
      setResult(data);
      setPhase("results");
    });

    socket.on("quiz:finished", ({ leaderboard }: { leaderboard: QuestionResult["leaderboard"] }) => {
      router.push(`/admin/session/${sessionId}/results`);
    });

    function onReconnect() {
      socket.emit("admin:join", { sessionId });
    }
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("question:started");
      socket.off("session:answer-count");
      socket.off("question:ended");
      socket.off("quiz:finished");
      socket.io.off("reconnect", onReconnect);
    };
  }, [sessionId, router]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "question" || !startTime) return;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, (question?.duration ?? 0) - elapsed);
      setTimeLeft(Math.ceil(remaining));
    }, 200);
    return () => clearInterval(iv);
  }, [phase, startTime, question?.duration]);

  function nextQuestion() {
    getSocket().emit("admin:next-question", { sessionId });
  }

  function finishQuiz() {
    getSocket().emit("admin:finish-quiz", { sessionId });
  }

  function endQuestion() {
    getSocket().emit("admin:end-question", { sessionId });
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-2xl mx-auto">

        {/* IDLE */}
        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <p className="text-gray-400 mb-6">Quiz prêt. Lancez la première question.</p>
            <button
              onClick={nextQuestion}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-2xl text-lg"
            >
              Première question →
            </button>
          </div>
        )}

        {/* QUESTION ACTIVE */}
        {phase === "question" && question && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-400">Question {question.index + 1} / {question.total}</span>
              <span className="text-sm text-gray-400">{question.points} pts</span>
            </div>

            <div className={`text-6xl font-black text-center mb-2 ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>
              {timeLeft}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-8">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${(timeLeft / (question.duration)) * 100}%` }}
              />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 mb-6">
              <p className="text-xl font-semibold text-center">{question.text}</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-6 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Réponses reçues</span>
              <span className="font-bold text-2xl">{answered.count} / {answered.total || "?"}</span>
            </div>

            <button
              onClick={endQuestion}
              className="w-full border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white py-3 rounded-xl text-sm transition-colors"
            >
              Terminer la question maintenant
            </button>
          </div>
        )}

        {/* RESULTS */}
        {phase === "results" && result && (
          <div>
            <div className="bg-gray-800 rounded-2xl p-6 mb-6">
              <p className="text-lg font-semibold mb-4">{result.question.text}</p>
              <div className="space-y-2">
                {result.question.answers.map((a) => (
                  <div
                    key={a.id}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${a.isCorrect ? "bg-green-500/20 text-green-300 border border-green-500/40" : "bg-gray-700 text-gray-400"}`}
                  >
                    {a.isCorrect ? "✓ " : ""}{a.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-400 mb-3">Classement</p>
              {result.leaderboard.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <span className="text-gray-500 w-6 text-sm">{p.rank}</span>
                  <span className="flex-1 font-medium">{p.nickname}</span>
                  <span className="text-yellow-400 font-bold">{p.score} pts</span>
                </div>
              ))}
            </div>

            <button
              onClick={result.isLastQuestion ? finishQuiz : nextQuestion}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl text-lg"
            >
              {result.isLastQuestion ? "Voir les résultats finaux →" : "Question suivante →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
