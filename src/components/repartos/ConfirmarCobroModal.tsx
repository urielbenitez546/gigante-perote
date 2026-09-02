import { useState } from "react";
import { X } from "lucide-react";
import { confirmDeliveryPayment } from "../../hooks/useDeliveries";
import { PAYMENT_METHOD_LABELS, type Delivery } from "../../types";

interface Props {
  delivery: Delivery;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfirmarCobroModal({ delivery, onClose, onSuccess }: Props) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const { error: err } = await confirmDeliveryPayment(delivery.id, notes || undefined);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy">Confirmar cobro recibido</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gigante-navy">
          Folio <strong>{delivery.sale.folio}</strong> — {delivery.sale.customer_name}
        </p>
        <p className="text-sm text-gigante-navy mt-1">
          Chofer reportó:{" "}
          <strong>
            ${(delivery.amount_collected ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </strong>{" "}
          ({delivery.payment_method ? PAYMENT_METHOD_LABELS[delivery.payment_method] : "—"})
        </p>
        <p className="text-xs text-gigante-muted mt-2">
          Confirma solo cuando hayas recibido físicamente este dinero de manos del chofer.
        </p>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gigante-navy mb-1">
            Notas (opcional, ej. si hay alguna diferencia)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ej. Coincide completo / Faltaron $50, se aclaró con el chofer, etc."
            className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {submitting ? "Confirmando..." : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}
