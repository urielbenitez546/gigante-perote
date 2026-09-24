import { useMemo, useState } from "react";
import { ClipboardList, Package, Truck, CheckCircle2, CalendarClock, RefreshCw } from "lucide-react";
import { useOpenSales, useResumenPedidos } from "../../hooks/useSales";
import DetalleVentaModal from "../../components/ventas/DetalleVentaModal";
import {
  DELIVERY_TYPE_LABELS,
  DIAS_AVISO_APARTADO,
  PRODUCT_UNIT_LABELS,
  SALE_STATUS_LABELS,
  diasRestantesApartado,
  type DeliveryType,
  type SaleWithItems,
} from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Filtro = "todos" | "vencidos" | "por_vencer" | "retiro_sucursal" | "domicilio";

function tiposPendientes(sale: SaleWithItems): DeliveryType[] {
  const set = new Set<DeliveryType>();
  for (const i of sale.sale_items) {
    if (i.delivered_quantity < i.quantity) set.add(i.delivery_type ?? sale.delivery_type);
  }
  return Array.from(set);
}

export default function PedidosPendientes() {
  const { resumen, loading: loadingResumen, error: errorResumen, reload: reloadResumen } = useResumenPedidos();
  const { sales, loading, error, reload } = useOpenSales();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filas = useMemo(() => {
    return sales
      .map((sale) => {
        const vendido = sale.sale_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        const entregado = sale.sale_items.reduce((s, i) => s + i.delivered_quantity * i.unit_price, 0);
        const avance = vendido > 0 ? Math.round((entregado / vendido) * 100) : 0;
        return {
          sale,
          avance,
          porEntregar: vendido - entregado,
          dias: diasRestantesApartado(sale.created_at),
          tipos: tiposPendientes(sale),
        };
      })
      .filter((f) => f.tipos.length > 0)
      .filter((f) => {
        if (filtro === "vencidos") return f.dias < 0;
        if (filtro === "por_vencer") return f.dias >= 0 && f.dias <= DIAS_AVISO_APARTADO;
        if (filtro === "retiro_sucursal" || filtro === "domicilio") return f.tipos.includes(filtro);
        return true;
      })
      .sort((a, b) => a.dias - b.dias);
  }, [sales, filtro]);

  const conteoVencidos = useMemo(
    () => sales.filter((s) => tiposPendientes(s).length > 0 && diasRestantesApartado(s.created_at) < 0).length,
    [sales]
  );
  const conteoPorVencer = useMemo(
    () =>
      sales.filter((s) => {
        const d = diasRestantesApartado(s.created_at);
        return tiposPendientes(s).length > 0 && d >= 0 && d <= DIAS_AVISO_APARTADO;
      }).length,
    [sales]
  );

  const selectedSale = sales.find((s) => s.id === selectedId) ?? null;

  function recargarTodo() {
    reload();
    reloadResumen();
  }

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "vencidos", label: `Vencidos (${conteoVencidos})` },
    { key: "por_vencer", label: `Por vencer (${conteoPorVencer})` },
    { key: "retiro_sucursal", label: "Recoge en sucursal" },
    { key: "domicilio", label: "A domicilio" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <ClipboardList size={22} /> Pedidos Pendientes
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            De un vistazo: cuánto material está apartado, cuánto falta por entregar y cuánto ya se entregó.
          </p>
        </div>
        <button
          onClick={recargarTodo}
          className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-medium rounded-lg px-3 py-2"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {(errorResumen || error) && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {errorResumen ?? error}
          {errorResumen?.includes("resumen_pedidos") && " — ¿ya corriste la migración 0027b en Supabase?"}
        </p>
      )}

      {/* Tarjetas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center mb-2">
            <Package size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Pedidos abiertos</p>
          <p className="text-xl font-bold text-gigante-navy">
            {loadingResumen || !resumen ? "…" : resumen.ventas_pendientes + resumen.ventas_parciales}
          </p>
          {resumen && (
            <p className="text-[11px] text-gigante-muted">
              {resumen.ventas_pendientes} sin entregar · {resumen.ventas_parciales} a medias
            </p>
          )}
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-red text-white flex items-center justify-center mb-2">
            <Truck size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Falta por entregar</p>
          <p className="text-xl font-bold text-gigante-navy">{resumen ? money(resumen.monto_por_entregar) : "…"}</p>
          {resumen && (
            <p className="text-[11px] text-gigante-muted">
              {resumen.por_tipo.retiro_sucursal} por recoger · {resumen.por_tipo.domicilio} a domicilio
            </p>
          )}
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Ya entregado (de lo abierto)</p>
          <p className="text-xl font-bold text-gigante-navy">{resumen ? money(resumen.monto_entregado) : "…"}</p>
          {resumen && (
            <p className="text-[11px] text-gigante-muted">de {money(resumen.monto_apartado)} vendidos en estos pedidos</p>
          )}
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center mb-2">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Entregados completos este mes</p>
          <p className="text-xl font-bold text-gigante-navy">{resumen ? resumen.ventas_entregadas_mes : "…"}</p>
        </div>
      </div>

      {resumen && resumen.monto_apartado > 0 && (
        <div className="bg-white border border-gigante-border rounded-xl p-4 mt-4">
          <div className="flex items-center justify-between text-xs text-gigante-muted mb-1.5">
            <span>Avance de entrega de todos los pedidos abiertos</span>
            <span className="font-semibold text-gigante-navy">
              {Math.round((resumen.monto_entregado / resumen.monto_apartado) * 100)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-gigante-bg overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(100, (resumen.monto_entregado / resumen.monto_apartado) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5 mt-5">
        {/* Lista de pedidos */}
        <div className="lg:col-span-3 min-w-0">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
                  filtro === f.key
                    ? "bg-gigante-navy text-white border-gigante-navy"
                    : "border-gigante-border text-gigante-navy bg-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-3 bg-white border border-gigante-border rounded-xl overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-gigante-muted">Cargando pedidos...</p>
            ) : filas.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">No hay pedidos con ese filtro.</p>
            ) : (
              <ul className="divide-y divide-gigante-border">
                {filas.map(({ sale, avance, porEntregar, dias, tipos }) => (
                  <li key={sale.id}>
                    <button onClick={() => setSelectedId(sale.id)} className="w-full text-left px-4 py-3 hover:bg-gigante-bg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gigante-navy">
                            {sale.folio} · <span className="font-normal">{sale.customer_name}</span>
                          </p>
                          <p className="text-[11px] text-gigante-muted">
                            {SALE_STATUS_LABELS[sale.status]} · {tipos.map((t) => DELIVERY_TYPE_LABELS[t]).join(" + ")} ·
                            falta {money(porEntregar)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-1 ${
                            dias < 0
                              ? "bg-red-100 text-red-700"
                              : dias <= DIAS_AVISO_APARTADO
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gigante-bg text-gigante-muted"
                          }`}
                        >
                          <CalendarClock size={12} />
                          {dias < 0 ? `Vencido hace ${Math.abs(dias)} d` : dias === 0 ? "Vence hoy" : `${dias} d restantes`}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-gigante-bg overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${avance}%` }} />
                        </div>
                        <span className="text-[11px] text-gigante-muted w-10 text-right">{avance}%</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-gigante-muted mt-2">
            El cliente tiene 1 mes desde que compra para recoger o recibir su material. A los {DIAS_AVISO_APARTADO} días de
            vencer, y cuando ya venció, llega aviso a la campanita.
          </p>
        </div>

        {/* Material por producto */}
        <div className="lg:col-span-2 min-w-0">
          <p className="text-sm font-semibold text-gigante-navy mb-2">Material que falta entregar, por producto</p>
          <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
            {!resumen ? (
              <p className="p-6 text-sm text-gigante-muted">{loadingResumen ? "Cargando..." : "Sin datos."}</p>
            ) : resumen.productos.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">No hay material pendiente de entregar.</p>
            ) : (
              <ul className="divide-y divide-gigante-border">
                {resumen.productos.map((p) => {
                  const unidad = PRODUCT_UNIT_LABELS[p.unit] ?? p.unit;
                  const noAlcanza = p.fisico < p.por_entregar;
                  return (
                    <li key={p.id} className="px-4 py-3 text-sm">
                      <p className="text-gigante-navy truncate">
                        <span className="font-semibold">{p.code}</span> — {p.name}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-gigante-muted mt-0.5">
                        <span>
                          Vendido {p.vendido} · Entregado {p.entregado} · En {p.ventas} pedido(s)
                        </span>
                        <span className="font-semibold text-gigante-red">
                          Falta {p.por_entregar} {unidad}
                        </span>
                      </div>
                      {noAlcanza && (
                        <p className="text-[11px] text-red-700 mt-0.5">
                          ⚠️ En almacén solo hay {p.fisico} {unidad}: no alcanza para lo apartado.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {selectedSale && (
        <DetalleVentaModal
          sale={selectedSale}
          onClose={() => setSelectedId(null)}
          onUpdated={recargarTodo}
        />
      )}
    </div>
  );
}
