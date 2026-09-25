import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { ROTACION_LABELS, PRODUCT_UNIT_LABELS, productoId, type Product } from "../../types";

const ROTACION_BADGE: Record<string, string> = {
  rapido: "bg-emerald-100 text-emerald-700",
  medio: "bg-blue-100 text-blue-700",
  lento: "bg-amber-100 text-amber-700",
  muy_lento: "bg-orange-100 text-orange-700",
  obsoleto: "bg-red-100 text-red-700",
  incorporacion: "bg-purple-100 text-purple-700",
};

export default function ProductoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [id]);

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
      <Link to="/inventario" className="inline-flex items-center gap-1 text-sm text-gigante-muted mb-4">
        <ArrowLeft size={15} /> Inventario
      </Link>

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
      </div>
    </div>
  );
}
