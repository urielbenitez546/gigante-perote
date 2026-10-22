import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Product, InventoryMovement, DisplayMovement, InventoryCount, DisplayRequest } from "../types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setProducts((data as Product[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { products, loading, error, reload };
}

export function useInventoryMovements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("inventory_movements")
      .select("*, product:products(code, name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setMovements((data as unknown as InventoryMovement[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { movements, loading, error, reload };
}

/** Registra una entrada de mercancía (llama a la función atómica de Supabase). */
export async function registerInventoryEntry(
  productId: string,
  quantity: number,
  reference: string
) {
  const { error } = await supabase.rpc("register_inventory_entry", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reference: reference || null,
  });
  return { error: error?.message ?? null };
}

/** Registra una salida MANUAL de almacén (muestra, traspaso, corrección...).
 * Las salidas por venta, merma o exhibición ya se registran solas; esta es
 * para todo lo demás, parte del Kardex digital. */
export async function registerInventorySalida(
  productId: string,
  quantity: number,
  reference: string
) {
  const { error } = await supabase.rpc("register_inventory_salida", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reference: reference || null,
  });
  return { error: error?.message ?? null };
}

/** Id del último renglón (entrada o salida) que esta persona registró de un producto:
 * sirve para colgarle la foto de apoyo justo después de guardarlo. */
export async function ultimoMovimientoPropio(productId: string, tipo: "entrada" | "salida", userId: string, desde?: string) {
  let q = supabase
    .from("inventory_movements")
    .select("id")
    .eq("product_id", productId)
    .eq("type", tipo)
    .or(`created_by.eq.${userId},created_by.is.null`)
    .order("created_at", { ascending: false })
    .limit(1);
  // Solo renglones creados desde que se tocó "Guardar" (con un margen por diferencia de relojes).
  if (desde) q = q.gte("created_at", new Date(new Date(desde).getTime() - 60_000).toISOString());
  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;
  return data[0].id as string;
}

/** Cuelga una foto (ya subida a "kardex-soporte") a un renglón del Kardex. Solo si no tenía. */
export async function adjuntarFotoKardex(movementId: string, path: string) {
  const { error } = await supabase.rpc("kardex_adjuntar_foto", { p_movement_id: movementId, p_path: path });
  return { error: error?.message ?? null };
}

/** Guarda la foto del producto (ya subida a "productos-fotos"). soloSiNoTiene: no pisa una foto existente. */
export async function guardarFotoProducto(productId: string, path: string, soloSiNoTiene = false) {
  const { error } = await supabase.rpc("producto_guardar_foto", {
    p_product_id: productId,
    p_path: path,
    p_solo_si_no_tiene: soloSiNoTiene,
  });
  return { error: error?.message ?? null };
}

/** Mensaje claro cuando falla una foto por permisos. */
export function errorFotoAmigable(msg: string): string {
  if (/row-level security|policy|permission|not allowed|violates/i.test(msg)) {
    return "Tu usuario aún no tiene activado el permiso para subir fotos. Avisa a Gerencia (falta correr el SQL de fotos en Supabase).";
  }
  if (/bucket.*not found|Bucket not found/i.test(msg)) {
    return "Falta crear el espacio de fotos en Supabase. Avisa a Gerencia (SQL 0034).";
  }
  return msg;
}

/** Anula un renglón del Kardex (queda tachado con el motivo). Jefe de almacén y Gerencia. */
export async function anularMovimientoKardex(movementId: string, motivo: string) {
  const { error } = await supabase.rpc("anular_movimiento_kardex", {
    p_movement_id: movementId,
    p_motivo: motivo,
  });
  return { error: error?.message ?? null };
}

/** Línea de tiempo del Kardex de UN producto: junta sus movimientos
 * (entradas/salidas/ajustes/merma/exhibición) y sus conteos físicos en
 * un solo historial, más reciente primero. Es lo que se ve al escanear
 * el código QR de la etiqueta amarilla del producto. */
export interface KardexEntry {
  id: string;
  fecha: string;
  tipo: "movimiento" | "conteo";
  detalle: string;
  cantidad: number | null;
  signo: 1 | -1 | 0;
  /** Cuánto cambió la existencia física con este renglón (+ entra, − sale). */
  delta: number;
  referencia: string | null;
  created_by: string | null;
  /** Id real del movimiento (para anularlo); null en los conteos. */
  movId: string | null;
  /** Tipo original del movimiento (entrada, salida...). */
  tipoMov: string | null;
  /** Si el renglón fue anulado: quién, cuándo y por qué. */
  anulado: { fecha: string; por: string | null; motivo: string } | null;
  /** Foto de apoyo (ruta en el bucket privado "kardex-soporte"); solo entradas y salidas. */
  fotoPath: string | null;
  /** Sucursal a la que se trasladó (si el renglón es un traslado). */
  destino: string | null;
}

export function useProductKardex(productId: string | null) {
  const [entries, setEntries] = useState<KardexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!productId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [movRes, countRes] = await Promise.all([
      supabase
        .from("inventory_movements")
        .select("id, type, quantity, reference, created_by, created_at, anulado_at, anulado_por, anulado_motivo, foto_path, destino")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("inventory_counts")
        .select("id, sistema, contado, diferencia, notas, created_by, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (movRes.error) {
      setError(movRes.error.message);
      setLoading(false);
      return;
    }
    if (countRes.error) {
      setError(countRes.error.message);
      setLoading(false);
      return;
    }
    setError(null);

    // Los movimientos tipo "conteo" se omiten: el conteo ya viene completo
    // (sistema / contado / diferencia) desde inventory_counts y saldría doble.
    const movs: KardexEntry[] = (movRes.data ?? [])
      .filter((m) => (m.type as string) !== "conteo")
      .map((m) => {
        const signo = MOVEMENT_KARDEX_SIGNO[m.type as string] ?? 0;
        const anulado = m.anulado_at
          ? { fecha: m.anulado_at as string, por: (m.anulado_por as string | null) ?? null, motivo: (m.anulado_motivo as string | null) ?? "" }
          : null;
        return {
          id: `mov-${m.id}`,
          fecha: m.created_at,
          tipo: "movimiento" as const,
          detalle: m.destino
            ? `Traslado a ${m.destino as string}`
            : MOVEMENT_KARDEX_LABELS[m.type as string] ?? (m.type as string),
          cantidad: m.quantity as number,
          signo,
          // Un renglón anulado ya no mueve la existencia (la anulación la corrigió).
          delta: anulado ? 0 : signo * Number(m.quantity),
          referencia: m.reference as string | null,
          created_by: m.created_by as string | null,
          movId: m.id as string,
          tipoMov: m.type as string,
          anulado,
          fotoPath: (m.foto_path as string | null) ?? null,
          destino: (m.destino as string | null) ?? null,
        };
      });

    const counts: KardexEntry[] = (countRes.data ?? []).map((c) => ({
      id: `conteo-${c.id}`,
      fecha: c.created_at,
      tipo: "conteo",
      detalle:
        c.diferencia === 0
          ? "Conteo físico: coincidió con el sistema"
          : `Conteo físico: contaron ${c.contado} (sistema decía ${c.sistema})`,
      cantidad: Math.abs(c.diferencia),
      signo: c.diferencia === 0 ? 0 : c.diferencia > 0 ? 1 : -1,
      delta: Number(c.diferencia),
      referencia: c.notas,
      created_by: c.created_by,
      movId: null,
      tipoMov: null,
      anulado: null,
      fotoPath: null,
      destino: null,
    }));

    setEntries(
      [...movs, ...counts].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    );
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { entries, loading, error, reload };
}

const MOVEMENT_KARDEX_LABELS: Record<string, string> = {
  entrada: "Entrada de mercancía",
  salida: "Salida manual",
  ajuste: "Ajuste de inventario",
  merma: "Merma (material dañado)",
  exhibicion: "Salió a exhibición",
  regreso_exhibicion: "Regresó de exhibición",
  conteo: "Ajuste por conteo físico",
};

const MOVEMENT_KARDEX_SIGNO: Record<string, 1 | -1> = {
  entrada: 1,
  salida: -1,
  ajuste: 1,
  merma: -1,
  exhibicion: -1,
  regreso_exhibicion: 1,
  conteo: 1,
};

/** Actualiza el precio, la rotación y/o los datos de etiqueta de un
 * producto (Gerencia y Almacén). */
export async function updateProductComercial(
  productId: string,
  data: {
    unit_price?: number;
    rotacion?: string;
    stock_minimo?: number;
    color?: string | null;
    medida?: string | null;
    tipo?: string | null;
    calidad?: string | null;
    medida_caja?: string | null;
  }
) {
  const { error } = await supabase.from("products").update(data).eq("id", productId);
  return { error: error?.message ?? null };
}

/** Actualiza únicamente el % de descuento de un producto (Gerencia y Ventas). */
export async function updateProductDescuento(productId: string, descuento: number) {
  const { error } = await supabase.rpc("update_product_descuento", {
    p_product_id: productId,
    p_descuento: descuento,
  });
  return { error: error?.message ?? null };
}

/** Historial de material sacado a exhibición / regresado a almacén. */
export function useDisplayMovements() {
  const [displayMovements, setDisplayMovements] = useState<DisplayMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("display_movements")
      .select("*, product:products(code, name, unit)")
      .order("created_at", { ascending: false })
      .limit(100);
    setDisplayMovements((data as unknown as DisplayMovement[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { displayMovements, loading, reload };
}

/** Conteos físicos registrados (los más recientes primero). */
export function useInventoryCounts() {
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_counts")
      .select("*, product:products(code, name, unit)")
      .order("created_at", { ascending: false })
      .limit(200);
    setCounts((data as unknown as InventoryCount[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { counts, loading, reload };
}

export async function moveToDisplay(
  productId: string,
  quantity: number,
  ubicacion: string,
  notas: string,
  photoPath: string | null
) {
  const { error } = await supabase.rpc("move_to_display", {
    p_product_id: productId,
    p_quantity: quantity,
    p_ubicacion: ubicacion || null,
    p_notas: notas || null,
    p_photo_path: photoPath,
  });
  return { error: error?.message ?? null };
}

export async function returnFromDisplay(productId: string, quantity: number, notas: string) {
  const { error } = await supabase.rpc("return_from_display", {
    p_product_id: productId,
    p_quantity: quantity,
    p_notas: notas || null,
  });
  return { error: error?.message ?? null };
}

/** Registra un conteo físico. Devuelve la diferencia (contado − sistema). */
export async function registerPhysicalCount(productId: string, contado: number, notas: string) {
  const { data, error } = await supabase.rpc("register_physical_count", {
    p_product_id: productId,
    p_contado: contado,
    p_notas: notas || null,
  });
  return { diferencia: (data as number | null) ?? null, error: error?.message ?? null };
}

// ============================================================
// Auditoría de exhibición
// ============================================================
export function useDisplayRequests() {
  const [requests, setRequests] = useState<DisplayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("display_requests")
      .select("*, product:products(code, name, unit, external_id)")
      .order("solicitado_at", { ascending: false })
      .limit(300);
    if (err) setError(err.message);
    else {
      setError(null);
      setRequests((data as unknown as DisplayRequest[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { requests, loading, error, reload };
}

export async function solicitarExhibicion(input: {
  productId: string;
  tipo: "exhibir" | "retirar";
  cantidad: number;
  muestra: string;
  ubicacion: string;
  notas: string;
  photoPath: string | null;
}) {
  const { error } = await supabase.rpc("solicitar_exhibicion", {
    p_product_id: input.productId,
    p_tipo: input.tipo,
    p_cantidad: input.cantidad,
    p_muestra: input.muestra || null,
    p_ubicacion: input.ubicacion || null,
    p_notas: input.notas || null,
    p_photo_path: input.photoPath,
  });
  return { error: error?.message ?? null };
}

export async function revisarExhibicion(requestId: string, aprobar: boolean, comentario: string) {
  const { error } = await supabase.rpc("revisar_exhibicion", {
    p_request_id: requestId,
    p_aprobar: aprobar,
    p_comentario: comentario || null,
  });
  return { error: error?.message ?? null };
}

export async function marcarExhibidosInicial() {
  const { data, error } = await supabase.rpc("marcar_exhibidos_inicial");
  return { marcados: (data as number | null) ?? 0, error: error?.message ?? null };
}
