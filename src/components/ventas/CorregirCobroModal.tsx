import { useState } from "react";
import { X } from "lucide-react";
import { corregirCobroVenta } from "../../hooks/useSales";
import { METODO_PAGO_VENTA_LABELS, type MetodoPagoVenta, type SaleWithItems } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
  onDone: () => void;
}

/** Caja o Gerencia corrigen el cobro de una venta que ya pasó a almacén. El motivo es obligatorio. */
export default function CorregirCobroModal({ sale, onClose, onDone }: Props) {
  const [monto, setMonto] = useState(String(sale.amount_paid));
  const [metodo, setMetodo] = useState<MetodoPagoVenta | "">(sale.metodo_pago ?? "");
  const [meses, setMeses] = useState(sale.meses_nota ?? "");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  async function guardar() {
    setError(null);
    const amount = Number(monto);
    if (monto.trim() === "" || Number.isNaN(amount) || amount < 0) {
      setError("Escribe el monto correcto (puede ser 0).");
      return;
    }
    if (amount > sale.total) {
      setError(`No puede ser mayor al total (${money(sale.total)}).`);
      return;
    }
    if (!motivo.trim()) {
      setError("Escribe el motivo de la corrección.");
      return;
    }
    setGuardando(true);
    const { error: err } = await corregirCobroVenta(sale.id, {
      monto: amount,
      metodoPago: metodo,
      mesesNota: meses,
      motivo,
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
          <h2 className="text-lg font-bold text-gigante-navy">Corregir cobro · {sale.folio}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted">{sale.customer_name}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-gigante-bg px-3 py-2">
            <p className="text-[11px] text-gigante-muted">Total de la venta</p>
            <p className="text-sm font-bold text-gigante-navy">{money(sale.total)}</p>
          </div>
          <div className="rounded-lg bg-gigante-bg px-3 py-2">
            <p className="text-[11px] text-gigante-muted">Cobro registrado ahorita</p>
            <p className="text-sm font-bold text-emerald-700">{money(sale.amount_paid)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gigante-navy">
              Monto correcto
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
          <label className="block text-sm font-medium text-gigante-navy">
            Motivo de la corrección <span className="text-gigante-red">*</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej. Me equivoqué al teclear, el cliente pagó $1,500 y no $1,050"
              className={`${campo} mt-1`}
            />
          </label>
        </div>

        {error && <p className="text-xs text-gigante-red mt-3">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {guardando ? "Guardando..." : "Guardar corrección"}
          </button>
        </div>
        <p className="text-[11px] text-gigante-muted mt-2">
          El cambio queda guardado con tu nombre, el monto de antes y de después, y el motivo. Gerencia puede verlo. Para corregir un abono o el cobro de un chofer, hazlo en “Cobranza y Corte” → “Historial de cobros”.
        </p>
      </div>
    </div>
  );
}
