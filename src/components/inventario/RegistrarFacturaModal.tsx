import { useState, type FormEvent } from "react";
import { X, Plus, Trash2, Upload } from "lucide-react";
import type { Product } from "../../types";
import { registerPurchaseInvoice, type InvoiceItemInput } from "../../hooks/usePurchases";
import { uploadPhoto } from "../../lib/storage";

interface Props {
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

interface DraftItem extends InvoiceItemInput {
  key: string;
}

export default function RegistrarFacturaModal({ products, onClose, onSuccess }: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [items, setItems] = useState<DraftItem[]>([
    { key: crypto.randomUUID(), product_id: products[0]?.id ?? "", quantity: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, { key: crypto.randomUUID(), product_id: products[0]?.id ?? "", quantity: 1 }]);
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }
  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!invoiceNumber.trim()) {
      setError("El número de factura es obligatorio.");
      return;
    }
    if (!supplier.trim()) {
      setError("El proveedor es obligatorio.");
      return;
    }
    if (items.length === 0 || items.some((i) => !i.product_id || i.quantity <= 0)) {
      setError("Agrega al menos un producto con cantidad válida.");
      return;
    }

    setSubmitting(true);

    let photoPath: string | null = null;
    if (photoFile) {
      const { path, error: uploadError } = await uploadPhoto("facturas", photoFile);
      if (uploadError) {
        setSubmitting(false);
        setError(`No se pudo subir la foto: ${uploadError}`);
        return;
      }
      photoPath = path;
    }

    const { error: rpcError } = await registerPurchaseInvoice(
      invoiceNumber,
      supplier,
      photoPath,
      items.map(({ product_id, quantity }) => ({ product_id, quantity }))
    );
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy">Registrar factura de entrada</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Número de factura</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej. F-00123"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Proveedor</label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nombre del proveedor"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Foto de la factura (opcional)
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gigante-navy">
                Productos que trae esta factura
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs flex items-center gap-1 text-gigante-red font-medium"
              >
                <Plus size={14} /> Agregar producto
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item) => {
                const p = products.find((prod) => prod.id === item.product_id);
                return (
                  <div key={item.key} className="flex gap-2 items-start">
                    <select
                      value={item.product_id}
                      onChange={(e) => updateItem(item.key, { product_id: e.target.value })}
                      className="flex-1 rounded-lg border border-gigante-border px-2 py-2 text-xs"
                    >
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.code} — {prod.name} ({prod.brand})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-gigante-border px-2 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      disabled={items.length === 1}
                      className="text-gigante-muted disabled:opacity-30 p-2"
                      aria-label="Quitar"
                    >
                      <Trash2 size={16} />
                    </button>
                    {p && <span className="text-[10px] text-gigante-muted self-center">{p.category}</span>}
                  </div>
                );
              })}
            </div>
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
              {submitting ? "Guardando..." : "Registrar factura"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
