import { useState, type FormEvent } from "react";
import ProductSearchSelect from "../common/ProductSearchSelect";
import { X } from "lucide-react";
import type { Product } from "../../types";
import { registerInventorySalida } from "../../hooks/useInventory";

interface Props {
  products: Product[];
  initialProductId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Salida MANUAL de almacén (no es venta, ni merma, ni exhibición —
 * esas ya se registran solas). Es para una muestra que se lleva
 * alguien, un traspaso a otra sucursal, una corrección, etc. Parte
 * del Kardex digital.
 */
export default function RegistrarSalidaModal({ products, initialProductId = "", onClose, onSuccess }: Props) {
  const [productId, setProductId] = useState(initialProductId);
  const lockProduct = products.length === 1 && !!initialProductId;
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!productId) {
      setError("Selecciona un producto.");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Ingresa una cantidad válida, mayor a cero.");
      return;
    }
    if (product && qty > product.physical_stock) {
      setError(`No puedes sacar más de lo que hay en existencia física (${product.physical_stock}).`);
      return;
    }
    if (!reference.trim()) {
      setError("Describe el motivo de la salida (ej. muestra, traspaso, corrección).");
      return;
    }

    setSubmitting(true);
    const { error: rpcError } = await registerInventorySalida(productId, qty, reference.trim());
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy">Registrar salida</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-gigante-muted mb-4">
          Para cuando sale mercancía de almacén que NO es una venta (una muestra, un traspaso a otra
          sucursal, una corrección). Las salidas por venta, merma o exhibición ya se descuentan solas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Producto</label>
            {lockProduct ? (
              <p className="text-sm text-gigante-navy bg-gigante-bg rounded-lg px-3 py-2.5">
                {products[0].code} — {products[0].name}
              </p>
            ) : (
              <ProductSearchSelect products={products} value={productId} onChange={setProductId} showStock />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Cantidad que sale</label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej. 2"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Motivo</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. Muestra para cliente, traspaso a sucursal X..."
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
            />
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
              {submitting ? "Guardando..." : "Registrar salida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
