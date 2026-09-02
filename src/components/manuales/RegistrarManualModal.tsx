import { useState, type FormEvent } from "react";
import { X, Upload } from "lucide-react";
import { ROLE_LABELS, MANUAL_CATEGORY_LABELS, type AppRole, type ManualCategory } from "../../types";
import { registerManual } from "../../hooks/useManuals";
import { uploadPhoto } from "../../lib/storage";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_ROLES: AppRole[] = ["gerencia", "ventas", "caja", "almacen", "reparto"];
const ALL_CATEGORIES: ManualCategory[] = ["bienvenida", "puesto", "protocolo", "politica", "otro"];

export default function RegistrarManualModal({ onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ManualCategory>("otro");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: AppRole) {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    setSubmitting(true);

    let filePath: string | null = null;
    if (file) {
      const { path, error: uploadError } = await uploadPhoto("manuales", file);
      if (uploadError) {
        setSubmitting(false);
        setError(`No se pudo subir el archivo: ${uploadError}`);
        return;
      }
      filePath = path;
    }

    const { error: err } = await registerManual({
      title: title.trim(),
      description: description.trim() || null,
      category,
      targetRoles: selectedRoles.length > 0 ? selectedRoles : null,
      filePath,
    });
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy">Publicar manual o documento</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Manual de bienvenida"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Breve resumen de qué trata este documento"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ManualCategory)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MANUAL_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              ¿Para qué roles aplica?
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className={`text-xs rounded-full px-3 py-1.5 border cursor-pointer ${
                    selectedRoles.includes(role)
                      ? "bg-gigante-navy text-white border-gigante-navy"
                      : "bg-white text-gigante-navy border-gigante-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="hidden"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
            <p className="text-xs text-gigante-muted mt-1">
              Si no seleccionas ninguno, se muestra para todos los roles.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Archivo (PDF o imagen, opcional)
            </label>
            <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer hover:bg-gigante-bg">
              <Upload size={16} />
              {file ? file.name : "Toca para seleccionar un archivo"}
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {submitting ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
