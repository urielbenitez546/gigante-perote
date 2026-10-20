import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { cajaCobrarVenta } from "../../hooks/useSales";
import { METODO_PAGO_VENTA_LABELS, type MetodoPagoVenta, type SaleWithItems } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
  onDone: () => void;
}

/** Caja (o Gerencia) confirma el cobro de una venta nueva y la pasa a almacén. */
export default function CobrarVentaModal({ sale, onClose, onDone }: Props) {
  const [monto, setMonto] = useState(String(sale.total));
  const [metodo, setMetodo] = useState<MetodoPagoVenta | "">(sale.metodo_pago ?? "");
  const [meses, setMeses] = useState(sale.meses_nota ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

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
      mesesNota: meses,
      pasarSinCobro: sinCobro,
    });
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">Confirmar cobro · {sale.folio}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted">{sale.customer_name}</p>

        <div className="mt-3 rounded-lg bg-gigante-bg px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-gigante-muted">Total de la venta</span>
          <span className="text-lg font-bold text-gigante-navy">{money(sale.total)}</span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gigante-navy">
              Pagó el cliente
              <input
                type="number"
                min="0"
                max={sale.total}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={`${campo} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium text-gigante-navy">
              Método de pago
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoPagoVenta | "")}
                className={`${campo} mt-1 bg-white`}
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
          <button
            type="button"
            onClick={() => setMonto(String(sale.total))}
            className="text-xs text-gigante-red font-semibold hover:underline"
          >
            Pagó el total ({money(sale.total)})
          </button>
          {metodo === "a_meses" && (
            <label className="block text-sm font-medium text-gigante-navy">
              Meses (nota)
              <input
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
                placeholder="Ej. 6 meses sin intereses"
                className={`${campo} mt-1`}
              />
            </label>
          )}
        </div>

        {error && <p className="text-xs text-gigante-red mt-3">{error}</p>}

        <button
          onClick={() => guardar(false)}
          disabled={guardando}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-3"
        >
          <CheckCircle2 size={16} />
          {guardando ? "Guardando..." : "Confirmar cobro y pasar a almacén"}
        </button>
        <button
          onClick={() => guardar(true)}
          disabled={guardando}
          className="mt-2 w-full border border-gigante-border bg-white text-gigante-navy text-sm font-medium rounded-lg py-2.5 disabled:opacity-60"
        >
          Pasar a almacén sin cobro
        </button>
        <p className="text-[11px] text-gigante-muted mt-2">
          “Sin cobro” es para cuando el cliente pagará todo al recibir en su domicilio: pasa a almacén y el chofer
          cobra el total.
        </p>
      </div>
    </div>
  );
}
