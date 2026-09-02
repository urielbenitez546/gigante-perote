import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { ROLE_LABELS, MANUAL_CATEGORY_LABELS, type AppRole, type ManualCategory } from "../../types";
import { registerFaq } from "../../hooks/useManuals";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_ROLES: AppRole[] = ["gerencia", "ventas", "caja", "almacen", "reparto"];
const ALL_CATEGORIES: ManualCategory[] = ["bienvenida", "puesto", "protocolo", "politica", "otro"];

export default function RegistrarFaqModal({ onClose, onSuccess }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState<ManualCategory | "">("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: AppRole) {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!question.trim()) {
      setError("La pregunta es obligatoria.");
      return;
    }
    if (!answer.trim()) {
      setError("La respuesta es obligatoria.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await registerFaq({
      question: question.trim(),
      answer: answer.trim(),
      category: category || null,
      targetRoles: selectedRoles.length > 0 ? selectedRoles : null,
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
          <h2 className="text-lg font-bold text-gigante-navy">Publicar pregunta frecuente</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Pregunta</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej. ¿Qué hago si un cliente quiere recoger su pedido en partes?"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Respuesta</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              placeholder="Explica la respuesta con el detalle que necesite el empleado"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Categoría (opcional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ManualCategory)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            >
              <option value="">Sin categoría</option>
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
