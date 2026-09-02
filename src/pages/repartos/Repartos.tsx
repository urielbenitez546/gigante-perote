import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Truck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useDeliveries } from "../../hooks/useDeliveries";
import { DELIVERY_STATUS_LABELS } from "../../types";
import RepartosMap from "../../components/repartos/RepartosMap";

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-gigante-bg text-gigante-navy",
  en_camino: "bg-blue-100 text-blue-700",
  entregado: "bg-emerald-100 text-emerald-700",
  incidencia: "bg-gigante-red/10 text-gigante-red",
};

export default function Repartos() {
  const { deliveries, loading, error } = useDeliveries();

  const stats = useMemo(() => {
    const hoy = deliveries.length;
    const completados = deliveries.filter((d) => d.status === "entregado").length;
    const enCamino = deliveries.filter((d) => d.status === "en_camino").length;
    const pendientes = deliveries.filter((d) => d.status === "pendiente").length;
    return { hoy, completados, enCamino, pendientes };
  }, [deliveries]);

  const mapDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === "pendiente" || d.status === "en_camino"),
    [deliveries]
  );

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Truck size={22} /> Repartos
      </h1>
      <p className="text-sm text-gigante-muted mt-1">Controla y da seguimiento a las entregas</p>

      <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">
        Las ubicaciones del mapa son aproximadas (DEMO) — el prototipo todavía no geocodifica
        direcciones reales. Una versión futura podría incorporar un servicio de rutas más avanzado.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center mb-2">
            <Truck size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Repartos hoy</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.hoy}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Entregas completadas</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.completados}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-2">
            <Clock size={16} />
          </div>
          <p className="text-xs text-gigante-muted">En camino</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.enCamino}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-red text-white flex items-center justify-center mb-2">
            <XCircle size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Pendientes</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.pendientes}</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="mt-5">
        <RepartosMap deliveries={mapDeliveries} />
      </div>

      <div className="mt-5 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando repartos...</p>
        ) : deliveries.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">
            No hay repartos todavía. Se crean automáticamente cuando se registra una venta con
            entrega a domicilio.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gigante-bg text-gigante-muted text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-3">Folio</th>
                <th className="text-left font-medium px-4 py-3">Cliente</th>
                <th className="text-left font-medium px-4 py-3">Dirección</th>
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-right font-medium px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t border-gigante-border">
                  <td className="px-4 py-3 font-medium text-gigante-navy">{d.sale.folio}</td>
                  <td className="px-4 py-3 text-gigante-navy">{d.sale.customer_name}</td>
                  <td className="px-4 py-3 text-gigante-muted">{d.sale.customer_address}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE[d.status]}`}>
                      {DELIVERY_STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/repartos/${d.id}`}
                      className="text-xs font-semibold text-gigante-red hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
