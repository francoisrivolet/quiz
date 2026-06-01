import { Server as SocketServer, Socket } from "socket.io";
import { prisma } from "./prisma";

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

interface SessionState {
  currentQuestionIndex: number;
  timer: ReturnType<typeof setTimeout> | null;
  answeredPlayerIds: Set<string>;
  totalPlayers: number;
  questionEnded: boolean;
}

const sessionStates = new Map<string, SessionState>();

async function endQuestion(io: SocketServer, sessionId: string) {
  const state = sessionStates.get(sessionId);
  if (!state || state.questionEnded) return;
  state.questionEnded = true;

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { answers: true },
          },
        },
      },
      players: true,
    },
  });
  if (!session) return;

  const question = session.quiz.questions[state.currentQuestionIndex];
  if (!question) return;

  const playerAnswers = await prisma.playerAnswer.findMany({
    where: { questionId: question.id },
    include: { player: true },
  });

  // Award points for correct answers
  for (const pa of playerAnswers) {
    if (pa.isCorrect) {
      await prisma.sessionPlayer.update({
        where: { id: pa.sessionPlayerId },
        data: { score: { increment: question.points } },
      });
      await prisma.playerAnswer.update({
        where: { id: pa.id },
        data: { pointsEarned: question.points },
      });
    }
  }

  const leaderboard = await prisma.sessionPlayer.findMany({
    where: { sessionId },
    orderBy: { score: "desc" },
  });

  const isLastQuestion =
    state.currentQuestionIndex >= session.quiz.questions.length - 1;

  io.to(`session:${sessionId}`).emit("question:ended", {
    question: {
      id: question.id,
      text: question.text,
      imageUrl: question.imageUrl ?? null,
      type: question.type,
      answers: question.answers,
    },
    playerAnswers: playerAnswers.map((pa) => ({
      playerId: pa.sessionPlayerId,
      nickname: pa.player.nickname,
      answer: pa.answer,
      isCorrect: pa.isCorrect,
      pointsEarned: pa.isCorrect ? question.points : 0,
    })),
    leaderboard: leaderboard.map((p, i) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: i + 1,
    })),
    isLastQuestion,
  });

  // Pour la dernière question, on attend que l'admin clique sur "Voir les résultats finaux"
  // Le quiz:finished sera émis via admin:finish-quiz
}

export function setupSocketHandlers(io: SocketServer) {
  io.on("connection", (socket: Socket) => {
    // ── Player join ─────────────────────────────────────────────────────────
    socket.on("player:join", async ({ code, nickname }) => {
      try {
        const session = await prisma.gameSession.findUnique({
          where: { code },
          include: { players: true },
        });

        if (!session || session.status !== "WAITING") {
          socket.emit("error", { message: "Session introuvable ou déjà démarrée" });
          return;
        }

        if (session.players.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
          socket.emit("error", { message: "Ce pseudonyme est déjà utilisé" });
          return;
        }

        const player = await prisma.sessionPlayer.create({
          data: { sessionId: session.id, nickname },
        });

        socket.join(`session:${session.id}`);
        socket.data.sessionId = session.id;
        socket.data.playerId = player.id;

        const players = await prisma.sessionPlayer.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "asc" },
        });

        socket.emit("player:joined", {
          sessionId: session.id,
          playerId: player.id,
          nickname,
          players: players.map((p) => p.nickname),
        });

        io.to(`session:${session.id}`).emit("waiting-room:update", {
          players: players.map((p) => p.nickname),
        });
      } catch {
        socket.emit("error", { message: "Erreur lors de la connexion" });
      }
    });

    // ── Player rejoin ────────────────────────────────────────────────────────
    socket.on("player:rejoin", async ({ sessionId, playerId }) => {
      try {
        const player = await prisma.sessionPlayer.findUnique({
          where: { id: playerId },
          include: { session: true },
        });
        if (!player || player.sessionId !== sessionId) {
          socket.emit("error", { message: "Session introuvable" });
          return;
        }
        socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.playerId = playerId;
        socket.emit("player:rejoined", {
          status: player.session.status,
          currentQuestionIndex: player.session.currentQuestionIndex,
        });

        if (player.session.status === "WAITING") {
          const players = await prisma.sessionPlayer.findMany({
            where: { sessionId },
            orderBy: { createdAt: "asc" },
          });
          socket.emit("waiting-room:update", {
            players: players.map((p) => p.nickname),
          });
        }
      } catch {
        socket.emit("error", { message: "Erreur de reconnexion" });
      }
    });

    // ── Admin join ───────────────────────────────────────────────────────────
    socket.on("admin:join", async ({ sessionId }) => {
      try {
        const session = await prisma.gameSession.findUnique({
          where: { id: sessionId },
          include: {
            players: { orderBy: { createdAt: "asc" } },
            quiz: { include: { questions: { orderBy: { order: "asc" } } } },
          },
        });
        if (!session) {
          socket.emit("error", { message: "Session introuvable" });
          return;
        }
        socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.isAdmin = true;

        socket.emit("admin:joined", {
          session: {
            id: session.id,
            code: session.code,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: session.quiz.questions.length,
            players: session.players.map((p) => ({
              id: p.id,
              nickname: p.nickname,
              score: p.score,
            })),
          },
        });
      } catch {
        socket.emit("error", { message: "Erreur admin" });
      }
    });

    // ── Admin start quiz ─────────────────────────────────────────────────────
    socket.on("admin:start-quiz", async ({ sessionId }) => {
      try {
        const session = await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: "ACTIVE", currentQuestionIndex: -1 },
          include: { players: true },
        });

        sessionStates.set(sessionId, {
          currentQuestionIndex: -1,
          timer: null,
          answeredPlayerIds: new Set(),
          totalPlayers: session.players.length,
          questionEnded: false,
        });

        io.to(`session:${sessionId}`).emit("quiz:started");
      } catch {
        socket.emit("error", { message: "Erreur démarrage quiz" });
      }
    });

    // ── Admin next question ──────────────────────────────────────────────────
    socket.on("admin:next-question", async ({ sessionId }) => {
      try {
        const state = sessionStates.get(sessionId);
        if (!state) return;

        const newIndex = state.currentQuestionIndex + 1;
        state.currentQuestionIndex = newIndex;
        state.answeredPlayerIds = new Set();
        state.questionEnded = false;

        const session = await prisma.gameSession.findUnique({
          where: { id: sessionId },
          include: {
            players: true,
            quiz: {
              include: {
                questions: {
                  orderBy: { order: "asc" },
                  include: { answers: true },
                },
              },
            },
          },
        });
        if (!session) return;

        const question = session.quiz.questions[newIndex];
        if (!question) return;

        state.totalPlayers = session.players.length;

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { currentQuestionIndex: newIndex },
        });

        io.to(`session:${sessionId}`).emit("question:started", {
          question: {
            id: question.id,
            text: question.text,
            imageUrl: question.imageUrl ?? null,
            type: question.type,
            duration: question.duration,
            points: question.points,
            index: newIndex,
            total: session.quiz.questions.length,
            answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
          },
          startTime: Date.now(),
        });

        state.timer = setTimeout(() => {
          endQuestion(io, sessionId);
        }, question.duration * 1000);
      } catch {
        socket.emit("error", { message: "Erreur question suivante" });
      }
    });

    // ── Admin force end question ─────────────────────────────────────────────
    socket.on("admin:end-question", async ({ sessionId }) => {
      await endQuestion(io, sessionId);
    });

    // ── Admin finish quiz (afficher les résultats finaux) ────────────────────
    socket.on("admin:finish-quiz", async ({ sessionId }) => {
      try {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: "FINISHED" },
        });

        const leaderboard = await prisma.sessionPlayer.findMany({
          where: { sessionId },
          orderBy: { score: "desc" },
        });

        io.to(`session:${sessionId}`).emit("quiz:finished", {
          leaderboard: leaderboard.map((p, i) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            rank: i + 1,
          })),
        });

        sessionStates.delete(sessionId);
      } catch {
        socket.emit("error", { message: "Erreur fin de quiz" });
      }
    });

    // ── Player submit answer ─────────────────────────────────────────────────
    socket.on("player:submit-answer", async ({ sessionPlayerId, questionId, answer }) => {
      try {
        const sessionId = socket.data.sessionId;
        const state = sessionStates.get(sessionId);
        if (!state || state.questionEnded) return;

        if (state.answeredPlayerIds.has(sessionPlayerId)) {
          socket.emit("answer:already-submitted");
          return;
        }

        const question = await prisma.question.findUnique({
          where: { id: questionId },
          include: { answers: true },
        });
        if (!question) return;

        let isCorrect = false;
        const answerStr = typeof answer === "string" ? answer : JSON.stringify(answer);

        if (question.type === "SINGLE_CHOICE") {
          isCorrect = question.answers.find((a) => a.id === answer)?.isCorrect ?? false;
        } else if (question.type === "MULTIPLE_CHOICE") {
          const chosen: string[] = Array.isArray(answer) ? answer : JSON.parse(answer);
          const correct = question.answers.filter((a) => a.isCorrect).map((a) => a.id);
          isCorrect =
            chosen.length === correct.length && chosen.every((id) => correct.includes(id));
        } else if (question.type === "FREE_TEXT") {
          const playerNorm = normalize(String(answer));
          isCorrect = question.answers
            .filter((a) => a.isCorrect)
            .some((a) => {
              const acceptedNorm = normalize(a.text);
              if (playerNorm === acceptedNorm) return true;
              if (a.lenient) return levenshtein(playerNorm, acceptedNorm) <= 1;
              return false;
            });
        }

        await prisma.playerAnswer.create({
          data: { sessionPlayerId, questionId, answer: answerStr, isCorrect },
        });

        state.answeredPlayerIds.add(sessionPlayerId);

        socket.emit("answer:received", { isCorrect });

        io.to(`session:${sessionId}`).emit("session:answer-count", {
          answered: state.answeredPlayerIds.size,
          total: state.totalPlayers,
        });

        if (state.answeredPlayerIds.size >= state.totalPlayers) {
          await endQuestion(io, sessionId);
        }
      } catch {
        socket.emit("error", { message: "Erreur soumission réponse" });
      }
    });
  });
}
