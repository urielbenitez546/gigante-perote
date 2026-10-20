import { precioPublico, type Product, type TipoPrecio } from "../types";

/** Precio final de un producto según el tipo de precio elegido (igual que calculan
 * register_sale y crear_cotizacion en el servidor, para que el total mostrado
 * aquí coincida con lo que de verdad se va a cobrar). */
export function precioSegunTipo(p: Product, tipo: TipoPrecio): number {
  if (tipo === "promocion") {
    if (p.precio_lista != null) return Math.round(Number(p.unit_price) * 100) / 100;
    return Math.round(p.unit_price * (1 - (p.descuento_porcentaje ?? 0) / 100) * 100) / 100;
  }
  return precioPublico(p);
}
