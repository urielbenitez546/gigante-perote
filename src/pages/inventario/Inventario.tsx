import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Package, Boxes, ShoppingCart, CheckCircle2, FileText, AlertTriangle, Pencil, QrCode, Store, ClipboardCheck, Undo2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts, useInventoryMovements, useDisplayMovements, useInventoryCounts } from "../../hooks/useInventory";
import { usePurchaseInvoices, useWriteOffs } from "../../hooks/usePurchases";
import { useProfileNames } from "../../hooks/useProfileNames";
import RegistrarEntradaModal from "../../components/inventario/RegistrarEntradaModal";
import RegistrarFacturaModal from "../../components/inventario/RegistrarFacturaModal";
import RegistrarMermaModal from "../../components/inventario/RegistrarMermaModal";
import EditarProductoComercialModal from "../../components/inventario/EditarProductoComercialModal";
import CodigoQrModal from "../../components/inventario/CodigoQrModal";
import ExhibicionModal from "../../components/inventario/ExhibicionModal";
import ConteoFisicoModal from "../../components/inventario/ConteoFisicoModal";
import { publicPhotoUrl } from "../../lib/storage";
import {
  ROTACION_LABELS,
  PRODUCT_UNIT_LABELS,
  SEMAFORO_LABELS,
  calcularSemaforo,
  productoCoincide,
  productoId,
  type Product,
  type ProductRotacion,
  type SemaforoStatus,
} from "../../types";

const SEMAFORO_DOT: Record<SemaforoStatus, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-500",
  rojo: "bg-red-500",
};

const ROTACION_BADGE: Record<ProductRotacion, string> = {
  rapido: "bg-emerald-100 text-emerald-700",
  medio: "bg-blue-100 text-blue-700",
  lento: "bg-amber-100 text-amber-700",
  muy_lento: "bg-orange-100 text-orange-700",
  obsoleto: "bg-red-100 text-red-700",
  incorporacion: "bg-purple-100 text-purple-700",
};

function precioConDescuento(p: Product): number {
  return p.unit_price * (1 - (p.descuento_porcentaje ?? 0) / 100);
}

const MOVEMENT_LABELS: Record<string, string> = {
  entrada: "Entrada de mercancía",
  salida: "Salida",
  ajuste: "Ajuste de inventario",
  merma: "Merma (material dañado)",
  exhibicion: "A exhibición (tienda)",
  regreso_exhibicion: "Regresa de exhibición",
  conteo: "Ajuste por conteo físico",
};

const MOVEMENT_IS_POSITIVE: Record<string, boolean> = {
  entrada: true,
  salida: false,
  ajuste: true,
  merma: false,
  exhibicion: false,
  regreso_exhibicion: true,
};

/** El conteo puede sumar o restar: el signo va en la referencia ("Conteo físico: +3 ..."). */
function isPositiveMovement(type: string, reference: string | null): boolean {
  if (type === "conteo") return (reference ?? "").includes(": +");
  return MOVEMENT_IS_POSITIVE[type] ?? true;
}

const ROTACION_PRIORIDAD: Record<ProductRotacion, number> = {
  rapido: 4,
  medio: 3,
  incorporacion: 2,
  lento: 1,
  muy_lento: 0,
  obsoleto: 0,
};

type TabKey = "productos" | "movimientos" | "facturas" | "merma" | "exhibicion" | "conteos";

export default function Inventario() {
  const { profile } = useAuth();
  const { products, loading, error, reload } = useProducts();
  const { movements, loading: loadingMovements, reload: reloadMovements } = useInventoryMovements();
  const { invoices, loading: loadingInvoices, reload: reloadInvoices } = usePurchaseInvoices();
  const { writeOffs, loading: loadingWriteOffs, reload: reloadWriteOffs } = useWriteOffs();
  const { nameFor } = useProfileNames();
  const { displayMovements, loading: loadingDisplay, reload: reloadDisplay } = useDisplayMovements();
  const { counts, loading: loadingCounts, reload: reloadCounts } = useInventoryCounts();
  const [exhibicionModal, setExhibicionModal] = useState<{ mode: "sale" | "regresa"; productId?: string } | null>(null);
  const [conteoModal, setConteoModal] = useState<{ productId?: string } | null>(null);

  const [tab, setTab] = useState<TabKey>("productos");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [semaforoFilter, setSemaforoFilter] = useState<"Todos" | SemaforoStatus>("Todos");
  // Cuando se llega desde una alerta de la campanita
  // (/inventario?semaforo=amarillo&producto=<id>), se muestra directo ese producto.
  const [searchParams, setSearchParams] = useSearchParams();
  const [productoAlerta, setProductoAlerta] = useState<string | null>(null);

  useEffect(() => {
    const sem = searchParams.get("semaforo");
    const prod = searchParams.get("producto");
    if (sem === "verde" || sem === "amarillo" || sem === "rojo") setSemaforoFilter(sem);
    setProductoAlerta(prod);
    if (sem || prod) setTab("productos");
    const t = searchParams.get("tab");
    if (t === "conteos" || t === "exhibicion" || t === "movimientos" || t === "facturas" || t === "merma") setTab(t);
  }, [searchParams]);

  function quitarFiltroAlerta() {
    setProductoAlerta(null);
    setSemaforoFilter("Todos");
    setSearchParams({});
  }
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showMermaModal, setShowMermaModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const canManage = profile?.role === "gerencia" || profile?.role === "almacen";
  const canEditProduct =
    profile?.role === "gerencia" || profile?.role === "almacen" || profile?.role === "ventas";

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );
  const brands = useMemo(
    () => ["Todas", ...Array.from(new Set(products.map((p) => p.brand)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    // Desde una alerta: solo ese producto (aunque ya haya cambiado de color).
    if (productoAlerta) return products.filter((p) => p.id === productoAlerta);
    return products.filter((p) => {
      const matchesSearch = productoCoincide(p, search);
      const matchesCategory = categoryFilter === "Todas" || p.category === categoryFilter;
      const matchesBrand = brandFilter === "Todas" || p.brand === brandFilter;
      const matchesSemaforo = semaforoFilter === "Todos" || calcularSemaforo(p) === semaforoFilter;
      return matchesSearch && matchesCategory && matchesBrand && matchesSemaforo;
    });
  }, [products, search, categoryFilter, brandFilter, semaforoFilter, productoAlerta]);

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
    { key: "exhibicion", label: "Exhibición" },
    { key: "conteos", label: "Conteos físicos" },
  ];

  const enExhibicion = useMemo(
    () => products.filter((p) => (p.exhibition_stock ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  // Conteos: qué tan confiable está el inventario (últimos 30 días).
  const conteoStats = useMemo(() => {
    const hace30 = Date.now() - 30 * 86_400_000;
    const recientes = counts.filter((c) => new Date(c.created_at).getTime() >= hace30);
    const cuadraron = recientes.filter((c) => c.diferencia === 0).length;
    const faltantes = recientes.filter((c) => c.diferencia < 0).length;
    const sobrantes = recientes.filter((c) => c.diferencia > 0).length;
    const productosContados = new Set(recientes.map((c) => c.product_id)).size;
    return {
      total: recientes.length,
      cuadraron,
      faltantes,
      sobrantes,
      productosContados,
      confiabilidad: recientes.length > 0 ? Math.round((cuadraron / recientes.length) * 100) : null,
    };
  }, [counts]);

  // Conteo cíclico: sugiere qué contar hoy. Primero los que nunca se han
  // contado o hace más que no, dando prioridad a los que más se venden y
  // a los que tienen material apartado para clientes.
  const sugeridosConteo = useMemo(() => {
    const ahora = Date.now();
    return products
      .filter((p) => p.active !== false && (p.physical_stock > 0 || p.sold_pending > 0))
      .map((p) => {
        const dias = p.last_counted_at ? (ahora - new Date(p.last_counted_at).getTime()) / 86_400_000 : 999;
        const score = Math.min(dias, 120) + ROTACION_PRIORIDAD[p.rotacion] * 10 + (p.sold_pending > 0 ? 15 : 0);
        return { p, dias, score };
      })
      .filter((x) => x.dias >= 7)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [products]);

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
              onClick={() => setExhibicionModal({ mode: "sale" })}
              className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-semibold rounded-lg px-4 py-2.5"
            >
              <Store size={16} /> Exhibición
            </button>
            <button
              onClick={() => setConteoModal({})}
              className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-semibold rounded-lg px-4 py-2.5"
            >
              <ClipboardCheck size={16} /> Conteo físico
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
                placeholder="Buscar por ID, código, nombre o marca..."
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
            <select
              value={semaforoFilter}
              onChange={(e) => setSemaforoFilter(e.target.value as "Todos" | SemaforoStatus)}
              className="rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            >
              <option value="Todos">Semáforo: Todos</option>
              <option value="verde">🟢 Hay suficiente</option>
              <option value="amarillo">🟡 Se está acabando</option>
              <option value="rojo">🔴 Se acabó</option>
            </select>
          </div>

          {productoAlerta && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span>Mostrando el producto de la alerta de la campanita.</span>
              <button onClick={quitarFiltroAlerta} className="text-xs font-semibold text-gigante-red hover:underline shrink-0">
                Ver todos los productos
              </button>
            </div>
          )}

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
                      <th className="text-left font-medium px-4 py-3">ID</th>
                      <th className="text-left font-medium px-4 py-3">Código</th>
                      <th className="text-left font-medium px-4 py-3">Producto</th>
                      <th className="text-left font-medium px-4 py-3">Marca</th>
                      <th className="text-left font-medium px-4 py-3">Categoría</th>
                      <th className="text-right font-medium px-4 py-3">Existencia física</th>
                      <th className="text-right font-medium px-4 py-3">Vendidos pendientes</th>
                      <th className="text-right font-medium px-4 py-3">Disponibles</th>
                      <th className="text-right font-medium px-4 py-3">Precio</th>
                      <th className="text-left font-medium px-4 py-3">Rotación</th>
                      <th className="px-4 py-3"></th>
                      {canEditProduct && <th className="px-4 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="border-t border-gigante-border">
                        <td className="px-4 py-3 font-semibold text-gigante-navy">{productoId(p) || "—"}</td>
                        <td className="px-4 py-3 text-gigante-navy">{p.code}</td>
                        <td className="px-4 py-3 text-gigante-navy">{p.name}</td>
                        <td className="px-4 py-3 text-gigante-muted">{p.brand}</td>
                        <td className="px-4 py-3 text-gigante-muted">{p.category}</td>
                        <td className="px-4 py-3 text-right text-gigante-navy">
                          {p.physical_stock.toLocaleString()} {PRODUCT_UNIT_LABELS[p.unit]}
                          {(p.exhibition_stock ?? 0) > 0 && (
                            <span className="block text-[10px] text-gigante-muted">
                              +{p.exhibition_stock} en exhibición
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gigante-red">
                          {p.sold_pending.toLocaleString()} {PRODUCT_UNIT_LABELS[p.unit]}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gigante-navy">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${SEMAFORO_DOT[calcularSemaforo(p)]}`}
                              title={SEMAFORO_LABELS[calcularSemaforo(p)]}
                            />
                            {(p.physical_stock - p.sold_pending).toLocaleString()} {PRODUCT_UNIT_LABELS[p.unit]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gigante-navy">
                          {p.descuento_porcentaje > 0 ? (
                            <>
                              <span className="line-through text-gigante-muted text-xs mr-1">
                                ${p.unit_price.toLocaleString("es-MX")}
                              </span>
                              <span className="font-semibold text-emerald-700">
                                ${precioConDescuento(p).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            </>
                          ) : (
                            <>${p.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs rounded-full px-2 py-1 ${ROTACION_BADGE[p.rotacion]}`}>
                            {ROTACION_LABELS[p.rotacion]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setQrProduct(p)}
                            aria-label="Ver código QR"
                            className="text-gigante-muted hover:text-gigante-navy"
                          >
                            <QrCode size={15} />
                          </button>
                        </td>
                        {canEditProduct && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setEditingProduct(p)}
                              aria-label="Editar precio y rotación"
                              className="text-gigante-muted hover:text-gigante-navy"
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="md:hidden divide-y divide-gigante-border">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gigante-navy">{p.name}</p>
                          <p className="text-xs text-gigante-muted">
                            {productoId(p) && <span className="font-semibold text-gigante-navy">ID {productoId(p)} · </span>}
                            {p.code} · {p.brand}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {canEditProduct && (
                            <button
                              onClick={() => setEditingProduct(p)}
                              aria-label="Editar precio y rotación"
                              className="text-gigante-muted hover:text-gigante-navy"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => setQrProduct(p)}
                            aria-label="Ver código QR"
                            className="text-gigante-muted hover:text-gigante-navy"
                          >
                            <QrCode size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 ${ROTACION_BADGE[p.rotacion]}`}>
                          {ROTACION_LABELS[p.rotacion]}
                        </span>
                        {p.descuento_porcentaje > 0 ? (
                          <span className="text-xs">
                            <span className="line-through text-gigante-muted mr-1">
                              ${p.unit_price.toLocaleString("es-MX")}
                            </span>
                            <span className="font-semibold text-emerald-700">
                              ${precioConDescuento(p).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-gigante-navy">
                            ${p.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
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
                          <p className="text-sm font-semibold text-gigante-navy flex items-center justify-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[calcularSemaforo(p)]}`} />
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
                  const positive = isPositiveMovement(m.type, m.reference);
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

      {tab === "exhibicion" && (
        <div className="mt-4 space-y-4">
          <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gigante-border">
              <p className="text-sm font-semibold text-gigante-navy">Lo que está ahorita en exhibición</p>
              {canManage && (
                <button
                  onClick={() => setExhibicionModal({ mode: "sale" })}
                  className="text-xs font-semibold text-gigante-red hover:underline"
                >
                  + Sacar material
                </button>
              )}
            </div>
            {enExhibicion.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">No hay material en exhibición registrado.</p>
            ) : (
              <ul className="divide-y divide-gigante-border">
                {enExhibicion.map((p) => {
                  const estado = calcularSemaforo(p);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-gigante-navy truncate">
                          {p.code} — {p.name}
                        </p>
                        <p className="text-xs text-gigante-muted flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[estado]}`} />
                          En almacén disponible: {p.physical_stock - p.sold_pending} {PRODUCT_UNIT_LABELS[p.unit]}
                          {estado !== "verde" && (
                            <span className="text-amber-700 font-medium">
                              {" "}
                              · {estado === "rojo" ? "ya no hay para vender: cambia la muestra" : "se está acabando: piensa en cambiar la muestra"}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-gigante-navy">
                          {p.exhibition_stock} {PRODUCT_UNIT_LABELS[p.unit]}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => setExhibicionModal({ mode: "regresa", productId: p.id })}
                            className="inline-flex items-center gap-1 text-xs text-gigante-red hover:underline"
                          >
                            <Undo2 size={13} /> Regresar
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
            <p className="text-sm font-semibold text-gigante-navy px-4 py-3 border-b border-gigante-border">Historial</p>
            {loadingDisplay ? (
              <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
            ) : displayMovements.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">Todavía no hay movimientos de exhibición.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gigante-bg text-gigante-muted text-xs">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">Fecha</th>
                      <th className="text-left font-medium px-4 py-3">Movimiento</th>
                      <th className="text-left font-medium px-4 py-3">Producto</th>
                      <th className="text-right font-medium px-4 py-3">Cantidad</th>
                      <th className="text-left font-medium px-4 py-3">Dónde / nota</th>
                      <th className="text-left font-medium px-4 py-3">Registró</th>
                      <th className="text-left font-medium px-4 py-3">Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayMovements.map((d) => {
                      const url = publicPhotoUrl("merma", d.photo_path);
                      return (
                        <tr key={d.id} className="border-t border-gigante-border">
                          <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                            {new Date(d.created_at).toLocaleString("es-MX")}
                          </td>
                          <td className="px-4 py-3 text-gigante-navy">
                            {d.tipo === "sale" ? "Salió a la tienda" : "Regresó a almacén"}
                          </td>
                          <td className="px-4 py-3 text-gigante-navy">
                            {d.product?.code} — {d.product?.name}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gigante-navy">
                            {d.quantity} {d.product ? PRODUCT_UNIT_LABELS[d.product.unit] : ""}
                          </td>
                          <td className="px-4 py-3 text-gigante-muted">
                            {[d.ubicacion, d.notas].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-gigante-muted">{nameFor(d.created_by)}</td>
                          <td className="px-4 py-3">
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="text-gigante-red text-xs underline">
                                Ver foto
                              </a>
                            ) : (
                              <span className="text-xs text-gigante-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "conteos" && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gigante-border rounded-xl p-4">
              <p className="text-xs text-gigante-muted">Confiabilidad (30 días)</p>
              <p
                className={`text-xl font-bold ${
                  conteoStats.confiabilidad === null
                    ? "text-gigante-muted"
                    : conteoStats.confiabilidad >= 90
                    ? "text-emerald-700"
                    : conteoStats.confiabilidad >= 70
                    ? "text-amber-700"
                    : "text-gigante-red"
                }`}
              >
                {conteoStats.confiabilidad === null ? "—" : `${conteoStats.confiabilidad}%`}
              </p>
              <p className="text-[11px] text-gigante-muted">de los conteos cuadraron</p>
            </div>
            <div className="bg-white border border-gigante-border rounded-xl p-4">
              <p className="text-xs text-gigante-muted">Conteos (30 días)</p>
              <p className="text-xl font-bold text-gigante-navy">{conteoStats.total}</p>
              <p className="text-[11px] text-gigante-muted">{conteoStats.productosContados} productos distintos</p>
            </div>
            <div className="bg-white border border-gigante-border rounded-xl p-4">
              <p className="text-xs text-gigante-muted">Con faltante</p>
              <p className="text-xl font-bold text-gigante-red">{conteoStats.faltantes}</p>
              <p className="text-[11px] text-gigante-muted">el sistema decía de más</p>
            </div>
            <div className="bg-white border border-gigante-border rounded-xl p-4">
              <p className="text-xs text-gigante-muted">Con sobrante</p>
              <p className="text-xl font-bold text-amber-700">{conteoStats.sobrantes}</p>
              <p className="text-[11px] text-gigante-muted">el sistema decía de menos</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2">
            <strong>Cómo se reduce el descuadre:</strong> en vez de contar todo el almacén una vez al año, cuenten
            unos cuantos productos cada día (los de la lista de abajo). Así, en pocas semanas todo el inventario
            está revisado y Ventas puede confiar en lo que dice el sistema.
          </div>

          <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gigante-border">
              <p className="text-sm font-semibold text-gigante-navy">Sugeridos para contar hoy</p>
              {canManage && (
                <button onClick={() => setConteoModal({})} className="text-xs font-semibold text-gigante-red hover:underline">
                  + Contar otro producto
                </button>
              )}
            </div>
            {sugeridosConteo.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">
                Todo lo que tiene existencia se contó en los últimos 7 días. ¡Bien!
              </p>
            ) : (
              <ul className="divide-y divide-gigante-border">
                {sugeridosConteo.map(({ p, dias }) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-gigante-navy truncate">
                        {p.code} — {p.name}
                      </p>
                      <p className="text-xs text-gigante-muted">
                        {dias >= 999 ? "Nunca se ha contado" : `Último conteo hace ${Math.floor(dias)} días`} ·{" "}
                        Rotación {ROTACION_LABELS[p.rotacion].toLowerCase()}
                        {p.sold_pending > 0 && ` · ${p.sold_pending} apartadas`}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setConteoModal({ productId: p.id })}
                        className="shrink-0 text-xs font-semibold text-white bg-gigante-navy rounded-lg px-3 py-1.5"
                      >
                        Contar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
            <p className="text-sm font-semibold text-gigante-navy px-4 py-3 border-b border-gigante-border">
              Historial de conteos
            </p>
            {loadingCounts ? (
              <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
            ) : counts.length === 0 ? (
              <p className="p-6 text-sm text-gigante-muted">Todavía no hay conteos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gigante-bg text-gigante-muted text-xs">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">Fecha</th>
                      <th className="text-left font-medium px-4 py-3">Producto</th>
                      <th className="text-right font-medium px-4 py-3">Sistema</th>
                      <th className="text-right font-medium px-4 py-3">Contado</th>
                      <th className="text-right font-medium px-4 py-3">Diferencia</th>
                      <th className="text-left font-medium px-4 py-3">Nota</th>
                      <th className="text-left font-medium px-4 py-3">Contó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map((c) => (
                      <tr key={c.id} className="border-t border-gigante-border">
                        <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                          {new Date(c.created_at).toLocaleString("es-MX")}
                        </td>
                        <td className="px-4 py-3 text-gigante-navy">
                          {c.product?.code} — {c.product?.name}
                        </td>
                        <td className="px-4 py-3 text-right text-gigante-muted">{c.sistema}</td>
                        <td className="px-4 py-3 text-right text-gigante-navy">{c.contado}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            c.diferencia === 0 ? "text-emerald-700" : c.diferencia < 0 ? "text-gigante-red" : "text-amber-700"
                          }`}
                        >
                          {c.diferencia === 0 ? "✓ cuadra" : c.diferencia > 0 ? `+${c.diferencia}` : c.diferencia}
                        </td>
                        <td className="px-4 py-3 text-gigante-muted">{c.notas ?? "—"}</td>
                        <td className="px-4 py-3 text-gigante-muted">{nameFor(c.created_by)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
      {editingProduct && (
        <EditarProductoComercialModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            reload();
          }}
        />
      )}
      {qrProduct && <CodigoQrModal product={qrProduct} onClose={() => setQrProduct(null)} />}
      {exhibicionModal && (
        <ExhibicionModal
          products={products}
          initialMode={exhibicionModal.mode}
          initialProductId={exhibicionModal.productId}
          onClose={() => setExhibicionModal(null)}
          onSuccess={() => {
            setExhibicionModal(null);
            setTab("exhibicion");
            reload();
            reloadMovements();
            reloadDisplay();
          }}
        />
      )}
      {conteoModal && (
        <ConteoFisicoModal
          products={products}
          initialProductId={conteoModal.productId}
          onClose={() => setConteoModal(null)}
          onSuccess={() => {
            reload();
            reloadMovements();
            reloadCounts();
          }}
        />
      )}
    </div>
  );
}
