"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resumeData, setResumeData] = useState<{ sessionId: string; nickname: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("quiz_player");
    if (stored) {
      const data = JSON.parse(stored);
      setResumeData({ sessionId: data.sessionId, nickname: data.nickname });
    }
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const upperCode = code.trim().toUpperCase();
    if (!upperCode || !nickname.trim()) return;

    setLoading(true);
    const res = await fetch(`/api/sessions/${upperCode}`);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Session introuvable");
      setLoading(false);
      return;
    }
    await res.json();

    const socket = getSocket();

    socket.once("player:joined", ({ sessionId, playerId, nickname: nick }) => {
      localStorage.setItem("quiz_player", JSON.stringify({ sessionId, playerId, nickname: nick }));
      router.push(`/session/${sessionId}/waiting`);
    });

    socket.once("error", ({ message }: { message: string }) => {
      setError(message);
      setLoading(false);
      socket.off("player:joined");
    });

    socket.emit("player:join", { code: upperCode, nickname: nickname.trim() });
  }

  return (
    <div className="h-dvh bg-gray-900 flex flex-col px-5 py-safe">
      {/* Logo / titre */}
      <div className="flex-none pt-12 pb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎯</span>
        </div>
        <h1 className="text-2xl font-black text-white">Rejoindre un quiz</h1>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col justify-center gap-4 max-w-sm w-full mx-auto">
        {resumeData && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-sm text-blue-300 mb-1">Partie en cours</p>
            <p className="text-white font-bold mb-3">{resumeData.nickname}</p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/session/${resumeData.sessionId}/play`)}
                className="flex-1 bg-blue-500 active:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm"
              >
                Reprendre
              </button>
              <button
                onClick={() => { localStorage.removeItem("quiz_player"); setResumeData(null); }}
                className="px-4 py-2.5 text-gray-400 text-sm"
              >
                Ignorer
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CODE"
            autoCapitalize="characters"
            className="w-full bg-gray-800 text-white text-center text-4xl font-black tracking-widest border-2 border-gray-700 focus:border-blue-500 rounded-2xl px-4 py-5 outline-none uppercase"
          />

          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Ton pseudo"
            className="w-full bg-gray-800 text-white text-center text-xl border-2 border-gray-700 focus:border-blue-500 rounded-2xl px-4 py-4 outline-none"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || !nickname.trim()}
            className="w-full bg-blue-500 active:bg-blue-600 disabled:opacity-40 text-white font-bold py-5 rounded-2xl text-lg transition-colors mt-1"
          >
            {loading ? "Connexion…" : "Rejoindre →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}
