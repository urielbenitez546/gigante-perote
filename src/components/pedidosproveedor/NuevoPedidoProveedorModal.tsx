import { useState } from "react";
import { X } from "lucide-react";
import ProductSearchSelect from "../common/ProductSearchSelect";
import ProductoBajoPedidoModal from "./ProductoBajoPedidoModal";
import { crearPedidoProveedor } from "../../hooks/usePedidosProveedor";
import type { Product } from "../../types";

interface Props {
  products: Product[];
  onClose: () => void;
  onSaved: (folio: string) => void;
  /** Recarga el catálogo después de agregar un producto bajo pedido. */
  onProductsChanged?: () => Promise<unknown> | void;
}

/** Ventas captura lo que un cliente pidió y no hay: le avisa a Almacén para que lo pida al proveedor. */
export default function NuevoPedidoProveedorModal({ products, onClose, onSaved, onProductsChanged }: Props) {
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [productId, setProductId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [altaProducto, setAltaProducto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const n = Number(cantidad);
    if (!cliente.trim()) return setError("Escribe el nombre del cliente.");
    if (!productId && !descripcion.trim()) return setError("Elige el producto o escribe qué material es.");
    if (!n || n <= 0) return setError("Escribe la cantidad que pide el cliente.");
    setGuardando(true);
    const { folio, error: err } = await crearPedidoProveedor({
      cliente: cliente.trim(),
      telefono,
      productId: productId || null,
      descripcion,
      cantidad: n,
      nota,
    });
    setGuardando(false);
    if (err || !folio) return setError(err ?? "No se pudo guardar el pedido.");
    onSaved(folio);
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Pedir a proveedor</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-3">
          Úsalo cuando un cliente pide algo que no hay en la sucursal. Le llega el aviso a Almacén para que lo pida al
          proveedor, y a ti te avisa cuando llegue.
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gigante-navy">
            Cliente
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Teléfono (opcional)
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Para avisarle cuando llegue" className={campo} />
          </label>
          <div>
            <p className="text-xs font-medium text-gigante-navy mb-1">Producto (si ya está en el catálogo)</p>
            <ProductSearchSelect
              products={products}
              value={productId}
              onChange={setProductId}
              showStock
              onAgregarNuevo={onProductsChanged ? () => setAltaProducto(true) : undefined}
            />
          </div>
          <label className="block text-xs font-medium text-gigante-navy">
            {productId ? "Detalle (opcional)" : "Si no está en el catálogo, escribe qué material es"}
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={productId ? "Ej. otro tono, mismo lote" : "Ej. Piso 60x60 gris, marca X"}
              className={campo}
            />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Cantidad que pide el cliente
            <input type="number" min="0.01" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Nota (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. lo necesita para el viernes" className={campo} />
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
            {guardando ? "Enviando..." : "Pedir a proveedor"}
          </button>
        </div>
      </div>

      {altaProducto && (
        <ProductoBajoPedidoModal
          products={products}
          onClose={() => setAltaProducto(false)}
          onSaved={async (id) => {
            await onProductsChanged?.();
            setProductId(id);
            setAltaProducto(false);
          }}
        />
      )}
    </div>
  );
}
