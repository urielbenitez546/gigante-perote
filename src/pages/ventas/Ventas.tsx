import { useState } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useSales } from "../../hooks/useSales";
import { DELIVERY_TYPE_LABELS, SALE_STATUS_LABELS, type SaleWithItems } from "../../types";
import NuevaVentaModal from "../../components/ventas/NuevaVentaModal";
import DetalleVentaModal from "../../components/ventas/DetalleVentaModal";

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  parcial: "bg-blue-100 text-blue-700",
  entregada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-gigante-red/10 text-gigante-red",
};

export default function Ventas() {
  const { profile } = useAuth();
  const { products } = useProducts();
  const { sales, loading, error, reload } = useSales();
  const [showModal, setShowModal] = useState(false);
  const [successFolio, setSuccessFolio] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);

  const canRegisterSale = profile?.role === "gerencia" || profile?.role === "ventas";

  function handleSuccess(folio: string) {
    setShowModal(false);
    setSuccessFolio(folio);
    reload();
    setTimeout(() => setSuccessFolio(null), 5000);
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

      <div className="mt-5 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando ventas...</p>
        ) : sales.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">Todavía no hay ventas registradas.</p>
        ) : (
          <>
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-gigante-bg text-gigante-muted text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Folio</th>
                  <th className="text-left font-medium px-4 py-3">Cliente</th>
                  <th className="text-left font-medium px-4 py-3">Tipo de entrega</th>
                  <th className="text-left font-medium px-4 py-3">Estado</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-gigante-border">
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => setSelectedSale(s)}
                        className="text-gigante-red hover:underline"
                      >
                        {s.folio}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gigante-navy">{s.customer_name}</td>
                    <td className="px-4 py-3 text-gigante-muted">{DELIVERY_TYPE_LABELS[s.delivery_type]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE[s.status]}`}>
                        {SALE_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gigante-navy">
                      ${s.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString("es-MX")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-gigante-border">
              {sales.map((s) => (
                <div key={s.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedSale(s)}
                      className="text-sm font-semibold text-gigante-red hover:underline"
                    >
                      {s.folio}
                    </button>
                    <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE[s.status]}`}>
                      {SALE_STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gigante-navy mt-1">{s.customer_name}</p>
                  <p className="text-xs text-gigante-muted">{DELIVERY_TYPE_LABELS[s.delivery_type]}</p>
                  <p className="text-sm font-semibold text-gigante-navy mt-1">
                    ${s.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <NuevaVentaModal products={products} onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}
      {selectedSale && <DetalleVentaModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    </div>
  );
}
