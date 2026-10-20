import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, History } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProfileNames } from "../../hooks/useProfileNames";
import { cargarHistorialCobros, type CobroHistorialEntry } from "../../hooks/useSales";
import {
  ESTADO_PAGO_LABELS,
  METODO_PAGO_VENTA_LABELS,
  tienePermiso,
  type SaleWithItems,
} from "../../types";
import CobrarVentaModal from "./CobrarVentaModal";
import CorregirCobroModal from "./CorregirCobroModal";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ESTADO_PAGO_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-700",
  pagado: "bg-emerald-100 text-emerald-700",
};

interface Props {
  sale: SaleWithItems;
  onUpdated?: () => void;
}

/**
 * Cobro de una venta, dentro del detalle.
 * - Mientras la venta esté en Caja: Caja (o Gerencia) confirma el cobro y la pasa a almacén.
 * - Después: Caja o Gerencia pueden corregir el monto, siempre con motivo.
 *   Gerencia ve el historial de correcciones.
 */
export default function CobroCajaPanel({ sale, onUpdated }: Props) {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const esCaja = profile?.role === "gerencia" || profile?.role === "caja";
  const esGerencia = profile?.role === "gerencia";
  const puedeCorregir = esCaja && tienePermiso(profile, "corregir_cobros");
  const enCaja = !sale.liberada_almacen_at;
  const pendiente = Math.max(sale.total - sale.amount_paid, 0);

  const [cobrando, setCobrando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [historial, setHistorial] = useState<CobroHistorialEntry[]>([]);

  const cargarHistorial = useCallback(async () => {
    if (!esGerencia) return;
    const { historial: h } = await cargarHistorialCobros(sale.id);
    setHistorial(h);
  }, [esGerencia, sale.id]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial, sale.amount_paid]);

  function terminado() {
    setCobrando(false);
    setCorrigiendo(false);
    onUpdated?.();
  }

  return (
    <div className="mt-2 bg-gigante-bg rounded-lg p-3">
      {sale.metodo_pago && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gigante-muted mb-2">
          <span className="rounded-full bg-white border border-gigante-border px-2 py-0.5 text-gigante-navy">
            {METODO_PAGO_VENTA_LABELS[sale.metodo_pago]}
            {sale.metodo_pago === "a_meses" && sale.meses_nota ? ` · ${sale.meses_nota}` : ""}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gigante-muted">Pagado en caja</p>
          <p className="text-sm font-semibold text-emerald-700">{money(sale.amount_paid)}</p>
        </div>
        <div>
          <p className="text-xs text-gigante-muted">Saldo por cobrar</p>
          <p className={`text-sm font-semibold ${pendiente > 0 ? "text-gigante-red" : "text-gigante-muted"}`}>
            {money(pendiente)}
          </p>
        </div>
        <span className={`text-xs rounded-full px-2 py-1 ${ESTADO_PAGO_BADGE[sale.estado_pago]}`}>
          {ESTADO_PAGO_LABELS[sale.estado_pago]}
        </span>
      </div>

      {enCaja ? (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 rounded-md px-2 py-1.5 mt-2">
          <Clock size={13} /> Esperando cobro en Caja. Almacén la verá hasta que Caja confirme el cobro.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 mt-2">
          <CheckCircle2 size={13} />
          Pasó a almacén{sale.liberada_sin_cobro ? " sin cobro (pagará en su domicilio)" : ""}
          {sale.payment_confirmed_by ? ` · registró ${nameFor(sale.payment_confirmed_by)}` : ""}
        </p>
      )}

      {pendiente > 0 && !enCaja && (
        <p className="text-[11px] text-gigante-muted mt-1">
          Este saldo se lo cobra el chofer al entregar (lo ve en su reparto) y Caja lo confirma en “Evidencias y Cobros”.
        </p>
      )}

      {esCaja && sale.status !== "cancelada" && (
        <div className="mt-3">
          {enCaja ? (
            <button
              onClick={() => setCobrando(true)}
              className="w-full bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg py-2.5"
            >
              Confirmar cobro
            </button>
          ) : puedeCorregir ? (
            <button onClick={() => setCorrigiendo(true)} className="text-xs font-semibold text-gigante-red hover:underline">
              Corregir cobro
            </button>
          ) : (
            <p className="text-[11px] text-gigante-muted">Pídele a Gerencia que corrija el monto cobrado.</p>
          )}
        </div>
      )}

      {esGerencia && historial.length > 0 && (
        <div className="mt-3 border-t border-gigante-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gigante-navy mb-2">
            <History size={13} /> Historial de correcciones del cobro
          </p>
          <ul className="space-y-2">
            {historial.map((h) => (
              <li key={h.id} className="bg-white border border-gigante-border rounded-lg px-3 py-2 text-xs">
                <p className="text-gigante-navy">
                  <span className="font-semibold">{money(h.monto_anterior)}</span> →{" "}
                  <span className="font-semibold">{money(h.monto_nuevo)}</span>
                  {h.metodo_anterior !== h.metodo_nuevo && h.metodo_nuevo && (
                    <span className="text-gigante-muted"> · método: {METODO_PAGO_VENTA_LABELS[h.metodo_nuevo]}</span>
                  )}
                </p>
                <p className="text-gigante-muted mt-0.5">Motivo: {h.motivo}</p>
                <p className="text-[11px] text-gigante-muted mt-0.5">
                  {nameFor(h.created_by)} · {new Date(h.created_at).toLocaleString("es-MX")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cobrando && <CobrarVentaModal sale={sale} onClose={() => setCobrando(false)} onDone={terminado} />}
      {corrigiendo && <CorregirCobroModal sale={sale} onClose={() => setCorrigiendo(false)} onDone={terminado} />}
    </div>
  );
}
