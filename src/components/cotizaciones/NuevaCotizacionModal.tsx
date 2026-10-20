import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import ProductSearchSelect from "../common/ProductSearchSelect";
import { crearCotizacion } from "../../hooks/useCotizaciones";
import { precioSegunTipo } from "../../lib/precioVenta";
import { precioPublico, type Product, type TipoPrecio } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  products: Product[];
  onClose: () => void;
  onSaved: (folio: string) => void;
}

interface Renglon {
  key: string;
  product_id: string;
  quantity: number;
  tipo_precio: TipoPrecio;
}

const nuevoRenglon = (): Renglon => ({ key: crypto.randomUUID(), product_id: "", quantity: 1, tipo_precio: "publico" });

export default function NuevaCotizacionModal({ products, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [vigencia, setVigencia] = useState("7");
  const [notas, setNotas] = useState("");
  const [renglones, setRenglones] = useState<Renglon[]>([nuevoRenglon()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () =>
      renglones.reduce((t, r) => {
        const p = products.find((x) => x.id === r.product_id);
        return t + (p ? precioSegunTipo(p, r.tipo_precio) * r.quantity : 0);
      }, 0),
    [renglones, products]
  );

  const cambiar = (key: string, patch: Partial<Renglon>) =>
    setRenglones((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError("Escribe el nombre del cliente.");
    if (renglones.some((r) => !r.product_id || !(r.quantity > 0))) {
      return setError("Cada renglón necesita un producto y una cantidad mayor a cero.");
    }
    setGuardando(true);
    const { folio, error: err } = await crearCotizacion({
      customerName: nombre.trim(),
      customerPhone: telefono.trim(),
      customerAddress: direccion.trim(),
      vigenciaDias: Math.max(1, Number(vigencia) || 7),
      notas: notas.trim(),
      items: renglones.map(({ product_id, quantity, tipo_precio }) => ({ product_id, quantity, tipo_precio })),
    });
    setGuardando(false);
    if (err || !folio) return setError(err ?? "No se pudo crear la cotización.");
    onSaved(folio);
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Nueva cotización</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gigante-navy col-span-2">
              Cliente
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
            </label>
            <label className="block text-xs font-medium text-gigante-navy">
              Teléfono (opcional)
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={campo} />
            </label>
            <label className="block text-xs font-medium text-gigante-navy">
              Vigencia (días)
              <input type="number" min="1" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={campo} />
            </label>
            <label className="block text-xs font-medium text-gigante-navy col-span-2">
              Dirección (opcional)
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={campo} />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gigante-navy">Productos</p>
              <button
                type="button"
                onClick={() => setRenglones((p) => [...p, nuevoRenglon()])}
                className="text-xs flex items-center gap-1 text-gigante-red font-medium"
              >
                <Plus size={14} /> Agregar producto
              </button>
            </div>
            <div className="space-y-2">
              {renglones.map((r) => {
                const p = products.find((x) => x.id === r.product_id);
                return (
                  <div key={r.key} className="border border-gigante-border rounded-lg p-2">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <ProductSearchSelect
                          products={products}
                          value={r.product_id}
                          onChange={(id) => cambiar(r.key, { product_id: id })}
                          size="sm"
                        />
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={r.quantity}
                        onChange={(e) => cambiar(r.key, { quantity: Number(e.target.value) })}
                        className="w-20 rounded-lg border border-gigante-border px-2 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setRenglones((prev) => prev.filter((x) => x.key !== r.key))}
                        disabled={renglones.length === 1}
                        className="text-gigante-muted disabled:opacity-30 p-2"
                        aria-label="Quitar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {p && p.descuento_porcentaje ? (
                      <select
                        value={r.tipo_precio}
                        onChange={(e) => cambiar(r.key, { tipo_precio: e.target.value as TipoPrecio })}
                        className="mt-1.5 text-[11px] rounded-lg border border-gigante-border px-2 py-1.5"
                      >
                        <option value="publico">Precio Público — {money(precioPublico(p))}</option>
                        <option value="promocion">Precio Promoción — {money(precioSegunTipo(p, "promocion"))}</option>
                      </select>
                    ) : p ? (
                      <p className="mt-1.5 text-[11px] text-gigante-muted">{money(precioPublico(p))} c/u</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <label className="block text-xs font-medium text-gigante-navy">
            Notas para el cliente (opcional)
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. entrega en 5 días hábiles" className={campo} />
          </label>

          <div className="flex items-center justify-between border-t border-gigante-border pt-3">
            <span className="text-sm text-gigante-muted">Total</span>
            <span className="text-lg font-bold text-gigante-navy">{money(total)}</span>
          </div>

          {error && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {guardando ? "Guardando..." : "Crear cotización"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
