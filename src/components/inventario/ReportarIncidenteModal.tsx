import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import ProductSearchSelect from "../common/ProductSearchSelect";
import { reportIncidenteMaterial } from "../../hooks/useNotifications";
import type { Product } from "../../types";

interface Props {
  products: Product[];
  onClose: () => void;
}

/** Para quien NO puede dar de baja material: reporta qué pasó y por qué debería
 * darse de baja. Le llega al Jefe de almacén y a Gerencia, que deciden. */
export default function ReportarIncidenteModal({ products, onClose }: Props) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId) return setError("Selecciona el producto afectado.");
    if (!description.trim()) return setError("Cuenta qué pasó y por qué se debería dar de baja.");
    const qty = quantity.trim() === "" ? null : Number(quantity);
    if (qty !== null && (isNaN(qty) || qty <= 0)) return setError("La cantidad debe ser mayor a cero (o déjala vacía).");

    setSubmitting(true);
    const { error: err } = await reportIncidenteMaterial(productId, qty, description.trim());
    setSubmitting(false);
    if (err) return setError(err);
    setEnviado(true);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Reportar incidente</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        {enviado ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-sm font-semibold text-gigante-navy">Reporte enviado</p>
            <p className="text-xs text-gigante-muted mt-1">
              Le llegó al Jefe de almacén y a Gerencia. Ellos deciden si se da de baja el material.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gigante-muted">
              Cuenta qué pasó con el material y por qué se debería dar de baja. Solo el Jefe de almacén y
              Gerencia pueden ejecutar la baja.
            </p>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Producto afectado</label>
              <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Cantidad afectada (opcional)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">¿Qué pasó y por qué se daría de baja?</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Ej. Se cayó una tarima al descargar y 3 cajas quedaron rotas."
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            {error && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>}
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
        )}
      </div>
    </div>
  );
}
