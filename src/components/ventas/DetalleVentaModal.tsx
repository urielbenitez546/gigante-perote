import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import type { SaleWithItems } from "../../types";
import { DELIVERY_TYPE_LABELS, SALE_STATUS_LABELS } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useProfileNames } from "../../hooks/useProfileNames";
import { registerSalePayment } from "../../hooks/useSales";

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function DetalleVentaModal({ sale, onClose, onUpdated }: Props) {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const canRegisterPayment = profile?.role === "gerencia" || profile?.role === "caja";
  const pendingAmount = Math.max(sale.total - sale.amount_paid, 0);

  const [amountInput, setAmountInput] = useState(String(sale.total));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSavePayment() {
    setError(null);
    const amount = Number(amountInput);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Escribe un monto válido.");
      return;
    }
    if (amount > sale.total) {
      setError(`No puede ser mayor al total ($${sale.total.toLocaleString("es-MX")}).`);
      return;
    }
    setSaving(true);
    const { error: err } = await registerSalePayment(sale.id, amount);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
    onUpdated?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">Detalle de venta {sale.folio}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted mb-1">
          {sale.customer_name} · {SALE_STATUS_LABELS[sale.status]}
        </p>
        <p className="text-xs text-gigante-muted mb-4">
          Vendedor: <span className="text-gigante-navy font-medium">{nameFor(sale.created_by)}</span>
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

        <div className="border-t border-gigante-border pt-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gigante-muted">Total</span>
            <span className="text-lg font-bold text-gigante-navy">
              ${sale.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="mt-2 bg-gigante-bg rounded-lg p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-gigante-muted">Pagado en caja</p>
                <p className="text-sm font-semibold text-emerald-700">
                  ${sale.amount_paid.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gigante-muted">Pendiente de cobro</p>
                <p className={`text-sm font-semibold ${pendingAmount > 0 ? "text-gigante-red" : "text-gigante-muted"}`}>
                  ${pendingAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {sale.payment_confirmed_at && !editing && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                  <CheckCircle2 size={13} /> Registrado por {nameFor(sale.payment_confirmed_by)}
                </span>
              )}
            </div>

            {pendingAmount > 0 && (
              <p className="text-[11px] text-gigante-muted mt-1">
                Si el resto se cobra al entregar a domicilio, el chofer lo registra desde "Repartos" y
                Caja lo confirma en "Evidencias y Cobros".
              </p>
            )}

            {canRegisterPayment && (
              <div className="mt-3">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={sale.total}
                      step="0.01"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-32 rounded-lg border border-gigante-border px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={handleSavePayment}
                      disabled={saving}
                      className="bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setError(null);
                      }}
                      className="text-xs text-gigante-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAmountInput(String(sale.total - sale.amount_paid > 0 ? sale.total : sale.amount_paid));
                      setEditing(true);
                    }}
                    className="text-xs font-semibold text-gigante-red hover:underline"
                  >
                    {sale.amount_paid > 0 ? "Corregir monto cobrado" : "Registrar cobro en caja"}
                  </button>
                )}
                {error && <p className="text-xs text-gigante-red mt-2">{error}</p>}
              </div>
            )}
          </div>
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
