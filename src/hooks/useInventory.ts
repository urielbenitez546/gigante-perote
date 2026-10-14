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
  referencia: string | null;
  created_by: string | null;
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
        .select("id, type, quantity, reference, created_by, created_at")
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

    const movs: KardexEntry[] = (movRes.data ?? []).map((m) => ({
      id: `mov-${m.id}`,
      fecha: m.created_at,
      tipo: "movimiento",
      detalle: MOVEMENT_KARDEX_LABELS[m.type as string] ?? m.type,
      cantidad: m.quantity,
      signo: MOVEMENT_KARDEX_SIGNO[m.type as string] ?? 0,
      referencia: m.reference,
      created_by: m.created_by,
    }));

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
      referencia: c.notas,
      created_by: c.created_by,
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
