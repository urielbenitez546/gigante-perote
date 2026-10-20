import { useMemo, useState } from "react";
import { Gauge, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useDeliveries } from "../../hooks/useDeliveries";
import { useAuth } from "../../context/AuthContext";
import { DELIVERY_STATUS_LABELS, tienePermiso, type Delivery } from "../../types";

const r1 = (n: number) => Math.round(n * 10) / 10;
const km = (n: number) => `${r1(n).toLocaleString("es-MX", { maximumFractionDigits: 1 })} km`;

function aISO(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Día (en hora local) al que pertenece un reparto: cuando se entregó, o cuando se creó. */
function diaDe(d: Delivery): string {
  return aISO(new Date(d.delivered_at ?? d.created_at));
}

function kmRecorridos(d: Delivery): number | null {
  if (d.initial_km == null || d.current_km == null) return null;
  const x = Number(d.current_km) - Number(d.initial_km);
  return x >= 0 ? x : null;
}

/**
 * Resumen de kilometraje del día: por chofer y camioneta, cada destino con
 * sus km y la suma final. Lo ven Gerencia, jefe y auxiliar de almacén.
 */
export default function Kilometraje() {
  const { profile } = useAuth();
  const { deliveries, loading, error } = useDeliveries();
  const [dia, setDia] = useState(aISO(new Date()));

  const delDia = useMemo(() => deliveries.filter((d) => diaDe(d) === dia), [deliveries, dia]);

  const grupos = useMemo(() => {
    const m = new Map<string, { chofer: string; vehiculo: string; items: Delivery[] }>();
    for (const d of delDia) {
      const chofer = d.driver_name?.trim() || "Sin chofer asignado";
      const vehiculo = d.vehicle?.trim() || "Sin vehículo";
      const k = `${chofer}||${vehiculo}`;
      if (!m.has(k)) m.set(k, { chofer, vehiculo, items: [] });
      m.get(k)!.items.push(d);
    }
    return [...m.values()].map((g) => ({
      ...g,
      items: g.items.sort(
        (a, b) =>
          new Date(a.delivered_at ?? a.created_at).getTime() - new Date(b.delivered_at ?? b.created_at).getTime()
      ),
      total: g.items.reduce((s, d) => s + (kmRecorridos(d) ?? 0), 0),
      sinKm: g.items.filter((d) => kmRecorridos(d) === null).length,
    }));
  }, [delDia]);

  const totalDia = grupos.reduce((s, g) => s + g.total, 0);

  if (!tienePermiso(profile, "ver_km")) {
    return <p className="text-sm text-gigante-muted">Tu usuario no tiene acceso a este módulo.</p>;
  }

  function moverDia(delta: number) {
    const d = new Date(dia + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDia(aISO(d));
  }

  const hora = (d: Delivery) =>
    new Date(d.delivered_at ?? d.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Gauge size={22} /> Kilometraje del día
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Cada destino con sus kilómetros y la suma final por chofer. Los km los captura el chofer en cada reparto.
      </p>

      <div className="flex items-center gap-2 mt-4 print:hidden">
        <button
          onClick={() => moverDia(-1)}
          aria-label="Día anterior"
          className="border border-gigante-border rounded-lg p-2 text-gigante-navy"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          value={dia}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          className="border border-gigante-border rounded-lg px-3 py-2 text-sm text-gigante-navy"
        />
        <button
          onClick={() => moverDia(1)}
          aria-label="Día siguiente"
          className="border border-gigante-border rounded-lg p-2 text-gigante-navy"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setDia(aISO(new Date()))}
          className="text-xs text-gigante-navy border border-gigante-border rounded-lg px-3 py-2"
        >
          Hoy
        </button>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 text-xs text-gigante-navy border border-gigante-border rounded-lg px-3 py-2"
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-gigante-red">{error}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-gigante-muted">Cargando...</p>
      ) : grupos.length === 0 ? (
        <p className="mt-4 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-5">
          No hay repartos registrados ese día.
        </p>
      ) : (
        <>
          <div className="mt-4 bg-gigante-navy text-white rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm">
              {delDia.length} {delDia.length === 1 ? "reparto" : "repartos"} · {grupos.length}{" "}
              {grupos.length === 1 ? "chofer" : "choferes"}
            </span>
            <span className="text-lg font-bold">Total del día: {km(totalDia)}</span>
          </div>

          {grupos.map((g) => (
            <div key={g.chofer + g.vehiculo} className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gigante-bg flex items-center justify-between flex-wrap gap-1">
                <p className="text-sm font-semibold text-gigante-navy">
                  {g.chofer} <span className="font-normal text-gigante-muted">· {g.vehiculo}</span>
                </p>
                <p className="text-sm font-bold text-gigante-navy">{km(g.total)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead className="text-gigante-muted">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Hora</th>
                      <th className="px-2 py-2 font-medium">Folio</th>
                      <th className="px-2 py-2 font-medium">Cliente y destino</th>
                      <th className="px-2 py-2 font-medium">Estado</th>
                      <th className="px-2 py-2 font-medium text-right">Km inicial</th>
                      <th className="px-2 py-2 font-medium text-right">Km final</th>
                      <th className="px-4 py-2 font-medium text-right">Recorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((d) => {
                      const rec = kmRecorridos(d);
                      return (
                        <tr key={d.id} className="border-t border-gigante-border align-top">
                          <td className="px-4 py-2">{hora(d)}</td>
                          <td className="px-2 py-2 font-medium text-gigante-navy">{d.sale?.folio ?? "—"}</td>
                          <td className="px-2 py-2">
                            <span className="block text-gigante-navy">{d.sale?.customer_name ?? "—"}</span>
                            <span className="block text-gigante-muted">{d.sale?.customer_address ?? "Sin dirección"}</span>
                          </td>
                          <td className="px-2 py-2">{DELIVERY_STATUS_LABELS[d.status]}</td>
                          <td className="px-2 py-2 text-right">{d.initial_km ?? "—"}</td>
                          <td className="px-2 py-2 text-right">{d.current_km ?? "—"}</td>
                          <td className="px-4 py-2 text-right font-semibold text-gigante-navy">
                            {rec === null ? "—" : km(rec)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {g.sinKm > 0 && (
                <p className="px-4 py-2 text-[11px] text-amber-800 bg-amber-50">
                  {g.sinKm} {g.sinKm === 1 ? "reparto no tiene" : "repartos no tienen"} km capturados completos (inicial y
                  final); no se suman.
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
