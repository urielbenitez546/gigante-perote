import { useState, type FormEvent } from "react";
import { X, Upload, Store, Undo2 } from "lucide-react";
import { PRODUCT_UNIT_LABELS, type Product } from "../../types";
import { moveToDisplay, returnFromDisplay } from "../../hooks/useInventory";
import { uploadPhoto } from "../../lib/storage";
import ProductSearchSelect from "../common/ProductSearchSelect";

interface Props {
  products: Product[];
  /** "sale" = sacar de almacén a la tienda; "regresa" = de la tienda a almacén. */
  initialMode?: "sale" | "regresa";
  initialProductId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExhibicionModal({ products, initialMode = "sale", initialProductId = "", onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<"sale" | "regresa">(initialMode);
  const [productId, setProductId] = useState(initialProductId);
  const [quantity, setQuantity] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? null;
  const disponible = product ? product.physical_stock - product.sold_pending : 0;
  const enExhibicion = product?.exhibition_stock ?? 0;
  const maximo = mode === "sale" ? disponible : enExhibicion;
  const unidad = product ? PRODUCT_UNIT_LABELS[product.unit] : "";

  // Al regresar, solo tiene sentido elegir productos que sí están en exhibición.
  const pool = mode === "regresa" ? products.filter((p) => (p.exhibition_stock ?? 0) > 0) : products;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!product) return setError("Elige un producto.");
    if (!qty || qty <= 0) return setError("Pon una cantidad mayor a cero.");
    if (qty > maximo) {
      return setError(
        mode === "sale"
          ? `Solo hay ${maximo} ${unidad} disponibles para sacar (lo apartado para clientes no se puede tomar).`
          : `En exhibición solo hay ${maximo} ${unidad}.`
      );
    }

    setSubmitting(true);
    let res: { error: string | null };
    if (mode === "sale") {
      let photoPath: string | null = null;
      if (photoFile) {
        const up = await uploadPhoto("merma", photoFile);
        if (up.error) {
          setSubmitting(false);
          return setError(`No se pudo subir la foto: ${up.error}`);
        }
        photoPath = up.path;
      }
      res = await moveToDisplay(product.id, qty, ubicacion.trim(), notas.trim(), photoPath);
    } else {
      res = await returnFromDisplay(product.id, qty, notas.trim());
    }
    setSubmitting(false);
    if (res.error) return setError(res.error);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Material para exhibición</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setMode("sale");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border ${
              mode === "sale" ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy"
            }`}
          >
            <Store size={14} /> Sacar a la tienda
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("regresa");
              setProductId("");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border ${
              mode === "regresa" ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy"
            }`}
          >
            <Undo2 size={14} /> Regresar a almacén
          </button>
        </div>

        <p className="text-xs text-gigante-muted mb-4">
          {mode === "sale"
            ? "Lo que saques deja de contar como disponible para vender, pero NO es merma: queda registrado como “en exhibición”."
            : "Cuando se quita una muestra de la tienda y vuelve a almacén, regresa a estar disponible para vender."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Producto</label>
            {mode === "regresa" && pool.length === 0 ? (
              <p className="text-xs text-gigante-muted">No hay ningún producto en exhibición todavía.</p>
            ) : (
              <ProductSearchSelect products={pool} value={productId} onChange={setProductId} showStock={mode === "sale"} />
            )}
            {product && (
              <p className="text-xs text-gigante-muted mt-1">
                Disponible para vender: <strong>{disponible}</strong> {unidad} · En exhibición:{" "}
                <strong>{enExhibicion}</strong> {unidad}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Cantidad {product && <span className="text-gigante-muted font-normal">(máx. {maximo})</span>}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          {mode === "sale" && (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">¿Dónde se va a exhibir? (opcional)</label>
              <input
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej. Pared 3, área de baños"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Nota (opcional)</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={mode === "sale" ? "Ej. reemplaza la muestra del piso beige" : "Ej. se cambió la muestra"}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          {mode === "sale" && (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Foto de cómo quedó (opcional)</label>
              <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer">
                <Upload size={16} />
                <span className="truncate">{photoFile ? photoFile.name : "Elegir foto"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
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
              {submitting ? "Guardando..." : mode === "sale" ? "Sacar a exhibición" : "Regresar a almacén"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
