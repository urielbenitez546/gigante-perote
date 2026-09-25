import { useState, type FormEvent } from "react";
import { X, Camera, Store, Undo2 } from "lucide-react";
import { PRODUCT_UNIT_LABELS, productoId, type Product } from "../../types";
import { solicitarExhibicion } from "../../hooks/useInventory";
import { uploadPhoto } from "../../lib/storage";
import ProductSearchSelect from "../common/ProductSearchSelect";

interface Props {
  products: Product[];
  /** "exhibir" = ya se colocó en la tienda; "retirar" = ya se quitó. */
  tipo: "exhibir" | "retirar";
  initialProductId?: string;
  esGerencia: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Aviso de exhibición. Ventas o Almacén registran que ya exhibieron (o
 * quitaron) un producto, con foto como evidencia; queda pendiente hasta
 * que Gerencia lo confirma. Lo que registra Gerencia se confirma solo.
 */
export default function ExhibicionModal({ products, tipo, initialProductId = "", esGerencia, onClose, onSuccess }: Props) {
  const [productId, setProductId] = useState(initialProductId);
  const [cantidad, setCantidad] = useState("0");
  const [muestra, setMuestra] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhibir = tipo === "exhibir";
  const pool = products.filter((p) => (exhibir ? !p.exhibido : p.exhibido));
  const product = products.find((p) => p.id === productId) ?? null;
  const disponible = product ? product.physical_stock - product.sold_pending : 0;
  const unidad = product ? PRODUCT_UNIT_LABELS[product.unit] : "";

  function elegirFoto(f: File | null) {
    setFoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(cantidad) || 0;
    if (!product) return setError("Elige el producto.");
    if (qty < 0) return setError("La cantidad no puede ser negativa.");
    if (exhibir && qty > disponible) return setError(`Solo hay ${disponible} ${unidad} disponibles para la muestra.`);
    if (!exhibir && qty > (product.exhibition_stock ?? 0))
      return setError(`En exhibición solo hay registrado ${product.exhibition_stock ?? 0} ${unidad} de material.`);
    if (exhibir && !foto) return setError("Toma una foto de cómo quedó la exhibición: es la evidencia para la auditoría.");

    setSubmitting(true);
    let photoPath: string | null = null;
    if (foto) {
      const up = await uploadPhoto("exhibicion", foto);
      if (up.error) {
        setSubmitting(false);
        return setError(`No se pudo subir la foto: ${up.error}`);
      }
      photoPath = up.path;
    }
    const { error: err } = await solicitarExhibicion({
      productId: product.id,
      tipo,
      cantidad: qty,
      muestra: muestra.trim(),
      ubicacion: ubicacion.trim(),
      notas: notas.trim(),
      photoPath,
    });
    setSubmitting(false);
    if (err) return setError(err);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy flex items-center gap-2">
            {exhibir ? <Store size={20} /> : <Undo2 size={20} />}
            {exhibir ? "Ya lo exhibí" : "Ya lo quité de exhibición"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-4">
          {esGerencia
            ? "Como Gerencia, tu registro queda confirmado de inmediato."
            : "Queda pendiente hasta que Gerencia revise la foto y lo confirme."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Producto</label>
            {pool.length === 0 ? (
              <p className="text-xs text-gigante-muted">
                {exhibir ? "Todos los productos ya están marcados como exhibidos." : "No hay productos marcados como exhibidos."}
              </p>
            ) : (
              <ProductSearchSelect products={pool} value={productId} onChange={setProductId} showStock />
            )}
            {product && (
              <p className="text-xs text-gigante-muted mt-1">
                {productoId(product) && <>ID {productoId(product)} · </>}Disponible: <strong>{disponible}</strong> {unidad}
                {(product.exhibition_stock ?? 0) > 0 && (
                  <>
                    {" "}
                    · Material ya en exhibición: <strong>{product.exhibition_stock}</strong> {unidad}
                  </>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              {exhibir ? "Foto de cómo quedó (obligatoria)" : "Foto del espacio ya sin el producto (opcional)"}
            </label>
            <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer">
              <Camera size={16} />
              <span className="truncate">{foto ? foto.name : "Tomar o elegir foto"}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => elegirFoto(e.target.files?.[0] ?? null)}
              />
            </label>
            {preview && <img src={preview} alt="Vista previa" className="mt-2 max-h-40 rounded-lg border border-gigante-border" />}
          </div>

          {exhibir && (
            <>
              <div>
                <label className="block text-sm font-medium text-gigante-navy mb-1">¿Dónde está exhibido?</label>
                <input
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej. Pared 3, área de baños"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gigante-navy mb-1">¿Cómo es la muestra? (opcional)</label>
                <input
                  value={muestra}
                  onChange={(e) => setMuestra(e.target.value)}
                  placeholder="Ej. tablero con 2 piezas, panel de mosaico, 1 m² en piso"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              {exhibir
                ? `Material que se tomó del almacén para la muestra${unidad ? ` (${unidad})` : ""}`
                : `Material que regresa al almacén${unidad ? ` (${unidad})` : ""}`}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
            <p className="text-[11px] text-gigante-muted mt-1">
              {exhibir
                ? "Deja 0 si la muestra no se tomó del inventario (por ejemplo, un muestrario que manda el proveedor). Lo que pongas aquí se descuenta de lo disponible para vender."
                : "Si el material de la muestra está en buen estado y vuelve a venderse, ponlo aquí. Si se dañó, regístralo aparte en “Dar de baja”."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Nota (opcional)</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={exhibir ? "Ej. se le puso etiqueta de precio" : "Ej. se agotó, se puso otro en su lugar"}
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
              disabled={submitting || pool.length === 0}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {submitting ? "Guardando..." : esGerencia ? "Registrar" : "Enviar a Gerencia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
