"use client";

import { use, useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import Link from "next/link";

interface Player { id: string; nickname: string; score: number; rank: number; }

export default function AdminResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);

  useEffect(() => {
    // Charger le classement depuis l'API (cas où la page est ouverte après la fin)
    fetch(`/api/results/${sessionId}`)
      .then((r) => r.json())
      .then(({ leaderboard: lb }) => { if (lb) setLeaderboard(lb); })
      .catch(() => {});

    // Mettre à jour si l'événement socket arrive en direct
    const socket = getSocket();
    socket.on("quiz:finished", ({ leaderboard: lb }: { leaderboard: Player[] }) => {
      setLeaderboard(lb);
    });
    return () => { socket.off("quiz:finished"); };
  }, [sessionId]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black text-center mb-8">Résultats finaux</h1>

        {leaderboard.length === 0 ? (
          <p className="text-center text-gray-400">Chargement…</p>
        ) : (
          <>
            {/* Podium top 3 */}
            <div className="flex items-end justify-center gap-4 mb-8">
              {[leaderboard[1], leaderboard[0], leaderboard[2]].map((p, i) => {
                if (!p) return <div key={i} className="w-24" />;
                const heights = ["h-24", "h-32", "h-20"];
                const podiumPos = [2, 1, 3];
                return (
                  <div key={p.id} className="flex flex-col items-center">
                    <span className="text-2xl mb-1">{medals[podiumPos[i] - 1]}</span>
                    <div className={`bg-gray-700 rounded-t-xl w-24 ${heights[i]} flex items-end justify-center pb-2`}>
                      <span className="text-xs text-gray-300 text-center px-1 break-words">{p.nickname}</span>
                    </div>
                    <div className="bg-gray-600 w-24 py-1 text-center text-sm font-bold">{p.score} pts</div>
                  </div>
                );
              })}
            </div>

            {/* Classement complet */}
            <div className="bg-gray-800 rounded-2xl overflow-hidden mb-8">
              {leaderboard.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-700 last:border-0">
                  <span className="text-gray-400 w-8 text-sm font-bold">{p.rank}</span>
                  <span className="flex-1 font-medium">{p.nickname}</span>
                  <span className="text-yellow-400 font-bold">{p.score} pts</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Link
          href="/admin"
          className="block text-center bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
