import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { crearProductoInventario } from "../../hooks/useInventory";
import { PRODUCT_UNIT_LABELS, type Product, type ProductUnit } from "../../types";
import { normalizeText } from "../../lib/search";

interface Props {
  products: Product[];
  onClose: () => void;
  onSaved: (nombre: string) => void;
}

/** Almacén/Gerencia dan de alta un producto que no existe en el sistema, con su existencia inicial. */
export default function NuevoProductoModal({ products, onClose, onSaved }: Props) {
  const [externalId, setExternalId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("pieza");
  const [precio, setPrecio] = useState("");
  const [existencia, setExistencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marcas = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);

  // Aviso (no bloquea): ya hay un producto con ese ID, código o descripción.
  const parecido = useMemo(() => {
    const id = externalId.trim();
    const c = normalizeText(code.trim());
    const n = normalizeText(name.trim());
    return (
      products.find(
        (p) =>
          (id && String(p.external_id ?? "") === id) ||
          (c && normalizeText(p.code) === c) ||
          (n.length >= 6 && normalizeText(p.name) === n)
      ) ?? null
    );
  }, [products, externalId, code, name]);

  async function guardar() {
    setError(null);
    const pr = Number(precio);
    const ex = existencia.trim() === "" ? 0 : Number(existencia);
    if (!name.trim()) return setError("Escribe la descripción del producto.");
    if (!pr || pr <= 0) return setError("Escribe el precio público.");
    if (Number.isNaN(ex) || ex < 0) return setError("La existencia inicial no es válida.");
    setGuardando(true);
    const { id, error: err } = await crearProductoInventario({
      externalId,
      code,
      name: name.trim(),
      brand,
      unit,
      precio: pr,
      existencia: ex,
      categoria: "",
    });
    setGuardando(false);
    if (err || !id) return setError(err ?? "No se pudo crear el producto.");
    onSaved(name.trim());
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy">Nuevo producto</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-3">
          Da de alta un producto que no está en el sistema. Si lo tiene, pon su <strong>ID de SIGAM</strong>: así la próxima
          carga de inventario lo reconoce y no lo duplica. La existencia inicial queda en el Kardex como una entrada.
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gigante-navy">
            ID de SIGAM
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="Ej. 32100 (si ya lo tiene)" className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Código (opcional)
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Si lo dejas vacío se genera uno" className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Descripción
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Taza de baño una pieza blanca" className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Marca (opcional)
            <input list="marcas-nuevo-producto" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej. Helvex" className={campo} />
            <datalist id="marcas-nuevo-producto">
              {marcas.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
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
            Existencia inicial (cuántos hay)
            <input type="number" min="0" step="any" value={existencia} onChange={(e) => setExistencia(e.target.value)} placeholder="0" className={campo} />
          </label>
        </div>

        {parecido && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Ojo: ya existe <strong>{parecido.code}</strong> — {parecido.name}
            {parecido.external_id ? ` (ID ${parecido.external_id})` : ""}. Revisa que no sea el mismo producto.
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
            {guardando ? "Guardando..." : "Crear producto"}
          </button>
        </div>
      </div>
    </div>
  );
}
