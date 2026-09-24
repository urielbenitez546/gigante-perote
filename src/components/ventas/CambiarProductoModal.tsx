import { useState, type FormEvent } from "react";
import { X, ArrowLeftRight } from "lucide-react";
import { PRODUCT_UNIT_LABELS, type SaleItem, type SaleWithItems } from "../../types";
import { changeSaleItem } from "../../hooks/useSales";
import { useProducts } from "../../hooks/useInventory";
import ProductSearchSelect from "../common/ProductSearchSelect";

interface Props {
  sale: SaleWithItems;
  item: SaleItem;
  onClose: () => void;
  onSuccess: () => void;
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CambiarProductoModal({ sale, item, onClose, onSuccess }: Props) {
  const { products, loading: loadingProducts } = useProducts();
  const pendiente = item.quantity - item.delivered_quantity;
  const [newProductId, setNewProductId] = useState("");
  const [cantidad, setCantidad] = useState(String(pendiente));
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nuevo = products.find((p) => p.id === newProductId) ?? null;
  const qty = Number(cantidad) || 0;
  const disponibleNuevo = nuevo
    ? nuevo.physical_stock - nuevo.sold_pending + (nuevo.id === item.product_id ? pendiente : 0)
    : 0;

  // Total estimado: lo de los demás renglones + lo ya entregado de este + lo nuevo.
  const otros = sale.sale_items
    .filter((i) => i.id !== item.id)
    .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const totalNuevo = otros + item.delivered_quantity * item.unit_price + (nuevo ? qty * nuevo.unit_price : 0);
  const diferenciaCobro = sale.amount_paid - totalNuevo;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nuevo) return setError("Elige el producto nuevo.");
    if (qty <= 0) return setError("La cantidad debe ser mayor a cero.");
    if (qty > disponibleNuevo) return setError(`Solo hay ${disponibleNuevo} disponibles de ${nuevo.name}.`);
    if (!motivo.trim()) return setError("Escribe el motivo del cambio.");

    setSubmitting(true);
    const { error: err } = await changeSaleItem(item.id, nuevo.id, qty, motivo.trim());
    setSubmitting(false);
    if (err) return setError(err);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy flex items-center gap-2">
            <ArrowLeftRight size={18} /> Cambiar producto — {sale.folio}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gigante-bg rounded-lg p-3 text-xs text-gigante-navy mb-4">
          <p>
            Producto actual: <strong>{item.product?.code} — {item.product?.name}</strong>
          </p>
          <p className="mt-1 text-gigante-muted">
            Se cambia solo lo que <strong>falta por entregar: {pendiente}</strong>
            {item.delivered_quantity > 0 && ` (las ${item.delivered_quantity} ya entregadas se quedan igual)`}.
            Lo apartado del producto actual regresa a disponible.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Cambiar por</label>
            {loadingProducts ? (
              <p className="text-xs text-gigante-muted">Cargando productos...</p>
            ) : (
              <ProductSearchSelect products={products} value={newProductId} onChange={setNewProductId} showStock />
            )}
            <p className="text-[11px] text-gigante-muted mt-1">
              Puedes elegir el mismo producto si solo cambia la cantidad.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Cantidad nueva {nuevo && <span className="text-gigante-muted font-normal">({PRODUCT_UNIT_LABELS[nuevo.unit]} · disp. {disponibleNuevo})</span>}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Motivo</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. el cliente prefirió otro color"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          {nuevo && qty > 0 && (
            <div className="border border-gigante-border rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gigante-muted">Total antes</span>
                <span className="text-gigante-navy">{money(sale.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gigante-muted">Total nuevo (precio actual)</span>
                <span className="font-semibold text-gigante-navy">{money(totalNuevo)}</span>
              </div>
              {sale.amount_paid > 0 && diferenciaCobro > 0.009 && (
                <p className="text-amber-700 font-medium pt-1">
                  Ya se cobraron {money(sale.amount_paid)}: Caja tiene que regresarle {money(diferenciaCobro)} al cliente.
                </p>
              )}
              {sale.amount_paid > 0 && diferenciaCobro < -0.009 && (
                <p className="text-amber-700 font-medium pt-1">
                  Ya se cobraron {money(sale.amount_paid)}: faltan por cobrar {money(-diferenciaCobro)}.
                </p>
              )}
            </div>
          )}

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
              {submitting ? "Guardando..." : "Hacer el cambio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
