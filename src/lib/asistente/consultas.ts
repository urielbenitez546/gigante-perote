import { supabase } from "../supabaseClient";
import {
  PRODUCT_UNIT_LABELS,
  calcularSemaforo,
  diasRestantesApartado,
  DIAS_AVISO_APARTADO,
  SALE_STATUS_LABELS,
  type AppRole,
  type Product,
  type ProductUnit,
  type ResumenPedidos,
  type SaleStatus,
} from "../../types";

// ============================================================
// Consultas "en vivo" del Asistente
// ============================================================
// Detecta cuando la pregunta pide un DATO del sistema (existencias,
// precio, incidencias, pedidos, repartos, ventas del día, cobros...)
// y lo busca en la base de datos. Todo pasa por las reglas de acceso
// de Supabase (RLS): nadie ve datos que su puesto no puede ver.
// ============================================================

export interface RespuestaDato {
  titulo: string;
  texto: string;
  tabla?: { columnas: string[]; filas: string[][] };
  link?: { to: string; label: string };
  fuente: string;
}

const FUENTE = "Datos en vivo del sistema";

function n(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const fmt = (x: number) => Number(x ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });
const money = (x: number) =>
  `$${Number(x ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const unidad = (u: ProductUnit | string, cantidad = 2) => {
  const base = PRODUCT_UNIT_LABELS[u as ProductUnit] ?? String(u);
  return cantidad === 1 || base === "m²" ? base : `${base}s`;
};

function sinPermiso(): RespuestaDato {
  return {
    titulo: "Esa información es de otra área",
    texto: "Tu puesto no tiene acceso a ese dato en la página. Pregúntale a tu Gerente de sucursal.",
    fuente: FUENTE,
  };
}

// ------------------------------------------------------------ Productos
// Palabras que NO son parte del nombre del producto.
const PALABRAS_NO_PRODUCTO = new Set([
  "cuanto", "cuanta", "cuantos", "cuantas", "hay", "tenemos", "tienen", "queda", "quedan", "existencia", "existencias",
  "stock", "disponible", "disponibles", "inventario", "precio", "precios", "cuesta", "cuestan", "vale", "valen",
  "costo", "del", "de", "la", "el", "los", "las", "un", "una", "que", "me", "dices", "dime", "sabes", "producto",
  "productos", "caja", "cajas", "pieza", "piezas", "codigo", "clave", "en", "almacen", "bodega", "para", "por",
  "favor", "tienda", "sucursal", "y", "o", "al", "se", "es", "son", "mas", "todavia", "aun", "ahorita", "hoy",
  "cual", "como", "esta", "estan", "si", "no", "mi", "saber", "quiero", "necesito", "busca", "buscar", "info",
  "puedo", "tengo", "tiene", "dan", "dias", "dia", "vacaciones", "incidencias", "incidencia", "horario", "veces",
  "personas", "empleados", "sucursales", "anos", "ano", "metros", "m2", "cliente", "clientes", "nos", "le", "lo",
]);

function terminosProducto(pregunta: string): string[] {
  return n(pregunta)
    .replace(/[¿?¡!.,;:"']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !PALABRAS_NO_PRODUCTO.has(w));
}

/** Patrón tolerante a acentos para ilike: "bano" → "ba_o" encuentra "BAÑO". */
function patronIlike(t: string): string {
  const seguro = t.replace(/[^a-z0-9x*]/g, "");
  if (seguro.length >= 4) return seguro.replace(/[aeioun]/g, "_");
  return seguro;
}

export async function buscarProductos(terminos: string[]): Promise<Product[]> {
  const utiles = terminos.filter((t) => t.replace(/[^a-z0-9]/g, "").length >= 2).slice(0, 5);
  if (utiles.length === 0) return [];
  const filtros = utiles
    .flatMap((t) => {
      const p = patronIlike(t);
      const f = p ? [`name.ilike.*${p}*`, `code.ilike.*${p}*`] : [];
      // Un número puede ser el ID del sistema de la empresa (ej. 30243).
      if (/^\d{2,}$/.test(t)) f.push(`external_id.eq.${t}`);
      return f;
    })
    .join(",");
  if (!filtros) return [];
  const { data } = await supabase.from("products").select("*").or(filtros).eq("active", true).limit(300);
  const productos = (data as Product[]) ?? [];
  // Puntaje: cuántos términos aparecen de verdad (sin acentos) en código/nombre/marca.
  const conPuntaje = productos
    .map((p) => {
      const hay = n(`${p.external_id ?? ""} ${p.code} ${p.name} ${p.brand}`);
      const code = n(p.code);
      const idSistema = String(p.external_id ?? "");
      let puntaje = 0;
      for (const t of utiles) {
        if (code === t || idSistema === t) puntaje += 5;
        else if (hay.includes(t)) puntaje += 2;
      }
      return { p, puntaje };
    })
    .filter((x) => x.puntaje > 0);
  if (conPuntaje.length === 0) return [];
  const max = Math.max(...conPuntaje.map((x) => x.puntaje));
  // Debe coincidir al menos la mitad de lo que se escribió (o el código exacto),
  // para no confundir "¿con cuántas incidencias me dan de baja?" con una "TAZA BAJA".
  if (max < 5 && max < 2 * Math.ceil(utiles.length / 2)) return [];
  return conPuntaje
    .filter((x) => x.puntaje === max)
    .map((x) => x.p)
    .slice(0, 8);
}

const SEMAFORO_TXT = { verde: "🟢 hay suficiente", amarillo: "🟡 se está acabando", rojo: "🔴 sin existencia" };

function respuestaStock(productos: Product[], quierePrecio: boolean): RespuestaDato {
  if (productos.length === 1) {
    const p = productos[0];
    const disp = p.physical_stock - p.sold_pending;
    const estado = calcularSemaforo(p);
    const precioFinal = p.unit_price * (1 - (p.descuento_porcentaje ?? 0) / 100);
    const lineas = [
      `• Disponible para vender: ${fmt(Math.max(disp, 0))} ${unidad(p.unit, disp)} (${SEMAFORO_TXT[estado]})`,
      `• Existencia física en almacén: ${fmt(p.physical_stock)}`,
      `• Apartado para clientes: ${fmt(p.sold_pending)}`,
    ];
    if ((p.exhibition_stock ?? 0) > 0) lineas.push(`• En exhibición (tienda): ${fmt(p.exhibition_stock)}`);
    lineas.push(
      p.descuento_porcentaje > 0
        ? `• Precio: ${money(precioFinal)} por ${unidad(p.unit, 1)} (${p.descuento_porcentaje}% de descuento; lista ${money(p.unit_price)})`
        : `• Precio: ${money(p.unit_price)} por ${unidad(p.unit, 1)}`
    );
    if (p.last_counted_at) {
      const dias = Math.floor((Date.now() - new Date(p.last_counted_at).getTime()) / 86_400_000);
      lineas.push(`• Último conteo físico: hace ${dias} día(s)`);
    }
    if (estado === "amarillo") lineas.push("Quedan pocas: confirma con Almacén antes de prometer cantidades grandes.");
    if (estado === "rojo") lineas.push("No hay disponible: ofrece un producto parecido o consulta con Gerencia cuándo se surte.");
    return {
      titulo: `${quierePrecio ? "Precio y existencia" : "Existencia"} — ${p.external_id ? `ID ${p.external_id} · ` : ""}${p.code}`,
      texto: `${p.name} (${p.brand})\n${lineas.join("\n")}`,
      link: { to: `/producto/${p.id}`, label: "Ver ficha del producto" },
      fuente: FUENTE,
    };
  }
  return {
    titulo: `Encontré ${productos.length} productos`,
    texto: "Estos coinciden con lo que buscas. Si quieres el detalle de uno, pregúntame por su ID (ej. “¿cuánto hay de " +
      (productos[0].external_id ?? productos[0].code) + "?”).",
    tabla: {
      columnas: ["ID", "Código", "Producto", "Disponible", "Precio"],
      filas: productos.map((p) => {
        const disp = p.physical_stock - p.sold_pending;
        const e = calcularSemaforo(p);
        const dot = e === "verde" ? "🟢" : e === "amarillo" ? "🟡" : "🔴";
        const precio = p.unit_price * (1 - (p.descuento_porcentaje ?? 0) / 100);
        return [String(p.external_id ?? "—"), p.code, p.name, `${dot} ${fmt(Math.max(disp, 0))} ${unidad(p.unit, disp)}`, money(precio)];
      }),
    },
    link: { to: "/inventario", label: "Ir a Inventario" },
    fuente: FUENTE,
  };
}

async function seAcaban(): Promise<RespuestaDato> {
  // Traemos lo que tiene poco disponible; el semáforo exacto se calcula aquí.
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("physical_stock", { ascending: true })
    .limit(1000);
  const productos = ((data as Product[]) ?? []).filter((p) => calcularSemaforo(p) !== "verde");
  const rojos = productos.filter((p) => calcularSemaforo(p) === "rojo");
  const amarillos = productos.filter((p) => calcularSemaforo(p) === "amarillo");
  if (productos.length === 0) {
    return { titulo: "Nada se está acabando", texto: "🟢 Todos los productos están arriba de su mínimo.", fuente: FUENTE };
  }
  const lista = [...amarillos, ...rojos.filter((p) => p.sold_pending > 0 || p.physical_stock > 0), ...rojos]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 15);
  return {
    titulo: "Productos que se están acabando",
    texto:
      `🟡 ${amarillos.length} se están acabando · 🔴 ${rojos.length} ya sin existencia disponible.` +
      (lista.length < productos.length ? ` Te muestro los primeros ${lista.length}.` : "") +
      "\nSi alguno está de muestra en la tienda, conviene cambiar la exhibición.",
    tabla: {
      columnas: ["", "Código", "Producto", "Disponible"],
      filas: lista.map((p) => [
        calcularSemaforo(p) === "rojo" ? "🔴" : "🟡",
        p.code,
        p.name,
        `${fmt(Math.max(p.physical_stock - p.sold_pending, 0))} ${unidad(p.unit)}`,
      ]),
    },
    link: { to: "/inventario?semaforo=amarillo", label: "Ver en Inventario" },
    fuente: FUENTE,
  };
}

// ------------------------------------------------------------ Repartos e incidencias
interface DeliveryRow {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  amount_collected: number | null;
  payment_confirmed_at: string | null;
  sale: { folio: string; customer_name: string; customer_address: string | null } | null;
}

async function incidenciasReparto(): Promise<RespuestaDato> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, status, notes, created_at, sale:sales(folio, customer_name, customer_address)")
    .eq("status", "incidencia")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return sinPermiso();
  const rows = (data as unknown as DeliveryRow[]) ?? [];

  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: reportes } = await supabase
    .from("notifications")
    .select("title, message, created_at")
    .eq("type", "manual")
    .gte("created_at", hace7)
    .order("created_at", { ascending: false })
    .limit(5);
  const reps = (reportes as { title: string; message: string | null; created_at: string }[]) ?? [];

  let texto =
    rows.length === 0
      ? "✅ No hay repartos marcados con incidencia en este momento."
      : `⚠️ Hay ${rows.length} reparto(s) con incidencia abierta.`;
  if (reps.length > 0) {
    texto +=
      `\nReportes de problemas en los últimos 7 días (${reps.length}):\n` +
      reps
        .map((r) => `• ${r.title}: ${r.message ?? ""} (${new Date(r.created_at).toLocaleDateString("es-MX")})`)
        .join("\n");
  }
  return {
    titulo: "Incidencias de reparto",
    texto,
    tabla:
      rows.length > 0
        ? {
            columnas: ["Folio", "Cliente", "Qué pasó"],
            filas: rows.map((r) => [r.sale?.folio ?? "—", r.sale?.customer_name ?? "—", r.notes ?? "Sin detalle"]),
          }
        : undefined,
    link: { to: "/repartos", label: "Ir a Repartos" },
    fuente: FUENTE,
  };
}

async function repartosPendientes(): Promise<RespuestaDato> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, status, notes, created_at, sale:sales(folio, customer_name, customer_address)")
    .in("status", ["pendiente", "en_camino", "incidencia"])
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) return sinPermiso();
  const rows = (data as unknown as DeliveryRow[]) ?? [];
  const cuenta = (s: string) => rows.filter((r) => r.status === s).length;
  const ESTADO: Record<string, string> = { pendiente: "Pendiente", en_camino: "🚚 En camino", incidencia: "⚠️ Incidencia" };
  return {
    titulo: "Repartos por entregar",
    texto:
      rows.length === 0
        ? "✅ No hay repartos pendientes."
        : `${cuenta("pendiente")} pendiente(s) · ${cuenta("en_camino")} en camino · ${cuenta("incidencia")} con incidencia.`,
    tabla:
      rows.length > 0
        ? {
            columnas: ["Folio", "Cliente", "Dirección", "Estado"],
            filas: rows.map((r) => [
              r.sale?.folio ?? "—",
              r.sale?.customer_name ?? "—",
              r.sale?.customer_address ?? "—",
              ESTADO[r.status] ?? r.status,
            ]),
          }
        : undefined,
    link: { to: "/repartos", label: "Ir a Repartos" },
    fuente: FUENTE,
  };
}

// ------------------------------------------------------------ Pedidos y apartados
interface SaleRow {
  id: string;
  folio: string;
  customer_name: string;
  customer_phone: string | null;
  status: SaleStatus;
  total: number;
  amount_paid: number;
  created_at: string;
  scheduled_pickup_date: string | null;
  sale_items: {
    quantity: number;
    delivered_quantity: number;
    delivery_type: string | null;
    product: { code: string; name: string; unit: ProductUnit } | null;
  }[];
}

async function ventasAbiertas(): Promise<SaleRow[] | null> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, folio, customer_name, customer_phone, status, total, amount_paid, created_at, scheduled_pickup_date, sale_items(quantity, delivered_quantity, delivery_type, product:products(code, name, unit))")
    .in("status", ["pendiente", "parcial"])
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return null;
  return ((data as unknown as SaleRow[]) ?? []).filter((s) => s.sale_items.some((i) => i.delivered_quantity < i.quantity));
}

async function apartados(tipo: "vencidos" | "por_vencer" | "ambos"): Promise<RespuestaDato> {
  const ventas = await ventasAbiertas();
  if (!ventas) return sinPermiso();
  const conDias = ventas.map((s) => ({ s, d: diasRestantesApartado(s.created_at) }));
  const vencidos = conDias.filter((x) => x.d < 0);
  const porVencer = conDias.filter((x) => x.d >= 0 && x.d <= DIAS_AVISO_APARTADO);
  const lista = tipo === "vencidos" ? vencidos : tipo === "por_vencer" ? porVencer : [...vencidos, ...porVencer];
  return {
    titulo: tipo === "por_vencer" ? "Apartados por vencer" : tipo === "vencidos" ? "Apartados vencidos" : "Apartados vencidos y por vencer",
    texto:
      `⏰ ${vencidos.length} vencido(s) · ⏳ ${porVencer.length} por vencer (5 días o menos). El plazo es de 1 mes desde la compra.` +
      (lista.length === 0 ? "\n✅ No hay ninguno en esta lista." : ""),
    tabla:
      lista.length > 0
        ? {
            columnas: ["Folio", "Cliente", "Teléfono", "Plazo"],
            filas: lista.map(({ s, d }) => [
              s.folio,
              s.customer_name,
              s.customer_phone ?? "—",
              d < 0 ? `Venció hace ${-d} d` : d === 0 ? "Vence hoy" : `Quedan ${d} d`,
            ]),
          }
        : undefined,
    link: { to: "/pedidos", label: "Ir a Pedidos Pendientes" },
    fuente: FUENTE,
  };
}

async function resumenPedidos(): Promise<RespuestaDato> {
  const { data, error } = await supabase.rpc("resumen_pedidos");
  if (error || !data) return sinPermiso();
  const r = data as ResumenPedidos;
  const avance = r.monto_apartado > 0 ? Math.round((r.monto_entregado / r.monto_apartado) * 100) : 0;
  return {
    titulo: "Pedidos pendientes",
    texto:
      `• Pedidos abiertos: ${r.ventas_pendientes + r.ventas_parciales} (${r.ventas_pendientes} sin entregar, ${r.ventas_parciales} a medias)\n` +
      `• Falta por entregar: ${money(r.monto_por_entregar)} en material (${r.por_tipo.retiro_sucursal} por recoger en sucursal, ${r.por_tipo.domicilio} a domicilio)\n` +
      `• Ya entregado de esos pedidos: ${money(r.monto_entregado)} (${avance}%)\n` +
      `• Entregados completos este mes: ${r.ventas_entregadas_mes}`,
    tabla:
      r.productos.length > 0
        ? {
            columnas: ["Producto", "Falta entregar", "En almacén"],
            filas: r.productos.slice(0, 8).map((p) => [
              `${p.code} — ${p.name}`,
              `${fmt(p.por_entregar)} ${unidad(p.unit)}`,
              p.fisico < p.por_entregar ? `⚠️ ${fmt(p.fisico)}` : fmt(p.fisico),
            ]),
          }
        : undefined,
    link: { to: "/pedidos", label: "Ir a Pedidos Pendientes" },
    fuente: FUENTE,
  };
}

async function folio(num: string): Promise<RespuestaDato> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, folio, customer_name, customer_phone, status, total, amount_paid, created_at, scheduled_pickup_date, sale_items(quantity, delivered_quantity, delivery_type, product:products(code, name, unit))")
    .eq("folio", `V-${num}`)
    .maybeSingle();
  if (error) return sinPermiso();
  const s = data as unknown as SaleRow | null;
  if (!s) return { titulo: `Folio V-${num}`, texto: `No encontré la venta V-${num}. Revisa el número.`, fuente: FUENTE };
  const pendiente = s.sale_items.some((i) => i.delivered_quantity < i.quantity);
  const d = diasRestantesApartado(s.created_at);
  const faltaCobrar = Math.max(s.total - s.amount_paid, 0);
  return {
    titulo: `Venta ${s.folio} — ${s.customer_name}`,
    texto:
      `• Estado: ${SALE_STATUS_LABELS[s.status]}\n` +
      `• Total: ${money(s.total)} · Pagado en caja: ${money(s.amount_paid)}${faltaCobrar > 0 ? ` · Falta cobrar: ${money(faltaCobrar)}` : ""}\n` +
      `• Fecha: ${new Date(s.created_at).toLocaleDateString("es-MX")}` +
      (pendiente ? `\n• Apartado: ${d < 0 ? `venció hace ${-d} día(s)` : `le quedan ${d} día(s)`}` : ""),
    tabla: {
      columnas: ["Producto", "Vendido", "Entregado", "Falta"],
      filas: s.sale_items.map((i) => [
        i.product ? `${i.product.code} — ${i.product.name}` : "—",
        fmt(i.quantity),
        fmt(i.delivered_quantity),
        fmt(i.quantity - i.delivered_quantity),
      ]),
    },
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FUENTE,
  };
}

async function ventasDeHoy(): Promise<RespuestaDato> {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const { data, error } = await supabase
    .from("sales")
    .select("folio, customer_name, total, amount_paid, status")
    .gte("created_at", inicio)
    .order("created_at", { ascending: false });
  if (error) return sinPermiso();
  const rows = (data as { folio: string; customer_name: string; total: number; amount_paid: number; status: SaleStatus }[]) ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const cobrado = rows.reduce((s, r) => s + Number(r.amount_paid), 0);
  return {
    titulo: "Ventas de hoy",
    texto: `• ${rows.length} venta(s) por ${money(total)}\n• Cobrado en caja: ${money(cobrado)}${total - cobrado > 0.009 ? ` · Falta cobrar: ${money(total - cobrado)}` : ""}`,
    tabla:
      rows.length > 0
        ? { columnas: ["Folio", "Cliente", "Total", "Pagado"], filas: rows.slice(0, 15).map((r) => [r.folio, r.customer_name, money(r.total), money(r.amount_paid)]) }
        : undefined,
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FUENTE,
  };
}

async function cobrosPendientes(): Promise<RespuestaDato> {
  const [{ data: rep, error: e1 }, ventas] = await Promise.all([
    supabase
      .from("deliveries")
      .select("id, status, amount_collected, payment_confirmed_at, delivered_at, sale:sales(folio, customer_name)")
      .eq("status", "entregado")
      .is("payment_confirmed_at", null)
      .limit(50),
    supabase.from("sales").select("folio, customer_name, total, amount_paid, status").neq("status", "cancelada").limit(500),
  ]);
  if (e1) return sinPermiso();
  const repartos = (rep as unknown as (DeliveryRow & { amount_collected: number | null })[]) ?? [];
  const porCobrar = ((ventas.data as { folio: string; customer_name: string; total: number; amount_paid: number }[]) ?? []).filter(
    (s) => Number(s.total) - Number(s.amount_paid) > 0.009
  );
  const saldo = porCobrar.reduce((s, v) => s + Number(v.total) - Number(v.amount_paid), 0);
  return {
    titulo: "Cobros pendientes",
    texto:
      `• Repartos entregados cuyo cobro Caja no ha confirmado: ${repartos.length}` +
      (repartos.length > 0
        ? ` (${money(repartos.reduce((s, r) => s + Number(r.amount_collected ?? 0), 0))} que trae el chofer)`
        : "") +
      `\n• Ventas con saldo por cobrar: ${porCobrar.length} por ${money(saldo)}`,
    tabla:
      repartos.length > 0
        ? {
            columnas: ["Folio", "Cliente", "Cobró el chofer"],
            filas: repartos.map((r) => [r.sale?.folio ?? "—", r.sale?.customer_name ?? "—", money(r.amount_collected ?? 0)]),
          }
        : undefined,
    link: { to: "/evidencias-cobros", label: "Ir a Evidencias y Cobros" },
    fuente: FUENTE,
  };
}

async function confiabilidad(): Promise<RespuestaDato> {
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("inventory_counts")
    .select("diferencia, product:products(code, name)")
    .gte("created_at", hace30)
    .limit(1000);
  if (error) return sinPermiso();
  const rows = (data as unknown as { diferencia: number; product: { code: string; name: string } | null }[]) ?? [];
  const cuadran = rows.filter((r) => Number(r.diferencia) === 0).length;
  const pct = rows.length > 0 ? Math.round((cuadran / rows.length) * 100) : null;
  const peores = rows
    .filter((r) => Number(r.diferencia) !== 0)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    .slice(0, 8);
  return {
    titulo: "Conteos de inventario (últimos 30 días)",
    texto:
      rows.length === 0
        ? "Todavía no hay conteos físicos en los últimos 30 días. Empiecen con la lista “Sugeridos para contar hoy”."
        : `• ${rows.length} conteo(s); ${cuadran} cuadraron.\n• Confiabilidad: ${pct}% (meta: 90% o más).`,
    tabla:
      peores.length > 0
        ? {
            columnas: ["Producto", "Diferencia"],
            filas: peores.map((r) => [r.product ? `${r.product.code} — ${r.product.name}` : "—", Number(r.diferencia) > 0 ? `+${fmt(r.diferencia)}` : fmt(r.diferencia)]),
          }
        : undefined,
    link: { to: "/inventario?tab=conteos", label: "Ir a Conteos" },
    fuente: FUENTE,
  };
}

// ------------------------------------------------------------ Respuestas calculadas (sin base de datos)
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const CAMISA: Record<string, string> = {
  lunes: "camisa gris",
  martes: "camisa vino",
  miercoles: "camisa azul",
  jueves: "camisa azul marino",
  viernes: "camisa azul de rayas (Ventas: mezclilla o vestir autorizado)",
  sabado: "playera tipo polo con logo de la empresa (se permiten tenis)",
};

function camisaDelDia(texto: string, role: AppRole): RespuestaDato {
  let dia = DIAS.find((d) => texto.includes(d));
  let cuando = dia ? `el ${dia}` : "hoy";
  if (!dia) {
    const f = new Date();
    if (texto.includes("manana")) {
      f.setDate(f.getDate() + 1);
      cuando = "mañana";
    }
    dia = DIAS[f.getDay()];
  }
  const diaBonito = dia.replace("miercoles", "miércoles").replace("sabado", "sábado");
  if (role === "almacen" || role === "reparto") {
    return {
      titulo: "Uniforme de Almacén",
      texto:
        "El personal de Almacén usa el uniforme que da la empresa: playera polo (roja, gris, azul, azul marino o negra), botas de trabajo, faja y guantes. La gorra está permitida.\nEl calendario de camisas por día aplica a Ventas, Caja y Gerencia.",
      fuente: "Manual de Bienvenida e Inducción, 7.2",
    };
  }
  if (dia === "domingo") {
    return { titulo: "Código de vestimenta", texto: `${cuando[0].toUpperCase()}${cuando.slice(1)} es domingo: el manual no marca uniforme para ese día.`, fuente: "Manual de Bienvenida e Inducción, 7.2" };
  }
  return {
    titulo: `¿Qué me pongo ${cuando}? (${diaBonito})`,
    texto:
      `👕 ${CAMISA[dia][0].toUpperCase()}${CAMISA[dia].slice(1)}.` +
      (dia !== "sabado" ? "\n👞 Zapato oscuro estilo casual." : ""),
    fuente: "Manual de Bienvenida e Inducción, 7.2",
  };
}

const TABLA_VACACIONES: [number, number, number][] = [
  [1, 1, 12], [2, 2, 14], [3, 3, 16], [4, 4, 18], [5, 5, 20], [6, 10, 22], [11, 15, 24], [16, 20, 26], [21, 25, 28],
];

function vacacionesPorAnios(anios: number): RespuestaDato {
  const fila = TABLA_VACACIONES.find(([a, b]) => anios >= a && anios <= b);
  const texto =
    anios < 1
      ? "Con menos de 1 año todavía no se cumple el primer periodo. Si tienes de 3 a 12 meses, puedes pedir hasta 3 permisos a cuenta de vacaciones."
      : fila
      ? `Con ${anios} año(s) de servicio te corresponden ${fila[2]} días de vacaciones.\nRecuerda: no son acumulables y puedes tomar máximo 6 días seguidos.`
      : `La tabla del manual llega hasta 25 años (28 días). Para ${anios} años consúltalo con tu Gerente.`;
  return { titulo: "Tus días de vacaciones", texto, fuente: "Manual de Bienvenida e Inducción, 7.3" };
}

// ------------------------------------------------------------ Detector de intención
const PUEDE_VER_VENTAS: AppRole[] = ["gerencia", "ventas", "caja", "almacen"];

/**
 * Si la pregunta pide un dato del sistema, lo busca y regresa la
 * respuesta. Si no aplica (o no encontró el producto), regresa null y
 * el asistente busca en las preguntas predeterminadas.
 */
export async function responderConDatos(pregunta: string, role: AppRole): Promise<RespuestaDato | null> {
  const t = n(pregunta);
  const esDefinicion = /\b(que (es|significa|son)|significado|para que sirve)\b/.test(t);

  // 1) Folio de venta: "V-1001", "folio 1001"
  const mFolio = t.match(/\bv\s?-?\s?(\d{3,})\b/) ?? t.match(/\bfolio\s*#?\s*(\d{3,})\b/);
  if (mFolio) return PUEDE_VER_VENTAS.includes(role) ? folio(mFolio[1]) : sinPermiso();

  // 2) Camisa / uniforme del día
  if (/(camisa|uniforme|vestimenta|me pongo|me visto|ropa|playera)/.test(t) && /(hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|toca)/.test(t)) {
    return camisaDelDia(t, role);
  }

  // 3) Vacaciones con N años
  const mAnios = t.match(/(\d{1,2})\s*(anos?|ano)\b/);
  if (/vacacion/.test(t) && mAnios) return vacacionesPorAnios(Number(mAnios[1]));

  if (esDefinicion) return null;

  // 4) Incidencias de reparto / reportes (no las del personal)
  const incidenciaPersonal = /(baja|vigen|motivo|levant|acta|me dan|me pueden|corren|despid|puedo tener|formato)/.test(t);
  if (/incidencia|problemas? reportad|reportes/.test(t) && !incidenciaPersonal && /(reparto|entrega|abierta|activa|hay|pendiente|hoy|ultima|reportad|reportes|cuales)/.test(t)) {
    return incidenciasReparto();
  }

  // 5) Apartados vencidos / por vencer
  if (/vencid|por vencer|vence|apartad/.test(t) && !/(cuanto tiempo|plazo|como funciona)/.test(t)) {
    if (!PUEDE_VER_VENTAS.includes(role)) return sinPermiso();
    const tipo = /vencid/.test(t) && !/por vencer/.test(t) ? "vencidos" : /por vencer|vence/.test(t) ? "por_vencer" : "ambos";
    return apartados(tipo);
  }

  // 6) Repartos pendientes / en camino
  if (/(reparto|entregas?\b|ruta)/.test(t) && /(pendiente|hoy|en camino|programad|faltan|hay|tengo|salen|cuales)/.test(t) && !/(como|que hago)/.test(t)) {
    return repartosPendientes();
  }

  // 7) Resumen de pedidos pendientes / por entregar
  if (/(pedidos? (pendientes|abiertos)|por entregar|falta (por )?entregar|pendiente de entregar|cuanto material falta)/.test(t)) {
    return PUEDE_VER_VENTAS.includes(role) ? resumenPedidos() : sinPermiso();
  }

  // 8) Ventas de hoy
  if (/(ventas? (de )?hoy|cuanto (se )?(ha )?vend|vendimos|llevamos vendido)/.test(t)) {
    return role === "gerencia" || role === "ventas" || role === "caja" ? ventasDeHoy() : sinPermiso();
  }

  // 9) Cobros pendientes
  if (/(cobros? pendientes?|por cobrar|falta(n)? (de )?cobrar|saldos? pendientes?)/.test(t)) {
    return role === "gerencia" || role === "caja" ? cobrosPendientes() : sinPermiso();
  }

  // 10) Confiabilidad / conteos
  if (/(confiabilidad|descuadre|conteos?)/.test(t) && /(como vamos|cuanto|cual|resumen|ultimos|van|estamos|hay)/.test(t) && !/(como hago|como se hace)/.test(t)) {
    return role === "gerencia" || role === "almacen" ? confiabilidad() : sinPermiso();
  }

  // 11) Qué se está acabando
  if (/(se (esta|estan)? ?acab|agotad|por acabar|bajo stock|poco stock|en rojo|en amarillo|sin existencia|falta surtir|resurtir)/.test(t)) {
    return seAcaban();
  }

  // 12) Stock o precio de un producto
  const quierePrecio = /(precio|cuesta|cuestan|vale|valen|costo)/.test(t);
  const quiereStock = /(cuant[oa]s?|hay|existencia|stock|disponible|quedan?|tenemos|inventario de)/.test(t);
  if (quierePrecio || quiereStock) {
    const terminos = terminosProducto(pregunta);
    if (terminos.length > 0) {
      const productos = await buscarProductos(terminos);
      if (productos.length > 0) return respuestaStock(productos, quierePrecio);
    }
  }

  return null;
}
