import { useAuth } from "../context/AuthContext";
import { NAV_MODULES, ROLE_LABELS } from "../types";
import { MODULE_ICONS } from "../components/layout/navIcons";
import StatCard from "../components/dashboard/StatCard";
import InventoryDonut from "../components/dashboard/InventoryDonut";
import { Link } from "react-router-dom";
import {
  Truck,
  Package,
  DollarSign,
  ShoppingCart,
  ShoppingCartIcon,
  CircleDot,
  ChevronRight,
} from "lucide-react";
import {
  demoStats,
  demoInventory,
  demoActivity,
  demoUpcomingDeliveries,
  DEMO_DATE_LABEL,
} from "../data/demoData";

const ACTIVITY_ICONS: Record<string, typeof CircleDot> = {
  venta: ShoppingCartIcon,
  reparto: Truck,
  cobro: DollarSign,
  entrada: Package,
};

export default function Inicio() {
  const { profile } = useAuth();
  if (!profile) return null;

  const can = (moduleKey: string) =>
    NAV_MODULES.find((m) => m.key === moduleKey)?.roles.includes(profile.role) ?? false;

  const quickAccessModules = NAV_MODULES.filter(
    (m) => m.key !== "inicio" && m.roles.includes(profile.role)
  );

  const showRepartos = can("repartos");
  const showRetiros = can("retiros");
  const showCobros = can("evidencias");
  const showVentas = can("ventas");
  const showInventario = can("inventario");
  const showActividad = profile.role === "gerencia";
  const showProximosRepartos = showRepartos;

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
          {DEMO_DATE_LABEL}
        </span>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">
        Los números de este panel son datos de <strong>DEMOSTRACIÓN</strong>. Se conectarán a información
        real conforme se construyan los módulos de Inventario, Ventas, Repartos y Retiros.
      </div>

      {(showRepartos || showRetiros || showCobros || showVentas) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {showRepartos && (
            <StatCard
              icon={Truck}
              iconColorClass="bg-gigante-navy"
              label="Repartos hoy"
              value={String(demoStats.repartosHoy)}
              linkTo="/repartos"
            />
          )}
          {showRetiros && (
            <StatCard
              icon={Package}
              iconColorClass="bg-gigante-red"
              label="Por recoger en sucursal"
              value={String(demoStats.porRecogerSucursal)}
              linkTo="/retiros"
            />
          )}
          {showCobros && (
            <StatCard
              icon={DollarSign}
              iconColorClass="bg-gigante-navy"
              label="Cobros pendientes por aplicar"
              value={String(demoStats.cobrosPendientes)}
              linkTo="/evidencias-cobros"
            />
          )}
          {showVentas && (
            <StatCard
              icon={ShoppingCart}
              iconColorClass="bg-gigante-red"
              label="Ventas hoy"
              value={`$${demoStats.ventasHoy.toLocaleString()}`}
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
              total={demoInventory.total}
              disponibles={demoInventory.disponibles}
              bajoStock={demoInventory.bajoStock}
              sinExistencia={demoInventory.sinExistencia}
            />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        {showActividad && (
          <div className="bg-white border border-gigante-border rounded-xl p-4">
            <p className="text-sm font-semibold text-gigante-navy mb-3">Actividad reciente</p>
            <ul className="space-y-3">
              {demoActivity.map((item) => {
                const Icon = ACTIVITY_ICONS[item.icon] ?? CircleDot;
                return (
                  <li key={item.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gigante-bg flex items-center justify-center text-gigante-navy shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gigante-navy truncate">{item.title}</p>
                      <p className="text-xs text-gigante-muted">{item.subtitle}</p>
                    </div>
                    <span className="text-xs text-gigante-muted whitespace-nowrap">{item.time}</span>
                  </li>
                );
              })}
            </ul>
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
            <ul className="space-y-3">
              {demoUpcomingDeliveries.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gigante-navy">{d.cliente}</p>
                    <p className="text-xs text-gigante-muted">{d.direccion}</p>
                  </div>
                  <span className="text-xs bg-gigante-bg text-gigante-navy rounded-full px-2 py-1">
                    {d.hora}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
