import { useMemo, useState } from "react";
import { PackagePlus, Plus, Truck, CheckCircle2, XCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  ESTADO_PEDIDO_LABELS,
  cancelarPedidoProveedor,
  marcarPedidoProveedorLlego,
  marcarPedidoProveedorPedido,
  usePedidosProveedor,
  type EstadoPedidoProveedor,
  type PedidoProveedor,
} from "../../hooks/usePedidosProveedor";
import { tienePermiso, unidadLabel } from "../../types";
import NuevoPedidoProveedorModal from "../../components/pedidosproveedor/NuevoPedidoProveedorModal";

type Filtro = "abiertos" | "llegaron" | "cancelados" | "todos";

const BADGE: Record<EstadoPedidoProveedor, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  pedido: "bg-sky-100 text-sky-800",
  llego: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-gray-100 text-gray-600",
};

const fmt = (n: number) => Math.round(n * 100) / 100;
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const soloFecha = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export default function PedidosProveedor() {
  const { profile } = useAuth();
  const { products } = useProducts();
  const { nameFor } = useProfileNames();
  const { pedidos, loading, error, reload } = usePedidosProveedor();

  const gestiona = tienePermiso(profile, "operar_almacen"); // jefe, auxiliar y Gerencia
  const puedePedir = profile?.role === "ventas" || profile?.role === "gerencia";

  const [filtro, setFiltro] = useState<Filtro>("abiertos");
  const [nuevo, setNuevo] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<PedidoProveedor | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [fechaEst, setFechaEst] = useState("");
  const [cancelando, setCancelando] = useState<PedidoProveedor | null>(null);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [errAccion, setErrAccion] = useState<string | null>(null);

  const abiertos = useMemo(() => pedidos.filter((p) => p.estado === "pendiente" || p.estado === "pedido"), [pedidos]);
  const visibles = useMemo(() => {
    if (filtro === "abiertos") return abiertos;
    if (filtro === "llegaron") return pedidos.filter((p) => p.estado === "llego");
    if (filtro === "cancelados") return pedidos.filter((p) => p.estado === "cancelado");
    return pedidos;
  }, [pedidos, abiertos, filtro]);
  const porPedir = pedidos.filter((p) => p.estado === "pendiente").length;

  function puedeCancelar(p: PedidoProveedor) {
    return (p.estado === "pendiente" || p.estado === "pedido") && (gestiona || p.created_by === profile?.id);
  }

  async function confirmarPedido() {
    if (!pidiendo) return;
    setErrAccion(null);
    setTrabajando(true);
    const { error: err } = await marcarPedidoProveedorPedido(pidiendo.id, proveedor, fechaEst);
    setTrabajando(false);
    if (err) return setErrAccion(err);
    setPidiendo(null);
    reload();
  }

  async function yaLlego(p: PedidoProveedor) {
    setErrAccion(null);
    setTrabajando(true);
    const { error: err } = await marcarPedidoProveedorLlego(p.id);
    setTrabajando(false);
    if (err) return setErrAccion(err);
    reload();
  }

  async function confirmarCancelar() {
    if (!cancelando) return;
    setErrAccion(null);
    setTrabajando(true);
    const { error: err } = await cancelarPedidoProveedor(cancelando.id, motivo);
    setTrabajando(false);
    if (err) return setErrAccion(err);
    setCancelando(null);
    setMotivo("");
    reload();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30 mt-1";

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <PackagePlus size={22} /> Pedidos a proveedor
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            Material que un cliente pidió y no hay en la sucursal: Ventas lo captura, Almacén lo pide y avisa cuando llega.
          </p>
        </div>
        {puedePedir && (
          <button
            onClick={() => setNuevo(true)}
            className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            <Plus size={16} /> Pedir a proveedor
          </button>
        )}
      </div>

      {ok && (
        <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Pedido <strong>{ok}</strong> enviado a Almacén.
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          No se pudieron cargar los pedidos: {error}
        </p>
      )}
      {errAccion && !pidiendo && !cancelando && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{errAccion}</p>
      )}
      {gestiona && porPedir > 0 && (
        <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Hay <strong>{porPedir}</strong> pedido(s) por pedir al proveedor. Cuando lo pidas, presiona <strong>Ya lo pedí</strong>.
        </p>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["abiertos", `Abiertos (${abiertos.length})`],
            ["llegaron", "Ya llegaron"],
            ["cancelados", "Cancelados"],
            ["todos", "Todos"],
          ] as [Filtro, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
              filtro === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="text-sm text-gigante-muted p-4">Cargando pedidos...</p>
        ) : visibles.length === 0 ? (
          <p className="bg-white border border-gigante-border rounded-xl p-6 text-sm text-gigante-muted">
            {pedidos.length === 0 ? "Todavía no hay pedidos a proveedor." : "No hay pedidos con este filtro."}
          </p>
        ) : (
          visibles.map((p) => (
            <div key={p.id} className="bg-white border border-gigante-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gigante-navy">
                    {p.folio} · {p.customer_name}
                    {p.customer_phone ? <span className="text-gigante-muted font-normal"> · {p.customer_phone}</span> : null}
                  </p>
                  <p className="text-sm text-gigante-navy mt-1">
                    {fmt(p.cantidad)} {p.product ? unidadLabel(p.product.unit) : ""} de {p.descripcion}
                    {p.product?.code ? <span className="text-gigante-muted"> ({p.product.code})</span> : null}
                  </p>
                </div>
                <span className={`text-xs rounded-full px-2 py-1 ${BADGE[p.estado]}`}>{ESTADO_PEDIDO_LABELS[p.estado]}</span>
              </div>

              <p className="text-xs text-gigante-muted mt-2">
                Lo pidió {nameFor(p.created_by)} · {fechaHora(p.created_at)}
              </p>
              {p.nota && <p className="text-xs text-gigante-muted mt-1">Nota: {p.nota}</p>}
              {p.estado === "pedido" && (
                <p className="text-xs text-sky-800 mt-1">
                  Pedido a {p.proveedor || "proveedor"}
                  {p.fecha_estimada ? ` · llega aprox. el ${soloFecha(p.fecha_estimada)}` : ""}
                  {p.pedido_por ? ` · por ${nameFor(p.pedido_por)}` : ""}
                </p>
              )}
              {p.estado === "llego" && p.llego_at && (
                <p className="text-xs text-emerald-800 mt-1">
                  Llegó el {fechaHora(p.llego_at)}. Avísale al cliente y registra la venta.
                </p>
              )}
              {p.estado === "cancelado" && (
                <p className="text-xs text-gigante-muted mt-1">
                  Cancelado{p.motivo_cierre ? `: ${p.motivo_cierre}` : ""}
                </p>
              )}

              {(gestiona || puedeCancelar(p)) && (p.estado === "pendiente" || p.estado === "pedido") && (
                <div className="flex gap-2 flex-wrap mt-3">
                  {gestiona && p.estado === "pendiente" && (
                    <button
                      onClick={() => {
                        setPidiendo(p);
                        setProveedor("");
                        setFechaEst("");
                        setErrAccion(null);
                      }}
                      className="flex items-center gap-1.5 bg-gigante-navy text-white text-xs font-semibold rounded-lg px-3 py-2"
                    >
                      <Truck size={14} /> Ya lo pedí
                    </button>
                  )}
                  {gestiona && (
                    <button
                      onClick={() => yaLlego(p)}
                      disabled={trabajando}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-2"
                    >
                      <CheckCircle2 size={14} /> Ya llegó
                    </button>
                  )}
                  {puedeCancelar(p) && (
                    <button
                      onClick={() => {
                        setCancelando(p);
                        setMotivo("");
                        setErrAccion(null);
                      }}
                      className="flex items-center gap-1.5 border border-gigante-border text-gigante-navy text-xs font-medium rounded-lg px-3 py-2"
                    >
                      <XCircle size={14} /> Cancelar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {nuevo && (
        <NuevoPedidoProveedorModal
          products={products}
          onClose={() => setNuevo(false)}
          onSaved={(folio) => {
            setNuevo(false);
            setOk(folio);
            reload();
            setTimeout(() => setOk(null), 5000);
          }}
        />
      )}

      {pidiendo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gigante-navy">Ya lo pedí — {pidiendo.folio}</h2>
              <button onClick={() => setPidiendo(null)} aria-label="Cerrar" className="text-gigante-muted">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gigante-muted mb-3">
              {fmt(pidiendo.cantidad)} de {pidiendo.descripcion} · {pidiendo.customer_name}
            </p>
            <label className="block text-xs font-medium text-gigante-navy">
              ¿A qué proveedor se lo pediste? (opcional)
              <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Helvex" className={campo} />
            </label>
            <label className="block text-xs font-medium text-gigante-navy mt-3">
              ¿Para cuándo llega? (opcional)
              <input type="date" value={fechaEst} onChange={(e) => setFechaEst(e.target.value)} className={campo} />
            </label>
            {errAccion && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{errAccion}</p>}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setPidiendo(null)} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
                Cancelar
              </button>
              <button
                onClick={confirmarPedido}
                disabled={trabajando}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                {trabajando ? "Guardando..." : "Marcar como pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gigante-navy">Cancelar {cancelando.folio}</h2>
              <button onClick={() => setCancelando(null)} aria-label="Cerrar" className="text-gigante-muted">
                <X size={20} />
              </button>
            </div>
            <label className="block text-xs font-medium text-gigante-navy">
              ¿Por qué se cancela? (opcional)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. el cliente ya no lo quiere" className={campo} />
            </label>
            {errAccion && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{errAccion}</p>}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setCancelando(null)} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
                Volver
              </button>
              <button
                onClick={confirmarCancelar}
                disabled={trabajando}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                {trabajando ? "Cancelando..." : "Cancelar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
