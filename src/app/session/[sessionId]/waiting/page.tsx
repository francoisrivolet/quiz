"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function PlayerWaitingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [players, setPlayers] = useState<string[]>([]);
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("quiz_player");
    if (!stored) { router.replace("/join"); return; }
    const data = JSON.parse(stored);
    if (data.sessionId !== sessionId) { router.replace("/join"); return; }
    setNickname(data.nickname);

    const socket = getSocket();

    socket.on("waiting-room:update", ({ players: p }: { players: string[] }) => {
      setPlayers(p);
    });

    socket.on("quiz:started", () => {
      router.push(`/session/${sessionId}/play`);
    });

    socket.emit("player:rejoin", { sessionId, playerId: data.playerId });

    return () => {
      socket.off("waiting-room:update");
      socket.off("quiz:started");
    };
  }, [sessionId, router]);

  return (
    <div className="h-dvh bg-gray-900 text-white flex flex-col px-5 py-safe">
      {/* Header avatar */}
      <div className="flex-none pt-10 pb-6 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-3xl font-black">
          {nickname?.[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{nickname}</p>
          <p className="text-gray-400 text-sm">Tu es connecté !</p>
        </div>
      </div>

      {/* Liste des joueurs — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gray-800 rounded-2xl p-5 max-w-sm mx-auto">
          <p className="text-sm text-gray-400 text-center mb-4">
            {players.length} joueur{players.length !== 1 ? "s" : ""} dans la salle
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {players.map((p) => (
              <span
                key={p}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  p === nickname ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"
                }`}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer statut */}
      <div className="flex-none pb-8 flex items-center justify-center gap-2 text-gray-400 text-sm">
        <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full inline-block" />
        En attente de l&apos;hôte…
      </div>
    </div>
  );
}
