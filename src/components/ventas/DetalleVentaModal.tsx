import { X } from "lucide-react";
import type { SaleWithItems } from "../../types";
import { DELIVERY_TYPE_LABELS, SALE_STATUS_LABELS } from "../../types";

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
}

export default function DetalleVentaModal({ sale, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">Detalle de venta {sale.folio}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted mb-4">
          {sale.customer_name} · {SALE_STATUS_LABELS[sale.status]}
        </p>

        <div className="space-y-2">
          {sale.sale_items.map((item) => {
            const pending = item.quantity - item.delivered_quantity;
            const type = item.delivery_type ?? sale.delivery_type;
            return (
              <div key={item.id} className="border border-gigante-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gigante-navy">
                    {item.product?.code} — {item.product?.name}
                  </p>
                  <span className="text-[11px] text-gigante-muted">{DELIVERY_TYPE_LABELS[type]}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div>
                    <p className="text-[11px] text-gigante-muted">Vendido</p>
                    <p className="text-sm font-semibold text-gigante-navy">
                      {item.quantity} {item.product?.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gigante-muted">Ya entregado</p>
                    <p className="text-sm font-semibold text-emerald-700">
                      {item.delivered_quantity} {item.product?.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gigante-muted">Falta</p>
                    <p className={`text-sm font-semibold ${pending > 0 ? "text-gigante-red" : "text-gigante-muted"}`}>
                      {pending} {item.product?.unit}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gigante-border pt-3 mt-4">
          <span className="text-sm text-gigante-muted">Total</span>
          <span className="text-lg font-bold text-gigante-navy">
            ${sale.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
