import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { SaleWithItems, DeliveryType } from "../types";

export function useSales() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("sales")
      .select("*, sale_items(*, product:products(code, name, unit))")
      .order("created_at", { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setSales((data as unknown as SaleWithItems[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { sales, loading, error, reload };
}

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  delivery_type?: DeliveryType;
}

export async function registerSale(
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  deliveryType: DeliveryType,
  items: SaleItemInput[],
  scheduledPickupDate?: string
) {
  const { data, error } = await supabase.rpc("register_sale", {
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_customer_address: customerAddress || null,
    p_delivery_type: deliveryType,
    p_items: items,
    p_scheduled_pickup_date: scheduledPickupDate || null,
  });
  return { folio: data as string | null, error: error?.message ?? null };
}

export interface RetiroItemInput {
  sale_item_id: string;
  quantity: number;
}

/**
 * Registra un retiro en sucursal. Si no se pasan "items", retira TODO
 * lo pendiente de retiro de la venta (comportamiento anterior). Si se
 * pasan "items", retira solo esas cantidades (retiro parcial).
 */
export async function registerRetiro(saleId: string, items?: RetiroItemInput[]) {
  const { error } = await supabase.rpc("register_retiro", {
    p_sale_id: saleId,
    p_items: items ?? null,
  });
  return { error: error?.message ?? null };
}
