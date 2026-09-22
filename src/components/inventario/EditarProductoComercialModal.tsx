import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { updateProductComercial, updateProductDescuento } from "../../hooks/useInventory";
import { ROTACION_LABELS, type Product, type ProductRotacion } from "../../types";

interface Props {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

const ROTACIONES: ProductRotacion[] = ["rapida", "media", "lenta", "obsoleta"];

export default function EditarProductoComercialModal({ product, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  // Precio y Rotación: Gerencia y Almacén (quien ve el movimiento físico).
  // % de Descuento: Gerencia y Ventas (quien decide cómo mover lo que gira lento).
  const canEditPrecioRotacion = profile?.role === "gerencia" || profile?.role === "almacen";
  const canEditDescuento = profile?.role === "gerencia" || profile?.role === "ventas";

  const [precio, setPrecio] = useState(String(product.unit_price));
  const [rotacion, setRotacion] = useState<ProductRotacion>(product.rotacion);
  const [descuento, setDescuento] = useState(String(product.descuento_porcentaje));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const precioConDescuento =
    Number(precio) > 0 ? Number(precio) * (1 - (Number(descuento) || 0) / 100) : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const precioNum = Number(precio);
    const descuentoNum = Number(descuento);
    if (canEditPrecioRotacion && !(precioNum >= 0)) {
      setError("El precio debe ser un número válido.");
      return;
    }
    if (canEditDescuento && !(descuentoNum >= 0 && descuentoNum <= 100)) {
      setError("El descuento debe ser un número entre 0 y 100.");
      return;
    }

    setSubmitting(true);

    if (canEditPrecioRotacion) {
      const { error: err } = await updateProductComercial(product.id, {
        unit_price: precioNum,
        rotacion,
      });
      if (err) {
        setSubmitting(false);
        setError(err);
        return;
      }
    }

    if (canEditDescuento) {
      const { error: err } = await updateProductDescuento(product.id, descuentoNum);
      if (err) {
        setSubmitting(false);
        setError(err);
        return;
      }
    }

    setSubmitting(false);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">
            {canEditPrecioRotacion && canEditDescuento
              ? "Editar precio, rotación y descuento"
              : canEditPrecioRotacion
              ? "Editar precio y rotación"
              : "Editar descuento"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gigante-muted mb-4">
          {product.code} — {product.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {canEditPrecioRotacion ? (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">
                Precio por {product.unit}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
          ) : (
            <p className="text-sm text-gigante-navy">
              Precio actual: <strong>${product.unit_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>{" "}
              <span className="text-xs text-gigante-muted">(solo Gerencia y Almacén pueden cambiarlo)</span>
            </p>
          )}

          {canEditPrecioRotacion ? (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Rotación</label>
              <div className="grid grid-cols-2 gap-2">
                {ROTACIONES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRotacion(r)}
                    className={`text-sm font-medium rounded-lg py-2 border ${
                      rotacion === r
                        ? "bg-gigante-navy text-white border-gigante-navy"
                        : "border-gigante-border text-gigante-navy"
                    }`}
                  >
                    {ROTACION_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gigante-navy">
              Rotación actual: <strong>{ROTACION_LABELS[product.rotacion]}</strong>{" "}
              <span className="text-xs text-gigante-muted">(solo Gerencia y Almacén pueden cambiarla)</span>
            </p>
          )}

          {canEditDescuento ? (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Descuento (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
              <p className="text-xs text-gigante-muted mt-1">
                Este descuento se cobrará automáticamente en las ventas nuevas de este producto.
              </p>
              {Number(descuento) > 0 && Number(precio) > 0 && (
                <p className="text-xs text-emerald-700 mt-1">
                  Precio con descuento: ${precioConDescuento.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gigante-navy">
              Descuento actual: <strong>{product.descuento_porcentaje}%</strong>{" "}
              <span className="text-xs text-gigante-muted">(solo Gerencia y Ventas pueden cambiarlo)</span>
            </p>
          )}

          {error && (
            <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
