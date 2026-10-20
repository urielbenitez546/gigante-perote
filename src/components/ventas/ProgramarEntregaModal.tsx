import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  cargarHistorialProgramacion,
  programarEntrega,
  type ProgramacionLogEntry,
} from "../../hooks/useSales";
import type { SaleWithItems } from "../../types";

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
  onSaved: () => void;
}

const fmtFecha = (f: string | null) =>
  f ? new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }) : "sin fecha";
const fmtHora = (h: string | null) => (h ? h.slice(0, 5) : "sin hora");

/** Asigna o cambia el día y la hora aproximada de entrega de una venta.
 * Si ya tenía fecha, el cambio exige un motivo y queda en el historial. */
export default function ProgramarEntregaModal({ sale, onClose, onSaved }: Props) {
  const { nameFor } = useProfileNames();
  const yaTeniaFecha = !!sale.fecha_programada;
  const [fecha, setFecha] = useState(sale.fecha_programada ?? "");
  const [hora, setHora] = useState(sale.hora_programada ? sale.hora_programada.slice(0, 5) : "");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<ProgramacionLogEntry[]>([]);

  useEffect(() => {
    cargarHistorialProgramacion(sale.id).then(({ entries }) => setHistorial(entries));
  }, [sale.id]);

  const cambio = fecha !== (sale.fecha_programada ?? "") || hora !== (sale.hora_programada ? sale.hora_programada.slice(0, 5) : "");
  const necesitaMotivo = yaTeniaFecha && cambio;

  async function guardar() {
    setError(null);
    if (!fecha) {
      setError("Elige el día de la entrega.");
      return;
    }
    if (!cambio) {
      onClose();
      return;
    }
    if (necesitaMotivo && !motivo.trim()) {
      setError("Escribe el motivo del cambio.");
      return;
    }
    setGuardando(true);
    const { error: err } = await programarEntrega(sale.id, fecha, hora, motivo);
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onSaved();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">
            {yaTeniaFecha ? "Cambiar día y hora" : "Asignar día y hora"} — {sale.folio}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted mb-1">{sale.customer_name}</p>
        {sale.customer_address && <p className="text-xs text-gigante-muted mb-3">{sale.customer_address}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gigante-navy">
            Día
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Hora aproximada
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
          </label>
        </div>

        {necesitaMotivo && (
          <label className="block text-xs font-medium text-gigante-navy mt-3">
            Motivo del cambio
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. el cliente pidió otro día, no hay camioneta"
              className={campo}
            />
          </label>
        )}

        {error && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <div className="flex gap-3 pt-4">
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
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>

        {historial.length > 0 && (
          <div className="mt-5 pt-3 border-t border-gigante-border">
            <p className="text-xs font-semibold text-gigante-navy mb-1.5">Historial de cambios</p>
            <ul className="space-y-1.5">
              {historial.map((h) => (
                <li key={h.id} className="text-[11px] text-gigante-muted">
                  {new Date(h.created_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
                  · {nameFor(h.created_by)}: {fmtFecha(h.fecha_anterior)} {fmtHora(h.hora_anterior)} → {fmtFecha(h.fecha_nueva)}{" "}
                  {fmtHora(h.hora_nueva)}
                  {h.motivo ? ` — “${h.motivo}”` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
