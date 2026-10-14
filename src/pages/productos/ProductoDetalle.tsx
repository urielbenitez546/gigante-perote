import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, ArrowLeft, PackagePlus, PackageMinus, ClipboardCheck, History } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useProductKardex } from "../../hooks/useInventory";
import { useProfileNames } from "../../hooks/useProfileNames";
import RegistrarEntradaModal from "../../components/inventario/RegistrarEntradaModal";
import RegistrarSalidaModal from "../../components/inventario/RegistrarSalidaModal";
import ConteoFisicoModal from "../../components/inventario/ConteoFisicoModal";
import { ROTACION_LABELS, PRODUCT_UNIT_LABELS, productoId, type Product } from "../../types";

const ROTACION_BADGE: Record<string, string> = {
  rapido: "bg-emerald-100 text-emerald-700",
  medio: "bg-blue-100 text-blue-700",
  lento: "bg-amber-100 text-amber-700",
  muy_lento: "bg-orange-100 text-orange-700",
  obsoleto: "bg-red-100 text-red-700",
  incorporacion: "bg-purple-100 text-purple-700",
};

type ModalAbierto = "entrada" | "salida" | "conteo" | null;

export default function ProductoDetalle({ productId }: { productId?: string } = {}) {
  const params = useParams<{ id: string }>();
  const id = productId ?? params.id;
  const embedded = !!productId;
  const { profile } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalAbierto>(null);

  const { entries: kardex, loading: loadingKardex, reload: reloadKardex } = useProductKardex(id ?? null);
  const { nameFor } = useProfileNames();

  // Gerencia y Almacén (los "almacenistas") pueden registrar movimientos
  // y ven el historial completo del Kardex. El resto de roles que
  // pueden escanear el QR solo ven la ficha de precio/existencia.
  const puedeOperar = profile?.role === "gerencia" || profile?.role === "almacen";
  const puedeVerKardex = puedeOperar || profile?.role === "ventas";

  function cargarProducto() {
    if (!id) return;
    setLoading(true);
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else if (!data) setError("No se encontró este producto.");
        else setProduct(data as Product);
        setLoading(false);
      });
  }

  useEffect(() => {
    cargarProducto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function onSuccess() {
    setModal(null);
    cargarProducto();
    reloadKardex();
  }

  if (loading) {
    return <p className="text-sm text-gigante-muted">Cargando producto...</p>;
  }
  if (error || !product) {
    return (
      <div className="max-w-md">
        <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error ?? "No se encontró este producto."}
        </p>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gigante-navy mt-4">
          <ArrowLeft size={15} /> Regresar al inicio
        </Link>
      </div>
    );
  }

  const disponible = product.physical_stock - product.sold_pending;
  const tieneDescuento = product.descuento_porcentaje > 0;
  const precioFinal = product.unit_price * (1 - product.descuento_porcentaje / 100);

  return (
    <div className="max-w-md">
      {!embedded && (
        <Link to="/inventario" className="inline-flex items-center gap-1 text-sm text-gigante-muted mb-4">
          <ArrowLeft size={15} /> Inventario
        </Link>
      )}

      <div className="bg-white border border-gigante-border rounded-2xl p-5">
        <div className="flex items-center gap-2 text-gigante-muted text-xs mb-1">
          <Package size={14} /> {productoId(product) && <strong className="text-gigante-navy">ID {productoId(product)} ·</strong>} {product.code}
        </div>
        <h1 className="text-xl font-bold text-gigante-navy">{product.name}</h1>
        <p className="text-sm text-gigante-muted mt-0.5">
          {product.brand} · {product.category}
        </p>

        <div className="mt-4">
          {tieneDescuento ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg text-gigante-muted line-through">
                ${product.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-2xl font-bold text-emerald-700">
                ${precioFinal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                -{product.descuento_porcentaje}%
              </span>
            </div>
          ) : (
            <span className="text-2xl font-bold text-gigante-navy">
              ${product.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          )}
          <span className="text-sm text-gigante-muted ml-1">por {PRODUCT_UNIT_LABELS[product.unit]}</span>
        </div>

        <div className="mt-4">
          <span className={`text-xs rounded-full px-2 py-1 ${ROTACION_BADGE[product.rotacion]}`}>
            Rotación {ROTACION_LABELS[product.rotacion]}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gigante-border text-center">
          <div>
            <p className="text-xs text-gigante-muted">Física</p>
            <p className="text-base font-semibold text-gigante-navy">{product.physical_stock}</p>
          </div>
          <div>
            <p className="text-xs text-gigante-muted">Pendiente</p>
            <p className="text-base font-semibold text-gigante-red">{product.sold_pending}</p>
          </div>
          <div>
            <p className="text-xs text-gigante-muted">Disponible</p>
            <p className="text-base font-semibold text-gigante-navy">{disponible}</p>
          </div>
        </div>

        {product.last_counted_at && (
          <p className="text-xs text-gigante-muted mt-3 text-center">
            Último conteo físico: {new Date(product.last_counted_at).toLocaleString("es-MX")}
          </p>
        )}
      </div>

      {/* Kardex digital: reemplaza la hoja blanca de papel detrás de la
          etiqueta amarilla. Se accede escaneando el QR del producto. */}
      {puedeOperar && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            onClick={() => setModal("entrada")}
            className="flex flex-col items-center gap-1 bg-white border border-gigante-border rounded-xl py-3 text-xs font-medium text-gigante-navy hover:bg-gigante-bg"
          >
            <PackagePlus size={18} /> Entrada
          </button>
          <button
            onClick={() => setModal("salida")}
            className="flex flex-col items-center gap-1 bg-white border border-gigante-border rounded-xl py-3 text-xs font-medium text-gigante-navy hover:bg-gigante-bg"
          >
            <PackageMinus size={18} /> Salida
          </button>
          <button
            onClick={() => setModal("conteo")}
            className="flex flex-col items-center gap-1 bg-white border border-gigante-border rounded-xl py-3 text-xs font-medium text-gigante-navy hover:bg-gigante-bg"
          >
            <ClipboardCheck size={18} /> Conteo
          </button>
        </div>
      )}

      {puedeVerKardex && (
        <div className="bg-white border border-gigante-border rounded-2xl p-5 mt-4">
          <h2 className="text-sm font-bold text-gigante-navy flex items-center gap-2 mb-3">
            <History size={16} /> Kardex — historial de movimientos
          </h2>
          {loadingKardex ? (
            <p className="text-xs text-gigante-muted">Cargando historial...</p>
          ) : kardex.length === 0 ? (
            <p className="text-xs text-gigante-muted">Este producto todavía no tiene movimientos registrados.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {kardex.map((e) => (
                <li key={e.id} className="text-xs border-b border-gigante-border/60 pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gigante-navy">{e.detalle}</span>
                    {e.cantidad !== null && (
                      <span
                        className={`font-semibold ${
                          e.signo > 0 ? "text-emerald-700" : e.signo < 0 ? "text-gigante-red" : "text-gigante-muted"
                        }`}
                      >
                        {e.signo > 0 ? "+" : e.signo < 0 ? "−" : ""}
                        {e.cantidad}
                      </span>
                    )}
                  </div>
                  {e.referencia && <p className="text-gigante-muted mt-0.5">{e.referencia}</p>}
                  <p className="text-gigante-muted mt-0.5">
                    {new Date(e.fecha).toLocaleString("es-MX")} · {nameFor(e.created_by)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal === "entrada" && (
        <RegistrarEntradaModal
          products={[product]}
          initialProductId={product.id}
          onClose={() => setModal(null)}
          onSuccess={onSuccess}
        />
      )}
      {modal === "salida" && (
        <RegistrarSalidaModal
          products={[product]}
          initialProductId={product.id}
          onClose={() => setModal(null)}
          onSuccess={onSuccess}
        />
      )}
      {modal === "conteo" && (
        <ConteoFisicoModal
          products={[product]}
          initialProductId={product.id}
          onClose={() => setModal(null)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
