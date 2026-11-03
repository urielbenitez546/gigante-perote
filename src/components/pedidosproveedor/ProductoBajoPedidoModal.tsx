import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { crearProductoBajoPedido, editarProductoBajoPedido } from "../../hooks/usePedidosProveedor";
import { PRODUCT_UNIT_LABELS, productoId, type Product, type ProductUnit } from "../../types";
import { normalizeText } from "../../lib/search";

interface Props {
  /** Todos los productos (para avisar si ya existe el código). */
  products: Product[];
  /** Si viene, se edita ese producto y al guardar queda como revisado. */
  producto?: Product;
  onClose: () => void;
  /** Devuelve el id del producto creado (o el editado). */
  onSaved: (productId: string) => void;
}

/** Alta (o revisión) de un producto de catálogo "bajo pedido": código, descripción, unidad y precio. */
export default function ProductoBajoPedidoModal({ products, producto, onClose, onSaved }: Props) {
  const editando = !!producto;
  const [externalId, setExternalId] = useState(producto ? productoId(producto) : "");
  const [code, setCode] = useState(producto?.code ?? "");
  const [name, setName] = useState(producto?.name ?? "");
  const [unit, setUnit] = useState<ProductUnit>(producto?.unit ?? "pieza");
  const [precio, setPrecio] = useState(producto ? String(producto.unit_price) : "");
  const [proveedor, setProveedor] = useState(producto && producto.brand !== "Bajo pedido" ? producto.brand : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aviso (no bloquea): ya hay un producto con ese código o muy parecido.
  const parecido = useMemo(() => {
    const c = normalizeText(code.trim());
    const n = normalizeText(name.trim());
    if (!c && n.length < 6) return null;
    return (
      products.find(
        (p) => p.id !== producto?.id && ((c && normalizeText(p.code) === c) || (n.length >= 6 && normalizeText(p.name) === n))
      ) ?? null
    );
  }, [products, code, name, producto?.id]);

  async function guardar() {
    setError(null);
    const n = Number(precio);
    if (!code.trim()) return setError("Escribe el código.");
    if (!name.trim()) return setError("Escribe la descripción.");
    if (!n || n <= 0) return setError("Escribe el precio.");
    setGuardando(true);
    const datos = { code: code.trim(), name: name.trim(), unit, precio: n, proveedor, externalId: externalId.trim() };
    if (producto) {
      const { error: err } = await editarProductoBajoPedido(producto.id, datos);
      setGuardando(false);
      if (err) return setError(err);
      onSaved(producto.id);
    } else {
      const { id, error: err } = await crearProductoBajoPedido(datos);
      setGuardando(false);
      if (err || !id) return setError(err ?? "No se pudo guardar el producto.");
      onSaved(id);
    }
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy">
            {editando ? "Revisar producto bajo pedido" : "Agregar producto de catálogo"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-3">
          Para productos de catálogo que no están en el inventario. Se pueden vender y pedir al proveedor; no cuentan como
          existencia ni salen en el inventario. {editando ? "Al guardar queda como revisado." : "Queda “por validar” hasta que alguien lo revise."}
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gigante-navy">
            ID de SIGAM (opcional)
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="Solo si el producto ya tiene ID en el sistema" className={campo} />
            <span className="block text-[10px] text-gigante-muted font-normal mt-1">
              Déjalo vacío si no está en SIGAM. Si le pones un ID que no viene en el Excel de SIGAM, la recarga de inventario lo pone en 0.
            </span>
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Código (del catálogo)
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. WPC-16290-ROB" className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Descripción
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Piso WPC roble 16x290 cm" className={campo} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gigante-navy">
              Unidad
              <select value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)} className={`${campo} bg-white`}>
                {(Object.keys(PRODUCT_UNIT_LABELS) as ProductUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {PRODUCT_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gigante-navy">
              Precio público (con IVA)
              <input type="number" min="0.01" step="any" value={precio} onChange={(e) => setPrecio(e.target.value)} className={campo} />
            </label>
          </div>
          <label className="block text-xs font-medium text-gigante-navy">
            Marca o proveedor (opcional)
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Helvex" className={campo} />
          </label>
        </div>

        {parecido && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Ojo: ya existe <strong>{parecido.code}</strong> — {parecido.name}. Revisa que no sea el mismo producto.
          </p>
        )}
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
            {guardando ? "Guardando..." : editando ? "Guardar y marcar revisado" : "Agregar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}
