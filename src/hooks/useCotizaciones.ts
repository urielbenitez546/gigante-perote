import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { TipoPrecio } from "../types";

export type EstadoCotizacion = "abierta" | "convertida" | "cancelada";

export interface CotizacionItem {
  id: string;
  cotizacion_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tipo_precio: TipoPrecio;
  product?: { code: string; name: string; unit: string } | null;
}

export interface Cotizacion {
  id: string;
  folio: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  notas: string | null;
  vigencia_hasta: string; // yyyy-mm-dd
  status: EstadoCotizacion;
  total: number;
  sale_folio: string | null;
  motivo_cancelacion: string | null;
  created_by: string | null;
  created_at: string;
  cerrada_at: string | null;
  cotizacion_items: CotizacionItem[];
}

export function useCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("cotizaciones")
      .select("*, cotizacion_items(*, product:products(code, name, unit))")
      .order("created_at", { ascending: false })
      .limit(150);
    if (err) setError(err.message);
    else {
      setError(null);
      setCotizaciones((data as unknown as Cotizacion[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { cotizaciones, loading, error, reload };
}

export interface NuevaCotizacionInput {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  vigenciaDias: number;
  notas: string;
  items: { product_id: string; quantity: number; tipo_precio: TipoPrecio }[];
}

export async function crearCotizacion(c: NuevaCotizacionInput) {
  const { data, error } = await supabase.rpc("crear_cotizacion", {
    p_customer_name: c.customerName,
    p_customer_phone: c.customerPhone || null,
    p_customer_address: c.customerAddress || null,
    p_vigencia_dias: c.vigenciaDias,
    p_notas: c.notas || null,
    p_items: c.items,
  });
  return { folio: (data as string | null) ?? null, error: error?.message ?? null };
}

export async function marcarCotizacionConvertida(id: string, saleFolio: string) {
  const { error } = await supabase.rpc("marcar_cotizacion_convertida", {
    p_cotizacion_id: id,
    p_sale_folio: saleFolio,
  });
  return { error: error?.message ?? null };
}

export async function cancelarCotizacion(id: string, motivo: string) {
  const { error } = await supabase.rpc("cancelar_cotizacion", { p_cotizacion_id: id, p_motivo: motivo });
  return { error: error?.message ?? null };
}
