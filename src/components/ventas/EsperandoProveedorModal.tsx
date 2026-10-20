import { useState } from "react";
import { X } from "lucide-react";
import { marcarEsperandoProveedor } from "../../hooks/useSales";
import type { SaleWithItems } from "../../types";

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
  onSaved: () => void;
}

/** Marca una venta como "esperando proveedor" (el material no estaba en
 * almacén y se pidió), o la regresa a "lista para programar" cuando llega. */
export default function EsperandoProveedorModal({ sale, onClose, onSaved }: Props) {
  const activo = sale.esperando_proveedor;
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const { error: err } = await marcarEsperandoProveedor(sale.id, !activo, nota);
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy">
            {activo ? "Ya llegó el material" : "Esperando proveedor"} — {sale.folio}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted mb-3">{sale.customer_name}</p>

        {activo ? (
          <p className="text-sm text-gigante-navy bg-gigante-bg rounded-lg p-3">
            {sale.proveedor_nota ? `Se pidió: ${sale.proveedor_nota}. ` : ""}
            Al confirmar, la venta regresa a la lista para asignarle día y hora de entrega.
          </p>
        ) : (
          <label className="block text-xs font-medium text-gigante-navy">
            ¿Qué se pidió y a quién? (opcional)
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. 40 cajas a Helvex, llega el viernes"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30 mt-1"
            />
          </label>
        )}

        {error && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {guardando ? "Guardando..." : activo ? "Ya llegó, programar" : "Marcar como esperando"}
          </button>
        </div>
      </div>
    </div>
  );
}
