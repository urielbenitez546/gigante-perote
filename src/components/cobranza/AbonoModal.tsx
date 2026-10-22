import { useState } from "react";
import { X } from "lucide-react";
import { fechaCorta, fechaMX, hoyMX, registrarAbono, type VentaResumen } from "../../hooks/useCobranza";
import { METODO_PAGO_VENTA_LABELS, type MetodoPagoVenta } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  venta: Pick<VentaResumen, "id" | "folio" | "customer_name" | "created_at" | "total" | "amount_paid">;
  onClose: () => void;
  onDone: () => void;
}

/** Caja registra un abono posterior de un cliente. Venta o cobranza se decide sola por la fecha. */
export default function AbonoModal({ venta, onClose, onDone }: Props) {
  const saldo = Math.round((Number(venta.total) - Number(venta.amount_paid)) * 100) / 100;
  const hoy = hoyMX();
  const fechaVenta = fechaMX(venta.created_at);
  const [monto, setMonto] = useState(saldo > 0 ? String(saldo) : "");
  const [metodo, setMetodo] = useState<MetodoPagoVenta | "">("efectivo");
  const [recibo, setRecibo] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esVenta = fecha <= fechaVenta;
  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  async function guardar() {
    setError(null);
    const m = Number(monto);
    if (!monto.trim() || Number.isNaN(m) || m <= 0) return setError("Escribe un monto mayor a cero.");
    if (m > saldo + 0.004) return setError(`El abono no puede ser mayor al saldo (${money(saldo)}).`);
    setGuardando(true);
    const { error: err } = await registrarAbono(venta.id, { monto: m, metodo, recibo: recibo.trim(), fecha, comentario: comentario.trim() });
    setGuardando(false);
    if (err) return setError(err);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">Registrar abono · {venta.folio}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted">{venta.customer_name}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gigante-bg px-2 py-2">
            <p className="text-[11px] text-gigante-muted">Total</p>
            <p className="text-sm font-bold text-gigante-navy">{money(Number(venta.total))}</p>
          </div>
          <div className="rounded-lg bg-gigante-bg px-2 py-2">
            <p className="text-[11px] text-gigante-muted">Pagado</p>
            <p className="text-sm font-bold text-emerald-700">{money(Number(venta.amount_paid))}</p>
          </div>
          <div className="rounded-lg bg-gigante-bg px-2 py-2">
            <p className="text-[11px] text-gigante-muted">Saldo</p>
            <p className="text-sm font-bold text-gigante-red">{money(saldo)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gigante-navy">
              Monto del abono
              <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={`${campo} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gigante-navy">
              Método
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagoVenta | "")} className={`${campo} mt-1 bg-white`}>
                <option value="">Sin definir</option>
                {(Object.keys(METODO_PAGO_VENTA_LABELS) as MetodoPagoVenta[]).map((m) => (
                  <option key={m} value={m}>
                    {METODO_PAGO_VENTA_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gigante-navy">
              Núm. de recibo
              <input value={recibo} onChange={(e) => setRecibo(e.target.value)} placeholder="Ej. 1489" className={`${campo} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gigante-navy">
              Fecha del pago
              <input type="date" value={fecha} min={fechaVenta} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={`${campo} mt-1`} />
            </label>
          </div>
          <label className="block text-sm font-medium text-gigante-navy">
            Comentario (opcional)
            <input value={comentario} onChange={(e) => setComentario(e.target.value)} className={`${campo} mt-1`} />
          </label>
        </div>

        <p className={`mt-3 text-xs rounded-lg px-3 py-2 ${esVenta ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>
          Se registrará como <strong>{esVenta ? "VENTA" : "COBRANZA"}</strong>:{" "}
          {esVenta
            ? "el pago es el mismo día de la venta."
            : `la venta fue el ${fechaCorta(fechaVenta)} y el pago es de otro día.`}
        </p>

        {error && <p className="text-xs text-gigante-red mt-3">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || saldo <= 0}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {guardando ? "Guardando..." : "Registrar abono"}
          </button>
        </div>
      </div>
    </div>
  );
}
