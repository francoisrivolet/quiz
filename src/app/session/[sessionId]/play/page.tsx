"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

type Phase = "waiting" | "question" | "answered" | "results";
type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT";

interface Question {
  id: string; text: string; imageUrl?: string | null; audioPreviewUrl?: string | null;
  type: QuestionType; duration: number; points: number; index: number; total: number;
  answers: { id: string; text: string }[];
}
interface QuestionResult {
  question: { id: string; text: string; imageUrl?: string | null; type: QuestionType; answers: { id: string; text: string; isCorrect: boolean }[] };
  playerAnswers: { playerId: string; answer: string; isCorrect: boolean; pointsEarned: number }[];
  leaderboard: { id: string; nickname: string; score: number; rank: number }[];
  isLastQuestion: boolean;
}

const ANSWER_COLORS = [
  { base: "bg-red-500",    active: "ring-red-300" },
  { base: "bg-blue-500",   active: "ring-blue-300" },
  { base: "bg-amber-500",  active: "ring-amber-300" },
  { base: "bg-green-500",  active: "ring-green-300" },
];

export default function PlayerPlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("waiting");
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [myId, setMyId] = useState("");
  const [myNickname, setMyNickname] = useState("");
  const [myResult, setMyResult] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myChosenAnswerTexts, setMyChosenAnswerTexts] = useState<string[]>([]);
  const [blockedAudioUrl, setBlockedAudioUrl] = useState<string | null>(null);
  const playerIdRef = useRef("");
  const nicknameRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("quiz_player");
    if (!stored) { router.replace("/join"); return; }
    const playerData = JSON.parse(stored);
    if (playerData.sessionId !== sessionId) { router.replace("/join"); return; }
    playerIdRef.current = playerData.playerId;
    nicknameRef.current = playerData.nickname;
    setMyId(playerData.playerId);
    setMyNickname(playerData.nickname);

    const socket = getSocket();

    socket.on("question:started", ({ question: q, startTime: st }: { question: Question; startTime: number }) => {
      audioRef.current?.pause();
      audioRef.current = null;
      setBlockedAudioUrl(null);
      if (q.audioPreviewUrl) {
        const audio = new Audio(proxyAudio(q.audioPreviewUrl));
        audio.play().then(() => {
          audioRef.current = audio;
        }).catch(() => {
          setBlockedAudioUrl(q.audioPreviewUrl ?? null);
        });
      }
      setQuestion(q);
      setStartTime(st);
      setTimeLeft(q.duration);
      setSelected([]);
      setFreeText("");
      setMyResult(null);
      setMyChosenAnswerTexts([]);
      setPhase("question");
    });

    socket.on("answer:received", () => setPhase("answered"));

    socket.on("question:ended", (qResult: QuestionResult) => {
      audioRef.current?.pause();
      audioRef.current = null;
      setBlockedAudioUrl(null);
      setResult(qResult);
      const me = qResult.playerAnswers.find((pa) => pa.playerId === playerIdRef.current);
      const rank = qResult.leaderboard.find((p) => p.nickname === nicknameRef.current)?.rank ?? null;
      setMyResult(me ? { isCorrect: me.isCorrect, pointsEarned: me.pointsEarned } : { isCorrect: false, pointsEarned: 0 });
      setMyRank(rank);

      if (me?.answer) {
        if (qResult.question.type === "FREE_TEXT") {
          setMyChosenAnswerTexts([me.answer]);
        } else {
          const chosenIds: string[] = qResult.question.type === "MULTIPLE_CHOICE"
            ? JSON.parse(me.answer) : [me.answer];
          setMyChosenAnswerTexts(
            chosenIds.map((id) => qResult.question.answers.find((a) => a.id === id)?.text ?? id)
          );
        }
      } else {
        setMyChosenAnswerTexts([]);
      }
      setPhase("results");
    });

    socket.on("quiz:finished", () => {
      router.push(`/session/${sessionId}/results`);
    });

    socket.on("player:rejoined", ({ status }: { status: string }) => {
      if (status === "WAITING") router.replace(`/session/${sessionId}/waiting`);
      if (status === "FINISHED") router.replace(`/session/${sessionId}/results`);
    });

    socket.emit("player:rejoin", { sessionId, playerId: playerData.playerId });

    function onReconnect() {
      socket.emit("player:rejoin", { sessionId, playerId: playerIdRef.current });
    }
    socket.io.on("reconnect", onReconnect);

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      socket.off("question:started");
      socket.off("answer:received");
      socket.off("question:ended");
      socket.off("quiz:finished");
      socket.off("player:rejoined");
      socket.io.off("reconnect", onReconnect);
    };
  }, [sessionId, router]);

  // Countdown
  useEffect(() => {
    if (phase !== "question" || !startTime) return;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setTimeLeft(Math.ceil(Math.max(0, (question?.duration ?? 0) - elapsed)));
    }, 200);
    return () => clearInterval(iv);
  }, [phase, startTime, question?.duration]);

  function submitSingleChoice(id: string) {
    if (!question || !myId) return;
    setSelected([id]);
    getSocket().emit("player:submit-answer", { sessionPlayerId: myId, questionId: question.id, answer: id });
    setPhase("answered");
  }

  function toggleChoice(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  function submitAnswer() {
    if (!question || !myId) return;
    let answer: string | string[];
    if (question.type === "FREE_TEXT") {
      if (!freeText.trim()) return;
      answer = freeText.trim();
    } else if (question.type === "SINGLE_CHOICE") {
      if (selected.length === 0) return;
      answer = selected[0];
    } else {
      if (selected.length === 0) return;
      answer = selected;
    }
    getSocket().emit("player:submit-answer", { sessionPlayerId: myId, questionId: question.id, answer });
    setPhase("answered");
  }

  function proxyAudio(url: string) {
    return `/api/audio/proxy?url=${encodeURIComponent(url)}`;
  }

  const timerPct = question ? (timeLeft / question.duration) * 100 : 0;
  const timerColor = timeLeft <= 5 ? "bg-red-500" : "bg-blue-500";

  return (
    <div className="h-dvh bg-gray-900 text-white flex flex-col overflow-hidden">

      {/* ── EN ATTENTE ──────────────────────────────────────────── */}
      {phase === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-14 h-14 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-gray-300 font-medium text-lg">Prochaine question…</p>
        </div>
      )}

      {/* ── QUESTION ────────────────────────────────────────────── */}
      {phase === "question" && question && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barre de progression + infos — toujours visible en haut */}
          <div className="flex-none px-4 pt-4 pb-2 bg-gray-900">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>{question.index + 1} / {question.total}</span>
              <span className={`text-2xl font-black ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>{timeLeft}</span>
              <span>{question.points} pts</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`${timerColor} h-2 rounded-full transition-all duration-200`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>

          {/* Contenu scrollable : audio, image, question, réponses */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3 pt-2">
            {/* Bouton audio bloqué (autoplay mobile) */}
            {blockedAudioUrl && (
              <button
                onClick={() => {
                  const audio = new Audio(proxyAudio(blockedAudioUrl));
                  audio.play().catch(() => {});
                  audioRef.current = audio;
                  setBlockedAudioUrl(null);
                }}
                className="w-full bg-purple-600 active:bg-purple-700 text-white font-bold py-3 rounded-2xl text-base flex items-center justify-center gap-2"
              >
                <span>🎵</span> Lancer la musique
              </button>
            )}

            {/* Image de la question */}
            {question.imageUrl && (
              <img
                src={question.imageUrl}
                alt=""
                className="w-full max-h-48 object-contain rounded-2xl"
              />
            )}

            {/* Texte de la question */}
            <div className="bg-gray-800 rounded-2xl px-5 py-6">
              <p className="text-lg font-semibold text-center leading-snug">{question.text}</p>
            </div>

            {/* Spacer pour pousser les réponses vers le bas quand le contenu est court */}
            <div className="flex-1" />

            {/* Zone de réponses */}
            {question.type === "FREE_TEXT" ? (
              <>
                <input
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                  placeholder="Ta réponse…"
                  className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-2xl px-4 py-4 text-white text-lg outline-none"
                />
                <button
                  onClick={submitAnswer}
                  disabled={!freeText.trim()}
                  className="w-full bg-blue-500 active:bg-blue-600 disabled:opacity-40 text-white font-bold py-5 rounded-2xl text-lg"
                >
                  Valider
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {question.answers.map((a, i) => {
                    const c = ANSWER_COLORS[i % 4];
                    const isSelected = selected.includes(a.id);
                    const isSingle = question.type === "SINGLE_CHOICE";
                    return (
                      <button
                        key={a.id}
                        onClick={() => isSingle ? submitSingleChoice(a.id) : toggleChoice(a.id)}
                        className={`${c.base} rounded-2xl py-6 px-3 text-white font-bold text-sm leading-tight transition-all active:scale-95 ${
                          isSelected ? `ring-4 ${c.active} scale-95` : "opacity-85"
                        }`}
                      >
                        {a.text}
                      </button>
                    );
                  })}
                </div>
                {question.type === "MULTIPLE_CHOICE" && selected.length > 0 && (
                  <button
                    onClick={submitAnswer}
                    className="w-full bg-white text-gray-900 font-bold py-5 rounded-2xl text-lg active:bg-gray-100"
                  >
                    Valider
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── RÉPONSE ENVOYÉE ─────────────────────────────────────── */}
      {phase === "answered" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <div className="text-5xl">⏳</div>
          <p className="text-white font-bold text-xl">Réponse envoyée !</p>
          <p className="text-gray-500 text-sm">En attente des autres joueurs…</p>
        </div>
      )}

      {/* ── RÉSULTATS DE LA QUESTION ────────────────────────────── */}
      {phase === "results" && result && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Résultat personnel — fixe en haut */}
          <div className={`flex-none mx-4 mt-4 rounded-2xl px-5 py-5 text-center ${myResult?.isCorrect ? "bg-green-500" : "bg-red-500"}`}>
            <div className="text-4xl mb-1">{myResult?.isCorrect ? "✓" : "✗"}</div>
            <p className="font-black text-xl">{myResult?.isCorrect ? "Bonne réponse !" : "Mauvaise réponse"}</p>
            <div className="flex justify-center gap-4 mt-1 text-sm opacity-90">
              {myResult?.isCorrect && <span>+{myResult.pointsEarned} pts</span>}
              {myRank && <span>#{myRank}</span>}
            </div>
          </div>

          {/* Détails + classement — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {/* Image de la question */}
            {result.question.imageUrl && (
              <img
                src={result.question.imageUrl}
                alt=""
                className="w-full max-h-40 object-contain rounded-2xl"
              />
            )}

            {/* Ma réponse */}
            <div className="bg-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Ta réponse</p>
              {myChosenAnswerTexts.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Pas de réponse</p>
              ) : (
                <div className="space-y-1.5">
                  {myChosenAnswerTexts.map((text, i) => (
                    <div key={i} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${myResult?.isCorrect ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                      {myResult?.isCorrect ? "✓" : "✗"} {text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bonne(s) réponse(s) si mauvaise réponse */}
            {!myResult?.isCorrect && (
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                  Bonne{result.question.answers.filter(a => a.isCorrect).length > 1 ? "s" : ""} réponse{result.question.answers.filter(a => a.isCorrect).length > 1 ? "s" : ""}
                </p>
                <div className="space-y-1.5">
                  {result.question.answers.filter((a) => a.isCorrect).map((a) => (
                    <div key={a.id} className="bg-green-500/20 rounded-xl px-4 py-2.5 text-green-300 text-sm font-medium">
                      ✓ {a.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classement */}
            <div className="bg-gray-800 rounded-2xl overflow-hidden">
              <p className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 mb-2">Classement</p>
              {result.leaderboard.slice(0, 10).map((p) => {
                const pa = result.playerAnswers.find((a) => a.playerId === p.id);
                const answerText = pa?.answer
                  ? result.question.type === "FREE_TEXT"
                    ? pa.answer
                    : result.question.type === "SINGLE_CHOICE"
                    ? (result.question.answers.find((a) => a.id === pa.answer)?.text ?? pa.answer)
                    : (() => { try { const ids: string[] = JSON.parse(pa.answer); return ids.map((id) => result.question.answers.find((a) => a.id === id)?.text ?? id).join(", "); } catch { return pa.answer; } })()
                  : null;
                return (
                  <div
                    key={p.id}
                    className={`px-4 py-3 border-t border-gray-700/50 ${p.nickname === myNickname ? "bg-blue-500/10" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 w-5 text-sm font-bold flex-shrink-0">{p.rank}</span>
                      <span className={`flex-1 text-sm font-medium ${p.nickname === myNickname ? "text-blue-300" : ""}`}>{p.nickname}</span>
                      <span className="text-yellow-400 font-bold text-sm">{p.score} pts</span>
                    </div>
                    <div className="ml-8">
                      {answerText ? (
                        <span className={`text-xs ${pa?.isCorrect ? "text-green-400" : "text-red-400"}`}>
                          {pa?.isCorrect ? "✓" : "✗"} {answerText}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600 italic">pas de réponse</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-gray-600 text-xs pb-2 animate-pulse">
              {result.isLastQuestion ? "En attente des résultats finaux…" : "En attente de la prochaine question…"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
