import { useState, type FormEvent } from "react";
import { X, Upload, Link2, Film } from "lucide-react";
import { ROLE_LABELS, type AppRole, type TrainingVideo } from "../../types";
import {
  MAX_VIDEO_MB,
  embedUrlFor,
  saveTrainingVideo,
  uploadTrainingVideo,
} from "../../hooks/useTraining";

interface Props {
  video?: TrainingVideo | null;
  nextOrden: number;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES: AppRole[] = ["gerencia", "ventas", "caja", "almacen", "reparto"];

/** Lee la duración del video en el navegador (sin subirlo todavía). */
function leerDuracion(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(isFinite(v.duration) ? Math.round(v.duration) : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

function parseDuracion(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(t);
  return isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

export function formatDuracion(seconds: number | null): string {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VideoFormModal({ video, nextOrden, onClose, onSuccess }: Props) {
  const editing = !!video;
  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [responsabilidades, setResponsabilidades] = useState((video?.responsabilidades ?? []).join("\n"));
  const [paraTodos, setParaTodos] = useState(video ? video.roles === null : true);
  const [roles, setRoles] = useState<AppRole[]>(video?.roles ?? []);
  const [fuente, setFuente] = useState<"archivo" | "enlace">(video?.video_path ? "archivo" : "enlace");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(video?.video_url ?? "");
  const [duracion, setDuracion] = useState(formatDuracion(video?.duration_seconds ?? null));
  const [active, setActive] = useState(video?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(r: AppRole) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function onFile(f: File | null) {
    setFile(f);
    setError(null);
    if (!f) return;
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(
        `Este video pesa ${(f.size / 1024 / 1024).toFixed(0)} MB y el máximo es ${MAX_VIDEO_MB} MB. Súbelo a YouTube como “no listado” y usa la opción “Pegar link”.`
      );
      return;
    }
    const d = await leerDuracion(f);
    if (d) setDuracion(formatDuracion(d));
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Ponle un título al video.");
    if (!paraTodos && roles.length === 0) return setError("Elige al menos un puesto, o marca “Para todos”.");

    let videoPath = video?.video_path ?? null;
    let videoUrl: string | null = null;

    if (fuente === "enlace") {
      if (!url.trim()) return setError("Pega el link del video.");
      if (!embedUrlFor(url) && !/^https?:\/\//.test(url.trim())) return setError("Ese link no parece válido.");
      videoUrl = url.trim();
      videoPath = null;
    } else if (!videoPath || file) {
      if (!file) return setError("Elige el archivo de video.");
      setSubmitting(true);
      setProgressMsg("Subiendo video... no cierres esta ventana.");
      const up = await uploadTrainingVideo(file);
      setProgressMsg(null);
      if (up.error || !up.path) {
        setSubmitting(false);
        return setError(up.error ?? "No se pudo subir el video.");
      }
      videoPath = up.path;
    }

    setSubmitting(true);
    const { error: err } = await saveTrainingVideo(
      {
        title: title.trim(),
        description: description.trim() || null,
        responsabilidades: responsabilidades
          .split("\n")
          .map((l) => l.replace(/^[-•*\s]+/, "").trim())
          .filter(Boolean),
        roles: paraTodos ? null : roles,
        video_path: videoPath,
        video_url: videoUrl,
        duration_seconds: parseDuracion(duracion),
        orden: video?.orden ?? nextOrden,
        active,
      },
      video?.id
    );
    setSubmitting(false);
    if (err) return setError(err);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy flex items-center gap-2">
            <Film size={20} /> {editing ? "Editar video" : "Agregar video de capacitación"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFuente("enlace")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border ${
                fuente === "enlace" ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy"
              }`}
            >
              <Link2 size={14} /> Link de Drive / YouTube (recomendado)
            </button>
            <button
              type="button"
              onClick={() => setFuente("archivo")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border ${
                fuente === "archivo" ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy"
              }`}
            >
              <Upload size={14} /> Subir archivo
            </button>
          </div>

          {fuente === "archivo" ? (
            <div>
              <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer">
                <Upload size={16} />
                <span className="truncate">
                  {file ? file.name : video?.video_path ? "Ya tiene video (elige otro para reemplazarlo)" : "Elegir video (mp4, mov...)"}
                </span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
              <p className="text-[11px] text-gigante-muted mt-1">
                Máximo {MAX_VIDEO_MB} MB (unos 3–5 min grabados con el celular en calidad normal). Si pesa más, súbelo a
                YouTube como “no listado” y usa “Pegar link”.
              </p>
            </div>
          ) : (
            <div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtu.be/... o https://drive.google.com/file/d/..."
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
              <p className="text-[11px] text-gigante-muted mt-1">
                El video se queda guardado en Drive (no ocupa espacio en la página) y se reproduce aquí mismo.
                En Drive: clic derecho al video → Compartir → Acceso general: “Cualquier persona con el enlace” (Lector) →
                Copiar enlace. En YouTube: súbelo como “No listado”.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gigante-navy mb-1">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Apertura y cierre de sucursal"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Duración</label>
              <input
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
                placeholder="3:40"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">¿De qué trata? (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ej. Recorrido por las áreas de la sucursal y cómo se relacionan entre sí."
              className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Responsabilidades que explica (opcional, una por renglón)
            </label>
            <textarea
              value={responsabilidades}
              onChange={(e) => setResponsabilidades(e.target.value)}
              rows={3}
              placeholder={"Abrir la sucursal a las 8:30\nRevisar caja chica\nEncender luces de exhibición"}
              className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">¿Quién lo debe ver?</label>
            <label className="flex items-center gap-2 text-sm text-gigante-navy mb-2">
              <input type="checkbox" checked={paraTodos} onChange={(e) => setParaTodos(e.target.checked)} />
              Para todos los puestos
            </label>
            {!paraTodos && (
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`text-xs rounded-full px-3 py-1.5 border ${
                      roles.includes(r) ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm text-gigante-navy">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Visible para el equipo
            </label>
          )}

          {progressMsg && <p className="text-sm text-gigante-navy bg-gigante-bg rounded-lg px-3 py-2">{progressMsg}</p>}
          {error && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Agregar video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
