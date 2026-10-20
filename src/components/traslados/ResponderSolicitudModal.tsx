import { useState } from "react";
import { X } from "lucide-react";
import {
  TIPO_RESPUESTA_LABELS,
  responderSolicitudTraslado,
  type SolicitudTraslado,
  type TipoRespuesta,
} from "../../hooks/useTraslados";

interface Props {
  solicitud: SolicitudTraslado;
  /** Respuesta que esta persona ya había dado (para corregirla). */
  previa?: { tipo: TipoRespuesta; cantidad: number; nota: string | null };
  onClose: () => void;
  onSaved: () => void;
}

/** El vendedor avisa si ya vendió o comprometió material que la sucursal está pidiendo. */
export default function ResponderSolicitudModal({ solicitud, previa, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<TipoRespuesta>(previa?.tipo ?? "sin_compromiso");
  const [cantidad, setCantidad] = useState(previa && previa.cantidad > 0 ? String(previa.cantidad) : "");
  const [nota, setNota] = useState(previa?.nota ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unidad = solicitud.product?.unit ?? "";

  async function guardar() {
    setError(null);
    const n = tipo === "sin_compromiso" ? 0 : Number(cantidad);
    if (tipo !== "sin_compromiso" && (!n || n <= 0)) return setError("Escribe cuánto vendiste o comprometiste.");
    setGuardando(true);
    const { error: err } = await responderSolicitudTraslado(solicitud.id, tipo, n, nota);
    setGuardando(false);
    if (err) return setError(err);
    onSaved();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">Responder solicitud</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-navy mb-3">
          {solicitud.sucursal} pide {solicitud.cantidad} {unidad} de{" "}
          <strong>{solicitud.product?.code}</strong> — {solicitud.product?.name}
        </p>

        <div className="space-y-2">
          {(Object.keys(TIPO_RESPUESTA_LABELS) as TipoRespuesta[]).map((t) => (
            <label
              key={t}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                tipo === t ? "border-gigante-navy bg-gigante-navy/5" : "border-gigante-border"
              }`}
            >
              <input type="radio" checked={tipo === t} onChange={() => setTipo(t)} />
              {TIPO_RESPUESTA_LABELS[t]}
            </label>
          ))}
        </div>

        {tipo !== "sin_compromiso" && (
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-gigante-navy">
              ¿Cuánto? ({unidad})
              <input type="number" min="0.01" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={campo} />
            </label>
            <p className="text-[11px] text-gigante-muted">
              Anota solo lo que <strong>todavía no registraste</strong> como venta en el sistema: lo ya registrado se
              descuenta solo y no debe contarse dos veces.
            </p>
            <label className="block text-xs font-medium text-gigante-navy">
              Nota (opcional)
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. cliente Pérez, pasa el jueves" className={campo} />
            </label>
          </div>
        )}

        {error && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <div className="flex gap-3 pt-4">
          <button onClick={onClose} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {guardando ? "Guardando..." : "Enviar respuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
