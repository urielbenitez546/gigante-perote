import { useMemo, useState, type FormEvent } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { Product, DeliveryType } from "../../types";
import { DELIVERY_TYPE_LABELS } from "../../types";
import { registerSale, type SaleItemInput } from "../../hooks/useSales";

interface Props {
  products: Product[];
  onClose: () => void;
  onSuccess: (folio: string) => void;
}

interface DraftItem {
  key: string;
  product_id: string;
  quantity: number;
  delivery_type: DeliveryType | ""; // "" = usa el tipo general de la venta
}

export default function NuevaVentaModal({ products, onClose, onSuccess }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("inmediata");
  const [pickupDate, setPickupDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { key: crypto.randomUUID(), product_id: products[0]?.id ?? "", quantity: 1, delivery_type: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableFor = (productId: string) => {
    const p = products.find((prod) => prod.id === productId);
    return p ? p.physical_stock - p.sold_pending : 0;
  };

  const effectiveType = (item: DraftItem): DeliveryType => item.delivery_type || deliveryType;
  const needsAddress = items.some((i) => effectiveType(i) === "domicilio");

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const p = products.find((prod) => prod.id === item.product_id);
      return sum + (p ? p.unit_price * item.quantity : 0);
    }, 0);
  }, [items, products]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: crypto.randomUUID(), product_id: products[0]?.id ?? "", quantity: 1, delivery_type: "" },
    ]);
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

    if (!customerName.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    if (needsAddress && !customerAddress.trim()) {
      setError("La dirección es obligatoria: al menos un producto se entregará a domicilio.");
      return;
    }
    if (items.length === 0 || items.some((i) => !i.product_id || i.quantity <= 0)) {
      setError("Agrega al menos un producto con cantidad válida.");
      return;
    }
    for (const item of items) {
      if (item.quantity > availableFor(item.product_id)) {
        const p = products.find((prod) => prod.id === item.product_id);
        setError(`No hay suficiente disponible de "${p?.name}". Disponible: ${availableFor(item.product_id)}.`);
        return;
      }
    }

    const payloadItems: SaleItemInput[] = items.map(({ product_id, quantity, delivery_type }) => ({
      product_id,
      quantity,
      ...(delivery_type ? { delivery_type } : {}),
    }));

    setSubmitting(true);
    const { folio, error: rpcError } = await registerSale(
      customerName,
      customerPhone,
      customerAddress,
      deliveryType,
      payloadItems,
      deliveryType === "retiro_sucursal" ? pickupDate : undefined
    );
    setSubmitting(false);

    if (rpcError || !folio) {
      setError(rpcError ?? "No se pudo registrar la venta.");
      return;
    }
    onSuccess(folio);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy">Nueva venta</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gigante-navy mb-1">Cliente (DEMO)</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Teléfono</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">
                Tipo de entrega (general)
              </label>
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              >
                {Object.entries(DELIVERY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsAddress && (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Dirección de entrega</label>
              <input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Dirección DEMO"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
              />
            </div>
          )}

          {deliveryType === "retiro_sucursal" && (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">
                Fecha estimada de recolección (opcional)
              </label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gigante-navy">Productos</label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs flex items-center gap-1 text-gigante-red font-medium"
              >
                <Plus size={14} /> Agregar producto
              </button>
            </div>
            <p className="text-[11px] text-gigante-muted mb-2">
              Por defecto cada producto usa el tipo de entrega general. Si un cliente se lleva algo de
              inmediato y otra parte se le entrega después, cambia el tipo de ESE producto abajo.
            </p>

            <div className="space-y-2">
              {items.map((item) => {
                const disponible = availableFor(item.product_id);
                return (
                  <div key={item.key} className="border border-gigante-border rounded-lg p-2">
                    <div className="flex gap-2 items-start">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateItem(item.key, { product_id: e.target.value })}
                        className="flex-1 rounded-lg border border-gigante-border px-2 py-2 text-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
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
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <select
                        value={item.delivery_type}
                        onChange={(e) => updateItem(item.key, { delivery_type: e.target.value as DeliveryType | "" })}
                        className="text-[11px] rounded-lg border border-gigante-border px-2 py-1.5"
                      >
                        <option value="">Entrega: igual que la venta</option>
                        {Object.entries(DELIVERY_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            Entrega: {label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-gigante-muted whitespace-nowrap">
                        disp: {disponible}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gigante-border pt-3">
            <span className="text-sm text-gigante-muted">Total (DEMO)</span>
            <span className="text-lg font-bold text-gigante-navy">
              ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
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
              {submitting ? "Guardando..." : "Registrar venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
