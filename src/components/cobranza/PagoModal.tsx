import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  ORIGEN_PAGO_LABELS,
  TIPO_PAGO_LABELS,
  anularPago,
  cargarBitacoraPago,
  corregirPago,
  fechaCorta,
  fechaMX,
  hoyMX,
  metodoLabel,
  type PagoLogEntry,
  type PagoRow,
  type TipoPago,
} from "../../hooks/useCobranza";
import { METODO_PAGO_VENTA_LABELS, type MetodoPagoVenta } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  pago: PagoRow;
  /** Si no puede corregir, solo ve el detalle y la bitácora. */
  puedeCorregir: boolean;
  onClose: () => void;
  onDone: () => void;
}

const ACCION_LABEL: Record<PagoLogEntry["accion"], string> = {
  registro: "Registrado",
  correccion: "Corregido",
  anulacion: "Anulado",
};

function resumenCambio(e: PagoLogEntry): string {
  if (e.accion === "registro") return "";
  const a = e.antes ?? {};
  const d = e.despues ?? {};
  const partes: string[] = [];
  const m = (k: string) => (a[k] !== d[k] && d[k] !== undefined ? k : null);
  if (m("monto")) partes.push(`monto ${money(Number(a.monto))} → ${money(Number(d.monto))}`);
  if (m("tipo")) partes.push(`tipo ${String(a.tipo)} → ${String(d.tipo)}`);
  if (m("fecha_pago")) partes.push(`fecha de pago ${fechaCorta(String(a.fecha_pago))} → ${fechaCorta(String(d.fecha_pago))}`);
  if (m("fecha_caja")) partes.push(`fecha en caja ${fechaCorta(String(a.fecha_caja))} → ${fechaCorta(String(d.fecha_caja))}`);
  if (m("recibo")) partes.push(`recibo ${String(a.recibo ?? "—")} → ${String(d.recibo ?? "—")}`);
  if (m("metodo")) partes.push(`método ${metodoLabel(String(a.metodo ?? ""))} → ${metodoLabel(String(d.metodo ?? ""))}`);
  if (e.accion === "anulacion" && a.monto !== undefined) partes.push(`se anuló ${money(Number(a.monto))}`);
  return partes.join(" · ");
}

export default function PagoModal({ pago, puedeCorregir, onClose, onDone }: Props) {
  const { nameFor } = useProfileNames();
  const hoy = hoyMX();
  const fechaVenta = pago.sale ? fechaMX(pago.sale.created_at) : pago.fecha_pago;
  const editable = puedeCorregir && !pago.anulado;

  const [monto, setMonto] = useState(String(pago.monto));
  const [metodo, setMetodo] = useState<string>(pago.metodo ?? "");
  const [recibo, setRecibo] = useState(pago.recibo ?? "");
  const [fechaPago, setFechaPago] = useState(pago.fecha_pago);
  const [fechaCaja, setFechaCaja] = useState(pago.fecha_caja);
  const [tipo, setTipo] = useState<TipoPago | "">(pago.tipo_manual ? pago.tipo : "");
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<PagoLogEntry[]>([]);

  useEffect(() => {
    cargarBitacoraPago(pago.id).then((r) => setLog(r.log));
  }, [pago.id]);

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";
  const tipoAuto: TipoPago = fechaPago <= fechaVenta ? "venta" : "cobranza";
  const tipoFinal = tipo || tipoAuto;

  async function guardar() {
    setError(null);
    const m = Number(monto);
    if (!monto.trim() || Number.isNaN(m) || m <= 0) return setError("El monto debe ser mayor a cero. Si el pago no existe, anúlalo.");
    if (!motivo.trim()) return setError("Escribe el motivo de la corrección.");
    setGuardando(true);
    const { error: err } = await corregirPago(pago.id, { monto: m, metodo, recibo: recibo.trim(), fechaPago, fechaCaja, tipo, motivo: motivo.trim() });
    setGuardando(false);
    if (err) return setError(err);
    onDone();
  }

  async function anular() {
    setError(null);
    if (!motivo.trim()) return setError("Escribe el motivo para anular el pago.");
    setGuardando(true);
    const { error: err } = await anularPago(pago.id, motivo.trim());
    setGuardando(false);
    if (err) return setError(err);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">
            {pago.anulado ? "Pago anulado" : editable ? "Corregir pago" : "Detalle del pago"} · {pago.sale?.folio ?? ""}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted">
          {pago.sale?.customer_name} · {ORIGEN_PAGO_LABELS[pago.origen]} · registró {nameFor(pago.registrado_por)}
        </p>
        {pago.anulado && (
          <p className="mt-2 text-xs rounded-lg bg-gigante-red/10 text-gigante-red px-3 py-2">
            Anulado{pago.anulado_at ? ` el ${new Date(pago.anulado_at).toLocaleString("es-MX")}` : ""}. Motivo: {pago.anulado_motivo}
          </p>
        )}

        {editable ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-gigante-navy">
                Monto
                <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={`${campo} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-gigante-navy">
                Método
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={`${campo} mt-1 bg-white`}>
                  <option value="">Sin definir</option>
                  {(Object.keys(METODO_PAGO_VENTA_LABELS) as MetodoPagoVenta[]).map((m) => (
                    <option key={m} value={m}>
                      {METODO_PAGO_VENTA_LABELS[m]}
                    </option>
                  ))}
                  {pago.metodo === "tarjeta" && <option value="tarjeta">Tarjeta</option>}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-sm font-medium text-gigante-navy">
                Recibo
                <input value={recibo} onChange={(e) => setRecibo(e.target.value)} className={`${campo} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-gigante-navy">
                Fecha de pago
                <input type="date" value={fechaPago} min={fechaVenta} max={hoy} onChange={(e) => setFechaPago(e.target.value || pago.fecha_pago)} className={`${campo} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-gigante-navy">
                Fecha en caja
                <input type="date" value={fechaCaja} max={hoy} onChange={(e) => setFechaCaja(e.target.value || pago.fecha_caja)} className={`${campo} mt-1`} />
              </label>
            </div>
            <label className="block text-sm font-medium text-gigante-navy">
              Cuenta como
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPago | "")} className={`${campo} mt-1 bg-white`}>
                <option value="">Automático (según las fechas): {TIPO_PAGO_LABELS[tipoAuto]}</option>
                <option value="venta">Venta</option>
                <option value="cobranza">Cobranza</option>
              </select>
            </label>
            <p className="text-[11px] text-gigante-muted -mt-1">
              Ahora queda como <strong>{TIPO_PAGO_LABELS[tipoFinal]}</strong>. La venta fue el {fechaCorta(fechaVenta)}.
            </p>
            <label className="block text-sm font-medium text-gigante-navy">
              Motivo <span className="text-gigante-red">*</span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Ej. Anoté $1,500 y eran $1,050 / Se entregó el material ese mismo día"
                className={`${campo} mt-1`}
              />
            </label>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <p><span className="text-gigante-muted">Monto:</span> <strong>{money(pago.monto)}</strong></p>
            <p><span className="text-gigante-muted">Método:</span> {metodoLabel(pago.metodo)}</p>
            <p><span className="text-gigante-muted">Recibo:</span> {pago.recibo || "—"}</p>
            <p><span className="text-gigante-muted">Cuenta como:</span> {TIPO_PAGO_LABELS[pago.tipo]}</p>
            <p><span className="text-gigante-muted">Fecha de pago:</span> {fechaCorta(pago.fecha_pago)}</p>
            <p><span className="text-gigante-muted">Fecha en caja:</span> {fechaCorta(pago.fecha_caja)}</p>
          </div>
        )}

        {error && <p className="text-xs text-gigante-red mt-3">{error}</p>}

        {editable && (
          <div className="mt-4 flex gap-2">
            <button onClick={onClose} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
              Cancelar
            </button>
            <button
              onClick={anulando ? anular : guardar}
              disabled={guardando}
              className={`flex-1 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold ${anulando ? "bg-gigante-red hover:bg-gigante-redDark" : "bg-gigante-navy hover:opacity-90"}`}
            >
              {guardando ? "Guardando..." : anulando ? "Anular este pago" : "Guardar corrección"}
            </button>
          </div>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => {
              setAnulando((v) => !v);
              setError(null);
            }}
            className="mt-2 text-xs font-semibold text-gigante-red hover:underline"
          >
            {anulando ? "← Mejor corregirlo" : "Este pago no existe o se duplicó: anularlo"}
          </button>
        )}

        <div className="mt-5 border-t border-gigante-border pt-3">
          <p className="text-xs font-semibold text-gigante-navy mb-2">Bitácora de este pago</p>
          {log.length === 0 ? (
            <p className="text-[11px] text-gigante-muted">Sin movimientos todavía.</p>
          ) : (
            <ul className="space-y-1.5">
              {log.map((e) => (
                <li key={e.id} className="text-[11px] text-gigante-navy bg-gigante-bg rounded-md px-2 py-1.5">
                  <strong>{ACCION_LABEL[e.accion]}</strong> · {nameFor(e.por)} · {new Date(e.at).toLocaleString("es-MX")}
                  {resumenCambio(e) && <span className="block text-gigante-muted">{resumenCambio(e)}</span>}
                  {e.motivo && <span className="block text-gigante-muted">Motivo: {e.motivo}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
