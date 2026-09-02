import { useState } from "react";
import { X } from "lucide-react";
import type { PendingLine } from "../../types";

interface Props {
  title: string;
  description?: string;
  lines: PendingLine[];
  submitLabel: string;
  onClose: () => void;
  onConfirm: (selected: { sale_item_id: string; product_id: string; quantity: number }[]) => Promise<{ error: string | null }>;
  onSuccess: () => void;
}

export default function ConfirmarEntregaParcialModal({
  title,
  description,
  lines,
  submitLabel,
  onClose,
  onConfirm,
  onSuccess,
}: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.sale_item_id, l.pending]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setQty(saleItemId: string, value: number) {
    setQuantities((prev) => ({ ...prev, [saleItemId]: value }));
  }

  async function handleSubmit() {
    setError(null);
    const selected = lines
      .map((l) => ({
        sale_item_id: l.sale_item_id,
        product_id: l.product_id,
        quantity: quantities[l.sale_item_id] ?? 0,
      }))
      .filter((s) => s.quantity > 0);

    if (selected.length === 0) {
      setError("Ingresa al menos una cantidad mayor a cero.");
      return;
    }
    for (const s of selected) {
      const line = lines.find((l) => l.sale_item_id === s.sale_item_id);
      if (line && s.quantity > line.pending) {
        setError(`La cantidad de "${line.product_name}" no puede ser mayor a lo pendiente (${line.pending}).`);
        return;
      }
    }

    setSubmitting(true);
    const { error: err } = await onConfirm(selected);
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
          <h2 className="text-lg font-bold text-gigante-navy">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        {description && <p className="text-xs text-gigante-muted mb-3">{description}</p>}

        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.sale_item_id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gigante-navy truncate">{line.product_name}</p>
                <p className="text-xs text-gigante-muted">
                  {line.product_code} · pendiente: {line.pending} {line.unit}
                </p>
              </div>
              <input
                type="number"
                min="0"
                max={line.pending}
                value={quantities[line.sale_item_id] ?? 0}
                onChange={(e) => setQty(line.sale_item_id, Number(e.target.value))}
                className="w-20 rounded-lg border border-gigante-border px-2 py-1.5 text-sm text-right"
              />
            </div>
          ))}
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
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {submitting ? "Guardando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
