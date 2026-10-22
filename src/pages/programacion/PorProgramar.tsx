import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  PackageCheck,
  RefreshCw,
  Truck,
  Warehouse,
  Hourglass,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOpenSales, confirmarEntregaInmediata } from "../../hooks/useSales";
import { pendingLinesFor } from "../../lib/pendingLines";
import { DIAS_AVISO_APARTADO, diasRestantesApartado, tienePermiso, type SaleWithItems } from "../../types";
import DetalleVentaModal from "../../components/ventas/DetalleVentaModal";
import ConfirmarEntregaParcialModal from "../../components/ventas/ConfirmarEntregaParcialModal";
import ProgramarEntregaModal from "../../components/ventas/ProgramarEntregaModal";
import EsperandoProveedorModal from "../../components/ventas/EsperandoProveedorModal";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Filtro = "sin_fecha" | "inmediata" | "domicilio" | "retiro" | "proveedor" | "programadas" | "vencer";
type Vista = "lista" | "semana";

/** Fecha local yyyy-mm-dd (sin cambios por zona horaria). */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function desdeYmd(s: string): Date {
  return new Date(s + "T12:00:00");
}
function lunesDe(d: Date): Date {
  const r = new Date(d);
  r.setHours(12, 0, 0, 0);
  const dow = (r.getDay() + 6) % 7; // lunes = 0
  r.setDate(r.getDate() - dow);
  return r;
}
function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : "");

function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === "sin") return "Sin fecha asignada";
  const d = desdeYmd(fecha);
  const largo = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  if (fecha === hoy) return `Hoy · ${largo}`;
  if (fecha === ymd(sumarDias(new Date(), 1))) return `Mañana · ${largo}`;
  return largo.charAt(0).toUpperCase() + largo.slice(1);
}

interface Fila {
  sale: SaleWithItems;
  inmediata: ReturnType<typeof pendingLinesFor>;
  domicilio: ReturnType<typeof pendingLinesFor>;
  retiro: ReturnType<typeof pendingLinesFor>;
  saldo: number;
}

export default function PorProgramar() {
  const { profile } = useAuth();
  const { sales, loading, error, reload } = useOpenSales();
  const puedeProgramar = tienePermiso(profile, "programar_entregas");
  // Solo Almacén (con permiso) y Gerencia confirman la carga; Ventas y Caja solo consultan.
  const puedeConfirmar = profile?.role === "almacen" || profile?.role === "gerencia";
  // Ventas, Caja y quien programa ven todos los filtros. Los demás de Almacén solo lo inmediato.
  const vistaCompleta = puedeProgramar || profile?.role === "ventas" || profile?.role === "caja";

  const [filtro, setFiltro] = useState<Filtro>(vistaCompleta ? "sin_fecha" : "inmediata");
  const [vista, setVista] = useState<Vista>("lista");
  const [semanaBase, setSemanaBase] = useState<Date>(() => lunesDe(new Date()));
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [programando, setProgramando] = useState<SaleWithItems | null>(null);
  const [proveedorDe, setProveedorDe] = useState<SaleWithItems | null>(null);
  const [cargando, setCargando] = useState<Fila | null>(null);

  // Se actualiza solo: así las entregas inmediatas nuevas aparecen sin recargar.
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);

  const hoy = ymd(new Date());

  const filas = useMemo<Fila[]>(
    () =>
      sales
        .filter((s) => !!s.liberada_almacen_at && s.status !== "cancelada")
        .map((sale) => ({
          sale,
          inmediata: pendingLinesFor(sale, "inmediata"),
          domicilio: pendingLinesFor(sale, "domicilio"),
          retiro: pendingLinesFor(sale, "retiro_sucursal"),
          saldo: Math.max(sale.total - sale.amount_paid, 0),
        }))
        .filter((f) => f.inmediata.length + f.domicilio.length + f.retiro.length > 0),
    [sales]
  );

  const programable = (f: Fila) => f.domicilio.length + f.retiro.length > 0;

  const porFiltro: Record<Filtro, Fila[]> = useMemo(
    () => ({
      sin_fecha: filas.filter((f) => programable(f) && !f.sale.fecha_programada && !f.sale.esperando_proveedor),
      inmediata: filas.filter((f) => f.inmediata.length > 0),
      domicilio: filas.filter((f) => f.domicilio.length > 0),
      retiro: filas.filter((f) => f.retiro.length > 0),
      proveedor: filas.filter((f) => f.sale.esperando_proveedor),
      programadas: filas.filter((f) => programable(f) && !!f.sale.fecha_programada),
      vencer: filas.filter((f) => diasRestantesApartado(f.sale.created_at) <= DIAS_AVISO_APARTADO),
    }),
    [filas]
  );

  const FILTROS: { key: Filtro; label: string; icon: typeof Clock; solo?: "programar" }[] = [
    { key: "sin_fecha", label: "Sin fecha asignada", icon: CalendarClock, solo: "programar" },
    { key: "inmediata", label: "Entrega inmediata", icon: Zap },
    { key: "domicilio", label: "A domicilio", icon: Truck, solo: "programar" },
    { key: "retiro", label: "Recoge en sucursal", icon: Warehouse, solo: "programar" },
    { key: "proveedor", label: "Esperando proveedor", icon: Hourglass, solo: "programar" },
    { key: "programadas", label: "Ya programadas", icon: CalendarDays, solo: "programar" },
    { key: "vencer", label: "Apartado por vencer", icon: Hourglass, solo: "programar" },
  ];
  const filtrosVisibles = FILTROS.filter((f) => !f.solo || vistaCompleta);
  const filtroActivo: Filtro = filtrosVisibles.some((f) => f.key === filtro) ? filtro : "inmediata";
  const lista = porFiltro[filtroActivo];

  // Agrupación por día (para la lista).
  const grupos = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of lista) {
      const k = f.sale.fecha_programada ?? "sin";
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    const keys = Array.from(m.keys()).sort((a, b) => (a === "sin" ? -1 : b === "sin" ? 1 : a.localeCompare(b)));
    return keys.map((k) => ({
      fecha: k,
      filas: (m.get(k) ?? []).sort((a, b) => (a.sale.hora_programada ?? "99").localeCompare(b.sale.hora_programada ?? "99")),
    }));
  }, [lista]);

  // Semana
  const diasSemana = Array.from({ length: 7 }, (_, i) => sumarDias(semanaBase, i));
  const programadasSemana = (dia: string) =>
    porFiltro.programadas
      .filter((f) => f.sale.fecha_programada === dia)
      .sort((a, b) => (a.sale.hora_programada ?? "").localeCompare(b.sale.hora_programada ?? ""));

  const detalle = detalleId ? sales.find((s) => s.id === detalleId) ?? null : null;

  function tarjeta(f: Fila) {
    const { sale } = f;
    const tipos: string[] = [];
    if (f.inmediata.length) tipos.push("Inmediata");
    if (f.domicilio.length) tipos.push("A domicilio");
    if (f.retiro.length) tipos.push("Recoge en sucursal");
    const atrasada = !!sale.fecha_programada && sale.fecha_programada < hoy && programable(f);
    const material = [...f.inmediata, ...f.domicilio, ...f.retiro]
      .map((l) => `${l.product_code} (${l.pending} ${l.unit})`)
      .join(", ");

    return (
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button onClick={() => setDetalleId(sale.id)} className="text-sm font-semibold text-gigante-red hover:underline">
              {sale.folio}
            </button>
            <span className="text-sm text-gigante-navy"> · {sale.customer_name}</span>
            <p className="text-[11px] text-gigante-muted mt-0.5">
              {tipos.join(" + ")}
            </p>
            {sale.customer_address && f.domicilio.length > 0 && (
              <p className="text-[11px] text-gigante-muted">{sale.customer_address}</p>
            )}
            <p className="text-[11px] text-gigante-muted mt-0.5 break-words">{material}</p>
            {(() => {
              const dias = diasRestantesApartado(sale.created_at);
              if (dias > DIAS_AVISO_APARTADO) return null;
              return (
                <p className={`text-[11px] mt-0.5 font-semibold ${dias < 0 ? "text-red-700" : "text-amber-700"}`}>
                  {dias < 0
                    ? `Apartado vencido hace ${Math.abs(dias)} d`
                    : dias === 0
                    ? "El apartado vence HOY"
                    : `El apartado vence en ${dias} d`}
                </p>
              );
            })()}
          </div>
          <div className="text-right shrink-0 space-y-1">
            {sale.fecha_programada && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 ${
                  atrasada ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <Clock size={11} />
                {atrasada ? "Atrasada · " : ""}
                {desdeYmd(sale.fecha_programada).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                {sale.hora_programada ? ` · ${hhmm(sale.hora_programada)}` : ""}
              </span>
            )}
            <p className={`text-[11px] font-semibold ${f.saldo > 0 ? "text-gigante-red" : "text-emerald-700"}`}>
              {f.saldo > 0 ? `Cobrar ${money(f.saldo)}` : "Pagado · nada que cobrar"}
            </p>
          </div>
        </div>

        {sale.esperando_proveedor && (
          <p className="mt-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-2 py-1.5">
            <strong>Esperando proveedor</strong>
            {sale.proveedor_nota ? `: ${sale.proveedor_nota}` : ""}
            {sale.proveedor_desde
              ? ` (desde ${new Date(sale.proveedor_desde).toLocaleDateString("es-MX", { day: "numeric", month: "short" })})`
              : ""}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {f.inmediata.length > 0 && puedeConfirmar && (
            <button
              onClick={() => setCargando(f)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-red hover:bg-gigante-redDark rounded-lg px-3 py-1.5"
            >
              <PackageCheck size={14} /> Confirmar carga
            </button>
          )}
          {programable(f) && puedeProgramar && !sale.esperando_proveedor && (
            <button
              onClick={() => setProgramando(sale)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-navy rounded-lg px-3 py-1.5"
            >
              <CalendarClock size={14} /> {sale.fecha_programada ? "Cambiar día/hora" : "Asignar día y hora"}
            </button>
          )}
          {programable(f) && puedeProgramar && (
            <button
              onClick={() => setProveedorDe(sale)}
              className="inline-flex items-center gap-1 text-xs font-medium border border-gigante-border text-gigante-navy rounded-lg px-3 py-1.5 bg-white"
            >
              <Hourglass size={14} /> {sale.esperando_proveedor ? "Ya llegó el material" : "Esperando proveedor"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <CalendarClock size={22} /> Entregas por programar
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            {puedeProgramar
              ? "Aquí llegan las ventas que Caja ya pasó a almacén. Asigna día y hora aproximada de entrega."
              : vistaCompleta
              ? "Consulta cuándo se entregará cada venta. El día y la hora los asigna el Jefe de almacén."
              : "Aquí llegan las entregas inmediatas que Caja ya pasó a almacén: carga el material y confírmalo."}
          </p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-medium rounded-lg px-3 py-2"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>}

      {porFiltro.inmediata.length > 0 && (
        <p className="mt-4 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <Zap size={16} />
          Hay {porFiltro.inmediata.length} entrega(s) inmediata(s) esperando que se cargue el material.
        </p>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {filtrosVisibles.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => {
                setFiltro(f.key);
                if (f.key !== "programadas") setVista("lista");
              }}
              className={`whitespace-nowrap flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border ${
                filtroActivo === f.key
                  ? "bg-gigante-navy text-white border-gigante-navy"
                  : "border-gigante-border text-gigante-navy bg-white"
              }`}
            >
              <Icon size={13} /> {f.label} ({porFiltro[f.key].length})
            </button>
          );
        })}
      </div>

      {vistaCompleta && (filtroActivo === "programadas" || filtroActivo === "domicilio" || filtroActivo === "retiro") && (
        <div className="mt-3 inline-flex rounded-lg border border-gigante-border overflow-hidden bg-white text-xs">
          {(["lista", "semana"] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 font-medium ${vista === v ? "bg-gigante-navy text-white" : "text-gigante-navy"}`}
            >
              {v === "lista" ? "Lista por día" : "Semana"}
            </button>
          ))}
        </div>
      )}

      {vista === "semana" && vistaCompleta && filtroActivo !== "inmediata" ? (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setSemanaBase((d) => sumarDias(d, -7))}
              className="p-2 rounded-lg border border-gigante-border bg-white"
              aria-label="Semana anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setSemanaBase(lunesDe(new Date()))} className="text-xs font-semibold text-gigante-navy">
              {diasSemana[0].toLocaleDateString("es-MX", { day: "numeric", month: "short" })} –{" "}
              {diasSemana[6].toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · ir a hoy
            </button>
            <button
              onClick={() => setSemanaBase((d) => sumarDias(d, 7))}
              className="p-2 rounded-lg border border-gigante-border bg-white"
              aria-label="Semana siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {diasSemana.map((d) => {
              const k = ymd(d);
              const items = programadasSemana(k);
              return (
                <div
                  key={k}
                  className={`bg-white border rounded-xl p-2 min-h-[90px] ${k === hoy ? "border-gigante-red" : "border-gigante-border"}`}
                >
                  <p className="text-[11px] font-semibold text-gigante-navy capitalize">
                    {d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })}
                  </p>
                  {items.length === 0 ? (
                    <p className="text-[10px] text-gigante-muted mt-1">—</p>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      {items.map((f) => (
                        <button
                          key={f.sale.id}
                          onClick={() => (puedeProgramar ? setProgramando(f.sale) : setDetalleId(f.sale.id))}
                          className="w-full text-left rounded-lg bg-gigante-bg px-2 py-1.5 hover:bg-gigante-border/50"
                        >
                          <p className="text-[11px] font-semibold text-gigante-navy">
                            {hhmm(f.sale.hora_programada) || "s/h"} · {f.sale.folio}
                          </p>
                          <p className="text-[10px] text-gigante-muted truncate">{f.sale.customer_name}</p>
                          <p className={`text-[10px] ${f.saldo > 0 ? "text-gigante-red" : "text-emerald-700"}`}>
                            {f.saldo > 0 ? `Cobrar ${money(f.saldo)}` : "Pagado"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gigante-muted mt-2">
            {puedeProgramar
              ? "Toca una entrega para cambiar su día u hora (se pide un motivo). "
              : "Toca una entrega para ver su detalle. "}
            Las que aún no tienen fecha están en “Sin fecha asignada”.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {loading && sales.length === 0 ? (
            <p className="p-6 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl">Cargando...</p>
          ) : grupos.length === 0 ? (
            <p className="p-6 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl">
              No hay entregas con este filtro.
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.fecha}>
                <p className="text-sm font-semibold text-gigante-navy mb-1.5">
                  {etiquetaDia(g.fecha, hoy)} <span className="text-gigante-muted font-normal">({g.filas.length})</span>
                </p>
                <div className="bg-white border border-gigante-border rounded-xl divide-y divide-gigante-border overflow-hidden">
                  {g.filas.map((f) => (
                    <div key={f.sale.id}>{tarjeta(f)}</div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {detalle && <DetalleVentaModal sale={detalle} onClose={() => setDetalleId(null)} onUpdated={reload} />}

      {programando && (
        <ProgramarEntregaModal
          sale={programando}
          onClose={() => setProgramando(null)}
          onSaved={() => {
            setProgramando(null);
            reload();
          }}
        />
      )}

      {proveedorDe && (
        <EsperandoProveedorModal
          sale={proveedorDe}
          onClose={() => setProveedorDe(null)}
          onSaved={() => {
            setProveedorDe(null);
            reload();
          }}
        />
      )}

      {cargando && (
        <ConfirmarEntregaParcialModal
          title={`Confirmar carga — ${cargando.sale.folio}`}
          description="Marca lo que ya se cargó. Se descuenta del inventario y queda en el Kardex."
          lines={cargando.inmediata}
          submitLabel="Confirmar carga"
          onClose={() => setCargando(null)}
          onConfirm={(selected) =>
            confirmarEntregaInmediata(
              cargando.sale.id,
              selected.map(({ sale_item_id, quantity }) => ({ sale_item_id, quantity }))
            )
          }
          onSuccess={() => {
            setCargando(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
