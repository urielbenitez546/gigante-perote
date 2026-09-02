import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { reportIssue } from "../../hooks/useNotifications";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportarProblemaModal({ onClose, onSuccess }: Props) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError("Escribe qué problema quieres reportar.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await reportIssue(message.trim());
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy">Reportar un problema</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-3">
          Esto le va a llegar como notificación a todos los usuarios del sistema, para que se atienda
          rápido.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Ej. Se cayó el internet en caja, no se pueden registrar ventas"
            className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
          />

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
              {submitting ? "Enviando..." : "Enviar reporte"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
