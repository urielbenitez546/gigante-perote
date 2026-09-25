import { productoId, type Product } from "../types";

// ============================================================
// Manda un lote de productos al Generador de Etiquetas.
// Se guarda la lista en el navegador y se abre /etiquetas?lote=<clave>;
// el generador la lee y arma todas las etiquetas de un jalón.
// ============================================================

const UNIDAD: Record<string, string> = {
  caja: "Por caja",
  pieza: "Por pieza",
  bolsa: "Por bolsa",
  rollo: "Por rollo",
  m2: "Por m²",
};

export interface EtiquetaLote {
  productId: string;
  nombre: string;
  id: string;
  marca: string;
  precio: string;
  precioAntes: string;
  descuento: number;
  unidadPrecio: string;
  headerColor: "red" | "navy";
  color: string;
  medida: string;
  tipo: string;
  calidad: string;
  medidaCaja: string;
  cantidad: number;
}

export function etiquetaDesdeProducto(p: Product): EtiquetaLote {
  const desc = Number(p.descuento_porcentaje ?? 0);
  const final = p.unit_price * (1 - desc / 100);
  return {
    productId: p.id,
    nombre: p.name,
    id: productoId(p) || p.code,
    marca: p.brand || "PORCELANITE",
    precio: final.toFixed(2),
    precioAntes: desc > 0 ? Number(p.unit_price).toFixed(2) : "",
    descuento: desc,
    unidadPrecio: UNIDAD[p.unit] ?? "",
    headerColor: desc > 0 ? "red" : "navy",
    color: p.color ?? "",
    medida: p.medida ?? "",
    tipo: p.tipo ?? "",
    calidad: p.calidad ?? "",
    medidaCaja: p.medida_caja ?? "",
    cantidad: 1,
  };
}

/** Guarda el lote y regresa la ruta a abrir. */
export function prepararLote(productos: Product[]): string {
  const clave = `lote-etiquetas-${Date.now()}`;
  try {
    localStorage.setItem(clave, JSON.stringify(productos.map(etiquetaDesdeProducto)));
  } catch {
    /* sin espacio en el navegador: el generador avisará que no encontró el lote */
  }
  return `/etiquetas?lote=${clave}`;
}
