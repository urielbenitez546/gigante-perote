import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackagePlus, Plus, Truck, CheckCircle2, XCircle, X, Pencil } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  ESTADO_PEDIDO_LABELS,
  cancelarPedidoProveedor,
  marcarPedidoProveedorLlego,
  marcarPedidoProveedorPedido,
  pasarBajoPedidoAInventario,
  confirmarExistenciaLinea,
  conciliarExistenciaConInventario,
  useLineasSinExistencia,
  type LineaSinExistencia,
  usePedidosProveedor,
  type EstadoPedidoProveedor,
  type PedidoProveedor,
} from "../../hooks/usePedidosProveedor";
import { tienePermiso, unidadLabel, type Product } from "../../types";
import NuevoPedidoProveedorModal from "../../components/pedidosproveedor/NuevoPedidoProveedorModal";
import ProductoBajoPedidoModal from "../../components/pedidosproveedor/ProductoBajoPedidoModal";

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
  const { todos: products, reload: reloadProducts } = useProducts();
  const { nameFor } = useProfileNames();
  const { pedidos, loading, error, reload } = usePedidosProveedor();

  const gestiona = tienePermiso(profile, "operar_almacen"); // jefe, auxiliar y Gerencia
  const puedePedir = profile?.role === "ventas" || profile?.role === "gerencia";

  const [searchParams] = useSearchParams();
  const { lineas, reload: reloadLineas } = useLineasSinExistencia();
  const [vista, setVista] = useState<"pedidos" | "productos" | "existencia">(
    searchParams.get("tab") === "existencia" ? "existencia" : "pedidos"
  );
  const [filtroExist, setFiltroExist] = useState<"por_confirmar" | "revisadas" | "todas">("por_confirmar");
  const [rechazando, setRechazando] = useState<LineaSinExistencia | null>(null);
  const [notaRechazo, setNotaRechazo] = useState("");
  const [msgExist, setMsgExist] = useState<string | null>(null);
  const [altaProducto, setAltaProducto] = useState(false);
  const [editandoProducto, setEditandoProducto] = useState<Product | null>(null);
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
  const [pasando, setPasando] = useState<Product | null>(null);

  const abiertos = useMemo(() => pedidos.filter((p) => p.estado === "pendiente" || p.estado === "pedido"), [pedidos]);
  const visibles = useMemo(() => {
    if (filtro === "abiertos") return abiertos;
    if (filtro === "llegaron") return pedidos.filter((p) => p.estado === "llego");
    if (filtro === "cancelados") return pedidos.filter((p) => p.estado === "cancelado");
    return pedidos;
  }, [pedidos, abiertos, filtro]);
  const porPedir = pedidos.filter((p) => p.estado === "pendiente").length;
  const bajoPedido = useMemo(() => products.filter((p) => p.bajo_pedido), [products]);
  const porValidar = bajoPedido.filter((p) => p.por_validar).length;

  const lineasPorConfirmar = useMemo(() => lineas.filter((l) => l.existencia_estado === "por_confirmar"), [lineas]);
  const lineasVisibles = useMemo(() => {
    if (filtroExist === "por_confirmar") return lineasPorConfirmar;
    if (filtroExist === "revisadas") return lineas.filter((l) => l.existencia_estado !== "por_confirmar");
    return lineas;
  }, [lineas, lineasPorConfirmar, filtroExist]);
  // Resumen por vendedor (lo ve Gerencia): cuántas ventas sin existencia hizo cada quien y cómo resultaron.
  const resumenVendedores = useMemo(() => {
    const m = new Map<string, { total: number; confirmadas: number; noHay: number; pendientes: number }>();
    for (const l of lineas) {
      const k = l.sale?.created_by ?? "";
      const r = m.get(k) ?? { total: 0, confirmadas: 0, noHay: 0, pendientes: 0 };
      r.total += 1;
      if (l.existencia_estado === "confirmada") r.confirmadas += 1;
      else if (l.existencia_estado === "no_hay") r.noHay += 1;
      else r.pendientes += 1;
      m.set(k, r);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [lineas]);
  const diasSinConfirmar = (l: LineaSinExistencia) =>
    l.sale ? Math.floor((Date.now() - new Date(l.sale.created_at).getTime()) / 86400000) : 0;

  async function confirmarHay(l: LineaSinExistencia) {
    setErrAccion(null);
    setTrabajando(true);
    const { error: err } = await confirmarExistenciaLinea(l.id, true);
    setTrabajando(false);
    if (err) return setErrAccion(err);
    reloadLineas();
  }

  async function confirmarNoHay() {
    if (!rechazando) return;
    setErrAccion(null);
    setTrabajando(true);
    const { error: err } = await confirmarExistenciaLinea(rechazando.id, false, notaRechazo);
    setTrabajando(false);
    if (err) return setErrAccion(err);
    setRechazando(null);
    setNotaRechazo("");
    reloadLineas();
    reload(); // el pedido a proveedor que se creó solo
  }

  async function compararConInventario() {
    setErrAccion(null);
    setMsgExist(null);
    setTrabajando(true);
    const { confirmadas, error: err } = await conciliarExistenciaConInventario();
    setTrabajando(false);
    if (err) return setErrAccion(err);
    setMsgExist(
      confirmadas > 0
        ? `${confirmadas} línea(s) ya quedaron respaldadas por el inventario y se confirmaron solas.`
        : "Ninguna línea tiene todavía existencia suficiente en el sistema."
    );
    reloadLineas();
  }

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
            onClick={() => {
              reloadProducts();
              setNuevo(true);
            }}
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
      {errAccion && vista !== "existencia" && !pidiendo && !cancelando && !pasando && !rechazando && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{errAccion}</p>
      )}
      {gestiona && porPedir > 0 && (
        <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Hay <strong>{porPedir}</strong> pedido(s) por pedir al proveedor. Cuando lo pidas, presiona <strong>Ya lo pedí</strong>.
        </p>
      )}

      <div className="mt-4 flex gap-2 border-b border-gigante-border">
        {(
          [
            ["pedidos", "Pedidos"],
            ["existencia", `Por confirmar existencia (${lineasPorConfirmar.length})`],
            ["productos", `Productos bajo pedido (${bajoPedido.length})${porValidar > 0 ? " · por validar" : ""}`],
          ] as ["pedidos" | "productos" | "existencia", string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              if (key === "productos") reloadProducts();
              if (key === "existencia") reloadLineas();
              setVista(key);
            }}
            className={`text-sm px-3 py-2 -mb-px border-b-2 ${
              vista === key ? "border-gigante-red text-gigante-navy font-semibold" : "border-transparent text-gigante-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === "existencia" && (
        <div className="mt-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm text-gigante-muted max-w-2xl">
              Productos que Ventas vendió porque <strong>sí están en la sucursal pero no aparecen en el sistema</strong>. Se
              pueden cobrar, pero <strong>no se entregan</strong> hasta que Almacén confirme que sí están. Si no están, se
              mandan solos a Pedidos a proveedor. Cuando se carga el inventario, los que ya tienen existencia se confirman solos.
            </p>
            {gestiona && (
              <button
                onClick={compararConInventario}
                disabled={trabajando}
                className="border border-gigante-navy text-gigante-navy text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60"
              >
                Comparar con inventario
              </button>
            )}
          </div>
          {msgExist && (
            <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msgExist}</p>
          )}
          {errAccion && !pidiendo && !cancelando && !pasando && !rechazando && (
            <p className="mt-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{errAccion}</p>
          )}

          {profile?.role === "gerencia" && resumenVendedores.length > 0 && (
            <div className="mt-3 bg-white border border-gigante-border rounded-xl p-3">
              <p className="text-xs font-semibold text-gigante-navy mb-2">Ventas sin existencia por vendedor</p>
              <div className="space-y-1">
                {resumenVendedores.map(([id, r]) => (
                  <p key={id || "?"} className="text-xs text-gigante-navy">
                    <strong>{nameFor(id || null)}</strong>: {r.total} en total · {r.confirmadas} sí estaban ·{" "}
                    <span className={r.noHay > 0 ? "text-red-700 font-semibold" : ""}>{r.noHay} no estaban</span> ·{" "}
                    {r.pendientes} por confirmar
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["por_confirmar", `Por confirmar (${lineasPorConfirmar.length})`],
                ["revisadas", "Ya revisadas"],
                ["todas", "Todas"],
              ] as ["por_confirmar" | "revisadas" | "todas", string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFiltroExist(key)}
                className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
                  filtroExist === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {lineasVisibles.length === 0 ? (
              <p className="bg-white border border-gigante-border rounded-xl p-6 text-sm text-gigante-muted">
                {lineas.length === 0 ? "Todavía no se ha vendido nada sin existencia en el sistema." : "No hay líneas con este filtro."}
              </p>
            ) : (
              lineasVisibles.map((l) => {
                const dias = diasSinConfirmar(l);
                const urgente = l.existencia_estado === "por_confirmar" && dias >= 2;
                return (
                  <div key={l.id} className={`bg-white border rounded-xl p-3 ${urgente ? "border-red-300" : "border-gigante-border"}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gigante-navy">
                          {l.sale?.folio} · {l.sale?.customer_name}
                        </p>
                        <p className="text-sm text-gigante-navy mt-0.5">
                          {fmt(l.quantity)} {unidadLabel(l.product?.unit)} de {l.product?.name}
                          {l.product?.code ? <span className="text-gigante-muted"> ({l.product.code})</span> : null}
                        </p>
                        <p className="text-xs text-gigante-muted mt-1">
                          Lo vendió {nameFor(l.sale?.created_by ?? null)}
                          {l.sale ? ` · ${fechaHora(l.sale.created_at)}` : ""}
                        </p>
                        {l.existencia_nota && <p className="text-xs text-gigante-muted mt-0.5">Dónde está (según el vendedor): {l.existencia_nota}</p>}
                        {l.existencia_estado === "por_confirmar" && urgente && (
                          <p className="text-xs text-red-700 font-semibold mt-1">Lleva {dias} días sin confirmarse.</p>
                        )}
                        {l.existencia_estado !== "por_confirmar" && (
                          <p className="text-xs text-gigante-muted mt-1">
                            {l.existencia_respaldo === "inventario"
                              ? "Se confirmó solo: ya llegó en la carga del inventario."
                              : `Revisó ${nameFor(l.existencia_revisada_por)}${l.existencia_revisada_at ? ` · ${fechaHora(l.existencia_revisada_at)}` : ""}`}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-1 ${
                          l.existencia_estado === "por_confirmar"
                            ? "bg-amber-100 text-amber-800"
                            : l.existencia_estado === "confirmada"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {l.existencia_estado === "por_confirmar" ? "Por confirmar" : l.existencia_estado === "confirmada" ? "Sí estaba" : "No había"}
                      </span>
                    </div>
                    {gestiona && l.existencia_estado === "por_confirmar" && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => confirmarHay(l)}
                          disabled={trabajando}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-2"
                        >
                          <CheckCircle2 size={14} /> Sí está
                        </button>
                        <button
                          onClick={() => {
                            setErrAccion(null);
                            setNotaRechazo("");
                            setRechazando(l);
                          }}
                          className="flex items-center gap-1.5 border border-red-300 text-red-700 text-xs font-medium rounded-lg px-3 py-2"
                        >
                          <XCircle size={14} /> No está
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {vista === "productos" && (
        <div className="mt-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm text-gigante-muted max-w-2xl">
              Productos de catálogo que no están en el inventario. Se pueden vender y pedir al proveedor; no cuentan como
              existencia ni salen en Inventario. Ventas, Almacén y Gerencia pueden corregirlos y marcarlos como revisados.
              Cuando llega el material, Almacén registra su <strong>entrada</strong> en Inventario.
            </p>
            <button
              onClick={() => setAltaProducto(true)}
              className="flex items-center gap-2 border border-gigante-navy text-gigante-navy text-sm font-semibold rounded-lg px-4 py-2"
            >
              <Plus size={16} /> Agregar producto
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {bajoPedido.length === 0 ? (
              <p className="bg-white border border-gigante-border rounded-xl p-6 text-sm text-gigante-muted">
                Todavía no hay productos bajo pedido.
              </p>
            ) : (
              bajoPedido.map((p) => (
                <div key={p.id} className="bg-white border border-gigante-border rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gigante-navy">
                      {p.code} — {p.name}
                    </p>
                    <p className="text-xs text-gigante-muted mt-0.5">
                      ${Number(p.unit_price).toLocaleString("es-MX", { minimumFractionDigits: 2 })} por {unidadLabel(p.unit)}
                      {p.brand && p.brand !== "Bajo pedido" ? ` · ${p.brand}` : ""} · lo agregó {nameFor(p.creado_por ?? null)}
                      {p.physical_stock - p.sold_pending > 0
                        ? ` · disponible: ${fmt(p.physical_stock - p.sold_pending)} ${unidadLabel(p.unit)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${
                        p.por_validar ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {p.por_validar ? "Por validar" : "Revisado"}
                    </span>
                    <button
                      onClick={() => setEditandoProducto(p)}
                      className="flex items-center gap-1.5 border border-gigante-border text-gigante-navy text-xs font-medium rounded-lg px-3 py-2"
                    >
                      <Pencil size={13} /> {p.por_validar ? "Revisar" : "Editar"}
                    </button>
                    {gestiona && (
                      <button
                        onClick={() => {
                          setErrAccion(null);
                          setPasando(p);
                        }}
                        className="border border-gigante-border text-gigante-navy text-xs font-medium rounded-lg px-3 py-2"
                      >
                        Pasar a inventario
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {vista === "pedidos" && (
        <>
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
              {p.venta_folio && (
                <p className="text-xs text-gigante-navy font-medium mt-1">Viene de la venta {p.venta_folio}</p>
              )}
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
        </>
      )}

      {nuevo && (
        <NuevoPedidoProveedorModal
          products={products}
          onProductsChanged={reloadProducts}
          onClose={() => setNuevo(false)}
          onSaved={(folio) => {
            setNuevo(false);
            setOk(folio);
            reload();
            setTimeout(() => setOk(null), 5000);
          }}
        />
      )}

      {(altaProducto || editandoProducto) && (
        <ProductoBajoPedidoModal
          products={products}
          producto={editandoProducto ?? undefined}
          onClose={() => {
            setAltaProducto(false);
            setEditandoProducto(null);
          }}
          onSaved={async () => {
            await reloadProducts();
            setAltaProducto(false);
            setEditandoProducto(null);
          }}
        />
      )}

      {rechazando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-gigante-navy mb-2">No está — {rechazando.sale?.folio}</h2>
            <p className="text-sm text-gigante-muted">
              {fmt(rechazando.quantity)} de {rechazando.product?.name}. Se manda solo a <strong>Pedidos a proveedor</strong> y se le
              avisa a Ventas para que le diga al cliente o cambie el producto.
            </p>
            <label className="block text-xs font-medium text-gigante-navy mt-3">
              Nota (opcional)
              <input value={notaRechazo} onChange={(e) => setNotaRechazo(e.target.value)} placeholder="Ej. no estaba en bodega" className={campo} />
            </label>
            {errAccion && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{errAccion}</p>}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setRechazando(null)} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
                Volver
              </button>
              <button
                onClick={confirmarNoHay}
                disabled={trabajando}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                {trabajando ? "Guardando..." : "Confirmar que no está"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pasando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-gigante-navy mb-2">Pasar a inventario normal</h2>
            <p className="text-sm text-gigante-muted">
              <strong>{pasando.code}</strong> — {pasando.name}. Úsalo cuando este producto ya esté dado de alta en el
              inventario. Dejará de ser “bajo pedido” y saldrá en Inventario, Kardex y alertas. Las ventas que ya lo
              apartaron se conservan.
            </p>
            {errAccion && <p className="text-xs text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mt-3">{errAccion}</p>}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setPasando(null)} className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium">
                Cancelar
              </button>
              <button
                disabled={trabajando}
                onClick={async () => {
                  setTrabajando(true);
                  const { error: err } = await pasarBajoPedidoAInventario(pasando.id);
                  setTrabajando(false);
                  if (err) return setErrAccion(err);
                  setPasando(null);
                  reloadProducts();
                }}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                {trabajando ? "Pasando..." : "Pasar a inventario"}
              </button>
            </div>
          </div>
        </div>
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
