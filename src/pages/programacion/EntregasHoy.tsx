import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, PackageCheck, RefreshCw, Truck, Warehouse, Zap } from "lucide-react";
import { useOpenSales, confirmarEntregaInmediata } from "../../hooks/useSales";
import { pendingLinesFor } from "../../lib/pendingLines";
import type { PendingLine, SaleWithItems } from "../../types";
import ConfirmarEntregaParcialModal from "../../components/ventas/ConfirmarEntregaParcialModal";

/** Fecha local yyyy-mm-dd (sin cambios por zona horaria). */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : "");

interface Fila {
  sale: SaleWithItems;
  inmediata: PendingLine[];
  domicilio: PendingLine[];
  retiro: PendingLine[];
}

function Material({ lines }: { lines: PendingLine[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {lines.map((l) => (
        <li key={l.sale_item_id} className="text-sm text-gigante-navy">
          <span className="font-semibold">
            {l.pending} {l.unit}
          </span>{" "}
          · {l.product_code} — {l.product_name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Pantalla del almacenista: solo lo de HOY.
 * Arriba, en rojo, lo que se vende con entrega inmediata (hay que cargarlo ya).
 * Abajo, lo que el Jefe de almacén programó para hoy (y lo atrasado).
 */
export default function EntregasHoy() {
  const { sales, loading, error, reload } = useOpenSales();
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
        })),
    [sales]
  );

  const inmediatas = useMemo(
    () =>
      filas
        .filter((f) => f.inmediata.length > 0)
        .sort((a, b) => (a.sale.liberada_almacen_at ?? "").localeCompare(b.sale.liberada_almacen_at ?? "")),
    [filas]
  );

  const programadasHoy = useMemo(
    () =>
      filas
        .filter(
          (f) =>
            f.domicilio.length + f.retiro.length > 0 &&
            !!f.sale.fecha_programada &&
            f.sale.fecha_programada <= hoy &&
            !f.sale.esperando_proveedor
        )
        .sort(
          (a, b) =>
            (a.sale.fecha_programada ?? "").localeCompare(b.sale.fecha_programada ?? "") ||
            (a.sale.hora_programada ?? "99").localeCompare(b.sale.hora_programada ?? "99")
        ),
    [filas, hoy]
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <CalendarCheck size={22} /> Entregas de hoy
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            Lo urgente va arriba: las ventas de entrega inmediata. Abajo, lo que el Jefe de almacén programó para hoy.
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

      {/* 1) Entrega inmediata: prioridad */}
      <section className="mt-5">
        <h2 className="text-sm font-bold text-red-700 flex items-center gap-1.5 mb-2">
          <Zap size={16} /> Entrega inmediata — cargar ahora ({inmediatas.length})
        </h2>
        {loading && sales.length === 0 ? (
          <p className="p-5 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl">Cargando...</p>
        ) : inmediatas.length === 0 ? (
          <p className="p-5 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl">
            ✅ No hay entregas inmediatas pendientes. Cuando Caja cobre una venta de entrega inmediata, aparece aquí y
            te suena el aviso.
          </p>
        ) : (
          <div className="space-y-3">
            {inmediatas.map((f) => (
              <div key={f.sale.id} className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gigante-navy">
                      {f.sale.folio} · {f.sale.customer_name}
                    </p>
                    <p className="text-[11px] text-red-700 font-semibold">Entrega inmediata</p>
                  </div>
                  <button
                    onClick={() => setCargando(f)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-red hover:bg-gigante-redDark rounded-lg px-4 py-2"
                  >
                    <PackageCheck size={15} /> Ya lo cargué
                  </button>
                </div>
                <Material lines={f.inmediata} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2) Programadas para hoy */}
      <section className="mt-7">
        <h2 className="text-sm font-bold text-gigante-navy flex items-center gap-1.5 mb-2">
          <Clock size={16} /> Programadas para hoy ({programadasHoy.length})
        </h2>
        {programadasHoy.length === 0 ? (
          <p className="p-5 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl">
            No hay entregas programadas para hoy.
          </p>
        ) : (
          <div className="bg-white border border-gigante-border rounded-xl divide-y divide-gigante-border overflow-hidden">
            {programadasHoy.map((f) => {
              const atrasada = !!f.sale.fecha_programada && f.sale.fecha_programada < hoy;
              return (
                <div key={f.sale.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gigante-navy">
                        {f.sale.folio} · {f.sale.customer_name}
                      </p>
                      <p className="text-[11px] text-gigante-muted mt-0.5 flex items-center gap-1">
                        {f.domicilio.length > 0 ? <Truck size={12} /> : <Warehouse size={12} />}
                        {f.domicilio.length > 0 ? "A domicilio" : "Recoge en sucursal"}
                        {f.sale.customer_address && f.domicilio.length > 0 ? ` · ${f.sale.customer_address}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 ${
                        atrasada ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <Clock size={11} />
                      {atrasada ? "Atrasada" : f.sale.hora_programada ? hhmm(f.sale.hora_programada) : "Hoy"}
                    </span>
                  </div>
                  <Material lines={[...f.domicilio, ...f.retiro]} />
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-gigante-muted mt-2">
          Las entregas a domicilio las carga el chofer en su reparto; las de “recoge en sucursal” se entregan al cliente
          en “Retiros en Sucursal”.
        </p>
      </section>

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
