import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, CheckCircle2, Circle, Clock, ExternalLink, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTrainingProgress, markLessonDone } from "../../hooks/useTraining";
import { useProfiles } from "../../hooks/useProfiles";
import { LESSONS, lessonsForRole, type Lesson } from "../../data/capacitacion";
import { ROLE_LABELS } from "../../types";

function LessonCard({
  lesson,
  done,
  onDone,
}: {
  lesson: Lesson;
  done: boolean;
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const correct = answer === lesson.pregunta.correcta;

  async function choose(idx: number) {
    setAnswer(idx);
    if (idx === lesson.pregunta.correcta && !done) {
      setSaving(true);
      await onDone();
      setSaving(false);
    }
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${done ? "border-emerald-200" : "border-gigante-border"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {done ? (
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
        ) : (
          <Circle size={20} className="text-gigante-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gigante-navy">{lesson.title}</p>
          <p className="text-[11px] text-gigante-muted flex items-center gap-1">
            <Clock size={11} /> {lesson.minutos} min {done && "· ✔ Aprendida"}
          </p>
        </div>
        {open ? <ChevronUp size={18} className="text-gigante-muted" /> : <ChevronDown size={18} className="text-gigante-muted" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gigante-border pt-3 space-y-3">
          <p className="text-sm text-gigante-navy">
            <span className="font-semibold">¿Para qué sirve? </span>
            {lesson.paraQue}
          </p>

          <ol className="space-y-1.5">
            {lesson.pasos.map((paso, i) => (
              <li key={i} className="flex gap-2 text-sm text-gigante-navy">
                <span className="w-5 h-5 rounded-full bg-gigante-navy text-white text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{paso}</span>
              </li>
            ))}
          </ol>

          {lesson.tip && (
            <p className="flex gap-2 text-xs bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
              <Lightbulb size={14} className="shrink-0 mt-0.5" /> {lesson.tip}
            </p>
          )}

          <Link
            to={lesson.path}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gigante-red hover:underline"
          >
            <ExternalLink size={13} /> Ir a practicar
          </Link>

          <div className="bg-gigante-bg rounded-lg p-3">
            <p className="text-xs font-semibold text-gigante-navy mb-2">Pregunta rápida: {lesson.pregunta.texto}</p>
            <div className="space-y-1.5">
              {lesson.pregunta.opciones.map((op, idx) => {
                const chosen = answer === idx;
                const style =
                  chosen && correct
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : chosen && !correct
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-gigante-border bg-white text-gigante-navy";
                return (
                  <button
                    key={idx}
                    onClick={() => choose(idx)}
                    disabled={saving}
                    className={`w-full text-left text-xs rounded-lg border px-3 py-2 ${style}`}
                  >
                    {op}
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <p className={`text-xs mt-2 ${correct ? "text-emerald-700" : "text-red-700"}`}>
                {correct ? `¡Correcto! ${lesson.pregunta.explicacion}` : "Casi. Vuelve a leer los pasos e inténtalo otra vez."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AvanceEquipo() {
  const { profiles, loading } = useProfiles();
  const { progress } = useTrainingProgress();

  const filas = useMemo(() => {
    return profiles
      .filter((p) => p.active)
      .map((p) => {
        const mias = lessonsForRole(p.role);
        const hechas = mias.filter((l) => progress.some((x) => x.user_id === p.id && x.lesson_key === l.key));
        return { p, total: mias.length, hechas: hechas.length, pendientes: mias.filter((l) => !hechas.includes(l)) };
      })
      .sort((a, b) => a.hechas / Math.max(a.total, 1) - b.hechas / Math.max(b.total, 1));
  }, [profiles, progress]);

  if (loading) return <p className="text-sm text-gigante-muted">Cargando equipo...</p>;

  return (
    <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
      <ul className="divide-y divide-gigante-border">
        {filas.map(({ p, total, hechas, pendientes }) => {
          const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gigante-navy">{p.full_name}</p>
                  <p className="text-[11px] text-gigante-muted">
                    {p.puesto || ROLE_LABELS[p.role]} · {hechas} de {total} lecciones
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold rounded-full px-2 py-1 ${
                    pct === 100 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gigante-bg overflow-hidden mt-2">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              {pendientes.length > 0 && (
                <p className="text-[11px] text-gigante-muted mt-1">Le falta: {pendientes.map((l) => l.title).join(" · ")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Capacitacion() {
  const { profile } = useAuth();
  const { progress, error, reload } = useTrainingProgress();
  const [vista, setVista] = useState<"mias" | "equipo" | "todas">("mias");

  if (!profile) return null;

  const isGerencia = profile.role === "gerencia";
  const mias = lessonsForRole(profile.role);
  const lista = vista === "todas" ? LESSONS : mias;
  const doneKeys = new Set(progress.filter((p) => p.user_id === profile.id).map((p) => p.lesson_key));
  const hechas = mias.filter((l) => doneKeys.has(l.key)).length;
  const pct = mias.length > 0 ? Math.round((hechas / mias.length) * 100) : 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <GraduationCap size={22} /> Capacitación Express
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Lecciones de 2–3 minutos para aprender a usar la página en tu área ({ROLE_LABELS[profile.role]}). Lee los
        pasos, practica y contesta la pregunta para marcarla como aprendida.
      </p>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error}
          {error.includes("training_progress") && " — ¿ya corriste la migración 0027b en Supabase?"}
        </p>
      )}

      <div className="bg-white border border-gigante-border rounded-xl p-4 mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gigante-navy font-semibold">Tu avance</span>
          <span className="text-gigante-navy font-bold">
            {hechas} / {mias.length}
          </span>
        </div>
        <div className="h-3 rounded-full bg-gigante-bg overflow-hidden mt-2">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && (
          <p className="text-xs text-emerald-700 mt-2 font-medium">🎉 ¡Terminaste tu capacitación! Ya dominas la página.</p>
        )}
      </div>

      {isGerencia && (
        <div className="flex gap-2 mt-4">
          {(
            [
              ["mias", "Mis lecciones"],
              ["equipo", "Avance del equipo"],
              ["todas", "Todas las lecciones"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setVista(key)}
              className={`text-xs rounded-full px-3 py-1.5 border ${
                vista === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {vista === "equipo" ? (
          <AvanceEquipo />
        ) : (
          lista.map((lesson) => (
            <LessonCard
              key={lesson.key}
              lesson={lesson}
              done={doneKeys.has(lesson.key)}
              onDone={async () => {
                await markLessonDone(lesson.key);
                reload();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
