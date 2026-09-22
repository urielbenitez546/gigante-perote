import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { updateProductComercial, updateProductDescuento } from "../../hooks/useInventory";
import { ROTACION_LABELS, PRODUCT_UNIT_LABELS, type Product, type ProductRotacion } from "../../types";

interface Props {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

const ROTACIONES: ProductRotacion[] = ["rapido", "medio", "lento", "muy_lento", "obsoleto", "incorporacion"];

export default function EditarProductoComercialModal({ product, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  // Precio, Rotación y datos de etiqueta: Gerencia y Almacén.
  // % de Descuento: Gerencia y Ventas.
  const canEditPrecioRotacion = profile?.role === "gerencia" || profile?.role === "almacen";
  const canEditDescuento = profile?.role === "gerencia" || profile?.role === "ventas";

  const [precio, setPrecio] = useState(String(product.unit_price));
  const [rotacion, setRotacion] = useState<ProductRotacion>(product.rotacion);
  const [descuento, setDescuento] = useState(String(product.descuento_porcentaje));
  const [color, setColor] = useState(product.color ?? "");
  const [medida, setMedida] = useState(product.medida ?? "");
  const [tipo, setTipo] = useState(product.tipo ?? "");
  const [calidad, setCalidad] = useState(product.calidad ?? "");
  const [medidaCaja, setMedidaCaja] = useState(product.medida_caja ?? "");
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
        color: color.trim() || null,
        medida: medida.trim() || null,
        tipo: tipo.trim() || null,
        calidad: calidad.trim() || null,
        medida_caja: medidaCaja.trim() || null,
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gigante-navy">
            {canEditPrecioRotacion && canEditDescuento
              ? "Editar producto"
              : canEditPrecioRotacion
              ? "Editar producto"
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
                Precio por {PRODUCT_UNIT_LABELS[product.unit]}
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

          {canEditPrecioRotacion && (
            <div>
              <p className="text-sm font-medium text-gigante-navy mb-1">
                Datos para el Generador de Etiquetas (opcionales)
              </p>
              <p className="text-xs text-gigante-muted mb-2">
                Al llenar esto, cuando busquen este producto por su código en el Generador de
                Etiquetas, la etiqueta se llena sola con estos datos — y se puede seguir editando
                a mano ahí si algo cambia.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gigante-navy mb-1">Color</label>
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gigante-navy mb-1">Medida</label>
                  <input
                    value={medida}
                    onChange={(e) => setMedida(e.target.value)}
                    placeholder="Ej. 30x60"
                    className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gigante-navy mb-1">Tipo</label>
                  <input
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gigante-navy mb-1">Calidad</label>
                  <input
                    value={calidad}
                    onChange={(e) => setCalidad(e.target.value)}
                    placeholder="Ej. 1A"
                    className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gigante-navy mb-1">Medida de caja</label>
                  <input
                    value={medidaCaja}
                    onChange={(e) => setMedidaCaja(e.target.value)}
                    placeholder="Ej. 1.50 m²"
                    className="w-full rounded-lg border border-gigante-border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
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
