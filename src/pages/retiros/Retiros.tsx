import { useMemo, useState } from "react";
import { Warehouse, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSales, registerRetiro } from "../../hooks/useSales";
import { pendingLinesFor } from "../../lib/pendingLines";
import ConfirmarEntregaParcialModal from "../../components/ventas/ConfirmarEntregaParcialModal";
import type { SaleWithItems } from "../../types";
import { SALE_STATUS_LABELS } from "../../types";

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  parcial: "bg-blue-100 text-blue-700",
  entregada: "bg-emerald-100 text-emerald-700",
};

export default function Retiros() {
  const { profile } = useAuth();
  const { sales, loading, error, reload } = useSales();
  const [activeSale, setActiveSale] = useState<SaleWithItems | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canConfirm =
    profile?.role === "gerencia" || profile?.role === "ventas" || profile?.role === "almacen";

  // Ventas que tienen al menos un renglón pendiente de retiro en sucursal
  const withRetiroLines = useMemo(
    () =>
      sales
        .map((s) => ({ sale: s, lines: pendingLinesFor(s, "retiro_sucursal") }))
        .filter(({ sale, lines }) => lines.length > 0 || sale.sale_items.some((i) => (i.delivery_type ?? sale.delivery_type) === "retiro_sucursal")),
    [sales]
  );

  const pendientesCount = withRetiroLines.filter(({ lines }) => lines.length > 0).length;
  const completadosCount = withRetiroLines.filter(({ lines }) => lines.length === 0).length;

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Warehouse size={22} /> Retiros en Sucursal
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Confirma que el cliente recogió su mercancía en la sucursal (puede ser parcial).
      </p>

      <div className="grid grid-cols-2 gap-4 mt-5 max-w-sm">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Con pendiente</p>
          <p className="text-xl font-bold text-gigante-navy">{pendientesCount}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Completados</p>
          <p className="text-xl font-bold text-gigante-navy">{completadosCount}</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
      )}
      {actionError && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{actionError}</p>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2">
        Puedes confirmar todo lo pendiente de un jalón, o solo una parte — por ejemplo, si el cliente
        pasa varias veces por su pedido.
      </div>

      <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : withRetiroLines.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">No hay ventas de tipo "retiro en sucursal".</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gigante-bg text-gigante-muted text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-3">Folio</th>
                <th className="text-left font-medium px-4 py-3">Cliente</th>
                <th className="text-left font-medium px-4 py-3">Pendiente</th>
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-right font-medium px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {withRetiroLines.map(({ sale, lines }) => (
                <tr key={sale.id} className="border-t border-gigante-border">
                  <td className="px-4 py-3 font-medium text-gigante-navy">{sale.folio}</td>
                  <td className="px-4 py-3 text-gigante-navy">{sale.customer_name}</td>
                  <td className="px-4 py-3 text-gigante-muted">
                    {lines.length === 0
                      ? "—"
                      : lines.map((l) => `${l.product_code} (${l.pending} ${l.unit})`).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE[sale.status] ?? ""}`}>
                      {SALE_STATUS_LABELS[sale.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lines.length > 0 && canConfirm && (
                      <button
                        onClick={() => setActiveSale(sale)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-red hover:bg-gigante-redDark rounded-lg px-3 py-1.5"
                      >
                        <CheckCircle2 size={14} />
                        Confirmar retiro
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeSale && (
        <ConfirmarEntregaParcialModal
          title={`Confirmar retiro — ${activeSale.folio}`}
          description="Por defecto se marca todo lo pendiente. Puedes reducir la cantidad si el cliente solo se lleva una parte."
          lines={pendingLinesFor(activeSale, "retiro_sucursal")}
          submitLabel="Confirmar retiro"
          onClose={() => setActiveSale(null)}
          onConfirm={(selected) =>
            registerRetiro(
              activeSale.id,
              selected.map(({ sale_item_id, quantity }) => ({ sale_item_id, quantity }))
            )
          }
          onSuccess={() => {
            setActiveSale(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
