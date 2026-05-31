"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import QRCode from "react-qr-code";

interface Player { id: string; nickname: string; }
interface SessionInfo { id: string; code: string; status: string; players: Player[]; }

export default function AdminWaitingRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [starting, setStarting] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    socket.emit("admin:join", { sessionId });

    socket.on("admin:joined", ({ session: s }: { session: SessionInfo }) => {
      setSession(s);
      setPlayers(s.players);
    });

    socket.on("waiting-room:update", ({ players: p }: { players: string[] }) => {
      setPlayers(p.map((nickname, i) => ({ id: String(i), nickname })));
    });

    socket.on("quiz:started", () => {
      router.push(`/admin/session/${sessionId}/quiz`);
    });

    return () => {
      socket.off("admin:joined");
      socket.off("waiting-room:update");
      socket.off("quiz:started");
    };
  }, [sessionId, router]);

  function startQuiz() {
    if (players.length === 0) return;
    setStarting(true);
    getSocket().emit("admin:start-quiz", { sessionId });
  }

  const joinUrl = session && origin
    ? `${origin}/join?code=${session.code}`
    : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <p className="text-gray-400 text-center text-sm mb-2">Code de session</p>
        <div className="bg-white text-gray-900 rounded-2xl py-6 text-center mb-6">
          <span className="text-5xl font-black tracking-widest">{session?.code ?? "…"}</span>
        </div>

        {joinUrl && (
          <div className="bg-gray-800 rounded-2xl p-6 mb-6 flex flex-col items-center gap-4">
            <p className="text-sm text-gray-400">Lien pour rejoindre</p>
            <a
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm font-mono break-all text-center"
            >
              {joinUrl}
            </a>
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={joinUrl} size={160} />
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-sm text-gray-400 mb-4">
            {players.length} joueur{players.length !== 1 ? "s" : ""} connecté{players.length !== 1 ? "s" : ""}
          </p>
          {players.length === 0 ? (
            <p className="text-gray-500 text-center py-4">En attente de joueurs…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <span key={p.id} className="bg-gray-700 rounded-full px-3 py-1 text-sm">
                  {p.nickname}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={startQuiz}
          disabled={players.length === 0 || starting}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {starting ? "Démarrage…" : "Démarrer le quiz"}
        </button>
      </div>
    </div>
  );
}
