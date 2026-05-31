"use client";

import { use, useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import Link from "next/link";

interface Player { id: string; nickname: string; score: number; rank: number; }

const medals = ["🥇", "🥈", "🥉"];

export default function PlayerResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [myNickname, setMyNickname] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("quiz_player");
    const data = stored ? JSON.parse(stored) : {};
    setMyNickname(data.nickname ?? "");

    fetch(`/api/results/${sessionId}`)
      .then((r) => r.json())
      .then(({ leaderboard: lb }) => { if (lb) setLeaderboard(lb); })
      .catch(() => {});

    const socket = getSocket();
    socket.on("quiz:finished", ({ leaderboard: lb }: { leaderboard: Player[] }) => {
      setLeaderboard(lb);
    });
    return () => { socket.off("quiz:finished"); };
  }, [sessionId]);

  const myRank = leaderboard.find((p) => p.nickname === myNickname)?.rank ?? null;
  const myScore = leaderboard.find((p) => p.nickname === myNickname)?.score ?? 0;

  return (
    <div className="h-dvh bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header résultat perso */}
      <div className={`flex-none px-5 pt-10 pb-6 text-center ${myRank === 1 ? "bg-yellow-500/10" : ""}`}>
        <div className="text-5xl mb-2">
          {myRank && myRank <= 3 ? medals[myRank - 1] : "🎉"}
        </div>
        <h1 className="text-2xl font-black mb-1">
          {myRank === 1 ? "Tu as gagné !" : myRank ? `${myRank}ème place` : "Quiz terminé !"}
        </h1>
        {myScore > 0 && (
          <p className="text-yellow-400 font-bold text-lg">{myScore} pts</p>
        )}
      </div>

      {/* Classement — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {leaderboard.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 animate-pulse">Chargement…</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl overflow-hidden mb-4">
            {leaderboard.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-4 px-5 py-4 border-b border-gray-700/50 last:border-0 ${p.nickname === myNickname ? "bg-blue-500/10" : ""}`}
              >
                <span className="w-8 text-center text-lg">
                  {p.rank <= 3 ? medals[p.rank - 1] : <span className="text-gray-500 text-sm font-bold">{p.rank}</span>}
                </span>
                <span className={`flex-1 font-medium ${p.nickname === myNickname ? "text-blue-300" : ""}`}>
                  {p.nickname}
                </span>
                <span className="text-yellow-400 font-bold">{p.score} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bouton fixe en bas */}
      <div className="flex-none px-4 pb-safe pt-2 pb-6">
        <Link
          href="/join"
          onClick={() => localStorage.removeItem("quiz_player")}
          className="block text-center bg-gray-700 active:bg-gray-600 text-white font-bold py-4 rounded-2xl"
        >
          Rejoindre un autre quiz
        </Link>
      </div>
    </div>
  );
}
