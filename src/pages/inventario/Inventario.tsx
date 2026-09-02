import { useMemo, useState } from "react";
import { Search, Plus, Package, Boxes, ShoppingCart, CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts, useInventoryMovements } from "../../hooks/useInventory";
import { usePurchaseInvoices, useWriteOffs } from "../../hooks/usePurchases";
import { useProfileNames } from "../../hooks/useProfileNames";
import RegistrarEntradaModal from "../../components/inventario/RegistrarEntradaModal";
import RegistrarFacturaModal from "../../components/inventario/RegistrarFacturaModal";
import RegistrarMermaModal from "../../components/inventario/RegistrarMermaModal";
import { publicPhotoUrl } from "../../lib/storage";

const MOVEMENT_LABELS: Record<string, string> = {
  entrada: "Entrada de mercancía",
  salida: "Salida",
  ajuste: "Ajuste de inventario",
  merma: "Merma (material dañado)",
};

const MOVEMENT_IS_POSITIVE: Record<string, boolean> = {
  entrada: true,
  salida: false,
  ajuste: true,
  merma: false,
};

type TabKey = "productos" | "movimientos" | "facturas" | "merma";

export default function Inventario() {
  const { profile } = useAuth();
  const { products, loading, error, reload } = useProducts();
  const { movements, loading: loadingMovements, reload: reloadMovements } = useInventoryMovements();
  const { invoices, loading: loadingInvoices, reload: reloadInvoices } = usePurchaseInvoices();
  const { writeOffs, loading: loadingWriteOffs, reload: reloadWriteOffs } = useWriteOffs();
  const { nameFor } = useProfileNames();

  const [tab, setTab] = useState<TabKey>("productos");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showMermaModal, setShowMermaModal] = useState(false);

  const canManage = profile?.role === "gerencia" || profile?.role === "almacen";

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );
  const brands = useMemo(
    () => ["Todas", ...Array.from(new Set(products.map((p) => p.brand)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        search.trim() === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "Todas" || p.category === categoryFilter;
      const matchesBrand = brandFilter === "Todas" || p.brand === brandFilter;
      return matchesSearch && matchesCategory && matchesBrand;
    });
  }, [products, search, categoryFilter, brandFilter]);

  const stats = useMemo(() => {
    const totalProductos = products.length;
    const existenciaFisica = products.reduce((sum, p) => sum + p.physical_stock, 0);
    const vendidosPendientes = products.reduce((sum, p) => sum + p.sold_pending, 0);
    const disponibles = existenciaFisica - vendidosPendientes;
    return { totalProductos, existenciaFisica, vendidosPendientes, disponibles };
  }, [products]);

  // Facturas de esta semana (lunes a hoy), para el conteo que pidió el jefe de almacén
  const facturasEstaSemana = useMemo(() => {
    const now = new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay(); // lunes=1..domingo=7
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    monday.setHours(0, 0, 0, 0);
    return invoices.filter((inv) => new Date(inv.created_at) >= monday);
  }, [invoices]);

  function handleEntradaSuccess() {
    setShowEntradaModal(false);
    reload();
    reloadMovements();
  }
  function handleFacturaSuccess() {
    setShowFacturaModal(false);
    reload();
    reloadMovements();
    reloadInvoices();
  }
  function handleMermaSuccess() {
    setShowMermaModal(false);
    reload();
    reloadMovements();
    reloadWriteOffs();
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: "productos", label: "Lista de productos" },
    { key: "movimientos", label: "Movimientos" },
    { key: "facturas", label: "Facturas" },
    { key: "merma", label: "Merma" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <Package size={22} /> Inventario
          </h1>
          <p className="text-sm text-gigante-muted mt-1">Consulta y control de productos</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowFacturaModal(true)}
              className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-semibold rounded-lg px-4 py-2.5"
            >
              <FileText size={16} /> Registrar factura
            </button>
            <button
              onClick={() => setShowMermaModal(true)}
              className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-semibold rounded-lg px-4 py-2.5"
            >
              <AlertTriangle size={16} /> Dar de baja
            </button>
            <button
              onClick={() => setShowEntradaModal(true)}
              className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2.5"
            >
              <Plus size={16} /> Registrar entrada
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          No se pudo cargar el inventario: {error}
        </p>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center mb-2">
            <Package size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Total de productos</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.totalProductos}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2">
            <Boxes size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Existencia física total</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.existenciaFisica.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center mb-2">
            <ShoppingCart size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Vendidos pendientes</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.vendidosPendientes.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-red text-white flex items-center justify-center mb-2">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Disponibles para venta</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.disponibles.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mt-6 border-b border-gigante-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key ? "border-gigante-red text-gigante-red" : "border-transparent text-gigante-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "productos" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gigante-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, código o marca..."
                className="w-full rounded-lg border border-gigante-border pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "Todas" ? "Categoría: Todas" : c}
                </option>
              ))}
            </select>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b === "Todas" ? "Marca: Todas" : b}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-gigante-muted">Cargando productos...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">No se encontraron productos con esos filtros.</p>
            ) : (
              <>
                <table className="w-full text-sm hidden md:table">
                  <thead className="bg-gigante-bg text-gigante-muted text-xs">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">Código</th>
                      <th className="text-left font-medium px-4 py-3">Producto</th>
                      <th className="text-left font-medium px-4 py-3">Marca</th>
                      <th className="text-left font-medium px-4 py-3">Categoría</th>
                      <th className="text-right font-medium px-4 py-3">Existencia física</th>
                      <th className="text-right font-medium px-4 py-3">Vendidos pendientes</th>
                      <th className="text-right font-medium px-4 py-3">Disponibles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="border-t border-gigante-border">
                        <td className="px-4 py-3 text-gigante-navy">{p.code}</td>
                        <td className="px-4 py-3 text-gigante-navy">{p.name}</td>
                        <td className="px-4 py-3 text-gigante-muted">{p.brand}</td>
                        <td className="px-4 py-3 text-gigante-muted">{p.category}</td>
                        <td className="px-4 py-3 text-right text-gigante-navy">
                          {p.physical_stock.toLocaleString()} {p.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-gigante-red">
                          {p.sold_pending.toLocaleString()} {p.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gigante-navy">
                          {(p.physical_stock - p.sold_pending).toLocaleString()} {p.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="md:hidden divide-y divide-gigante-border">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="p-4">
                      <p className="text-sm font-medium text-gigante-navy">{p.name}</p>
                      <p className="text-xs text-gigante-muted">
                        {p.code} · {p.brand}
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                        <div>
                          <p className="text-xs text-gigante-muted">Física</p>
                          <p className="text-sm font-semibold text-gigante-navy">{p.physical_stock}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gigante-muted">Pendiente</p>
                          <p className="text-sm font-semibold text-gigante-red">{p.sold_pending}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gigante-muted">Disponible</p>
                          <p className="text-sm font-semibold text-gigante-navy">
                            {p.physical_stock - p.sold_pending}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === "movimientos" && (
        <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
          {loadingMovements ? (
            <p className="p-6 text-sm text-gigante-muted">Cargando movimientos...</p>
          ) : movements.length === 0 ? (
            <p className="p-6 text-sm text-gigante-muted">Todavía no hay movimientos registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gigante-bg text-gigante-muted text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                  <th className="text-left font-medium px-4 py-3">Tipo</th>
                  <th className="text-left font-medium px-4 py-3">Producto</th>
                  <th className="text-left font-medium px-4 py-3">Referencia</th>
                  <th className="text-left font-medium px-4 py-3">Registrado por</th>
                  <th className="text-right font-medium px-4 py-3">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const positive = MOVEMENT_IS_POSITIVE[m.type] ?? true;
                  return (
                    <tr key={m.id} className="border-t border-gigante-border">
                      <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-gigante-navy">{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                      <td className="px-4 py-3 text-gigante-navy">
                        {m.product ? `${m.product.code} — ${m.product.name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gigante-muted">{m.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-gigante-muted">{nameFor(m.created_by)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          positive ? "text-emerald-700" : "text-gigante-red"
                        }`}
                      >
                        {positive ? "+" : "-"}
                        {m.quantity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "facturas" && (
        <div className="mt-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2 mb-4">
            Facturas registradas esta semana: <strong>{facturasEstaSemana.length}</strong>
          </div>
          <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
            {loadingInvoices ? (
              <p className="p-6 text-sm text-gigante-muted">Cargando facturas...</p>
            ) : invoices.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">Todavía no hay facturas registradas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gigante-bg text-gigante-muted text-xs">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Fecha</th>
                    <th className="text-left font-medium px-4 py-3">Factura</th>
                    <th className="text-left font-medium px-4 py-3">Proveedor</th>
                    <th className="text-left font-medium px-4 py-3">Productos</th>
                    <th className="text-left font-medium px-4 py-3">Registrado por</th>
                    <th className="text-left font-medium px-4 py-3">Evidencia</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const url = publicPhotoUrl("facturas", inv.photo_path);
                    return (
                      <tr key={inv.id} className="border-t border-gigante-border align-top">
                        <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                          {new Date(inv.created_at).toLocaleString("es-MX")}
                        </td>
                        <td className="px-4 py-3 font-medium text-gigante-navy">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-gigante-navy">{inv.supplier}</td>
                        <td className="px-4 py-3 text-gigante-muted">
                          {inv.purchase_invoice_items
                            .map((it) => `${it.product?.code} (${it.quantity} ${it.product?.unit})`)
                            .join(", ")}
                        </td>
                        <td className="px-4 py-3 text-gigante-muted">{nameFor(inv.created_by)}</td>
                        <td className="px-4 py-3">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="text-gigante-red text-xs underline">
                              Ver foto
                            </a>
                          ) : (
                            <span className="text-xs text-gigante-muted">Sin foto</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "merma" && (
        <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
          {loadingWriteOffs ? (
            <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
          ) : writeOffs.length === 0 ? (
            <p className="p-6 text-sm text-gigante-muted">Todavía no hay bajas de material registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gigante-bg text-gigante-muted text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                  <th className="text-left font-medium px-4 py-3">Producto</th>
                  <th className="text-right font-medium px-4 py-3">Cantidad</th>
                  <th className="text-left font-medium px-4 py-3">Motivo</th>
                  <th className="text-left font-medium px-4 py-3">Registrado por</th>
                  <th className="text-left font-medium px-4 py-3">Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {writeOffs.map((w) => {
                  const url = publicPhotoUrl("merma", w.photo_path);
                  return (
                    <tr key={w.id} className="border-t border-gigante-border align-top">
                      <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                        {new Date(w.created_at).toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-gigante-navy">
                        {w.product?.code} — {w.product?.name}
                      </td>
                      <td className="px-4 py-3 text-right text-gigante-red font-medium">
                        -{w.quantity} {w.product?.unit}
                      </td>
                      <td className="px-4 py-3 text-gigante-muted">{w.reason}</td>
                      <td className="px-4 py-3 text-gigante-muted">{nameFor(w.created_by)}</td>
                      <td className="px-4 py-3">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-gigante-red text-xs underline">
                            Ver foto
                          </a>
                        ) : (
                          <span className="text-xs text-gigante-muted">Sin foto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showEntradaModal && (
        <RegistrarEntradaModal
          products={products}
          onClose={() => setShowEntradaModal(false)}
          onSuccess={handleEntradaSuccess}
        />
      )}
      {showFacturaModal && (
        <RegistrarFacturaModal
          products={products}
          onClose={() => setShowFacturaModal(false)}
          onSuccess={handleFacturaSuccess}
        />
      )}
      {showMermaModal && (
        <RegistrarMermaModal
          products={products}
          onClose={() => setShowMermaModal(false)}
          onSuccess={handleMermaSuccess}
        />
      )}
    </div>
  );
}
