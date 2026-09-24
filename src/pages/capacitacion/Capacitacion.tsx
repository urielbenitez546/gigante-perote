import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Film,
  BookOpenCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  useTrainingProgress,
  useTrainingVideos,
  markLessonDone,
  saveTrainingVideo,
  deleteTrainingVideo,
} from "../../hooks/useTraining";
import { useProfiles } from "../../hooks/useProfiles";
import { LESSONS, lessonsForRole, type Lesson } from "../../data/capacitacion";
import { ROLE_LABELS, videoLessonKey, type AppRole, type TrainingProgress, type TrainingVideo } from "../../types";
import VideoPlayer from "../../components/capacitacion/VideoPlayer";
import VideoFormModal, { formatDuracion } from "../../components/capacitacion/VideoFormModal";

/** Videos que le tocan a un puesto (solo los visibles). */
function videosForRole(videos: TrainingVideo[], role: AppRole): TrainingVideo[] {
  return videos.filter((v) => v.active && (v.roles === null || v.roles.includes(role)));
}

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

// ============================================================
// Videos (lista + reproductor, como en el prototipo)
// ============================================================
function VideosSection({
  videos,
  isGerencia,
  doneKeys,
  onMarkDone,
  reloadVideos,
}: {
  videos: TrainingVideo[];
  isGerencia: boolean;
  doneKeys: Set<string>;
  onMarkDone: (videoId: string) => Promise<void>;
  reloadVideos: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ video: TrainingVideo | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId || !videos.some((v) => v.id === selectedId)) {
      const firstPending = videos.find((v) => !doneKeys.has(videoLessonKey(v.id)));
      setSelectedId((firstPending ?? videos[0])?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  const selected = videos.find((v) => v.id === selectedId) ?? null;
  const selectedDone = selected ? doneKeys.has(videoLessonKey(selected.id)) : false;

  async function marcar() {
    if (!selected || selectedDone) return;
    setSaving(true);
    await onMarkDone(selected.id);
    setSaving(false);
  }

  async function mover(video: TrainingVideo, dir: -1 | 1) {
    const idx = videos.findIndex((v) => v.id === video.id);
    const other = videos[idx + dir];
    if (!other) return;
    setActionError(null);
    // Intercambia el orden de los dos (si tenían el mismo, usa la posición).
    const a = other.orden === video.orden ? idx + dir : other.orden;
    const b = other.orden === video.orden ? idx : video.orden;
    const strip = (v: TrainingVideo) => ({
      title: v.title,
      description: v.description,
      responsabilidades: v.responsabilidades,
      roles: v.roles,
      video_path: v.video_path,
      video_url: v.video_url,
      duration_seconds: v.duration_seconds,
      active: v.active,
    });
    const r1 = await saveTrainingVideo({ ...strip(video), orden: a }, video.id);
    const r2 = await saveTrainingVideo({ ...strip(other), orden: b }, other.id);
    if (r1.error || r2.error) setActionError(r1.error ?? r2.error);
    reloadVideos();
  }

  async function borrar(video: TrainingVideo) {
    setActionError(null);
    const { error } = await deleteTrainingVideo(video);
    setConfirmDelete(null);
    if (error) setActionError(error);
    reloadVideos();
  }

  const nextOrden = videos.reduce((m, v) => Math.max(m, v.orden), 0) + 1;

  return (
    <div>
      {isGerencia && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setForm({ video: null })}
            className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            <Plus size={16} /> Agregar video
          </button>
        </div>
      )}
      {actionError && <p className="mb-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{actionError}</p>}

      {videos.length === 0 ? (
        <div className="bg-white border border-gigante-border rounded-xl p-8 text-center">
          <Film size={32} className="mx-auto text-gigante-muted" />
          <p className="text-sm text-gigante-navy font-semibold mt-2">Todavía no hay videos para tu puesto.</p>
          <p className="text-xs text-gigante-muted mt-1">
            {isGerencia
              ? "Graba videos cortos con el celular (2–5 min): bienvenida, apertura y cierre, cómo usar la página en cada área..."
              : "Mientras tanto, revisa las lecciones rápidas."}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 min-w-0 bg-white border border-gigante-border rounded-xl overflow-hidden self-start">
            <p className="text-sm font-semibold text-gigante-navy px-4 py-3 border-b border-gigante-border">Lista de videos</p>
            <ul className="p-2 space-y-1.5">
              {videos.map((v, idx) => {
                const done = doneKeys.has(videoLessonKey(v.id));
                const isSel = v.id === selectedId;
                return (
                  <li key={v.id}>
                    <div
                      className={`rounded-lg border ${
                        isSel ? "border-gigante-navy bg-gigante-navy/5" : "border-gigante-border"
                      }`}
                    >
                      <button onClick={() => setSelectedId(v.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                        {done ? (
                          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        ) : (
                          <PlayCircle size={18} className="text-gigante-navy shrink-0" />
                        )}
                        <span className="flex-1 min-w-0 text-sm text-gigante-navy truncate">{v.title}</span>
                        {!v.active && <EyeOff size={13} className="text-gigante-muted shrink-0" aria-label="Oculto" />}
                        <span className="text-[11px] text-gigante-muted shrink-0">{formatDuracion(v.duration_seconds)}</span>
                      </button>
                      {isGerencia && (
                        <div className="flex items-center gap-3 px-3 pb-2 -mt-1 text-gigante-muted">
                          <span className="text-[10px] flex-1 truncate">
                            {v.roles === null ? "Para todos" : v.roles.map((r) => ROLE_LABELS[r]).join(", ")}
                          </span>
                          <button onClick={() => mover(v, -1)} disabled={idx === 0} className="disabled:opacity-30" aria-label="Subir">
                            <ArrowUp size={13} />
                          </button>
                          <button
                            onClick={() => mover(v, 1)}
                            disabled={idx === videos.length - 1}
                            className="disabled:opacity-30"
                            aria-label="Bajar"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button onClick={() => setForm({ video: v })} aria-label="Editar">
                            <Pencil size={13} />
                          </button>
                          {confirmDelete === v.id ? (
                            <span className="text-[11px] flex gap-2">
                              <button onClick={() => setConfirmDelete(null)}>No</button>
                              <button onClick={() => borrar(v)} className="text-gigante-red font-semibold">
                                Borrar
                              </button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(v.id)} aria-label="Borrar" className="hover:text-gigante-red">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-3 min-w-0 bg-white border border-gigante-border rounded-xl overflow-hidden self-start">
            <p className="text-sm font-semibold text-gigante-navy px-4 py-3 border-b border-gigante-border">Reproducción</p>
            {selected && (
              <div className="p-4 space-y-3">
                <VideoPlayer video={selected} onFinished={marcar} />
                <p className="text-sm font-semibold text-gigante-navy">
                  {selected.title}
                  {selected.duration_seconds ? (
                    <span className="text-gigante-muted font-normal"> · {formatDuracion(selected.duration_seconds)}</span>
                  ) : null}
                </p>
                {selected.description && <p className="text-sm text-gigante-navy">{selected.description}</p>}
                {selected.responsabilidades.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-gigante-muted uppercase">
                      Responsabilidades de este puesto
                    </p>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {selected.responsabilidades.map((r, i) => (
                        <li key={i} className="text-sm text-gigante-navy">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedDone ? (
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 size={16} /> Ya lo viste
                  </p>
                ) : (
                  <button
                    onClick={marcar}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 bg-gigante-navy text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} /> {saving ? "Guardando..." : "Marcar como visto"}
                  </button>
                )}
                {selected.video_path && (
                  <p className="text-[11px] text-gigante-muted">Se marca solo como visto cuando llegas casi al final.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {form && (
        <VideoFormModal
          video={form.video}
          nextOrden={nextOrden}
          onClose={() => setForm(null)}
          onSuccess={() => {
            setForm(null);
            reloadVideos();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Avance del equipo (videos + lecciones)
// ============================================================
function AvanceEquipo({ videos, progress }: { videos: TrainingVideo[]; progress: TrainingProgress[] }) {
  const { profiles, loading } = useProfiles();

  const filas = useMemo(() => {
    return profiles
      .filter((p) => p.active)
      .map((p) => {
        const hecho = (key: string) => progress.some((x) => x.user_id === p.id && x.lesson_key === key);
        const vids = videosForRole(videos, p.role);
        const lecs = lessonsForRole(p.role);
        const videosVistos = vids.filter((v) => hecho(videoLessonKey(v.id))).length;
        const leccionesHechas = lecs.filter((l) => hecho(l.key)).length;
        const pendientes = [
          ...vids.filter((v) => !hecho(videoLessonKey(v.id))).map((v) => `🎬 ${v.title}`),
          ...lecs.filter((l) => !hecho(l.key)).map((l) => l.title),
        ];
        const total = vids.length + lecs.length;
        return { p, videosVistos, totalVideos: vids.length, leccionesHechas, totalLecciones: lecs.length, total, hechas: videosVistos + leccionesHechas, pendientes };
      })
      .sort((a, b) => a.hechas / Math.max(a.total, 1) - b.hechas / Math.max(b.total, 1));
  }, [profiles, progress, videos]);

  if (loading) return <p className="text-sm text-gigante-muted">Cargando equipo...</p>;

  return (
    <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
      <ul className="divide-y divide-gigante-border">
        {filas.map(({ p, total, hechas, videosVistos, totalVideos, leccionesHechas, totalLecciones, pendientes }) => {
          const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gigante-navy">{p.full_name}</p>
                  <p className="text-[11px] text-gigante-muted">
                    {p.puesto || ROLE_LABELS[p.role]} · 🎬 {videosVistos}/{totalVideos} videos · 📘 {leccionesHechas}/
                    {totalLecciones} lecciones
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
                <p className="text-[11px] text-gigante-muted mt-1 line-clamp-2">Le falta: {pendientes.join(" · ")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Vista = "videos" | "lecciones" | "equipo" | "todas";

export default function Capacitacion() {
  const { profile } = useAuth();
  const { progress, error, reload } = useTrainingProgress();
  const { videos: allVideos, error: videosError, reload: reloadVideos } = useTrainingVideos();
  const [vista, setVista] = useState<Vista>("videos");

  if (!profile) return null;

  const isGerencia = profile.role === "gerencia";
  // Gerencia administra todos los videos (incluidos ocultos); el resto ve los de su puesto.
  const videosLista = isGerencia ? allVideos : videosForRole(allVideos, profile.role);
  const misVideos = videosForRole(allVideos, profile.role);
  const misLecciones = lessonsForRole(profile.role);
  const doneKeys = new Set(progress.filter((p) => p.user_id === profile.id).map((p) => p.lesson_key));
  const videosVistos = misVideos.filter((v) => doneKeys.has(videoLessonKey(v.id))).length;
  const leccionesHechas = misLecciones.filter((l) => doneKeys.has(l.key)).length;
  const total = misVideos.length + misLecciones.length;
  const hechas = videosVistos + leccionesHechas;
  const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;
  const errorMsg = error ?? videosError;

  const TABS: { key: Vista; label: string; icon: typeof Film; show: boolean }[] = [
    { key: "videos", label: "Videos", icon: Film, show: true },
    { key: "lecciones", label: "Lecciones rápidas", icon: BookOpenCheck, show: true },
    { key: "equipo", label: "Avance del equipo", icon: Users, show: isGerencia },
    { key: "todas", label: "Todas las lecciones", icon: BookOpenCheck, show: isGerencia },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <GraduationCap size={22} /> Capacitación Express
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Videos cortos y lecciones rápidas para que cualquiera aprenda su puesto ({ROLE_LABELS[profile.role]}) y a usar la
        página, sin depender de que alguien esté disponible para explicarle.
      </p>

      {errorMsg && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {errorMsg}
          {(errorMsg.includes("training_") || errorMsg.includes("schema cache")) &&
            " — ¿ya corriste las migraciones 0027b y 0028 en Supabase?"}
        </p>
      )}

      <div className="bg-white border border-gigante-border rounded-xl p-4 mt-5">
        <div className="flex items-center justify-between text-sm flex-wrap gap-2">
          <span className="text-gigante-navy font-semibold">Tu avance</span>
          <span className="text-xs text-gigante-muted">
            🎬 {videosVistos} de {misVideos.length} videos vistos · 📘 {leccionesHechas} de {misLecciones.length} lecciones
          </span>
        </div>
        <div className="h-3 rounded-full bg-gigante-bg overflow-hidden mt-2">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && (
          <p className="text-xs text-emerald-700 mt-2 font-medium">🎉 ¡Terminaste tu capacitación! Ya dominas tu puesto y la página.</p>
        )}
      </div>

      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {TABS.filter((t) => t.show).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setVista(key)}
            className={`whitespace-nowrap inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border ${
              vista === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {vista === "videos" && (
          <VideosSection
            videos={videosLista}
            isGerencia={isGerencia}
            doneKeys={doneKeys}
            onMarkDone={async (id) => {
              await markLessonDone(videoLessonKey(id));
              reload();
            }}
            reloadVideos={reloadVideos}
          />
        )}
        {vista === "equipo" && <AvanceEquipo videos={allVideos} progress={progress} />}
        {(vista === "lecciones" || vista === "todas") && (
          <div className="max-w-3xl space-y-3">
            {(vista === "todas" ? LESSONS : misLecciones).map((lesson) => (
              <LessonCard
                key={lesson.key}
                lesson={lesson}
                done={doneKeys.has(lesson.key)}
                onDone={async () => {
                  await markLessonDone(lesson.key);
                  reload();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
