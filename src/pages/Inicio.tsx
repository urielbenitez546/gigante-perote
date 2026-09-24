import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NAV_MODULES, ROLE_LABELS, calcularSemaforo, SEMAFORO_LABELS, type SemaforoStatus } from "../types";
import { MODULE_ICONS } from "../components/layout/navIcons";
import StatCard from "../components/dashboard/StatCard";
import InventoryDonut from "../components/dashboard/InventoryDonut";
import { useSales } from "../hooks/useSales";
import { useDeliveries } from "../hooks/useDeliveries";
import { useProducts } from "../hooks/useInventory";
import {
  Truck,
  Package,
  DollarSign,
  ShoppingCart,
  ChevronRight,
} from "lucide-react";

function isToday(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export default function Inicio() {
  const { profile } = useAuth();
  const { sales } = useSales();
  const { deliveries } = useDeliveries();
  const { products } = useProducts();

  const can = (moduleKey: string) =>
    !!profile && (NAV_MODULES.find((m) => m.key === moduleKey)?.roles.includes(profile.role) ?? false);

  const quickAccessModules = profile
    ? NAV_MODULES.filter((m) => m.key !== "inicio" && m.roles.includes(profile.role))
    : [];

  const showRepartos = can("repartos");
  const showRetiros = can("retiros");
  const showCobros = can("evidencias");
  const showVentas = can("ventas");
  const showInventario = can("inventario");
  const showActividad = profile?.role === "gerencia";
  const showProximosRepartos = showRepartos;

  const stats = useMemo(() => {
    const hoy = new Date();
    const ventasHoy = sales
      .filter((s) => isToday(s.created_at, hoy))
      .reduce((sum, s) => sum + s.total, 0);

    const repartosHoy = deliveries.filter((d) => d.status === "pendiente" || d.status === "en_camino").length;

    const porRecogerSucursal = sales.filter((s) =>
      s.sale_items.some((it) => it.delivery_type === "retiro_sucursal" && it.delivered_quantity < it.quantity)
    ).length;

    const cobrosPendientes = deliveries.filter((d) => d.status === "entregado" && !d.payment_confirmed_at).length;

    return { ventasHoy, repartosHoy, porRecogerSucursal, cobrosPendientes };
  }, [sales, deliveries]);

  const inventario = useMemo(() => {
    let disponibles = 0;
    let bajoStock = 0;
    let sinExistencia = 0;
    for (const p of products) {
      const estado = calcularSemaforo(p);
      if (estado === "rojo") sinExistencia++;
      else if (estado === "amarillo") bajoStock++;
      else disponibles++;
    }
    return { total: products.length, disponibles, bajoStock, sinExistencia };
  }, [products]);

  const SEMAFORO_ORDEN: Record<SemaforoStatus, number> = { rojo: 0, amarillo: 1, verde: 2 };
  const productosEnAlerta = useMemo(() => {
    return products
      .map((p) => ({ p, estado: calcularSemaforo(p) }))
      .filter((x) => x.estado !== "verde")
      .sort((a, b) => SEMAFORO_ORDEN[a.estado] - SEMAFORO_ORDEN[b.estado])
      .slice(0, 8);
  }, [products]);

  const actividadReciente = useMemo(() => {
    const deVentas = sales.slice(0, 5).map((s) => ({
      id: `venta-${s.id}`,
      title: `Venta ${s.folio} — ${s.customer_name}`,
      subtitle: `$${s.total.toLocaleString("es-MX")}`,
      created_at: s.created_at,
      icon: ShoppingCart,
    }));
    const deEntregas = deliveries
      .filter((d) => d.status === "entregado" && d.delivered_at)
      .slice(0, 5)
      .map((d) => ({
        id: `entrega-${d.id}`,
        title: `Entrega a ${d.sale.customer_name}`,
        subtitle: d.sale.folio,
        created_at: d.delivered_at as string,
        icon: Truck,
      }));
    return [...deVentas, ...deEntregas]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [sales, deliveries]);

  const proximosRepartos = useMemo(
    () => deliveries.filter((d) => d.status === "pendiente" || d.status === "en_camino").slice(0, 5),
    [deliveries]
  );

  if (!profile) return null;

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy">
            ¡Buenos días, {ROLE_LABELS[profile.role]}!
          </h1>
          <p className="text-sm text-gigante-muted mt-1">Resumen general de la sucursal Perote</p>
        </div>
        <span className="text-xs text-gigante-muted bg-white border border-gigante-border rounded-full px-3 py-1">
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      {(showRepartos || showRetiros || showCobros || showVentas) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {showRepartos && (
            <StatCard
              icon={Truck}
              iconColorClass="bg-gigante-navy"
              label="Repartos pendientes"
              value={String(stats.repartosHoy)}
              linkTo="/repartos"
            />
          )}
          {showRetiros && (
            <StatCard
              icon={Package}
              iconColorClass="bg-gigante-red"
              label="Por recoger en sucursal"
              value={String(stats.porRecogerSucursal)}
              linkTo="/retiros"
            />
          )}
          {showCobros && (
            <StatCard
              icon={DollarSign}
              iconColorClass="bg-gigante-navy"
              label="Cobros pendientes por aplicar"
              value={String(stats.cobrosPendientes)}
              linkTo="/evidencias-cobros"
            />
          )}
          {showVentas && (
            <StatCard
              icon={ShoppingCart}
              iconColorClass="bg-gigante-red"
              label="Ventas hoy"
              value={`$${stats.ventasHoy.toLocaleString("es-MX")}`}
              linkTo="/ventas"
            />
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-sm font-semibold text-gigante-navy mb-3">Accesos rápidos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickAccessModules.map((mod) => {
              const Icon = MODULE_ICONS[mod.key];
              return (
                <Link
                  key={mod.key}
                  to={mod.path}
                  className="flex flex-col items-center justify-center gap-2 border border-gigante-border rounded-lg py-4 px-2 text-center hover:border-gigante-navy/40 hover:bg-gigante-bg transition-colors"
                >
                  {Icon && <Icon size={20} className="text-gigante-navy" />}
                  <span className="text-xs text-gigante-navy">{mod.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {showInventario && (
          <div className="bg-white border border-gigante-border rounded-xl p-4">
            <p className="text-sm font-semibold text-gigante-navy mb-3">Inventario general</p>
            <InventoryDonut
              total={inventario.total}
              disponibles={inventario.disponibles}
              bajoStock={inventario.bajoStock}
              sinExistencia={inventario.sinExistencia}
            />
          </div>
        )}
      </div>

      {showInventario && productosEnAlerta.length > 0 && (
        <div className="bg-white border border-gigante-border rounded-xl p-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gigante-navy">
              Antes de vender, checa esto — se está acabando o ya no hay
            </p>
            <Link to="/inventario" className="text-xs text-gigante-red flex items-center gap-0.5">
              Ver Inventario <ChevronRight size={14} />
            </Link>
          </div>
          <ul className="divide-y divide-gigante-border">
            {productosEnAlerta.map(({ p, estado }) => (
              <li key={p.id}>
                <Link
                  to={`/inventario?semaforo=${estado}&producto=${p.id}`}
                  className="flex items-center justify-between py-2 text-sm hover:bg-gigante-bg rounded-md px-1 -mx-1"
                >
                <div className="min-w-0">
                  <p className="text-gigante-navy truncate">{p.name}</p>
                  <p className="text-xs text-gigante-muted">{p.code}</p>
                </div>
                <span
                  className={`text-xs rounded-full px-2 py-1 shrink-0 ml-2 ${
                    estado === "rojo" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {SEMAFORO_LABELS[estado]}
                </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        {showActividad && (
          <div className="bg-white border border-gigante-border rounded-xl p-4">
            <p className="text-sm font-semibold text-gigante-navy mb-3">Actividad reciente</p>
            {actividadReciente.length === 0 ? (
              <p className="text-xs text-gigante-muted">Todavía no hay actividad registrada.</p>
            ) : (
              <ul className="space-y-3">
                {actividadReciente.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gigante-bg flex items-center justify-center text-gigante-navy shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gigante-navy truncate">{item.title}</p>
                        <p className="text-xs text-gigante-muted">{item.subtitle}</p>
                      </div>
                      <span className="text-xs text-gigante-muted whitespace-nowrap">{timeAgo(item.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {showProximosRepartos && (
          <div className="bg-white border border-gigante-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gigante-navy">Próximos repartos</p>
              <Link to="/repartos" className="text-xs text-gigante-red flex items-center gap-0.5">
                Ver todos <ChevronRight size={14} />
              </Link>
            </div>
            {proximosRepartos.length === 0 ? (
              <p className="text-xs text-gigante-muted">No hay repartos pendientes ahorita.</p>
            ) : (
              <ul className="space-y-3">
                {proximosRepartos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="text-gigante-navy truncate">{d.sale.customer_name}</p>
                      <p className="text-xs text-gigante-muted truncate">{d.sale.customer_address}</p>
                    </div>
                    <span className="text-xs bg-gigante-bg text-gigante-navy rounded-full px-2 py-1 shrink-0 ml-2">
                      {d.status === "en_camino" ? "En camino" : "Pendiente"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
