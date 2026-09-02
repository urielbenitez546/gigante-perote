import { useState, type FormEvent } from "react";
import { X, Upload } from "lucide-react";
import type { Product } from "../../types";
import { registerWriteOff } from "../../hooks/usePurchases";
import { uploadPhoto } from "../../lib/storage";

interface Props {
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function RegistrarMermaModal({ products, onClose, onSuccess }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stock = products.find((p) => p.id === productId)?.physical_stock ?? 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!productId) {
      setError("Selecciona un producto.");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Ingresa una cantidad válida, mayor a cero.");
      return;
    }
    if (qty > stock) {
      setError(`No puedes dar de baja más de lo que hay en existencia física (${stock}).`);
      return;
    }
    if (!reason.trim()) {
      setError("Explica el motivo de la baja.");
      return;
    }

    setSubmitting(true);

    let photoPath: string | null = null;
    if (photoFile) {
      const { path, error: uploadError } = await uploadPhoto("merma", photoFile);
      if (uploadError) {
        setSubmitting(false);
        setError(`No se pudo subir la foto: ${uploadError}`);
        return;
      }
      photoPath = path;
    }

    const { error: rpcError } = await registerWriteOff(productId, qty, reason, photoPath);
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy">Dar de baja material dañado</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Producto</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gigante-muted mt-1">Existencia física actual: {stock}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Cantidad dañada</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej. 3"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Motivo de la baja
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ej. Cajas rotas al descargar el camión"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Foto del daño (opcional)
            </label>
            <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer hover:bg-gigante-bg">
              <Upload size={16} />
              {photoFile ? photoFile.name : "Toca para tomar/seleccionar una foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
          )}

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
              {submitting ? "Guardando..." : "Dar de baja"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
