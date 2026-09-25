import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { DiscountRule, LabelBatch, LabelQueueItem, ResultadoActualizacion, StoreZone } from "../types";

export function useStoreZones() {
  const [zonas, setZonas] = useState<StoreZone[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("store_zones").select("*").order("orden").order("nombre");
    setZonas((data as StoreZone[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { zonas, loading, reload };
}

export async function guardarZona(z: { id?: string; nombre: string; vendedor_id: string | null; orden: number }) {
  const { error } = z.id
    ? await supabase.from("store_zones").update({ nombre: z.nombre, vendedor_id: z.vendedor_id, orden: z.orden }).eq("id", z.id)
    : await supabase.from("store_zones").insert({ nombre: z.nombre, vendedor_id: z.vendedor_id, orden: z.orden });
  return { error: error?.message ?? null };
}

export async function borrarZona(id: string) {
  const { error } = await supabase.from("store_zones").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function asignarZona(productIds: string[], zonaId: string | null) {
  const { data, error } = await supabase.rpc("asignar_zona", { p_product_ids: productIds, p_zona_id: zonaId });
  return { n: (data as number | null) ?? 0, error: error?.message ?? null };
}

export async function asignarTamanoEtiqueta(productIds: string[], tamano: string | null) {
  const { data, error } = await supabase.rpc("asignar_tamano_etiqueta", { p_product_ids: productIds, p_tamano: tamano ?? "" });
  return { n: (data as number | null) ?? 0, error: error?.message ?? null };
}

export function useDiscountRules() {
  const [reglas, setReglas] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("discount_rules").select("rotacion, descuento");
    setReglas((data as DiscountRule[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { reglas, loading, reload };
}

export async function guardarReglas(reglas: DiscountRule[], aplicar: boolean) {
  const { data, error } = await supabase.rpc("guardar_reglas_descuento", { p_reglas: reglas, p_aplicar: aplicar });
  return { aplicados: (data as number | null) ?? 0, error: error?.message ?? null };
}

/** Etiquetas abiertas (pendientes / impresas) y las colocadas de los últimos 30 días. */
export function useLabelQueue() {
  const [items, setItems] = useState<LabelQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error: err } = await supabase
      .from("label_queue")
      .select("*, product:products(*)")
      .or(`estado.neq.colocada,colocada_at.gte.${hace30}`)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (err) setError(err.message);
    else {
      setError(null);
      setItems((data as unknown as LabelQueueItem[]) ?? []);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { items, loading, error, reload };
}

export async function marcarEtiquetas(ids: string[], estado: "impresa" | "colocada" | "pendiente") {
  const { data, error } = await supabase.rpc("marcar_etiquetas", { p_ids: ids, p_estado: estado });
  return { n: (data as number | null) ?? 0, error: error?.message ?? null };
}

export function useLabelBatches() {
  const [lotes, setLotes] = useState<LabelBatch[]>([]);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("label_batches").select("*").order("created_at", { ascending: false }).limit(30);
    setLotes((data as LabelBatch[]) ?? []);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { lotes, reload };
}

export interface FilaActualizacion {
  id: string;
  rotacion?: string;
  precio?: string;
  descuento?: string;
}

export async function aplicarActualizacion(nombre: string, filas: FilaActualizacion[], simular: boolean) {
  const { data, error } = await supabase.rpc("aplicar_actualizacion_etiquetas", {
    p_nombre: nombre,
    p_filas: filas,
    p_simular: simular,
  });
  return { resultado: (data as ResultadoActualizacion | null) ?? null, error: error?.message ?? null };
}
