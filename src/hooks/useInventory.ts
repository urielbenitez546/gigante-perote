import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Product, InventoryMovement } from "../types";

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
