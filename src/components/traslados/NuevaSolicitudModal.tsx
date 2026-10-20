import { useState } from "react";
import { X } from "lucide-react";
import ProductSearchSelect from "../common/ProductSearchSelect";
import { crearSolicitudTraslado } from "../../hooks/useTraslados";
import type { Product } from "../../types";

interface Props {
  products: Product[];
  sucursalesConocidas: string[];
  onClose: () => void;
  onSaved: () => void;
}

/** "La sucursal X pide N de este producto": avisa a Ventas para que respondan. */
export default function NuevaSolicitudModal({ products, sucursalesConocidas, onClose, onSaved }: Props) {
  const [sucursal, setSucursal] = useState("");
  const [productId, setProductId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const n = Number(cantidad);
    if (!sucursal.trim()) return setError("Escribe qué sucursal lo pide.");
    if (!productId) return setError("Elige el producto.");
    if (!n || n <= 0) return setError("Escribe la cantidad que piden.");
    setGuardando(true);
    const { error: err } = await crearSolicitudTraslado(sucursal.trim(), productId, n, nota);
    setGuardando(false);
    if (err) return setError(err);
    onSaved();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Nueva solicitud de sucursal</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-3">
          Les llega un aviso a Ventas para que digan si ya vendieron o comprometieron de ese material.
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gigante-navy">
            Sucursal que lo pide
            <input
              list="sucursales-conocidas"
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              placeholder="Ej. Xalapa"
              className={campo}
            />
            <datalist id="sucursales-conocidas">
              {sucursalesConocidas.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <div>
            <p className="text-xs font-medium text-gigante-navy mb-1">Producto</p>
            <ProductSearchSelect products={products} value={productId} onChange={setProductId} showStock />
          </div>
          <label className="block text-xs font-medium text-gigante-navy">
            Cantidad que piden
            <input type="number" min="0.01" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Nota (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. lo necesitan para el viernes" className={campo} />
          </label>
        </div>

        {error && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <div className="flex gap-3 pt-4">
          <button onClick={onClose} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {guardando ? "Enviando..." : "Avisar a Ventas"}
          </button>
        </div>
      </div>
    </div>
  );
}
