import { useState, type FormEvent } from "react";
import { X, ClipboardCheck } from "lucide-react";
import { PRODUCT_UNIT_LABELS, type Product } from "../../types";
import { registerPhysicalCount } from "../../hooks/useInventory";
import ProductSearchSelect from "../common/ProductSearchSelect";

interface Props {
  products: Product[];
  initialProductId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Conteo físico: Almacén cuenta lo que hay de verdad en bodega y lo
 * captura. Si no coincide con el sistema, se corrige y se avisa a Gerencia.
 *
 * A propósito NO se muestra lo que dice el sistema antes de capturar:
 * así se cuenta "a ciegas" y no se tiende a escribir el mismo número.
 */
export default function ConteoFisicoModal({ products, initialProductId = "", onClose, onSuccess }: Props) {
  const [productId, setProductId] = useState(initialProductId);
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ diferencia: number; sistema: number } | null>(null);

  const product = products.find((p) => p.id === productId) ?? null;
  const unidad = product ? PRODUCT_UNIT_LABELS[product.unit] : "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(contado);
    if (!product) return setError("Elige el producto que contaste.");
    if (contado.trim() === "" || isNaN(n) || n < 0) return setError("Escribe cuánto contaste (puede ser 0).");

    setSubmitting(true);
    const sistema = product.physical_stock;
    const { diferencia, error: err } = await registerPhysicalCount(product.id, n, notas.trim());
    setSubmitting(false);
    if (err) return setError(err);
    setResultado({ diferencia: diferencia ?? 0, sistema });
  }

  function contarOtro() {
    setResultado(null);
    setProductId("");
    setContado("");
    setNotas("");
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy flex items-center gap-2">
            <ClipboardCheck size={20} /> Conteo físico
          </h2>
          <button
            onClick={() => {
              if (resultado) onSuccess();
              onClose();
            }}
            aria-label="Cerrar"
            className="text-gigante-muted"
          >
            <X size={20} />
          </button>
        </div>

        {resultado ? (
          <div className="text-center py-4">
            {resultado.diferencia === 0 ? (
              <>
                <p className="text-4xl mb-2">✅</p>
                <p className="text-sm font-semibold text-emerald-700">¡Cuadra! El sistema y el almacén coinciden.</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-2">⚠️</p>
                <p className="text-sm font-semibold text-gigante-navy">
                  {resultado.diferencia > 0 ? "Sobraban" : "Faltaban"} {Math.abs(resultado.diferencia)} {unidad}
                </p>
                <p className="text-xs text-gigante-muted mt-1">
                  El sistema decía {resultado.sistema} y contaste {Number(contado)}. Ya se corrigió la existencia y se
                  le avisó a Gerencia.
                </p>
              </>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
              >
                Terminar
              </button>
              <button
                onClick={contarOtro}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                Contar otro producto
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gigante-muted">
              Cuenta en bodega lo que hay de este producto (cajas/piezas completas, sin contar lo que está en
              exhibición) y escríbelo. No te mostramos lo que dice el sistema para que el conteo sea honesto.
            </p>

            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Producto que contaste</label>
              <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">
                ¿Cuántos{unidad ? ` (${unidad})` : ""} contaste?
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={contado}
                onChange={(e) => setContado(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Nota (opcional)</label>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. había 2 cajas rotas en el fondo"
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
                {submitting ? "Guardando..." : "Registrar conteo"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
