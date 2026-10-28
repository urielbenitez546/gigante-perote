import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Send, RefreshCw, MessageSquareReply, XCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  TIPO_RESPUESTA_LABELS,
  cancelarSolicitudTraslado,
  useSolicitudesTraslado,
  useTrasladosEnviados,
  type SolicitudTraslado,
} from "../../hooks/useTraslados";
import { signedPhotoUrl } from "../../lib/storage";
import { tienePermiso, unidadLabel } from "../../types";
import NuevaSolicitudModal from "../../components/traslados/NuevaSolicitudModal";
import ResponderSolicitudModal from "../../components/traslados/ResponderSolicitudModal";
import EnviarTrasladoModal from "../../components/traslados/EnviarTrasladoModal";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => r2(n).toLocaleString("es-MX", { maximumFractionDigits: 2 });
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Traslados() {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const { products, reload: reloadProducts } = useProducts();
  const { solicitudes, loading, error, reload } = useSolicitudesTraslado();
  const { traslados, error: errorTraslados, reload: reloadTraslados } = useTrasladosEnviados();

  const gestiona = tienePermiso(profile, "operar_almacen"); // jefe, auxiliar y Gerencia
  const responde = profile?.role === "ventas" || profile?.role === "gerencia";

  const [nueva, setNueva] = useState(false);
  const [directo, setDirecto] = useState(false);
  const [respondiendo, setRespondiendo] = useState<SolicitudTraslado | null>(null);
  const [enviando, setEnviando] = useState<SolicitudTraslado | null>(null);
  const [cancelando, setCancelando] = useState<SolicitudTraslado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);
  const [verCerradas, setVerCerradas] = useState(false);

  const abiertas = useMemo(() => solicitudes.filter((s) => s.estado === "abierta"), [solicitudes]);
  const cerradas = useMemo(() => solicitudes.filter((s) => s.estado !== "abierta").slice(0, 20), [solicitudes]);
  const sucursales = useMemo(
    () => Array.from(new Set([...solicitudes.map((s) => s.sucursal), ...traslados.map((t) => t.destino)])).sort(),
    [solicitudes, traslados]
  );

  function recargar() {
    reload();
    reloadTraslados();
    reloadProducts();
  }

  async function confirmarCancelar() {
    if (!cancelando) return;
    setErrorCancelar(null);
    const { error: err } = await cancelarSolicitudTraslado(cancelando.id, motivo);
    if (err) return setErrorCancelar(err);
    setCancelando(null);
    setMotivo("");
    recargar();
  }

  async function abrirFoto(path: string) {
    const ventana = window.open("", "_blank");
    const url = await signedPhotoUrl("kardex-soporte", path, 600);
    if (!url) {
      ventana?.close();
      return;
    }
    if (ventana) ventana.location.href = url;
  }

  function tarjeta(s: SolicitudTraslado) {
    const p = products.find((x) => x.id === s.product_id);
    const unidad = unidadLabel(s.product?.unit);
    const fisico = p ? Number(p.physical_stock) : null;
    const apartado = p ? Number(p.sold_pending) : null;
    const disponible = fisico !== null && apartado !== null ? fisico - apartado : null;
    const comprometido = s.respuestas.reduce((t, r) => t + Number(r.cantidad), 0);
    const libre = disponible !== null ? disponible - comprometido : null;
    const alcanza = libre !== null && libre >= s.cantidad;
    const miRespuesta = s.respuestas.find((r) => r.created_by === profile?.id);
    const sinResponder = s.respuestas.length === 0;

    return (
      <div key={s.id} className="bg-white border border-gigante-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gigante-navy">
              {s.sucursal} pide {fmt(s.cantidad)} {unidad}
            </p>
            <p className="text-sm text-gigante-navy">
              <span className="font-medium">{s.product?.code}</span> — {s.product?.name}
            </p>
            <p className="text-[11px] text-gigante-muted mt-0.5">
              Solicitó {nameFor(s.created_by)} · {fecha(s.created_at)}
              {s.nota ? ` · ${s.nota}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-[11px] rounded-full bg-amber-100 text-amber-800 px-2 py-1">
            {sinResponder ? "Sin respuestas" : `${s.respuestas.length} respuesta(s)`}
          </span>
        </div>

        {disponible !== null && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-gigante-bg p-2">
              <p className="text-[10px] text-gigante-muted">Existencia</p>
              <p className="text-sm font-semibold text-gigante-navy">{fmt(fisico as number)}</p>
            </div>
            <div className="rounded-lg bg-gigante-bg p-2">
              <p className="text-[10px] text-gigante-muted">Apartado en ventas</p>
              <p className="text-sm font-semibold text-gigante-navy">{fmt(apartado as number)}</p>
            </div>
            <div className="rounded-lg bg-gigante-bg p-2">
              <p className="text-[10px] text-gigante-muted">Comprometido (vendedores)</p>
              <p className="text-sm font-semibold text-gigante-navy">{fmt(comprometido)}</p>
            </div>
            <div className={`rounded-lg p-2 ${alcanza ? "bg-emerald-50" : "bg-red-50"}`}>
              <p className="text-[10px] text-gigante-muted">Libre para trasladar</p>
              <p className={`text-sm font-bold ${alcanza ? "text-emerald-700" : "text-red-700"}`}>
                {fmt(Math.max(libre as number, 0))}
              </p>
            </div>
          </div>
        )}
        {libre !== null && (
          <p className={`mt-2 text-[11px] flex items-center gap-1 ${alcanza ? "text-emerald-700" : "text-red-700"}`}>
            {alcanza ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {alcanza
              ? "Alcanza para enviar todo lo que piden."
              : `No alcanza: faltarían ${fmt(s.cantidad - Math.max(libre, 0))} ${unidad} para completar lo que piden.`}
          </p>
        )}

        {s.respuestas.length > 0 && (
          <ul className="mt-3 space-y-1">
            {s.respuestas.map((r) => (
              <li key={r.id} className="text-[11px] text-gigante-muted">
                <span className="font-medium text-gigante-navy">{nameFor(r.created_by)}</span>:{" "}
                {TIPO_RESPUESTA_LABELS[r.tipo]}
                {r.cantidad > 0 ? ` ${fmt(Number(r.cantidad))} ${unidad}` : ""}
                {r.nota ? ` — ${r.nota}` : ""}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {responde && (
            <button
              onClick={() => setRespondiendo(s)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-navy rounded-lg px-3 py-1.5"
            >
              <MessageSquareReply size={14} /> {miRespuesta ? "Cambiar mi respuesta" : "Responder"}
            </button>
          )}
          {gestiona && (
            <>
              <button
                onClick={() => setEnviando(s)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-red hover:bg-gigante-redDark rounded-lg px-3 py-1.5"
              >
                <Send size={14} /> Enviar traslado
              </button>
              <button
                onClick={() => {
                  setCancelando(s);
                  setMotivo("");
                  setErrorCancelar(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium border border-gigante-border text-gigante-navy rounded-lg px-3 py-1.5 bg-white"
              >
                <XCircle size={14} /> Cancelar solicitud
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <ArrowRightLeft size={22} /> Traslados a sucursales
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            Cuando una sucursal pide material, Ventas avisa si ya lo vendió o comprometió y almacén ve cuánto queda libre.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={recargar}
            className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-medium rounded-lg px-3 py-2"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          {gestiona && (
            <>
              <button
                onClick={() => setDirecto(true)}
                className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-medium rounded-lg px-3 py-2 bg-white"
              >
                <Send size={14} /> Traslado directo
              </button>
              <button
                onClick={() => setNueva(true)}
                className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2"
              >
                <Plus size={16} /> Nueva solicitud
              </button>
            </>
          )}
        </div>
      </div>

      {(error || errorTraslados) && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error ?? errorTraslados}
          {" — ¿ya corriste la migración 0027 en Supabase?"}
        </p>
      )}

      <h2 className="text-sm font-semibold text-gigante-navy mt-6 mb-2">Solicitudes abiertas ({abiertas.length})</h2>
      {loading ? (
        <p className="text-sm text-gigante-muted">Cargando...</p>
      ) : abiertas.length === 0 ? (
        <p className="text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-5">
          No hay solicitudes abiertas.
        </p>
      ) : (
        <div className="space-y-3">{abiertas.map(tarjeta)}</div>
      )}

      <h2 className="text-sm font-semibold text-gigante-navy mt-8 mb-2">Traslados enviados</h2>
      {traslados.length === 0 ? (
        <p className="text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-5">
          Todavía no hay traslados registrados.
        </p>
      ) : (
        <div className="bg-white border border-gigante-border rounded-xl divide-y divide-gigante-border overflow-hidden">
          {traslados.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm text-gigante-navy ${t.anulado_at ? "line-through text-gigante-muted" : ""}`}>
                  <strong>{fmt(Number(t.quantity))}</strong> {unidadLabel(t.product?.unit)} de {t.product?.code} → {t.destino}
                </p>
                <p className="text-[11px] text-gigante-muted">
                  {nameFor(t.created_by)} · {fecha(t.created_at)}
                  {t.anulado_at ? " · Anulado en el Kardex" : ""}
                </p>
              </div>
              {gestiona && t.foto_path && (
                <button onClick={() => abrirFoto(t.foto_path as string)} className="text-[11px] text-gigante-navy underline shrink-0">
                  Ver foto
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {cerradas.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setVerCerradas((v) => !v)} className="text-xs font-semibold text-gigante-navy underline">
            {verCerradas ? "Ocultar" : "Ver"} solicitudes cerradas ({cerradas.length})
          </button>
          {verCerradas && (
            <div className="mt-2 bg-white border border-gigante-border rounded-xl divide-y divide-gigante-border">
              {cerradas.map((s) => (
                <div key={s.id} className="px-4 py-3 text-sm">
                  <p className="text-gigante-navy">
                    {s.sucursal} · {s.product?.code} · pidió {fmt(s.cantidad)}
                    {s.estado === "atendida" && s.cantidad_enviada != null ? ` · se enviaron ${fmt(Number(s.cantidad_enviada))}` : ""}
                  </p>
                  <p className="text-[11px] text-gigante-muted">
                    {s.estado === "atendida" ? "Atendida" : "Cancelada"} por {nameFor(s.cerrada_por)}
                    {s.cerrada_at ? ` · ${fecha(s.cerrada_at)}` : ""}
                    {s.motivo_cierre ? ` — ${s.motivo_cierre}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {nueva && (
        <NuevaSolicitudModal
          products={products}
          sucursalesConocidas={sucursales}
          onClose={() => setNueva(false)}
          onSaved={() => {
            setNueva(false);
            recargar();
          }}
        />
      )}

      {respondiendo && (
        <ResponderSolicitudModal
          solicitud={respondiendo}
          previa={(() => {
            const r = respondiendo.respuestas.find((x) => x.created_by === profile?.id);
            return r ? { tipo: r.tipo, cantidad: Number(r.cantidad), nota: r.nota } : undefined;
          })()}
          onClose={() => setRespondiendo(null)}
          onSaved={() => {
            setRespondiendo(null);
            recargar();
          }}
        />
      )}

      {(enviando || directo) && (
        <EnviarTrasladoModal
          products={products}
          solicitud={enviando ?? undefined}
          sucursalesConocidas={sucursales}
          sugerida={(() => {
            if (!enviando) return undefined;
            const p = products.find((x) => x.id === enviando.product_id);
            if (!p) return undefined;
            const comprometido = enviando.respuestas.reduce((t, r) => t + Number(r.cantidad), 0);
            return Math.max(Number(p.physical_stock) - Number(p.sold_pending) - comprometido, 0);
          })()}
          onClose={() => {
            setEnviando(null);
            setDirecto(false);
          }}
          onSaved={() => {
            setEnviando(null);
            setDirecto(false);
            recargar();
          }}
        />
      )}

      {cancelando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold text-gigante-navy mb-1">Cancelar solicitud</h2>
            <p className="text-sm text-gigante-muted mb-3">
              {cancelando.sucursal} · {cancelando.product?.code}
            </p>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (ej. ya no lo necesitan)"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
            {errorCancelar && <p className="text-xs text-gigante-red mt-2">{errorCancelar}</p>}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setCancelando(null)}
                className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
              >
                Volver
              </button>
              <button
                onClick={confirmarCancelar}
                disabled={!motivo.trim()}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                Cancelar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
