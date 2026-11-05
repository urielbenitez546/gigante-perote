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

/** Motivos para cambiar el precio de una línea de venta (los mismos que usa SIGAM). */
export const MOTIVOS_CAMBIO_PRECIO = [
  "ALZA",
  "CLIENTE FRECUENTE",
  "SUBDISTRIBUIDOR",
  "POQUITERO",
  "PROMOCION",
  "MATERIAL DE EXHIBICION",
  "AUTORIZACION ESPECIAL",
  "MATERIAL DAÑADO/ INCOMPLETO",
  "COMPETENCIA",
  "CONVENIO",
  "DESCUENTO A COLABORADOR",
  "MARCA DE SALIDA",
  "MARMOLES DE POZA RICA",
  "VENTA POR VOLUMEN",
  "OBSOLETOS",
  "DESCONTINUADO",
  "OUTLET",
  "MAYOREO",
] as const;
