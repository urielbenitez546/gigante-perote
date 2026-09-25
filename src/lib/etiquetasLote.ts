import { productoId, type Product } from "../types";

// ============================================================
// Manda un lote de productos al Generador de Etiquetas.
// Se guarda la lista en el navegador y se abre /etiquetas?lote=<clave>&tam=<tamaño>;
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

// ------------------------------------------------------------
// Tamaño de etiqueta según el tipo de producto
// ------------------------------------------------------------
export type TamanoEtiqueta = "carta" | "media" | "cuarto" | "octavo";

export const TAMANOS: TamanoEtiqueta[] = ["carta", "media", "cuarto", "octavo"];

export const TAMANO_LABELS: Record<TamanoEtiqueta, string> = {
  carta: "Carta",
  media: "Media carta",
  cuarto: "1/4 de carta",
  octavo: "1/8 de carta",
};

export const TAMANO_USO: Record<TamanoEtiqueta, string> = {
  carta: "Tinacos, cisternas, calentadores",
  media: "Pisos, azulejos, porcelanatos",
  cuarto: "Lavabos, WC, cuadros, cosas de caja mediana",
  octavo: "Cenefas, llaves, mangueras, cosas chicas",
};

const sinAcentos = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Se revisan en este orden; la primera regla que coincide gana.
const REGLAS: { tamano: TamanoEtiqueta; palabras: RegExp }[] = [
  // Cosas chicas primero, para que "llave para tinaco" quede en 1/8.
  {
    tamano: "octavo",
    palabras:
      /\b(cenefas?|listel(es)?|llaves?|mezcladora?s?|mangueras?|valvulas?|conectores?|coples?|codos?|tees?|niples?|flotador(es)?|cespol(es)?|contracanastas?|rejillas?|coladeras?|tornillos?|taquetes?|pijas?|silicon(es)?|selladores?|cintas?|teflon|herrajes?|accesorios?|jaboneras?|toalleros?|portarrollos?|ganchos?|perillas?|chapetones?|empaques?|abrazaderas?|brocas?|crucetas?|separadores?|esquineros?|remates?|zoclos?|tapones?|regaderas? de mano)\b/,
  },
  { tamano: "carta", palabras: /\b(tinacos?|cisternas?|calentador(es)?|boiler(s)?|biodigestor(es)?|tanques? de agua|hidroneumatico)\b/ },
  {
    tamano: "cuarto",
    palabras:
      /\b(lavabos?|ovalin(es)?|wc|sanitarios?|inodoros?|tazas?|mingitorios?|cuadros?|espejos?|gabinetes?|muebles?|tarjas?|fregaderos?|regaderas?|columnas?|pegazulejos?|pegapiso|adhesivos?|boquillas?|cementos?|morteros?|impermeabilizantes?|lavaderos?|botiquin(es)?)\b/,
  },
  {
    tamano: "media",
    palabras:
      /\b(pisos?|azulejos?|porcelanatos?|porcelanicos?|losetas?|ceramicas?|marmol(es)?|granitos?|travertinos?|cantera|madera|laminados?|vinilicos?|spc|decks?|fachaletas?|mosaicos?|recubrimientos?)\b/,
  },
];

/** Tamaño automático según categoría, nombre y tipo del producto. */
export function tamanoAutomatico(p: Pick<Product, "name" | "category" | "tipo">): TamanoEtiqueta {
  // Primero el nombre (es lo más preciso) y luego la categoría, por si la
  // categoría es muy general (ej. un lavabo dado de alta en "Accesorios").
  const nombre = sinAcentos(`${p.name ?? ""} ${p.tipo ?? ""}`);
  for (const r of REGLAS) if (r.palabras.test(nombre)) return r.tamano;
  const categoria = sinAcentos(p.category ?? "");
  for (const r of REGLAS) if (r.palabras.test(categoria)) return r.tamano;
  const texto = `${categoria} ${nombre}`;
  // Medidas tipo 60x60, 30x60: casi siempre es piso o azulejo.
  const m = texto.match(/\b(\d{2,3})\s*[x×]\s*(\d{2,3})\b/);
  if (m && Number(m[1]) >= 20 && Number(m[2]) >= 20) return "media";
  return "cuarto";
}

/** El tamaño que se usa: el fijado a mano, o si no el automático. */
export function tamanoEtiqueta(p: Product): TamanoEtiqueta {
  return p.tamano_etiqueta ?? tamanoAutomatico(p);
}

/** Agrupa productos por tamaño de etiqueta, en orden carta → 1/8. */
export function agruparPorTamano<T>(items: T[], producto: (item: T) => Product | null | undefined) {
  const grupos = new Map<TamanoEtiqueta, T[]>();
  for (const it of items) {
    const p = producto(it);
    if (!p) continue;
    const t = tamanoEtiqueta(p);
    grupos.set(t, [...(grupos.get(t) ?? []), it]);
  }
  return TAMANOS.filter((t) => grupos.has(t)).map((t) => ({ tamano: t, items: grupos.get(t)! }));
}

/** Guarda el lote y regresa la ruta a abrir. */
export function prepararLote(productos: Product[], tamano?: TamanoEtiqueta): string {
  const clave = `lote-etiquetas-${Date.now()}`;
  try {
    localStorage.setItem(clave, JSON.stringify(productos.map(etiquetaDesdeProducto)));
  } catch {
    /* sin espacio en el navegador: el generador avisará que no encontró el lote */
  }
  return `/etiquetas?lote=${clave}${tamano ? `&tam=${tamano}` : ""}`;
}
