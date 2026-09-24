import { useState } from "react";
import { X, CheckCircle2, Trash2, ArrowLeftRight, CalendarClock } from "lucide-react";
import type { SaleItem, SaleWithItems } from "../../types";
import { DELIVERY_TYPE_LABELS, SALE_STATUS_LABELS, DIAS_AVISO_APARTADO, diasRestantesApartado } from "../../types";
import CambiarProductoModal from "./CambiarProductoModal";
import { useAuth } from "../../context/AuthContext";
import { useProfileNames } from "../../hooks/useProfileNames";
import { registerSalePayment, deleteSale } from "../../hooks/useSales";

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function DetalleVentaModal({ sale, onClose, onUpdated }: Props) {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const canRegisterPayment = profile?.role === "gerencia" || profile?.role === "caja";
  const canDelete = profile?.role === "gerencia";
  const canChangeItems = profile?.role === "gerencia" || profile?.role === "ventas";
  const [changingItem, setChangingItem] = useState<SaleItem | null>(null);
  const tienePendiente = sale.sale_items.some((i) => i.delivered_quantity < i.quantity);
  const diasRestantes = diasRestantesApartado(sale.created_at);
  const hasDeliveredItems = sale.sale_items.some((i) => i.delivered_quantity > 0);
  const hasPayment = sale.amount_paid > 0;
  const pendingAmount = Math.max(sale.total - sale.amount_paid, 0);

  const [amountInput, setAmountInput] = useState(String(sale.total));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!motivo.trim()) {
      setDeleteError("Escribe el motivo por el que se elimina la venta.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const { error: err } = await deleteSale(sale.id, motivo.trim());
    setDeleting(false);
    if (err) {
      setDeleteError(err);
      return;
    }
    onUpdated?.();
    onClose();
  }

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

        {tienePendiente && sale.status !== "cancelada" && (
          <p
            className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 mb-3 ${
              diasRestantes < 0
                ? "bg-red-50 text-red-700"
                : diasRestantes <= DIAS_AVISO_APARTADO
                ? "bg-amber-50 text-amber-800"
                : "bg-gigante-bg text-gigante-muted"
            }`}
          >
            <CalendarClock size={14} />
            {diasRestantes < 0
              ? `Apartado vencido hace ${Math.abs(diasRestantes)} día(s) — el cliente tenía 1 mes para recoger/recibir.`
              : diasRestantes === 0
              ? "El apartado vence HOY."
              : `Le quedan ${diasRestantes} día(s) al apartado para recoger/recibir.`}
            {sale.scheduled_pickup_date &&
              ` Fecha que eligió el cliente: ${new Date(sale.scheduled_pickup_date + "T12:00:00").toLocaleDateString("es-MX")}.`}
          </p>
        )}

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
                {canChangeItems && pending > 0 && (
                  <button
                    onClick={() => setChangingItem(item)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gigante-red hover:underline"
                  >
                    <ArrowLeftRight size={12} /> Cambiar por otro producto
                  </button>
                )}
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

        {canDelete && (
          <div className="mt-3 pt-3 border-t border-gigante-border">
            {hasDeliveredItems ? (
              <p className="text-xs text-gigante-muted text-center">
                Esta venta ya tiene material entregado, así que no se puede eliminar.
              </p>
            ) : hasPayment ? (
              <p className="text-xs text-gigante-muted text-center">
                Esta venta ya tiene un cobro en caja. Para eliminarla, primero corrige el cobro a $0 y
                regresa el dinero al cliente.
              </p>
            ) : confirmingDelete ? (
              <div>
                <p className="text-xs text-gigante-red text-center mb-2">
                  ¿Seguro? Esto borra la venta por completo y no se puede deshacer. Lo apartado regresa a
                  disponible y se avisa a Gerencia y Caja.
                </p>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo (ej. error de captura, el cliente canceló)"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2 text-xs mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setConfirmingDelete(false);
                      setMotivo("");
                      setDeleteError(null);
                    }}
                    className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2 text-xs font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || !motivo.trim()}
                    className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2 text-xs font-semibold"
                  >
                    {deleting ? "Eliminando..." : "Sí, eliminar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center justify-center gap-1.5 w-full text-xs text-gigante-red hover:underline"
              >
                <Trash2 size={13} /> Eliminar esta venta
              </button>
            )}
            {deleteError && <p className="text-xs text-gigante-red mt-2 text-center">{deleteError}</p>}
          </div>
        )}
      </div>
      {changingItem && (
        <CambiarProductoModal
          sale={sale}
          item={changingItem}
          onClose={() => setChangingItem(null)}
          onSuccess={() => {
            setChangingItem(null);
            onUpdated?.();
            onClose();
          }}
        />
      )}
    </div>
  );
}
