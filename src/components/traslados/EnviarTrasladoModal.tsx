import { useState } from "react";
import { Camera, X } from "lucide-react";
import ProductSearchSelect from "../common/ProductSearchSelect";
import { registrarTraslado, type SolicitudTraslado } from "../../hooks/useTraslados";
import { adjuntarFotoKardex } from "../../hooks/useInventory";
import { uploadPhoto } from "../../lib/storage";
import type { Product } from "../../types";

interface Props {
  products: Product[];
  /** Si viene de una solicitud, producto y sucursal ya están definidos y la solicitud se cierra. */
  solicitud?: SolicitudTraslado;
  sucursalesConocidas: string[];
  /** Cantidad sugerida (lo que alcanza libre para trasladar). */
  sugerida?: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Registra el traslado: sale del inventario con destino y queda en el Kardex. */
export default function EnviarTrasladoModal({ products, solicitud, sucursalesConocidas, sugerida, onClose, onSaved }: Props) {
  const [sucursal, setSucursal] = useState(solicitud?.sucursal ?? "");
  const [productId, setProductId] = useState(solicitud?.product_id ?? "");
  const [cantidad, setCantidad] = useState(
    solicitud ? String(Math.max(0, Math.min(solicitud.cantidad, sugerida ?? solicitud.cantidad))) : ""
  );
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const producto = products.find((p) => p.id === productId);
  const disponible = producto ? Number(producto.physical_stock) - Number(producto.sold_pending) : null;

  async function guardar() {
    setError(null);
    const n = Number(cantidad);
    if (!sucursal.trim()) return setError("Escribe a qué sucursal va.");
    if (!productId) return setError("Elige el producto.");
    if (!n || n <= 0) return setError("Escribe cuánto se envía.");
    if (disponible !== null && n > disponible) {
      return setError(`Solo hay ${disponible} disponibles (lo demás ya está apartado en ventas).`);
    }
    setGuardando(true);
    // La foto se sube antes: si falla, no se registra el traslado a medias.
    let fotoPath: string | null = null;
    if (foto) {
      const sub = await uploadPhoto("kardex-soporte", foto);
      if (sub.error || !sub.path) {
        setGuardando(false);
        return setError(`No se pudo subir la foto: ${sub.error ?? "error desconocido"}`);
      }
      fotoPath = sub.path;
    }
    const { movimientoId, error: err } = await registrarTraslado(productId, sucursal.trim(), n, nota, solicitud?.id);
    if (err) {
      setGuardando(false);
      return setError(err);
    }
    if (fotoPath && movimientoId) await adjuntarFotoKardex(movimientoId, fotoPath);
    setGuardando(false);
    onSaved();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">
            {solicitud ? "Enviar lo solicitado" : "Traslado a otra sucursal"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gigante-navy">
            Sucursal destino
            <input
              list="sucursales-conocidas-envio"
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              disabled={!!solicitud}
              className={`${campo} disabled:bg-gigante-bg`}
            />
            <datalist id="sucursales-conocidas-envio">
              {sucursalesConocidas.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <div>
            <p className="text-xs font-medium text-gigante-navy mb-1">Producto</p>
            {solicitud ? (
              <p className="text-sm text-gigante-navy bg-gigante-bg rounded-lg px-3 py-2.5">
                {solicitud.product?.code} — {solicitud.product?.name}
              </p>
            ) : (
              <ProductSearchSelect products={products} value={productId} onChange={setProductId} showStock />
            )}
            {disponible !== null && (
              <p className="text-[11px] text-gigante-muted mt-1">Disponible para trasladar: {disponible}</p>
            )}
          </div>
          <label className="block text-xs font-medium text-gigante-navy">
            Cantidad que se envía
            <input type="number" min="0.01" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Nota (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. camioneta 2, chofer Luis" className={campo} />
          </label>
          <div>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium border border-gigante-border rounded-lg px-2.5 py-1.5 text-gigante-navy bg-white cursor-pointer">
              <Camera size={13} /> {foto ? "Cambiar foto" : "Foto de apoyo (opcional)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </label>
            {foto && <span className="ml-2 text-[11px] text-gigante-muted">{foto.name}</span>}
          </div>
        </div>

        <p className="text-[11px] text-gigante-muted mt-3">
          Al guardar se descuenta del inventario y queda en el Kardex como “Traslado a {sucursal.trim() || "…"}”.
        </p>

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
            {guardando ? "Guardando..." : "Registrar traslado"}
          </button>
        </div>
      </div>
    </div>
  );
}
