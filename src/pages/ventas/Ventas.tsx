import { useMemo, useState } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useSales } from "../../hooks/useSales";
import { useProfileNames } from "../../hooks/useProfileNames";
import { DELIVERY_TYPE_LABELS, SALE_STATUS_LABELS, ESTADO_PAGO_LABELS, tienePermiso, type SaleWithItems } from "../../types";
import NuevaVentaModal from "../../components/ventas/NuevaVentaModal";
import DetalleVentaModal from "../../components/ventas/DetalleVentaModal";
import { ESTADO_PAGO_BADGE } from "../../components/ventas/CobroCajaPanel";
import CobrarVentaModal from "../../components/ventas/CobrarVentaModal";
import CorregirCobroModal from "../../components/ventas/CorregirCobroModal";

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  parcial: "bg-blue-100 text-blue-700",
  entregada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-gigante-red/10 text-gigante-red",
};

type FiltroVentas = "todas" | "caja" | "almacen";

export default function Ventas() {
  const { profile } = useAuth();
  const { products } = useProducts();
  const { sales, loading, error, reload } = useSales();
  const { nameFor } = useProfileNames();
  const [showModal, setShowModal] = useState(false);
  const [successFolio, setSuccessFolio] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const selectedSale = selectedSaleId ? sales.find((s) => s.id === selectedSaleId) ?? null : null;
  const esCaja = profile?.role === "caja";
  const manejaCobros = profile?.role === "caja" || profile?.role === "gerencia";
  const puedeCorregir = manejaCobros && tienePermiso(profile, "corregir_cobros");
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);
  const [corrigiendoId, setCorrigiendoId] = useState<string | null>(null);
  const cobrando = cobrandoId ? sales.find((s) => s.id === cobrandoId) ?? null : null;
  const corrigiendo = corrigiendoId ? sales.find((s) => s.id === corrigiendoId) ?? null : null;
  const [filtro, setFiltro] = useState<FiltroVentas>(esCaja ? "caja" : "todas");

  const enCaja = useMemo(() => sales.filter((s) => !s.liberada_almacen_at && s.status !== "cancelada"), [sales]);
  const visibles = useMemo(() => {
    if (filtro === "caja") return enCaja;
    if (filtro === "almacen") return sales.filter((s) => !!s.liberada_almacen_at);
    return sales;
  }, [sales, enCaja, filtro]);

  const canRegisterSale = profile?.role === "gerencia" || profile?.role === "ventas";

  function handleSuccess(folio: string) {
    setShowModal(false);
    setSuccessFolio(folio);
    reload();
    setTimeout(() => setSuccessFolio(null), 5000);
  }

  /** Botón de cobro directo en la lista: Confirmar cobro (venta nueva) o Corregir cobro (ya pasó a almacén). */
  function accionCobro(s: SaleWithItems) {
    if (s.status === "cancelada") return null;
    if (!s.liberada_almacen_at) {
      return (
        <button
          onClick={() => setCobrandoId(s.id)}
          className="bg-gigante-red hover:bg-gigante-redDark text-white text-xs font-semibold rounded-lg px-3 py-1.5"
        >
          Confirmar cobro
        </button>
      );
    }
    if (puedeCorregir) {
      return (
        <button onClick={() => setCorrigiendoId(s.id)} className="text-xs font-semibold text-gigante-red hover:underline">
          Corregir cobro
        </button>
      );
    }
    return null;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <ShoppingCart size={22} /> Ventas y Entregas
          </h1>
          <p className="text-sm text-gigante-muted mt-1">Registro de ventas y su tipo de entrega</p>
        </div>
        {canRegisterSale && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            <Plus size={16} /> Nueva venta
          </button>
        )}
      </div>

      {successFolio && (
        <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Venta <strong>{successFolio}</strong> registrada correctamente.
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          No se pudieron cargar las ventas: {error}
        </p>
      )}

      {enCaja.length > 0 && (profile?.role === "caja" || profile?.role === "gerencia") && (
        <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Hay <strong>{enCaja.length}</strong> venta(s) esperando cobro en Caja. Presiona <strong>Confirmar cobro</strong> en cada una: al confirmar, se pasa a almacén.
        </p>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["todas", "Todas"],
            ["caja", `Esperando Caja (${enCaja.length})`],
            ["almacen", "Ya pasaron a almacén"],
          ] as [FiltroVentas, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
              filtro === key
                ? "bg-gigante-navy text-white border-gigante-navy"
                : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando ventas...</p>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">
            {sales.length === 0 ? "Todavía no hay ventas registradas." : "No hay ventas con este filtro."}
          </p>
        ) : (
          <>
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-gigante-bg text-gigante-muted text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Folio</th>
                  <th className="text-left font-medium px-4 py-3">Cliente</th>
                  <th className="text-left font-medium px-4 py-3">Vendedor</th>
                  <th className="text-left font-medium px-4 py-3">Tipo de entrega</th>
                  <th className="text-left font-medium px-4 py-3">Estado</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                  <th className="text-left font-medium px-4 py-3">Pago</th>
                  {manejaCobros && <th className="text-left font-medium px-4 py-3">Cobro</th>}
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((s) => {
                  const pending = Math.max(s.total - s.amount_paid, 0);
                  return (
                  <tr key={s.id} className="border-t border-gigante-border">
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => setSelectedSaleId(s.id)}
                        className="text-gigante-red hover:underline"
                      >
                        {s.folio}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gigante-navy">{s.customer_name}</td>
                    <td className="px-4 py-3 text-gigante-muted">{nameFor(s.created_by)}</td>
                    <td className="px-4 py-3 text-gigante-muted">{DELIVERY_TYPE_LABELS[s.delivery_type]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE[s.status]}`}>
                        {SALE_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gigante-navy">
                      ${s.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs rounded-full px-2 py-1 ${ESTADO_PAGO_BADGE[s.estado_pago]}`}>
                        {ESTADO_PAGO_LABELS[s.estado_pago]}
                      </span>
                      {pending > 0 && s.liberada_almacen_at && (
                        <span className="block text-[11px] text-gigante-red mt-0.5">
                          Faltan ${pending.toLocaleString("es-MX")}
                        </span>
                      )}
                      {!s.liberada_almacen_at && (
                        <span className="block text-[11px] text-amber-700 mt-0.5">Esperando cobro</span>
                      )}
                    </td>
                    {manejaCobros && <td className="px-4 py-3 whitespace-nowrap">{accionCobro(s)}</td>}
                    <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString("es-MX")}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-gigante-border">
              {visibles.map((s) => {
                const pending = Math.max(s.total - s.amount_paid, 0);
                return (
                <div key={s.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedSaleId(s.id)}
                      className="text-sm font-semibold text-gigante-red hover:underline"
                    >
                      {s.folio}
                    </button>
                    <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE[s.status]}`}>
                      {SALE_STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gigante-navy mt-1">{s.customer_name}</p>
                  <p className="text-xs text-gigante-muted">
                    {DELIVERY_TYPE_LABELS[s.delivery_type]} · Vendedor: {nameFor(s.created_by)}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-semibold text-gigante-navy">
                      ${s.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`text-xs rounded-full px-2 py-1 ${ESTADO_PAGO_BADGE[s.estado_pago]}`}>
                      {!s.liberada_almacen_at ? "Esperando cobro" : pending > 0 ? `Faltan $${pending.toLocaleString("es-MX")}` : ESTADO_PAGO_LABELS[s.estado_pago]}
                    </span>
                  </div>
                  {manejaCobros && <div className="mt-2">{accionCobro(s)}</div>}
                </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <NuevaVentaModal products={products} onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}
      {cobrando && (
        <CobrarVentaModal
          sale={cobrando}
          onClose={() => setCobrandoId(null)}
          onDone={() => {
            setCobrandoId(null);
            reload();
          }}
        />
      )}
      {corrigiendo && (
        <CorregirCobroModal
          sale={corrigiendo}
          onClose={() => setCorrigiendoId(null)}
          onDone={() => {
            setCorrigiendoId(null);
            reload();
          }}
        />
      )}
      {selectedSale && (
        <DetalleVentaModal sale={selectedSale} onClose={() => setSelectedSaleId(null)} onUpdated={reload} />
      )}
    </div>
  );
}
