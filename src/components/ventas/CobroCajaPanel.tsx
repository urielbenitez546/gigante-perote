import { useState } from "react";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProfileNames } from "../../hooks/useProfileNames";
import { cajaCobrarVenta, guardarFolioFactura } from "../../hooks/useSales";
import {
  ESTADO_PAGO_LABELS,
  METODO_PAGO_VENTA_LABELS,
  TIPO_DOCUMENTO_LABELS,
  tienePermiso,
  type MetodoPagoVenta,
  type SaleWithItems,
} from "../../types";

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
 * Documento, método de pago y cobro de una venta.
 * - Mientras la venta esté en Caja: Caja (o Gerencia) registra cuánto pagó el
 *   cliente y con eso la pasa a almacén. Excepción: "Pasar a almacén sin cobro".
 * - Después: solo Gerencia corrige el monto; Caja puede completar el folio de factura.
 */
export default function CobroCajaPanel({ sale, onUpdated }: Props) {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const esCaja = profile?.role === "gerencia" || profile?.role === "caja";
  const puedeCorregir = tienePermiso(profile, "corregir_cobros");
  const enCaja = !sale.liberada_almacen_at;
  const pendiente = Math.max(sale.total - sale.amount_paid, 0);

  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(String(sale.amount_paid > 0 ? sale.amount_paid : sale.total));
  const [metodo, setMetodo] = useState<MetodoPagoVenta | "">(sale.metodo_pago ?? "");
  const [meses, setMeses] = useState(sale.meses_nota ?? "");
  const [folio, setFolio] = useState(sale.numero_factura ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  async function guardar(sinCobro: boolean) {
    setError(null);
    const amount = sinCobro ? 0 : Number(monto);
    if (!sinCobro) {
      if (Number.isNaN(amount) || amount <= 0) {
        setError("Escribe cuánto pagó el cliente (mayor a 0), o usa “Pasar a almacén sin cobro”.");
        return;
      }
      if (amount > sale.total) {
        setError(`No puede ser mayor al total (${money(sale.total)}).`);
        return;
      }
    }
    setGuardando(true);
    const { error: err } = await cajaCobrarVenta(sale.id, {
      amount,
      metodoPago: metodo,
      numeroFactura: folio,
      mesesNota: meses,
      pasarSinCobro: sinCobro,
    });
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    setAbierto(false);
    onUpdated?.();
  }

  async function guardarSoloFolio() {
    setError(null);
    setGuardando(true);
    const { error: err } = await guardarFolioFactura(sale.id, folio);
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onUpdated?.();
  }

  // Caja puede registrar el cobro si todavía no hay ninguno (ej. se pasó sin cobro);
  // una vez que hay un cobro, corregirlo es solo de Gerencia.
  const puedeEditarCobro = puedeCorregir || sale.amount_paid === 0;
  const mostrarFormulario = esCaja && (enCaja || (abierto && puedeEditarCobro));

  return (
    <div className="mt-2 bg-gigante-bg rounded-lg p-3">
      {/* Resumen del documento */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gigante-muted mb-2">
        <span className="rounded-full bg-white border border-gigante-border px-2 py-0.5 text-gigante-navy">
          {TIPO_DOCUMENTO_LABELS[sale.tipo_documento]}
          {sale.tipo_documento === "factura" && sale.numero_factura ? ` · ${sale.numero_factura}` : ""}
        </span>
        {sale.numero_orden && (
          <span className="rounded-full bg-white border border-gigante-border px-2 py-0.5 text-gigante-navy">
            Orden {sale.numero_orden}
          </span>
        )}
        {sale.metodo_pago && (
          <span className="rounded-full bg-white border border-gigante-border px-2 py-0.5 text-gigante-navy">
            {METODO_PAGO_VENTA_LABELS[sale.metodo_pago]}
            {sale.metodo_pago === "a_meses" && sale.meses_nota ? ` · ${sale.meses_nota}` : ""}
          </span>
        )}
        {sale.tipo_documento === "factura" && !sale.numero_factura && (
          <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5">Falta folio de factura</span>
        )}
      </div>

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
          <Clock size={13} /> Esperando a Caja. Almacén la verá hasta que Caja registre el pago.
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

      {mostrarFormulario && (
        <div className="mt-3 space-y-2 border-t border-gigante-border pt-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-medium text-gigante-navy">
              Pagó el cliente
              <input
                type="number"
                min="0"
                max={sale.total}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={campo}
              />
            </label>
            <label className="block text-[11px] font-medium text-gigante-navy">
              Método de pago
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoPagoVenta | "")}
                className={`${campo} bg-white`}
              >
                <option value="">Sin definir</option>
                {(Object.keys(METODO_PAGO_VENTA_LABELS) as MetodoPagoVenta[]).map((m) => (
                  <option key={m} value={m}>
                    {METODO_PAGO_VENTA_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2 text-[11px]">
            <button type="button" onClick={() => setMonto(String(sale.total))} className="text-gigante-red font-semibold hover:underline">
              Pagó el total ({money(sale.total)})
            </button>
          </div>
          {metodo === "a_meses" && (
            <label className="block text-[11px] font-medium text-gigante-navy">
              Meses (nota)
              <input value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="Ej. 6 meses sin intereses" className={campo} />
            </label>
          )}
          {sale.tipo_documento === "factura" && (
            <label className="block text-[11px] font-medium text-gigante-navy">
              Folio de la factura
              <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Ej. A-1234" className={campo} />
            </label>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => guardar(false)}
              disabled={guardando}
              className="flex items-center gap-1.5 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-2"
            >
              <Send size={13} />
              {guardando ? "Guardando..." : enCaja ? "Registrar pago y pasar a almacén" : "Guardar corrección"}
            </button>
            {enCaja && (
              <button
                onClick={() => guardar(true)}
                disabled={guardando}
                className="border border-gigante-border bg-white text-gigante-navy text-xs font-medium rounded-lg px-3 py-2 disabled:opacity-60"
              >
                Pasar a almacén sin cobro
              </button>
            )}
            {!enCaja && (
              <button onClick={() => setAbierto(false)} className="text-xs text-gigante-muted px-2">
                Cancelar
              </button>
            )}
          </div>
          {enCaja && (
            <p className="text-[11px] text-gigante-muted">
              “Sin cobro” es para cuando el cliente pagará todo al recibir en su domicilio: pasa a almacén y el
              chofer cobra el total.
            </p>
          )}
        </div>
      )}

      {!enCaja && esCaja && !abierto && (
        <div className="mt-3 space-y-2">
          {sale.tipo_documento === "factura" && !sale.numero_factura && (
            <div className="flex gap-2">
              <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio de la factura" className={campo} />
              <button
                onClick={guardarSoloFolio}
                disabled={guardando || !folio.trim()}
                className="bg-gigante-navy text-white text-xs font-semibold rounded-lg px-3 disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          )}
          {puedeEditarCobro ? (
            <button onClick={() => setAbierto(true)} className="text-xs font-semibold text-gigante-red hover:underline">
              {sale.amount_paid > 0 ? "Corregir cobro" : "Registrar cobro"}
            </button>
          ) : sale.amount_paid > 0 ? (
            <p className="text-[11px] text-gigante-muted">
              El cobro ya quedó registrado. Solo Gerencia puede corregir el monto cobrado.
            </p>
          ) : null}
        </div>
      )}

      {error && <p className="text-xs text-gigante-red mt-2">{error}</p>}
    </div>
  );
}
