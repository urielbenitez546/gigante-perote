import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { PurchaseInvoice, MaterialWriteOff } from "../types";

export function usePurchaseInvoices() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("purchase_invoices")
      .select("*, purchase_invoice_items(*, product:products(code, name, unit, brand, category))")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setInvoices((data as unknown as PurchaseInvoice[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { invoices, loading, error, reload };
}

export interface InvoiceItemInput {
  product_id: string;
  quantity: number;
}

export async function registerPurchaseInvoice(
  invoiceNumber: string,
  supplier: string,
  photoPath: string | null,
  items: InvoiceItemInput[]
) {
  const { data, error } = await supabase.rpc("register_purchase_invoice", {
    p_invoice_number: invoiceNumber,
    p_supplier: supplier,
    p_photo_path: photoPath,
    p_items: items,
  });
  return { invoiceId: data as string | null, error: error?.message ?? null };
}

export function useWriteOffs() {
  const [writeOffs, setWriteOffs] = useState<MaterialWriteOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("material_write_offs")
      .select("*, product:products(code, name, unit)")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setWriteOffs((data as unknown as MaterialWriteOff[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { writeOffs, loading, error, reload };
}

export async function registerWriteOff(
  productId: string,
  quantity: number,
  reason: string,
  photoPath: string | null
) {
  const { error } = await supabase.rpc("register_write_off", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reason: reason,
    p_photo_path: photoPath,
  });
  return { error: error?.message ?? null };
}
