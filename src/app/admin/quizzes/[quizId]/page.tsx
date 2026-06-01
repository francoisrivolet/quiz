"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT";

interface Answer { id?: string; text: string; isCorrect: boolean; lenient?: boolean; }
interface Question {
  id: string; text: string; imageUrl?: string; type: QuestionType;
  duration: number; points: number; order: number; answers: Answer[];
}
interface Quiz { id: string; title: string; description?: string; questions: Question[]; }

const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Choix unique",
  MULTIPLE_CHOICE: "Choix multiple",
  FREE_TEXT: "Texte libre",
};

const EMPTY_FORM = {
  text: "", imageUrl: "", type: "SINGLE_CHOICE" as QuestionType,
  duration: 30, points: 100,
  answers: [{ text: "", isCorrect: false, lenient: false }, { text: "", isCorrect: false, lenient: false }] as Answer[],
};

export default function QuizEditorPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/quizzes/${quizId}`)
      .then((r) => r.json())
      .then(setQuiz);
  }, [quizId]);

  async function openSession() {
    setLaunching(true);
    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    const session = await res.json();
    setLaunching(false);
    window.open(`/admin/session/${session.id}`, "_blank");
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setShowAdd(false);
    setForm({ text: q.text, imageUrl: q.imageUrl ?? "", type: q.type, duration: q.duration, points: q.points, answers: q.answers });
  }

  function updateAnswer(i: number, field: "text" | "isCorrect" | "lenient", value: string | boolean) {
    setForm((f) => {
      const answers = [...f.answers];
      answers[i] = { ...answers[i], [field]: value };
      if (field === "isCorrect" && f.type === "SINGLE_CHOICE" && value) {
        answers.forEach((a, j) => { if (j !== i) a.isCorrect = false; });
      }
      return { ...f, answers };
    });
  }

  function addAnswer() {
    setForm((f) => ({ ...f, answers: [...f.answers, { text: "", isCorrect: false }] }));
  }

  function removeAnswer(i: number) {
    setForm((f) => ({ ...f, answers: f.answers.filter((_, j) => j !== i) }));
  }

  async function saveQuestion() {
    const answers = form.type === "FREE_TEXT"
      ? form.answers.map((a) => ({ ...a, isCorrect: true }))
      : form.answers;

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/questions/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, answers }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const updated = await res.json();
        setQuiz((q) => q && { ...q, questions: q.questions.map((x) => x.id === editingId ? updated : x) });
        setEditingId(null);
      } else {
        const res = await fetch(`/api/admin/quizzes/${quizId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, answers }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const created = await res.json();
        setQuiz((q) => q && { ...q, questions: [...q.questions, created] });
        setShowAdd(false);
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      alert(`Échec de la sauvegarde : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz() {
    if (!confirm("Supprimer ce quiz et toutes ses questions ?")) return;
    await fetch(`/api/admin/quizzes/${quizId}`, { method: "DELETE" });
    router.push("/admin");
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Supprimer cette question ?")) return;
    await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    setQuiz((q) => q && { ...q, questions: q.questions.filter((x) => x.id !== id) });
  }

  if (!quiz) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Chargement…</div>;

  const showForm = editingId !== null || showAdd;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{quiz.title}</h1>
        <button
          onClick={deleteQuiz}
          className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          Supprimer le quiz
        </button>
        <button
          onClick={openSession}
          disabled={!quiz || quiz.questions.length === 0 || launching}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {launching ? "Lancement…" : "Lancer une session"}
        </button>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Question
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              <span className="text-sm font-bold text-gray-400 mt-0.5 w-6 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{q.text}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {TYPE_LABELS[q.type]} · {q.duration}s · {q.points} pts
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(q)} className="text-sm text-blue-600 hover:underline">Modifier</button>
                <button onClick={() => deleteQuestion(q.id)} className="text-sm text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>

            {editingId === q.id && (
              <QuestionForm
                form={form} setForm={setForm}
                updateAnswer={updateAnswer} addAnswer={addAnswer} removeAnswer={removeAnswer}
                onSave={saveQuestion} onCancel={() => setEditingId(null)} saving={saving}
              />
            )}
          </div>
        ))}

        {showAdd && !editingId && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <p className="px-5 pt-4 font-semibold text-gray-700">Nouvelle question</p>
            <QuestionForm
              form={form} setForm={setForm}
              updateAnswer={updateAnswer} addAnswer={addAnswer} removeAnswer={removeAnswer}
              onSave={saveQuestion} onCancel={() => setShowAdd(false)} saving={saving}
            />
          </div>
        )}

        {quiz.questions.length === 0 && !showForm && (
          <p className="text-center text-gray-400 py-12">Aucune question. Ajoutez-en une !</p>
        )}
      </main>
    </div>
  );
}

function QuestionForm({ form, setForm, updateAnswer, addAnswer, removeAnswer, onSave, onCancel, saving }: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;

  updateAnswer: (i: number, f: "text" | "isCorrect" | "lenient", v: string | boolean) => void;
  addAnswer: () => void;
  removeAnswer: (i: number) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="px-5 pb-5 pt-3 space-y-4 border-t bg-gray-50">
      <textarea
        value={form.text}
        onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
        placeholder="Texte de la question"
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div>
        <label className="text-xs text-gray-500 block mb-1">URL de l&apos;image (optionnel)</label>
        <input
          type="url"
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          placeholder="https://exemple.com/image.jpg"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {form.imageUrl && (
          <img
            src={form.imageUrl}
            alt="Aperçu"
            className="mt-2 rounded-lg max-h-40 object-contain border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block"; }}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value as QuestionType;
              setForm((f) => ({
                ...f,
                type: newType,
                answers:
                  newType === "FREE_TEXT"
                    ? [{ text: "", isCorrect: true, lenient: false }]
                    : f.type === "FREE_TEXT"
                    ? [{ text: "", isCorrect: false, lenient: false }, { text: "", isCorrect: false, lenient: false }]
                    : f.answers,
              }));
            }}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="SINGLE_CHOICE">Choix unique</option>
            <option value="MULTIPLE_CHOICE">Choix multiple</option>
            <option value="FREE_TEXT">Texte libre</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Durée (s)</label>
          <input
            type="number" min={5} max={120} value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: +e.target.value }))}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Points</label>
          <input
            type="number" min={1} value={form.points}
            onChange={(e) => setForm((f) => ({ ...f, points: +e.target.value }))}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-2">
          {form.type === "FREE_TEXT" ? "Réponses acceptées" : "Réponses"}
        </label>
        <div className="space-y-2">
          {form.answers.map((a, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                {form.type !== "FREE_TEXT" && (
                  <input
                    type={form.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                    checked={a.isCorrect}
                    onChange={(e) => updateAnswer(i, "isCorrect", e.target.checked)}
                    className="flex-shrink-0"
                  />
                )}
                <input
                  value={a.text}
                  onChange={(e) => updateAnswer(i, "text", e.target.value)}
                  placeholder={`Réponse ${i + 1}`}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {form.answers.length > (form.type === "FREE_TEXT" ? 1 : 2) && (
                  <button onClick={() => removeAnswer(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                )}
              </div>
              {form.type === "FREE_TEXT" && (
                <label className="flex items-center gap-2 text-xs text-gray-500 ml-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={a.lenient ?? false}
                    onChange={(e) => updateAnswer(i, "lenient", e.target.checked)}
                    className="flex-shrink-0"
                  />
                  Orthographe laxiste (1 erreur tolérée)
                </label>
              )}
            </div>
          ))}
        </div>
        {form.answers.length < 6 && (
          <button onClick={addAnswer} className="mt-2 text-sm text-blue-600 hover:underline">
            + Ajouter une réponse
          </button>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Annuler</button>
        <button
          onClick={onSave} disabled={saving || !form.text.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
