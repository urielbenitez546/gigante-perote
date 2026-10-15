import { useState } from "react";
import { History } from "lucide-react";
import { useProducts } from "../../hooks/useInventory";
import ProductSearchSelect from "../../components/common/ProductSearchSelect";
import ProductoDetalle from "../productos/ProductoDetalle";

/** Kardex digital: busca un producto (o escanea su QR desde el botón
 * "Escanear" de arriba) y ve su existencia, historial y registra
 * entradas, salidas y conteos. Reemplaza la hoja blanca de papel. */
export default function Kardex() {
  const { products, loading, error } = useProducts();
  const [productId, setProductId] = useState("");

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <History size={22} /> Kardex
      </h1>
      <p className="text-sm text-gigante-muted mt-1 mb-4">
        Busca el producto por ID, código o nombre, o escanea el QR de su etiqueta amarilla.
      </p>

      {error && <p className="text-sm text-gigante-red mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-gigante-muted">Cargando productos...</p>
      ) : (
        <div className="mb-5">
          <ProductSearchSelect products={products} value={productId} onChange={setProductId} showStock />
        </div>
      )}

      {productId && <ProductoDetalle key={productId} productId={productId} />}
    </div>
  );
}
