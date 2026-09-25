import * as XLSX from "xlsx";

// ============================================================
// Lector de Excel (.xlsx, .xls, .csv) para la actualización de
// rotación y precios. Detecta solo las columnas por su encabezado.
// ============================================================

export interface HojaLeida {
  encabezados: string[];
  filas: string[][];
}

function norm(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Lee la primera hoja y encuentra la fila de encabezados (la primera que dice "id"). */
export async function leerExcel(file: File): Promise<HojaLeida> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: false, defval: "" }) as unknown[][];
  const texto = matriz.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
  let idxEnc = texto.findIndex((r) => r.some((c) => /^(id|clave|sku)\b/.test(norm(c))));
  if (idxEnc < 0) idxEnc = 0;
  const encabezados = texto[idxEnc] ?? [];
  const filas = texto.slice(idxEnc + 1).filter((r) => r.some((c) => c !== ""));
  return { encabezados, filas };
}

export type CampoExcel = "id" | "rotacion" | "precio" | "descuento" | "sucursal";

/** Adivina qué columna es cada campo; -1 si no la encuentra. */
export function detectarColumnas(encabezados: string[]): Record<CampoExcel, number> {
  const h = encabezados.map(norm);
  const buscar = (re: RegExp, evitar?: RegExp) => h.findIndex((x) => re.test(x) && !(evitar && evitar.test(x)));
  return {
    id: buscar(/^id$|^id\b|^clave$|^sku$/),
    rotacion: buscar(/rotaci|clasific|movimiento|tipo de venta|abc|velocidad|lento|rapido/),
    precio: buscar(/precio|p\.? ?venta|p\.? ?publico|importe/, /desc|anterior|antes|costo/),
    descuento: buscar(/descuento|^desc\b|desc\.|%|porcentaje|rebaja/, /descrip/),
    sucursal: buscar(/sucursal|tienda|plaza|almacen|bodega|punto de venta/),
  };
}
