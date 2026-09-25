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
